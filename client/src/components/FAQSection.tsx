/*
 * GROUPBUY About Section — "What GroupBuy Is"
 * Design: Cream background, large editorial heading, two-paragraph body copy
 * Replaces the old FAQ accordion
 */
import { motion } from "framer-motion";

export default function FAQSection() {
  return (
    <section id="about" className="section-cream py-20 md:py-28">
      <div className="container">
        {/* Receipt divider eyebrow */}
        <div className="receipt-divider mb-12">
          <span>What GroupBuy Is</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left — headline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] text-[#0a0a0a] leading-tight">
              The community<br />
              <span className="text-[#c73e3a]">deal.</span>
            </h2>
          </motion.div>

          {/* Right — body copy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="flex flex-col gap-6"
          >
            <p className="font-body text-[16px] leading-relaxed text-[#0a0a0a]/75">
              GroupBuy is the community deal. We buy in bulk, at wholesale prices, and pass the savings on. No markup magic, no clever math — just cartons, pallets and the phone numbers of people who pick up.
            </p>
            <p className="font-body text-[16px] leading-relaxed text-[#0a0a0a]/75">
              Think of us as a street-smart butcher with insider access. We know the game — who's overstocked, what's landing this week, which supplier got stuck with too much of a good thing. When that knowledge turns into a price, we share it.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
