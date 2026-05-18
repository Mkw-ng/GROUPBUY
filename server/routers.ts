import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getAllProducts,
  getAllSettings,
  checkAndExpirePowerDrop,
  createOrder,
  getAllOrders,
  updateOrderItems,
  updateOrderDeliveryCharge,
  updateOrderStatus,
  deleteOrder,
  deleteProduct,
  setSetting,
  setProductAvailability,
  upsertProduct,
  batchReorderProducts,
  getAllDrops,
  getActiveDrop,
  getDropById,
  createDrop,
  closeDrop,
  assignOrderToDrop,
  getOrdersByDrop,
  renameDrop,
  deleteDrop,
  archiveOrder,
  unarchiveOrder,
  getArchivedOrders,
} from "./db";
import { OrderItem } from "../drizzle/schema";
import {
  upsertCustomerFromOrder,
  getCustomerByPhone,
  getAllCustomers,
  getCustomerOrders,
  getLoyaltyTier,
} from "./customerDb";
import { ALL_BADGES, RARITY_ORDER } from "../shared/badges";

// ─── In-memory rate limiter for order creation ──────────────────────────────
// Max 5 attempts per phone number per 10 minutes
const ORDER_RATE_LIMIT = 5;
const ORDER_RATE_WINDOW_MS = 10 * 60 * 1000;
const orderAttempts = new Map<string, { count: number; windowStart: number }>();

function checkOrderRateLimit(phone: string): void {
  const now = Date.now();
  const entry = orderAttempts.get(phone);
  if (!entry || now - entry.windowStart > ORDER_RATE_WINDOW_MS) {
    orderAttempts.set(phone, { count: 1, windowStart: now });
    return;
  }
  if (entry.count >= ORDER_RATE_LIMIT) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many order attempts. Please wait 10 minutes before trying again.",
    });
  }
  entry.count += 1;
}

// ─── Order item validation schema ────────────────────────────────────────────
const orderItemValidationSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    name: z.string(),
    cut: z.string(),
    qty: z.number().positive().max(999),
    price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
    unit: z.string(),
    finalWeightKg: z.string().optional(),
  })
);

// ─── Admin guard middleware ─────────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Product input schema ─────────────────────────────────────────────────────────────────

const productInput = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  cut: z.string().default(""),
  category: z.enum([
    "limited-offer",
    "featured-deals",
    "m3atfr3ak",
    "beef",
    "pork",
    "lamb",
    "poultry",
    "seafood",
    "whole-slabs",
    "whole-animal",
    "box-deals",
    "mince",
    "offal-tallow",
    "value-added",
    "korean-bbq-hotpot",
    "freezer",
    "other",
  ]),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  powerDropPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  retailPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  unit: z.string().default("/ kg"),
  badge: z.enum(["LIMITED", "POPULAR", "NEW", "SOLD OUT"]).optional().nullable(),
  available: z.boolean().default(true),
  img: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
});

// ─── Order item schema ─────────────────────────────────────────────────────────────────

const orderItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  cut: z.string(),
  qty: z.number(),
  price: z.string(),
  unit: z.string(),
  finalWeightKg: z.string().optional(),
});

// ─── Shared order total helper ─────────────────────────────────────────────────────────────────

function calcOrderTotal(o: { items: string; deliveryCharge?: string | null }): number {
  const items: OrderItem[] = JSON.parse(o.items || "[]");
  const sub = items.reduce((s, item) => {
    const p = parseFloat(item.price) || 0;
    const kg = item.unit?.toLowerCase().includes("kg");
    const w = parseFloat(item.finalWeightKg || "") || (kg ? item.qty : 0);
    return s + (kg ? p * w : p * item.qty);
  }, 0);
  return sub + (parseFloat(o.deliveryCharge ?? "0") || 0);
}

// ─── App Router ─────────────────────────────────────────────────────────────────

// ─── Customer analytics router ──────────────────────────────────────────────
const customersRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await getAllCustomers();
    return rows.map((c) => ({ ...c, loyaltyTier: getLoyaltyTier(c.totalOrders) }));
  }),
  get: adminProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => {
      const c = await getCustomerByPhone(input.phone);
      if (!c) return null;
      return { ...c, loyaltyTier: getLoyaltyTier(c.totalOrders) };
    }),
  getOrders: adminProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => getCustomerOrders(input.phone)),
  lookup: publicProcedure
    .input(z.object({ phone: z.string().min(8) }))
    .query(async ({ input }) => {
      const c = await getCustomerByPhone(input.phone);
      if (!c) return null;
      const orderHistory = await getCustomerOrders(input.phone);

      // Parse earned badge IDs stored as JSON
      let earnedIds: string[] = [];
      try { earnedIds = JSON.parse(c.badges || "[]"); } catch { earnedIds = []; }

      // Build full badge list sorted: earned first, then by rarity
      const allBadges = ALL_BADGES
        .map((def) => ({ ...def, earned: earnedIds.includes(def.id) }))
        .sort((a, b) => {
          if (a.earned !== b.earned) return a.earned ? -1 : 1;
          return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        });

      // Build safe read-only order history (archived orders only, no admin-only fields)
      const safeOrders = orderHistory
        .filter((o) => o.archived)
        .map((o) => {
          // Compute order total from items + delivery
          let items: Array<{ name: string; cut?: string; qty: number; price: string; unit: string; finalWeightKg?: string }> = [];
          try { items = JSON.parse(o.items || "[]"); } catch { items = []; }
          const sub = items.reduce((s, item) => {
            const p = parseFloat(item.price) || 0;
            const isKg = (item.unit || "").toLowerCase().includes("kg");
            const w = parseFloat(item.finalWeightKg || "") || (isKg ? item.qty : 0);
            return s + (isKg ? p * w : p * item.qty);
          }, 0);
          const delivery = parseFloat(o.deliveryCharge ?? "0") || 0;
          const total = (sub + delivery).toFixed(2);
          return {
            id: o.id,
            createdAt: o.createdAt,
            pickupDate: o.pickupDate,
            location: o.location,
            status: o.status,
            isPowerDrop: o.isPowerDrop,
            deliveryCharge: o.deliveryCharge,
            items,
            total,
          };
        });

      return {
        ...c,
        loyaltyTier: getLoyaltyTier(c.totalOrders),
        orderHistory: safeOrders,
        badges: allBadges,
        earnedBadgeCount: earnedIds.length,
        totalBadgeCount: ALL_BADGES.length,
      };
    }),
});

export const appRouter = router({
  system: systemRouter,
  customers: customersRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Public: Products ─────────────────────────────────────────────────────────────────

  products: router({
    list: publicProcedure.query(async () => {
      return getAllProducts();
    }),
  }),

  // ─── Public: Settings ─────────────────────────────────────────────────────────────────

  settings: router({
    getAll: publicProcedure.query(async () => {
      // Auto-expire Power Drop on every settings fetch so the server stays in sync
      // even if no browser triggers the explicit expiry mutation.
      await checkAndExpirePowerDrop();
      return getAllSettings();
    }),

    // Called by the countdown timer the moment it reaches zero.
    checkExpiry: publicProcedure.mutation(async () => {
      const wasExpired = await checkAndExpirePowerDrop();
      return { wasExpired };
    }),
  }),

  // ─── Public: Orders ─────────────────────────────────────────────────────────────────

  orders: router({
    create: publicProcedure
      .input(
        z.object({
          phone: z.string().min(10),
          pickupDate: z.string().min(1),
          location: z.string().min(1),
          deliveryAddress: z.string().optional(),
          items: z.string().min(2), // JSON string
          specialInstructions: z.string().optional(),
          isPowerDrop: z.boolean().default(false),
        })
      )
      .mutation(async ({ input }) => {
        // Rate limit: max 5 attempts per phone per 10 minutes
        checkOrderRateLimit(input.phone);

        // Validate and parse items JSON
        let parsedItems: z.infer<typeof orderItemValidationSchema>;
        try {
          const raw = JSON.parse(input.items);
          const result = orderItemValidationSchema.safeParse(raw);
          if (!result.success) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid order items: " + result.error.issues.map((i) => i.message).join(", "),
            });
          }
          parsedItems = result.data;
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "BAD_REQUEST", message: "items must be valid JSON" });
        }

        const activeDrop = await getActiveDrop();
        const id = await createOrder({
          phone: input.phone,
          pickupDate: input.pickupDate,
          location: input.location,
          deliveryAddress: input.deliveryAddress ?? null,
          items: JSON.stringify(parsedItems),
          specialInstructions: input.specialInstructions ?? null,
          isPowerDrop: input.isPowerDrop,
          status: "pending",
          deliveryCharge: "0.00",
          dropId: activeDrop?.id ?? null,
        });
        return { id };
      }),
  }),

  // ─── Admin: Products, Orders & Settings ─────────────────────────────────────────────────────────

  admin: router({
    products: router({
      upsert: adminProcedure.input(productInput).mutation(async ({ input }) => {
        const id = await upsertProduct({
          ...input,
          description: input.description ?? null,
          powerDropPrice: input.powerDropPrice ?? null,
          retailPrice: input.retailPrice ?? null,
          badge: input.badge ?? null,
          img: input.img ?? null,
        });
        return { id };
      }),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await deleteProduct(input.id);
          return { success: true };
        }),

      setAvailability: adminProcedure
        .input(z.object({ id: z.number(), available: z.boolean() }))
        .mutation(async ({ input }) => {
          await setProductAvailability(input.id, input.available);
          return { success: true };
        }),

      batchReorder: adminProcedure
        .input(
          z.object({
            updates: z.array(z.object({ id: z.number(), sortOrder: z.number() })),
          })
        )
        .mutation(async ({ input }) => {
          await batchReorderProducts(input.updates);
          return { success: true };
        }),
    }),

    orders: router({
      list: adminProcedure.query(async () => {
        return getAllOrders();
      }),

      updateItems: adminProcedure
        .input(
          z.object({
            id: z.number(),
            items: z.array(orderItemSchema),
          })
        )
        .mutation(async ({ input }) => {
          await updateOrderItems(input.id, input.items);
          return { success: true };
        }),

      setDeliveryCharge: adminProcedure
        .input(z.object({ id: z.number(), deliveryCharge: z.string() }))
        .mutation(async ({ input }) => {
          await updateOrderDeliveryCharge(input.id, input.deliveryCharge);
          return { success: true };
        }),

      markPaid: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await updateOrderStatus(input.id, "paid");
          return { success: true };
        }),

      cancel: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await updateOrderStatus(input.id, "cancelled");
          return { success: true };
        }),

      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await deleteOrder(input.id);
          return { success: true };
        }),
      archive: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await archiveOrder(input.id);
          // Update customer analytics whenever an order is archived
          try { await upsertCustomerFromOrder(input.id); } catch (e) { console.error('[customerDb] upsert failed', e); }
          return { success: true };
        }),
      updateCustomerName: adminProcedure
        .input(z.object({ id: z.number(), customerName: z.string().nullable() }))
        .mutation(async ({ input }) => {
          const { getDb } = await import('./db');
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
          const { orders: ordersTable } = await import('../drizzle/schema');
          const { eq } = await import('drizzle-orm');
          await db.update(ordersTable).set({ customerName: input.customerName }).where(eq(ordersTable.id, input.id));
          return { success: true };
        }),
      unarchive: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await unarchiveOrder(input.id);
          return { success: true };
        }),
      listArchived: adminProcedure.query(async () => getArchivedOrders()),
    }),

    settings: router({
      set: adminProcedure
        .input(z.object({ key: z.string(), value: z.string() }))
        .mutation(async ({ input }) => {
          await setSetting(input.key, input.value);
          return { success: true };
        }),

      setMultiple: adminProcedure
        .input(z.array(z.object({ key: z.string(), value: z.string() })))
        .mutation(async ({ input }) => {
          await Promise.all(input.map(({ key, value }) => setSetting(key, value)));
          return { success: true };
        }),
    }),

    // ─── Admin: Drops ─────────────────────────────────────────────────────────
    drops: router({
      list: adminProcedure.query(async () => getAllDrops()),
      getActive: adminProcedure.query(async () => (await getActiveDrop()) ?? null),
      create: adminProcedure
        .input(z.object({ name: z.string().min(1) }))
        .mutation(async ({ input }) => {
          const id = await createDrop(input.name);
          return { id };
        }),
      close: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await closeDrop(input.id);
          return { success: true };
        }),
      assignOrder: adminProcedure
        .input(z.object({ orderId: z.number(), dropId: z.number() }))
        .mutation(async ({ input }) => {
          await assignOrderToDrop(input.orderId, input.dropId);
          return { success: true };
        }),
      rename: adminProcedure
        .input(z.object({ id: z.number(), name: z.string().min(1) }))
        .mutation(async ({ input }) => {
          await renameDrop(input.id, input.name);
          return { success: true };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          // Prevent deleting active drops
          const drop = await getDropById(input.id);
          if (drop?.isActive) throw new Error("Cannot delete an active drop. Close it first.");
          await deleteDrop(input.id);
          return { success: true };
        }),
    }),

    // ─── Admin: Analytics ─────────────────────────────────────────────────────
    analytics: router({
      allDropsSummary: adminProcedure.query(async () => {
        const allDropsList = await getAllDrops();
        return Promise.all(
          allDropsList.map(async (drop) => {
            const dropOrders = await getOrdersByDrop(drop.id);
            const placed = dropOrders.length;
            const paid = dropOrders.filter((o) => o.status === "paid").length;
            const conversionRate = placed > 0 ? Math.round((paid / placed) * 100) : 0;
            const revenue = dropOrders
              .filter((o) => o.status === "paid")
              .reduce((sum, o) => sum + calcOrderTotal(o), 0);
            const avgOrderValue = paid > 0 ? revenue / paid : 0;
            return { ...drop, placed, paid, conversionRate, revenue, avgOrderValue };
          })
        );
      }),

      dropStats: adminProcedure
        .input(z.object({ dropId: z.number().nullable() }))
        .query(async ({ input }) => {
          const dropOrders = await getOrdersByDrop(input.dropId);
          const drop = input.dropId ? await getDropById(input.dropId) : null;
          const placed = dropOrders.length;
          const paid = dropOrders.filter((o) => o.status === "paid").length;
          const cancelled = dropOrders.filter((o) => o.status === "cancelled").length;
          const pending = dropOrders.filter((o) => o.status === "pending").length;
          const conversionRate = placed > 0 ? Math.round((paid / placed) * 100) : 0;

          const revenue = dropOrders.filter((o) => o.status === "paid").reduce((s, o) => s + calcOrderTotal(o), 0);
          const avgOrderValue = paid > 0 ? revenue / paid : 0;
          const pickupCount = dropOrders.filter((o) => o.location !== "delivery").length;
          const deliveryCount = dropOrders.filter((o) => o.location === "delivery").length;

          const locationMap: Record<string, number> = {};
          for (const o of dropOrders) {
            const loc =
              o.location === "delivery" ? "Delivery" :
              o.location === "cranbourne" ? "Cranbourne" :
              o.location === "clayton" ? "Clayton" :
              o.location === "mitchells-road" ? "Mitchells Road" : o.location;
            locationMap[loc] = (locationMap[loc] || 0) + 1;
          }
          const locationBreakdown = Object.entries(locationMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          const productMap: Record<string, { name: string; count: number; revenue: number }> = {};
          for (const o of dropOrders) {
            const items: OrderItem[] = JSON.parse(o.items || "[]");
            for (const item of items) {
              if (!productMap[item.name]) productMap[item.name] = { name: item.name, count: 0, revenue: 0 };
              productMap[item.name].count += 1;
              const p = parseFloat(item.price) || 0;
              const kg = item.unit?.toLowerCase().includes("kg");
              const w = parseFloat(item.finalWeightKg || "") || (kg ? item.qty : 0);
              productMap[item.name].revenue += kg ? p * w : p * item.qty;
            }
          }
          const topProducts = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 10);

          // ── Category lookup (shared by both item breakdown and category breakdown) ──
          const allProducts = await getAllProducts();
          const productCategoryMap: Record<string, string> = {};
          for (const p of allProducts) productCategoryMap[p.name.toLowerCase()] = p.category;

          const CATEGORY_LABELS: Record<string, string> = {
            beef: "Beef", pork: "Pork", lamb: "Lamb", poultry: "Poultry", seafood: "Seafood",
            "whole-slabs": "Whole Slabs", "whole-animal": "Whole Animal", "box-deals": "Box Deals",
            mince: "Mince", "limited-offer": "Limited Offer", "featured-deals": "Featured Deals",
            m3atfr3ak: "M3ATFR3AK", other: "Other",
          };

          // ── Item breakdown: full table with qty, kg, revenue per product ──
          interface ItemBreakdownEntry {
            name: string;
            cut: string;
            unit: string;
            category: string; // resolved from product catalogue, or "Other"
            categoryLabel: string;
            ordersContaining: number; // how many orders include this item
            totalQty: number;         // sum of qty (for unit-priced items)
            totalKg: number;          // sum of finalWeightKg (for kg-priced items)
            revenue: number;
          }
          const itemMap: Record<string, ItemBreakdownEntry> = {};
          for (const o of dropOrders) {
            const items: OrderItem[] = JSON.parse(o.items || "[]");
            for (const item of items) {
              const key = item.name;
              if (!itemMap[key]) {
                const cat = productCategoryMap[item.name.toLowerCase()] ?? "other";
                const catLabel = CATEGORY_LABELS[cat] ?? cat;
                itemMap[key] = { name: item.name, cut: item.cut || "", unit: item.unit || "", category: cat, categoryLabel: catLabel, ordersContaining: 0, totalQty: 0, totalKg: 0, revenue: 0 };
              }
              itemMap[key].ordersContaining += 1;
              const p = parseFloat(item.price) || 0;
              const isKg = (item.unit || "").toLowerCase().includes("kg");
              // finalWeightKg is set after admin confirms weight; fall back to qty for kg items
              const w = parseFloat(item.finalWeightKg || "") || (isKg ? item.qty : 0);
              if (isKg) {
                itemMap[key].totalKg += w;
                itemMap[key].revenue += w > 0 ? p * w : 0;
              } else {
                itemMap[key].totalQty += item.qty;
                itemMap[key].revenue += p * item.qty;
              }
            }
          }
          const itemBreakdown = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
          // ── Category breakdown: infer category from product catalogue ──
          const categoryMap: Record<string, { label: string; orders: number; revenue: number; totalQty: number; totalKg: number }> = {};
          for (const o of dropOrders) {
            const items: OrderItem[] = JSON.parse(o.items || "[]");
            const seenCats = new Set<string>();
            for (const item of items) {
              const cat = productCategoryMap[item.name.toLowerCase()] ?? "other";
              const label = CATEGORY_LABELS[cat] ?? cat;
              if (!categoryMap[cat]) categoryMap[cat] = { label, orders: 0, revenue: 0, totalQty: 0, totalKg: 0 };
              const p = parseFloat(item.price) || 0;
              const isKg = (item.unit || "").toLowerCase().includes("kg");
              const w = parseFloat(item.finalWeightKg || "") || (isKg ? item.qty : 0);
              categoryMap[cat].revenue += isKg ? p * w : p * item.qty;
              if (isKg) categoryMap[cat].totalKg += w;
              else categoryMap[cat].totalQty += item.qty;
              if (!seenCats.has(cat)) { categoryMap[cat].orders += 1; seenCats.add(cat); }
            }
          }
          const categoryBreakdown = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);

          const itemCounts = dropOrders.map((o) => (JSON.parse(o.items || "[]") as OrderItem[]).length);
          const avgItemsPerOrder = itemCounts.length > 0 ? itemCounts.reduce((s, c) => s + c, 0) / itemCounts.length : 0;
          const maxItemsPerOrder = itemCounts.length > 0 ? Math.max(...itemCounts) : 0;
          const itemCountFreq: Record<number, number> = {};
          for (const c of itemCounts) itemCountFreq[c] = (itemCountFreq[c] || 0) + 1;
          const mostCommonEntry = Object.entries(itemCountFreq).sort((a, b) => b[1] - a[1])[0];

          const orderTotals = dropOrders.map(calcOrderTotal);
          const buckets = [
            { label: "$0 – $100", min: 0, max: 100, count: 0 },
            { label: "$100 – $200", min: 100, max: 200, count: 0 },
            { label: "$200 – $300", min: 200, max: 300, count: 0 },
            { label: "$300 – $400", min: 300, max: 400, count: 0 },
            { label: "$400+", min: 400, max: Infinity, count: 0 },
          ];
          for (const total of orderTotals) {
            for (const b of buckets) { if (total >= b.min && total < b.max) { b.count++; break; } }
          }
          const sorted = [...orderTotals].sort((a, b) => a - b);
          const medianOrderValue = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
          const maxOrderValue = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
          const minOrderValue = sorted.length > 0 ? sorted[0] : 0;

          const allOrders = await getAllOrders();
          const phoneDropMap: Record<string, Set<number | null>> = {};
          for (const o of allOrders) {
            if (!phoneDropMap[o.phone]) phoneDropMap[o.phone] = new Set();
            phoneDropMap[o.phone].add(o.dropId ?? null);
          }
          const dropPhones = new Set(dropOrders.map((o) => o.phone));
          const repeatCustomers = Array.from(dropPhones)
            .filter((phone) => (phoneDropMap[phone]?.size ?? 0) > 1)
            .map((phone) => {
              const allForPhone = allOrders.filter((o) => o.phone === phone);
              const totalRevenue = allForPhone.filter((o) => o.status === "paid").reduce((sum, o) => sum + calcOrderTotal(o), 0);
              return {
                phone: phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 \u2022\u2022\u2022 \u2022\u2022\u2022"),
                dropCount: phoneDropMap[phone].size,
                totalRevenue,
              };
            })
            .sort((a, b) => b.dropCount - a.dropCount)
            .slice(0, 5);

          const cancelledOrders = dropOrders.filter((o) => o.status === "cancelled").map((o) => {
            const items: OrderItem[] = JSON.parse(o.items || "[]");
            const total = items.reduce((s, item) => {
              const p = parseFloat(item.price) || 0;
              const kg = item.unit?.toLowerCase().includes("kg");
              const w = parseFloat(item.finalWeightKg || "") || (kg ? item.qty : 0);
              return s + (kg ? p * w : p * item.qty);
            }, 0);
            const topItem = items[0];
            return {
              phone: o.phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 \u2022\u2022\u2022 \u2022\u2022\u2022"),
              total,
              summary: topItem ? `${topItem.name} \u00d7 ${topItem.qty}` : "\u2014",
            };
          });
          const lostRevenue = cancelledOrders.reduce((s, o) => s + o.total, 0);

          return {
            drop, placed, paid, cancelled, pending, conversionRate, revenue, avgOrderValue,
            pickupCount, deliveryCount, locationBreakdown, topProducts,
            avgItemsPerOrder, maxItemsPerOrder,
            mostCommonItemCount: mostCommonEntry ? { count: parseInt(mostCommonEntry[0]), orders: mostCommonEntry[1] } : null,
            itemCountDistribution: Object.entries(itemCountFreq)
              .map(([count, orders]) => ({ count: parseInt(count), orders }))
              .sort((a, b) => a.count - b.count),
            orderSizeBuckets: buckets, medianOrderValue, maxOrderValue, minOrderValue,
            repeatCustomers, repeatCustomerCount: repeatCustomers.length,
            cancelledOrders, lostRevenue,
            itemBreakdown, categoryBreakdown,
          };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
