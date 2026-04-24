/*
 * GROUPBUY Pickup Section
 * Design: Ink background, two-column layout — left info, right map embed
 * Pickup details in JetBrains Mono, address/hours in Inter Tight
 */
import { motion } from "framer-motion";
import { MapPin, Clock, Calendar } from "lucide-react";

const PICKUP_DETAILS = [
  {
    icon: MapPin,
    label: "Location",
    value: "Lyndhurst, VIC 3975",
    sub: "Exact address shared on order confirmation",
  },
  {
    icon: Calendar,
    label: "Pickup Day",
    value: "Every Saturday",
    sub: "Orders close Thursday midnight",
  },
  {
    icon: Clock,
    label: "Pickup Window",
    value: "08:00 — 11:00",
    sub: "No late pickups — please be on time",
  },
];

export default function PickupSection() {
  return (
    <section id="pickup" className="section-ink py-20 md:py-28 relative overflow-hidden">
      {/* Subtle G-mark watermark */}
      <div
        className="absolute left-[-5%] top-1/2 -translate-y-1/2 w-[50vw] max-w-[500px] opacity-[0.03] pointer-events-none select-none"
        aria-hidden="true"
      >
        <img
          src="/manus-storage/groupbuy-gmark-dark_d5ad0418.svg"
          alt=""
          className="w-full h-full"
        />
      </div>

      <div className="container relative z-10">
        {/* Receipt divider eyebrow */}
        <div className="receipt-divider mb-12 text-[#f5f2ec]">
          <span>Pickup Info</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left — details */}
          <div>
            <h2 className="font-display text-[clamp(1.8rem,4vw,3rem)] text-[#f5f2ec] mb-8 leading-tight">
              Saturday<br />
              <span className="text-[#c73e3a]">Pickup.</span>
            </h2>

            <div className="flex flex-col gap-6">
              {PICKUP_DETAILS.map((detail, i) => (
                <motion.div
                  key={detail.label}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.1 }}
                  className="flex gap-4 border-b border-white/10 pb-6 last:border-0"
                >
                  <div className="w-8 shrink-0 pt-0.5">
                    <detail.icon size={16} strokeWidth={1.5} className="text-[#c73e3a]" />
                  </div>
                  <div>
                    <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-1">
                      {detail.label}
                    </p>
                    <p className="font-mono-brand text-[18px] font-bold text-[#f5f2ec] mb-1">
                      {detail.value}
                    </p>
                    <p className="font-body text-[13px] text-[#8a857c]">
                      {detail.sub}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 p-4 border border-white/10 bg-white/5">
              <p className="font-mono-brand text-[11px] text-[#8a857c] leading-relaxed">
                We service the South East corridor — Lyndhurst, Cranbourne, Berwick, Narre Warren, Pakenham and surrounds. If you're unsure whether we cover your area, message us on WhatsApp.
              </p>
            </div>
          </div>

          {/* Right — map */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="aspect-[4/3] border border-white/10 overflow-hidden"
          >
            <iframe
              title="Pickup Location Map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3143.7!2d145.2667!3d-38.0833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6ad6140b8f2b8a5b%3A0x5045675218ce6e0!2sLyndhurst+VIC+3975!5e0!3m2!1sen!2sau!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0, filter: "invert(90%) hue-rotate(180deg)" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
