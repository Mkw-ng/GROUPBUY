/*
 * GROUPBUY Navbar
 * Design: Ink background, lockup-dark-red SVG logo, Inter Tight nav links
 * Behaviour: Sticky, slim (56px), red underline hover on links
 * Power Drop: pulsing red "POWER DROP LIVE" badge in right actions area
 */
import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, Menu, X, Zap } from "lucide-react";
import { useFlyToCart } from "@/contexts/FlyToCartContext";

const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Current Deals", href: "#deals" },
  { label: "Pickup Info", href: "#pickup" },
  { label: "Join Group", href: "#join" },
];

interface NavbarProps {
  cartCount?: number;
  onCartClick?: () => void;
  powerDropActive?: boolean;
  cartBump?: number; // increments each time a product is added
}

export default function Navbar({ cartCount = 0, onCartClick, powerDropActive = false, cartBump = 0 }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bumping, setBumping] = useState(false);
  const { setCartIconEl } = useFlyToCart();

  const cartBtnRef = useCallback((el: HTMLButtonElement | null) => {
    setCartIconEl(el);
  }, [setCartIconEl]);

  useEffect(() => {
    if (cartBump === 0) return;
    setBumping(false);
    // Force a reflow so the class re-triggers even on rapid adds
    requestAnimationFrame(() => {
      setBumping(true);
    });
    const t = setTimeout(() => setBumping(false), 450);
    return () => clearTimeout(t);
  }, [cartBump]);

  return (
    <header className="sticky top-0 z-50 section-ink border-b border-white/10">
      <div className="container flex items-center justify-between h-14">
        {/* Logo */}
        <a href="/" className="flex items-center shrink-0">
          <img
            src="/manus-storage/groupbuy-lockup-dark-red_898c2f9b.svg"
            alt="GROUPBUY"
            className="h-7 w-auto"
          />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-body text-[13px] font-medium text-[#f5f2ec]/70 hover:text-[#f5f2ec] transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#c73e3a] group-hover:w-full transition-all duration-200" />
            </a>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Power Drop live indicator */}
          {powerDropActive && (
            <a
              href="#deals"
              className="hidden md:flex items-center gap-1.5 font-display text-[10px] tracking-widest text-[#c73e3a] border border-[#c73e3a]/40 px-2.5 py-1 hover:bg-[#c73e3a]/10 transition-colors"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c73e3a] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#c73e3a]" />
              </span>
              <Zap size={10} className="fill-current" />
              POWER DROP
            </a>
          )}
          <a
            href="#deals"
            className="hidden md:inline-flex items-center gap-2 font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] px-4 py-2 hover:bg-[#a83330] transition-colors"
          >
            Order Now
          </a>
          <button
            ref={cartBtnRef}
            onClick={onCartClick}
            className="relative flex items-center justify-center w-9 h-9 text-[#f5f2ec]/70 hover:text-[#f5f2ec] transition-colors"
            aria-label="Cart"
          >
            <ShoppingCart
              size={18}
              strokeWidth={1.5}
              className={bumping ? "animate-cart-bump" : ""}
            />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#c73e3a] text-[#f5f2ec] font-mono-brand text-[10px] flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
          <button
            className="md:hidden text-[#f5f2ec]/70 hover:text-[#f5f2ec] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden section-ink border-t border-white/10">
          <nav className="container py-4 flex flex-col gap-1">
            {powerDropActive && (
              <div className="flex items-center gap-2 font-display text-[10px] tracking-widest text-[#c73e3a] py-2 border-b border-white/5 mb-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c73e3a] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#c73e3a]" />
                </span>
                <Zap size={10} className="fill-current" />
                POWER DROP LIVE
              </div>
            )}
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="font-body text-[14px] font-medium text-[#f5f2ec]/70 hover:text-[#f5f2ec] py-2.5 border-b border-white/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#deals"
              onClick={() => setMobileOpen(false)}
              className="mt-3 inline-flex items-center justify-center font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] px-4 py-3 hover:bg-[#a83330] transition-colors"
            >
              Order Now
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
