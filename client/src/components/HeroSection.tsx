/*
 * GROUPBUY Hero Section
 * Design: Full-bleed Ink, hero background meat photography, left-aligned Orbitron headline
 * G-mark watermark at low opacity, stat row in JetBrains Mono
 * CTA: "View Current Deals" (red fill) + "Join WhatsApp" (outline)
 */
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";

const STATS = [
  { value: "12,600+", label: "Members" },
  { value: "4 yrs", label: "Running" },
  { value: "$0", label: "Membership" },
  { value: "Sat", label: "Pickup Day" },
];

export default function HeroSection() {
  return (
    <section className="section-ink relative overflow-hidden min-h-[88vh] flex flex-col justify-center">
      {/* Hero background image */}
      <div
        className="absolute inset-0 pointer-events-none select-none"
        aria-hidden="true"
      >
        <img
          src="/manus-storage/hero-bg_8ba12c35.jpg"
          alt=""
          className="w-full h-full object-cover opacity-30"
          style={{ objectPosition: "center 40%" }}
        />
        {/* Gradient overlay — left side stays dark for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-[#0a0a0a]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/60 via-transparent to-transparent" />
      </div>

      {/* G-mark watermark — right side */}
      <div
        className="absolute right-[-6%] top-1/2 -translate-y-1/2 w-[55vw] max-w-[600px] opacity-[0.05] pointer-events-none select-none"
        aria-hidden="true"
      >
        <img
          src="/manus-storage/groupbuy-gmark-dark_d5ad0418.svg"
          alt=""
          className="w-full h-full"
        />
      </div>

      {/* Thin top rule */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />

      <div className="container relative z-10 py-20 md:py-28">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-display text-[11px] tracking-[0.3em] text-[#c73e3a] mb-6"
        >
          Melbourne South East
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="font-display text-[clamp(2.5rem,7vw,6rem)] leading-[1.05] text-[#f5f2ec] max-w-3xl mb-4"
        >
          Deals you<br />
          shouldn't be<br />
          <span className="text-[#c73e3a]">getting.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="font-body text-[16px] text-[#f5f2ec]/60 max-w-md mb-10 leading-relaxed"
        >
          Premium beef, pork, lamb, poultry and seafood — direct from the butcher, split across the group. Brought to you anyway.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="flex flex-wrap gap-3 mb-16"
        >
          <a
            href="#deals"
            className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] px-6 py-3.5 hover:bg-[#a83330] transition-colors"
          >
            View Current Deals
            <ArrowRight size={14} strokeWidth={2} />
          </a>
          <a
            href="https://wa.me/61407249272"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-display text-[11px] tracking-widest border border-[#f5f2ec]/30 text-[#f5f2ec]/80 px-6 py-3.5 hover:border-[#f5f2ec]/60 hover:text-[#f5f2ec] transition-colors"
          >
            <MessageCircle size={14} strokeWidth={1.5} />
            Join WhatsApp
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex flex-wrap gap-8 border-t border-white/10 pt-8"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <span className="font-mono-brand text-[22px] font-bold text-[#f5f2ec]">
                {stat.value}
              </span>
              <span className="font-body text-[12px] text-[#8a857c] uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom rule */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
    </section>
  );
}
