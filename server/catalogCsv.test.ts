import { describe, expect, it } from "vitest";
import {
  CATEGORY_HEADERS,
  PRODUCT_HEADERS,
  SECTION_HEADERS,
  exportCatalogCsv,
  exportCatalogRows,
  parseCatalogCsv,
  parseCatalogFiles,
  parseOrderedProductIds,
  validateAndPlan,
  type CatalogSnapshot,
} from "./catalogCsv";

const UPDATED_AT = new Date("2026-10-05T03:04:05.000Z");
const OLDER = new Date("2026-10-04T03:04:05.000Z");

function snapshot(overrides: Partial<CatalogSnapshot> = {}): CatalogSnapshot {
  return {
    sections: [
      { id: 1, name: "Protein", sortOrder: 0, updatedAt: UPDATED_AT },
      { id: 2, name: "Specials", sortOrder: 1, updatedAt: UPDATED_AT },
    ],
    categories: [
      { id: 1, slug: "beef", name: "Beef", powerDropName: null, emoji: "", sectionId: 1, visibility: "always", sortOrder: 0, updatedAt: UPDATED_AT },
      { id: 2, slug: "pork", name: "Pork", powerDropName: null, emoji: "", sectionId: 2, visibility: "always", sortOrder: 1, updatedAt: UPDATED_AT },
    ],
    products: [
      { id: 1, name: "Ribeye", cut: "MS7+", category: "beef", description: "First line\r\nSecond line", price: "12.50", powerDropPrice: null, retailPrice: null, unit: "/ kg", badge: null, available: true, visibility: "regular_only", stockLimit: null, sortOrder: 0, img: null, updatedAt: UPDATED_AT },
      { id: 2, name: "Pork Belly", cut: "", category: "pork", description: null, price: "8.00", powerDropPrice: "7.50", retailPrice: "12.00", unit: "/ kg", badge: "POPULAR", available: true, visibility: "always", stockLimit: "4.000", sortOrder: 1, img: "/image.jpg", updatedAt: UPDATED_AT },
      { id: 3, name: "Legacy Item", cut: "", category: "missing-category", description: null, price: "5.00", powerDropPrice: null, retailPrice: null, unit: "", badge: null, available: true, visibility: "regular_only", stockLimit: null, sortOrder: 2, img: null, updatedAt: UPDATED_AT },
    ],
    orderedProductIds: new Set([2]),
    unreadableOrderCount: 0,
    ...overrides,
  };
}

function csv(headers: readonly string[], rows: unknown[][], lineEnding = "\r\n"): string {
  return exportCatalogRows(headers, rows).replace(/\r\n/g, lineEnding);
}

function plan(files: Array<{ filename: string; text: string }>, data = snapshot()) {
  return validateAndPlan(parseCatalogFiles(files), data);
}

function productRow(data: CatalogSnapshot, id: number, patch: Record<string, unknown> = {}): unknown[] {
  const product = data.products.find((candidate) => candidate.id === id)!;
  const values: Record<string, unknown> = {
    id: product.id,
    name: product.name,
    cut: product.cut,
    category: product.category,
    description: product.description,
    price: product.price,
    powerDropPrice: product.powerDropPrice,
    retailPrice: product.retailPrice,
    unit: product.unit,
    badge: product.badge,
    available: product.available ? "TRUE" : "FALSE",
    visibility: product.visibility,
    stockLimit: product.stockLimit,
    sortOrder: product.sortOrder,
    img: product.img,
    updatedAt: UPDATED_AT.toISOString().replace(/\.000Z$/, "Z"),
    action: "",
    ...patch,
  };
  return PRODUCT_HEADERS.map((header) => values[header] ?? "");
}

describe("catalog CSV parser and planner", () => {
  it("round-trips a complete export with zero changes, including equivalent normalised values", () => {
    const data = snapshot({
      products: [
        { ...snapshot().products[0], id: 12, price: "12.50", available: true, description: "First line\r\nSecond line" },
      ],
    });
    const exported = exportCatalogCsv(data);
    const productText = exported["products.csv"].replace('"12.50"', '"12.5"').replace('"TRUE"', '"true"').replace(/\r\n/g, "\n");
    const result = plan([
      { filename: "sections.csv", text: exported["sections.csv"] },
      { filename: "categories.csv", text: exported["categories.csv"] },
      { filename: "products.csv", text: productText.replace('"12"', '"12.0"') },
    ], data);
    expect(result).toMatchObject({ creates: 0, updates: 0, deletes: 0, unchanged: 5, errors: [], conflicts: [] });
  });

  it("changes only prices from a partial product CSV", () => {
    const data = snapshot();
    const result = plan([{
      filename: "products.csv",
      text: csv(["id", "price", "updatedAt"], [
        ["1", "13.00", UPDATED_AT.toISOString()],
        ["2", "9.50", UPDATED_AT.toISOString()],
      ]),
    }], data);
    expect(result).toMatchObject({ creates: 0, updates: 2, deletes: 0, errors: [], conflicts: [] });
    expect(result.changes.map((change) => change.field)).toEqual(["price", "price"]);
  });

  it("creates a section and category then moves products into it", () => {
    const data = snapshot({ products: [snapshot().products[0], snapshot().products[1], { ...snapshot().products[0], id: 4, name: "Brisket", sortOrder: 3 }] });
    const result = plan([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["", "New Range", "2", "", ""]]) },
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["new-range", "New Range", "", "", "New Range", "always", "2", "", ""]]) },
      { filename: "products.csv", text: csv(["id", "category", "updatedAt"], data.products.map((product) => [product.id, "new-range", UPDATED_AT.toISOString()])) },
    ], data);
    expect(result).toMatchObject({ creates: 2, updates: 3, deletes: 0, errors: [], conflicts: [] });
  });

  it("unassigns categories when a section is deleted", () => {
    const data = snapshot();
    const result = plan([{ filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "", "", "", "delete"]]) }], data);
    expect(result).toMatchObject({ creates: 0, updates: 1, deletes: 1, errors: [] });
    expect(result.changes.some((change) => change.field === "section" && change.newValue === null)).toBe(true);
  });

  it("rejects references to deleted sections and categories", () => {
    const data = snapshot();
    const result = plan([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "", "", "", "delete"]]) },
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "", "", "", "Protein", "", "", UPDATED_AT.toISOString(), ""]]) },
      { filename: "products.csv", text: csv(["id", "category", "updatedAt"], [["1", "beef", UPDATED_AT.toISOString()]]) },
    ], data);
    expect(result.errors.some((error) => /section is being deleted/.test(error.message))).toBe(true);

    const deletedCategory = plan([
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "", "", "", "", "", "", "", "delete"]]) },
      { filename: "products.csv", text: csv(["id", "category", "updatedAt"], [["2", "beef", UPDATED_AT.toISOString()]]) },
    ], data);
    expect(deletedCategory.errors.some((error) => /non-deleted category/.test(error.message))).toBe(true);
  });

  it("allows a section name that is both deleted and created", () => {
    const data = snapshot();
    const result = plan([{ filename: "sections.csv", text: csv(SECTION_HEADERS, [
      ["", "Protein", "3", "", ""],
      ["1", "", "", "", "delete"],
    ]) }], data);
    expect(result).toMatchObject({ creates: 1, deletes: 1, updates: 1, errors: [] });
  });

  it("detects ambiguous section names but accepts an unchanged current-section cell", () => {
    const data = snapshot({ sections: [
      { id: 1, name: "Same", sortOrder: 0, updatedAt: UPDATED_AT },
      { id: 2, name: " same ", sortOrder: 1, updatedAt: UPDATED_AT },
    ], categories: [
      { ...snapshot().categories[0], sectionId: 1 },
    ] });
    const unchanged = plan([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "Beef", "", "", "Same", "always", "0", UPDATED_AT.toISOString(), ""]]) }], data);
    expect(unchanged.errors).toEqual([]);
    const ambiguous = plan([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["new-one", "New One", "", "", "Same", "always", "1", "", ""]]) }], data);
    expect(ambiguous.errors.some((error) => /ambiguous section name/.test(error.message))).toBe(true);
  });

  it("exports a missing section as blank and round-trips it unchanged", () => {
    const data = snapshot({ categories: [{ ...snapshot().categories[0], sectionId: 999 }] });
    const exported = exportCatalogCsv(data);
    const result = plan([{ filename: "categories.csv", text: exported["categories.csv"] }], data);
    expect(result).toMatchObject({ updates: 0, errors: [], conflicts: [] });
  });

  it("allows a price-only update despite blank legacy unit and orphan category", () => {
    const data = snapshot();
    const result = plan([{ filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["3", "6.00", UPDATED_AT.toISOString()]]) }], data);
    expect(result).toMatchObject({ updates: 1, errors: [], conflicts: [] });
  });

  it("treats blank retailPrice and zero retailPrice as different values", () => {
    const data = snapshot();
    const result = plan([{ filename: "products.csv", text: csv(["id", "retailPrice", "updatedAt"], [["1", "0", UPDATED_AT.toISOString()]]) }], data);
    expect(result).toMatchObject({ updates: 1, errors: [] });
  });

  it("rejects a file without its required key column", () => {
    const result = plan([{ filename: "products.csv", text: csv(["name", "price"], [["New", "12.00"]]) }]);
    expect(result.errors.some((error) => /missing key column: id/.test(error.message))).toBe(true);
  });

  it("blocks category deletion until the same upload moves every product out", () => {
    const data = snapshot({ products: [snapshot().products[0]] });
    const blocked = plan([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "", "", "", "", "", "", "", "delete"]]) }], data);
    expect(blocked.errors.some((error) => /cannot be deleted/.test(error.message))).toBe(true);
    const moved = plan([
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "", "", "", "", "", "", "", "delete"]]) },
      { filename: "products.csv", text: csv(["id", "category", "updatedAt"], [["1", "pork", UPDATED_AT.toISOString()]]) },
    ], data);
    expect(moved).toMatchObject({ deletes: 1, updates: 1, errors: [] });
  });

  it("allows deletion only for a product that has never appeared in an order", () => {
    const data = snapshot({ products: snapshot().products.map((product) => product.id === 1 ? { ...product, available: false } : product) });
    const allowed = plan([{ filename: "products.csv", text: csv(["id", "action"], [["1", "DELETE"]]) }], data);
    expect(allowed).toMatchObject({ deletes: 1, errors: [] });
    const blocked = plan([{ filename: "products.csv", text: csv(["id", "action"], [["2", "delete"]]) }], data);
    expect(blocked.errors.some((error) => /has orders/.test(error.message))).toBe(true);
    const unreadable = plan([{ filename: "products.csv", text: csv(["id", "action"], [["1", "delete"]]) }], { ...data, unreadableOrderCount: 2 });
    expect(unreadable.errors.some((error) => /order data unreadable \(2 orders\)/.test(error.message))).toBe(true);
  });

  it("guards product/category duplicate names and malformed files", () => {
    const data = snapshot();
    const duplicateProduct = plan([{ filename: "products.csv", text: csv(PRODUCT_HEADERS, [productRow(data, 1, { id: "", updatedAt: "" })]) }], data);
    expect(duplicateProduct.errors.some((error) => /product already exists/.test(error.message))).toBe(true);
    const duplicateCategory = plan([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["fresh", " Beef ", "", "", "", "always", "4", "", ""]]) }], data);
    expect(duplicateCategory.errors.some((error) => /category name already exists: beef/.test(error.message))).toBe(true);
    const malformed = plan([
      { filename: "products.csv", text: "id,id,unknown\r\n1,1,x" },
      { filename: "products-copy.csv", text: "id\r\n1" },
    ], data);
    expect(malformed.errors.some((error) => /unknown header/.test(error.message))).toBe(true);
    expect(malformed.errors.some((error) => /duplicate header/.test(error.message))).toBe(true);
    expect(malformed.errors.some((error) => /two files of the same type/.test(error.message))).toBe(true);
  });

  it("leaves omitted update columns unchanged and requires fields for a new product", () => {
    const data = snapshot();
    const unchanged = plan([{ filename: "products.csv", text: csv(["id"], [["1"]]) }], data);
    expect(unchanged).toMatchObject({ unchanged: 1, errors: [] });
    const newProduct = plan([{ filename: "products.csv", text: csv(["id", "name"], [["", "Only Name"]]) }], data);
    expect(newProduct.errors.filter((error) => /required for a new product/.test(error.message))).toHaveLength(5);
  });

  it("validates new category slugs and accepts DELETE actions", () => {
    const invalid = plan([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["all", "All", "", "", "", "always", "0", "", ""]]) }]);
    expect(invalid.errors.some((error) => /slug must match/.test(error.message))).toBe(true);
    const deleteData = snapshot({ products: snapshot().products.map((product) => product.id === 1 ? { ...product, available: false } : product) });
    const deleteAction = plan([{ filename: "products.csv", text: csv(["id", "action"], [["1", "DELETE"]]) }], deleteData);
    expect(deleteAction.errors).toEqual([]);
  });

  it("detects update conflicts only when updatedAt is present and stale", () => {
    const data = snapshot({ products: [{ ...snapshot().products[0], updatedAt: UPDATED_AT }] });
    const conflicting = plan([{ filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["1", "13.00", OLDER.toISOString()]]) }], data);
    expect(conflicting.conflicts).toHaveLength(1);
    const invalidTimestamp = plan([{ filename: "products.csv", text: csv(["id", "updatedAt"], [["1", "not-a-date"]]) }], data);
    expect(invalidTimestamp.errors.some((error) => /updatedAt must be an ISO date/.test(error.message))).toBe(true);
    const skipped = plan([{ filename: "products.csv", text: csv(["id", "price"], [["1", "13.00"]]) }], data);
    expect(skipped).toMatchObject({ updates: 1, conflicts: [] });
  });

  it("blocks a plan that would leave no available regular-mode products", () => {
    const data = snapshot({ products: [{ ...snapshot().products[0] }] });
    const result = plan([{ filename: "products.csv", text: csv(["id", "available", "updatedAt"], [["1", "FALSE", UPDATED_AT.toISOString()]]) }], data);
    expect(result.blockers).toHaveLength(1);
  });

  it("parses lone CR line endings without hanging", () => {
    const result = plan([{ filename: "products.csv", text: "id\r1\r" }]);
    expect(result).toMatchObject({ unchanged: 1, errors: [] });
  });

  it("keeps plan hashes stable and changes them when a planned value changes", () => {
    const data = snapshot();
    const a = plan([{ filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["1", "13.00", UPDATED_AT.toISOString()]]) }], data);
    const b = plan([{ filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["1", "13.00", UPDATED_AT.toISOString()]]) }], data);
    const c = plan([{ filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["1", "14.00", UPDATED_AT.toISOString()]]) }], data);
    expect(a.planHash).toBe(b.planHash);
    expect(a.planHash).not.toBe(c.planHash);
  });
});


describe("catalog CSV run 2 operations and preview fixes", () => {
  function planWithOptions(files: Array<{ filename: string; text: string }>, data = snapshot(), options?: { restoreMode?: boolean }) {
    return validateAndPlan(parseCatalogFiles(files), data, options);
  }

  function productCreateRow(patch: Record<string, unknown> = {}): unknown[] {
    const values: Record<string, unknown> = {
      id: "", name: "New Cut", cut: "", category: "beef", description: "", price: "9.00", powerDropPrice: "",
      retailPrice: "", unit: "/ kg", badge: "", available: "FALSE", visibility: "regular_only", stockLimit: "", sortOrder: "0", img: "", updatedAt: "", action: "",
      ...patch,
    };
    return PRODUCT_HEADERS.map((header) => values[header] ?? "");
  }

  it("round-trips an unedited export with no operations, changes, warnings, or errors", () => {
    const data = snapshot({ products: [snapshot().products[0], snapshot().products[1]] });
    const exported = exportCatalogCsv(data);
    const result = planWithOptions([
      { filename: "sections.csv", text: exported["sections.csv"] },
      { filename: "categories.csv", text: exported["categories.csv"] },
      { filename: "products.csv", text: exported["products.csv"] },
    ], data);
    expect(result.operations).toEqual([]);
    expect(result.changes).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("shows accepted deletes as red-display-ready change rows with matching operations", () => {
    const data = snapshot({ products: snapshot().products.map((product) => product.id === 1 ? { ...product, available: false } : product) });
    const result = planWithOptions([{ filename: "products.csv", text: csv(["id", "action"], [["1", "delete"]]) }], data);
    expect(result.operations).toContainEqual({ kind: "deleteProduct", target: "product:1", id: 1 });
    expect(result.changes).toContainEqual(expect.objectContaining({ action: "delete", item: "product:1", field: "name", oldValue: "Ribeye", newValue: "DELETE" }));
  });

  it("maps every operation and change row in both directions by target and action", () => {
    const result = planWithOptions([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "", "", "", "delete"]]) },
      { filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["1", "13.00", UPDATED_AT.toISOString()]]) },
    ]);
    result.operations.forEach((operation) => {
      const action = operation.kind.startsWith("create") ? "create" : operation.kind.startsWith("update") ? "update" : "delete";
      expect(result.changes.some((change) => change.item === operation.target && change.action === action)).toBe(true);
    });
    result.changes.forEach((change) => {
      expect(result.operations.some((operation) => operation.target === change.item && operation.kind.startsWith(change.action))).toBe(true);
    });
  });

  it("merges a category edit and section-delete unassignment into one update operation", () => {
    const result = planWithOptions([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "", "", "", "delete"]]) },
      { filename: "categories.csv", text: csv(["slug", "name", "updatedAt"], [["beef", "Beef Prime", UPDATED_AT.toISOString()]]) },
    ]);
    const updates = result.operations.filter((operation) => operation.target === "category:beef");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ kind: "updateCategory", set: { name: "Beef Prime" }, section: null });
  });

  it("creates a category with no section column as No section", () => {
    const result = planWithOptions([{ filename: "categories.csv", text: csv(["slug", "name", "visibility"], [["fresh", "Fresh", "always"]]) }]);
    expect(result.errors).toEqual([]);
    expect(result.operations).toContainEqual(expect.objectContaining({ kind: "createCategory", slug: "fresh", section: null }));
  });

  it("keeps false, blank cut, and other explicit create values in operation and changes", () => {
    const result = planWithOptions([{ filename: "products.csv", text: csv(PRODUCT_HEADERS, [productCreateRow()]) }]);
    const operation = result.operations.find((candidate) => candidate.kind === "createProduct");
    expect(operation).toMatchObject({ kind: "createProduct", available: false, cut: "" });
    expect(result.changes).toContainEqual(expect.objectContaining({ action: "create", field: "available", newValue: false }));
    expect(result.changes).toContainEqual(expect.objectContaining({ action: "create", field: "cut", newValue: "" }));
    const serialised = JSON.stringify(operation);
    expect(serialised).not.toContain("createdAt");
    expect(serialised).not.toContain("updatedAt");
    expect(serialised).not.toContain("undefined");
  });

  it("allows section swaps, reusing deleted names, and untouched legacy duplicates", () => {
    const swapped = planWithOptions([{ filename: "sections.csv", text: csv(SECTION_HEADERS, [
      ["1", "Specials", "0", UPDATED_AT.toISOString(), ""],
      ["2", "Protein", "1", UPDATED_AT.toISOString(), ""],
    ]) }]);
    expect(swapped.errors).toEqual([]);

    const reused = planWithOptions([{ filename: "sections.csv", text: csv(SECTION_HEADERS, [
      ["1", "", "", "", "delete"],
      ["", "Protein", "4", "", ""],
    ]) }]);
    expect(reused.errors).toEqual([]);

    const legacy = planWithOptions([{ filename: "products.csv", text: csv(["id"], [["1"]]) }], snapshot({
      sections: [{ id: 1, name: "Same", sortOrder: 0, updatedAt: UPDATED_AT }, { id: 2, name: " same ", sortOrder: 1, updatedAt: UPDATED_AT }],
    }));
    expect(legacy.errors).toEqual([]);
  });

  it("keeps categories in renamed and swapped section ids", () => {
    const renamed = planWithOptions([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "Protein Prime", "0", UPDATED_AT.toISOString(), ""]]) },
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "Beef", "", "", "Protein", "always", "0", UPDATED_AT.toISOString(), ""]]) },
    ]);
    expect(renamed.errors).toEqual([]);
    expect(renamed.warnings).toContain("category beef stays in renamed section Protein Prime");
    const categoryUpdate = renamed.operations.find((operation) => operation.target === "category:beef");
    expect(categoryUpdate).toBeUndefined();

    const swapped = planWithOptions([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "Specials", "0", UPDATED_AT.toISOString(), ""], ["2", "Protein", "1", UPDATED_AT.toISOString(), ""]]) },
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [
        ["beef", "Beef", "", "", "Protein", "always", "0", UPDATED_AT.toISOString(), ""],
        ["pork", "Pork", "", "", "Specials", "always", "1", UPDATED_AT.toISOString(), ""],
      ]) },
    ]);
    expect(swapped.errors).toEqual([]);
    expect(swapped.operations.filter((operation) => operation.kind === "updateCategory")).toHaveLength(0);
  });

  it("still blocks a category reference to a section deleted with no live name winner", () => {
    const result = planWithOptions([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "", "", "", "delete"]]) },
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "Beef", "", "", "Protein", "always", "0", UPDATED_AT.toISOString(), ""]]) },
    ]);
    expect(result.errors.some((error) => error.message === "section is being deleted")).toBe(true);
  });

  it("allows category name swaps and ignores untouched category duplicates", () => {
    const swapped = planWithOptions([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [
      ["beef", "Pork", "", "", "Protein", "always", "0", UPDATED_AT.toISOString(), ""],
      ["pork", "Beef", "", "", "Specials", "always", "1", UPDATED_AT.toISOString(), ""],
    ]) }]);
    expect(swapped.errors).toEqual([]);
    const legacy = planWithOptions([{ filename: "products.csv", text: csv(["id"], [["1"]]) }], snapshot({
      categories: [
        { ...snapshot().categories[0], name: "Same" },
        { ...snapshot().categories[1], name: " same " },
      ],
    }));
    expect(legacy.errors).toEqual([]);
  });

  it("treats numeric-equivalent product ids as duplicate keys", () => {
    const result = planWithOptions([{ filename: "products.csv", text: csv(["id"], [["10"], ["10.0"]]) }]);
    expect(result.errors.filter((error) => /duplicate id: 10/.test(error.message))).toHaveLength(2);
  });

  it("accepts updatedAt .000Z UTC timestamps and rejects malformed CSV quoting", () => {
    const good = planWithOptions([{ filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["1", "13.00", "2026-10-05T03:04:05.000Z"]]) }]);
    expect(good.errors).toEqual([]);
    const strayQuote = parseCatalogCsv("products.csv", "id,name\r\n1,ri\"beye");
    const trailingText = parseCatalogCsv("products.csv", "id,name\r\n1,\"Ribeye\"junk");
    const unterminated = parseCatalogCsv("products.csv", "id,name\r\n1,\"Ribeye");
    expect(strayQuote.errors.some((error) => /quote inside unquoted cell/.test(error.message))).toBe(true);
    expect(trailingText.errors.some((error) => /text after closing quote/.test(error.message))).toBe(true);
    expect(unterminated.errors.some((error) => /unterminated quote/.test(error.message))).toBe(true);
  });

  it("removes rejected category deletes from operations, changes, counts, and hash", () => {
    const rejected = planWithOptions([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "", "", "", "", "", "", "", "delete"]]) }]);
    const baseline = planWithOptions([{ filename: "products.csv", text: csv(["id"], [["1"]]) }]);
    expect(rejected.errors.some((error) => /category cannot be deleted/.test(error.message))).toBe(true);
    expect(rejected.operations.some((operation) => operation.target === "category:beef")).toBe(false);
    expect(rejected.changes.some((change) => change.item === "category:beef")).toBe(false);
    expect(rejected.deletes).toBe(0);
    expect(rejected.planHash).toBe(baseline.planHash);
  });

  it("counts category visibility warning products after moves", () => {
    const result = planWithOptions([
      { filename: "categories.csv", text: csv(["slug", "visibility", "updatedAt"], [["beef", "regular_only", UPDATED_AT.toISOString()]]) },
      { filename: "products.csv", text: csv(["id", "category", "updatedAt"], [["2", "beef", UPDATED_AT.toISOString()]]) },
    ]);
    expect(result.warnings).toContain("category visibility change: beef affects all 2 products in this category");
  });

  it("references existing sections by id and new sections by key", () => {
    const existing = planWithOptions([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["fresh", "Fresh", "", "", "Protein", "always", "2", "", ""]]) }]);
    expect(existing.operations.find((operation) => operation.kind === "createCategory")).toMatchObject({ section: { existingId: 1 } });
    const added = planWithOptions([
      { filename: "sections.csv", text: csv(SECTION_HEADERS, [["", "New Area", "2", "", ""]]) },
      { filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["fresh", "Fresh", "", "", "New Area", "always", "2", "", ""]]) },
    ]);
    expect(added.operations.find((operation) => operation.kind === "createCategory")).toMatchObject({ section: { newSectionKey: "new area" } });
  });

  it("keeps plan hashes stable, changes them for values and restore mode, and honours restore mode", () => {
    const data = snapshot({ products: [{ ...snapshot().products[0], updatedAt: UPDATED_AT }] });
    const files = [{ filename: "products.csv", text: csv(["id", "price", "updatedAt"], [["1", "13.00", OLDER.toISOString()]]) }];
    const normal = planWithOptions(files, data);
    const restored = planWithOptions(files, data, { restoreMode: true });
    const restoredAgain = planWithOptions(files, data, { restoreMode: true });
    expect(normal.conflicts).toHaveLength(1);
    expect(restored.conflicts).toEqual([]);
    expect(restored.operations).toContainEqual(expect.objectContaining({ kind: "updateProduct", id: 1, set: { price: "13.00" } }));
    expect(restored.warnings).toContain("products.csv: row 2: changed in admin since export (restore mode: overwriting)");
    expect(normal.planHash).not.toBe(restored.planHash);
    expect(restored.planHash).toBe(restoredAgain.planHash);
  });

  it("parses ordered product ids under every strict order-item rule", () => {
    const parsed = parseOrderedProductIds([
      JSON.stringify([{ id: 42 }, { id: "42" }, { id: 42 }]),
      "not json",
      JSON.stringify({ id: 2 }),
      JSON.stringify([null]),
      JSON.stringify([{ id: "4.2" }]),
      JSON.stringify([{ id: 1.5 }]),
      JSON.stringify([{ id: Number.MAX_SAFE_INTEGER + 1 }]),
    ]);
    expect(parsed.orderedProductIds).toEqual(new Set([42]));
    expect(parsed.unreadableOrderCount).toBe(6);
  });
});


describe("catalog CSV run 3 apply safeguards", () => {
  it("rejects typed and automatic sortOrder values beyond the database INT maximum", () => {
    const maximum = "2147483647";
    const tooLarge = "2147483648";
    const section = plan([{ filename: "sections.csv", text: csv(SECTION_HEADERS, [["1", "Protein", tooLarge, UPDATED_AT.toISOString(), ""]]) }]);
    const category = plan([{ filename: "categories.csv", text: csv(CATEGORY_HEADERS, [["beef", "Beef", "", "", "Protein", "always", tooLarge, UPDATED_AT.toISOString(), ""]]) }]);
    const product = plan([{ filename: "products.csv", text: csv(["id", "sortOrder", "updatedAt"], [["1", tooLarge, UPDATED_AT.toISOString()]]) }]);
    const automatic = plan([{ filename: "sections.csv", text: csv(["id", "name"], [["", "Overflow"]]) }], snapshot({
      sections: [{ id: 1, name: "Protein", sortOrder: Number(maximum), updatedAt: UPDATED_AT }],
    }));
    [section, category, product, automatic].forEach((result) => expect(result.errors.some((error) => /sortOrder.*2147483647/.test(error.message))).toBe(true));
  });

  it("rejects oversized UTF-8 product description and image values on create and update", () => {
    const oversized = "é".repeat(32_768);
    const createValues: Record<string, unknown> = { id: "", name: "New Cut", cut: "", category: "beef", description: oversized, price: "9.00", powerDropPrice: "", retailPrice: "", unit: "/ kg", badge: "", available: "FALSE", visibility: "regular_only", stockLimit: "", sortOrder: "0", img: "", updatedAt: "", action: "" };
    const create = plan([{ filename: "products.csv", text: csv(PRODUCT_HEADERS, [PRODUCT_HEADERS.map((header) => createValues[header] ?? "")]) }]);
    const update = plan([{ filename: "products.csv", text: csv(["id", "img", "updatedAt"], [["1", oversized, UPDATED_AT.toISOString()]]) }]);
    expect(create.errors.some((error) => /description must be at most 65535 bytes/.test(error.message))).toBe(true);
    expect(update.errors.some((error) => /img must be at most 65535 bytes/.test(error.message))).toBe(true);
  });

  it("requires a never-ordered product to already be unavailable before deletion", () => {
    const available = plan([{ filename: "products.csv", text: csv(["id", "action"], [["1", "delete"]]) }]);
    const unavailable = plan([{ filename: "products.csv", text: csv(["id", "action"], [["1", "delete"]]) }], snapshot({
      products: snapshot().products.map((product) => product.id === 1 ? { ...product, available: false } : product),
    }));
    expect(available.errors.some((error) => error.message === "Set available to FALSE in an earlier upload (or in admin) before deleting.")).toBe(true);
    expect(unavailable.errors).toEqual([]);
  });
});
