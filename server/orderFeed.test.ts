import { describe, expect, it } from "vitest";
import { formatFeedOrder, isValidFeedKey, parsePickupDateLabel } from "./orderFeed";

const createdAt = new Date("2026-10-03T03:15:00.000Z");
const updatedAt = new Date("2026-10-03T05:45:00.000Z");

describe("parsePickupDateLabel", () => {
  it("converts valid stored checkout labels to ISO calendar dates", () => {
    expect(parsePickupDateLabel("Wednesday, 14 October 2026")).toBe("2026-10-14");
    expect(parsePickupDateLabel("Saturday, 3 January 2027")).toBe("2027-01-03");
  });

  it.each(["Monday, 31 February 2026", "", "garbage"])("rejects invalid label %j", (label) => {
    expect(parsePickupDateLabel(label)).toBeNull();
  });
});

describe("formatFeedOrder", () => {
  it("formats a pickup order with clean item units and totals", () => {
    const result = formatFeedOrder({
      id: 42,
      invoiceNumber: "GB-1234",
      createdAt,
      updatedAt,
      status: "pending",
      archived: false,
      phone: "0400000000",
      pickupDate: "Wednesday, 14 October 2026",
      location: "cranbourne",
      deliveryAddress: null,
      specialInstructions: "  Pack separately  ",
      deliveryCharge: "0.00",
      items: JSON.stringify([
        { name: "Ribeye", cut: "MS7+", qty: 2, unit: "/ kg", price: "18.50", note: "Thin cut" },
      ]),
    });

    expect(result).toMatchObject({
      id: 42,
      invoiceNumber: "GB-1234",
      updatedAt: updatedAt.toISOString(),
      pickupDate: "2026-10-14",
      locationLabel: "Cranbourne",
      specialInstructions: "Pack separately",
      approxTotal: "37.00",
    });
    expect(result.items).toEqual([
      {
        name: "Ribeye",
        cut: "MS7+",
        qty: 2,
        unit: "kg",
        price: 18.5,
        note: "Thin cut",
        finalWeightKg: null,
      },
    ]);
  });

  it("formats delivery orders using the invoice fallback and delivery label", () => {
    const result = formatFeedOrder({
      id: 7,
      invoiceNumber: null,
      createdAt,
      updatedAt,
      status: "pending",
      archived: true,
      phone: "0400000001",
      pickupDate: "Saturday, 17 October 2026",
      location: "delivery",
      deliveryAddress: "Example Address",
      specialInstructions: "",
      deliveryCharge: "10.00",
      items: JSON.stringify([
        { name: "Steak", cut: "", qty: 3, unit: "steak", price: "12" },
      ]),
    });

    expect(result).toMatchObject({
      invoiceNumber: "GB-00007",
      archived: true,
      updatedAt: updatedAt.toISOString(),
      locationLabel: "Delivery",
      deliveryCharge: "10.00",
      specialInstructions: null,
      approxTotal: "36.00",
    });
  });

  it.each(["not json", "{}", "[null]"])("keeps malformed items safe for %j", (items) => {
    const result = formatFeedOrder({ id: 8, items });
    expect(result.items).toEqual([]);
    expect(result.itemsError).toBe("unreadable items");
  });
});

describe("isValidFeedKey", () => {
  const key = "k".repeat(40);

  it("accepts only the correct key", () => {
    expect(isValidFeedKey(key, key)).toBe(true);
    expect(isValidFeedKey("x".repeat(40), key)).toBe(false);
    expect(isValidFeedKey("k".repeat(39), key)).toBe(false);
    expect(isValidFeedKey(key, undefined)).toBe(false);
  });

  it("rejects multi-byte input of the same character length without throwing", () => {
    expect(() => isValidFeedKey("é".repeat(40), key)).not.toThrow();
    expect(isValidFeedKey("é".repeat(40), key)).toBe(false);
  });
});
