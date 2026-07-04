/*
 * GROUPBUY Home Page
 * Design: "Butcher's Receipt" — Ink/Paper/Cream alternating sections
 * Sections: Announcement → Navbar → Hero → HowItWorks → Deals → Pickup → FAQ → Join → Footer
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { FlyToCartProvider } from "@/contexts/FlyToCartContext";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import DealsSection from "@/components/DealsSection";
import PickupSection from "@/components/PickupSection";
import FAQSection from "@/components/FAQSection";
import JoinSection from "@/components/JoinSection";
import Footer from "@/components/Footer";
import CartDrawer, { CartItem } from "@/components/CartDrawer";

export default function Home() {
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("groupbuy_cart");
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartBump, setCartBump] = useState(0);

  // Persist cart to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem("groupbuy_cart", JSON.stringify(cartItems));
    } catch {
      // storage full or unavailable — silently ignore
    }
  }, [cartItems]);

  // Fetch site-wide settings (announcement, power drop state)
  const { data: settings } = trpc.settings.getAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  const powerDropActive = settings?.powerDropActive === "true";
  const announcementActive = settings?.announcementActive !== "false";
  const announcementMessage =
    settings?.announcementMessage ??
    "New drop open now — Wagyu Ribeye MS7+ & Lamb Shoulder. Closes Thursday midnight.";

  const triggerCartBump = () => setCartBump((n) => n + 1);

  const handleAddToCart = (product: {
    id: number;
    name: string;
    cut: string;
    price: number;
    powerDropPrice?: number | null;
    retailPrice?: number | null;
    unit: string;
    category?: string;
    visibility?: "regular_only" | "always" | "power_drop_only";
  }) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      // Use Power Drop price when active and available
      const effectivePrice =
        powerDropActive && product.powerDropPrice != null
          ? product.powerDropPrice
          : product.price;
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          cut: product.cut,
          price: effectivePrice,
          regularPrice: product.price, // always store the base price for savings calc
          retailPrice: product.retailPrice ?? null, // RRP for savings comparison
          unit: product.unit,
          qty: 1,
          category: product.category,
          visibility: product.visibility,
        },
      ];
    });
    triggerCartBump();
  };

  const handleRemove = (id: number) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleQtyChange = (id: number, qty: number) => {
    setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  const handleNoteChange = (id: number, note: string) => {
    setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)));
  };

  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  return (
    <FlyToCartProvider>
    <div className="min-h-screen flex flex-col">
      {announcementActive && (
        <AnnouncementBanner
          message={announcementMessage}
          link={{ href: "#deals", label: "View Drop" }}
        />
      )}
      <Navbar
        cartCount={cartCount}
        onCartClick={() => setCartOpen(true)}
        powerDropActive={powerDropActive}
        cartBump={cartBump}
      />

      <main className="flex-1">
        <HeroSection powerDropActive={powerDropActive} powerDropActivatedAt={settings?.powerDropActivatedAt ?? ""} />
        <HowItWorksSection />
        <DealsSection onAddToCart={handleAddToCart} powerDropActive={powerDropActive} />
        <PickupSection />
        <FAQSection />
        <JoinSection />
      </main>

      <Footer />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckoutSuccess={() => {
          setCartItems([]);
          try { localStorage.removeItem("groupbuy_cart"); } catch {}
        }}
        items={cartItems}
        onRemove={handleRemove}
        onQtyChange={handleQtyChange}
        onNoteChange={handleNoteChange}
        powerDropActive={powerDropActive}
        powerDropActivatedAt={settings?.powerDropActivatedAt ?? ""}
      />
    </div>
    </FlyToCartProvider>
  );
}
