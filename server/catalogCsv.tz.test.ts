process.env.TZ = "Australia/Melbourne";

import { describe, expect, it } from "vitest";
import { PRODUCT_HEADERS, exportCatalogRows, parseCatalogFiles, parseUpdatedAtUtc, validateAndPlan, type CatalogSnapshot } from "./catalogCsv";

const snapshot: CatalogSnapshot = {
  sections: [],
  categories: [{ id: 1, slug: "beef", name: "Beef", powerDropName: null, emoji: null, sectionId: null, visibility: "always", sortOrder: 0, updatedAt: new Date("2026-01-01T00:00:00Z") }],
  products: [{ id: 1, name: "Ribeye", cut: "", category: "beef", description: null, price: "10.00", powerDropPrice: null, retailPrice: null, unit: "/ kg", badge: null, available: true, visibility: "regular_only", stockLimit: null, sortOrder: 0, img: null, updatedAt: new Date("2026-01-01T00:00:00Z") }],
  orderedProductIds: new Set(),
};

describe("catalog CSV UTC updatedAt parsing", () => {
  it("uses UTC, not Melbourne local time, for timestamps without a zone", () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(0);
    expect(parseUpdatedAtUtc("2026-01-01 00:00:00")).toBe(Date.UTC(2026, 0, 1, 0, 0, 0) / 1000);
    const rows = [["1", "Ribeye", "", "beef", "", "10.00", "", "", "/ kg", "", "TRUE", "regular_only", "", "0", "", "2026-01-01 00:00:00", ""]];
    const parsed = parseCatalogFiles([{ filename: "products.csv", text: exportCatalogRows(PRODUCT_HEADERS, rows) }]);
    const result = validateAndPlan(parsed, snapshot);
    expect(result.errors).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });
});
