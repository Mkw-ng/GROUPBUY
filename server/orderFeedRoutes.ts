import { Router } from "express";
import type { Application } from "express";
import { getCasualOrdersSince } from "./db";
import { formatFeedOrder, isValidFeedKey } from "./orderFeed";

/** Registers the read-only casual-order feed used by the external order organiser. */
export function registerOrderFeedRoutes(app: Application): void {
  const router = Router();

  router.get("/api/orders/feed", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const key = typeof req.query.key === "string" ? req.query.key : undefined;
      const rawDays = typeof req.query.days === "string" ? req.query.days : undefined;
      const days = rawDays && /^\d+$/.test(rawDays) && +rawDays >= 1 && +rawDays <= 60
        ? +rawDays
        : 14;
      const expectedKey = process.env.ORDER_FEED_KEY;

      if (!expectedKey) {
        res.status(503).json({ error: "Feed disabled" });
        return;
      }
      if (!isValidFeedKey(key, expectedKey)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const rows = await getCasualOrdersSince(new Date(Date.now() - days * 86_400_000));
      res.status(200).json({
        generatedAt: new Date().toISOString(),
        days,
        count: rows.length,
        truncated: rows.length === 500,
        orders: rows.map(formatFeedOrder),
      });
    } catch {
      console.error("[order-feed] failed to serve feed");
      res.status(500).json({ error: "Feed failed" });
    }
  });

  app.use(router);
}

export default registerOrderFeedRoutes;
