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
import { getAllPaidActiveOrders } from "./db";

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
  if (location === "williamstown") return "Williamstown — $20 Delivery";
  if (location === "footscray") return "Footscray — $20 Delivery";
  if (location === "sunshine") return "Sunshine — $20 Delivery";
  if (location === "essendon") return "Essendon — $20 Delivery";
  if (location === "preston") return "Preston — $20 Delivery";
  if (location === "point-cook") return "Point Cook — $20 Delivery";
  return location;
}

// Location group order: Cranbourne first, then Clayton, then Delivery, then $20 suburbs, then others
const LOCATION_ORDER: Record<string, number> = {
  cranbourne: 0,
  clayton: 1,
  delivery: 2,
  williamstown: 3,
  footscray: 4,
  sunshine: 5,
  essendon: 6,
  preston: 7,
  "point-cook": 8,
};

function locationSortKey(location: string): number {
  return LOCATION_ORDER[location.toLowerCase()] ?? 3;
}

type PaidOrder = {
  id: number;
  phone: string;
  customerName: string | null;
  invoiceNumber: string | null;
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
    // bufferPages: true so we can add page numbers without triggering new pages
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const dateGenerated = new Date().toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // ── Column layout (5 columns, 495pt total) ────────────────────────────────
    const LEFT = 50;
    const PAGE_WIDTH = 595; // A4 points
    const CONTENT_WIDTH = PAGE_WIDTH - LEFT * 2; // 495
    const COL_LOCATION = 70;
    const COL_DATE = 95;
    const COL_PHONE = 90;
    const COL_ADDRESS = 145;
    const COL_RECEIVE = CONTENT_WIDTH - COL_LOCATION - COL_DATE - COL_PHONE - COL_ADDRESS; // 95
    const ROW_MIN_HEIGHT = 30;
    const HEADER_ROW_HEIGHT = 18;
    const BOTTOM_MARGIN = 50;
    const PAGE_HEIGHT = 841; // A4 points
    const USABLE_BOTTOM = PAGE_HEIGHT - BOTTOM_MARGIN;

    // ── Short location label (used inside table cells) ────────────────────────
    function shortLocationLabel(loc: string): string {
      if (loc === "clayton") return "Clayton";
      if (loc === "cranbourne") return "Cranbourne";
      if (loc === "delivery") return "Delivery";
      if (loc === "williamstown") return "Williamstown";
      if (loc === "footscray") return "Footscray";
      if (loc === "sunshine") return "Sunshine";
      if (loc === "essendon") return "Essendon";
      if (loc === "preston") return "Preston";
      if (loc === "point-cook") return "Point Cook";
      return loc;
    }

    // ── Chronological date sort helper ────────────────────────────────────────
    function pickupDateTimestamp(value: string): number {
      const ts = new Date(value).getTime();
      return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
    }

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

    // Within each group: sort by date chronologically, then phone asc
    for (const [, groupOrders] of sortedGroups) {
      groupOrders.sort((a, b) => {
        const dateCmp = pickupDateTimestamp(a.pickupDate) - pickupDateTimestamp(b.pickupDate);
        if (dateCmp !== 0) return dateCmp;
        return a.phone.localeCompare(b.phone);
      });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    /**
     * Draw the 5-column table header row. Returns y after the row.
     */
    function drawTableHeader(y: number): number {
      const x = LEFT;
      const h = HEADER_ROW_HEIGHT;
      // Background
      doc.rect(x, y, CONTENT_WIDTH, h).fillColor("#eeeeee").fill();
      // Outer border
      doc.rect(x, y, CONTENT_WIDTH, h).strokeColor("#000000").lineWidth(0.5).stroke();
      // Column dividers
      let cx = x;
      for (const w of [COL_LOCATION, COL_DATE, COL_PHONE, COL_ADDRESS]) {
        cx += w;
        doc.moveTo(cx, y).lineTo(cx, y + h).strokeColor("#000000").lineWidth(0.5).stroke();
      }
      // Header text
      const textY = y + 4;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
      doc.text("Location",         x + 3,                                        textY, { width: COL_LOCATION - 6, lineBreak: false });
      doc.text("Date",             x + COL_LOCATION + 3,                         textY, { width: COL_DATE - 6,     lineBreak: false });
      doc.text("Phone Number",     x + COL_LOCATION + COL_DATE + 3,              textY, { width: COL_PHONE - 6,    lineBreak: false });
      doc.text("Delivery Address", x + COL_LOCATION + COL_DATE + COL_PHONE + 3,  textY, { width: COL_ADDRESS - 6,  lineBreak: false });
      doc.text("To Receive",       x + COL_LOCATION + COL_DATE + COL_PHONE + COL_ADDRESS + 3, textY, { width: COL_RECEIVE - 6, lineBreak: false });
      return y + h;
    }

    /**
     * Calculate row height using PDFKit's heightOfString for accurate wrapping.
     */
    function calcRowHeight(address: string): number {
      if (!address) return ROW_MIN_HEIGHT;
      doc.font("Helvetica").fontSize(8);
      const addrH = doc.heightOfString(address, { width: COL_ADDRESS - 6 });
      return Math.max(ROW_MIN_HEIGHT, addrH + 12);
    }

    /**
     * Draw a single 5-column data row. Returns y after the row.
     */
    function drawDataRow(
      y: number,
      locShort: string,
      pickupDate: string,
      phone: string,
      address: string,
      rowHeight: number
    ): number {
      const x = LEFT;
      // Outer border
      doc.rect(x, y, CONTENT_WIDTH, rowHeight).strokeColor("#000000").lineWidth(0.5).stroke();
      // Column dividers
      let cx = x;
      for (const w of [COL_LOCATION, COL_DATE, COL_PHONE, COL_ADDRESS]) {
        cx += w;
        doc.moveTo(cx, y).lineTo(cx, y + rowHeight).strokeColor("#000000").lineWidth(0.5).stroke();
      }
      // Cell text
      const textY = y + 6;
      doc.font("Helvetica").fontSize(8).fillColor("#000000");
      doc.text(locShort,    x + 3,                                       textY, { width: COL_LOCATION - 6, lineBreak: false });
      doc.text(pickupDate,  x + COL_LOCATION + 3,                        textY, { width: COL_DATE - 6,     lineBreak: false });
      doc.text(phone,       x + COL_LOCATION + COL_DATE + 3,             textY, { width: COL_PHONE - 6,    lineBreak: false });
      if (address) {
        doc.text(address,   x + COL_LOCATION + COL_DATE + COL_PHONE + 3, textY, { width: COL_ADDRESS - 6 });
      }
      // To Receive cell is intentionally empty (staff writes here)
      return y + rowHeight;
    }

    /**
     * Draw the page-level header block. Returns y after the divider line.
     */
    function drawPageHeader(groupLabel: string): number {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#000000")
        .text("GROUPBUY \u2014 Schedule List", LEFT, 50, { align: "left" });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#000000")
        .text(`Location: ${groupLabel}`, LEFT, doc.y + 2);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#666666")
        .text(`Generated: ${dateGenerated}`, LEFT, doc.y + 2);
      doc
        .moveTo(LEFT, doc.y + 4)
        .lineTo(PAGE_WIDTH - LEFT, doc.y + 4)
        .strokeColor("#000000")
        .lineWidth(1)
        .stroke();
      return doc.y + 12;
    }

    // ── Render each location group on its own page(s) ─────────────────────────
    for (const [location, groupOrders] of sortedGroups) {
      const groupLabel = locationLabel(location, null); // full label for heading
      const locShort = shortLocationLabel(location);    // short label for cells
      const isDelivery = location.toLowerCase() === "delivery";

      // Each location always starts on a new page
      doc.addPage();
      let curY = drawPageHeader(groupLabel);
      curY = drawTableHeader(curY);

      for (const order of groupOrders) {
        const address = isDelivery && order.deliveryAddress ? order.deliveryAddress : "";
        const rowH = calcRowHeight(address);

        // If this row won't fit, start a new page and repeat header
        if (curY + rowH > USABLE_BOTTOM) {
          doc.addPage();
          curY = drawPageHeader(groupLabel);
          curY = drawTableHeader(curY);
        }

        curY = drawDataRow(curY, locShort, order.pickupDate, order.phone, address, rowH);
      }
    }

    // ── Page numbers (drawn inside bottom margin — no new pages created) ───────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#aaaaaa")
        .text(
          `Page ${i + 1} of ${range.count}`,
          LEFT,
          PAGE_HEIGHT - BOTTOM_MARGIN + 10,
          { align: "center", width: CONTENT_WIDTH, lineBreak: false }
        );
    }

    doc.end();
  });
}

interface FlatLineItem {
  name: string;
  cut: string;
  qty: number;
  finalWeightKg?: string;
  unit: string;
  phone: string;
  pickupDate: string;
  specialInstructions: string | null;
}

function generateItemsOrderedPDF(orders: PaidOrder[]): Promise<Buffer> {
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
      .text("GROUPBUY \u2014 Items Ordered List", { align: "left" });

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

    // ── Flatten all orders into line items ───────────────────────────────────────
    const flatItems: FlatLineItem[] = [];
    for (const order of orders) {
      const items = parseItems(order.items);
      for (const item of items) {
        flatItems.push({
          name: item.name,
          cut: item.cut || "",
          qty: item.qty,
          finalWeightKg: item.finalWeightKg,
          unit: item.unit || "",
          phone: order.phone,
          pickupDate: order.pickupDate,
          specialInstructions: order.specialInstructions ?? null,
        });
      }
    }

    // ── Group by pickupDate (sorted asc) ──────────────────────────────────────────
    const byDate = new Map<string, FlatLineItem[]>();
    for (const li of flatItems) {
      if (!byDate.has(li.pickupDate)) byDate.set(li.pickupDate, []);
      byDate.get(li.pickupDate)!.push(li);
    }
    const sortedDates = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));

    // ── Render ────────────────────────────────────────────────────────────────────
    for (const [pickupDate, dateItems] of sortedDates) {
      // Date section header
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#000000")
        .text(pickupDate);

      doc.moveDown(0.2);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#333333")
        .lineWidth(0.75)
        .stroke();
      doc.moveDown(0.6);

      // Group by name+cut key (alphabetically by name then cut)
      const byProduct = new Map<string, FlatLineItem[]>();
      for (const li of dateItems) {
        const key = `${li.name}|||${li.cut}`;
        if (!byProduct.has(key)) byProduct.set(key, []);
        byProduct.get(key)!.push(li);
      }
      const sortedProducts = Array.from(byProduct.entries()).sort(([a], [b]) => a.localeCompare(b));

      for (let pi = 0; pi < sortedProducts.length; pi++) {
        const [productKey, productItems] = sortedProducts[pi];
        const [productName, productCut] = productKey.split("|||");

        // Product sub-header: bold name + regular cut on same line
        const subHeaderText = productCut
          ? `${productName} \u2014 ${productCut}`
          : productName;
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#000000")
          .text(subHeaderText);
        doc.moveDown(0.2);

        // One line per customer — includes special instructions when present
        for (const li of productItems) {
          const weight = parseFloat(li.finalWeightKg || "") || 0;
          const isKg = (li.unit || "").toLowerCase().includes("kg");
          let qtyStr: string;
          if (weight > 0) {
            qtyStr = `${weight.toFixed(1)} kg`;
          } else if (isKg) {
            qtyStr = `${li.qty} kg`;
          } else {
            // strip leading slash from unit if present
            const unitLabel = li.unit.replace(/^\/\s*/, "") || "pc";
            qtyStr = `${li.qty} ${unitLabel}`;
          }
          const specialRequest = li.specialInstructions?.trim();
          const customerLine = specialRequest
            ? `${qtyStr} \u2014 ${li.phone} \u2014 ${specialRequest}`
            : `${qtyStr} \u2014 ${li.phone}`;
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#000000")
            .text(customerLine, { indent: 10, width: 485 });
        }

        // Thin divider between product groups (not after the last one in the date)
        if (pi < sortedProducts.length - 1) {
          doc.moveDown(0.4);
          doc
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .strokeColor("#cccccc")
            .lineWidth(0.4)
            .stroke();
          doc.moveDown(0.4);
        }
      }

      doc.moveDown(1.0);
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

import { calcLineItemTotal, calcOrderTotal } from "../shared/orderUtils";

/**
 * Escape a value for CSV: wrap in double-quotes, escape internal double-quotes by doubling them.
 */
function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function generatePackingSheetCSV(orders: PaidOrder[]): string {
  const headers = [
    "Invoice Number",
    "Phone Number",
    "Customer Name",
    "Pickup Date",
    "Location",
    "Delivery Address",
    "Item Name",
    "Cut",
    "Quantity Ordered",
    "Unit",
    "Final Weight/Qty",
    "Unit Price",
    "Line Total",
    "Order Total",
    "Special Instructions",
  ];

  const rows: string[] = [headers.map(csvEscape).join(",")];

  for (const order of orders) {
    const items = parseItems(order.items);
    const invoiceNum = order.invoiceNumber ?? `GB-${String(order.id).padStart(5, "0")}`;
    const locLabel = locationLabel(order.location, order.deliveryAddress);
    const orderTotal = calcOrderTotal(items, order.deliveryCharge);

    for (const item of items) {
      const isKg = (item.unit || "").toLowerCase().includes("kg");
      const finalWeightKg = item.finalWeightKg ? parseFloat(item.finalWeightKg) : null;
      const displayFinalQty = isKg && finalWeightKg != null && finalWeightKg > 0
        ? finalWeightKg.toFixed(2)
        : String(item.qty);
      const lineTotal = calcLineItemTotal(item);

      const row = [
        csvEscape(invoiceNum),
        csvEscape(order.phone),
        csvEscape(order.customerName),
        csvEscape(order.pickupDate),
        csvEscape(locLabel),
        csvEscape(order.deliveryAddress),
        csvEscape(item.name),
        csvEscape(item.cut),
        csvEscape(item.qty),
        csvEscape(item.unit),
        csvEscape(displayFinalQty),
        csvEscape(parseFloat(item.price).toFixed(2)),
        csvEscape(lineTotal.toFixed(2)),
        csvEscape(orderTotal.toFixed(2)),
        csvEscape(order.specialInstructions),
      ];
      rows.push(row.join(","));
    }
  }

  return rows.join("\r\n");
}

function generatePackingSlipPDF(order: PaidOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const items = parseItems(order.items);
    const invoiceNum = order.invoiceNumber ?? `GB-${String(order.id).padStart(5, "0")}`;
    const locLabel = locationLabel(order.location, order.deliveryAddress);
    const dateGenerated = new Date().toLocaleDateString("en-AU", {
      day: "2-digit", month: "short", year: "numeric",
    });

    // ── Header ────────────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#000000")
      .text("GROUPBUY — Packing Slip", { align: "left" });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(`Generated: ${dateGenerated}`, { align: "left" })
      .moveDown(0.6);

    doc
      .moveTo(50, doc.y).lineTo(545, doc.y)
      .strokeColor("#000000").lineWidth(1.5).stroke();
    doc.moveDown(0.8);

    // ── Customer details ──────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("Customer Details");
    doc.moveDown(0.3);

    const details: [string, string][] = [
      ["Invoice #", invoiceNum],
      ["Phone", order.phone],
      ["Location", locLabel],
    ];
    if (order.location.toLowerCase() === "delivery" && order.deliveryAddress) {
      details.push(["Delivery Address", order.deliveryAddress]);
    }
    if (order.pickupDate) {
      details.push(["Pickup Date", order.pickupDate]);
    }
    if (order.specialInstructions) {
      details.push(["Special Instructions", order.specialInstructions]);
    }

    for (const [label, value] of details) {
      doc
        .font("Helvetica-Bold").fontSize(9).fillColor("#333333")
        .text(`${label}: `, { continued: true })
        .font("Helvetica").text(value);
    }

    doc.moveDown(0.8);
    doc
      .moveTo(50, doc.y).lineTo(545, doc.y)
      .strokeColor("#cccccc").lineWidth(0.75).stroke();
    doc.moveDown(0.8);

    // ── Items table ───────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("Items");
    doc.moveDown(0.4);

    // Table header
    const LEFT = 50;
    const COL_CHECK = 22;
    const COL_ITEM = 200;
    const COL_QTY = 70;
    const COL_WEIGHT = 80;
    const COL_PRICE = 70;
    const COL_TOTAL = 545 - LEFT - COL_CHECK - COL_ITEM - COL_QTY - COL_WEIGHT - COL_PRICE;
    const HEADER_H = 18;
    const headerY = doc.y;

    doc.rect(LEFT, headerY, 495, HEADER_H).fillColor("#eeeeee").fill();
    doc.rect(LEFT, headerY, 495, HEADER_H).strokeColor("#000000").lineWidth(0.5).stroke();

    const hTextY = headerY + 4;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
    doc.text("✓",         LEFT + 4,                                                    hTextY, { width: COL_CHECK - 4, lineBreak: false });
    doc.text("Item",      LEFT + COL_CHECK + 3,                                        hTextY, { width: COL_ITEM - 6,  lineBreak: false });
    doc.text("Ordered",   LEFT + COL_CHECK + COL_ITEM + 3,                             hTextY, { width: COL_QTY - 6,   lineBreak: false });
    doc.text("Final Wt",  LEFT + COL_CHECK + COL_ITEM + COL_QTY + 3,                  hTextY, { width: COL_WEIGHT - 6, lineBreak: false });
    doc.text("Unit Price",LEFT + COL_CHECK + COL_ITEM + COL_QTY + COL_WEIGHT + 3,     hTextY, { width: COL_PRICE - 6,  lineBreak: false });
    doc.text("Total",     LEFT + COL_CHECK + COL_ITEM + COL_QTY + COL_WEIGHT + COL_PRICE + 3, hTextY, { width: COL_TOTAL - 6, lineBreak: false });

    let rowY = headerY + HEADER_H;
    const ROW_H = 26;

    for (const item of items) {
      const price = parseFloat(item.price) || 0;
      const weight = parseFloat(item.finalWeightKg || "") || 0;
      const isKg = (item.unit || "").toLowerCase().includes("kg");
      const finalQty = weight > 0 ? weight : item.qty;
      const lineTotal = weight > 0 ? weight * price : item.qty * price;
      const itemLabel = item.cut ? `${item.name} — ${item.cut}` : item.name;
      const orderedStr = `${item.qty}${item.unit ? ` ${item.unit}` : ""}`;
      const finalStr = weight > 0 ? `${weight.toFixed(2)} kg` : (isKg ? `${finalQty} kg` : `${finalQty}`);

      // Row border
      doc.rect(LEFT, rowY, 495, ROW_H).strokeColor("#cccccc").lineWidth(0.4).stroke();

      // Checkbox cell (large empty square for packer to tick)
      doc.rect(LEFT + 4, rowY + 5, 12, 12).strokeColor("#000000").lineWidth(0.8).stroke();

      // Column dividers
      let cx = LEFT + COL_CHECK;
      for (const w of [COL_ITEM, COL_QTY, COL_WEIGHT, COL_PRICE]) {
        doc.moveTo(cx, rowY).lineTo(cx, rowY + ROW_H).strokeColor("#cccccc").lineWidth(0.4).stroke();
        cx += w;
      }

      const textY = rowY + 7;
      doc.font("Helvetica").fontSize(8).fillColor("#000000");
      doc.text(itemLabel,              LEFT + COL_CHECK + 3,                                        textY, { width: COL_ITEM - 6,  lineBreak: false });
      doc.text(orderedStr,             LEFT + COL_CHECK + COL_ITEM + 3,                             textY, { width: COL_QTY - 6,   lineBreak: false });
      doc.text(finalStr,               LEFT + COL_CHECK + COL_ITEM + COL_QTY + 3,                  textY, { width: COL_WEIGHT - 6, lineBreak: false });
      doc.text(`$${price.toFixed(2)}`, LEFT + COL_CHECK + COL_ITEM + COL_QTY + COL_WEIGHT + 3,     textY, { width: COL_PRICE - 6,  lineBreak: false });
      doc.text(`$${lineTotal.toFixed(2)}`, LEFT + COL_CHECK + COL_ITEM + COL_QTY + COL_WEIGHT + COL_PRICE + 3, textY, { width: COL_TOTAL - 6, lineBreak: false });

      rowY += ROW_H;
    }

    // ── Order total ───────────────────────────────────────────────────────────
    const subtotal = items.reduce((s, i) => {
      const w = parseFloat(i.finalWeightKg || "") || 0;
      const p = parseFloat(i.price) || 0;
      return s + (w > 0 ? w * p : i.qty * p);
    }, 0);
    const delivery = parseFloat(order.deliveryCharge || "0") || 0;
    const grandTotal = subtotal + delivery;

    doc.moveDown(0.2);
    rowY += 6;
    if (delivery > 0) {
      doc.font("Helvetica").fontSize(9).fillColor("#333333")
        .text(`Subtotal: $${subtotal.toFixed(2)}`, LEFT, rowY, { align: "right", width: 495 });
      rowY += 14;
      doc.text(`Delivery: $${delivery.toFixed(2)}`, LEFT, rowY, { align: "right", width: 495 });
      rowY += 14;
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000")
      .text(`Total: $${grandTotal.toFixed(2)}`, LEFT, rowY, { align: "right", width: 495 });

    doc.end();
  });
}

export function registerInvoiceRoutes(app: Application) {
  const router = Router();

  router.get("/api/admin/packing-slip/:orderId", async (req, res) => {
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

      const orderId = parseInt(req.params.orderId, 10);
      if (isNaN(orderId)) {
        res.status(400).json({ error: "Invalid order ID" });
        return;
      }

      const { getOrderById } = await import("./db");
      const order = await getOrderById(orderId);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      const paidOrder: PaidOrder = {
        id: order.id,
        phone: order.phone,
        customerName: order.customerName ?? null,
        invoiceNumber: order.invoiceNumber ?? null,
        pickupDate: order.pickupDate,
        location: order.location,
        deliveryAddress: order.deliveryAddress ?? null,
        items: order.items,
        specialInstructions: order.specialInstructions ?? null,
        deliveryCharge: order.deliveryCharge ?? null,
        isPowerDrop: order.isPowerDrop ?? false,
        createdAt: order.createdAt,
        status: order.status,
      };

      const pdfBuffer = await generatePackingSlipPDF(paidOrder);
      const invoiceRef = order.invoiceNumber ?? `GB-${String(order.id).padStart(5, "0")}`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="packing-slip-${invoiceRef}.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("[packing-slip] error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate packing slip" });
      }
    }
  });

  router.get("/api/admin/packing-sheet/download", async (req, res) => {
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

      const paidOrders = (await getAllPaidActiveOrders()) as PaidOrder[];

      if (paidOrders.length === 0) {
        res.status(404).json({ error: "No paid orders found" });
        return;
      }

      const csvContent = generatePackingSheetCSV(paidOrders);
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="packing-sheet-${dateStr}.csv"`
      );
      // BOM for Excel compatibility
      res.send("\uFEFF" + csvContent);
    } catch (err) {
      console.error("[packing-sheet-csv] error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate packing sheet CSV" });
      }
    }
  });

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
      const paidOrders = (await getAllPaidActiveOrders()) as PaidOrder[];

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
      const paidOrders = (await getAllPaidActiveOrders()) as PaidOrder[];

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

  router.get("/api/admin/items/download", async (req, res) => {
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
      const paidOrders = (await getAllPaidActiveOrders()) as PaidOrder[];

      if (paidOrders.length === 0) {
        res.status(404).json({ error: "No paid orders found" });
        return;
      }

      const pdfBuffer = await generateItemsOrderedPDF(paidOrders);

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="items-ordered-${dateStr}.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("[items-ordered] error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate items ordered list" });
      }
    }
  });

  app.use(router);
}
