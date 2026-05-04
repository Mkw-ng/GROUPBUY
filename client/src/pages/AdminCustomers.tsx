/**
 * AdminCustomers — searchable list of all customers with loyalty tier badges.
 * Route: /admin/customers
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
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

export default function AdminCustomers() {
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = trpc.customers.list.useQuery();

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.phone.includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [customers, search]);

  return (
    <div className="min-h-screen section-ink">
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
              {search ? "No customers match your search." : "No customers yet. Archive some orders to build profiles."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((c) => {
              const tier = c.loyaltyTier;
              const tierColor = TIER_COLORS[tier.tier] || TIER_COLORS.New;
              return (
                <Link key={c.phone} href={`/admin/customers/${encodeURIComponent(c.phone)}`}>
                  <div className="border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer p-4 flex items-center justify-between group">
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
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
