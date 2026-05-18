import { desc, eq } from "drizzle-orm";
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
    console.error("[Database] Failed to upsert user:", error);
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
 * Check if Power Drop has expired (activatedAt + 3 days < now).
 * If so, turn it off and clear the activation timestamp.
 * Returns true if it was expired and turned off, false otherwise.
 */
// ─── Orders ─────────────────────────────────────────────────────────────────

export async function createOrder(data: InsertOrder): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function getAllOrders(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.archived, false)).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
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

export async function updateOrderDeliveryCharge(id: number, deliveryCharge: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ deliveryCharge }).where(eq(orders.id, id));
}

export async function updateOrderStatus(id: number, status: "pending" | "paid" | "cancelled"): Promise<void> {
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

  const deadline = activated + 3 * 24 * 60 * 60 * 1000;
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
    const { isNull } = await import("drizzle-orm");
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
