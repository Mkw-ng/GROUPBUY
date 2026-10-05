import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { applyOperations, CatalogApplyError, runApply } from "./catalogApply";
import { exportCatalogRows, parseCatalogFiles, validateAndPlan, type ApplyOperation, type CatalogSnapshot, PRODUCT_HEADERS } from "./catalogCsv";

const UPDATED_AT = new Date("2026-10-05T03:04:05Z");
const snapshot = (overrides: Partial<CatalogSnapshot> = {}): CatalogSnapshot => ({
  sections: [{ id: 1, name: "Protein", sortOrder: 0, updatedAt: UPDATED_AT }],
  categories: [{ id: 1, slug: "beef", name: "Beef", powerDropName: null, emoji: null, sectionId: 1, visibility: "always", sortOrder: 0, updatedAt: UPDATED_AT }],
  products: [{ id: 1, name: "Ribeye", cut: "", category: "beef", description: null, price: "10.00", powerDropPrice: null, retailPrice: null, unit: "/ kg", badge: null, available: false, visibility: "regular_only", stockLimit: null, sortOrder: 0, img: null, updatedAt: UPDATED_AT }],
  orderedProductIds: new Set<number>(),
  unreadableOrderCount: 0,
  ...overrides,
});

function fakeTx(options: { nextSectionIds?: number[]; lateProducts?: unknown[] } = {}) {
  const events: Array<{ kind: string; table: string; values?: Record<string, unknown>; where?: unknown }> = [];
  const ids = [...(options.nextSectionIds ?? [101])];
  const chain = (event: { kind: string; table: string; values?: Record<string, unknown> }) => ({
    where(where: unknown) { events.push({ ...event, where }); return Promise.resolve(); },
  });
  const tx = {
    insert(table: any) {
      return { values(values: Record<string, unknown>) {
        const event = { kind: "insert", table: getTableName(table), values };
        if (getTableName(table) === "categorySections") return { $returningId: async () => { events.push(event); return [{ id: ids.shift() }]; } };
        return Promise.resolve(events.push(event));
      } };
    },
    update(table: any) {
      return { set(values: Record<string, unknown>) { return chain({ kind: "update", table: getTableName(table), values }); } };
    },
    delete(table: any) {
      return chain({ kind: "delete", table: getTableName(table) });
    },
    select() {
      return { from() { return { where() { return { for: async () => options.lateProducts ?? [] }; } }; } };
    },
  };
  return { tx, events };
}

function productCreate(target: string): ApplyOperation {
  return { kind: "createProduct", target, name: "New", cut: "", category: "beef", description: null, price: "10.00", powerDropPrice: null, retailPrice: null, unit: "/ kg", badge: null, available: false, visibility: "regular_only", stockLimit: null, sortOrder: 0, img: null };
}

function productCsv(price: string): string {
  return exportCatalogRows(["id", "price", "updatedAt"], [["1", price, "2026-10-05T03:04:05Z"]]);
}

describe("catalog apply isolation", () => {
  it("does not import database helpers, routes, or tRPC routers", () => {
    const source = readFileSync(join(process.cwd(), "server/catalogApply.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']\.\/db["']/);
    expect(source).not.toMatch(/from\s+["']\.\/catalogRoutes["']/);
    expect(source).not.toMatch(/from\s+["']\.\/routers["']/);
  });
});

describe("applyOperations", () => {
  it("applies kinds in dependency order and preserves order within each kind", async () => {
    const { tx, events } = fakeTx({ nextSectionIds: [77] });
    const operations: ApplyOperation[] = [
      { kind: "deleteSection", target: "section:1", id: 1 },
      { kind: "updateProduct", target: "product:1", id: 1, set: { available: false } },
      { kind: "createCategory", target: "category:new", slug: "new", name: "New", powerDropName: null, emoji: null, visibility: "always", sortOrder: 0, section: { newSectionKey: "fresh" } },
      { kind: "createSection", target: "section:new:fresh", key: "fresh", name: "Fresh", sortOrder: 0 },
      { kind: "deleteProduct", target: "product:8", id: 8 },
      { kind: "updateSection", target: "section:2", id: 2, set: { name: "Specials" } },
      { kind: "updateCategory", target: "category:beef", slug: "beef", set: { name: "Prime" }, section: { newSectionKey: "fresh" } },
      productCreate("product:new:2"),
      { kind: "deleteCategory", target: "category:old", slug: "old" },
    ];
    await applyOperations(tx, operations);
    expect(events.map((event) => `${event.kind}:${event.table}`)).toEqual([
      "insert:categorySections", "update:categorySections", "insert:categories", "update:categories", "insert:products", "update:products", "delete:products", "delete:categories", "update:categories", "delete:categorySections",
    ]);
    expect(events[2].values).toMatchObject({ sectionId: 77 });
    expect(events[3].values).toMatchObject({ sectionId: 77 });
    expect(events[8].values).toEqual({ sectionId: null });
  });

  it("preserves false, zero, empty-string, and null values while omitting unchanged sectionId", async () => {
    const { tx, events } = fakeTx();
    await applyOperations(tx, [
      { kind: "updateCategory", target: "category:beef", slug: "beef", set: { name: "", sortOrder: 0, emoji: null } },
      { kind: "updateCategory", target: "category:pork", slug: "pork", set: {}, section: null },
      { kind: "updateProduct", target: "product:1", id: 1, set: { available: false, cut: "", description: null, sortOrder: 0 } },
    ]);
    expect(events[0].values).toEqual({ name: "", sortOrder: 0, emoji: null });
    expect(events[1].values).toEqual({ sectionId: null });
    expect(events[2].values).toEqual({ available: false, cut: "", description: null, sortOrder: 0 });
  });

  it("rejects unresolved section references and undefined values before writing", async () => {
    const unresolved = fakeTx();
    await expect(applyOperations(unresolved.tx, [{ kind: "createCategory", target: "category:new", slug: "new", name: "New", powerDropName: null, emoji: null, visibility: "always", sortOrder: 0, section: { newSectionKey: "missing" } }])).rejects.toThrow(/unresolved section reference/i);
    expect(unresolved.events).toEqual([]);
    const undefinedSet = fakeTx();
    await expect(applyOperations(undefinedSet.tx, [{ kind: "updateProduct", target: "product:1", id: 1, set: { name: undefined as never } }])).rejects.toThrow(/undefined/);
    expect(undefinedSet.events).toEqual([]);
  });

  it("rejects unknown operation kinds before writing", async () => {
    const fake = fakeTx();
    await expect(applyOperations(fake.tx, [{ kind: "unexpected" } as never])).rejects.toThrow("Unknown catalog apply operation");
    expect(fake.events).toEqual([]);
  });
});

describe("runApply", () => {
  const readers = (data: CatalogSnapshot) => ({
    readSnapshot: async () => data,
    readOrderedIds: async () => ({ orderedProductIds: new Set<number>(), unreadableOrderCount: 0 }),
  });

  it("stops hash mismatches and planner problems before writing", async () => {
    const { tx, events } = fakeTx();
    const empty = parseCatalogFiles([{ filename: "products.csv", text: exportCatalogRows(["id"], [["1"]]) }]);
    await expect(runApply(tx, empty, "0".repeat(64), false, readers(snapshot()))).rejects.toMatchObject({ status: 409 });
    expect(events).toEqual([]);
    const invalid = parseCatalogFiles([{ filename: "products.csv", text: "id,unknown\n1,nope" }]);
    const invalidPlan = validateAndPlan(invalid, snapshot());
    await expect(runApply(tx, invalid, invalidPlan.planHash, false, readers(snapshot()))).rejects.toMatchObject({ status: 400 });
    expect(events).toEqual([]);
  });

  it("rejects non-restore conflicts, accepts restore mode, and rejects empty plans", async () => {
    const changed = snapshot({ products: [
      { ...snapshot().products[0], updatedAt: new Date("2026-10-06T03:04:05Z") },
      { ...snapshot().products[0], id: 2, name: "Safe", available: true, sortOrder: 1 },
    ] });
    const parsed = parseCatalogFiles([{ filename: "products.csv", text: productCsv("11.00") }]);
    const normalPlan = validateAndPlan(parsed, changed, { restoreMode: false });
    const restorePlan = validateAndPlan(parsed, changed, { restoreMode: true });
    await expect(runApply(fakeTx().tx, parsed, normalPlan.planHash, false, readers(changed))).rejects.toMatchObject({ status: 400 });
    const restored = fakeTx();
    await expect(runApply(restored.tx, parsed, restorePlan.planHash, true, readers(changed))).resolves.toEqual({ creates: 0, updates: 1, deletes: 0 });
    const empty = parseCatalogFiles([{ filename: "products.csv", text: exportCatalogRows(["id"], [["1"]]) }]);
    const emptyPlan = validateAndPlan(empty, changed);
    await expect(runApply(fakeTx().tx, empty, emptyPlan.planHash, false, readers(changed))).rejects.toMatchObject({ status: 400, body: { error: "Nothing to apply" } });
  });

  it("rejects plans above 1000 operations without writing", async () => {
    const header = PRODUCT_HEADERS;
    const rows = Array.from({ length: 1001 }, (_, index) => ["", `New ${index}`, "", "beef", "", "1.00", "", "", "/ kg", "", "FALSE", "regular_only", "", String(index), "", "", ""]);
    const parsed = parseCatalogFiles([{ filename: "products.csv", text: exportCatalogRows(header, rows) }]);
    const data = snapshot({ products: [{ ...snapshot().products[0], id: 2, name: "Safe", available: true, sortOrder: 1002 }] });
    const plan = validateAndPlan(parsed, data);
    const fake = fakeTx();
    await expect(runApply(fake.tx, parsed, plan.planHash, false, readers(data))).rejects.toMatchObject({ status: 400, body: { error: "Too many changes in one upload (max 1000): split the file" } });
    expect(fake.events).toEqual([]);
  });

  it("rolls back category deletion when the final locking check finds a product and returns success counts otherwise", async () => {
    const data = snapshot({
      categories: [
        ...snapshot().categories,
        { id: 2, slug: "safe", name: "Safe", powerDropName: null, emoji: null, sectionId: 1, visibility: "always", sortOrder: 1, updatedAt: UPDATED_AT },
      ],
      products: [{ ...snapshot().products[0], id: 2, name: "Safe", category: "safe", available: true }],
    });
    const parsed = parseCatalogFiles([{ filename: "categories.csv", text: exportCatalogRows(["slug", "action"], [["beef", "delete"]]) }]);
    const plan = validateAndPlan(parsed, data);
    const race = fakeTx({ lateProducts: [{ id: 99 }] });
    await expect(runApply(race.tx, parsed, plan.planHash, false, readers(data))).rejects.toMatchObject({ status: 409, body: { error: "A product was added to a deleted category during apply: preview again" } });
    const success = fakeTx();
    await expect(runApply(success.tx, parsed, plan.planHash, false, readers(data))).resolves.toEqual({ creates: 0, updates: 0, deletes: 1 });
  });
});
