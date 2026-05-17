/*
 * GROUPBUY Order Success Page
 * Design: "Butcher's Receipt" — Ink background, cream receipt card
 * Shows: order summary, next steps, WhatsApp retry link, back to deals button
 * Data: read from sessionStorage key "groupbuy_last_order" set by CartDrawer on checkout
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, MessageCircle, ArrowLeft, Zap, MapPin, Calendar, Phone } from "lucide-react";

interface OrderSummaryItem {
  name: string;
  cut: string;
  qty: number;
  price: number;
  unit: string;
}

interface OrderSummary {
  phone: string;
  pickupDate: string;
  location: string;
  deliveryAddress?: string;
  items: OrderSummaryItem[];
  total: number;
  isPowerDrop: boolean;
  whatsappUrl: string;
  timestamp: number;
}

const LOCATION_LABELS: Record<string, string> = {
  cranbourne: "Cranbourne",
  clayton: "Clayton",
  delivery: "Delivery",
};

const NEXT_STEPS = [
  {
    step: "01",
    title: "Check WhatsApp",
    body: "Your order message has been sent to our WhatsApp. If it didn't open automatically, use the button below to resend.",
  },
  {
    step: "02",
    title: "Receive Your Invoice",
    body: "We'll send your invoice via WhatsApp within 24 hours. Check your messages and confirm the items.",
  },
  {
    step: "03",
    title: "Pay Before Cut-Off",
    body: "Send your bank transfer or card payment before the Saturday night cut-off to lock in your order.",
  },
  {
    step: "04",
    title: "Collect Your Order",
    body: "Pick up at your selected location on the scheduled date. Bring your order number (your phone number).",
  },
];

export default function OrderSuccess() {
  const [order, setOrder] = useState<OrderSummary | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("groupbuy_last_order");
      if (raw) setOrder(JSON.parse(raw) as OrderSummary);
    } catch {
      // ignore parse errors
    }
  }, []);

  const locationLabel = order
    ? order.location === "delivery"
      ? `Delivery — ${order.deliveryAddress ?? ""}`
      : (LOCATION_LABELS[order.location] ?? order.location)
    : "";

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-display text-[10px] tracking-widest text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
            <ArrowLeft size={12} />
            BACK TO DEALS
        </Link>
        <div className="flex-1" />
        <span className="font-display text-[10px] tracking-widest text-[#8a857c]">GROUPBUY</span>
      </div>

      <div className="flex-1 container py-12 md:py-20 max-w-2xl mx-auto px-4">
        {/* Success header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#4caf50]/40 bg-[#4caf50]/10 mb-5">
            <CheckCircle2 size={32} className="text-[#4caf50]" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-[clamp(1.8rem,5vw,3rem)] leading-tight text-[#f5f2ec] mb-3">
            ORDER SENT
          </h1>
          <p className="font-body text-[14px] text-[#8a857c] max-w-sm mx-auto leading-relaxed">
            Your order has been sent to our WhatsApp. We'll be in touch shortly with your invoice.
          </p>
          {order?.isPowerDrop && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-[#c73e3a]/40 bg-[#c73e3a]/10">
              <Zap size={12} className="text-[#c73e3a]" />
              <span className="font-display text-[10px] tracking-widest text-[#c73e3a]">POWER DROP PRICING APPLIED</span>
            </div>
          )}
        </motion.div>

        {/* Receipt card */}
        {order && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-[#f5f2ec] text-[#0a0a0a] mb-8"
          >
            {/* Receipt header */}
            <div className="border-b border-[#0a0a0a]/15 px-6 py-5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-display text-[10px] tracking-widest text-[#5a5550]">ORDER CONFIRMATION</span>
                <span className="font-mono-brand text-[10px] text-[#5a5550]">
                  {new Date(order.timestamp).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="font-display text-[11px] tracking-widest text-[#0a0a0a]">GROUPBUY</div>
            </div>

            {/* Order details */}
            <div className="px-6 py-4 border-b border-[#0a0a0a]/10 space-y-3">
              <div className="flex items-start gap-3">
                <Phone size={12} className="text-[#5a5550] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-display text-[9px] tracking-widest text-[#5a5550] mb-0.5">ORDER NUMBER</div>
                  <div className="font-mono-brand text-[13px] text-[#0a0a0a]">{order.phone}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={12} className="text-[#5a5550] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-display text-[9px] tracking-widest text-[#5a5550] mb-0.5">PICKUP / DELIVERY DATE</div>
                  <div className="font-mono-brand text-[13px] text-[#0a0a0a]">{order.pickupDate}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={12} className="text-[#5a5550] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-display text-[9px] tracking-widest text-[#5a5550] mb-0.5">LOCATION</div>
                  <div className="font-mono-brand text-[13px] text-[#0a0a0a]">{locationLabel}</div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="px-6 py-4 border-b border-[#0a0a0a]/10">
              <div className="font-display text-[9px] tracking-widest text-[#5a5550] mb-3">ITEMS</div>
              <div className="space-y-2">
                {order.items.map((item, i) => {
                  const cleanUnit = item.unit.replace(/^\/\s*/, "");
                  const qtyStr = item.qty % 1 === 0 ? String(item.qty) : item.qty.toFixed(1);
                  return (
                    <div key={i} className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono-brand text-[12px] text-[#0a0a0a] leading-snug">{item.name}</div>
                        <div className="font-mono-brand text-[10px] text-[#5a5550]">{item.cut} · {qtyStr} {cleanUnit}</div>
                      </div>
                      <div className="font-mono-brand text-[12px] text-[#0a0a0a] flex-shrink-0">
                        ${(item.price * item.qty).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total */}
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="font-display text-[11px] tracking-widest text-[#0a0a0a]">TOTAL (ESTIMATE)</span>
              <span className="font-mono-brand text-[20px] font-bold text-[#0a0a0a]">${order.total.toFixed(2)}</span>
            </div>

            {/* Receipt footer */}
            <div className="border-t border-dashed border-[#0a0a0a]/20 px-6 py-4 text-center">
              <p className="font-mono-brand text-[10px] text-[#5a5550]">
                Final total confirmed on invoice · Payment by bank transfer or card
              </p>
            </div>
          </motion.div>
        )}

        {/* WhatsApp retry button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-10"
        >
          {order?.whatsappUrl ? (
            <a
              href={order.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] py-4 hover:bg-[#a83330] transition-colors mb-3"
            >
              <MessageCircle size={14} strokeWidth={1.5} />
              OPEN IN WHATSAPP
            </a>
          ) : (
            <Link href="/" className="w-full flex items-center justify-center gap-2 font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] py-4 hover:bg-[#a83330] transition-colors mb-3">
                <ArrowLeft size={14} strokeWidth={1.5} />
                BACK TO DEALS
            </Link>
          )}
          <p className="font-mono-brand text-[10px] text-[#5a5550] text-center">
            If WhatsApp didn't open automatically, tap the button above to resend your order.
          </p>
        </motion.div>

        {/* Next steps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="font-display text-[10px] tracking-widest text-[#8a857c] mb-5">WHAT HAPPENS NEXT</div>
          <div className="space-y-4">
            {NEXT_STEPS.map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 border border-[#c73e3a]/40 flex items-center justify-center">
                  <span className="font-mono-brand text-[10px] text-[#c73e3a]">{s.step}</span>
                </div>
                <div>
                  <div className="font-display text-[11px] tracking-widest text-[#f5f2ec] mb-1">{s.title.toUpperCase()}</div>
                  <p className="font-body text-[13px] text-[#8a857c] leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-3"
        >
          <Link href="/" className="flex-1 flex items-center justify-center gap-2 font-display text-[11px] tracking-widest border border-[#f5f2ec]/20 text-[#f5f2ec]/60 py-3.5 hover:border-[#f5f2ec]/40 hover:text-[#f5f2ec] transition-colors">
              <ArrowLeft size={12} />
              BACK TO DEALS
          </Link>
          <Link href="/my-stats" className="flex-1 flex items-center justify-center gap-2 font-display text-[11px] tracking-widest border border-[#f5f2ec]/20 text-[#f5f2ec]/60 py-3.5 hover:border-[#f5f2ec]/40 hover:text-[#f5f2ec] transition-colors">
              CHECK MY STATS
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
