/**
 * Packing Sheet Download Route
 * GET /api/admin/invoices/download
 *   - Admin-only
 *   - Fetches all paid orders from the DB
 *   - Generates a single PDF packing sheet grouped by location, sorted by pickupDate
 *   - Returns the PDF directly (not zipped)
 */
import { Router } from "express";
import type { Application } from "express";
import PDFDocument from "pdfkit";
import { sdk } from "./_core/sdk";
import { getAllOrders } from "./db";

interface OrderItem {
  id: number;
  name: string;
  cut: string;
  qty: number;
  price: string;
  unit: string;
  finalWeightKg?: string;
}

function parseItems(raw: string): OrderItem[] {
  try {
    return JSON.parse(raw) as OrderItem[];
  } catch {
    return [];
  }
}

function locationLabel(location: string, address: string | null): string {
  if (location === "delivery") return `Delivery${address ? ` — ${address}` : ""}`;
  if (location === "cranbourne") return "Cranbourne Park (Mitchells Quality Meat)";
  if (location === "clayton") return "Clayton South (BQ Direct)";
  return location;
}

// Location group order: Cranbourne first, then Clayton, then Delivery, then others
const LOCATION_ORDER: Record<string, number> = {
  cranbourne: 0,
  clayton: 1,
  delivery: 2,
};

function locationSortKey(location: string): number {
  return LOCATION_ORDER[location.toLowerCase()] ?? 3;
}

type PaidOrder = {
  id: number;
  phone: string;
  pickupDate: string;
  location: string;
  deliveryAddress: string | null;
  items: string;
  specialInstructions: string | null;
  deliveryCharge: string | null;
  isPowerDrop: boolean;
  createdAt: Date;
  status: string;
};

function generatePackingSheetPDF(orders: PaidOrder[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const dateGenerated = new Date().toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // ── Document header ────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#000000")
      .text("GROUPBUY — Packing Sheet", { align: "left" });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(`Generated: ${dateGenerated}`, { align: "left" })
      .moveDown(0.8);

    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#000000")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);

    // ── Group orders by location, sort by pickupDate within each group ─────────
    const groups = new Map<string, PaidOrder[]>();
    for (const o of orders) {
      const key = o.location.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    }

    // Sort groups by location order
    const sortedGroups = Array.from(groups.entries()).sort(
      ([a], [b]) => locationSortKey(a) - locationSortKey(b)
    );

    // Sort orders within each group by pickupDate ascending
    for (const [, groupOrders] of sortedGroups) {
      groupOrders.sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
    }

    // ── Render each location group ─────────────────────────────────────────────
    for (const [location, groupOrders] of sortedGroups) {
      const groupLabel = locationLabel(location, null);

      // Section header
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#000000")
        .text(groupLabel.toUpperCase());

      doc.moveDown(0.2);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#333333")
        .lineWidth(0.75)
        .stroke();
      doc.moveDown(0.6);

      // ── Render each order in this group ───────────────────────────────────────
      for (let i = 0; i < groupOrders.length; i++) {
        const order = groupOrders[i];
        const items = parseItems(order.items);

        // 8pt space above each customer block
        doc.moveDown(0.6);

        // Phone (bold, 14pt)
        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#000000")
          .text(order.phone);

        // Pickup date
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#333333")
          .text(`Pickup: ${order.pickupDate}`);

        // Delivery address (only for delivery orders)
        if (order.location.toLowerCase() === "delivery" && order.deliveryAddress) {
          doc.text(`Address: ${order.deliveryAddress}`);
        }

        // Special instructions
        if (order.specialInstructions) {
          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor("#333333")
            .text(`Notes: `, { continued: true })
            .font("Helvetica")
            .text(order.specialInstructions);
        }

        doc.moveDown(0.3);

        // Items list
        for (const item of items) {
          const weightStr =
            item.finalWeightKg && parseFloat(item.finalWeightKg) > 0
              ? ` (${parseFloat(item.finalWeightKg).toFixed(1)} kg)`
              : "";
          const cleanCut = (item.cut || "").replace(/·/g, "—");
          const line = `${item.qty} x ${item.name} — ${cleanCut}${weightStr}`;
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#000000")
            .text(line, { indent: 10 });
        }

        // Full-width rule after every customer block
        doc.moveDown(0.5);
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor("#cccccc")
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.8);
      }

      doc.moveDown(1.2);
    }

    // Page numbers: go back through each page after all content is written
    // to avoid triggering pageAdded recursively during text rendering.
    const totalPages = doc.bufferedPageRange().count + 1; // +1 for current page
    for (let p = 0; p < totalPages; p++) {
      doc.switchToPage(p);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#aaaaaa")
        .text(
          `Page ${p + 1}`,
          50,
          doc.page.height - 40,
          { align: "center", width: doc.page.width - 100 }
        );
    }

    doc.end();
  });
}

function generateScheduleListPDF(orders: PaidOrder[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const dateGenerated = new Date().toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // ── Document header ────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#000000")
      .text("GROUPBUY \u2014 Schedule List", { align: "left" });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(`Generated: ${dateGenerated}`, { align: "left" })
      .moveDown(0.8);

    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#000000")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);

    // ── Group and sort orders ──────────────────────────────────────────────────
    const groups = new Map<string, PaidOrder[]>();
    for (const o of orders) {
      const key = o.location.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    }

    const sortedGroups = Array.from(groups.entries()).sort(
      ([a], [b]) => locationSortKey(a) - locationSortKey(b)
    );

    // Within each group: sort by pickupDate asc, then phone asc
    for (const [, groupOrders] of sortedGroups) {
      groupOrders.sort((a, b) => {
        const dateCmp = a.pickupDate.localeCompare(b.pickupDate);
        if (dateCmp !== 0) return dateCmp;
        return a.phone.localeCompare(b.phone);
      });
    }

    // ── Render each location group ─────────────────────────────────────────────
    for (const [location, groupOrders] of sortedGroups) {
      const groupLabel = locationLabel(location, null);

      // Section header
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#000000")
        .text(groupLabel.toUpperCase());

      doc.moveDown(0.2);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#333333")
        .lineWidth(0.75)
        .stroke();
      doc.moveDown(0.6);

      // Group by pickupDate within this location
      const dateGroups = new Map<string, PaidOrder[]>();
      for (const o of groupOrders) {
        if (!dateGroups.has(o.pickupDate)) dateGroups.set(o.pickupDate, []);
        dateGroups.get(o.pickupDate)!.push(o);
      }

      for (const [pickupDate, dateOrders] of Array.from(dateGroups.entries())) {
        // Date sub-header
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#000000")
          .text(pickupDate);
        doc.moveDown(0.2);

        // One line per order
        for (const order of dateOrders) {
          const addressPart =
            order.location.toLowerCase() === "delivery" && order.deliveryAddress
              ? ` (${order.deliveryAddress})`
              : "";
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#000000")
            .text(`${order.phone}${addressPart}`, { indent: 10 });
        }

        doc.moveDown(0.5);
      }

      doc.moveDown(0.8);
    }

    // ── Page numbers ───────────────────────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count + 1;
    for (let p = 0; p < totalPages; p++) {
      doc.switchToPage(p);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#aaaaaa")
        .text(
          `Page ${p + 1}`,
          50,
          doc.page.height - 40,
          { align: "center", width: doc.page.width - 100 }
        );
    }

    doc.end();
  });
}

export function registerInvoiceRoutes(app: Application) {
  const router = Router();

  router.get("/api/admin/invoices/download", async (req, res) => {
    try {
      // Admin-only auth check
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

      // Fetch all paid orders
      const allOrders = await getAllOrders();
      const paidOrders = allOrders.filter((o) => o.status === "paid") as PaidOrder[];

      if (paidOrders.length === 0) {
        res.status(404).json({ error: "No paid orders found" });
        return;
      }

      const pdfBuffer = await generatePackingSheetPDF(paidOrders);

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="packing-sheet-${dateStr}.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("[packing-sheet] error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate packing sheet" });
      }
    }
  });

  router.get("/api/admin/schedule/download", async (req, res) => {
    try {
      // Admin-only auth check
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

      // Fetch all paid orders
      const allOrders = await getAllOrders();
      const paidOrders = allOrders.filter((o) => o.status === "paid") as PaidOrder[];

      if (paidOrders.length === 0) {
        res.status(404).json({ error: "No paid orders found" });
        return;
      }

      const pdfBuffer = await generateScheduleListPDF(paidOrders);

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="schedule-list-${dateStr}.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("[schedule-list] error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate schedule list" });
      }
    }
  });

  app.use(router);
}
