/*
 * GROUPBUY Deals Section
 * Design: Paper background, left sidebar category nav, right product card grid
 * Product cards: border-ink, price in JetBrains Mono red, hover border-red
 * Category tabs: left-border red indicator for active state
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Search } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "all", label: "All Drops" },
  { id: "beef", label: "Beef" },
  { id: "pork", label: "Pork" },
  { id: "lamb", label: "Lamb" },
  { id: "poultry", label: "Poultry" },
  { id: "seafood", label: "Seafood" },
  { id: "other", label: "Other" },
];

const PRODUCTS = [
  {
    id: 1,
    category: "beef",
    name: "Full Blood Wagyu Ribeye",
    cut: "MS7+ · 300g avg",
    price: 42.00,
    unit: "/ steak",
    badge: "LIMITED",
    available: true,
    img: "/manus-storage/product-wagyu_70637951.jpg",
  },
  {
    id: 2,
    category: "beef",
    name: "Grass-Fed Scotch Fillet",
    cut: "250g avg",
    price: 18.50,
    unit: "/ steak",
    badge: null,
    available: true,
    img: "/manus-storage/product-ribeye_e4a87bad.jpg",
  },
  {
    id: 3,
    category: "beef",
    name: "Whole Brisket",
    cut: "3–4kg avg",
    price: 68.00,
    unit: "/ piece",
    badge: "POPULAR",
    available: true,
    img: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  },
  {
    id: 4,
    category: "pork",
    name: "Pork Belly Slab",
    cut: "Skin-on · 1.5kg avg",
    price: 22.00,
    unit: "/ kg",
    badge: null,
    available: true,
    img: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&q=80",
  },
  {
    id: 5,
    category: "pork",
    name: "Pork Shoulder Bone-In",
    cut: "2–3kg avg",
    price: 14.50,
    unit: "/ kg",
    badge: null,
    available: true,
    img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&q=80",
  },
  {
    id: 6,
    category: "lamb",
    name: "Lamb Shoulder Whole",
    cut: "Bone-in · 2kg avg",
    price: 28.00,
    unit: "/ piece",
    badge: "NEW",
    available: true,
    img: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=80",
  },
  {
    id: 7,
    category: "lamb",
    name: "French Rack of Lamb",
    cut: "8-bone · 700g avg",
    price: 38.00,
    unit: "/ rack",
    badge: "LIMITED",
    available: true,
    img: "/manus-storage/product-lamb_ecbb6511.jpg",
  },
  {
    id: 8,
    category: "poultry",
    name: "Free Range Whole Chicken",
    cut: "1.8kg avg",
    price: 16.00,
    unit: "/ bird",
    badge: null,
    available: true,
    img: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&q=80",
  },
  {
    id: 9,
    category: "seafood",
    name: "Wild-Caught King Prawns",
    cut: "1kg bag · shell-on",
    price: 34.00,
    unit: "/ kg",
    badge: "POPULAR",
    available: true,
    img: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&q=80",
  },
  {
    id: 10,
    category: "beef",
    name: "Beef Short Ribs",
    cut: "Plate cut · 1.2kg avg",
    price: 32.00,
    unit: "/ pack",
    badge: null,
    available: false,
    img: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&q=80",
  },
  {
    id: 11,
    category: "other",
    name: "Bone Broth Bones",
    cut: "Mixed · 2kg bag",
    price: 12.00,
    unit: "/ bag",
    badge: null,
    available: true,
    img: "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80",
  },
  {
    id: 12,
    category: "poultry",
    name: "Duck Breast",
    cut: "2 x 200g avg",
    price: 24.00,
    unit: "/ pack",
    badge: "NEW",
    available: true,
    img: "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=400&q=80",
  },
];

const BADGE_STYLES: Record<string, string> = {
  LIMITED: "bg-[#c73e3a] text-[#f5f2ec]",
  POPULAR: "bg-[#0a0a0a] text-[#f5f2ec]",
  NEW: "border border-[#0a0a0a] text-[#0a0a0a]",
};

interface DealsProps {
  onAddToCart: (product: typeof PRODUCTS[0]) => void;
}

export default function DealsSection({ onAddToCart }: DealsProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = PRODUCTS.filter((p) => {
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
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857c]" strokeWidth={1.5} />
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
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
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
                {filtered.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={`product-card border border-[#0a0a0a]/12 bg-[#f5f2ec] flex flex-col ${
                      !product.available ? "opacity-50" : ""
                    }`}
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#eae3d2]">
                      <img
                        src={product.img}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Badge */}
                      {product.badge && (
                        <span
                          className={`absolute top-2 left-2 font-mono-brand text-[10px] tracking-wider px-2 py-0.5 ${
                            BADGE_STYLES[product.badge] || "bg-[#0a0a0a] text-[#f5f2ec]"
                          }`}
                        >
                          {product.badge}
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
                      <h3 className="font-body text-[15px] font-700 text-[#0a0a0a] mb-3 leading-snug flex-1">
                        {product.name}
                      </h3>
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="font-mono-brand text-[22px] font-bold text-[#c73e3a]">
                            ${product.price.toFixed(2)}
                          </span>
                          <span className="font-mono-brand text-[11px] text-[#8a857c] ml-1">
                            {product.unit}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (!product.available) return;
                            onAddToCart(product);
                            toast.success(`${product.name} added to cart`);
                          }}
                          disabled={!product.available}
                          className="flex items-center gap-1.5 font-display text-[10px] tracking-widest bg-[#0a0a0a] text-[#f5f2ec] px-3 py-2 hover:bg-[#c73e3a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[1.04]"
                        >
                          <ShoppingCart size={12} strokeWidth={1.5} />
                          Add
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {filtered.length === 0 && (
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
