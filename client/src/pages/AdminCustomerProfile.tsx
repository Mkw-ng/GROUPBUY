/**
 * AdminCustomerProfile — full customer profile with all analytics stats.
 * Route: /admin/customers/:phone
 */
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Users,
  ShoppingBag,
  DollarSign,
  Scale,
  Flame,
  Trophy,
  Star,
  MapPin,
  Calendar,
  TrendingUp,
  Zap,
} from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  Legend: "text-yellow-300 border-yellow-300/40 bg-yellow-300/10",
  OG: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  Loyal: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  Regular: "text-green-400 border-green-400/40 bg-green-400/10",
  "Fresh Cut": "text-[#c73e3a] border-[#c73e3a]/40 bg-[#c73e3a]/10",
  New: "text-[#8a857c] border-white/20 bg-white/5",
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#c73e3a]">{icon}</span>
        <p className="font-display text-[9px] tracking-widest text-[#8a857c]">{label}</p>
      </div>
      <p className="font-mono-brand text-[20px] font-bold text-[#f5f2ec]">{value}</p>
      {sub && <p className="font-mono-brand text-[10px] text-[#8a857c] mt-0.5">{sub}</p>}
    </div>
  );
}

function locationLabel(location: string, deliveryAddress: string | null) {
  if (location === "delivery") return deliveryAddress ? `Delivery: ${deliveryAddress}` : "Delivery";
  if (location === "cranbourne") return "Cranbourne";
  if (location === "clayton") return "Clayton";
  return location;
}

export default function AdminCustomerProfile() {
  const params = useParams<{ phone: string }>();
  const phone = decodeURIComponent(params.phone ?? "");

  const { data: customer, isLoading } = trpc.customers.get.useQuery(
    { phone },
    { enabled: !!phone }
  );
  const { data: orders, isLoading: ordersLoading } = trpc.customers.getOrders.useQuery(
    { phone },
    { enabled: !!phone }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen section-ink flex items-center justify-center">
        <p className="font-mono-brand text-[13px] text-[#8a857c] animate-pulse">Loading profile…</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen section-ink flex flex-col items-center justify-center gap-4">
        <Users size={40} className="text-[#8a857c]" />
        <p className="font-mono-brand text-[13px] text-[#8a857c]">Customer not found for {phone}</p>
        <Link href="/admin/customers">
          <button className="font-mono-brand text-[11px] text-[#c73e3a] hover:underline">
            ← Back to Customers
          </button>
        </Link>
      </div>
    );
  }

  const tier = customer.loyaltyTier;
  const tierColor = TIER_COLORS[tier.tier] || TIER_COLORS.New;
  const avgOrderValue =
    customer.totalOrders > 0
      ? (parseFloat(customer.totalSpend) / customer.totalOrders).toFixed(2)
      : "0.00";

  let favouriteItems: string[] = [];
  try {
    favouriteItems = JSON.parse(customer.favouriteItems || "[]");
  } catch {
    favouriteItems = [];
  }

  let biggestSingleItem: { name: string; qty: number; orderId: number } | null = null;
  try {
    if (customer.biggestSingleItem) {
      biggestSingleItem = JSON.parse(customer.biggestSingleItem);
    }
  } catch {
    biggestSingleItem = null;
  }

  return (
    <div className="min-h-screen section-ink">
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers">
            <button className="flex items-center gap-1.5 font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
              <ArrowLeft size={13} />
              Customers
            </button>
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#c73e3a]" />
            <span className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
              CUSTOMER PROFILE
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="border border-white/10 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono-brand text-[22px] font-bold text-[#f5f2ec]">
                  {phone}
                </span>
                {customer.name && (
                  <span className="font-mono-brand text-[16px] text-[#c73e3a]/80">
                    {customer.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {customer.firstOrderDate && (
                  <span className="font-mono-brand text-[11px] text-[#8a857c]">
                    First order: {new Date(customer.firstOrderDate).toLocaleDateString()}
                  </span>
                )}
                {customer.lastOrderDate && (
                  <span className="font-mono-brand text-[11px] text-[#8a857c]">
                    Last order: {new Date(customer.lastOrderDate).toLocaleDateString()}
                  </span>
                )}
                {customer.preferredLocation && (
                  <span className="flex items-center gap-1 font-mono-brand text-[11px] text-[#8a857c]">
                    <MapPin size={10} />
                    {customer.preferredLocation}
                  </span>
                )}
              </div>
            </div>
            {/* Loyalty tier badge */}
            <div className={`border px-4 py-3 text-center ${tierColor}`}>
              <p className="font-mono-brand text-[28px]">{tier.emoji}</p>
              <p className="font-display text-[11px] tracking-widest mt-1">{tier.tier.toUpperCase()}</p>
              {tier.dropsToNext != null && (
                <p className="font-mono-brand text-[9px] text-[#8a857c] mt-1">
                  {tier.dropsToNext} more to {tier.next}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div>
          <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-3">KEY STATS</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<ShoppingBag size={14} />}
              label="TOTAL ORDERS"
              value={customer.totalOrders}
            />
            <StatCard
              icon={<DollarSign size={14} />}
              label="TOTAL SPEND"
              value={`$${parseFloat(customer.totalSpend).toFixed(2)}`}
            />
            <StatCard
              icon={<TrendingUp size={14} />}
              label="AVG ORDER VALUE"
              value={`$${avgOrderValue}`}
            />
            <StatCard
              icon={<Scale size={14} />}
              label="TOTAL KG"
              value={`${parseFloat(customer.totalKg).toFixed(1)} kg`}
            />
            <StatCard
              icon={<Trophy size={14} />}
              label="LARGEST ORDER"
              value={`$${parseFloat(customer.largestOrder).toFixed(2)}`}
            />
            <StatCard
              icon={<DollarSign size={14} />}
              label="SMALLEST ORDER"
              value={`$${parseFloat(customer.smallestOrder).toFixed(2)}`}
            />
            <StatCard
              icon={<Flame size={14} />}
              label="CURRENT STREAK"
              value={`${customer.currentStreak} drop${customer.currentStreak !== 1 ? "s" : ""}`}
            />
            <StatCard
              icon={<Star size={14} />}
              label="LONGEST STREAK"
              value={`${customer.longestStreak} drop${customer.longestStreak !== 1 ? "s" : ""}`}
            />
            {customer.powerDropsAttended > 0 && (
              <StatCard
                icon={<Zap size={14} />}
                label="POWER DROPS"
                value={customer.powerDropsAttended}
              />
            )}
          </div>
        </div>

        {/* Favourite items */}
        {favouriteItems.length > 0 && (
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-3">FAVOURITE ITEMS</p>
            <div className="border border-white/10 p-4 flex flex-wrap gap-2">
              {favouriteItems.map((item, i) => (
                <span
                  key={i}
                  className="font-mono-brand text-[11px] border border-white/15 px-3 py-1.5 text-[#f5f2ec]"
                >
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•"} {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Biggest single item */}
        {biggestSingleItem && (
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-3">BIGGEST SINGLE ITEM</p>
            <div className="border border-white/10 p-4">
              <span className="font-mono-brand text-[14px] text-[#f5f2ec]">
                {biggestSingleItem.name} × {biggestSingleItem.qty}
              </span>
              <span className="font-mono-brand text-[11px] text-[#8a857c] ml-3">
                Order #{biggestSingleItem.orderId}
              </span>
            </div>
          </div>
        )}

        {/* Order history */}
        <div>
          <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-3">ORDER HISTORY</p>
          {ordersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-white/10 p-4 animate-pulse h-12" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="border border-white/10 p-6 text-center">
              <p className="font-mono-brand text-[12px] text-[#8a857c]">No orders found.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {orders.map((o) => {
                let items: Array<{ name: string; qty: number; price: string; finalWeightKg?: string; unit?: string }> = [];
                try { items = JSON.parse(o.items || "[]"); } catch { items = []; }
                const total = items.reduce((s, item) => {
                  const p = parseFloat(item.price) || 0;
                  const kg = item.unit?.toLowerCase().includes("kg");
                  const w = parseFloat(item.finalWeightKg || "") || 0;
                  return s + (kg && w > 0 ? p * w : p * item.qty);
                }, 0) + (parseFloat(String(o.deliveryCharge || "0")) || 0);

                const statusColors: Record<string, string> = {
                  paid: "text-green-400 border-green-400/30",
                  pending: "text-yellow-400 border-yellow-400/30",
                  cancelled: "text-red-400 border-red-400/30",
                };

                return (
                  <div key={o.id} className="border border-white/10 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono-brand text-[12px] font-bold text-[#f5f2ec]">
                          #{o.id}
                        </span>
                        <span className={`font-mono-brand text-[10px] border px-2 py-0.5 ${statusColors[o.status] || ""}`}>
                          {o.status.toUpperCase()}
                        </span>
                        {o.isPowerDrop && (
                          <span className="flex items-center gap-0.5 font-mono-brand text-[9px] text-[#c73e3a] border border-[#c73e3a]/40 px-1.5 py-0.5">
                            <Zap size={8} className="fill-current" />
                            PD
                          </span>
                        )}
                        {o.archived && (
                          <span className="font-mono-brand text-[9px] text-[#8a857c] border border-white/15 px-1.5 py-0.5">
                            ARCHIVED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="font-mono-brand text-[11px] text-[#8a857c]">
                          <Calendar size={9} className="inline mr-1" />
                          {o.pickupDate}
                        </span>
                        <span className="font-mono-brand text-[11px] text-[#8a857c]">
                          <MapPin size={9} className="inline mr-1" />
                          {locationLabel(o.location, o.deliveryAddress)}
                        </span>
                        <span className="font-mono-brand text-[11px] text-[#8a857c]">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono-brand text-[14px] font-bold text-[#f5f2ec]">
                        ${total.toFixed(2)}
                      </p>
                      <p className="font-mono-brand text-[10px] text-[#8a857c]">
                        {items.length} item{items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
