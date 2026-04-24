import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getAllProducts,
  getAllSettings,
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
  category: z.enum(["beef", "pork", "lamb", "poultry", "seafood", "other"]),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  powerDropPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  unit: z.string().default("/ kg"),
  badge: z.enum(["LIMITED", "POPULAR", "NEW", "SOLD OUT"]).optional().nullable(),
  available: z.boolean().default(true),
  img: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
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
      return getAllSettings();
    }),
  }),

  // ─── Admin: Products & Settings ─────────────────────────────────────────────────────────

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
