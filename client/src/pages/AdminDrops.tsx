/**
 * AdminDrops — Drops Management Page
 * Admin can: view active drop stats, create new drops, close active drop,
 * assign unassigned orders to a drop, and navigate to per-drop analytics.
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BarChart2, ChevronRight, Layers, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtCurrency(n: number) {
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDrops() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

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
            <button className="font-mono-brand text-[11px] text-[#8a857c] hover:text-[#f5f2ec] underline">
              Go home
            </button>
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

  return <DropsContent onNavigate={navigate} />;
}

// ─── Drops Content ────────────────────────────────────────────────────────────
function DropsContent({ onNavigate }: { onNavigate: (path: string) => void }) {
  const utils = trpc.useUtils();
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  const { data: drops, isLoading } = trpc.admin.drops.list.useQuery();
  const { data: allDropsSummary } = trpc.admin.analytics.allDropsSummary.useQuery();

  const activeDrop = drops?.find(d => d.isActive);
  const activeSummary = allDropsSummary?.find(d => d.id === activeDrop?.id);
  const pastDrops = (allDropsSummary ?? []).filter(d => !d.isActive);

  // Next drop name
  const nextDropNum = (drops?.length ?? 0) + 1;
  const nextDropName = `Drop ${nextDropNum}`;

  const createDrop = trpc.admin.drops.create.useMutation({
    onSuccess: () => {
      toast.success(`${nextDropName} created and activated`);
      utils.admin.drops.list.invalidate();
      utils.admin.analytics.allDropsSummary.invalidate();
      setConfirmNew(false);
    },
    onError: () => toast.error("Failed to create drop"),
  });

  const closeDrop = trpc.admin.drops.close.useMutation({
    onSuccess: () => {
      toast.success("Drop closed");
      utils.admin.drops.list.invalidate();
      utils.admin.analytics.allDropsSummary.invalidate();
      setConfirmClose(false);
    },
    onError: () => toast.error("Failed to close drop"),
  });

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
            <Layers size={14} className="text-[#c73e3a]" />
            <span className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
              DROPS
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

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-[22px] tracking-widest text-[#f5f2ec]">DROPS</h1>
            <p className="font-mono-brand text-[11px] text-[#8a857c] mt-1">
              Manage Power-Drop cycles — one active at a time. New orders auto-tag to the active drop.
            </p>
          </div>
          {/* New Drop button */}
          <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className="font-display text-[10px] tracking-widest bg-[#c73e3a] hover:bg-[#a83330] text-white gap-1.5"
              >
                <Plus size={13} />
                New Drop
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="section-ink border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">
                  Create {nextDropName}?
                </AlertDialogTitle>
                <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                  {activeDrop
                    ? `This will deactivate ${activeDrop.name} and activate ${nextDropName}. All new orders will be tagged to ${nextDropName}.`
                    : `${nextDropName} will be created and set as active. All new orders will be tagged to it.`}
                </AlertDialogDescription>
                <div className="mt-3 bg-white/5 border border-white/10 px-4 py-3">
                  <div className="font-mono-brand text-[10px] text-[#8a857c] mb-1">NEW DROP NAME</div>
                  <div className="font-display text-[28px] tracking-widest text-[#f5f2ec]">{nextDropName}</div>
                </div>
                {activeDrop && (
                  <div className="mt-2 bg-[#c73e3a]/10 border border-[#c73e3a]/30 px-3 py-2 font-mono-brand text-[11px] text-[#e07070]">
                    ⚠ {activeDrop.name} will be deactivated and closed.
                  </div>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="font-display text-[10px] tracking-widest bg-[#c73e3a] hover:bg-[#a83330] text-white"
                  onClick={() => createDrop.mutate({ name: nextDropName })}
                  disabled={createDrop.isPending}
                >
                  {createDrop.isPending ? "Creating…" : `Create & Activate ${nextDropName}`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {isLoading && (
          <div className="font-mono-brand text-[11px] text-[#8a857c]">Loading drops…</div>
        )}

        {/* Active drop banner */}
        {activeDrop && activeSummary && (
          <div className="border border-[#c73e3a]/40 bg-[#c73e3a]/10 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1.5 bg-[#c73e3a] text-white font-mono-brand text-[9px] tracking-widest px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    ACTIVE
                  </span>
                </div>
                <div className="font-display text-[22px] tracking-widest text-[#f5f2ec]">
                  {activeDrop.name}
                </div>
                <div className="font-mono-brand text-[10px] text-[#8a857c] mt-1">
                  Started {fmtDate(activeDrop.createdAt)}
                </div>
              </div>
              {/* Live stats */}
              <div className="flex gap-8 flex-wrap">
                {[
                  { label: "ORDERS PLACED", value: fmt(activeSummary.placed) },
                  { label: "ORDERS PAID", value: fmt(activeSummary.paid) },
                  { label: "CONVERSION", value: `${activeSummary.conversionRate}%` },
                  { label: "REVENUE", value: fmtCurrency(activeSummary.revenue) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">{label}</div>
                    <div className="font-display text-[20px] tracking-wide text-[#f5f2ec]">{value}</div>
                  </div>
                ))}
              </div>
              {/* Actions */}
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => onNavigate(`/admin/drops/${activeDrop.id}`)}
                  className="flex items-center gap-1.5 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] border border-white/10 hover:border-white/25 px-3 py-1.5 transition-colors"
                >
                  <BarChart2 size={12} />
                  View Analytics
                </button>
                <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-1.5 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#e07070] border border-white/10 hover:border-[#e07070]/40 px-3 py-1.5 transition-colors">
                      <X size={12} />
                      Close Drop
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="section-ink border-white/10">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">
                        Close {activeDrop.name}?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                        No new orders will be tagged to it. Existing orders are unaffected. You can create a new drop at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="font-display text-[10px] tracking-widest bg-transparent border border-[#e05c5c]/50 text-[#e05c5c] hover:bg-[#e05c5c]/10"
                        onClick={() => closeDrop.mutate({ id: activeDrop.id })}
                        disabled={closeDrop.isPending}
                      >
                        {closeDrop.isPending ? "Closing…" : `Close ${activeDrop.name}`}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        )}

        {!activeDrop && !isLoading && (
          <div className="border border-dashed border-white/15 p-5 text-center">
            <p className="font-mono-brand text-[11px] text-[#8a857c]">No active drop. Create one to start tagging new orders.</p>
          </div>
        )}

        {/* Past drops */}
        {pastDrops.length > 0 && (
          <div>
            <div className="font-display text-[12px] tracking-widest text-[#8a857c] mb-3">PAST DROPS</div>
            <div className="flex flex-col gap-2">
              {pastDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="border border-white/10 bg-white/[0.03] p-4 flex items-center gap-6 hover:border-white/20 transition-colors"
                >
                  {/* Drop name */}
                  <div className="min-w-[80px]">
                    <div className="font-mono-brand text-[9px] text-[#8a857c] tracking-widest">DROP</div>
                    <div className="font-display text-[22px] tracking-wide text-[#f5f2ec]">
                      {drop.name.replace(/^Drop\s*/i, "")}
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex gap-8 flex-1 flex-wrap">
                    {[
                      { label: "ORDERS", value: fmt(drop.placed) },
                      { label: "PAID", value: fmt(drop.paid) },
                      { label: "CONVERSION", value: `${drop.conversionRate}%` },
                      { label: "REVENUE", value: fmtCurrency(drop.revenue) },
                      { label: "AVG ORDER", value: fmtCurrency(drop.avgOrderValue) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">{label}</div>
                        <div className="font-mono-brand text-[13px] text-[#f5f2ec]">{value}</div>
                      </div>
                    ))}
                    <div>
                      <div className="font-mono-brand text-[9px] tracking-widest text-[#8a857c]">PERIOD</div>
                      <div className="font-mono-brand text-[11px] text-[#8a857c]">
                        {fmtDate(drop.createdAt)} – {fmtDate(drop.closedAt)}
                      </div>
                    </div>
                  </div>
                  {/* Conversion bar */}
                  <div className="hidden sm:block w-20">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#25D366] rounded-full"
                        style={{ width: `${drop.conversionRate}%` }}
                      />
                    </div>
                    <div className="font-mono-brand text-[9px] text-[#8a857c] mt-1 text-right">{drop.conversionRate}%</div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono-brand text-[9px] tracking-widest text-[#8a857c] border border-white/10 px-2 py-1">
                      CLOSED
                    </span>
                    <button
                      onClick={() => onNavigate(`/admin/drops/${drop.id}`)}
                      className="flex items-center gap-1 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] border border-white/10 hover:border-white/25 px-3 py-1.5 transition-colors"
                    >
                      <BarChart2 size={11} />
                      Analytics
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unassigned orders note */}
        <UnassignedOrdersCard drops={drops ?? []} />
      </div>
    </div>
  );
}

// ─── Unassigned Orders Card ───────────────────────────────────────────────────
function UnassignedOrdersCard({ drops }: { drops: { id: number; name: string; isActive: boolean }[] }) {
  const utils = trpc.useUtils();
  const { data: allOrders } = trpc.admin.orders.list.useQuery();
  const assignOrder = trpc.admin.drops.assignOrder.useMutation({
    onSuccess: () => {
      toast.success("Order assigned");
      utils.admin.orders.list.invalidate();
    },
    onError: () => toast.error("Failed to assign order"),
  });

  const unassigned = (allOrders ?? []).filter(o => o.dropId == null);
  if (unassigned.length === 0) return null;

  return (
    <div className="border border-dashed border-white/15 p-4">
      <div className="font-display text-[12px] tracking-widest text-[#8a857c] mb-3">
        UNASSIGNED ORDERS ({unassigned.length})
      </div>
      <p className="font-mono-brand text-[11px] text-[#8a857c] mb-4">
        These orders were placed before drops were introduced. Assign them to a drop manually.
      </p>
      <div className="flex flex-col gap-2">
        {unassigned.slice(0, 10).map(order => (
          <div key={order.id} className="flex items-center justify-between gap-4 border border-white/8 bg-white/[0.02] px-3 py-2">
            <div>
              <span className="font-mono-brand text-[11px] text-[#f5f2ec]">{order.phone}</span>
              <span className="font-mono-brand text-[10px] text-[#8a857c] ml-3">{order.status.toUpperCase()}</span>
            </div>
            {drops.length > 0 && (
              <select
                className="bg-transparent border border-white/15 text-[#8a857c] font-mono-brand text-[10px] px-2 py-1 focus:outline-none focus:border-white/30"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    assignOrder.mutate({ orderId: order.id, dropId: parseInt(e.target.value) });
                  }
                }}
              >
                <option value="" disabled>Assign to drop…</option>
                {drops.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
        ))}
        {unassigned.length > 10 && (
          <p className="font-mono-brand text-[10px] text-[#8a857c]">…and {unassigned.length - 10} more</p>
        )}
      </div>
    </div>
  );
}
