/*
 * GROUPBUY Cart Drawer
 * Design: Ink background slide-in panel, items list with JetBrains Mono prices
 * Order details form below items: phone, pickup date, location/delivery, special instructions
 * Saved details: phone + location persisted to localStorage, auto-filled on next visit
 * Checkout CTA in red, close button top-right
 * Power Drop: indicator in header + note in WhatsApp checkout message
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  MessageCircle,
  Zap,
  CalendarIcon,
  ChevronDown,
  BookmarkCheck,
  Bookmark,
} from "lucide-react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { useSavedOrderDetails } from "@/hooks/useSavedOrderDetails";
import { trpc } from "@/lib/trpc";

export interface CartItem {
  id: number;
  name: string;
  cut: string;
  price: number;
  unit: string;
  qty: number;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemove: (id: number) => void;
  onQtyChange: (id: number, qty: number) => void;
  powerDropActive?: boolean;
  powerDropActivatedAt?: string; // ISO timestamp of when Power Drop was activated
}

type PickupLocation = "cranbourne" | "clayton" | "delivery";

const LOCATION_LABELS: Record<PickupLocation, string> = {
  cranbourne: "Cranbourne",
  clayton: "Clayton",
  delivery: "Delivery",
};

export default function CartDrawer({
  open,
  onClose,
  items,
  onRemove,
  onQtyChange,
  powerDropActive = false,
  powerDropActivatedAt = "",
}: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const { saved, save, clear } = useSavedOrderDetails();

  const createOrder = trpc.orders.create.useMutation();

  // ─── Order details state ────────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [pickupDate, setPickupDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [location, setLocation] = useState<PickupLocation>("cranbourne");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saveDetails, setSaveDetails] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const calendarRef = useRef<HTMLDivElement>(null);

  // Auto-fill from saved details when drawer opens or saved details load
  useEffect(() => {
    if (saved) {
      setPhone((prev) => prev || saved.phone);
      setLocation((prev) => prev || saved.location);
      if (saved.deliveryAddress) {
        setDeliveryAddress((prev) => prev || saved.deliveryAddress!);
      }
      setSaveDetails(true);
    }
  }, [saved]);

  // Close calendar on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    if (calendarOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [calendarOpen]);

  // ─── Date picker constraints ────────────────────────────────────────────────
  // Power Drop mode: only 10–14 days from activation are selectable
  // Standard mode: earliest = today + 2 days, no upper limit
  const { disabledDays, dateHint, pdWindowStart, pdWindowEnd } = (() => {
    const today = startOfDay(new Date());
    if (powerDropActive && powerDropActivatedAt) {
      const activatedAt = startOfDay(new Date(powerDropActivatedAt));
      const windowStart = new Date(activatedAt);
      windowStart.setDate(windowStart.getDate() + 10);
      const windowEnd = new Date(activatedAt);
      windowEnd.setDate(windowEnd.getDate() + 14);
      const disabled = (date: Date) => {
        const d = startOfDay(date);
        return d < windowStart || d > windowEnd;
      };
      const hint = `⚡ Power Drop orders: pick-up between ${format(windowStart, "d MMM")} – ${format(windowEnd, "d MMM yyyy")}`;
      return { disabledDays: disabled, dateHint: hint, pdWindowStart: windowStart, pdWindowEnd: windowEnd };
    }
    // Standard: minimum 2 days from today
    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() + 2);
    const disabled = (date: Date) => startOfDay(date) < earliest;
    const hint = `Earliest available date: ${format(earliest, "d MMMM yyyy")}`;
    return { disabledDays: disabled, dateHint: hint, pdWindowStart: null, pdWindowEnd: null };
  })();

  // ─── Validation + WhatsApp message ─────────────────────────────────────────
  function normalisePhone(raw: string): string {
    // Strip spaces, hyphens, parentheses, dots
    return raw.replace(/[\s\-().]/g, "");
  }

  function validatePhone(raw: string): string | null {
    if (!raw.trim()) return "WhatsApp number is required";
    const digits = normalisePhone(raw);
    if (!/^\d+$/.test(digits)) return "Enter numbers only — no letters or symbols";
    if (digits.length !== 10) return "Must be a 10-digit Australian number (e.g. 0412 345 678)";
    if (!/^0[2-9]/.test(digits)) return "Must start with 0 followed by 2–9 (e.g. 04xx or 02xx)";
    return null;
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const phoneErr = validatePhone(phone);
    if (phoneErr) errs.phone = phoneErr;
    if (!pickupDate) errs.date = "Please select a pickup / delivery date";
    if (location === "delivery" && !deliveryAddress.trim())
      errs.address = "Delivery address is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildWhatsAppUrl(): string {
    const dateStr = pickupDate ? format(pickupDate, "EEEE, d MMMM yyyy") : "";
    const locationStr =
      location === "delivery"
        ? `Delivery — ${deliveryAddress}`
        : LOCATION_LABELS[location];
    const powerDropNote = powerDropActive ? "\n⚡ *POWER DROP PRICING APPLIED*" : "";

    const itemLines = items.map((i) => {
      const qtyStr = i.qty % 1 === 0 ? String(i.qty) : i.qty.toFixed(1);
      const cleanUnit = i.unit.replace(/^\/\s*/, "");
      return `${qtyStr}/${cleanUnit} x ${i.name} — $${i.price.toFixed(2)}/${cleanUnit}`;
    });

    const preamble = powerDropActive ? [
      "Incoming GroupBuy Power-Drop Order",
      "",
      "Here\'s how it works:",
      "",
      "1. Orders close Wednesday night",
      "2. You\'ll receive your invoice right here on WhatsApp",
      "3. Send remittance before Saturday night cut-off to lock it in",
      "4. Collect next week at your selected time",
      "",
      "---",
      "",
    ] : [];
    const parts: string[] = [
      ...preamble,
      `*Order Number:* ${normalisePhone(phone)}`,
      `*Pick up Date:* ${dateStr}`,
      `*Pick up Location:* ${locationStr}`,
      "",
      ...itemLines,
    ];

    if (instructions.trim()) {
      parts.push("");
      parts.push(`*Special Instructions:* ${instructions.trim()}`);
    }

    if (powerDropNote) {
      parts.push("");
      parts.push("⚡ POWER DROP PRICING APPLIED");
    }

    return `https://wa.me/61407249272?text=${encodeURIComponent(parts.join("\n"))}`;
  }

  function handleCheckout(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!validate()) {
      e.preventDefault();
      return;
    }
    // Persist details if checkbox is ticked
    if (saveDetails && phone.trim()) {
      save({
        phone: phone.trim(),
        location,
        deliveryAddress: location === "delivery" && deliveryAddress.trim()
          ? deliveryAddress.trim()
          : undefined,
      });
    } else if (!saveDetails) {
      clear();
    }

    // Save order to database only for Power Drop orders
    if (powerDropActive) {
      const dateStr = pickupDate ? format(pickupDate, "EEEE, d MMMM yyyy") : "";
      const orderItems = items.map((i) => ({
        id: i.id,
        name: i.name,
        cut: i.cut,
        qty: i.qty,
        price: i.price.toFixed(2),
        unit: i.unit,
      }));
      createOrder.mutate({
        phone: normalisePhone(phone),
        pickupDate: dateStr,
        location,
        deliveryAddress: location === "delivery" ? deliveryAddress.trim() : undefined,
        items: JSON.stringify(orderItems),
        specialInstructions: instructions.trim() || undefined,
        isPowerDrop: true,
      });
    }
  }

  // ─── Shared input styles ────────────────────────────────────────────────────
  const inputBase =
    "w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2.5 placeholder-[#8a857c] focus:outline-none focus:border-[#c73e3a]/60 transition-colors";
  const labelBase = "block font-display text-[10px] tracking-widest text-[#8a857c] mb-1.5";
  const errorBase = "font-mono-brand text-[10px] text-[#c73e3a] mt-1";

  const detailsAreSaved =
    saved && saved.phone === phone.trim() && saved.location === location;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm section-ink border-l border-white/10 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
                    Your Order
                  </p>
                  {powerDropActive && (
                    <span className="flex items-center gap-1 font-mono-brand text-[9px] tracking-wider text-[#c73e3a] border border-[#c73e3a]/40 px-1.5 py-0.5">
                      <Zap size={8} className="fill-current" />
                      POWER DROP
                    </span>
                  )}
                </div>
                <p className="font-mono-brand text-[11px] text-[#8a857c] mt-0.5">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors"
                aria-label="Close cart"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Items */}
              <div className="px-6 py-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-16 h-16 opacity-10">
                      <img
                        src="/manus-storage/groupbuy-gmark-dark_d5ad0418.svg"
                        alt=""
                        className="w-full h-full"
                      />
                    </div>
                    <p className="font-mono-brand text-[12px] text-[#8a857c]">
                      Your cart is empty.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-3 border-b border-white/8 pb-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[13px] font-bold text-[#f5f2ec] leading-snug">
                            {item.name}
                          </p>
                          <p className="font-mono-brand text-[10px] text-[#8a857c] mt-0.5">
                            {item.cut}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center border border-white/15">
                              <button
                                onClick={() => {
                                  const next = Math.round((item.qty - 0.5) * 10) / 10;
                                  next >= 0.5 ? onQtyChange(item.id, next) : onRemove(item.id);
                                }}
                                className="w-7 h-7 flex items-center justify-center text-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors font-mono-brand text-[14px]"
                              >
                                −
                              </button>
                              <span className="w-8 text-center font-mono-brand text-[12px] text-[#f5f2ec]">
                                {item.qty % 1 === 0 ? item.qty : item.qty.toFixed(1)}
                              </span>
                              <button
                                onClick={() => {
                                  const next = Math.round((item.qty + 0.5) * 10) / 10;
                                  onQtyChange(item.id, next);
                                }}
                                className="w-7 h-7 flex items-center justify-center text-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors font-mono-brand text-[14px]"
                              >
                                +
                              </button>
                            </div>
                            <span className="font-mono-brand text-[14px] font-bold text-[#c73e3a]">
                              {`$${item.price.toFixed(2)}/${item.unit.replace(/^\/\s*/, "")}`}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => onRemove(item.id)}
                          className="text-[#8a857c] hover:text-[#c73e3a] transition-colors self-start mt-1"
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order details form — only shown when cart has items */}
              {items.length > 0 && (
                <div className="px-6 pb-4 border-t border-white/10 pt-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
                      Order Details
                    </p>
                    {/* Saved indicator */}
                    {detailsAreSaved && (
                      <span className="flex items-center gap-1 font-mono-brand text-[10px] text-[#4ade80]">
                        <BookmarkCheck size={11} />
                        Details saved
                      </span>
                    )}
                  </div>

                  {/* 1. WhatsApp phone number */}
                  <div>
                    <label className={labelBase}>Your WhatsApp Number *</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      onBlur={() => {
                        const err = validatePhone(phone);
                        setErrors((prev) => ({ ...prev, phone: err ?? "" }));
                      }}
                      placeholder="e.g. 0412 345 678"
                      className={`${inputBase} ${errors.phone ? "border-[#c73e3a]/60" : ""}`}
                      maxLength={14}
                    />
                    {errors.phone && <p className={errorBase}>{errors.phone}</p>}
                    {!errors.phone && validatePhone(phone) === null && (
                      <p className="font-mono-brand text-[10px] text-[#4ade80] mt-1 flex items-center gap-1">
                        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 shrink-0" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        We will send order updates to this number.
                      </p>
                    )}
                  </div>

                  {/* 2. Pickup / delivery date */}
                  <div ref={calendarRef}>
                    <label className={labelBase}>Pick-up / Delivery Date *</label>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen((v) => !v)}
                      className={`${inputBase} flex items-center justify-between text-left ${
                        pickupDate ? "text-[#f5f2ec]" : "text-[#8a857c]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CalendarIcon size={13} className="text-[#8a857c]" />
                        {pickupDate
                          ? format(pickupDate, "EEEE, d MMMM yyyy")
                          : "Select a date"}
                      </span>
                      <ChevronDown
                        size={13}
                        className={`text-[#8a857c] transition-transform ${calendarOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {errors.date && <p className={errorBase}>{errors.date}</p>}
                    {!errors.date && (
                      <p className="font-mono-brand text-[10px] text-[#8a857c] mt-1">{dateHint}</p>
                    )}

                    {/* Calendar popover */}
                    <AnimatePresence>
                      {calendarOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="mt-1 border border-white/15 bg-[#1a1714] z-10 relative"
                          style={{ colorScheme: "dark" }}
                        >
                          <DayPicker
                            mode="single"
                            selected={pickupDate}
                            onSelect={(date) => {
                              setPickupDate(date);
                              setCalendarOpen(false);
                              if (errors.date) setErrors((prev) => ({ ...prev, date: "" }));
                            }}
                            disabled={disabledDays}
                            classNames={{
                              root: "p-3 text-[#f5f2ec] font-mono-brand text-[12px]",
                              month_caption:
                                "font-display text-[11px] tracking-widest text-[#f5f2ec] mb-2",
                              weekday: "text-[#8a857c] text-[10px]",
                              day_button:
                                "w-8 h-8 hover:bg-[#c73e3a]/20 rounded transition-colors",
                              selected: "bg-[#c73e3a] text-[#f5f2ec] rounded",
                              disabled: "opacity-25 cursor-not-allowed",
                              today: "font-bold text-[#c73e3a]",
                              nav: "text-[#8a857c]",
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 3. Pickup location */}
                  <div>
                    <label className={labelBase}>Pick-up Location / Delivery *</label>
                    <div className="flex flex-col gap-1.5">
                      {(["cranbourne", "clayton", "delivery"] as PickupLocation[]).map((opt) => (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 px-3 py-2.5 border cursor-pointer transition-colors ${
                            location === opt
                              ? "border-[#c73e3a]/60 bg-[#c73e3a]/8"
                              : "border-white/15 hover:border-white/30"
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              location === opt ? "border-[#c73e3a]" : "border-white/30"
                            }`}
                          >
                            {location === opt && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#c73e3a]" />
                            )}
                          </span>
                          <input
                            type="radio"
                            name="location"
                            value={opt}
                            checked={location === opt}
                            onChange={() => setLocation(opt)}
                            className="sr-only"
                          />
                          <span className="font-mono-brand text-[12px] text-[#f5f2ec]">
                            {LOCATION_LABELS[opt]}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Delivery address */}
                    <AnimatePresence>
                      {location === "delivery" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden mt-2"
                        >
                          <input
                            type="text"
                            value={deliveryAddress}
                            onChange={(e) => {
                              setDeliveryAddress(e.target.value);
                              if (errors.address)
                                setErrors((prev) => ({ ...prev, address: "" }));
                            }}
                            placeholder="Enter your delivery address"
                            className={inputBase}
                          />
                          {errors.address && <p className={errorBase}>{errors.address}</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 4. Special instructions */}
                  <div>
                    <label className={labelBase}>Special Instructions</label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g., Please trim fat, cut into steaks, etc."
                      rows={3}
                      className={`${inputBase} resize-none`}
                    />
                  </div>

                  {/* 5. Save / clear details */}
                  <div className="border border-white/10 px-3 py-3 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <span
                        className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                          saveDetails
                            ? "border-[#c73e3a] bg-[#c73e3a]"
                            : "border-white/30 bg-transparent"
                        }`}
                        onClick={() => setSaveDetails((v) => !v)}
                      >
                        {saveDetails && (
                          <svg
                            viewBox="0 0 10 8"
                            fill="none"
                            className="w-2.5 h-2.5"
                            stroke="#f5f2ec"
                            strokeWidth="1.5"
                          >
                            <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={saveDetails}
                        onChange={(e) => setSaveDetails(e.target.checked)}
                        className="sr-only"
                      />
                      <span className="font-mono-brand text-[11px] text-[#f5f2ec]/70 flex items-center gap-1.5">
                        <Bookmark size={11} className="text-[#8a857c]" />
                        Save my number &amp; pickup location for next time
                      </span>
                    </label>

                    {/* Clear saved details */}
                    {saved && (
                      <button
                        type="button"
                        onClick={() => {
                          clear();
                          setSaveDetails(false);
                        }}
                        className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#c73e3a] transition-colors underline underline-offset-2 ml-6"
                      >
                        Clear saved details
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-6 py-5 border-t border-white/10 shrink-0">
                <div className="flex items-end justify-between mb-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-display text-[11px] tracking-widest text-[#8a857c]">
                      Approx Total
                    </span>
                    <span className="font-mono-brand text-[9px] text-[#6b6560] uppercase tracking-wide">
                      Subject to final weights
                    </span>
                  </div>
                  <span className="font-mono-brand text-[24px] font-bold text-[#f5f2ec]">
                    ${total.toFixed(2)}
                  </span>
                </div>
                <a
                  href={buildWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleCheckout}
                  className="w-full flex items-center justify-center gap-2 font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] py-4 hover:bg-[#a83330] transition-colors mb-2"
                >
                  <MessageCircle size={14} strokeWidth={1.5} />
                  Checkout via WhatsApp
                </a>
                <p className="font-mono-brand text-[10px] text-[#8a857c] text-center">
                  Payment by bank transfer or card on confirmation
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
