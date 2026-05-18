/**
 * AdminCustomers — searchable list of all customers with loyalty tier badges.
 * Route: /admin/customers
 */
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Search, Users, ChevronRight } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  Legend: "text-yellow-300 border-yellow-300/40 bg-yellow-300/10",
  OG: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  Loyal: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  Regular: "text-green-400 border-green-400/40 bg-green-400/10",
  "Fresh Cut": "text-[#c73e3a] border-[#c73e3a]/40 bg-[#c73e3a]/10",
  New: "text-[#8a857c] border-white/20 bg-white/5",
};

const SELECT_CLASS =
  "bg-white/5 border border-white/10 text-[#f5f2ec] font-mono-brand text-[11px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/50";

export default function AdminCustomers() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [inactivityFilter, setInactivityFilter] = useState("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
        if (!c.lastOrderDate) return true; // no order date — treat as inactive
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

  function handleCampaign(phones: string[]) {
    console.log("Send Campaign to:", phones);
  }

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

      {/* Sticky bottom bar — shown when ≥1 customer selected */}
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
              onClick={() => handleCampaign(Array.from(selected))}
              className="font-mono-brand text-[11px] bg-[#c73e3a] text-[#f5f2ec] px-4 py-2 hover:bg-[#a83230] transition-colors"
            >
              Send Campaign →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
