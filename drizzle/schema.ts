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