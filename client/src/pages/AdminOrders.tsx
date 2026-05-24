/*
 * AdminOrders — Order Management Page
 * Lists all customer orders received through the cart checkout.
 * Admin can: enter final weights per item, set delivery charge,
 * issue a WhatsApp invoice, mark as paid, or cancel/delete the order.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  MessageCircle,
  CheckCircle2,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Zap,
  Package,
  Clock,
  Ban,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: number;
  name: string;
  cut: string;
  qty: number;
  price: string;
  unit: string;
  finalWeightKg?: string;
}

interface Order {
  id: number;
  phone: string;
  pickupDate: string;
  location: string;
  deliveryAddress: string | null;
  items: string;
  specialInstructions: string | null;
  deliveryCharge: string | null;
  status: "pending" | "paid" | "cancelled";
  isPowerDrop: boolean;
  archived: boolean | null;
  customerName: string | null;
  createdAt: Date;
}

type StatusFilter = "all" | "pending" | "paid" | "cancelled" | "archived";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseItems(raw: string): OrderItem[] {
  try {
    return JSON.parse(raw) as OrderItem[];
  } catch {
    return [];
  }
}

function locationLabel(location: string, address: string | null): string {
  if (location === "delivery") return `Delivery${address ? ` — ${address}` : ""}`;
  if (location === "cranbourne") return "Cranbourne";
  if (location === "clayton") return "Clayton";
  return location;
}

function calcItemTotal(item: OrderItem): number {
  const price = parseFloat(item.price) || 0;
  const weight = parseFloat(item.finalWeightKg || "") || 0;
  // If a final weight/qty override is entered, use it; otherwise fall back to ordered qty
  if (weight > 0) return price * weight;
  return price * item.qty;
}

function buildInvoiceMessage(
  order: Order,
  items: OrderItem[],
  deliveryCharge: string,
  bankDetails: string,
  openingSentence: string
): string {
  const locationStr = locationLabel(order.location, order.deliveryAddress);
  const itemLines = items.map((item) => {
    const price = parseFloat(item.price) || 0;
    const isPerKg = item.unit?.toLowerCase().includes("kg");
    const weight = parseFloat(item.finalWeightKg || "") || 0;
    const total = calcItemTotal(item);
    // Use final entered value if set; otherwise fall back to original ordered qty
    const finalVal = weight > 0 ? weight : item.qty;
    const unit = isPerKg && weight > 0 ? "kg" : "";
    const weightStr = ` × ${finalVal}${unit}`;
    return `${item.name}${weightStr} @ $${price.toFixed(2)}${item.unit} = *$${total.toFixed(2)}*`;
  });

  const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
  const delivery = parseFloat(deliveryCharge) || 0;
  const grandTotal = subtotal + delivery;

  const parts: string[] = [
    openingSentence,
    ``,
    `*Order #:* ${order.phone}`,
    `*Pick-up Date:* ${order.pickupDate}`,
    `*Location:* ${locationStr}`,
    ``,
    `*Items:*`,
    ...itemLines,
    ``,
  ];

  if (delivery > 0) {
    parts.push(`*Subtotal:* $${subtotal.toFixed(2)}`);
    parts.push(`*Delivery:* $${delivery.toFixed(2)}`);
  }
  parts.push(`*Total Due: $${grandTotal.toFixed(2)}*`);

  if (order.specialInstructions) {
    parts.push(``);
    parts.push(`*Notes:* ${order.specialInstructions}`);
  }

  if (bankDetails.trim()) {
    parts.push(``);
    parts.push(`*Payment Details:*`);
    parts.push(bankDetails.trim());
  }

  if (order.isPowerDrop) {
    parts.push(``);
    parts.push(`⚡ Power Drop pricing applied`);
  }

  return parts.join("\n");
}

// ─── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  bankDetails,
  onRefresh,
}: {
  order: Order;
  bankDetails: string;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(true);
  const [items, setItems] = useState<OrderItem[]>(() => parseItems(order.items));
  const [deliveryCharge, setDeliveryCharge] = useState(order.deliveryCharge ?? "0");
  const [customerName, setCustomerName] = useState(order.customerName ?? "");
  const [editingName, setEditingName] = useState(false);
  const updateCustomerName = trpc.admin.orders.updateCustomerName.useMutation({
    onSuccess: () => {
      toast.success("Customer name saved");
      utils.admin.orders.list.invalidate();
      setEditingName(false);
    },
    onError: () => toast.error("Failed to save name"),
  });
  const [savingWeights, setSavingWeights] = useState(false);
  const [confirmSaveWeights, setConfirmSaveWeights] = useState(false);
  const [confirmSaveDelivery, setConfirmSaveDelivery] = useState(false);
  const [confirmInvoice, setConfirmInvoice] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [confirmPrep, setConfirmPrep] = useState(false);
  const [confirmFinalCall, setConfirmFinalCall] = useState(false);
  const [confirmDayOf, setConfirmDayOf] = useState(false);
  const defaultOpening = order.isPowerDrop
    ? `We got your GroupBuy Power-Drop order!

Here's how to lock it in:
1. Invoice and payment details are down below
2. Send me a photo remittance before this Saturday

* Ensure payment is made by this Saturday to avoid cancellation
* From there you'll be set for your pick up or delivery date the next week
* You'll get another message from me to let you know its all on track`
    : `We got your casual order!

1. Its scheduled in for pick up at *${locationLabel(order.location, order.deliveryAddress)}* on *${order.pickupDate}*
2. Payments can be sorted in store.
* If it is a delivery you'll receive an invoice. This needs to be sorted before delivery can take place. Send me the remittance`;
  const [openingSentence, setOpeningSentence] = useState(defaultOpening);

  const updateItems = trpc.admin.orders.updateItems.useMutation({
    onSuccess: () => {
      toast.success("Weights saved");
      utils.admin.orders.list.invalidate();
    },
    onError: () => toast.error("Failed to save weights"),
  });

  const setDeliveryChargeMut = trpc.admin.orders.setDeliveryCharge.useMutation({
    onSuccess: () => {
      toast.success("Delivery charge updated");
      utils.admin.orders.list.invalidate();
    },
    onError: () => toast.error("Failed to update delivery charge"),
  });

  const [pendingPaidOrder, setPendingPaidOrder] = useState<{phone: string; pickupDate: string; location: string; deliveryAddress: string | null} | null>(null);
  const markPaid = trpc.admin.orders.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Order marked as paid ✓");
      utils.admin.orders.list.invalidate();
      if (pendingPaidOrder) {
        const locStr = locationLabel(pendingPaidOrder.location, pendingPaidOrder.deliveryAddress);
        const msg = `Your payment for the GroupBuy Power-Drop order has been received and is now locked-in.\nSee you next week (${pendingPaidOrder.pickupDate}) at (${locStr})`;
        const intlPhone = pendingPaidOrder.phone.replace(/\D/g, "").replace(/^0/, "61");
        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
        setPendingPaidOrder(null);
      }
    },
    onError: () => { toast.error("Failed to mark as paid"); setPendingPaidOrder(null); },
  });

  const cancelOrder = trpc.admin.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success("Order cancelled");
      utils.admin.orders.list.invalidate();
    },
    onError: () => toast.error("Failed to cancel order"),
  });

  const deleteOrder = trpc.admin.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("Order deleted");
      utils.admin.orders.list.invalidate();
    },
    onError: () => toast.error("Failed to delete order"),
  });
  const archiveOrder = trpc.admin.orders.archive.useMutation({
    onSuccess: () => {
      toast.success("Order archived");
      utils.admin.orders.list.invalidate();
      utils.admin.orders.listArchived.invalidate();
    },
    onError: () => toast.error("Failed to archive order"),
  });
  const unarchiveOrder = trpc.admin.orders.unarchive.useMutation({
    onSuccess: () => {
      toast.success("Order restored");
      utils.admin.orders.list.invalidate();
      utils.admin.orders.listArchived.invalidate();
    },
    onError: () => toast.error("Failed to restore order"),
  });

  function handleWeightChange(idx: number, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, finalWeightKg: value } : item))
    );
  }

  async function handleSaveWeights() {
    setSavingWeights(true);
    await updateItems.mutateAsync({ id: order.id, items });
    setSavingWeights(false);
  }

  async function handleSaveDeliveryCharge() {
    await setDeliveryChargeMut.mutateAsync({ id: order.id, deliveryCharge });
  }

  function handleSendPrepMessage() {
    const locStr = locationLabel(order.location, order.deliveryAddress);
    const msg = `Just a heads up! \n\nYour order is now in preparation and everything is on track for your schedule: (${order.pickupDate}) at (${locStr})\n\nSee you then.`;
    const intlPhone = order.phone.replace(/^0/, "61").replace(/[^\d]/g, "");
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function handleIssueInvoice() {
    const msg = buildInvoiceMessage(order, items, deliveryCharge, bankDetails, openingSentence);
    const phone = order.phone.replace(/\D/g, "");
    const intlPhone = phone.startsWith("0") ? `61${phone.slice(1)}` : phone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
  const delivery = parseFloat(deliveryCharge) || 0;
  const grandTotal = subtotal + delivery;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    paid: "bg-green-500/20 text-green-400 border-green-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock size={11} />,
    paid: <CheckCircle2 size={11} />,
    cancelled: <Ban size={11} />,
  };

  const createdDate = new Date(order.createdAt).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="border border-white/10 bg-white/3 rounded-none overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono-brand text-[13px] font-bold text-[#f5f2ec]">
                {order.phone}
              </span>
              {order.isPowerDrop && (
                <span className="flex items-center gap-0.5 font-mono-brand text-[9px] text-[#c73e3a] border border-[#c73e3a]/40 px-1.5 py-0.5">
                  <Zap size={8} className="fill-current" />
                  PD
                </span>
              )}
            </div>
            <span className="font-mono-brand text-[11px] text-[#8a857c] mt-0.5">
              {locationLabel(order.location, order.deliveryAddress)} · {order.pickupDate}
            </span>
            {order.customerName && (
              <span className="font-mono-brand text-[11px] text-[#c73e3a]/80 mt-0.5">
                {order.customerName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`flex items-center gap-1 font-mono-brand text-[10px] border px-2 py-1 ${statusColors[order.status]}`}
          >
            {statusIcons[order.status]}
            {order.status.toUpperCase()}
          </span>
          <span className="font-mono-brand text-[11px] text-[#8a857c] hidden sm:block">
            {createdDate}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-[#8a857c]" />
          ) : (
            <ChevronDown size={14} className="text-[#8a857c]" />
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/10 px-5 py-5 space-y-5">
          {/* Items table */}
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-3">
              ITEMS ORDERED
            </p>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const isPerKg = item.unit?.toLowerCase().includes("kg");
                const lineTotal = calcItemTotal(item);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-[12px]"
                  >
                    {/* Item name */}
                    <div>
                      <span className="font-mono-brand text-[#f5f2ec]">
                        {item.qty}× {item.name}
                      </span>
                      {item.cut && (
                        <span className="text-[#8a857c] ml-1">({item.cut})</span>
                      )}
                    </div>

                    {/* Price per unit */}
                    <span className="font-mono-brand text-[#8a857c] text-right">
                      {"$"}{parseFloat(item.price).toFixed(2)}{item.unit}
                    </span>

                    {/* Final weight / qty override — shown for all items */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.finalWeightKg ?? ""}
                        onChange={(e) => handleWeightChange(idx, e.target.value)}
                        placeholder={String(item.qty)}
                        className="w-20 bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[11px] px-2 py-1.5 placeholder-[#8a857c]/50 focus:outline-none focus:border-[#c73e3a]/60 text-right"
                      />
                      <span className="font-mono-brand text-[10px] text-[#8a857c]">
                        {isPerKg ? "kg" : "qty"}
                      </span>
                    </div>

                    {/* Line total */}
                    <span className="font-mono-brand text-[#f5f2ec] text-right font-bold">
                      {"$"}{lineTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            <AlertDialog open={confirmSaveWeights} onOpenChange={setConfirmSaveWeights}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec] hover:bg-white/10"
                  disabled={savingWeights || updateItems.isPending}
                >
                  {updateItems.isPending ? "Saving…" : "Save Weights"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Save weight changes?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    This will update the final weights for order #{order.phone} and recalculate the totals.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest"
                    onClick={() => { setConfirmSaveWeights(false); handleSaveWeights(); }}
                  >
                    Save Weights
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Special instructions */}
          {order.specialInstructions && (
            <div>
              <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-1">
                SPECIAL INSTRUCTIONS
              </p>
              <p className="font-mono-brand text-[12px] text-[#f5f2ec]/80">
                {order.specialInstructions}
              </p>
            </div>
          )}

          {/* Customer name */}
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-2">
              CUSTOMER NAME
            </p>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="flex-1 bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateCustomerName.mutate({ id: order.id, customerName: customerName || null });
                    if (e.key === "Escape") { setCustomerName(order.customerName ?? ""); setEditingName(false); }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec] hover:bg-white/10"
                  disabled={updateCustomerName.isPending}
                  onClick={() => updateCustomerName.mutate({ id: order.id, customerName: customerName || null })}
                >
                  {updateCustomerName.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="font-display text-[10px] tracking-widest text-[#8a857c] hover:text-[#f5f2ec]"
                  onClick={() => { setCustomerName(order.customerName ?? ""); setEditingName(false); }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setEditingName(true)}
              >
                <span className="font-mono-brand text-[12px] text-[#f5f2ec]/80 group-hover:text-[#f5f2ec]">
                  {customerName || <span className="text-[#8a857c] italic">Add name…</span>}
                </span>
                <span className="font-mono-brand text-[10px] text-[#8a857c] group-hover:text-[#c73e3a]">✎</span>
              </div>
            )}
          </div>
          {/* Delivery charge */}
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-2">
              DELIVERY CHARGE
            </p>
              <div className="flex items-center gap-2">
                <span className="font-mono-brand text-[12px] text-[#8a857c]">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value)}
                  className="w-28 bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/60"
                />
                <AlertDialog open={confirmSaveDelivery} onOpenChange={setConfirmSaveDelivery}>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec] hover:bg-white/10"
                      disabled={setDeliveryChargeMut.isPending}
                    >
                      {setDeliveryChargeMut.isPending ? "Saving…" : "Set"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="section-ink border-white/10">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Update delivery charge?</AlertDialogTitle>
                      <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                        Set delivery charge to ${deliveryCharge} for order #{order.phone}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="font-display text-[10px] tracking-widest"
                        onClick={() => { setConfirmSaveDelivery(false); handleSaveDeliveryCharge(); }}
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          {/* Totals summary */}
          <div className="border-t border-white/10 pt-4 space-y-1">
            <div className="flex justify-between font-mono-brand text-[12px]">
              <span className="text-[#8a857c]">Subtotal</span>
              <span className="text-[#f5f2ec]">${subtotal.toFixed(2)}</span>
            </div>
            {delivery > 0 && (
              <div className="flex justify-between font-mono-brand text-[12px]">
                <span className="text-[#8a857c]">Delivery</span>
                <span className="text-[#f5f2ec]">${delivery.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-mono-brand text-[14px] font-bold pt-1 border-t border-white/10">
              <span className="text-[#f5f2ec]">Total Due</span>
              <span className="text-[#f5f2ec]">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Issue WhatsApp Invoice */}
            <AlertDialog open={confirmInvoice} onOpenChange={setConfirmInvoice}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white gap-1.5"
                >
                  <MessageCircle size={13} />
                  Issue WhatsApp Invoice
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Send WhatsApp invoice?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    Personalise the opening line, then send to {order.phone} (total: ${grandTotal.toFixed(2)}).
                  </AlertDialogDescription>
                  <div className="mt-3">
                    <label className="font-display text-[10px] tracking-widest text-[#8a857c] block mb-1">OPENING MESSAGE</label>
                    <textarea
                      rows={2}
                      value={openingSentence}
                      onChange={(e) => setOpeningSentence(e.target.value)}
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 placeholder-[#8a857c]/50 focus:outline-none focus:border-[#c73e3a]/60 resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => setOpeningSentence(defaultOpening)}
                      className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] mt-1 underline"
                    >
                      Reset to default
                    </button>
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white"
                    onClick={() => { setConfirmInvoice(false); handleIssueInvoice(); }}
                  >
                    Send Invoice
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Order in Preparation message */}
            <AlertDialog open={confirmPrep} onOpenChange={setConfirmPrep}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white gap-1.5"
                >
                  <MessageCircle size={13} />
                  Order in Preparation
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Send preparation update?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    This will send the following message to {order.phone}:
                  </AlertDialogDescription>
                  <div className="mt-3 bg-white/5 border border-white/10 px-4 py-3 font-mono-brand text-[12px] text-[#f5f2ec] whitespace-pre-line">
                    {`Just a heads up! \n\nYour order is now in preparation and everything is on track for your schedule: (${order.pickupDate}) at (${locationLabel(order.location, order.deliveryAddress)})\n\nSee you then.`}
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white"
                    onClick={() => { setConfirmPrep(false); handleSendPrepMessage(); }}
                  >
                    Send Message
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {/* Final Call reminder */}
            {order.status !== "paid" && order.status !== "cancelled" && (
              <AlertDialog open={confirmFinalCall} onOpenChange={setConfirmFinalCall}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white gap-1.5"
                  >
                    <MessageCircle size={13} />
                    Final Call
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="section-ink border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Send Final Call reminder?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                      This will send the following message to {order.phone}:
                    </AlertDialogDescription>
                    <div className="mt-3 bg-white/5 border border-white/10 px-4 py-3 font-mono-brand text-[12px] text-[#f5f2ec] whitespace-pre-line">
                      {"Final Call (Just a reminder)\n\nTo lock in your GroupBuy Power-Drop order for next week.\nPayment is due by Saturday night - send through your remittance to secure it.\n\nCheers!"}
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white"
                      onClick={() => {
                        setConfirmFinalCall(false);
                        const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                        const msg = "Final Call (Just a reminder)\n\nTo lock in your GroupBuy Power-Drop order for next week.\nPayment is due by Saturday night - send through your remittance to secure it.\n\nCheers!";
                        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                      }}
                    >
                      Send Message
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {/* Day of Order message */}
            <AlertDialog open={confirmDayOf} onOpenChange={setConfirmDayOf}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white gap-1.5"
                >
                  <MessageCircle size={13} />
                  Day of Order
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Send Day of Order message?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    This will send the following message to {order.phone}:
                  </AlertDialogDescription>
                  <div className="mt-3 bg-white/5 border border-white/10 px-4 py-3 font-mono-brand text-[12px] text-[#f5f2ec] whitespace-pre-line">
                    {"Today's the day!\n\nPickup: Let the team know you've got a GroupBuy order and give your full phone number at the counter.\n\nDelivery: Please allow a full-day window.\nWant a heads-up? Message \"PRE\"\nWant to know when it's delivered? Message \"POST\"\n\nTag your haul on Instagram for a free Steakhouse ticket #mitchellsgroupbuy"}
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white"
                    onClick={() => {
                      setConfirmDayOf(false);
                      const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                      const msg = "Today's the day!\n\nPickup: Let the team know you've got a GroupBuy order and give your full phone number at the counter.\n\nDelivery: Please allow a full-day window.\nWant a heads-up? Message \"PRE\"\nWant to know when it's delivered? Message \"POST\"\n\nTag your haul on Instagram for a free Steakhouse ticket #mitchellsgroupbuy";
                      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                    }}
                  >
                    Send Message
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {/* Mark as Paid */}
            {order.status !== "paid" && order.status !== "cancelled" && (
              <AlertDialog open={confirmMarkPaid} onOpenChange={setConfirmMarkPaid}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-green-700 hover:bg-green-600 text-white gap-1.5"
                    disabled={markPaid.isPending}
                  >
                    <CheckCircle2 size={13} />
                    {markPaid.isPending ? "Saving…" : "Mark as Paid"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="section-ink border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Mark order as paid?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                      Order #{order.phone} will be marked as PAID. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-green-700 hover:bg-green-600"
                      onClick={() => {
                        setConfirmMarkPaid(false);
                        setPendingPaidOrder({ phone: order.phone, pickupDate: order.pickupDate, location: order.location, deliveryAddress: order.deliveryAddress });
                        markPaid.mutate({ id: order.id });
                      }}
                    >
                      Mark as Paid
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Cancel Order */}
            {order.status === "pending" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-display text-[10px] tracking-widest border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
                  >
                    <Ban size={13} />
                    Cancel Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="section-ink border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">
                      Cancel this order?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                      Order #{order.phone} will be marked as cancelled. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="mt-4 space-y-2">
                    <p className="font-mono-brand text-[11px] text-[#8a857c] mb-2">Send a message to customer:</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full font-mono-brand text-[11px] text-left justify-start border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 gap-2 h-auto py-2 px-3 whitespace-normal"
                      onClick={() => {
                        const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent("Quick one. Your payment didn't come through before the cut-off, so we couldn't get your order in this drop.\n\nNext Power-Drop is coming up next month - keep an eye out\n\nCatch you on the next one.")}`, "_blank");
                      }}
                    >
                      <MessageCircle size={13} className="shrink-0 mt-0.5" />
                      <span>Payment cut-off — missed this drop</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full font-mono-brand text-[11px] text-left justify-start border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 gap-2 h-auto py-2 px-3 whitespace-normal"
                      onClick={() => {
                        const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent("Appreciate you getting involved in the Power-Drop.\n\nKeen to hear your thoughts - anything we could improve, fix, or do differently before the next one?")}`, "_blank");
                      }}
                    >
                      <MessageCircle size={13} className="shrink-0 mt-0.5" />
                      <span>Feedback request</span>
                    </Button>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">
                      Keep
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-amber-600 hover:bg-amber-500"
                      onClick={() => cancelOrder.mutate({ id: order.id })}
                    >
                      Cancel Order
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Unarchive (restore) — only shown for archived orders */}
            {order.archived && (
              <Button
                size="sm"
                variant="outline"
                className="font-display text-[10px] tracking-widest border-green-500/40 text-green-400 hover:bg-green-500/10 gap-1.5"
                onClick={() => unarchiveOrder.mutate({ id: order.id })}
                disabled={unarchiveOrder.isPending}
              >
                <ArchiveRestore size={13} />
                Restore
              </Button>
            )}
            {/* Archive Order — only shown for non-archived orders */}
            {!order.archived && <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-display text-[10px] tracking-widest border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
                >
                  <Archive size={13} />
                  Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">
                    Archive this order?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    Order #{order.phone} will be hidden from the active tabs (All, Pending, Paid, Cancelled) but kept for analytics. You can restore it from the Archived tab.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">
                    Keep
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700"
                    onClick={() => archiveOrder.mutate({ id: order.id })}
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>}
            {/* Delete Order */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-display text-[10px] tracking-widest border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5 ml-auto"
                >
                  <Trash2 size={13} />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">
                    Delete this order?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    Order #{order.phone} will be permanently removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="mt-4 space-y-2">
                  <p className="font-mono-brand text-[11px] text-[#8a857c] mb-2">Send a message to customer:</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full font-mono-brand text-[11px] text-left justify-start border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 gap-2 h-auto py-2 px-3 whitespace-normal"
                    onClick={() => {
                      const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent("Quick one. Your payment didn't come through before the cut-off, so we couldn't get your order in this drop.\n\nNext Power-Drop is coming up next month - keep an eye out\n\nCatch you on the next one.")}`, "_blank");
                    }}
                  >
                    <MessageCircle size={13} className="shrink-0 mt-0.5" />
                    <span>Payment cut-off — missed this drop</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full font-mono-brand text-[11px] text-left justify-start border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 gap-2 h-auto py-2 px-3 whitespace-normal"
                    onClick={() => {
                      const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent("Appreciate you getting involved in the Power-Drop.\n\nKeen to hear your thoughts - anything we could improve, fix, or do differently before the next one?")}`, "_blank");
                    }}
                  >
                    <MessageCircle size={13} className="shrink-0 mt-0.5" />
                    <span>Feedback request</span>
                  </Button>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">
                    Keep
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest bg-[#c73e3a] hover:bg-[#a83330]"
                    onClick={() => deleteOrder.mutate({ id: order.id })}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminOrders() {
  const { user, loading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pickupSort, setPickupSort] = useState<"none" | "asc" | "desc">("none");
  const [phoneSort, setPhoneSort] = useState<"none" | "asc" | "desc">("none");
  const [bankDetails, setBankDetails] = useState(
    "BSB: 182-888\nAccount: 001 052 935\nAccount Name: BEST QUALITY BUTCHER"
  );
  const [editingBank, setEditingBank] = useState(false);
  const [downloadingInvoices, setDownloadingInvoices] = useState(false);

  const [downloadingSchedule, setDownloadingSchedule] = useState(false);
  const [downloadingItems, setDownloadingItems] = useState(false);

  async function handleDownloadItems() {
    setDownloadingItems(true);
    try {
      const res = await fetch(`/api/admin/items/download`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `items-ordered-${timestamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    } finally {
      setDownloadingItems(false);
    }
  }

  async function handleDownloadSchedule() {
    setDownloadingSchedule(true);
    try {
      const res = await fetch(`/api/admin/schedule/download`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `schedule-list-${timestamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    } finally {
      setDownloadingSchedule(false);
    }
  }

  async function handleDownloadInvoices() {
    setDownloadingInvoices(true);
    try {
      const params = new URLSearchParams({ bankDetails });
      const res = await fetch(`/api/admin/invoices/download?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `packing-sheet-${timestamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    } finally {
      setDownloadingInvoices(false);
    }
  }

  // ─── Pagination state ──────────────────────────────────────────────────────
  const PAGE_SIZE = 100;
  // Use a separate "queryOffset" ref that is always in sync before the query fires.
  // This avoids the race where setOffset(0) + refetch() fires with the old offset.
  const [offset, setOffset] = useState(0);
  const [accumulatedOrders, setAccumulatedOrders] = useState<Order[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data: pageData, isLoading } = trpc.admin.orders.list.useQuery(
    { limit: PAGE_SIZE, offset },
    {
      enabled: user?.role === "admin",
      // Auto-refresh every 30s only while on the first page
      refetchInterval: offset === 0 ? 30_000 : false,
    }
  );

  // Server-side accurate counts — never capped by pagination
  const { data: serverCounts } = trpc.admin.orders.counts.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 30_000,
  });

  // Accumulate pages: on first page replace, on subsequent pages append
  useEffect(() => {
    if (!pageData) return;
    const incoming = (pageData.orders ?? []) as Order[];
    if (offset === 0) {
      setAccumulatedOrders(incoming);
    } else {
      setAccumulatedOrders((prev) => {
        // Deduplicate by id in case a 30s refresh races with a load-more
        const existingIds = new Set(prev.map((o) => o.id));
        const newOnes = incoming.filter((o) => !existingIds.has(o.id));
        return [...prev, ...newOnes];
      });
    }
    setHasMore(pageData.hasMore ?? false);
    setLoadingMore(false);
  }, [pageData, offset]);

  // Reliable refresh: set offset to 0 first; if already 0, bump refreshKey to force
  // a new query key so tRPC re-fetches even when offset hasn't changed.
  const utils = trpc.useUtils();
  function handleRefresh() {
    setAccumulatedOrders([]);
    setHasMore(false);
    if (offset === 0) {
      // Already on page 0 — invalidate the cache to force a fresh fetch
      utils.admin.orders.list.invalidate();
      utils.admin.orders.counts.invalidate();
    } else {
      // Reset to page 0; the useEffect will fire when new data arrives
      setOffset(0);
    }
  }

  function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setOffset((prev) => prev + PAGE_SIZE);
  }

  const { data: archivedOrders, isLoading: isLoadingArchived } = trpc.admin.orders.listArchived.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

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
            <Button variant="outline" size="sm" className="font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec]">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const allOrders = accumulatedOrders;
  const allArchived = (archivedOrders as Order[] | undefined) ?? [];
  const filtered =
    statusFilter === "archived"
      ? allArchived
      : statusFilter === "all"
      ? allOrders
      : allOrders.filter((o) => o.status === statusFilter);

  // Use server-provided counts for filter tabs and export buttons — never capped by pagination.
  // Fall back to loaded-order counts while the server count query is still loading.
  const counts = {
    all: serverCounts?.all ?? allOrders.length,
    pending: serverCounts?.pending ?? allOrders.filter((o) => o.status === "pending").length,
    paid: serverCounts?.paid ?? allOrders.filter((o) => o.status === "paid").length,
    cancelled: serverCounts?.cancelled ?? allOrders.filter((o) => o.status === "cancelled").length,
    archived: allArchived.length,
  };
  // No longer needed — counts come from the server
  const countSuffix = "";

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "paid", label: "Paid" },
    { key: "cancelled", label: "Cancelled" },
    { key: "archived", label: "Archived" },
  ];
  const sortedFiltered = (() => {
    let result = [...filtered];
    if (pickupSort !== "none") {
      result.sort((a, b) => {
        const da = new Date(a.pickupDate).getTime();
        const db = new Date(b.pickupDate).getTime();
        return pickupSort === "asc" ? da - db : db - da;
      });
    }
    if (phoneSort !== "none") {
      result.sort((a, b) => {
        const pa = a.phone || "";
        const pb = b.phone || "";
        return phoneSort === "asc" ? pa.localeCompare(pb) : pb.localeCompare(pa);
      });
    }
    return result;
  })();

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
            <Package size={14} className="text-[#c73e3a]" />
            <span className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
              ORDER MANAGEMENT
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Export buttons use server-side counts.paid so they are never incorrectly
              disabled when paid orders exist beyond the first loaded page. */}
          <button
            onClick={handleDownloadInvoices}
            disabled={downloadingInvoices}
            className="flex items-center gap-1.5 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Download packing sheet${counts.paid > 0 ? ` for ${counts.paid} paid order${counts.paid !== 1 ? "s" : ""}` : ""}`}
          >
            <FileDown size={13} />
            {downloadingInvoices ? "Generating…" : `Packing Sheet${counts.paid > 0 ? ` (${counts.paid})` : ""}`}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleDownloadSchedule}
            disabled={downloadingSchedule}
            className="flex items-center gap-1.5 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Download schedule list${counts.paid > 0 ? ` for ${counts.paid} paid order${counts.paid !== 1 ? "s" : ""}` : ""}`}
          >
            <FileDown size={13} />
            {downloadingSchedule ? "Generating…" : `Schedule List${counts.paid > 0 ? ` (${counts.paid})` : ""}`}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleDownloadItems}
            disabled={downloadingItems}
            className="flex items-center gap-1.5 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Download items ordered list${counts.paid > 0 ? ` for ${counts.paid} paid order${counts.paid !== 1 ? "s" : ""}` : ""}`}
          >
            <FileDown size={13} />
            {downloadingItems ? "Generating…" : `Items Ordered${counts.paid > 0 ? ` (${counts.paid})` : ""}`}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => setPickupSort(s => s === "none" ? "asc" : s === "asc" ? "desc" : "none")}
            className={`flex items-center gap-1 font-mono-brand text-[10px] transition-colors ${pickupSort !== "none" ? "text-[#c73e3a]" : "text-[#8a857c] hover:text-[#f5f2ec]"}`}
            title="Sort by pickup date"
          >
            {pickupSort === "asc" ? <ArrowUp size={12} /> : pickupSort === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />}
            {pickupSort === "asc" ? "Pickup ↑" : pickupSort === "desc" ? "Pickup ↓" : "Pickup Date"}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => setPhoneSort(s => s === "none" ? "asc" : s === "asc" ? "desc" : "none")}
            className={`flex items-center gap-1 font-mono-brand text-[10px] transition-colors ${phoneSort !== "none" ? "text-[#c73e3a]" : "text-[#8a857c] hover:text-[#f5f2ec]"}`}
            title="Sort by phone number"
          >
            {phoneSort === "asc" ? <ArrowUp size={12} /> : phoneSort === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />}
            {phoneSort === "asc" ? "Phone ↑" : phoneSort === "desc" ? "Phone ↓" : "Phone"}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => handleRefresh()}
            className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors"
          >
            Refresh
          </button>
          <div className="w-px h-4 bg-white/10" />
          <Link href="/admin/drops">
            <button className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
              Drops & Analytics →
            </button>
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <Link href="/admin/customers">
            <button className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors">
              Customers →
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Bank details panel */}
        <div className="border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-[10px] tracking-widest text-[#8a857c]">
              PAYMENT DETAILS (included in invoice)
            </p>
            <button
              onClick={() => setEditingBank((v) => !v)}
              className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors underline underline-offset-2"
            >
              {editingBank ? "Done" : "Edit"}
            </button>
          </div>
          {editingBank ? (
            <textarea
              value={bankDetails}
              onChange={(e) => setBankDetails(e.target.value)}
              rows={4}
              className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2.5 placeholder-[#8a857c] focus:outline-none focus:border-[#c73e3a]/60 resize-none"
            />
          ) : (
            <pre className="font-mono-brand text-[12px] text-[#f5f2ec]/80 whitespace-pre-wrap">
              {bankDetails}
            </pre>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 border-b border-white/10 pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`font-display text-[10px] tracking-widest px-4 py-2.5 border-b-2 transition-colors ${
                statusFilter === tab.key
                  ? "border-[#c73e3a] text-[#f5f2ec]"
                  : "border-transparent text-[#8a857c] hover:text-[#f5f2ec]"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 font-mono-brand text-[9px] opacity-60">
                ({counts[tab.key]}{tab.key !== "archived" ? countSuffix : ""})
              </span>
            </button>
          ))}
        </div>

        {/* Orders list */}
        {(isLoading || (statusFilter === "archived" && isLoadingArchived)) ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 border border-white/10 animate-pulse bg-white/3" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Package size={40} className="text-[#8a857c]/30" />
            <p className="font-display text-[11px] tracking-widest text-[#8a857c]">
              {statusFilter === "all" ? "NO ORDERS YET" : statusFilter === "archived" ? "NO ARCHIVED ORDERS" : `NO ${statusFilter.toUpperCase()} ORDERS`}
            </p>
            <p className="font-mono-brand text-[11px] text-[#8a857c]/60">
              {statusFilter === "all"
                ? "Orders will appear here when customers check out."
                : "Try switching to a different filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFiltered.map((order) => (
              <OrderCard
                key={order.id}
                order={order as Order}
                bankDetails={bankDetails}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        )}

        {/* Load More — only shown for non-archived views */}
        {statusFilter !== "archived" && (
          <div className="flex flex-col items-center gap-2 py-4">
            {hasMore ? (
              <>
                <p className="font-mono-brand text-[10px] text-[#8a857c]">
                  Showing {allOrders.length} orders — more orders exist
                </p>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="font-display text-[10px] tracking-widest px-5 py-2 border border-white/20 text-[#f5f2ec] hover:border-[#c73e3a]/60 hover:text-[#c73e3a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loadingMore ? "Loading…" : "Load more orders"}
                </button>
              </>
            ) : allOrders.length > 0 ? (
              <p className="font-mono-brand text-[10px] text-[#8a857c]/50">
                All {allOrders.length} active orders loaded
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
