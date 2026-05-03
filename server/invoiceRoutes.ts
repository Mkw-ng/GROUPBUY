/**
 * Invoice Download Routes
 * GET /api/admin/invoices/download
 *   - Admin-only
 *   - Fetches all paid orders from the DB
 *   - Generates one PDF per order using PDFKit
 *   - Streams a ZIP archive containing all PDFs back to the client
 */
import { Router } from "express";
import type { Application } from "express";
import PDFDocument from "pdfkit";
import archiver from "archiver";
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

function calcItemTotal(item: OrderItem): number {
  const price = parseFloat(item.price) || 0;
  const weight = parseFloat(item.finalWeightKg || "") || 0;
  if (weight > 0) return price * weight;
  return price * item.qty;
}

function locationLabel(location: string, address: string | null): string {
  if (location === "delivery") return `Delivery${address ? ` — ${address}` : ""}`;
  if (location === "cranbourne") return "Cranbourne Park (Mitchells Quality Meat)";
  if (location === "clayton") return "Clayton South (BQ Direct)";
  return location;
}

function stripUnit(unit: string): string {
  return unit.replace(/^\/\s*/, "");
}

/**
 * Generate a PDF invoice for a single order and return it as a Buffer.
 */
function generateInvoicePDF(order: {
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
}, bankDetails: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const items = parseItems(order.items);
    const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
    const delivery = parseFloat(order.deliveryCharge || "0") || 0;
    const grandTotal = subtotal + delivery;

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("GROUPBUY", { align: "left" });

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#666666")
      .text("Mitchells Quality Meat", { align: "left" })
      .moveDown(0.3);

    if (order.isPowerDrop) {
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#c73e3a")
        .text("⚡ POWER DROP ORDER", { align: "left" });
    }

    // Horizontal rule
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);

    // ── Invoice meta ────────────────────────────────────────────────────────
    doc.fillColor("#000000");
    const metaY = doc.y;

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(`INVOICE #${order.id}`, 50, metaY);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(`Status: PAID`, 50, metaY + 22)
      .text(`Issued: ${new Date(order.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`, 50, metaY + 35);

    // Right-side customer info
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#000000")
      .text("BILL TO", 350, metaY, { width: 195, align: "right" });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#333333")
      .text(order.phone, 350, metaY + 14, { width: 195, align: "right" })
      .text(`Pickup: ${order.pickupDate}`, 350, metaY + 27, { width: 195, align: "right" })
      .text(locationLabel(order.location, order.deliveryAddress), 350, metaY + 40, { width: 195, align: "right" });

    doc.y = metaY + 70;
    doc.moveDown(0.5);

    // Horizontal rule
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.8);

    // ── Items table header ───────────────────────────────────────────────────
    const col = { item: 50, cut: 210, qty: 330, rate: 390, total: 470 };
    const tableHeaderY = doc.y;

    doc
      .rect(50, tableHeaderY - 4, 495, 18)
      .fill("#f0f0f0");

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#000000")
      .text("ITEM", col.item, tableHeaderY, { width: 155 })
      .text("CUT / SPEC", col.cut, tableHeaderY, { width: 115 })
      .text("QTY", col.qty, tableHeaderY, { width: 55, align: "right" })
      .text("RATE", col.rate, tableHeaderY, { width: 75, align: "right" })
      .text("TOTAL", col.total, tableHeaderY, { width: 75, align: "right" });

    doc.y = tableHeaderY + 20;

    // ── Items rows ───────────────────────────────────────────────────────────
    items.forEach((item, idx) => {
      const price = parseFloat(item.price) || 0;
      const weight = parseFloat(item.finalWeightKg || "") || 0;
      const finalQty = weight > 0 ? weight : item.qty;
      const unit = stripUnit(item.unit);
      const total = calcItemTotal(item);
      const rowY = doc.y;

      if (idx % 2 === 1) {
        doc.rect(50, rowY - 2, 495, 16).fill("#fafafa");
      }

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#000000")
        .text(item.name, col.item, rowY, { width: 155 })
        .text(item.cut || "—", col.cut, rowY, { width: 115 })
        .text(`${finalQty}${unit ? " " + unit : ""}`, col.qty, rowY, { width: 55, align: "right" })
        .text(`$${price.toFixed(2)}/${unit || "unit"}`, col.rate, rowY, { width: 75, align: "right" })
        .text(`$${total.toFixed(2)}`, col.total, rowY, { width: 75, align: "right" });

      doc.y = rowY + 16;
    });

    // ── Totals ───────────────────────────────────────────────────────────────
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);

    if (delivery > 0) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#333333")
        .text(`Subtotal`, 350, doc.y, { width: 120, align: "right" })
        .text(`$${subtotal.toFixed(2)}`, col.total, doc.y - 9, { width: 75, align: "right" });
      doc.moveDown(0.3);
      doc
        .text(`Delivery`, 350, doc.y, { width: 120, align: "right" })
        .text(`$${delivery.toFixed(2)}`, col.total, doc.y - 9, { width: 75, align: "right" });
      doc.moveDown(0.3);
      doc
        .moveTo(350, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.3);
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#000000")
      .text(`TOTAL DUE`, 350, doc.y, { width: 120, align: "right" })
      .text(`$${grandTotal.toFixed(2)}`, col.total, doc.y - 11, { width: 75, align: "right" });

    // ── Special instructions ─────────────────────────────────────────────────
    if (order.specialInstructions) {
      doc.moveDown(1.5);
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#666666")
        .text("SPECIAL INSTRUCTIONS");
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#333333")
        .text(order.specialInstructions);
    }

    // ── Payment details ──────────────────────────────────────────────────────
    if (bankDetails.trim()) {
      doc.moveDown(1.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.8);

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#666666")
        .text("PAYMENT DETAILS");
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#000000")
        .text(bankDetails.trim());
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#aaaaaa")
      .text(
        "Thank you for your order — GROUPBUY / Mitchells Quality Meat",
        50,
        doc.page.height - 60,
        { align: "center", width: 495 }
      );

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
      const paidOrders = allOrders.filter((o) => o.status === "paid");

      if (paidOrders.length === 0) {
        res.status(404).json({ error: "No paid orders found" });
        return;
      }

      // Read bank details from query param (passed from frontend) or use default
      const bankDetails = (req.query.bankDetails as string) ||
        "BSB: 182-888\nAccount: 001 052 935\nAccount Name: BEST QUALITY BUTCHER";

      // Set response headers for ZIP download
      const timestamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="groupbuy-paid-invoices-${timestamp}.zip"`
      );

      // Create ZIP archive and pipe to response
      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("error", (err) => {
        console.error("[invoices] archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Archive failed" });
        }
      });
      archive.pipe(res);

      // Generate each PDF and append to archive
      for (const order of paidOrders) {
        const pdfBuffer = await generateInvoicePDF(order, bankDetails);
        const filename = `invoice-order-${order.id}-${order.phone}.pdf`;
        archive.append(pdfBuffer, { name: filename });
      }

      await archive.finalize();
    } catch (err) {
      console.error("[invoices] error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate invoices" });
      }
    }
  });

  app.use(router);
}
