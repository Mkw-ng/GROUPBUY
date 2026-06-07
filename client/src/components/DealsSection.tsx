/*
 * GROUPBUY Deals Section
 * Design: Paper background, left sidebar category nav, right product card grid
 * Product cards: border-ink, price in JetBrains Mono red, hover border-red
 * Category tabs: left-border red indicator for active state
 * Power Drop: crossed-out original price + red Power Drop price, button changes to "Secure Power-Drop ⚡"
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useFlyToCart } from "@/contexts/FlyToCartContext";
import ShareDealButton from "@/components/ShareDealButton";

const CATEGORIES = [
  { id: "all",               label: "All Drops" },
  { id: "limited-offer",     label: "Limited Offer" },
  { id: "featured-deals",    label: "Featured Deals" },
  { id: "m3atfr3ak",         label: "M3ATFR3AK" },
  { id: "beef",              label: "Beef" },
  { id: "pork",              label: "Pork" },
  { id: "lamb",              label: "Lamb" },
  { id: "poultry",           label: "Poultry" },
  { id: "seafood",           label: "Seafood" },
  { id: "whole-slabs",       label: "Whole Slabs" },
  { id: "whole-animal",      label: "Whole Animal & Sides" },
  { id: "box-deals",         label: "Box Deals" },
  { id: "mince",             label: "Mince" },
  { id: "offal-tallow",      label: "Offal & Tallow" },
  { id: "value-added",       label: "Value Added" },
  { id: "korean-bbq-hotpot", label: "Korean BBQ / Hotpot" },
  { id: "freezer",           label: "Freezer" },
  { id: "other",             label: "Other" },
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
  retailPrice?: string | null;
  unit: string;
  badge?: "LIMITED" | "POPULAR" | "NEW" | "SOLD OUT" | null;
  available: boolean;
  img?: string | null;
  sortOrder: number;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Server-computed stock fields — null when no limit is set */
  stockLimit?: string | null;
  orderedQty?: number;
  remainingQty?: number | null;
  isSoldOutByStock?: boolean;
};

interface DealsProps {
  onAddToCart: (product: {
    id: number;
    name: string;
    cut: string;
    price: number;
    powerDropPrice?: number | null;
    retailPrice?: number | null;
    unit: string;
  }) => void;
  powerDropActive?: boolean;
}

// ── Stock quantity label helper ─────────────────────────────────────────────
function formatRemainingQty(value: number, unit: string): string {
  const isKg = (unit ?? "").toLowerCase().includes("kg");
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
  return isKg ? `${formatted}kg left` : `${formatted} left`;
}

// ── PowerDropButton with ripple effect ──────────────────────────────────────
interface PowerDropButtonProps {
  showPowerDrop: boolean;
  available: boolean;
  soldOut: boolean;
  onAdd: () => void;
  onFlyTrigger?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function PowerDropButton({ showPowerDrop, available, soldOut, onAdd, onFlyTrigger }: PowerDropButtonProps) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const nextId = useRef(0);
  const isDisabled = !available || soldOut;

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = nextId.current++;
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    }
    onFlyTrigger?.(e);
    onAdd();
  }, [isDisabled, onAdd, onFlyTrigger]);

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      disabled={isDisabled}
      className={`relative overflow-hidden flex items-center gap-1.5 font-display text-[10px] tracking-widest px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        showPowerDrop
          ? "bg-[#c73e3a] text-[#f5f2ec] hover:bg-[#a83330]"
          : "bg-[#0a0a0a] text-[#f5f2ec] hover:bg-[#c73e3a]"
      }`}
    >
      {/* Ripple bursts */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full animate-pd-ripple"
          style={{
            left: r.x,
            top: r.y,
            width: 8,
            height: 8,
            marginLeft: -4,
            marginTop: -4,
            background: showPowerDrop ? "rgba(255,255,255,0.55)" : "rgba(199,62,58,0.55)",
          }}
        />
      ))}
      {soldOut ? (
        <>SOLD OUT</>
      ) : showPowerDrop ? (
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
  );
}

export default function DealsSection({ onAddToCart, powerDropActive = false }: DealsProps) {
  const [activeCategory, setActiveCategory] = useState("limited-offer");
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const { triggerFly } = useFlyToCart();

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

  // Predictive suggestions: match on name, cut, or category (max 6)
  const suggestions = search.trim().length > 0
    ? allProducts
        .filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.cut.toLowerCase().includes(search.toLowerCase()) ||
          p.category.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 6)
    : [];

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIdx(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Highlight helper — wraps matching text in a span
  const highlight = (text: string, query: string) => {
    if (!query.trim()) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[#c73e3a]/20 text-[#c73e3a] font-semibold not-italic">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // Scroll to and flash a product card
  const scrollToProduct = (productId: number) => {
    const el = document.querySelector(`[data-product-id="${productId}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#c73e3a]", "ring-offset-2");
    setTimeout(() => el.classList.remove("ring-2", "ring-[#c73e3a]", "ring-offset-2"), 1500);
  };

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
            <div className="relative mb-8 max-w-sm" ref={searchWrapperRef}>
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
                ref={searchInputRef}
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                  setHighlightedIdx(-1);
                }}
                onFocus={() => { if (search.trim()) setShowSuggestions(true); }}
                onKeyDown={(e) => {
                  if (!showSuggestions || suggestions.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIdx(i => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIdx(i => Math.max(i - 1, -1));
                  } else if (e.key === "Enter" && highlightedIdx >= 0) {
                    e.preventDefault();
                    const p = suggestions[highlightedIdx];
                    setSearch(p.name);
                    setShowSuggestions(false);
                    setHighlightedIdx(-1);
                    // Switch to the product's category if needed
                    setActiveCategory("all");
                    setTimeout(() => scrollToProduct(p.id), 100);
                  } else if (e.key === "Escape") {
                    setShowSuggestions(false);
                    setHighlightedIdx(-1);
                  }
                }}
                className="w-full font-body text-[13px] bg-transparent border border-[#0a0a0a]/15 pl-9 pr-8 py-2.5 focus:outline-none focus:border-[#c73e3a] transition-colors placeholder:text-[#8a857c]"
                autoComplete="off"
              />
              {search && (
                <button
                  onMouseDown={(e) => {
                    // Prevent the input from losing focus when clicking the clear button
                    e.preventDefault();
                    setSearch("");
                    setShowSuggestions(false);
                    setHighlightedIdx(-1);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a857c] hover:text-[#c73e3a] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {/* Predictive suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-[#0a0a0a]/15 bg-[#f5f2ec] shadow-lg overflow-hidden">
                  {suggestions.map((p, idx) => {
                    const regPrice = parseFloat(p.price);
                    const pdPrice = p.powerDropPrice ? parseFloat(p.powerDropPrice) : null;
                    const showPD = powerDropActive && pdPrice != null;
                    return (
                      <button
                        key={p.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearch(p.name);
                          setShowSuggestions(false);
                          setHighlightedIdx(-1);
                          setActiveCategory("all");
                          setTimeout(() => scrollToProduct(p.id), 100);
                        }}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-[#0a0a0a]/8 last:border-b-0 transition-colors ${
                          idx === highlightedIdx ? "bg-[#eae3d2]" : "hover:bg-[#eae3d2]"
                        }`}
                      >
                        {/* Thumbnail */}
                        {p.img ? (
                          <img src={p.img} alt={p.name} className="w-9 h-9 object-cover shrink-0 border border-[#0a0a0a]/10" />
                        ) : (
                          <div className="w-9 h-9 bg-[#eae3d2] shrink-0 flex items-center justify-center border border-[#0a0a0a]/10">
                            <span className="font-display text-[8px] text-[#8a857c]">{p.category.slice(0,3).toUpperCase()}</span>
                          </div>
                        )}
                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[13px] font-semibold text-[#0a0a0a] truncate">
                            {highlight(p.name, search)}
                          </p>
                          <p className="font-mono-brand text-[10px] text-[#8a857c] truncate">
                            {highlight(p.cut, search)}
                          </p>
                        </div>
                        {/* Price */}
                        <div className="shrink-0 text-right">
                          {showPD ? (
                            <>
                              <p className="font-mono-brand text-[10px] text-[#8a857c] line-through">${regPrice.toFixed(2)}</p>
                              <p className="font-mono-brand text-[13px] font-bold text-[#c73e3a]">${pdPrice!.toFixed(2)}</p>
                            </>
                          ) : (
                            <p className="font-mono-brand text-[13px] font-bold text-[#c73e3a]">${regPrice.toFixed(2)}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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
                className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"
              >
                {filtered.map((product, i) => {
                  const regularPrice = parseFloat(product.price);
                  const pdPrice = product.powerDropPrice ? parseFloat(product.powerDropPrice) : null;
                  const retailPrice = product.retailPrice ? parseFloat(product.retailPrice) : null;
                  // Use retailPrice as the comparison baseline when set, otherwise fall back to regularPrice
                  const comparisonPrice = retailPrice ?? regularPrice;
                  const showPowerDrop = powerDropActive && pdPrice != null;
                  const savingsPct = (showPowerDrop && pdPrice != null && pdPrice < comparisonPrice)
                    ? Math.round(((comparisonPrice - pdPrice) / comparisonPrice) * 100)
                    : null;
                  // Stock limit UI
                  const isSoldOutByStock = !!(product as { isSoldOutByStock?: boolean }).isSoldOutByStock;
                  const remainingQty = (product as { remainingQty?: number | null }).remainingQty ?? null;
                  const stockLimit = (product as { stockLimit?: string | null }).stockLimit;
                  const hasStockLimit = stockLimit != null;
                  const isKgUnit = (product.unit ?? "").toLowerCase().includes("kg");
                  const soldOut = !product.available || isSoldOutByStock;

                  return (
                    <motion.div
                      key={product.id}
                      data-product-id={product.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                      className={`product-card group border border-[#0a0a0a]/12 bg-[#f5f2ec] flex flex-col ${
                        !product.available ? "opacity-50" : ""
                      } ${showPowerDrop ? "ring-1 ring-[#c73e3a]/40" : ""}`}
                    >
                      {/* Image */}
                      <div className="product-img relative aspect-[4/3] overflow-hidden bg-[#eae3d2]">
                        {product.img ? (
                          <img
                            src={product.img}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
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
                          <span className="pd-badge absolute top-2 right-2 flex items-center gap-1 font-mono-brand text-[10px] tracking-wider px-2 py-0.5 bg-[#c73e3a] text-[#f5f2ec]">
                            <Zap size={9} className="fill-current" />
                            {savingsPct != null ? `SAVE ${savingsPct}%` : "POWER DROP"}
                          </span>
                        )}
                        {soldOut && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/40">
                            <span className="font-display text-[12px] tracking-widest text-[#f5f2ec] border border-[#f5f2ec]/50 px-3 py-1">
                              SOLD OUT
                            </span>
                          </div>
                        )}
                        {/* Stock remaining badge — only when not sold out and close to limit */}
                        {!soldOut && hasStockLimit && remainingQty != null && remainingQty <= parseFloat(stockLimit!) * 0.25 && (
                          <span className="absolute bottom-2 left-2 font-mono-brand text-[9px] tracking-wider px-2 py-0.5 bg-[#c73e3a] text-[#f5f2ec]">
                            {remainingQty <= 0 ? "SOLD OUT" : `${remainingQty.toFixed(isKgUnit ? 1 : 0)}${isKgUnit ? "kg" : ""} left`}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2 sm:p-4 flex flex-col flex-1">
                        <p className="font-mono-brand text-[9px] sm:text-[10px] text-[#8a857c] mb-0.5 sm:mb-1 uppercase tracking-wider">
                          {product.cut}
                        </p>
                        <h3 className="font-body text-[12px] sm:text-[15px] font-bold text-[#0a0a0a] mb-1.5 sm:mb-3 leading-snug flex-1 line-clamp-2">
                          {product.name}
                        </h3>
                        {/* Stock availability label */}
                        {hasStockLimit && (
                          <p className={`font-mono-brand text-[9px] sm:text-[10px] uppercase tracking-wider mb-1 sm:mb-1.5 ${
                            soldOut ? "text-[#c73e3a]" : remainingQty != null && remainingQty <= 5 ? "text-amber-500" : "text-emerald-600"
                          }`}>
                            {soldOut
                              ? "SOLD OUT"
                              : remainingQty != null
                                ? formatRemainingQty(remainingQty, product.unit)
                                : null}
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 sm:gap-2">
                          <div>
                            {showPowerDrop ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono-brand text-[13px] text-[#8a857c] line-through">
                                  ${comparisonPrice.toFixed(2)}
                                </span>
                                <div className="flex items-baseline gap-1">
                                  <span className="font-mono-brand text-[16px] sm:text-[22px] font-bold text-[#c73e3a]">
                                    ${pdPrice!.toFixed(2)}
                                  </span>
                                  <span className="font-mono-brand text-[11px] text-[#8a857c]">
                                    {product.unit}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono-brand text-[16px] sm:text-[22px] font-bold text-[#c73e3a]">
                                  ${regularPrice.toFixed(2)}
                                </span>
                                <span className="font-mono-brand text-[11px] text-[#8a857c]">
                                  {product.unit}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <PowerDropButton
                              showPowerDrop={showPowerDrop}
                              available={product.available}
                              soldOut={soldOut}
                              onFlyTrigger={() => {
                                // Find the product image element inside this card
                                const cardEl = document.querySelector(
                                  `[data-product-id="${product.id}"] .product-img`
                                ) as HTMLElement | null;
                                const imgSrc = product.img ?? "";
                                const sourceRect = cardEl
                                  ? cardEl.getBoundingClientRect()
                                  : (document.querySelector(`[data-product-id="${product.id}"]`) as HTMLElement | null)?.getBoundingClientRect() ?? new DOMRect();
                                triggerFly(imgSrc, sourceRect);
                              }}
                              onAdd={() => {
                                onAddToCart({
                                  id: product.id,
                                  name: product.name,
                                  cut: product.cut,
                                  price: regularPrice,
                                  powerDropPrice: pdPrice,
                                  retailPrice: retailPrice,
                                  unit: product.unit,
                                });
                                toast.success(`${product.name} added to cart`);
                              }}
                            />
                            <ShareDealButton
                              productName={product.name}
                              price={`$${(showPowerDrop && pdPrice != null ? pdPrice : regularPrice).toFixed(2)}${product.unit}`}
                              isPowerDrop={showPowerDrop}
                            />
                          </div>
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

            {/* Mobile-only: jump back to top of deals section */}
            {filtered.length > 0 && !isLoading && (
              <div className="lg:hidden flex justify-center mt-8">
                <button
                  onClick={() => {
                    const dealsSection = document.getElementById("deals");
                    if (dealsSection) {
                      dealsSection.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest border border-[#0a0a0a]/20 text-[#8a857c] px-5 py-3 hover:border-[#c73e3a] hover:text-[#c73e3a] transition-colors active:scale-95"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  Back to Top
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
