/*
 * GROUPBUY Pickup Section
 * Design: Ink background, two-column layout — left info, right delivery zones
 * Pickup details in JetBrains Mono, address/hours in Inter Tight
 */
import { motion } from "framer-motion";
import { MapPin, Clock, Calendar, Truck } from "lucide-react";
import PickupMap from "@/components/PickupMap";

const PICKUP_LOCATIONS = [
  {
    name: "BQ Direct",
    address: "126 Fairbank Rd, Clayton South VIC 3169",
  },
  {
    name: "Mitchells Quality Meat",
    address: "Cranbourne Park Shopping Centre",
  },
];

const DELIVERY_ZONES = [
  { suburb: "Clayton",       price: 5  },
  { suburb: "Cranbourne",    price: 5  },
  { suburb: "Berwick",       price: 10 },
  { suburb: "Frankstone",    price: 10 },
  { suburb: "Dandenong",     price: 10 },
  { suburb: "Glen Waverley", price: 10 },
  { suburb: "Cheltenham",    price: 10 },
  { suburb: "Brighton",      price: 10 },
  { suburb: "Pakenham",      price: 15 },
  { suburb: "Tooradin",      price: 15 },
  { suburb: "Mornington",    price: 15 },
  { suburb: "Ringwood",      price: 15 },
  { suburb: "Mooroolbark",   price: 15 },
  { suburb: "Doncaster",     price: 15 },
  { suburb: "Melbourne CBD", price: 15 },
  { suburb: "Upwey",         price: 15 },
  { suburb: "Dromana",       price: 20 },
  { suburb: "Williamstown",  price: 20 },
  { suburb: "Footscray",     price: 20 },
  { suburb: "Sunshine",      price: 20 },
  { suburb: "Essendon",      price: 20 },
  { suburb: "Preston",       price: 20 },
  { suburb: "Point Cook",    price: 20 },
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
              Pick Up &<br />
              <span className="text-[#c73e3a]">Delivery.</span>
            </h2>

            {/* Pickup locations */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className="flex gap-4 border-b border-white/10 pb-6 mb-6"
            >
              <div className="w-8 shrink-0 pt-0.5">
                <MapPin size={16} strokeWidth={1.5} className="text-[#c73e3a]" />
              </div>
              <div className="flex-1">
                <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-3">
                  Pickup Locations
                </p>
                <div className="flex flex-col gap-3">
                  {PICKUP_LOCATIONS.map((loc) => (
                    <div key={loc.name}>
                      <p className="font-mono-brand text-[15px] font-bold text-[#f5f2ec] leading-snug">
                        {loc.name}
                      </p>
                      <p className="font-body text-[13px] text-[#8a857c] mt-0.5">
                        {loc.address}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Pickup day */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="flex gap-4 border-b border-white/10 pb-6 mb-6"
            >
              <div className="w-8 shrink-0 pt-0.5">
                <Calendar size={16} strokeWidth={1.5} className="text-[#c73e3a]" />
              </div>
              <div>
                <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-1">
                  Pickup Days
                </p>
                <p className="font-mono-brand text-[18px] font-bold text-[#f5f2ec] mb-1">
                  Monday — Saturday
                </p>
              </div>
            </motion.div>

            {/* Pickup window */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="flex gap-4 border-b border-white/10 pb-6 mb-6"
            >
              <div className="w-8 shrink-0 pt-0.5">
                <Clock size={16} strokeWidth={1.5} className="text-[#c73e3a]" />
              </div>
              <div>
                <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-1">
                  Pickup Window
                </p>
                <p className="font-mono-brand text-[18px] font-bold text-[#f5f2ec] mb-1">
                  9:00am — 5:00pm
                </p>
              </div>
            </motion.div>

            {/* Delivery note */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="flex gap-4"
            >
              <div className="w-8 shrink-0 pt-0.5">
                <Truck size={16} strokeWidth={1.5} className="text-[#c73e3a]" />
              </div>
              <div>
                <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-1">
                  Delivery
                </p>
                <p className="font-body text-[13px] text-[#8a857c] leading-relaxed">
                  We deliver within a 5 km radius of each zone listed. Not sure if we cover your area? Message us on WhatsApp.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Right — interactive map */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-5">
              Pickup &amp; Delivery Zones
            </p>
            <PickupMap />
            <p className="font-mono-brand text-[10px] text-[#8a857c] mt-3">
              * Circles show 5 km delivery radius per zone. Flat fee per order.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
