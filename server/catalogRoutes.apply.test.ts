import { createServer } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { categorySections, categories, orders, products } from "../drizzle/schema";
import { exportCatalogRows, parseCatalogFiles, validateAndPlan, type CatalogSnapshot } from "./catalogCsv";

vi.stubEnv("DATABASE_URL", "");
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));

import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import { registerCatalogRoutes } from "./catalogRoutes";

const getDbMock = vi.mocked(getDb);
const authMock = vi.mocked(sdk.authenticateRequest);
const UPDATED_AT = new Date("2026-10-05T03:04:05Z");

function catalog(): CatalogSnapshot {
  return {
    sections: [{ id: 1, name: "Protein", sortOrder: 0, updatedAt: UPDATED_AT }],
    categories: [
      { id: 1, slug: "beef", name: "Beef", powerDropName: null, emoji: null, sectionId: 1, visibility: "always", sortOrder: 0, updatedAt: UPDATED_AT },
      { id: 2, slug: "safe", name: "Safe", powerDropName: null, emoji: null, sectionId: 1, visibility: "always", sortOrder: 1, updatedAt: UPDATED_AT },
    ],
    products: [
      { id: 1, name: "Ribeye", cut: "", category: "beef", description: null, price: "10.00", powerDropPrice: null, retailPrice: null, unit: "/ kg", badge: null, available: false, visibility: "regular_only", stockLimit: null, sortOrder: 0, img: null, updatedAt: UPDATED_AT },
      { id: 2, name: "Safe", cut: "", category: "safe", description: null, price: "10.00", powerDropPrice: null, retailPrice: null, unit: "/ kg", badge: null, available: true, visibility: "regular_only", stockLimit: null, sortOrder: 1, img: null, updatedAt: UPDATED_AT },
    ],
    orderedProductIds: new Set(), unreadableOrderCount: 0,
  };
}

function createFakeDb(options: { commitFails?: boolean } = {}) {
  const data = catalog();
  const writes: unknown[] = [];
  const tx = {
    select(...fields: unknown[]) {
      return {
        from(table: unknown) {
          const name = getTableName(table as any);
          const rows = name === "categorySections" ? data.sections : name === "categories" ? data.categories : name === "products" ? data.products : [];
          const query = {
            orderBy() { return query; },
            where() { return { for: async () => [] }; },
            for: async () => rows,
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve),
          };
          return query;
        },
      };
    },
    insert(table: any) { return { values(values: unknown) { writes.push(["insert", getTableName(table), values]); return { $returningId: async () => [{ id: 99 }] }; } }; },
    update(table: any) { return { set(values: unknown) { return { where(where: unknown) { writes.push(["update", getTableName(table), values, where]); return Promise.resolve(); } }; } }; },
    delete(table: any) { return { where(where: unknown) { writes.push(["delete", getTableName(table), where]); return Promise.resolve(); } }; },
  };
  return {
    writes,
    transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      const result = await callback(tx);
      if (options.commitFails) throw new Error("commit failed");
      return result;
    },
  };
}

async function startApp() {
  const app = express();
  registerCatalogRoutes(app);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  return { base, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

function form(price = "11.00", restoreMode = "false", hash?: string): FormData {
  const text = exportCatalogRows(["id", "price", "updatedAt"], [["1", price, "2026-10-05T03:04:05Z"]]);
  const data = catalog();
  const parsed = parseCatalogFiles([{ filename: "products.csv", text }]);
  const planHash = hash ?? validateAndPlan(parsed, data, { restoreMode: restoreMode === "true" }).planHash;
  const body = new FormData();
  body.append("files", new Blob([text], { type: "text/csv" }), "products.csv");
  body.append("planHash", planHash);
  body.append("restoreMode", restoreMode);
  return body;
}

describe("catalog apply route", () => {
  let close: (() => Promise<void>) | undefined;

  beforeEach(() => {
    authMock.mockReset();
    getDbMock.mockReset();
    authMock.mockResolvedValue({ openId: "admin-1", role: "admin" } as any);
  });
  afterEach(async () => { await close?.(); close = undefined; });

  it("rejects a non-admin before multer or database work", async () => {
    authMock.mockResolvedValue({ openId: "person", role: "user" } as any);
    const running = await startApp(); close = running.close;
    const response = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", body: form() });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("requires explicit same-origin apply intent before parsing files", async () => {
    const running = await startApp(); close = running.close;
    const missingHeader = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", body: form() });
    const crossSite = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", headers: { "X-Catalog-Apply": "1", "Sec-Fetch-Site": "cross-site" }, body: form() });
    expect(missingHeader.status).toBe(403);
    expect(crossSite.status).toBe(403);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("validates plan hash and restore mode before opening a transaction", async () => {
    const fake = createFakeDb(); getDbMock.mockResolvedValue(fake as any);
    const running = await startApp(); close = running.close;
    const invalidHash = new FormData();
    invalidHash.append("files", new Blob(["id\n1"], { type: "text/csv" }), "products.csv"); invalidHash.append("planHash", "bad"); invalidHash.append("restoreMode", "false");
    const badHash = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", headers: { "X-Catalog-Apply": "1" }, body: invalidHash });
    const badMode = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", headers: { "X-Catalog-Apply": "1" }, body: form("11.00", "maybe") });
    expect(badHash.status).toBe(400);
    expect(badMode.status).toBe(400);
    expect(fake.writes).toEqual([]);
  });

  it("returns hash mismatch without writes", async () => {
    const fake = createFakeDb(); getDbMock.mockResolvedValue(fake as any);
    const running = await startApp(); close = running.close;
    const response = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", headers: { "X-Catalog-Apply": "1" }, body: form("11.00", "false", "0".repeat(64)) });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Catalog changed since preview: preview again" });
    expect(fake.writes).toEqual([]);
  });

  it("reports an unknown result when commit fails after callback completion", async () => {
    const fake = createFakeDb({ commitFails: true }); getDbMock.mockResolvedValue(fake as any);
    const running = await startApp(); close = running.close;
    const response = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", headers: { "X-Catalog-Apply": "1" }, body: form() });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Result unknown: run Preview again", unknown: true });
  });

  it("applies a valid plan and returns counts", async () => {
    const fake = createFakeDb(); getDbMock.mockResolvedValue(fake as any);
    const running = await startApp(); close = running.close;
    const response = await fetch(`${running.base}/api/admin/catalog/apply`, { method: "POST", headers: { "X-Catalog-Apply": "1" }, body: form() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ creates: 0, updates: 1, deletes: 0 });
    expect(fake.writes).toHaveLength(1);
  });
});
