/**
 * AdminCustomers — searchable list of all customers with loyalty tier badges.
 * Route: /admin/customers
 */
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Search, Users, ChevronRight, X } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  Legend: "text-yellow-300 border-yellow-400/40 bg-yellow-400/10",
  OG: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  Loyal: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  Regular: "text-green-400 border-green-400/40 bg-green-400/10",
  "Fresh Cut": "text-[#c73e3a] border-[#c73e3a]/40 bg-[#c73e3a]/10",
  New: "text-[#8a857c] border-white/20 bg-white/5",
};

const SELECT_CLASS =
  "bg-white/5 border border-white/10 text-[#f5f2ec] font-mono-brand text-[11px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/50";

// ─── Template messages ────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: "Re-engagement",
    text: "Hey! It's Mitchell here 👋 We haven't seen you in a while — our next drop is coming up and we'd love to have you back. Stay tuned 🥩",
  },
  {
    label: "VIP Preview",
    text: "Hey! It's Mitchell here 👑 You're one of our top customers so you get first look at our next drop before anyone else. Something special is coming — watch this space 🔥",
  },
  {
    label: "Streak Reminder",
    text: "Hey! It's Mitchell here 🔥 Don't let your streak die — our current drop is open and we'd hate to see you miss out. Jump on it while you can 🥩",
  },
  {
    label: "Welcome",
    text: "Hey! It's Mitchell here 🥩 So glad to have you as part of the GROUPBUY family. Keep an eye out — our next drop is going to be a good one 🔥",
  },
  { label: "Custom", text: "" },
];

// ─── Phone → WhatsApp URL helper ─────────────────────────────────────────────
function toWhatsAppUrl(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "61" + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ─── CampaignModal ────────────────────────────────────────────────────────────
interface CustomerRow {
  phone: string;
  name?: string | null;
  loyaltyTier: { tier: string; emoji: string };
}

interface CampaignModalProps {
  phones: string[];
  customers: CustomerRow[];
  onClose: () => void;
}

function CampaignModal({ phones, customers, onClose }: CampaignModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const message =
    selectedTemplate === "Custom"
      ? customText
      : TEMPLATES.find((t) => t.label === selectedTemplate)?.text ?? "";

  const canStart = message.trim().length > 0;
  const currentPhone = phones[currentIndex];
  const currentCustomer = customers.find((c) => c.phone === currentPhone);
  const isLast = currentIndex === phones.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center"
      onClick={step === 1 ? onClose : undefined}
    >
      <div
        className="bg-[#0f0e0c] border border-white/10 max-w-lg w-full mx-4 p-6 rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── STEP 1: COMPOSE ── */}
        {step === 1 && (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-display text-[14px] tracking-widest text-[#f5f2ec]">SEND CAMPAIGN</h2>
                <p className="font-mono-brand text-[11px] text-[#8a857c] mt-1">
                  {phones.length} customer{phones.length !== 1 ? "s" : ""} selected
                </p>
              </div>
              <button onClick={onClose} className="text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Template buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setSelectedTemplate(t.label)}
                  className={`font-mono-brand text-[10px] border px-3 py-1.5 transition-colors ${
                    selectedTemplate === t.label
                      ? "border-[#c73e3a] text-[#c73e3a] bg-[#c73e3a]/10"
                      : "border-white/15 text-[#8a857c] hover:border-white/30 hover:text-[#f5f2ec]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Custom textarea */}
            {selectedTemplate === "Custom" && (
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Write your message…"
                className="w-full bg-white/5 border border-white/10 text-[#f5f2ec] font-mono-brand text-[12px] p-3 focus:outline-none focus:border-[#c73e3a]/50 placeholder:text-[#6b6560] resize-none mb-1"
              />
            )}
            {selectedTemplate === "Custom" && (
              <p className="font-mono-brand text-[10px] text-[#6b6560] mb-4 text-right">
                {customText.length}/500
              </p>
            )}

            {/* Message preview */}
            {message && (
              <div className="border border-white/10 bg-white/[0.02] p-4 mb-5">
                <p className="font-display text-[9px] tracking-widest text-[#8a857c] mb-2">PREVIEW</p>
                <p className="font-mono-brand text-[12px] text-[#f5f2ec] leading-relaxed whitespace-pre-wrap">
                  {message}
                </p>
              </div>
            )}

            <button
              disabled={!canStart}
              onClick={() => { setCurrentIndex(0); setStep(2); }}
              className="w-full font-mono-brand text-[12px] bg-[#c73e3a] text-[#f5f2ec] py-3 hover:bg-[#a83230] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Sending →
            </button>
          </>
        )}

        {/* ── STEP 2: SEND ── */}
        {step === 2 && (
          <>
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setStep(1)}
                className="font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors flex items-center gap-1"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <span className="font-mono-brand text-[11px] text-[#8a857c]">
                {currentIndex + 1} of {phones.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/10 h-1.5 mb-6">
              <div
                className="bg-[#c73e3a] h-1.5 transition-all"
                style={{ width: `${((currentIndex + 1) / phones.length) * 100}%` }}
              />
            </div>

            {/* Current customer */}
            <div className="mb-5">
              <p className="font-mono-brand text-[22px] font-bold text-[#f5f2ec] mb-1">
                {currentPhone}
              </p>
              {currentCustomer?.name && (
                <p className="font-mono-brand text-[11px] text-[#c73e3a]/80 mb-3">
                  {currentCustomer.name}
                </p>
              )}
            </div>

            {/* Message (read-only) */}
            <div className="border border-white/10 bg-white/[0.02] p-4 mb-5">
              <p className="font-mono-brand text-[12px] text-[#f5f2ec] leading-relaxed whitespace-pre-wrap">
                {message}
              </p>
            </div>

            {/* Open WhatsApp */}
            <a
              href={toWhatsAppUrl(currentPhone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center font-mono-brand text-[12px] bg-[#25d366] text-white py-3 hover:bg-[#1ebe5d] transition-colors mb-3"
            >
              Open WhatsApp ↗
            </a>

            {/* Next / Done */}
            <button
              onClick={handleNext}
              className="w-full font-mono-brand text-[12px] bg-[#c73e3a] text-[#f5f2ec] py-3 hover:bg-[#a83230] transition-colors"
            >
              {isLast ? "Done ✓" : "Next →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminCustomers() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [inactivityFilter, setInactivityFilter] = useState("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaignOpen, setCampaignOpen] = useState(false);

  const { data: customers, isLoading } = trpc.customers.list.useQuery();

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.toLowerCase();
    const now = Date.now();

    return customers.filter((c) => {
      // Search
      if (q && !c.phone.includes(q) && !(c.name && c.name.toLowerCase().includes(q))) return false;

      // Tier
      if (tierFilter !== "all" && c.loyaltyTier.tier !== tierFilter) return false;

      // Location
      if (locationFilter !== "all" && c.preferredLocation !== locationFilter) return false;

      // Inactivity
      if (inactivityFilter !== "any") {
        const days = parseInt(inactivityFilter, 10);
        if (!c.lastOrderDate) return true;
        const daysSince = Math.floor((now - new Date(c.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < days) return false;
      }

      return true;
    });
  }, [customers, search, tierFilter, locationFilter, inactivityFilter]);

  // ── Checkbox helpers ──────────────────────────────────────────────────────
  const filteredPhones = useMemo(() => filtered.map((c) => c.phone), [filtered]);
  const allSelected = filteredPhones.length > 0 && filteredPhones.every((p) => selected.has(p));
  const someSelected = filteredPhones.some((p) => selected.has(p));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredPhones.forEach((p) => next.delete(p));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredPhones.forEach((p) => next.add(p));
        return next;
      });
    }
  }

  function toggleOne(phone: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  const selectedCount = selected.size;
  const selectedPhones = Array.from(selected);

  return (
    <div className="min-h-screen section-ink pb-24">
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <button className="flex items-center gap-1.5 font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
              <ArrowLeft size={13} />
              Admin
            </button>
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#c73e3a]" />
            <span className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
              CUSTOMER ANALYTICS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono-brand text-[10px] text-[#8a857c]">
            {customers ? `${customers.length} customers` : "—"}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857c]" />
          <input
            type="text"
            placeholder="Search by phone or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 text-[#f5f2ec] font-mono-brand text-[13px] pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#c73e3a]/50 placeholder:text-[#8a857c]"
          />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2">
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All Tiers</option>
            <option value="Legend">Legend</option>
            <option value="OG">OG</option>
            <option value="Loyal">Loyal</option>
            <option value="Regular">Regular</option>
            <option value="Fresh Cut">Fresh Cut</option>
            <option value="New">New</option>
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All Locations</option>
            <option value="cranbourne">Cranbourne</option>
            <option value="clayton">Clayton</option>
            <option value="delivery">Delivery</option>
          </select>

          <select
            value={inactivityFilter}
            onChange={(e) => setInactivityFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="any">Any Activity</option>
            <option value="7">7+ days</option>
            <option value="30">30+ days</option>
            <option value="60">60+ days</option>
            <option value="90">90+ days</option>
          </select>
        </div>

        {/* Stats summary */}
        {customers && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "TOTAL CUSTOMERS", value: customers.length },
              { label: "LEGENDS", value: customers.filter((c) => c.loyaltyTier.tier === "Legend").length },
              { label: "OGs", value: customers.filter((c) => c.loyaltyTier.tier === "OG").length },
              { label: "LOYAL+", value: customers.filter((c) => ["Loyal", "OG", "Legend"].includes(c.loyaltyTier.tier)).length },
            ].map((s) => (
              <div key={s.label} className="border border-white/10 p-4">
                <p className="font-display text-[9px] tracking-widest text-[#8a857c] mb-1">{s.label}</p>
                <p className="font-mono-brand text-[22px] font-bold text-[#f5f2ec]">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Customer list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-white/10 p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-32 mb-2" />
                <div className="h-3 bg-white/5 rounded w-48" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-white/10 p-12 text-center">
            <Users size={32} className="text-[#8a857c] mx-auto mb-3" />
            <p className="font-mono-brand text-[13px] text-[#8a857c]">
              {search || tierFilter !== "all" || locationFilter !== "all" || inactivityFilter !== "any"
                ? "No customers match your filters."
                : "No customers yet. Archive some orders to build profiles."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Select All row */}
            <div className="flex items-center gap-3 px-4 py-2 border border-white/10 bg-white/[0.02]">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={toggleSelectAll}
                className="accent-[#c73e3a] w-4 h-4 shrink-0 cursor-pointer"
              />
              <span className="font-mono-brand text-[11px] text-[#8a857c]">
                {allSelected ? "Deselect all" : `Select all ${filtered.length}`}
              </span>
            </div>

            {filtered.map((c) => {
              const tier = c.loyaltyTier;
              const tierColor = TIER_COLORS[tier.tier] || TIER_COLORS.New;
              const isChecked = selected.has(c.phone);
              return (
                <div
                  key={c.phone}
                  className="border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer p-4 flex items-center gap-3 group"
                  onClick={() => navigate(`/admin/customers/${encodeURIComponent(c.phone)}`)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(c.phone)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-[#c73e3a] w-4 h-4 shrink-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Tier badge */}
                      <span className={`font-mono-brand text-[10px] border px-2 py-1 shrink-0 ${tierColor}`}>
                        {tier.emoji} {tier.tier.toUpperCase()}
                      </span>
                      {/* Phone / name */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-brand text-[13px] font-bold text-[#f5f2ec]">
                            {c.phone}
                          </span>
                          {c.name && (
                            <span className="font-mono-brand text-[11px] text-[#c73e3a]/80">
                              {c.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="font-mono-brand text-[11px] text-[#8a857c]">
                            {c.totalOrders} order{c.totalOrders !== 1 ? "s" : ""}
                          </span>
                          <span className="font-mono-brand text-[11px] text-[#8a857c]">
                            ${parseFloat(c.totalSpend).toFixed(2)} total
                          </span>
                          {c.lastOrderDate && (
                            <span className="font-mono-brand text-[11px] text-[#8a857c]">
                              Last: {new Date(c.lastOrderDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[#8a857c] group-hover:text-[#f5f2ec] transition-colors shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0f0e0c] border-t border-white/10 px-6 py-4 flex items-center justify-between z-50">
          <span className="font-mono-brand text-[12px] text-[#f5f2ec]">
            {selectedCount} customer{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(new Set())}
              className="font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setCampaignOpen(true)}
              className="font-mono-brand text-[11px] bg-[#c73e3a] text-[#f5f2ec] px-4 py-2 hover:bg-[#a83230] transition-colors"
            >
              Send Campaign →
            </button>
          </div>
        </div>
      )}

      {/* Campaign modal */}
      {campaignOpen && customers && (
        <CampaignModal
          phones={selectedPhones}
          customers={customers}
          onClose={() => {
            setCampaignOpen(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
