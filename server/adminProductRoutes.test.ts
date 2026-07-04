/**
 * Unit tests for the CSV parser and row validator in adminProductRoutes.ts
 * Run with: pnpm test
 */
import { describe, it, expect } from "vitest";
import { parseCsvRows, validateProductRows } from "./adminProductRoutes";

// ─── parseCsvRows ─────────────────────────────────────────────────────────────

describe("parseCsvRows", () => {
  it("parses a simple CSV with CRLF line endings", () => {
    const csv = "id,name,cut\r\n1,Wagyu,Ribeye\r\n2,Lamb,Shoulder\r\n";
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: "1", name: "Wagyu", cut: "Ribeye" });
    expect(rows[1]).toEqual({ id: "2", name: "Lamb", cut: "Shoulder" });
  });

  it("strips a UTF-8 BOM from the start of the file", () => {
    const csv = "\uFEFFid,name\r\n1,Wagyu\r\n";
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]["id"]).toBe("1");
  });

  it("handles quoted fields containing commas", () => {
    const csv = `id,name,description\r\n1,Wagyu,"Rich, marbled beef"\r\n`;
    const rows = parseCsvRows(csv);
    expect(rows[0]["description"]).toBe("Rich, marbled beef");
  });

  it("handles doubled-quote escaping inside quoted fields", () => {
    const csv = `id,name,description\r\n1,Wagyu,"He said ""great"" cut"\r\n`;
    const rows = parseCsvRows(csv);
    expect(rows[0]["description"]).toBe(`He said "great" cut`);
  });

  it("skips completely blank rows", () => {
    const csv = "id,name\r\n1,Wagyu\r\n\r\n2,Lamb\r\n";
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(2);
  });

  it("returns empty array when only header row is present", () => {
    const csv = "id,name\r\n";
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(0);
  });
});

// ─── validateProductRows ──────────────────────────────────────────────────────

const VALID_BASE = {
  id: "1",
  name: "Wagyu Ribeye",
  cut: "MS7+",
  category: "beef",
  description: "Rich marbled beef",
  price: "89.99",
  powerDropPrice: "75.00",
  retailPrice: "120.00",
  unit: "/ kg",
  badge: "LIMITED",
  available: "TRUE",
  visibility: "always",
  stockLimit: "50.000",
  sortOrder: "3",
  img: "https://example.com/wagyu.jpg",
};

describe("validateProductRows — valid update row (with id)", () => {
  it("parses all fields correctly", () => {
    const { rows, errors } = validateProductRows([VALID_BASE]);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.id).toBe(1);
    expect(row.name).toBe("Wagyu Ribeye");
    expect(row.category).toBe("beef");
    expect(row.available).toBe(true);
    expect(row.visibility).toBe("always");
    expect(row.price).toBe("89.99");
    expect(row.powerDropPrice).toBe("75.00");
    expect(row.retailPrice).toBe("120.00");
    expect(row.badge).toBe("LIMITED");
    expect(row.sortOrder).toBe(3);
  });
});

describe("validateProductRows — valid create row (blank id)", () => {
  it("sets id to undefined when id column is blank", () => {
    const row = { ...VALID_BASE, id: "" };
    const { rows, errors } = validateProductRows([row]);
    expect(errors).toHaveLength(0);
    expect(rows[0].id).toBeUndefined();
  });
});

describe("validateProductRows — bad category enum", () => {
  it("returns a row error for an invalid category value", () => {
    const row = { ...VALID_BASE, category: "not-a-category" };
    const { rows, errors } = validateProductRows([row]);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toMatch(/category/i);
    expect(rows).toHaveLength(0);
  });
});

describe("validateProductRows — TRUE/FALSE parsing for available", () => {
  it("parses TRUE (uppercase) as boolean true", () => {
    const { rows } = validateProductRows([{ ...VALID_BASE, available: "TRUE" }]);
    expect(rows[0].available).toBe(true);
  });

  it("parses FALSE (uppercase) as boolean false", () => {
    const { rows } = validateProductRows([{ ...VALID_BASE, available: "FALSE" }]);
    expect(rows[0].available).toBe(false);
  });

  it("returns a row error for an invalid available value", () => {
    const { errors } = validateProductRows([{ ...VALID_BASE, available: "yes" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/TRUE or FALSE/i);
  });
});

describe("validateProductRows — empty optional fields become null", () => {
  it("converts empty powerDropPrice, retailPrice, stockLimit, badge, img, description to null", () => {
    const row = {
      ...VALID_BASE,
      powerDropPrice: "",
      retailPrice: "",
      stockLimit: "",
      badge: "",
      img: "",
      description: "",
    };
    const { rows, errors } = validateProductRows([row]);
    expect(errors).toHaveLength(0);
    const r = rows[0];
    expect(r.powerDropPrice).toBeNull();
    expect(r.retailPrice).toBeNull();
    expect(r.stockLimit).toBeNull();
    expect(r.badge).toBeNull();
    expect(r.img).toBeNull();
    expect(r.description).toBeNull();
  });
});

describe("validateProductRows — all-or-nothing on mixed valid/invalid rows", () => {
  it("returns no rows and all errors when at least one row is invalid", () => {
    const good = { ...VALID_BASE, id: "1" };
    const bad = { ...VALID_BASE, id: "2", category: "invalid" };
    const { rows, errors } = validateProductRows([good, bad]);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
  });
});
