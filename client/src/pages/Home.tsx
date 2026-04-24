/*
 * GROUPBUY Home Page
 * Design: "Butcher's Receipt" — Ink/Paper/Cream alternating sections
 * Sections: Announcement → Navbar → Hero → HowItWorks → Deals → Pickup → FAQ → Join → Footer
 */
import { useState } from "react";
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

  const handleAddToCart = (product: { id: number; name: string; cut: string; price: number; unit: string }) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const handleRemove = (id: number) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleQtyChange = (id: number, qty: number) => {
    setCartItems((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBanner
        message="New drop open now — Wagyu Ribeye MS7+ & Lamb Shoulder. Closes Thursday midnight."
        link={{ href: "#deals", label: "View Drop" }}
      />
      <Navbar cartCount={cartCount} onCartClick={() => setCartOpen(true)} />

      <main className="flex-1">
        <HeroSection />
        <HowItWorksSection />
        <DealsSection onAddToCart={handleAddToCart} />
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
      />
    </div>
  );
}
