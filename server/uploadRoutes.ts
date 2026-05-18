import { Router } from "express";
import type { Application } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export function registerUploadRoutes(app: Application) {
  const router = Router();

  router.post(
    "/api/upload/product-image",
    upload.single("image"),
    async (req, res) => {
      try {
        // Auth check — admin only
        let user;
        try {
          user = await sdk.authenticateRequest(req as any);
        } catch {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        if (!user || user.role !== "admin") {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: "No file provided" });
          return;
        }

        const MIME_TO_EXT: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
          "image/avif": "avif",
        };
        const ext = MIME_TO_EXT[req.file.mimetype] ?? "jpg";
        const key = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

        res.json({ url });
      } catch (err) {
        console.error("[upload] error:", err);
        res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  app.use(router);
}
