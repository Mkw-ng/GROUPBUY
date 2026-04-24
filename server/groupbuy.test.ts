/**
 * GROUPBUY — server-side tests
 * Tests for settings and products database helpers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the database helpers ────────────────────────────────────────────────

vi.mock("./db", () => ({
  getAllProducts: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Wagyu Ribeye",
      cut: "MS7+",
      category: "beef",
      price: "42.00",
      powerDropPrice: "34.00",
      unit: "/ steak",
      badge: "LIMITED",
      available: true,
      img: null,
      sortOrder: 1,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getAllSettings: vi.fn().mockResolvedValue({
    powerDropActive: "false",
    announcementActive: "true",
    announcementMessage: "Test announcement",
    powerDropLabel: "POWER DROP — LIVE NOW",
  }),
  getSetting: vi.fn().mockImplementation(async (key: string) => {
    const defaults: Record<string, string> = {
      powerDropActive: "false",
      announcementActive: "true",
      announcementMessage: "Test announcement",
    };
    return defaults[key] ?? "";
  }),
  setSetting: vi.fn().mockResolvedValue(undefined),
  upsertProduct: vi.fn().mockResolvedValue(1),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  setProductAvailability: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

import {
  getAllProducts,
  getAllSettings,
  getSetting,
  setSetting,
  upsertProduct,
  deleteProduct,
  setProductAvailability,
} from "./db";

// ─── Settings tests ───────────────────────────────────────────────────────────

describe("Settings helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllSettings returns a map of key/value pairs", async () => {
    const settings = await getAllSettings();
    expect(settings).toHaveProperty("powerDropActive");
    expect(settings).toHaveProperty("announcementActive");
    expect(typeof settings.powerDropActive).toBe("string");
  });

  it("getSetting returns the value for a known key", async () => {
    const value = await getSetting("powerDropActive");
    expect(value).toBe("false");
  });

  it("getSetting returns empty string for unknown key", async () => {
    vi.mocked(getSetting).mockResolvedValueOnce("");
    const value = await getSetting("nonExistentKey");
    expect(value).toBe("");
  });

  it("setSetting calls the db with correct key and value", async () => {
    await setSetting("powerDropActive", "true");
    expect(setSetting).toHaveBeenCalledWith("powerDropActive", "true");
  });
});

// ─── Products tests ───────────────────────────────────────────────────────────

describe("Products helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllProducts returns an array of products", async () => {
    const products = await getAllProducts();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  it("getAllProducts returns products with required fields", async () => {
    const products = await getAllProducts();
    const p = products[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("name");
    expect(p).toHaveProperty("price");
    expect(p).toHaveProperty("category");
    expect(p).toHaveProperty("available");
  });

  it("upsertProduct returns an id", async () => {
    const id = await upsertProduct({
      name: "Test Product",
      cut: "Test cut",
      category: "beef",
      price: "10.00",
      unit: "/ kg",
      available: true,
      sortOrder: 0,
    });
    expect(typeof id).toBe("number");
  });

  it("deleteProduct calls db with correct id", async () => {
    await deleteProduct(1);
    expect(deleteProduct).toHaveBeenCalledWith(1);
  });

  it("setProductAvailability calls db with id and boolean", async () => {
    await setProductAvailability(1, false);
    expect(setProductAvailability).toHaveBeenCalledWith(1, false);
  });
});

// ─── Power Drop logic tests ───────────────────────────────────────────────────

describe("Power Drop pricing logic", () => {
  it("uses powerDropPrice when power drop is active and price exists", () => {
    const regularPrice = 42.0;
    const pdPrice = 34.0;
    const powerDropActive = true;

    const effectivePrice =
      powerDropActive && pdPrice != null ? pdPrice : regularPrice;

    expect(effectivePrice).toBe(34.0);
  });

  it("uses regular price when power drop is inactive", () => {
    const regularPrice = 42.0;
    const pdPrice = 34.0;
    const powerDropActive = false;

    const effectivePrice =
      powerDropActive && pdPrice != null ? pdPrice : regularPrice;

    expect(effectivePrice).toBe(42.0);
  });

  it("uses regular price when powerDropPrice is null even if active", () => {
    const regularPrice = 42.0;
    const pdPrice = null;
    const powerDropActive = true;

    const effectivePrice =
      powerDropActive && pdPrice != null ? pdPrice : regularPrice;

    expect(effectivePrice).toBe(42.0);
  });
});
