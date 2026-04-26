/*
 * GROUPBUY Hero Section
 * Design: Full-bleed Ink, hero background meat photography, left-aligned Orbitron headline
 * G-mark watermark at low opacity, stat row in JetBrains Mono
 * CTA: "View Current Deals" (red fill) + "Join WhatsApp" (outline)
 * Power Drop: red overlay banner with pulsing indicator when active
 */
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Zap, Rocket } from "lucide-react";
import PowerDropCountdown from "@/components/PowerDropCountdown";

const STATS = [
  { value: "12,600+", label: "Members" },
  { value: "4 yrs", label: "Running" },
  { value: "$0", label: "Membership" },
  { value: "Mon - Sat", label: "Pickup Day" },
];

interface HeroProps {
  powerDropActive?: boolean;
  powerDropActivatedAt?: string;
}

export default function HeroSection({ powerDropActive = false, powerDropActivatedAt = "" }: HeroProps) {
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

      {/* Power Drop overlay — red tint when active */}
      {powerDropActive && (
        <div
          className="absolute inset-0 pointer-events-none select-none"
          aria-hidden="true"
          style={{ background: "rgba(199,62,58,0.08)" }}
        />
      )}

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

      {/* Power Drop top strip */}
      {powerDropActive && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-3 bg-[#c73e3a] py-2.5"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f5f2ec] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f5f2ec]" />
          </span>
          <Zap size={13} className="text-[#f5f2ec] fill-current" />
          <span className="font-display text-[11px] tracking-[0.3em] text-[#f5f2ec]">
            POWER DROP — LIVE NOW
          </span>
          <Zap size={13} className="text-[#f5f2ec] fill-current" />
        </motion.div>
      )}

      <div className="container relative z-10 py-20 md:py-28" style={powerDropActive ? { paddingTop: "4rem" } : {}}>
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-display text-[11px] tracking-[0.3em] text-[#c73e3a] mb-6"
        >
          {powerDropActive ? "⚡ Power Drop Event — Special Pricing Live" : "Melbourne South East"}
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="font-display text-[clamp(2.5rem,7vw,6rem)] leading-[1.05] text-[#f5f2ec] max-w-3xl mb-4"
        >
          {powerDropActive ? (
            <>
              Power Drop<br />
              prices are<br />
              <span className="text-[#c73e3a]">live now.</span>
            </>
          ) : (
            <>
              Deals you<br />
              shouldn't be<br />
              <span className="text-[#c73e3a]">getting.</span>
            </>
          )}
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="font-body text-[16px] text-[#f5f2ec]/60 max-w-md mb-10 leading-relaxed"
        >
          {powerDropActive
            ? "Our monthly Power Drop event is live. Every product is showing its lowest price of the month — for a limited time only."
            : "Brought to you anyway."}
        </motion.p>

        {/* Power Drop countdown timer */}
        {powerDropActive && powerDropActivatedAt && (
          <div className="mb-8">
            <PowerDropCountdown activatedAt={powerDropActivatedAt} />
          </div>
        )}

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
            {powerDropActive ? (
              <>
                <Zap size={14} className="fill-current" />
                View Power Drop Deals
              </>
            ) : (
              <>
                View Current Deals
                <ArrowRight size={14} strokeWidth={2} />
              </>
            )}
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
          <a
            href="https://metavore-432233841783.us-central1.run.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="metavore-btn inline-flex items-center gap-2 font-display text-[11px] tracking-widest px-6 py-3.5 transition-all"
          >
            <Rocket size={14} strokeWidth={1.5} />
            Transport to the Metavore
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
