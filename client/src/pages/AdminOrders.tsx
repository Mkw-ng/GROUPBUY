/*
 * AdminOrders — Order Management Page
 * Lists all customer orders received through the cart checkout.
 * Admin can: enter final weights per item, set delivery charge,
 * issue a WhatsApp invoice, mark as paid, or cancel/delete the order.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  MessageCircle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Zap,
  Package,
  Clock,
  Ban,
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
  createdAt: Date;
}

type StatusFilter = "all" | "pending" | "paid" | "cancelled";

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
  const [savingWeights, setSavingWeights] = useState(false);
  const [confirmSaveWeights, setConfirmSaveWeights] = useState(false);
  const [confirmSaveDelivery, setConfirmSaveDelivery] = useState(false);
  const [confirmInvoice, setConfirmInvoice] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [confirmPrep, setConfirmPrep] = useState(false);
  const defaultOpening = `We got your GroupBuy Power-Drop order!

Here's how to lock it in:
1. Pay here (Details below)
2. Send me a photo remittance

* Ensure payment is made by Saturday to avoid cancellation
* From there you'll be set for your pick up or delivery date the next week
* You'll get another message from me to let you know its all on track`;
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
  const [bankDetails, setBankDetails] = useState(
    "BSB: 182-888\nAccount: 001 052 935\nAccount Name: BEST QUALITY BUTCHER"
  );
  const [editingBank, setEditingBank] = useState(false);

  const { data: orders, isLoading, refetch } = trpc.admin.orders.list.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 30_000, // auto-refresh every 30s
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

  const allOrders = (orders as Order[] | undefined) ?? [];
  const filtered =
    statusFilter === "all"
      ? allOrders
      : allOrders.filter((o) => o.status === statusFilter);

  const counts = {
    all: allOrders.length,
    pending: allOrders.filter((o) => o.status === "pending").length,
    paid: allOrders.filter((o) => o.status === "paid").length,
    cancelled: allOrders.filter((o) => o.status === "cancelled").length,
  };

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "paid", label: "Paid" },
    { key: "cancelled", label: "Cancelled" },
  ];

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
        <button
          onClick={() => refetch()}
          className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors"
        >
          Refresh
        </button>
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
                ({counts[tab.key]})
              </span>
            </button>
          ))}
        </div>

        {/* Orders list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 border border-white/10 animate-pulse bg-white/3" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Package size={40} className="text-[#8a857c]/30" />
            <p className="font-display text-[11px] tracking-widest text-[#8a857c]">
              {statusFilter === "all" ? "NO ORDERS YET" : `NO ${statusFilter.toUpperCase()} ORDERS`}
            </p>
            <p className="font-mono-brand text-[11px] text-[#8a857c]/60">
              {statusFilter === "all"
                ? "Orders will appear here when customers check out."
                : "Try switching to a different filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order as Order}
                bankDetails={bankDetails}
                onRefresh={refetch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
