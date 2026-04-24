/*
 * GROUPBUY FAQ Section
 * Design: Cream background, accordion with thin border dividers
 * Question in Inter Tight 700, answer in Inter Tight 400
 * Active state: left red border indicator
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const FAQS = [
  {
    q: "How does the group buy work?",
    a: "We pool orders from members across Melbourne's South East to buy in bulk directly from suppliers. Because we're buying in volume, we get prices that would normally only be available to restaurants and wholesalers. You get the savings, we handle the logistics.",
  },
  {
    q: "Do I need to be a member to order?",
    a: "There's no paid membership. You just need to be in our WhatsApp group to get notified when a drop opens. Join via the link on this page — it's free and you can leave any time.",
  },
  {
    q: "How do I pay?",
    a: "We accept bank transfer (preferred) and card payments. Full payment is required to confirm your order. You'll receive a confirmation with payment details after adding to cart.",
  },
  {
    q: "What if I miss the pickup window?",
    a: "Unfortunately we can't hold orders after the pickup window closes. If you know you'll be late, message us in advance and we'll do our best to accommodate — but we can't guarantee it.",
  },
  {
    q: "Are the products fresh or frozen?",
    a: "Most products are fresh and chilled. Some items (particularly seafood and certain cuts) may be vacuum-sealed and frozen for quality. This is noted on each product listing.",
  },
  {
    q: "What areas do you cover?",
    a: "Pickup is at our Lyndhurst location. We service the South East corridor — Cranbourne, Berwick, Narre Warren, Pakenham, Clyde, Officer and surrounding suburbs. No delivery at this stage.",
  },
  {
    q: "Can I cancel or change my order?",
    a: "Orders can be modified or cancelled up to 48 hours before the pickup date. After that, orders are locked in as we've already placed the bulk order with our supplier.",
  },
  {
    q: "How often do new drops happen?",
    a: "We run drops most weeks, though the products change based on what's available and what the group has requested. Join the WhatsApp to get notified the moment a new drop opens.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="section-cream py-20 md:py-28">
      <div className="container">
        {/* Receipt divider eyebrow */}
        <div className="receipt-divider mb-12">
          <span>FAQ</span>
        </div>

        <div className="max-w-3xl">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className={`border-b border-[#0a0a0a]/12 ${open === i ? "border-l-2 border-l-[#c73e3a] pl-4" : ""}`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-body text-[15px] font-bold text-[#0a0a0a]">
                  {faq.q}
                </span>
                <span className="shrink-0 text-[#8a857c]">
                  {open === i ? (
                    <Minus size={16} strokeWidth={1.5} />
                  ) : (
                    <Plus size={16} strokeWidth={1.5} />
                  )}
                </span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="font-body text-[14px] leading-relaxed text-[#0a0a0a]/65 pb-5">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
