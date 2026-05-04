/**
 * Customer analytics DB helpers.
 * Called when an order is archived to create/update the customer profile.
 */
import { eq, desc, asc } from "drizzle-orm";
import { getDb } from "./db";
import { customers, orders, drops } from "../drizzle/schema";
import type { Order, OrderItem } from "../drizzle/schema";
import { ALL_BADGES } from "../shared/badges";

// ─── Loyalty tier helper ────────────────────────────────────────────────────
export function getLoyaltyTier(dropsAttended: number): {
  tier: string;
  emoji: string;
  next: string | null;
  dropsToNext: number | null;
} {
  if (dropsAttended >= 20) return { tier: "Legend", emoji: "👑", next: null, dropsToNext: null };
  if (dropsAttended >= 12) return { tier: "OG", emoji: "🏆", next: "Legend", dropsToNext: 20 - dropsAttended };
  if (dropsAttended >= 6) return { tier: "Loyal", emoji: "⚡", next: "OG", dropsToNext: 12 - dropsAttended };
  if (dropsAttended >= 3) return { tier: "Regular", emoji: "🔪", next: "Loyal", dropsToNext: 6 - dropsAttended };
  if (dropsAttended >= 1) return { tier: "Fresh Cut", emoji: "🥩", next: "Regular", dropsToNext: 3 - dropsAttended };
  return { tier: "New", emoji: "🌱", next: "Fresh Cut", dropsToNext: 1 };
}

// ─── Badge unlock logic ──────────────────────────────────────────────────────
interface BadgeInput {
  totalOrders: number;
  totalSpend: number;
  totalKg: number;
  largestOrder: number;
  currentStreak: number;
  longestStreak: number;
  powerDropsAttended: number;
  totalSavings: number;
  favouriteCategory: string | null;
  firstOrderDate: Date | null;
  loyaltyTier: string;
  favouriteItems: string[];
  categoryHistory: string[];
}

export function computeBadges(stats: BadgeInput): string[] {
  const earned: string[] = [];
  const now = new Date();

  const check = (id: string, condition: boolean) => {
    if (condition) earned.push(id);
  };

  // First-time milestones
  check("first_drop", stats.totalOrders >= 1);
  check("welcome_to_the_family", stats.totalOrders >= 1);

  // Order count milestones
  check("five_drops", stats.totalOrders >= 5);
  check("ten_drops", stats.totalOrders >= 10);
  check("twenty_five_drops", stats.totalOrders >= 25);
  check("fifty_drops", stats.totalOrders >= 50);

  // Streak badges
  check("on_fire", stats.longestStreak >= 3);
  check("unstoppable", stats.longestStreak >= 5);
  check("iron_streak", stats.longestStreak >= 10);

  // Spend milestones
  check("century_club", stats.totalSpend >= 100);
  check("five_hundred_club", stats.totalSpend >= 500);
  check("grand_club", stats.totalSpend >= 1000);
  check("high_roller", stats.totalSpend >= 5000);

  // Big order badges
  check("big_order", stats.largestOrder >= 200);
  check("mega_haul", stats.largestOrder >= 500);

  // Power Drop badges
  check("power_player", stats.powerDropsAttended >= 3);
  check("power_addict", stats.powerDropsAttended >= 10);

  // Weight / kg badges
  check("ten_kg", stats.totalKg >= 10);
  check("fifty_kg", stats.totalKg >= 50);
  check("hundred_kg", stats.totalKg >= 100);

  // Category loyalty badges
  check("beef_loyalist", stats.favouriteCategory === "beef");
  check("lamb_lover", stats.favouriteCategory === "lamb");
  check("pork_king", stats.favouriteCategory === "pork");
  check("seafood_fanatic", stats.favouriteCategory === "seafood");
  check("m3atfr3ak", stats.categoryHistory.includes("m3atfr3ak"));

  // Longevity / tenure badges
  if (stats.firstOrderDate) {
    const monthsOld =
      (now.getTime() - stats.firstOrderDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    check("three_months", monthsOld >= 3);
    check("six_months", monthsOld >= 6);
    check("one_year", monthsOld >= 12);
  }

  // Special / fun badges
  check("savings_king", stats.totalSavings >= 100);
  check("og_member", stats.loyaltyTier === "OG" || stats.loyaltyTier === "Legend");
  check("legend", stats.loyaltyTier === "Legend");

  // Only return IDs that exist in ALL_BADGES
  const validIds = new Set(ALL_BADGES.map((b) => b.id));
  return earned.filter((id) => validIds.has(id));
}

// ─── Recompute customer stats from all their archived orders ────────────────
export async function upsertCustomerFromOrder(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the order that was just archived
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;

  const phone = order.phone;

  // Get all archived orders for this phone number (including the one just archived)
  const allOrders: Order[] = await db
    .select()
    .from(orders)
    .where(eq(orders.phone, phone))
    .orderBy(asc(orders.createdAt));

  const archivedOrders: Order[] = allOrders.filter((o: Order) => o.archived);
  if (archivedOrders.length === 0) return;

  // Get all drops to compute streaks
  const allDrops = await db.select().from(drops).orderBy(asc(drops.createdAt));

  // ── Aggregate stats ──────────────────────────────────────────────────────
  let totalSpend = 0;
  let totalKg = 0;
  let largestOrder = 0;
  let smallestOrder = Infinity;
  let powerDropsAttended = 0;
  const totalSavings = 0;
  const itemCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const categoryHistory: string[] = [];
  const locationCounts: Record<string, number> = {};
  let biggestSingleItem: { name: string; qty: number; orderId: number } | null = null;

  for (const o of archivedOrders) {
    let items: OrderItem[] = [];
    try {
      items = JSON.parse(o.items || "[]") as OrderItem[];
    } catch {
      items = [];
    }

    // Grand total for this order
    let orderTotal = 0;
    let orderKg = 0;
    for (const item of items) {
      const qty = Number(item.qty) || 0;
      const price = parseFloat(String(item.price)) || 0;
      const finalKg = item.finalWeightKg ? parseFloat(String(item.finalWeightKg)) : qty;
      orderTotal += price * finalKg;
      orderKg += finalKg;

      // Item frequency
      if (item.name) {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + qty;
      }

      // Biggest single item
      if (!biggestSingleItem || qty > biggestSingleItem.qty) {
        biggestSingleItem = { name: item.name, qty, orderId: o.id };
      }

      // Category heuristic from item name keywords
      const nameLower = (item.name || "").toLowerCase();
      const catGuess =
        nameLower.includes("beef") || nameLower.includes("wagyu") || nameLower.includes("ribeye") || nameLower.includes("brisket") || nameLower.includes("striploin") || nameLower.includes("scotch") ? "beef" :
        nameLower.includes("lamb") || nameLower.includes("mutton") ? "lamb" :
        nameLower.includes("pork") || nameLower.includes("bacon") || nameLower.includes("ham") ? "pork" :
        nameLower.includes("chicken") || nameLower.includes("duck") || nameLower.includes("turkey") ? "poultry" :
        nameLower.includes("prawn") || nameLower.includes("fish") || nameLower.includes("salmon") || nameLower.includes("seafood") || nameLower.includes("lobster") || nameLower.includes("crab") ? "seafood" :
        null;
      if (catGuess) {
        categoryCounts[catGuess] = (categoryCounts[catGuess] || 0) + qty;
        if (!categoryHistory.includes(catGuess)) categoryHistory.push(catGuess);
      }
    }

    // Add delivery charge
    const delivery = parseFloat(String(o.deliveryCharge || "0")) || 0;
    orderTotal += delivery;

    totalSpend += orderTotal;
    totalKg += orderKg;
    if (orderTotal > largestOrder) largestOrder = orderTotal;
    if (orderTotal < smallestOrder) smallestOrder = orderTotal;

    // Power drop
    if (o.isPowerDrop) {
      powerDropsAttended++;
    }

    // Location
    if (o.location) {
      locationCounts[o.location] = (locationCounts[o.location] || 0) + 1;
    }
  }

  if (smallestOrder === Infinity) smallestOrder = 0;

  // ── Favourite items (top 5 by order count) ──────────────────────────────
  const favouriteItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // ── Preferred location ───────────────────────────────────────────────────
  const preferredLocation =
    Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // ── Streak calculation ───────────────────────────────────────────────────
  const customerDropIds = new Set(
    archivedOrders
      .filter((o: Order) => o.dropId != null)
      .map((o: Order) => o.dropId as number)
  );

  const orderedDropIds = allDrops.map((d: { id: number }) => d.id);

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (let i = orderedDropIds.length - 1; i >= 0; i--) {
    if (customerDropIds.has(orderedDropIds[i])) {
      streak++;
      if (i === orderedDropIds.length - 1) currentStreak = streak;
    } else {
      streak = 0;
    }
    if (streak > longestStreak) longestStreak = streak;
  }

  // ── Dates ────────────────────────────────────────────────────────────────
  const firstOrderDate = archivedOrders[0].createdAt;
  const lastOrderDate = archivedOrders[archivedOrders.length - 1].createdAt;

  // ── Name: use the most recent non-null customerName ──────────────────────
  const nameFromOrders =
    archivedOrders
      .slice()
      .reverse()
      .find((o: Order) => o.customerName)?.customerName ?? null;

  // ── Favourite category ────────────────────────────────────────────────────
  const favouriteCategory =
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // ── Loyalty tier ─────────────────────────────────────────────────────────
  const loyaltyTier = getLoyaltyTier(archivedOrders.length);

  // ── Compute badges ────────────────────────────────────────────────────────
  const earnedBadges = computeBadges({
    totalOrders: archivedOrders.length,
    totalSpend,
    totalKg,
    largestOrder,
    currentStreak,
    longestStreak,
    powerDropsAttended,
    totalSavings,
    favouriteCategory,
    firstOrderDate,
    loyaltyTier: loyaltyTier.tier,
    favouriteItems,
    categoryHistory,
  });

  // ── Upsert customer record ───────────────────────────────────────────────
  const existing = await db.select().from(customers).where(eq(customers.phone, phone));

  const payload = {
    phone,
    ...(nameFromOrders != null ? { name: nameFromOrders } : {}),
    firstOrderDate,
    lastOrderDate,
    totalOrders: archivedOrders.length,
    totalSpend: totalSpend.toFixed(2),
    totalKg: totalKg.toFixed(3),
    largestOrder: largestOrder.toFixed(2),
    smallestOrder: smallestOrder.toFixed(2),
    powerDropsAttended,
    totalSavings: totalSavings.toFixed(2),
    favouriteItems: JSON.stringify(favouriteItems),
    ...(preferredLocation != null ? { preferredLocation } : {}),
    currentStreak,
    longestStreak,
    ...(biggestSingleItem != null ? { biggestSingleItem: JSON.stringify(biggestSingleItem) } : {}),
    badges: JSON.stringify(earnedBadges),
  };

  if (existing.length > 0) {
    await db.update(customers).set(payload).where(eq(customers.phone, phone));
  } else {
    await db.insert(customers).values(payload);
  }
}

// ─── Get customer by phone ───────────────────────────────────────────────────
export async function getCustomerByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(customers).where(eq(customers.phone, phone));
  return rows[0] ?? null;
}

// ─── Get all customers (for admin list) ─────────────────────────────────────
export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customers).orderBy(desc(customers.lastOrderDate));
}

// ─── Get all archived orders for a customer ──────────────────────────────────
export async function getCustomerOrders(phone: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(eq(orders.phone, phone))
    .orderBy(desc(orders.createdAt));
}
