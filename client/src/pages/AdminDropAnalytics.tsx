/**
 * AdminDropAnalytics — Per-drop analytics page
 * Shows KPI bar, order funnel, fulfilment split, top products,
 * repeat customers, order size distribution, items per order, and cancellations.
 */
import { useParams, Link } from "wouter";
import { ArrowLeft, BarChart2, Package, TrendingUp, Users, MapPin, ShoppingCart, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(n: number) {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDropAnalytics() {
  const { user, loading } = useAuth();
  const params = useParams<{ dropId: string }>();
  const rawId = params.dropId ? parseInt(params.dropId, 10) : NaN;
  const dropId = Number.isFinite(rawId) ? rawId : null;

  if (loading) {
    return (
      <div className="min-h-screen section-ink flex items-center justify-center">
        <div className="font-mono-brand text-[#8a857c] text-[12px]">Loading…</div>
      </div>
    );
  }
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen section-ink flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-display text-[11px] tracking-widest text-[#c73e3a]">ACCESS DENIED</p>
          <p className="font-mono-brand text-[12px] text-[#8a857c]">Admin access required.</p>
          <Link href="/">
            <button className="font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] underline">Go home</button>
          </Link>
          <br />
          <button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] underline"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return <AnalyticsContent dropId={dropId} />;
}

// ─── Analytics Content ────────────────────────────────────────────────────────
function AnalyticsContent({ dropId }: { dropId: number | null }) {
  const { data: stats, isLoading } = trpc.admin.analytics.dropStats.useQuery(
    { dropId },
    { enabled: dropId !== null }
  );

  if (dropId === null) {
    return (
      <div className="min-h-screen section-ink flex items-center justify-center">
        <p className="font-mono-brand text-[#8a857c] text-[12px]">Invalid drop ID.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-ink">
      {/* Top bar */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/drops">
            <button className="flex items-center gap-1.5 font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
              <ArrowLeft size={13} />
              Drops
            </button>
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-[#c73e3a]" />
            <span className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
              {stats?.drop?.name?.toUpperCase() ?? "ANALYTICS"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <button className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
              Order Management →
            </button>
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="font-mono-brand text-[11px] text-[#8a857c]">Loading analytics…</div>
        </div>
      )}

      {stats && (
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* Page header */}
          <div>
            <h1 className="font-display text-[22px] tracking-widest text-[#f5f2ec]">
              {stats.drop?.name?.toUpperCase() ?? "DROP"} ANALYTICS
            </h1>
            <p className="font-mono-brand text-[10px] text-[#8a857c] mt-1">
              {fmtDate(stats.drop?.createdAt)} – {stats.drop?.isActive ? "Active" : fmtDate(stats.drop?.closedAt)}
            </p>
          </div>

          {/* KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px border border-white/10 bg-white/10">
            {[
              { label: "ORDERS PLACED", value: String(stats.placed), icon: <Package size={13} /> },
              { label: "ORDERS PAID", value: String(stats.paid), icon: <TrendingUp size={13} /> },
              { label: "CONVERSION", value: `${stats.conversionRate}%`, icon: <BarChart2 size={13} /> },
              { label: "REVENUE", value: fmtCurrency(stats.revenue), icon: <TrendingUp size={13} /> },
              { label: "AVG ORDER", value: fmtCurrency(stats.avgOrderValue), icon: <ShoppingCart size={13} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-[#1a1714] px-4 py-4">
                <div className="flex items-center gap-1.5 font-mono-brand text-[9px] tracking-widest text-[#8a857c] mb-2">
                  {icon}
                  {label}
                </div>
                <div className="font-display text-[22px] tracking-wide text-[#f5f2ec]">{value}</div>
              </div>
            ))}
          </div>

          {/* Order Funnel + Fulfilment Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Funnel */}
            <SectionCard title="ORDER FUNNEL" icon={<BarChart2 size={12} />}>
              <div className="space-y-2">
                {[
                  { label: "Placed", count: stats.placed, color: "bg-white/20" },
                  { label: "Paid", count: stats.paid, color: "bg-[#25D366]" },
                  { label: "Pending", count: stats.pending, color: "bg-yellow-500/60" },
                  { label: "Cancelled", count: stats.cancelled, color: "bg-[#c73e3a]/60" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-20 font-mono-brand text-[10px] text-[#8a857c]">{label}</div>
                    <div className="flex-1 h-4 bg-white/5 overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all`}
                        style={{ width: stats.placed > 0 ? `${pct(count, stats.placed)}%` : "0%" }}
                      />
                    </div>
                    <div className="w-8 text-right font-mono-brand text-[11px] text-[#f5f2ec]">{count}</div>
                    <div className="w-8 text-right font-mono-brand text-[10px] text-[#8a857c]">
                      {pct(count, stats.placed)}%
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Fulfilment */}
            <SectionCard title="FULFILMENT SPLIT" icon={<MapPin size={12} />}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-20 font-mono-brand text-[10px] text-[#8a857c]">Pickup</div>
                  <div className="flex-1 h-4 bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-[#c73e3a]/70 transition-all"
                      style={{ width: stats.placed > 0 ? `${pct(stats.pickupCount, stats.placed)}%` : "0%" }}
                    />
                  </div>
                  <div className="w-8 text-right font-mono-brand text-[11px] text-[#f5f2ec]">{stats.pickupCount}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 font-mono-brand text-[10px] text-[#8a857c]">Delivery</div>
                  <div className="flex-1 h-4 bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-blue-400/60 transition-all"
                      style={{ width: stats.placed > 0 ? `${pct(stats.deliveryCount, stats.placed)}%` : "0%" }}
                    />
                  </div>
                  <div className="w-8 text-right font-mono-brand text-[11px] text-[#f5f2ec]">{stats.deliveryCount}</div>
                </div>
                {stats.locationBreakdown.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/8 space-y-1.5">
                    <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c] mb-2">BY LOCATION</div>
                    {stats.locationBreakdown.map(({ name, count }) => (
                      <div key={name} className="flex justify-between font-mono-brand text-[10px]">
                        <span className="text-[#8a857c]">{name}</span>
                        <span className="text-[#f5f2ec]">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Top Products */}
          {stats.topProducts.length > 0 && (
            <SectionCard title="TOP PRODUCTS" icon={<Package size={12} />}>
              <div className="space-y-2">
                {stats.topProducts.map((product, i) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="w-5 font-mono-brand text-[10px] text-[#8a857c] text-right">{i + 1}</div>
                    <div className="flex-1 font-mono-brand text-[11px] text-[#f5f2ec] truncate">{product.name}</div>
                    <div className="flex-1 h-2 bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-[#c73e3a]/60 transition-all"
                        style={{ width: stats.topProducts[0].count > 0 ? `${pct(product.count, stats.topProducts[0].count)}%` : "0%" }}
                      />
                    </div>
                    <div className="w-8 text-right font-mono-brand text-[10px] text-[#8a857c]">{product.count}×</div>
                    <div className="w-16 text-right font-mono-brand text-[10px] text-[#8a857c]">
                      {fmtCurrency(product.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Order Size Distribution + Items Per Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SectionCard title="ORDER SIZE" icon={<ShoppingCart size={12} />}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "MEDIAN", value: fmtCurrency(stats.medianOrderValue) },
                  { label: "HIGHEST", value: fmtCurrency(stats.maxOrderValue) },
                  { label: "LOWEST", value: fmtCurrency(stats.minOrderValue) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">{label}</div>
                    <div className="font-mono-brand text-[13px] text-[#f5f2ec]">{value}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {stats.orderSizeBuckets.map((bucket) => (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <div className="w-24 font-mono-brand text-[9px] text-[#8a857c]">{bucket.label}</div>
                    <div className="flex-1 h-3 bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-[#c73e3a]/50 transition-all"
                        style={{ width: stats.placed > 0 ? `${pct(bucket.count, stats.placed)}%` : "0%" }}
                      />
                    </div>
                    <div className="w-6 text-right font-mono-brand text-[10px] text-[#8a857c]">{bucket.count}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="ITEMS PER ORDER" icon={<ShoppingCart size={12} />}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "AVERAGE", value: stats.avgItemsPerOrder.toFixed(1) },
                  { label: "MOST COMMON", value: stats.mostCommonItemCount ? String(stats.mostCommonItemCount.count) : "—" },
                  { label: "MAX", value: String(stats.maxItemsPerOrder) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">{label}</div>
                    <div className="font-mono-brand text-[13px] text-[#f5f2ec]">{value}</div>
                  </div>
                ))}
              </div>
              {stats.itemCountDistribution.length > 0 && (
                <div className="space-y-1.5">
                  {stats.itemCountDistribution.map(({ count, orders }) => (
                    <div key={count} className="flex items-center gap-3">
                      <div className="w-16 font-mono-brand text-[9px] text-[#8a857c]">{count} item{count !== 1 ? "s" : ""}</div>
                      <div className="flex-1 h-3 bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-[#c73e3a]/50 transition-all"
                          style={{ width: stats.placed > 0 ? `${pct(orders, stats.placed)}%` : "0%" }}
                        />
                      </div>
                      <div className="w-6 text-right font-mono-brand text-[10px] text-[#8a857c]">{orders}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Repeat Customers */}
          {stats.repeatCustomerCount > 0 && (
            <SectionCard title="REPEAT CUSTOMERS" icon={<Users size={12} />}>
              <div className="flex gap-8 mb-4">
                <div>
                  <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">RETURNING</div>
                  <div className="font-display text-[22px] tracking-wide text-[#f5f2ec]">{stats.repeatCustomerCount}</div>
                </div>
                <div>
                  <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">RETENTION RATE</div>
                  <div className="font-display text-[22px] tracking-wide text-[#f5f2ec]">
                    {pct(stats.repeatCustomerCount, stats.placed)}%
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {stats.repeatCustomers.map((c) => (
                  <div key={c.phone} className="flex items-center justify-between border border-white/8 bg-white/[0.02] px-3 py-2">
                    <span className="font-mono-brand text-[11px] text-[#f5f2ec]">{c.phone}</span>
                    <div className="flex gap-6">
                      <div>
                        <div className="font-mono-brand text-[9px] text-[#8a857c]">DROPS</div>
                        <div className="font-mono-brand text-[11px] text-[#f5f2ec]">{c.dropCount}</div>
                      </div>
                      <div>
                        <div className="font-mono-brand text-[9px] text-[#8a857c]">LIFETIME REV</div>
                        <div className="font-mono-brand text-[11px] text-[#f5f2ec]">{fmtCurrency(c.totalRevenue)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Cancellations */}
          {stats.cancelled > 0 && (
            <SectionCard title="CANCELLATIONS & UNPAID" icon={<XCircle size={12} />}>
              <div className="flex gap-8 mb-4">
                <div>
                  <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">CANCELLED</div>
                  <div className="font-display text-[22px] tracking-wide text-[#c73e3a]">{stats.cancelled}</div>
                </div>
                <div>
                  <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">CANCELLATION RATE</div>
                  <div className="font-display text-[22px] tracking-wide text-[#f5f2ec]">
                    {pct(stats.cancelled, stats.placed)}%
                  </div>
                </div>
                <div>
                  <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">EST. LOST REVENUE</div>
                  <div className="font-display text-[22px] tracking-wide text-[#f5f2ec]">{fmtCurrency(stats.lostRevenue)}</div>
                </div>
              </div>
              {stats.cancelledOrders.length > 0 && (
                <div className="space-y-2">
                  {stats.cancelledOrders.map((o, i) => (
                    <div key={i} className="flex items-center justify-between border border-white/8 bg-white/[0.02] px-3 py-2">
                      <span className="font-mono-brand text-[11px] text-[#f5f2ec]">{o.phone}</span>
                      <span className="font-mono-brand text-[10px] text-[#8a857c]">{o.summary}</span>
                      <span className="font-mono-brand text-[11px] text-[#8a857c]">{fmtCurrency(o.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {stats.placed === 0 && (
            <div className="border border-dashed border-white/15 p-8 text-center">
              <p className="font-mono-brand text-[11px] text-[#8a857c]">No orders have been assigned to this drop yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-1.5 font-mono-brand text-[9px] tracking-widest text-[#8a857c] mb-4">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
