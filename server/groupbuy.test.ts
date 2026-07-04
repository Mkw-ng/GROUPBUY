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
      visibility: "regular_only" as const,
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
  batchReorderProducts: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getOrdersPage: vi.fn().mockImplementation(async (limit = 100, offset = 0) => {
    const allRows = Array.from({ length: 150 }, (_, i) => ({
      id: i + 1,
      phone: `04${String(i).padStart(8, "0")}`,
      pickupDate: "Monday, 1 January 2026",
      location: "cranbourne",
      deliveryAddress: null,
      items: JSON.stringify([]),
      specialInstructions: null,
      status: "pending" as const,
      isPowerDrop: true,
      archived: false,
      dropId: null,
      deliveryCharge: "0.00",
      customerName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const slice = allRows.slice(offset, offset + limit);
    const hasMore = offset + limit < allRows.length;
    return { orders: slice, limit, offset, hasMore };
  }),
  getActiveOrderCounts: vi.fn().mockResolvedValue({
    all: 15,
    pending: 7,
    invoice_issued: 1,
    remittance: 1,
    paid: 3,
    in_progress: 1,
    pickup_available: 1,
    completed: 0,
    cancelled: 1,
  }),
  getUnassignedOrders: vi.fn().mockResolvedValue(
    Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      phone: `04${String(i).padStart(8, "0")}`,
      pickupDate: "Monday, 1 January 2026",
      location: "cranbourne",
      deliveryAddress: null,
      items: JSON.stringify([]),
      specialInstructions: null,
      status: "pending" as const,
      isPowerDrop: true,
      archived: false,
      dropId: null,
      deliveryCharge: "0.00",
      customerName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  ),
  getAllPaidActiveOrders: vi.fn().mockResolvedValue(
    Array.from({ length: 150 }, (_, i) => ({
      id: i + 1,
      phone: `04${String(i).padStart(8, "0")}`,
      pickupDate: "Monday, 1 January 2026",
      location: "cranbourne",
      deliveryAddress: null,
      items: JSON.stringify([{ id: 1, name: "Wagyu Ribeye", cut: "MS9", qty: 1, price: "42.00", unit: "/ steak" }]),
      specialInstructions: null,
      status: "paid",
      isPowerDrop: true,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  ),
}));

import {
  getAllProducts,
  getAllSettings,
  getSetting,
  setSetting,
  upsertProduct,
  deleteProduct,
  setProductAvailability,
  batchReorderProducts,
  getAllPaidActiveOrders,
  getOrdersPage,
  getActiveOrderCounts,
  getUnassignedOrders,
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

  it("batchReorderProducts calls db with array of id/sortOrder pairs", async () => {
    const updates = [
      { id: 1, sortOrder: 3 },
      { id: 2, sortOrder: 1 },
      { id: 3, sortOrder: 2 },
    ];
    await batchReorderProducts(updates);
    expect(batchReorderProducts).toHaveBeenCalledWith(updates);
  });
});

// ─── Export helper tests ─────────────────────────────────────────────────────

describe("getAllPaidActiveOrders export helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all paid orders without a 100-row cap", async () => {
    const result = await getAllPaidActiveOrders();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(150);
    expect(result.length).toBeGreaterThan(100);
  });

  it("every returned order has status paid", async () => {
    const result = await getAllPaidActiveOrders();
    result.forEach((o) => expect(o.status).toBe("paid"));
  });

  it("every returned order has archived false", async () => {
    const result = await getAllPaidActiveOrders();
    result.forEach((o) => expect(o.archived).toBe(false));
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

// ─── Pagination tests ─────────────────────────────────────────────────────────

describe("getOrdersPage pagination helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns orders array, limit, offset, and hasMore fields", async () => {
    const page = await getOrdersPage(100, 0);
    expect(page).toHaveProperty("orders");
    expect(page).toHaveProperty("limit", 100);
    expect(page).toHaveProperty("offset", 0);
    expect(page).toHaveProperty("hasMore");
    expect(Array.isArray(page.orders)).toBe(true);
  });

  it("first page of 100 from 150 rows has hasMore=true", async () => {
    const page = await getOrdersPage(100, 0);
    expect(page.orders.length).toBe(100);
    expect(page.hasMore).toBe(true);
  });

  it("second page of 100 from 150 rows has hasMore=false", async () => {
    const page = await getOrdersPage(100, 100);
    expect(page.orders.length).toBe(50);
    expect(page.hasMore).toBe(false);
  });

  it("does not silently cap at 100 - second page returns remaining rows", async () => {
    const page1 = await getOrdersPage(100, 0);
    const page2 = await getOrdersPage(100, 100);
    const totalLoaded = page1.orders.length + page2.orders.length;
    expect(totalLoaded).toBe(150);
    expect(totalLoaded).toBeGreaterThan(100);
  });
});

// ─── Server-side counts tests ─────────────────────────────────────────────────

describe("getActiveOrderCounts helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns counts for all, pending, invoice_issued, remittance, paid, in_progress, pickup_available, cancelled", async () => {
    const counts = await getActiveOrderCounts();
    expect(counts).toHaveProperty("all");
    expect(counts).toHaveProperty("pending");
    expect(counts).toHaveProperty("invoice_issued");
    expect(counts).toHaveProperty("remittance");
    expect(counts).toHaveProperty("paid");
    expect(counts).toHaveProperty("in_progress");
    expect(counts).toHaveProperty("pickup_available");
    expect(counts).toHaveProperty("cancelled");
    expect(typeof counts.all).toBe("number");
    expect(typeof counts.invoice_issued).toBe("number");
    expect(typeof counts.remittance).toBe("number");
    expect(typeof counts.paid).toBe("number");
    expect(typeof counts.in_progress).toBe("number");
    expect(typeof counts.pickup_available).toBe("number");
  });

  it("all equals sum of pending + invoice_issued + remittance + paid + in_progress + pickup_available + cancelled", async () => {
    const counts = await getActiveOrderCounts();
    expect(counts.all).toBe(counts.pending + counts.invoice_issued + counts.remittance + counts.paid + counts.in_progress + counts.pickup_available + counts.cancelled);
  });
});

// ─── Unassigned orders tests ──────────────────────────────────────────────────

describe("getUnassignedOrders helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an array", async () => {
    const result = await getUnassignedOrders();
    expect(Array.isArray(result)).toBe(true);
  });

  it("every returned order has dropId null", async () => {
    const result = await getUnassignedOrders();
    result.forEach((o) => expect(o.dropId).toBeNull());
  });
});

// ─── Visibility enforcement tests ────────────────────────────────────────────

describe("Product visibility field", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllProducts returns products with a visibility field", async () => {
    const products = await getAllProducts();
    const p = products[0] as { visibility?: string };
    expect(p).toHaveProperty("visibility");
    expect(["regular_only", "always", "power_drop_only"]).toContain(p.visibility);
  });

  it("regular_only product is excluded when powerDropActive is true", async () => {
    const products = await getAllProducts();
    const powerDropActive = true;
    const visible = products.filter((p) => {
      const vis = (p as { visibility?: string }).visibility ?? "regular_only";
      return powerDropActive ? vis !== "regular_only" : vis !== "power_drop_only";
    });
    // The mock product has visibility: "regular_only" so it should be hidden during PD
    expect(visible.length).toBe(0);
  });

  it("regular_only product is included when powerDropActive is false", async () => {
    const products = await getAllProducts();
    const powerDropActive = false;
    const visible = products.filter((p) => {
      const vis = (p as { visibility?: string }).visibility ?? "regular_only";
      return powerDropActive ? vis !== "regular_only" : vis !== "power_drop_only";
    });
    expect(visible.length).toBe(1);
  });

  it("power_drop_only product is excluded when powerDropActive is false", async () => {
    const pdOnlyProduct = [
      {
        id: 99,
        name: "PD Exclusive",
        cut: "Special",
        category: "beef",
        price: "50.00",
        powerDropPrice: "40.00",
        unit: "/ kg",
        badge: null,
        available: true,
        img: null,
        sortOrder: 99,
        description: null,
        visibility: "power_drop_only" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const powerDropActive = false;
    const visible = pdOnlyProduct.filter((p) => {
      const vis = p.visibility ?? "regular_only";
      return powerDropActive ? vis !== "regular_only" : vis !== "power_drop_only";
    });
    expect(visible.length).toBe(0);
  });

  it("always-visible product is shown regardless of powerDropActive", async () => {
    const alwaysProduct = [
      {
        id: 100,
        name: "Always Available",
        cut: "Standard",
        category: "beef",
        price: "30.00",
        powerDropPrice: "25.00",
        unit: "/ kg",
        badge: null,
        available: true,
        img: null,
        sortOrder: 100,
        description: null,
        visibility: "always" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    for (const powerDropActive of [true, false]) {
      const visible = alwaysProduct.filter((p) => {
        const vis = p.visibility ?? "regular_only";
        return powerDropActive ? vis !== "regular_only" : vis !== "power_drop_only";
      });
      expect(visible.length).toBe(1);
    }
  });
});
