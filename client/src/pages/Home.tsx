/*
 * GROUPBUY Home Page
 * Design: "Butcher's Receipt" — Ink/Paper/Cream alternating sections
 * Sections: Announcement → Navbar → Hero → HowItWorks → Deals → Pickup → FAQ → Join → Footer
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Fetch site-wide settings (announcement, power drop state)
  const { data: settings } = trpc.settings.getAll.useQuery(undefined, {
    staleTime: 30_000,
  });

  const powerDropActive = settings?.powerDropActive === "true";
  const announcementActive = settings?.announcementActive !== "false";
  const announcementMessage =
    settings?.announcementMessage ??
    "New drop open now — Wagyu Ribeye MS7+ & Lamb Shoulder. Closes Thursday midnight.";

  const handleAddToCart = (product: {
    id: number;
    name: string;
    cut: string;
    price: number;
    powerDropPrice?: number | null;
    unit: string;
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
          unit: product.unit,
          qty: 1,
        },
      ];
    });
  };

  const handleRemove = (id: number) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleQtyChange = (id: number, qty: number) => {
    setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  return (
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
        items={cartItems}
        onRemove={handleRemove}
        onQtyChange={handleQtyChange}
        powerDropActive={powerDropActive}
        powerDropActivatedAt={settings?.powerDropActivatedAt ?? ""}
      />
    </div>
  );
}
