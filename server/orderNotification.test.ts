import { describe, expect, it } from "vitest";
import { buildNewOrderNotification } from "./orderNotification";

describe("buildNewOrderNotification", () => {
  it("formats a casual Cranbourne pickup order", () => {
    const result = buildNewOrderNotification({
      invoiceNumber: "GB-1234",
      phone: "0407249272",
      pickupDate: "Friday, 9 October 2026",
      location: "cranbourne",
      deliveryAddress: null,
      isPowerDrop: false,
      items: [
        { name: "Beef Brisket", cut: "Point End", qty: 1.5, price: "19.99", unit: "/ kg" },
      ],
    });

    expect(result.title).toBe("New order GB-1234 — 0407249272");
    expect(result.content).toContain("Type: Casual order");
    expect(result.content).toContain("Pick up date: Friday, 9 October 2026");
    expect(result.content).toContain("Location: Cranbourne");
    expect(result.content).toContain("Items: 1.5 × Beef Brisket (Point End) — $19.99 / kg");
    expect(result.content).toContain("Approx total: $29.98 (before final weights and delivery)");
  });

  it("formats a delivery order with an item request and empty cut", () => {
    const result = buildNewOrderNotification({
      invoiceNumber: "GB-5678",
      phone: "0407000000",
      pickupDate: "Monday, 12 October 2026",
      location: "delivery",
      deliveryAddress: "12 Example Street, Clayton",
      isPowerDrop: false,
      items: [
        { name: "Wagyu Ribeye", cut: "", qty: 2, price: "42.00", unit: "/ steak", note: "Trim fat" },
      ],
    });

    expect(result.content).toContain("Location: Delivery — 12 Example Street, Clayton");
    expect(result.content).toContain("Items: 2 × Wagyu Ribeye — $42.00 / steak");
    expect(result.content).toContain("  ↳ Request: Trim fat");
  });

  it("labels Power Drop orders and calculates totals from string prices", () => {
    const result = buildNewOrderNotification({
      invoiceNumber: "GB-9999",
      phone: "0407111111",
      pickupDate: "Tuesday, 13 October 2026",
      location: "clayton",
      deliveryAddress: null,
      isPowerDrop: true,
      items: [
        { name: "Lamb Rack", cut: "French Trimmed", qty: 2, price: "18.50", unit: "/ rack" },
        { name: "Pork Belly", cut: "Skin On", qty: 0.5, price: "14.20", unit: "/ kg" },
      ],
    });

    expect(result.content).toContain("Type: Power Drop order");
    expect(result.content).toContain("Approx total: $44.10 (before final weights and delivery)");
  });
});
