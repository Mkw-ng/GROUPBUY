import { and, asc, count, desc, eq, isNull, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertProduct, InsertOrder, orders, products, settings, users, OrderItem, drops, Drop } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error instanceof Error ? error.message : error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(products.sortOrder, products.createdAt);
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function upsertProduct(data: InsertProduct & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (data.id) {
    const { id, ...rest } = data;
    await db.update(products).set(rest).where(eq(products.id, id));
    return id;
  } else {
    const result = await db.insert(products).values(data);
    return (result[0] as { insertId: number }).insertId;
  }
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(products).where(eq(products.id, id));
}

export async function setProductAvailability(id: number, available: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set({ available }).where(eq(products.id, id));
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Record<string, string> = {
  powerDropActive: "false",
  powerDropActivatedAt: "",   // ISO timestamp set when Power Drop is toggled ON, cleared when OFF
  announcementActive: "true",
  announcementMessage: "New drop open now — Wagyu Ribeye MS7+ & Lamb Shoulder. Closes Thursday midnight.",
  powerDropLabel: "POWER DROP — LIVE NOW",
};

export async function getSetting(key: string): Promise<string> {
  const db = await getDb();
  if (!db) return DEFAULT_SETTINGS[key] ?? "";
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result[0]?.value ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return DEFAULT_SETTINGS;
  const rows = await db.select().from(settings);
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function batchReorderProducts(updates: { id: number; sortOrder: number }[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await Promise.all(
    updates.map(({ id, sortOrder }) =>
      db.update(products).set({ sortOrder }).where(eq(products.id, id))
    )
  );
}

/**
 * Check if Power Drop has expired (activatedAt + 24 hours < now).
 * If so, turn it off and clear the activation timestamp.
 * Returns true if it was expired and turned off, false otherwise.
 */
// ─── Orders ─────────────────────────────────────────────────────────────────

/** Generate a unique GB-XXXX invoice number (4 random digits, retries on collision). */
async function generateInvoiceNumber(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  if (!db) throw new Error("Database not available");
  for (let attempt = 0; attempt < 20; attempt++) {
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const candidate = `GB-${digits}`;
    const existing = await db.select({ id: orders.id }).from(orders).where(eq(orders.invoiceNumber, candidate)).limit(1);
    if (existing.length === 0) return candidate;
  }
  // Fallback: use timestamp-based suffix to guarantee uniqueness
  return `GB-${Date.now().toString().slice(-4)}`;
}

export async function createOrder(data: InsertOrder): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const invoiceNumber = await generateInvoiceNumber(db);
  const result = await db.insert(orders).values({ ...data, invoiceNumber });
  return (result[0] as { insertId: number }).insertId;
}

/**
 * Paginated active-orders helper (legacy UI use). Defaults to limit=100.
 * Do NOT use where a complete uncapped list is required — use getOrdersPage(),
 * getAllOrdersForDrops(), or getUnassignedOrders() instead.
 */
export async function getAllOrders(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.archived, false)).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
}

/**
 * Paginated orders with hasMore flag (uses limit+1 trick — no extra COUNT query).
 * Returns at most `limit` rows; `hasMore` is true when there are more rows beyond this page.
 */
export async function getOrdersPage(limit = 100, offset = 0): Promise<{
  orders: (typeof orders.$inferSelect)[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const db = await getDb();
  if (!db) return { orders: [], limit, offset, hasMore: false };
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.archived, false))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(limit + 1)
    .offset(offset);
  const hasMore = rows.length > limit;
  return { orders: hasMore ? rows.slice(0, limit) : rows, limit, offset, hasMore };
}

/**
 * Returns all orders (including archived) for drop analytics.
 * Archived orders are intentionally included so historical analytics
 * (repeat-customer rates, drop revenue) remain accurate after archiving.
 */
export async function getAllOrdersForDrops(): Promise<(typeof orders.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function updateOrderSpecialInstructions(id: number, specialInstructions: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ specialInstructions }).where(eq(orders.id, id));
}

/**
 * Search active (non-archived) orders by phone number.
 * Strips non-digit characters from both the query and the stored phone before matching.
 */
export async function searchActiveOrdersByPhone(phoneQuery: string): Promise<(typeof orders.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  const trimmed = phoneQuery.trim();
  if (!trimmed) return [];
  // Check if query looks like an invoice number (starts with GB- or is all digits)
  const isInvoiceSearch = /^GB-?\d*/i.test(trimmed);
  if (isInvoiceSearch) {
    // Search by invoice number (case-insensitive prefix/contains match)
    const invoicePattern = trimmed.toUpperCase().replace(/^GB-?/, "GB-");
    return db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.archived, false),
          sql`${orders.invoiceNumber} LIKE ${`%${invoicePattern}%`}`
        )
      )
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(100);
  }
  // Otherwise search by phone number (strip non-digits)
  const cleaned = trimmed.replace(/\D/g, "");
  if (!cleaned) return [];
  // Normalize stored phone in SQL: remove spaces, dashes, brackets, plus signs
  const normalizedPhone = sql`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${orders.phone}, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')`;
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.archived, false),
        sql`${normalizedPhone} LIKE ${`%${cleaned}%`}`
      )
    )
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(100);
}

/**
 * Search archived orders by phone number.
 * Same normalisation logic as searchActiveOrdersByPhone.
 */
export async function searchArchivedOrdersByPhone(phoneQuery: string): Promise<(typeof orders.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  const trimmed = phoneQuery.trim();
  if (!trimmed) return [];
  // Check if query looks like an invoice number (starts with GB-)
  const isInvoiceSearch = /^GB-?\d*/i.test(trimmed);
  if (isInvoiceSearch) {
    const invoicePattern = trimmed.toUpperCase().replace(/^GB-?/, "GB-");
    return db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.archived, true),
          sql`${orders.invoiceNumber} LIKE ${`%${invoicePattern}%`}`
        )
      )
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(100);
  }
  const cleaned = trimmed.replace(/\D/g, "");
  if (!cleaned) return [];
  const normalizedPhone = sql`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${orders.phone}, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')`;
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.archived, true),
        sql`${normalizedPhone} LIKE ${`%${cleaned}%`}`
      )
    )
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(100);
}

export async function getAllPaidActiveOrders(): Promise<(typeof orders.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.archived, false), eq(orders.status, "paid")))
    .orderBy(asc(orders.createdAt));
}

/**
 * Returns accurate counts for active (non-archived) orders by status.
 * Used by the admin UI so filter tab counts are never capped by pagination.
 */
export async function getActiveOrderCounts(): Promise<{
  all: number;
  pending: number;
  invoice_issued: number;
  paid: number;
  in_progress: number;
  pickup_available: number;
  cancelled: number;
}> {
  const db = await getDb();
  if (!db) return { all: 0, pending: 0, invoice_issued: 0, paid: 0, in_progress: 0, pickup_available: 0, cancelled: 0 };
  const rows = await db
    .select({ status: orders.status, cnt: count() })
    .from(orders)
    .where(eq(orders.archived, false))
    .groupBy(orders.status);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = Number(r.cnt);
  return {
    all: Object.values(map).reduce((a, b) => a + b, 0),
    pending: map["pending"] ?? 0,
    invoice_issued: map["invoice_issued"] ?? 0,
    paid: map["paid"] ?? 0,
    in_progress: map["in_progress"] ?? 0,
    pickup_available: map["pickup_available"] ?? 0,
    cancelled: map["cancelled"] ?? 0,
  };
}

/**
 * Returns all active non-archived orders that have no dropId assigned.
 * Used by AdminDrops UnassignedOrdersCard — not capped.
 */
export async function getUnassignedOrders(): Promise<(typeof orders.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.archived, false), isNull(orders.dropId)))
    .orderBy(asc(orders.createdAt));
}

/**
 * Returns IDs of all paid, non-archived orders.
 * Used by archiveAllPaidActiveOrders to run per-order analytics updates after bulk archive.
 */
export async function getPaidActiveOrderIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.archived, false), eq(orders.status, "paid")));
  return rows.map((r) => r.id);
}

/**
 * Transfers all paid, non-archived orders to pickup_available status in a single UPDATE.
 * Returns the number of rows affected.
 */
export async function transferAllPaidToPickupAvailable(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(orders)
    .set({ status: "pickup_available" })
    .where(and(eq(orders.archived, false), eq(orders.status, "paid")));
  return Number((result[0] as { affectedRows?: number })?.affectedRows ?? 0);
}

/**
 * Transfers all paid, non-archived orders to in_progress status in a single UPDATE.
 * Returns the number of rows affected.
 */
export async function transferAllPaidToInProgress(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(orders)
    .set({ status: "in_progress" })
    .where(and(eq(orders.archived, false), eq(orders.status, "paid")));
  return Number((result[0] as { affectedRows?: number })?.affectedRows ?? 0);
}

/**
 * Archives all paid, non-archived orders in a single UPDATE.
 * Returns the number of rows affected.
 */
export async function archiveAllPaidActiveOrders(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(orders)
    .set({ archived: true })
    .where(and(eq(orders.archived, false), eq(orders.status, "paid")));
  return Number((result[0] as { affectedRows?: number })?.affectedRows ?? 0);
}

export async function getArchivedOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.archived, true)).orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function updateOrderItems(id: number, items: OrderItem[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ items: JSON.stringify(items) }).where(eq(orders.id, id));
}

export async function updateOrderPhone(id: number, phone: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ phone }).where(eq(orders.id, id));
}

export async function updateOrderDeliveryCharge(id: number, deliveryCharge: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ deliveryCharge }).where(eq(orders.id, id));
}

export async function updateOrderStatus(id: number, status: "pending" | "invoice_issued" | "paid" | "in_progress" | "pickup_available" | "cancelled"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

export async function deleteOrder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orders).where(eq(orders.id, id));
}

export async function checkAndExpirePowerDrop(): Promise<boolean> {
  const active = await getSetting("powerDropActive");
  if (active !== "true") return false;

  const activatedAt = await getSetting("powerDropActivatedAt");
  if (!activatedAt) return false;

  const activated = new Date(activatedAt).getTime();
  if (isNaN(activated)) return false;

  const deadline = activated + 24 * 60 * 60 * 1000; // 24 hours
  if (Date.now() < deadline) return false;

  // Expired — turn off Power Drop
  await setSetting("powerDropActive", "false");
  await setSetting("powerDropActivatedAt", "");
  return true;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(settings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ─── Drops ─────────────────────────────────────────────────────────────────
export async function getAllDrops(): Promise<Drop[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drops).orderBy(desc(drops.createdAt));
}

export async function getActiveDrop(): Promise<Drop | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drops).where(eq(drops.isActive, true)).limit(1);
  return result[0];
}

export async function getDropById(id: number): Promise<Drop | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drops).where(eq(drops.id, id)).limit(1);
  return result[0];
}

export async function createDrop(name: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Deactivate all existing drops first
  await db.update(drops).set({ isActive: false, closedAt: new Date() }).where(eq(drops.isActive, true));
  const result = await db.insert(drops).values({ name, isActive: true });
  return (result[0] as { insertId: number }).insertId;
}

export async function closeDrop(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(drops).set({ isActive: false, closedAt: new Date() }).where(eq(drops.id, id));
}

export async function assignOrderToDrop(orderId: number, dropId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ dropId }).where(eq(orders.id, orderId));
}

export async function getOrdersByDrop(dropId: number | null) {
  const db = await getDb();
  if (!db) return [];
  if (dropId === null) {
    // isNull is already imported at the top of this file — no dynamic import needed
    return db.select().from(orders).where(isNull(orders.dropId)).orderBy(desc(orders.createdAt));
  }
  return db.select().from(orders).where(eq(orders.dropId, dropId)).orderBy(desc(orders.createdAt));
}

export async function renameDrop(id: number, name: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(drops).set({ name }).where(eq(drops.id, id));
}

export async function deleteDrop(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Unlink all orders from this drop before deleting
  await db.update(orders).set({ dropId: null }).where(eq(orders.dropId, id));
  await db.delete(drops).where(eq(drops.id, id));
}

export async function archiveOrder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ archived: true }).where(eq(orders.id, id));
}

export async function unarchiveOrder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ archived: false }).where(eq(orders.id, id));
}

/**
 * Calculates total ordered quantity per product ID from active (non-archived)
 * pending and paid orders. Cancelled and archived orders are excluded.
 *
 * For kg-based products (unit contains "kg"):
 *   - Uses finalWeightKg if set and > 0, otherwise uses qty.
 * For non-kg products:
 *   - Uses qty.
 *
 * Returns a Map<productId, totalQty>.
 *
 * NOTE: This reads from the orders.items JSON column. A future order_items
 * table with row-level locking would make stock validation stronger under
 * concurrent load.
 */
export async function getOrderedQtyByProduct(): Promise<Map<number, number>> {
  const db = await getDb();
  const result = new Map<number, number>();
  if (!db) return result;

  const activeOrders = await db
    .select({ items: orders.items })
    .from(orders)
    .where(
      and(
        eq(orders.archived, false),
        sql`${orders.status} IN ('pending', 'paid')`
      )
    );

  for (const row of activeOrders) {
    let items: OrderItem[] = [];
    try {
      items = JSON.parse(row.items ?? "[]");
    } catch {
      continue;
    }
    for (const item of items) {
      const isKg = (item.unit ?? "").toLowerCase().includes("kg");
      const finalW = item.finalWeightKg ? parseFloat(item.finalWeightKg) : 0;
      const qty = isKg && finalW > 0 ? finalW : (item.qty ?? 0);
      result.set(item.id, (result.get(item.id) ?? 0) + qty);
    }
  }
  return result;
}
