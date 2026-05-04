import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Products table — each row is a product available in the group buy.
 * powerDropPrice is the special event price shown during Power Drop events.
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cut: varchar("cut", { length: 255 }).notNull().default(""),
  category: mysqlEnum("category", [
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
  ])
    .notNull()
    .default("beef"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  powerDropPrice: decimal("powerDropPrice", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 64 }).notNull().default("/ kg"),
  badge: mysqlEnum("badge", ["LIMITED", "POPULAR", "NEW", "SOLD OUT"]),
  available: boolean("available").notNull().default(true),
  img: text("img"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Settings table — key/value store for site-wide configuration.
 * Keys used:
 *   - powerDropActive: "true" | "false"
 *   - announcementMessage: string
 *   - announcementActive: "true" | "false"
 *   - powerDropLabel: string (e.g. "POWER DROP — LIVE NOW")
 */
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;

/**
 * Orders table — each row is a customer order submitted through the cart checkout.
 * items is stored as JSON text: Array<{ id: number; name: string; cut: string; qty: number; price: string; finalWeightKg?: string }>
 * status: pending = awaiting payment, paid = payment confirmed, cancelled = order cancelled
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  /** Customer WhatsApp phone number — used as the order reference */
  phone: varchar("phone", { length: 20 }).notNull(),
  pickupDate: varchar("pickupDate", { length: 32 }).notNull(),
  /** 'cranbourne' | 'clayton' | 'delivery' */
  location: varchar("location", { length: 32 }).notNull(),
  /** Delivery address — only set when location === 'delivery' */
  deliveryAddress: text("deliveryAddress"),
  /** JSON array of ordered items */
  items: text("items").notNull(),
  specialInstructions: text("specialInstructions"),
  /** Delivery charge in dollars — admin sets this after reviewing the order */
  deliveryCharge: decimal("deliveryCharge", { precision: 10, scale: 2 }).default("0.00"),
  status: mysqlEnum("status", ["pending", "paid", "cancelled"]).notNull().default("pending"),
  /** Whether this order was placed during a Power Drop event */
  isPowerDrop: boolean("isPowerDrop").notNull().default(false),
  /** FK to drops table — which drop this order belongs to (null = unassigned) */
  dropId: int("dropId"),
  /** Archived orders are hidden from active tabs but retained for analytics */
  archived: boolean("archived").notNull().default(false),
  /** Optional customer name filled in by admin */
  customerName: varchar("customerName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/** Shape of each item stored in orders.items JSON */
export interface OrderItem {
  id: number;
  name: string;
  cut: string;
  qty: number;
  /** Price per unit at time of order */
  price: string;
  unit: string;
  /** Final weight in kg — filled in by admin after weighing */
  finalWeightKg?: string;
}

/**
 * Drops table — each row represents one Power-Drop cycle.
 * Only one drop can be active at a time (isActive = true).
 * Orders are tagged to a drop via orders.dropId.
 */
export const drops = mysqlTable("drops", {
  id: int("id").autoincrement().primaryKey(),
  /** Sequential name e.g. "Drop 1", "Drop 2" */
  name: varchar("name", { length: 64 }).notNull(),
  /** Whether this is the currently active drop — only one can be true at a time */
  isActive: boolean("isActive").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Set when the drop is closed */
  closedAt: timestamp("closedAt"),
});
export type Drop = typeof drops.$inferSelect;
export type InsertDrop = typeof drops.$inferInsert;

/**
 * Customers table — one row per unique phone number.
 * Created/updated automatically when an order is archived.
 * Used for customer analytics and the public "Check My Stats" feature.
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  /** Phone number — unique identifier for the customer */
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  /** Optional name filled in by admin on any of their orders */
  name: varchar("name", { length: 255 }),
  /** Date of their first archived order */
  firstOrderDate: timestamp("firstOrderDate"),
  /** Date of their most recent archived order */
  lastOrderDate: timestamp("lastOrderDate"),
  /** Total number of archived orders */
  totalOrders: int("totalOrders").notNull().default(0),
  /** Total spend across all archived orders */
  totalSpend: decimal("totalSpend", { precision: 12, scale: 2 }).notNull().default("0.00"),
  /** Total kg ordered across all archived orders */
  totalKg: decimal("totalKg", { precision: 10, scale: 3 }).notNull().default("0.000"),
  /** Grand total of the largest single archived order */
  largestOrder: decimal("largestOrder", { precision: 10, scale: 2 }).notNull().default("0.00"),
  /** Grand total of the smallest single archived order */
  smallestOrder: decimal("smallestOrder", { precision: 10, scale: 2 }).notNull().default("0.00"),
  /** Number of archived orders that were Power Drop orders */
  powerDropsAttended: int("powerDropsAttended").notNull().default(0),
  /** Total dollar savings from Power Drop pricing across all archived orders */
  totalSavings: decimal("totalSavings", { precision: 10, scale: 2 }).notNull().default("0.00"),
  /** JSON: top 5 most ordered product names */
  favouriteItems: text("favouriteItems"),
  /** Most ordered product category */
  favouriteCategory: varchar("favouriteCategory", { length: 64 }),
  /** Most used pickup location */
  preferredLocation: varchar("preferredLocation", { length: 32 }),
  /** Current consecutive drop streak */
  currentStreak: int("currentStreak").notNull().default(0),
  /** Longest ever consecutive drop streak */
  longestStreak: int("longestStreak").notNull().default(0),
  /** JSON: { name, qty, orderId } of the biggest single item ever ordered */
  biggestSingleItem: text("biggestSingleItem"),
  /** JSON: array of earned badge IDs e.g. ["first_drop","on_fire"] */
  badges: text("badges"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
