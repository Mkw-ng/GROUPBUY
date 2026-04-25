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
} from "./db";

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

// ─── App Router ─────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

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
        const id = await createOrder({
          phone: input.phone,
          pickupDate: input.pickupDate,
          location: input.location,
          deliveryAddress: input.deliveryAddress ?? null,
          items: input.items,
          specialInstructions: input.specialInstructions ?? null,
          isPowerDrop: input.isPowerDrop,
          status: "pending",
          deliveryCharge: "0.00",
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
  }),
});

export type AppRouter = typeof appRouter;
