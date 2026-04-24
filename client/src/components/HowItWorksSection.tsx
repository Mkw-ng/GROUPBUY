/*
 * GROUPBUY How It Works Section
 * Design: Cream background, 4-step horizontal layout
 * Step numbers in JetBrains Mono red, descriptions in Inter Tight
 * Receipt-strip eyebrow divider
 */
import { motion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    title: "Browse the Drop",
    desc: "Check current deals on the site. New drops open weekly — beef, pork, lamb, poultry, seafood.",
  },
  {
    num: "02",
    title: "Join the WhatsApp",
    desc: "Get notified the moment a drop opens. No WhatsApp, no deal — that's how the group works.",
  },
  {
    num: "03",
    title: "Confirm & Pay",
    desc: "Add to cart and pay via bank transfer or card. Orders lock in 48 hours before pickup.",
  },
  {
    num: "04",
    title: "Pickup Saturday",
    desc: "Collect your order from the Lyndhurst pickup point. Bring a bag. Bring a friend.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section-cream py-20 md:py-28">
      <div className="container">
        {/* Receipt divider eyebrow */}
        <div className="receipt-divider mb-12">
          <span>How It Works</span>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="border-t-2 border-[#0a0a0a] pt-6 pr-8 pb-8 lg:border-r lg:border-r-[#0a0a0a]/10 last:border-r-0"
            >
              <span className="font-mono-brand text-[13px] font-bold text-[#c73e3a] block mb-4">
                {step.num}
              </span>
              <h3 className="font-display text-[14px] tracking-wider text-[#0a0a0a] mb-3">
                {step.title}
              </h3>
              <p className="font-body text-[14px] leading-relaxed text-[#0a0a0a]/60">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
