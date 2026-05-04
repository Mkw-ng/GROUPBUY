/*
 * GROUPBUY Join Section
 * Design: Ink background, centred CTA, G-mark watermark
 * Two actions: WhatsApp join + View Deals
 */
import { motion } from "framer-motion";
import { MessageCircle, ArrowRight } from "lucide-react";

export default function JoinSection() {
  return (
    <section id="join" className="section-ink py-24 md:py-32 relative overflow-hidden">
      {/* G-mark watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <img
          src="/manus-storage/groupbuy-gmark-dark_d5ad0418.svg"
          alt=""
          className="w-[80vw] max-w-[600px] opacity-[0.04]"
        />
      </div>

      <div className="container relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="font-display text-[11px] tracking-[0.3em] text-[#c73e3a] mb-6"
        >
          Free to Join
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-display text-[clamp(2rem,5vw,4rem)] text-[#f5f2ec] mb-6 leading-tight"
        >
          12,600+ members<br />
          <span className="text-[#c73e3a]">can't be wrong.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="font-body text-[15px] text-[#f5f2ec]/55 max-w-md mx-auto mb-10"
        >
          Join the WhatsApp group to get notified the moment a new drop opens. No spam. No fees. Just deals.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="flex flex-wrap gap-3 justify-center"
        >
          <a
            href="https://wa.me/61407249272"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] px-7 py-4 hover:bg-[#a83330] transition-colors"
          >
            <MessageCircle size={14} strokeWidth={1.5} />
            Join WhatsApp Group
          </a>
          <a
            href="#deals"
            className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest border border-[#f5f2ec]/25 text-[#f5f2ec]/70 px-7 py-4 hover:border-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors"
          >
            Browse Deals
            <ArrowRight size={14} strokeWidth={1.5} />
          </a>
          <a
            href="/my-stats"
            className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest border border-[#f5f2ec]/25 text-[#f5f2ec]/70 px-7 py-4 hover:border-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors"
          >
            ⭐ Check My Stats
          </a>
        </motion.div>
      </div>
    </section>
  );
}
