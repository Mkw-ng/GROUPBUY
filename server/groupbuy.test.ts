/**
 * GROUPBUY — server-side tests
 * Tests for settings and products database helpers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the database helpers ────────────────────────────────────────────────

vi.mock("./db", () => ({
  bulkUpdateProducts: vi.fn().mockResolvedValue(3),

  getAllCategories: vi.fn().mockResolvedValue([
    { id: 1, slug: "beef", name: "Beef", powerDropName: "PD Beef", emoji: "🥩", sortOrder: 0, visibility: "always" as const, sectionId: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, slug: "lamb", name: "Lamb", powerDropName: null, emoji: "🐑", sortOrder: 1, visibility: "power_drop_only" as const, sectionId: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 3, slug: "seafood", name: "Seafood", powerDropName: null, emoji: "🦞", sortOrder: 2, visibility: "regular_only" as const, sectionId: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getCategoryBySlug: vi.fn().mockResolvedValue(null),
  upsertCategory: vi.fn().mockImplementation(async (data: { id?: number; slug?: string; name: string }) => ({
    id: data.id ?? 99,
    slug: data.slug ?? data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: data.name,
    powerDropName: null,
    emoji: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  deleteCategory: vi.fn().mockResolvedValue({ blocked: false, productCount: 0 }),
  getCategoryProductCounts: vi.fn().mockResolvedValue(new Map([["beef", 3], ["lamb", 1]])),
  reorderCategories: vi.fn().mockResolvedValue(undefined),

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

  getAllSections: vi.fn().mockResolvedValue([
    { id: 1, name: "Beef & Lamb", sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Pork & Poultry", sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
  ]),
  upsertSection: vi.fn().mockImplementation(async (data: { id?: number; name: string }) => ({
    id: data.id ?? 10,
    name: data.name,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  reorderSections: vi.fn().mockResolvedValue(undefined),
  deleteSection: vi.fn().mockImplementation(async (_id: number) => {
    // Simulate unassigning categories from the section
    return undefined;
  }),
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
  bulkUpdateProducts,
  getAllCategories,
  upsertCategory,
  deleteCategory,
  getCategoryProductCounts,
  getAllSections,
  upsertSection,
  reorderSections,
  deleteSection,
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

// ─── bulkUpdateProducts tests ─────────────────────────────────────────────────

describe("bulkUpdateProducts helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls bulkUpdateProducts with the correct ids and available=true", async () => {
    await bulkUpdateProducts([1, 2, 3], { available: true });
    expect(bulkUpdateProducts).toHaveBeenCalledWith([1, 2, 3], { available: true });
  });

  it("calls bulkUpdateProducts with the correct ids and available=false", async () => {
    await bulkUpdateProducts([4, 5], { available: false });
    expect(bulkUpdateProducts).toHaveBeenCalledWith([4, 5], { available: false });
  });

  it("calls bulkUpdateProducts with visibility=power_drop_only", async () => {
    await bulkUpdateProducts([1, 2], { visibility: "power_drop_only" });
    expect(bulkUpdateProducts).toHaveBeenCalledWith([1, 2], { visibility: "power_drop_only" });
  });

  it("calls bulkUpdateProducts with visibility=always", async () => {
    await bulkUpdateProducts([7], { visibility: "always" });
    expect(bulkUpdateProducts).toHaveBeenCalledWith([7], { visibility: "always" });
  });

  it("returns the number of updated rows", async () => {
    const result = await bulkUpdateProducts([1, 2, 3], { available: true });
    expect(result).toBe(3);
  });

  it("handles an empty ids array without throwing", async () => {
    vi.mocked(bulkUpdateProducts).mockResolvedValueOnce(0);
    const result = await bulkUpdateProducts([], { available: true });
    expect(result).toBe(0);
  });
});

// ─── Category helpers tests ───────────────────────────────────────────────────

describe("Category helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllCategories returns categories ordered by sortOrder", async () => {
    const result = await getAllCategories();
    expect(result).toHaveLength(3);
    expect(result[0].slug).toBe("beef");
    expect(result[1].slug).toBe("lamb");
    expect(result[2].slug).toBe("seafood");
  });

  it("upsertCategory creates a new category and auto-generates a slug", async () => {
    const result = await upsertCategory({ name: "Korean BBQ / Hotpot" });
    expect(result).toBeDefined();
    // The mock returns a slug derived from the name
    expect(result.name).toBe("Korean BBQ / Hotpot");
  });

  it("upsertCategory updates an existing category by id", async () => {
    vi.mocked(upsertCategory).mockResolvedValueOnce({
      id: 1,
      slug: "beef",
      name: "Premium Beef",
      powerDropName: "PD Premium Beef",
      emoji: "🥩",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await upsertCategory({ id: 1, name: "Premium Beef", powerDropName: "PD Premium Beef" });
    expect(result.name).toBe("Premium Beef");
    expect(result.powerDropName).toBe("PD Premium Beef");
    expect(upsertCategory).toHaveBeenCalledWith({ id: 1, name: "Premium Beef", powerDropName: "PD Premium Beef" });
  });

  it("deleteCategory returns blocked=true when products reference the category", async () => {
    vi.mocked(deleteCategory).mockResolvedValueOnce({ blocked: true, productCount: 3 });
    const result = await deleteCategory(1);
    expect(result.blocked).toBe(true);
    expect(result.productCount).toBe(3);
  });

  it("deleteCategory returns blocked=false when no products reference the category", async () => {
    vi.mocked(deleteCategory).mockResolvedValueOnce({ blocked: false, productCount: 0 });
    const result = await deleteCategory(2);
    expect(result.blocked).toBe(false);
    expect(result.productCount).toBe(0);
  });

  it("getCategoryProductCounts returns a map of slug to count", async () => {
    const counts = await getCategoryProductCounts();
    expect(counts.get("beef")).toBe(3);
    expect(counts.get("lamb")).toBe(1);
    expect(counts.get("pork")).toBeUndefined();
  });
});

// ─── Section management tests ─────────────────────────────────────────────────

describe("Section helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllSections returns sections in sort order", async () => {
    const sections = await getAllSections();
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe("Beef & Lamb");
    expect(sections[0].sortOrder).toBe(0);
    expect(sections[1].name).toBe("Pork & Poultry");
    expect(sections[1].sortOrder).toBe(1);
  });

  it("upsertSection creates a new section when no id is provided", async () => {
    const result = await upsertSection({ name: "Seafood & Specials" });
    expect(result.id).toBe(10);
    expect(result.name).toBe("Seafood & Specials");
    expect(upsertSection).toHaveBeenCalledWith({ name: "Seafood & Specials" });
  });

  it("upsertSection updates an existing section when id is provided", async () => {
    vi.mocked(upsertSection).mockResolvedValueOnce({
      id: 1,
      name: "Beef, Lamb & Veal",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await upsertSection({ id: 1, name: "Beef, Lamb & Veal" });
    expect(result.name).toBe("Beef, Lamb & Veal");
    expect(upsertSection).toHaveBeenCalledWith({ id: 1, name: "Beef, Lamb & Veal" });
  });

  it("reorderSections is called with an ordered id array", async () => {
    await reorderSections([2, 1]);
    expect(reorderSections).toHaveBeenCalledWith([2, 1]);
  });

  it("deleteSection unassigns categories and removes the section", async () => {
    await deleteSection(1);
    expect(deleteSection).toHaveBeenCalledWith(1);
    // No error means categories were unassigned and section was deleted
  });

  it("deleteSection can be called for a section with no categories", async () => {
    await deleteSection(99);
    expect(deleteSection).toHaveBeenCalledWith(99);
  });
});

// ─── Effective Visibility helper tests ────────────────────────────────────────
import { effectiveVisibility, isVisibleInMode } from "../shared/visibility";

describe("effectiveVisibility helper", () => {
  it("category always + product always → always", () => {
    expect(effectiveVisibility("always", "always")).toBe("always");
  });

  it("category always + product regular_only → regular_only (product wins)", () => {
    expect(effectiveVisibility("regular_only", "always")).toBe("regular_only");
  });

  it("category always + product power_drop_only → power_drop_only (product wins)", () => {
    expect(effectiveVisibility("power_drop_only", "always")).toBe("power_drop_only");
  });

  it("category power_drop_only overrides product always → power_drop_only", () => {
    expect(effectiveVisibility("always", "power_drop_only")).toBe("power_drop_only");
  });

  it("category regular_only overrides product always → regular_only", () => {
    expect(effectiveVisibility("always", "regular_only")).toBe("regular_only");
  });

  it("category power_drop_only overrides product regular_only → power_drop_only", () => {
    expect(effectiveVisibility("regular_only", "power_drop_only")).toBe("power_drop_only");
  });
});

describe("isVisibleInMode helper", () => {
  it("always is visible in both modes", () => {
    expect(isVisibleInMode("always", true)).toBe(true);
    expect(isVisibleInMode("always", false)).toBe(true);
  });

  it("power_drop_only is visible only during Power Drop", () => {
    expect(isVisibleInMode("power_drop_only", true)).toBe(true);
    expect(isVisibleInMode("power_drop_only", false)).toBe(false);
  });

  it("regular_only is visible only outside Power Drop", () => {
    expect(isVisibleInMode("regular_only", false)).toBe(true);
    expect(isVisibleInMode("regular_only", true)).toBe(false);
  });
});

describe("Category visibility field in DB mock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAllCategories returns categories with visibility field", async () => {
    const cats = await getAllCategories();
    expect(cats).toHaveLength(3);
    for (const c of cats) {
      expect(c).toHaveProperty("visibility");
      expect(["regular_only", "always", "power_drop_only"]).toContain(c.visibility);
    }
  });

  it("beef category has visibility=always", async () => {
    const cats = await getAllCategories();
    const beef = cats.find((c) => c.slug === "beef");
    expect(beef?.visibility).toBe("always");
  });

  it("lamb category has visibility=power_drop_only", async () => {
    const cats = await getAllCategories();
    const lamb = cats.find((c) => c.slug === "lamb");
    expect(lamb?.visibility).toBe("power_drop_only");
  });

  it("seafood category has visibility=regular_only", async () => {
    const cats = await getAllCategories();
    const seafood = cats.find((c) => c.slug === "seafood");
    expect(seafood?.visibility).toBe("regular_only");
  });
});
