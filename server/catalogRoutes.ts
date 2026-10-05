import archiver from "archiver";
import { asc } from "drizzle-orm";
import { Router } from "express";
import type { Application, Request, Response } from "express";
import multer from "multer";
import { categorySections, categories, orders, products } from "../drizzle/schema";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import {
  exportCatalogCsv,
  parseCatalogFiles,
  parseOrderedProductIds,
  validateAndPlan,
  type CatalogSnapshot,
} from "./catalogCsv";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
});

type ReadExecutor = { select: (...args: unknown[]) => any };

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  try {
    const user = await sdk.authenticateRequest(req as any);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
}

/** Reads the catalog only, in the exact ordering used by the current db.ts helpers. */
export async function readCatalogSnapshot(executor: ReadExecutor): Promise<CatalogSnapshot> {
  const [sections, catalogCategories, catalogProducts] = await Promise.all([
    executor.select().from(categorySections).orderBy(asc(categorySections.sortOrder)),
    executor.select().from(categories).orderBy(asc(categories.sortOrder)),
    executor.select().from(products).orderBy(products.sortOrder, products.createdAt),
  ]);
  return {
    sections,
    categories: catalogCategories,
    products: catalogProducts,
    orderedProductIds: new Set<number>(),
    unreadableOrderCount: 0,
  };
}

/** Reads only orders.items and delegates all parsing rules to the pure planner module. */
export async function readOrderedProductIds(executor: ReadExecutor) {
  const rows = await executor.select({ items: orders.items }).from(orders);
  return parseOrderedProductIds(rows.map((row: { items: string }) => row.items));
}

async function getReadExecutor(): Promise<ReadExecutor> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db as unknown as ReadExecutor;
}

function melbourneDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

function handleMulterError(error: unknown, res: Response): boolean {
  if (!(error instanceof multer.MulterError)) return false;
  if (error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Each CSV file must be 5 MB or smaller" });
    return true;
  }
  res.status(400).json({ error: error.message });
  return true;
}

function parseRestoreMode(value: unknown): boolean | null {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  return null;
}

/** Registers export and preview-only catalog CSV routes. This module contains no apply/write route. */
export function registerCatalogRoutes(app: Application): void {
  const router = Router();

  router.get("/api/admin/catalog/export", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const executor = await getReadExecutor();
      const files = exportCatalogCsv(await readCatalogSnapshot(executor));
      const filename = `catalog-${melbourneDate()}.zip`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", (error) => {
        console.error("[catalog-export] archive error", error);
        if (res.headersSent) res.destroy(error);
        else res.status(500).json({ error: "Failed to build catalog export" });
      });
      archive.pipe(res);
      archive.append(files["sections.csv"], { name: "sections.csv" });
      archive.append(files["categories.csv"], { name: "categories.csv" });
      archive.append(files["products.csv"], { name: "products.csv" });
      await archive.finalize();
    } catch (error) {
      console.error("[catalog-export] error", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to export catalog" });
    }
  });

  router.get("/api/admin/catalog/export/:file", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const requested = req.params.file.toLowerCase();
    if (requested !== "sections" && requested !== "categories" && requested !== "products") {
      res.status(404).json({ error: "Catalog file not found" });
      return;
    }
    try {
      const executor = await getReadExecutor();
      const files = exportCatalogCsv(await readCatalogSnapshot(executor));
      sendCsv(res, `${requested}.csv`, files[`${requested}.csv`]);
    } catch (error) {
      console.error("[catalog-export] error", error);
      res.status(500).json({ error: "Failed to export catalog" });
    }
  });

  router.post("/api/admin/catalog/preview", async (req, res, next) => {
    if (!(await requireAdmin(req, res))) return;
    upload.array("files", 3)(req, res, (error) => {
      if (handleMulterError(error, res)) return;
      if (error) {
        res.status(400).json({ error: "Unable to read uploaded files" });
        return;
      }
      next();
    });
  }, async (req, res) => {
    try {
      const restoreMode = parseRestoreMode(req.body?.restoreMode);
      if (restoreMode === null) {
        res.status(400).json({ error: "restoreMode must be true or false" });
        return;
      }
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        res.status(400).json({ error: "Choose one to three CSV files" });
        return;
      }
      const executor = await getReadExecutor();
      const [snapshot, orderInfo] = await Promise.all([
        readCatalogSnapshot(executor),
        readOrderedProductIds(executor),
      ]);
      snapshot.orderedProductIds = orderInfo.orderedProductIds;
      snapshot.unreadableOrderCount = orderInfo.unreadableOrderCount;
      const parsed = parseCatalogFiles(files.map((file) => ({ filename: file.originalname, text: file.buffer.toString("utf8") })));
      res.json(validateAndPlan(parsed, snapshot, { restoreMode }));
    } catch (error) {
      console.error("[catalog-preview] error", error);
      res.status(500).json({ error: "Failed to preview catalog changes" });
    }
  });

  app.use(router);
}

export default registerCatalogRoutes;
