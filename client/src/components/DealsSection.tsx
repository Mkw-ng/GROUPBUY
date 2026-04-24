/*
 * GROUPBUY Deals Section
 * Design: Paper background, left sidebar category nav, right product card grid
 * Product cards: border-ink, price in JetBrains Mono red, hover border-red
 * Category tabs: left-border red indicator for active state
 * Power Drop: crossed-out original price + red Power Drop price, button changes to "Secure Power-Drop ⚡"
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const CATEGORIES = [
  { id: "all", label: "All Drops" },
  { id: "beef", label: "Beef" },
  { id: "pork", label: "Pork" },
  { id: "lamb", label: "Lamb" },
  { id: "poultry", label: "Poultry" },
  { id: "seafood", label: "Seafood" },
  { id: "other", label: "Other" },
];

const BADGE_STYLES: Record<string, string> = {
  LIMITED: "bg-[#c73e3a] text-[#f5f2ec]",
  POPULAR: "bg-[#0a0a0a] text-[#f5f2ec]",
  NEW: "border border-[#0a0a0a] text-[#0a0a0a]",
  "SOLD OUT": "bg-[#8a857c] text-[#f5f2ec]",
};

// Fallback placeholder products shown while DB is empty or loading
const PLACEHOLDER_PRODUCTS = [
  {
    id: -1,
    category: "beef" as const,
    name: "Full Blood Wagyu Ribeye",
    cut: "MS7+ · 300g avg",
    price: "42.00",
    powerDropPrice: "34.00",
    unit: "/ steak",
    badge: "LIMITED" as const,
    available: true,
    img: "/manus-storage/product-wagyu_70637951.jpg",
    sortOrder: 0,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: -2,
    category: "beef" as const,
    name: "Grass-Fed Scotch Fillet",
    cut: "250g avg",
    price: "18.50",
    powerDropPrice: "14.00",
    unit: "/ steak",
    badge: null,
    available: true,
    img: "/manus-storage/product-ribeye_e4a87bad.jpg",
    sortOrder: 1,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: -3,
    category: "lamb" as const,
    name: "French Rack of Lamb",
    cut: "8-bone · 700g avg",
    price: "38.00",
    powerDropPrice: "29.00",
    unit: "/ rack",
    badge: "LIMITED" as const,
    available: true,
    img: "/manus-storage/product-lamb_ecbb6511.jpg",
    sortOrder: 2,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

type Product = {
  id: number;
  category: "beef" | "pork" | "lamb" | "poultry" | "seafood" | "other";
  name: string;
  cut: string;
  price: string;
  powerDropPrice?: string | null;
  unit: string;
  badge?: "LIMITED" | "POPULAR" | "NEW" | "SOLD OUT" | null;
  available: boolean;
  img?: string | null;
  sortOrder: number;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

interface DealsProps {
  onAddToCart: (product: {
    id: number;
    name: string;
    cut: string;
    price: number;
    powerDropPrice?: number | null;
    unit: string;
  }) => void;
  powerDropActive?: boolean;
}

export default function DealsSection({ onAddToCart, powerDropActive = false }: DealsProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: dbProducts, isLoading } = trpc.products.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  // Use DB products if available, otherwise show placeholders
  const allProducts: Product[] = (dbProducts && dbProducts.length > 0)
    ? (dbProducts as Product[])
    : PLACEHOLDER_PRODUCTS;

  const filtered = allProducts.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <section id="deals" className="section-paper py-20 md:py-28">
      <div className="container">
        {/* Receipt divider eyebrow */}
        <div className="receipt-divider mb-10">
          <span>Current Deals</span>
        </div>

        {/* Power Drop banner */}
        {powerDropActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-3 bg-[#c73e3a] text-[#f5f2ec] px-5 py-3"
          >
            <Zap size={16} className="shrink-0 fill-current" />
            <span className="font-display text-[11px] tracking-[0.2em]">
              POWER DROP ACTIVE — All products show special event pricing
            </span>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left sidebar — categories */}
          <aside className="lg:w-44 shrink-0">
            <div className="sticky top-20">
              <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-4">
                Category
              </p>
              <nav className="flex flex-row flex-wrap lg:flex-col gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`cat-tab text-left font-body text-[13px] font-medium px-3 py-2 transition-colors ${
                      activeCategory === cat.id
                        ? "active text-[#0a0a0a] bg-[#eae3d2]"
                        : "text-[#8a857c] hover:text-[#0a0a0a]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Right — search + grid */}
          <div className="flex-1 min-w-0">
            {/* Search */}
            <div className="relative mb-8 max-w-sm">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857c] w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full font-body text-[13px] bg-transparent border border-[#0a0a0a]/15 pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#c73e3a] transition-colors placeholder:text-[#8a857c]"
              />
            </div>

            {/* Count */}
            <p className="font-mono-brand text-[11px] text-[#8a857c] mb-6">
              {isLoading ? "Loading…" : `${filtered.length} product${filtered.length !== 1 ? "s" : ""}`}
            </p>

            {/* Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory + search}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                {filtered.map((product, i) => {
                  const regularPrice = parseFloat(product.price);
                  const pdPrice = product.powerDropPrice ? parseFloat(product.powerDropPrice) : null;
                  const showPowerDrop = powerDropActive && pdPrice != null;

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                      className={`product-card border border-[#0a0a0a]/12 bg-[#f5f2ec] flex flex-col ${
                        !product.available ? "opacity-50" : ""
                      } ${showPowerDrop ? "ring-1 ring-[#c73e3a]/40" : ""}`}
                    >
                      {/* Image */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#eae3d2]">
                        {product.img ? (
                          <img
                            src={product.img}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-display text-[10px] tracking-widest text-[#8a857c]">
                              {product.category.toUpperCase()}
                            </span>
                          </div>
                        )}
                        {/* Badge */}
                        {product.badge && product.badge !== "SOLD OUT" && (
                          <span
                            className={`absolute top-2 left-2 font-mono-brand text-[10px] tracking-wider px-2 py-0.5 ${
                              BADGE_STYLES[product.badge] || "bg-[#0a0a0a] text-[#f5f2ec]"
                            }`}
                          >
                            {product.badge}
                          </span>
                        )}
                        {/* Power Drop badge */}
                        {showPowerDrop && (
                          <span className="absolute top-2 right-2 flex items-center gap-1 font-mono-brand text-[10px] tracking-wider px-2 py-0.5 bg-[#c73e3a] text-[#f5f2ec]">
                            <Zap size={9} className="fill-current" />
                            POWER DROP
                          </span>
                        )}
                        {!product.available && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/40">
                            <span className="font-display text-[12px] tracking-widest text-[#f5f2ec] border border-[#f5f2ec]/50 px-3 py-1">
                              SOLD OUT
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-4 flex flex-col flex-1">
                        <p className="font-mono-brand text-[10px] text-[#8a857c] mb-1 uppercase tracking-wider">
                          {product.cut}
                        </p>
                        <h3 className="font-body text-[15px] font-bold text-[#0a0a0a] mb-3 leading-snug flex-1">
                          {product.name}
                        </h3>
                        <div className="flex items-end justify-between">
                          <div>
                            {showPowerDrop ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono-brand text-[13px] text-[#8a857c] line-through">
                                  ${regularPrice.toFixed(2)}
                                </span>
                                <div className="flex items-baseline gap-1">
                                  <span className="font-mono-brand text-[22px] font-bold text-[#c73e3a]">
                                    ${pdPrice!.toFixed(2)}
                                  </span>
                                  <span className="font-mono-brand text-[11px] text-[#8a857c]">
                                    {product.unit}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono-brand text-[22px] font-bold text-[#c73e3a]">
                                  ${regularPrice.toFixed(2)}
                                </span>
                                <span className="font-mono-brand text-[11px] text-[#8a857c]">
                                  {product.unit}
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (!product.available) return;
                              onAddToCart({
                                id: product.id,
                                name: product.name,
                                cut: product.cut,
                                price: regularPrice,
                                powerDropPrice: pdPrice,
                                unit: product.unit,
                              });
                              toast.success(`${product.name} added to cart`);
                            }}
                            disabled={!product.available}
                            className={`flex items-center gap-1.5 font-display text-[10px] tracking-widest px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[1.04] ${
                              showPowerDrop
                                ? "bg-[#c73e3a] text-[#f5f2ec] hover:bg-[#a83330]"
                                : "bg-[#0a0a0a] text-[#f5f2ec] hover:bg-[#c73e3a]"
                            }`}
                          >
                            {showPowerDrop ? (
                              <>
                                <Zap size={11} className="fill-current" />
                                Secure Power-Drop
                              </>
                            ) : (
                              <>
                                <ShoppingCart size={12} strokeWidth={1.5} />
                                Add
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {filtered.length === 0 && !isLoading && (
                  <div className="col-span-full py-16 text-center">
                    <p className="font-mono-brand text-[13px] text-[#8a857c]">
                      No products found.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
