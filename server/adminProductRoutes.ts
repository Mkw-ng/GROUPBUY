/**
 * Admin Product CSV Export / Import Routes
 *
 * GET  /api/admin/products/export  — download all products as CSV (UTF-8 BOM)
 * POST /api/admin/products/import  — upload CSV, validate, dry-run or apply
 *
 * Both routes are admin-only (same sdk.authenticateRequest + role check used
 * by invoiceRoutes.ts).
 */
import { Router } from "express";
import type { Application } from "express";
import multer from "multer";
import { z } from "zod";
import { sdk } from "./_core/sdk";
import { getAllProducts, upsertProduct } from "./db";
import { ALL_BADGES } from "../shared/badges";

// ─── CSV escaping ─────────────────────────────────────────────────────────────

function csvEscape(value: string | number | boolean | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Parse a raw CSV string (handles UTF-8 BOM, CRLF, quoted fields with
 * embedded commas/newlines, and doubled-quote escaping).
 * Returns an array of row objects keyed by the header row.
 */
export function parseCsvRows(raw: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present
  const text = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;

  // Tokenise into cells — handles quoted fields with embedded commas/newlines
  function tokenise(src: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let i = 0;

    while (i < src.length) {
      if (src[i] === '"') {
        // Quoted field
        let cell = "";
        i++; // skip opening quote
        while (i < src.length) {
          if (src[i] === '"') {
            if (src[i + 1] === '"') {
              cell += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            cell += src[i++];
          }
        }
        row.push(cell);
        // Skip trailing comma or newline
        if (src[i] === ",") i++;
        else if (src[i] === "\r" && src[i + 1] === "\n") {
          rows.push(row);
          row = [];
          i += 2;
        } else if (src[i] === "\n") {
          rows.push(row);
          row = [];
          i++;
        }
      } else {
        // Unquoted field — read until comma or newline
        let cell = "";
        while (i < src.length && src[i] !== "," && src[i] !== "\n" && src[i] !== "\r") {
          cell += src[i++];
        }
        row.push(cell);
        if (src[i] === ",") i++;
        else if (src[i] === "\r" && src[i + 1] === "\n") {
          rows.push(row);
          row = [];
          i += 2;
        } else if (src[i] === "\n") {
          rows.push(row);
          row = [];
          i++;
        }
      }
    }
    if (row.length > 0) rows.push(row);
    return rows;
  }

  const allRows = tokenise(text);
  if (allRows.length < 2) return [];

  const headers = allRows[0].map((h) => h.trim());
  const result: Record<string, string>[] = [];

  for (let r = 1; r < allRows.length; r++) {
    const cells = allRows[r];
    // Skip completely blank rows
    if (cells.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (cells[c] ?? "").trim();
    }
    result.push(obj);
  }

  return result;
}

// ─── Row validator ────────────────────────────────────────────────────────────

const CATEGORY_VALUES = [
  "limited-offer", "featured-deals", "m3atfr3ak", "beef", "pork", "lamb",
  "poultry", "seafood", "whole-slabs", "whole-animal", "box-deals", "mince",
  "offal-tallow", "value-added", "korean-bbq-hotpot", "burger-sausages",
  "bbq-packs", "quick-meals", "freezer", "other",
] as const;

const VISIBILITY_VALUES = ["regular_only", "always", "power_drop_only"] as const;

const BADGE_VALUES = [...ALL_BADGES, ""] as const;

const rowSchema = z.object({
  id: z.string().transform((v) => (v === "" ? undefined : Number(v))).pipe(
    z.number().int().positive().optional()
  ),
  name: z.string().min(1, "name is required"),
  cut: z.string().default(""),
  category: z.preprocess(
    (v) => v,
    z.enum(CATEGORY_VALUES, {
      message: `category must be one of: ${CATEGORY_VALUES.join(", ")}`,
    })
  ),
  // Note: z.enum in zod v4 uses 'message' not 'errorMap'
  description: z.string().transform((v) => (v === "" ? null : v)).pipe(z.string().nullable()),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "price must be a valid decimal number"),
  powerDropPrice: z.string().transform((v) => (v === "" ? null : v)).pipe(
    z.string().regex(/^\d+(\.\d{1,2})?$/, "powerDropPrice must be a valid decimal number").nullable()
  ),
  retailPrice: z.string().transform((v) => (v === "" ? null : v)).pipe(
    z.string().regex(/^\d+(\.\d{1,2})?$/, "retailPrice must be a valid decimal number").nullable()
  ),
  unit: z.string().min(1, "unit is required"),
  badge: z.string().transform((v) => (v === "" ? null : v)).pipe(
    z.enum(["LIMITED", "POPULAR", "NEW", "SOLD OUT"] as const).nullable()
  ),
  available: z.preprocess((v) => {
    const upper = String(v).toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    return v; // leave as-is so the next step can produce a proper error
  }, z.boolean({ error: "available must be TRUE or FALSE" })),
  visibility: z.enum(VISIBILITY_VALUES).default("regular_only"),
  stockLimit: z.string().transform((v) => (v === "" ? null : v)).pipe(
    z.string().regex(/^\d+(\.\d{1,3})?$/, "stockLimit must be a valid decimal number").nullable()
  ),
  sortOrder: z.string().transform((v) => (v === "" ? 0 : Number(v))).pipe(
    z.number().int().min(0)
  ),
  img: z.string().transform((v) => (v === "" ? null : v)).pipe(z.string().nullable()),
});

export type ValidatedProductRow = z.infer<typeof rowSchema>;

export interface RowError {
  row: number; // 1-based (excluding header)
  message: string;
}

export interface ParseResult {
  rows: ValidatedProductRow[];
  errors: RowError[];
}

/**
 * Validate all rows from parseCsvRows output.
 * Returns validated rows (empty on any error) and error list.
 */
export function validateProductRows(rawRows: Record<string, string>[]): ParseResult {
  const rows: ValidatedProductRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 1; // 1-based
    const raw = rawRows[i];

    // Pick only the columns we care about
    const input = {
      id: raw["id"] ?? "",
      name: raw["name"] ?? "",
      cut: raw["cut"] ?? "",
      category: raw["category"] ?? "",
      description: raw["description"] ?? "",
      price: raw["price"] ?? "",
      powerDropPrice: raw["powerDropPrice"] ?? "",
      retailPrice: raw["retailPrice"] ?? "",
      unit: raw["unit"] ?? "",
      badge: raw["badge"] ?? "",
      available: raw["available"] ?? "",
      visibility: raw["visibility"] ?? "regular_only",
      stockLimit: raw["stockLimit"] ?? "",
      sortOrder: raw["sortOrder"] ?? "0",
      img: raw["img"] ?? "",
    };

    const result = rowSchema.safeParse(input);
    if (result.success) {
      rows.push(result.data);
    } else {
      const msgs = result.error.issues.map((iss) => iss.message).join("; ");
      errors.push({ row: rowNum, message: msgs });
    }
  }

  return { rows: errors.length > 0 ? [] : rows, errors };
}

// ─── Route registration ───────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function registerAdminProductRoutes(app: Application) {
  const router = Router();

  // ── GET /api/admin/products/export ─────────────────────────────────────────
  router.get("/api/admin/products/export", async (req, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req as any);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user || user.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const allProducts = await getAllProducts();

      const HEADERS = [
        "id", "name", "cut", "category", "description", "price",
        "powerDropPrice", "retailPrice", "unit", "badge", "available",
        "visibility", "stockLimit", "sortOrder", "img",
      ];

      const headerRow = HEADERS.map(csvEscape).join(",");
      const dataRows = allProducts.map((p) => [
        csvEscape(p.id),
        csvEscape(p.name),
        csvEscape(p.cut),
        csvEscape(p.category),
        csvEscape(p.description),
        csvEscape(p.price),
        csvEscape(p.powerDropPrice),
        csvEscape(p.retailPrice),
        csvEscape(p.unit),
        csvEscape(p.badge),
        csvEscape(p.available ? "TRUE" : "FALSE"),
        csvEscape(p.visibility ?? "regular_only"),
        csvEscape(p.stockLimit),
        csvEscape(p.sortOrder),
        csvEscape(p.img),
      ].join(","));

      const csvContent = [headerRow, ...dataRows].join("\r\n");
      const dateStr = new Date().toISOString().slice(0, 10);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="products-${dateStr}.csv"`);
      // UTF-8 BOM so Excel opens correctly
      res.send("\uFEFF" + csvContent);
    } catch (err) {
      console.error("[products-export] error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to export products" });
    }
  });

  // ── POST /api/admin/products/import ────────────────────────────────────────
  router.post("/api/admin/products/import", upload.single("file"), async (req, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req as any);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user || user.role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const dryRun = req.query["dryRun"] === "true";
      const rawCsv = req.file.buffer.toString("utf-8");
      const rawRows = parseCsvRows(rawCsv);

      if (rawRows.length === 0) {
        res.json({ updates: 0, creates: 0, errors: [] });
        return;
      }

      const { rows, errors } = validateProductRows(rawRows);

      if (errors.length > 0) {
        res.json({ updates: 0, creates: 0, errors });
        return;
      }

      // Verify that all rows with an id reference existing products
      const existingProducts = await getAllProducts();
      const existingIds = new Set(existingProducts.map((p) => p.id));
      const idErrors: RowError[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.id !== undefined && !existingIds.has(row.id)) {
          idErrors.push({ row: i + 1, message: `Product id ${row.id} does not exist` });
        }
      }

      if (idErrors.length > 0) {
        res.json({ updates: 0, creates: 0, errors: idErrors });
        return;
      }

      const updates = rows.filter((r) => r.id !== undefined).length;
      const creates = rows.filter((r) => r.id === undefined).length;

      if (dryRun) {
        res.json({ updates, creates, errors: [] });
        return;
      }

      // Apply all rows (all-or-nothing: errors already ruled out above)
      for (const row of rows) {
        await upsertProduct({
          id: row.id,
          name: row.name,
          cut: row.cut,
          category: row.category,
          description: row.description,
          price: row.price,
          powerDropPrice: row.powerDropPrice,
          retailPrice: row.retailPrice,
          unit: row.unit,
          badge: row.badge,
          available: row.available,
          visibility: row.visibility,
          stockLimit: row.stockLimit,
          sortOrder: row.sortOrder,
          img: row.img,
        });
      }

      res.json({ updates, creates, errors: [] });
    } catch (err) {
      console.error("[products-import] error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to import products" });
    }
  });

  app.use(router);
}
