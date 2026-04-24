/**
 * Database seed script — populates products and settings tables with placeholder data.
 * Run: node scripts/seed.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "dotenv";

config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Exiting.");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// ─── Products ─────────────────────────────────────────────────────────────────

const products = [
  {
    name: "Full Blood Wagyu Ribeye",
    cut: "MS7+ · 300g avg",
    category: "beef",
    description: "Full blood wagyu from the Darling Downs, marble score 7+. Exceptional flavour and tenderness.",
    price: "42.00",
    powerDropPrice: "34.00",
    unit: "/ steak",
    badge: "LIMITED",
    available: true,
    img: "/manus-storage/product-wagyu_70637951.jpg",
    sortOrder: 1,
  },
  {
    name: "Grass-Fed Scotch Fillet",
    cut: "250g avg",
    category: "beef",
    description: "Pasture-raised, grain-finished scotch fillet. Rich marbling, perfect for pan or grill.",
    price: "18.50",
    powerDropPrice: "14.00",
    unit: "/ steak",
    badge: null,
    available: true,
    img: "/manus-storage/product-ribeye_e4a87bad.jpg",
    sortOrder: 2,
  },
  {
    name: "Whole Brisket",
    cut: "3–4kg avg",
    category: "beef",
    description: "Full packer brisket, ideal for low-and-slow smoking. Includes point and flat.",
    price: "68.00",
    powerDropPrice: "55.00",
    unit: "/ piece",
    badge: "POPULAR",
    available: true,
    img: null,
    sortOrder: 3,
  },
  {
    name: "Beef Short Ribs",
    cut: "Plate cut · 1.2kg avg",
    category: "beef",
    description: "Thick-cut plate short ribs, perfect for braising or smoking.",
    price: "32.00",
    powerDropPrice: "26.00",
    unit: "/ pack",
    badge: null,
    available: false,
    img: null,
    sortOrder: 4,
  },
  {
    name: "Pork Belly Slab",
    cut: "Skin-on · 1.5kg avg",
    category: "pork",
    description: "Skin-on pork belly, ideal for crackling roasts or braised dishes.",
    price: "22.00",
    powerDropPrice: "17.00",
    unit: "/ kg",
    badge: null,
    available: true,
    img: null,
    sortOrder: 5,
  },
  {
    name: "Pork Shoulder Bone-In",
    cut: "2–3kg avg",
    category: "pork",
    description: "Bone-in pork shoulder, great for pulled pork or slow roasting.",
    price: "14.50",
    powerDropPrice: "11.00",
    unit: "/ kg",
    badge: null,
    available: true,
    img: null,
    sortOrder: 6,
  },
  {
    name: "Lamb Shoulder Whole",
    cut: "Bone-in · 2kg avg",
    category: "lamb",
    description: "Whole bone-in lamb shoulder, slow-roasted to fall-off-the-bone perfection.",
    price: "28.00",
    powerDropPrice: "22.00",
    unit: "/ piece",
    badge: "NEW",
    available: true,
    img: null,
    sortOrder: 7,
  },
  {
    name: "French Rack of Lamb",
    cut: "8-bone · 700g avg",
    category: "lamb",
    description: "Frenched rack of lamb, perfect for entertaining. Herb crust recommended.",
    price: "38.00",
    powerDropPrice: "29.00",
    unit: "/ rack",
    badge: "LIMITED",
    available: true,
    img: "/manus-storage/product-lamb_ecbb6511.jpg",
    sortOrder: 8,
  },
  {
    name: "Free Range Whole Chicken",
    cut: "1.8kg avg",
    category: "poultry",
    description: "Free range, air-chilled whole chicken. No added hormones or antibiotics.",
    price: "16.00",
    powerDropPrice: "12.00",
    unit: "/ bird",
    badge: null,
    available: true,
    img: null,
    sortOrder: 9,
  },
  {
    name: "Duck Breast",
    cut: "2 x 200g avg",
    category: "poultry",
    description: "Premium duck breast, skin-on. Pan-sear skin-side down for crispy results.",
    price: "24.00",
    powerDropPrice: "19.00",
    unit: "/ pack",
    badge: "NEW",
    available: true,
    img: null,
    sortOrder: 10,
  },
  {
    name: "Wild-Caught King Prawns",
    cut: "1kg bag · shell-on",
    category: "seafood",
    description: "Wild-caught Australian king prawns, shell-on. Excellent for BBQ or prawn cocktail.",
    price: "34.00",
    powerDropPrice: "27.00",
    unit: "/ kg",
    badge: "POPULAR",
    available: true,
    img: null,
    sortOrder: 11,
  },
  {
    name: "Bone Broth Bones",
    cut: "Mixed · 2kg bag",
    category: "other",
    description: "Mixed marrow and knuckle bones, ideal for making rich bone broth.",
    price: "12.00",
    powerDropPrice: "9.00",
    unit: "/ bag",
    badge: null,
    available: true,
    img: null,
    sortOrder: 12,
  },
];

// ─── Settings ─────────────────────────────────────────────────────────────────

const settingsData = [
  { key: "powerDropActive", value: "false" },
  { key: "announcementActive", value: "true" },
  {
    key: "announcementMessage",
    value: "New drop open now — Wagyu Ribeye MS7+ & Lamb Shoulder. Closes Thursday midnight.",
  },
  { key: "powerDropLabel", value: "POWER DROP — LIVE NOW" },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

console.log("Seeding products…");
for (const product of products) {
  await connection.execute(
    `INSERT INTO products (name, cut, category, description, price, powerDropPrice, unit, badge, available, img, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = name`,
    [
      product.name,
      product.cut,
      product.category,
      product.description,
      product.price,
      product.powerDropPrice ?? null,
      product.unit,
      product.badge ?? null,
      product.available ? 1 : 0,
      product.img ?? null,
      product.sortOrder,
    ]
  );
  console.log(`  ✓ ${product.name}`);
}

console.log("\nSeeding settings…");
for (const setting of settingsData) {
  await connection.execute(
    `INSERT INTO settings (\`key\`, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [setting.key, setting.value]
  );
  console.log(`  ✓ ${setting.key}`);
}

await connection.end();
console.log("\nSeed complete.");
