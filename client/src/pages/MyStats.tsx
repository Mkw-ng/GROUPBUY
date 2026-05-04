/**
 * MyStats — public "Check My Stats" page at /my-stats
 * Phone number lookup → receipt-style stats card → shareable card
 * "Butcher's Receipt" aesthetic: cream paper, ink text, mono font
 */
import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Phone, Search, Share2, Copy, Check, Flame, Star, ShoppingBag, DollarSign, Scale, Zap, MapPin, Calendar, ChevronLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BadgeGrid from "@/components/BadgeGrid";

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Legend: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-300" },
  OG: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  Loyal: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  Regular: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300" },
  "Fresh Cut": { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
  New: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-300" },
};

// Dashed divider for receipt aesthetic
function ReceiptDivider() {
  return (
    <div className="border-t border-dashed border-[#2b2b2b]/20 my-4" />
  );
}

function ReceiptRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className={`font-mono text-[12px] text-[#5a5248] ${bold ? "font-bold" : ""}`}>{label}</span>
      <span className={`font-mono text-[12px] text-[#2b2b2b] text-right ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

export default function MyStats() {
  const [phone, setPhone] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: stats, isLoading, error } = trpc.customers.lookup.useQuery(
    { phone: submittedPhone ?? "" },
    { enabled: !!submittedPhone }
  );

  const handleLookup = useCallback(() => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 8) return;
    setSubmittedPhone(cleaned);
  }, [phone]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/my-stats`;
    const text = stats
      ? `🥩 I'm a ${stats.loyaltyTier.emoji} ${stats.loyaltyTier.tier} at Mitchell's GroupBuy! Check your own stats at mitchellsgroupbuy.com/my-stats`
      : "Check your GroupBuy stats at mitchellsgroupbuy.com/my-stats";
    if (navigator.share) {
      try {
        await navigator.share({ title: "My GroupBuy Stats", text, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [stats]);

  let favouriteItems: string[] = [];
  if (stats?.favouriteItems) {
    try { favouriteItems = JSON.parse(stats.favouriteItems); } catch { favouriteItems = []; }
  }

  const tier = stats?.loyaltyTier;
  const tierStyle = tier ? (TIER_COLORS[tier.tier] || TIER_COLORS.New) : null;
  const avgOrderValue = stats && stats.totalOrders > 0
    ? (parseFloat(stats.totalSpend) / stats.totalOrders).toFixed(2)
    : "0.00";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar cartCount={0} onCartClick={() => {}} />

      <main className="flex-1 section-cream py-16 px-4">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <p className="font-mono-brand text-[11px] tracking-widest text-[#8a857c] mb-2">
              MITCHELL'S GROUPBUY
            </p>
            <h1 className="font-display text-[32px] sm:text-[40px] tracking-tight text-[#2b2b2b] leading-tight">
              CHECK MY STATS
            </h1>
            <p className="font-mono-brand text-[13px] text-[#8a857c] mt-3">
              Enter your WhatsApp number to see your loyalty tier, purchase history, and more.
            </p>
          </div>

          {/* Phone input */}
          <div className="border border-[#2b2b2b]/20 bg-white p-6 mb-6">
            <label className="font-display text-[10px] tracking-widest text-[#8a857c] block mb-3">
              YOUR WHATSAPP NUMBER
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a857c]" />
                <input
                  type="tel"
                  placeholder="e.g. 0412 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  className="w-full border border-[#2b2b2b]/20 bg-[#faf8f5] text-[#2b2b2b] font-mono-brand text-[13px] pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#c73e3a]/50 placeholder:text-[#8a857c]"
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={phone.replace(/\s/g, "").length < 8 || isLoading}
                className="flex items-center gap-1.5 bg-[#c73e3a] text-white font-display text-[10px] tracking-widest px-4 py-2.5 hover:bg-[#a83230] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search size={13} />
                {isLoading ? "…" : "LOOK UP"}
              </button>
            </div>
            <p className="font-mono-brand text-[10px] text-[#8a857c] mt-2">
              We only use your number to look up your order history. No account needed.
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="border border-red-200 bg-red-50 p-4 text-center">
              <p className="font-mono-brand text-[12px] text-red-600">Something went wrong. Please try again.</p>
            </div>
          )}

          {/* No results */}
          {submittedPhone && !isLoading && stats === null && (
            <div className="border border-[#2b2b2b]/20 bg-white p-8 text-center">
              <ShoppingBag size={32} className="text-[#8a857c] mx-auto mb-3" />
              <p className="font-mono-brand text-[13px] text-[#5a5248] font-bold mb-1">No stats found yet</p>
              <p className="font-mono-brand text-[12px] text-[#8a857c]">
                Stats are generated after your orders are archived by the team. If you've ordered recently, check back soon!
              </p>
            </div>
          )}

          {/* Stats card — receipt style */}
          {stats && tier && tierStyle && (
            <div>
              <div
                ref={cardRef}
                className="bg-[#faf8f5] border border-[#2b2b2b]/15 shadow-md"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {/* Receipt header */}
                <div className="bg-[#2b2b2b] text-[#faf8f5] px-6 py-5 text-center">
                  <p className="font-display text-[10px] tracking-[0.3em] text-[#8a857c] mb-1">
                    MITCHELL'S GROUPBUY
                  </p>
                  <p className="font-display text-[20px] tracking-widest">LOYALTY RECEIPT</p>
                  <p className="font-mono text-[10px] text-[#8a857c] mt-1">
                    {new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
                  </p>
                </div>

                <div className="px-6 py-5 space-y-1">
                  {/* Phone */}
                  <ReceiptRow label="CUSTOMER" value={stats.phone} />
                  {stats.name && <ReceiptRow label="NAME" value={stats.name} />}

                  <ReceiptDivider />

                  {/* Loyalty tier */}
                  <div className={`flex items-center justify-between border ${tierStyle.border} ${tierStyle.bg} px-3 py-2 my-3`}>
                    <span className={`font-mono text-[12px] font-bold ${tierStyle.text}`}>
                      LOYALTY TIER
                    </span>
                    <span className={`font-mono text-[14px] font-bold ${tierStyle.text}`}>
                      {tier.emoji} {tier.tier.toUpperCase()}
                    </span>
                  </div>
                  {tier.dropsToNext != null && (
                    <p className="font-mono text-[10px] text-[#8a857c] text-center">
                      {tier.dropsToNext} more order{tier.dropsToNext !== 1 ? "s" : ""} to reach {tier.next}
                    </p>
                  )}

                  <ReceiptDivider />

                  {/* Stats */}
                  <ReceiptRow label="TOTAL ORDERS" value={String(stats.totalOrders)} />
                  <ReceiptRow label="TOTAL SPEND" value={`$${parseFloat(stats.totalSpend).toFixed(2)}`} bold />
                  <ReceiptRow label="AVG ORDER VALUE" value={`$${avgOrderValue}`} />
                  <ReceiptRow label="TOTAL KG ORDERED" value={`${parseFloat(stats.totalKg).toFixed(1)} kg`} />
                  <ReceiptRow label="LARGEST ORDER" value={`$${parseFloat(stats.largestOrder).toFixed(2)}`} />
                  <ReceiptRow label="SMALLEST ORDER" value={`$${parseFloat(stats.smallestOrder).toFixed(2)}`} />

                  <ReceiptDivider />

                  {/* Streaks */}
                  <ReceiptRow
                    label="CURRENT STREAK"
                    value={`${stats.currentStreak} drop${stats.currentStreak !== 1 ? "s" : ""} 🔥`}
                  />
                  <ReceiptRow
                    label="LONGEST STREAK"
                    value={`${stats.longestStreak} drop${stats.longestStreak !== 1 ? "s" : ""} ⭐`}
                  />
                  {stats.powerDropsAttended > 0 && (
                    <ReceiptRow
                      label="POWER DROPS"
                      value={`${stats.powerDropsAttended} ⚡`}
                    />
                  )}

                  {/* Favourite items */}
                  {favouriteItems.length > 0 && (
                    <>
                      <ReceiptDivider />
                      <p className="font-mono text-[10px] text-[#8a857c] mb-2">FAVOURITE CUTS</p>
                      {favouriteItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[#5a5248]">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "} {item}
                          </span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Preferred location */}
                  {stats.preferredLocation && (
                    <>
                      <ReceiptDivider />
                      <ReceiptRow label="PREFERRED PICKUP" value={stats.preferredLocation} />
                    </>
                  )}

                  <ReceiptDivider />

                  {/* Dates */}
                  {stats.firstOrderDate && (
                    <ReceiptRow
                      label="MEMBER SINCE"
                      value={new Date(stats.firstOrderDate).toLocaleDateString("en-AU", { month: "short", year: "numeric" }).toUpperCase()}
                    />
                  )}
                  {stats.lastOrderDate && (
                    <ReceiptRow
                      label="LAST ORDER"
                      value={new Date(stats.lastOrderDate).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
                    />
                  )}
                </div>

                {/* Achievement badges */}
                {stats.badges && stats.badges.length > 0 && (
                  <>
                    <ReceiptDivider />
                    <div className="py-1">
                      <BadgeGrid
                        badges={stats.badges}
                        earnedCount={stats.earnedBadgeCount ?? 0}
                        totalCount={stats.totalBadgeCount ?? 0}
                      />
                    </div>
                  </>
                )}

                {/* Receipt footer */}
                <div className="border-t border-dashed border-[#2b2b2b]/20 px-6 py-4 text-center">
                  <p className="font-mono text-[10px] text-[#8a857c]">mitchellsgroupbuy.com</p>
                  <p className="font-mono text-[9px] text-[#8a857c] mt-0.5">
                    Thank you for being part of the GroupBuy family 🥩
                  </p>
                </div>
              </div>

              {/* Share button */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#2b2b2b] text-[#faf8f5] font-display text-[10px] tracking-widest py-3 hover:bg-[#3d3730] transition-colors"
                >
                  {copied ? <Check size={14} /> : <Share2 size={14} />}
                  {copied ? "LINK COPIED!" : "SHARE MY STATS"}
                </button>
                <button
                  onClick={() => { setSubmittedPhone(null); setPhone(""); }}
                  className="flex items-center justify-center gap-1.5 border border-[#2b2b2b]/20 text-[#5a5248] font-display text-[10px] tracking-widest px-4 py-3 hover:bg-[#2b2b2b]/5 transition-colors"
                >
                  <ChevronLeft size={13} />
                  BACK
                </button>
              </div>
            </div>
          )}

          {/* Info blurb */}
          {!stats && !isLoading && (
            <div className="mt-8 border border-[#2b2b2b]/10 bg-white/50 p-5">
              <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-3">HOW IT WORKS</p>
              <div className="space-y-2">
                {[
                  { icon: <ShoppingBag size={12} />, text: "Place orders through the GroupBuy drops" },
                  { icon: <DollarSign size={12} />, text: "Stats update after your orders are processed" },
                  { icon: <Flame size={12} />, text: "Build streaks by ordering in consecutive drops" },
                  { icon: <Star size={12} />, text: "Climb loyalty tiers: Fresh Cut → Regular → Loyal → OG → Legend" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[#c73e3a]">{item.icon}</span>
                    <span className="font-mono-brand text-[12px] text-[#5a5248]">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
