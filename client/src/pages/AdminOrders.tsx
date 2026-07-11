/*
 * AdminOrders — Order Management Page
 * Lists all customer orders received through the cart checkout.
 * Admin can: enter final weights per item, set delivery charge,
 * issue a WhatsApp invoice, mark as paid, or cancel/delete the order.
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  MessageCircle,
  CheckCircle2,
  Loader2,
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
  FileText,
  Search,
  X,
  DollarSign,
  Copy,
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
  note?: string;
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
  status: "pending" | "invoice_issued" | "remittance" | "paid" | "in_progress" | "pickup_available" | "completed" | "cancelled"; // cancelled kept for DB compat
  isPowerDrop: boolean;
  archived: boolean | null;
  customerName: string | null;
  invoiceNumber: string | null;
  pickupBags: number | null;
  pickupBoxes: number | null;
  pickupFreezerBags: number | null;
  pickupFreezerBoxes: number | null;
  createdAt: Date;
}

type StatusFilter = "all" | "pending" | "invoice_issued" | "remittance" | "paid" | "in_progress" | "pickup_available" | "completed" | "archived" | "casual";

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
  // If a final weight/qty override is entered (including 0), use it; otherwise fall back to ordered qty
  const hasOverride = item.finalWeightKg !== undefined && item.finalWeightKg !== null && item.finalWeightKg !== "";
  if (hasOverride) {
    const weight = parseFloat(item.finalWeightKg!) || 0;
    return price * weight;
  }
  return price * item.qty;
}

function formatInvoiceNumber(orderId: number): string {
  return `GB-${String(orderId).padStart(5, "0")}`;
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
    const hasOverride = item.finalWeightKg !== undefined && item.finalWeightKg !== null && item.finalWeightKg !== "";
    const weight = hasOverride ? (parseFloat(item.finalWeightKg!) || 0) : null;
    const total = calcItemTotal(item);
    // Use final entered value if set (including 0); otherwise fall back to original ordered qty
    const finalVal = weight !== null ? weight : item.qty;
    const unit = isPerKg && weight !== null ? "kg" : "";
    const weightStr = ` × ${finalVal}${unit}`;
    return `${item.name}${weightStr} @ $${price.toFixed(2)}${item.unit} = *$${total.toFixed(2)}*`;
  });

  const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
  const delivery = parseFloat(deliveryCharge) || 0;
  const grandTotal = subtotal + delivery;

  if (order.isPowerDrop) {
    // Power Drop format
    const invoiceRef = order.invoiceNumber ?? formatInvoiceNumber(order.id);
    const pdParts: string[] = [
      `*We got your GroupBuy Power-Drop order!*`,
      ``,
      `*Next Steps*`,
      `1. Invoice and payment details are down below`,
      `2. Send me a photo remittance within 24 hours to avoid cancellations`,
      `3. Order will be processed after this point and will be available within 7 days`,
      `4. You'll receive a scheduling message from me once its ready`,
      ``,
      `Invoice Reference #: *${invoiceRef}*`,
      `Phone: ${order.phone}`,
      `Location: ${locationStr}`,
      ``,
      `*Items:*`,
      ...itemLines,
      ``,
    ];
    if (delivery > 0) {
      pdParts.push(`Subtotal: $${subtotal.toFixed(2)}`);
      pdParts.push(`Delivery: $${delivery.toFixed(2)}`);
    }
    pdParts.push(`Total Due: $${grandTotal.toFixed(2)}`);
    if (order.specialInstructions) {
      pdParts.push(``);
      pdParts.push(`Notes: ${order.specialInstructions}`);
    }
    if (bankDetails.trim()) {
      pdParts.push(``);
      pdParts.push(`Payment Details:`);
      pdParts.push(bankDetails.trim());
    }
    return pdParts.join("\n");
  }

  // Standard (non-Power Drop) format
  const parts: string[] = [
    openingSentence,
    ``,
    `*Invoice #:* ${order.invoiceNumber ?? formatInvoiceNumber(order.id)}`,
    `*Phone:* ${order.phone}`,
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

  return parts.join("\n");
}

// ─── Casual clipboard summary ────────────────────────────────────────────────

function buildCasualSummary(order: Order, items: OrderItem[], deliveryCharge: string): string {
  const invoiceRef = order.invoiceNumber ?? formatInvoiceNumber(order.id);
  const locLabel = order.location === "delivery"
    ? (order.deliveryAddress ?? "Delivery")
    : order.location === "cranbourne" ? "Cranbourne"
    : order.location === "clayton" ? "Clayton"
    : order.location;

  const itemLines = items.map((item) => {
    const price = parseFloat(item.price) || 0;
    const isPerKg = item.unit?.toLowerCase().includes("kg");
    const hasOverride = item.finalWeightKg !== undefined && item.finalWeightKg !== null && item.finalWeightKg !== "";
    const qty = hasOverride ? parseFloat(item.finalWeightKg!) || 0 : item.qty;
    const qtyStr = isPerKg ? `${qty}kg` : `${qty}`;
    const unitLabel = item.unit?.replace(/^\s*\/\s*/, "") ?? "";
    const notePart = item.note ? ` - ${item.note}` : "";
    return `${item.name} - ${qtyStr} - $${price.toFixed(2)} /${unitLabel}${notePart}`;
  });

  const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
  const delivery = parseFloat(deliveryCharge) || 0;
  const grandTotal = subtotal + delivery;

  const lines: string[] = [
    order.phone,
    invoiceRef,
    order.pickupDate ?? "",
    locLabel,
    ...itemLines,
  ];

  if (order.specialInstructions) {
    lines.push(`Special instructions: ${order.specialInstructions}`);
  }

  lines.push(`Total due: $${grandTotal.toFixed(2)}`);

  return lines.join("\n");
}

// ─── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  bankDetails,
  onRefresh,
  selectable,
  selected,
  onToggleSelect,
}: {
  order: Order;
  bankDetails: string;
  onRefresh: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(true);
  const [items, setItems] = useState<OrderItem[]>(() => parseItems(order.items));
  const [deliveryCharge, setDeliveryCharge] = useState(order.deliveryCharge ?? "0");
  const [editPhone, setEditPhone] = useState(order.phone);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editLocation, setEditLocation] = useState(order.location);
  const [editDeliveryAddress, setEditDeliveryAddress] = useState(order.deliveryAddress ?? "");
  const [editingLocation, setEditingLocation] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState(order.specialInstructions ?? "");
  const [editingInstructions, setEditingInstructions] = useState(false);
  const updateSpecialInstructions = trpc.admin.orders.updateSpecialInstructions.useMutation({
    onSuccess: () => {
      toast.success("Special instructions saved");
      setEditingInstructions(false);
      onRefresh();
    },
    onError: () => toast.error("Failed to save special instructions"),
  });

  const updatePickupUnits = trpc.admin.orders.updatePickupUnits.useMutation({
    onSuccess: () => toast.success("Pickup units saved ✓"),
    onError: () => toast.error("Failed to save pickup units"),
  });
  const updateLocation = trpc.admin.orders.updateLocation.useMutation({
    onSuccess: () => {
      toast.success("Location updated");
      setEditingLocation(false);
      onRefresh();
    },
    onError: () => toast.error("Failed to update location"),
  });

  const updatePhone = trpc.admin.orders.updatePhone.useMutation({
    onSuccess: () => {
      toast.success("Phone number updated");
      setEditingPhone(false);
      onRefresh();
    },
    onError: () => toast.error("Failed to update phone number"),
  });
  const [savingWeights, setSavingWeights] = useState(false);
  const [confirmSaveWeights, setConfirmSaveWeights] = useState(false);
  const [confirmSaveDelivery, setConfirmSaveDelivery] = useState(false);
  const [confirmInvoice, setConfirmInvoice] = useState(false);
  const [confirmMarkRemittance, setConfirmMarkRemittance] = useState(false);
  // Add Item form state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCut, setNewItemCut] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("/ kg");
  const [newItemNote, setNewItemNote] = useState("");
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [confirmMarkInProgress, setConfirmMarkInProgress] = useState(false);
  const [confirmMarkPickupAvailable, setConfirmMarkPickupAvailable] = useState(false);
  const [confirmMarkCompleted, setConfirmMarkCompleted] = useState(false);
  const [confirmFinalCall, setConfirmFinalCall] = useState(false);
  // Pickup unit inputs
  const [pickupBags, setPickupBags] = useState<string>(order.pickupBags != null ? String(order.pickupBags) : "");
  const [pickupBoxes, setPickupBoxes] = useState<string>(order.pickupBoxes != null ? String(order.pickupBoxes) : "");
  const [pickupFreezerBags, setPickupFreezerBags] = useState<string>(order.pickupFreezerBags != null ? String(order.pickupFreezerBags) : "");
  const [pickupFreezerBoxes, setPickupFreezerBoxes] = useState<string>(order.pickupFreezerBoxes != null ? String(order.pickupFreezerBoxes) : "");
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
      onRefresh();
    },
    onError: () => toast.error("Failed to save weights"),
  });

  const setDeliveryChargeMut = trpc.admin.orders.setDeliveryCharge.useMutation({
    onSuccess: () => {
      toast.success("Delivery charge updated");
      onRefresh();
    },
    onError: () => toast.error("Failed to update delivery charge"),
  });

  const [confirmPaymentConfirmation, setConfirmPaymentConfirmation] = useState(false);
  const [confirmPickupAvailableMsg, setConfirmPickupAvailableMsg] = useState(false);
  const [downloadingSlip, setDownloadingSlip] = useState(false);

  async function handleDownloadPackingSlip() {
    setDownloadingSlip(true);
    try {
      const res = await fetch(`/api/admin/packing-slip/${order.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to generate packing slip");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const invoiceRef = order.invoiceNumber ?? `GB-${String(order.id).padStart(5, "0")}`;
      a.download = `packing-slip-${invoiceRef}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download packing slip");
    } finally {
      setDownloadingSlip(false);
    }
  }

  const markInvoiceIssued = trpc.admin.orders.markInvoiceIssued.useMutation({
    onSuccess: () => {
      onRefresh();
    },
    onError: () => toast.error("Failed to update order status"),
  });

  const markRemittance = trpc.admin.orders.markRemittance.useMutation({
    onSuccess: () => {
      toast.success("Order moved to Remittance ✓");
      onRefresh();
    },
    onError: () => toast.error("Failed to update order status"),
  });

  const markPaid = trpc.admin.orders.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Order marked as paid ✓");
      onRefresh();
    },
    onError: () => toast.error("Failed to mark as paid"),
  });

  const markInProgress = trpc.admin.orders.markInProgress.useMutation({
    onSuccess: () => {
      toast.success("Order marked as In Progress ✓");
      onRefresh();
    },
    onError: () => toast.error("Failed to update order status"),
  });

  const markPickupAvailable = trpc.admin.orders.markPickupAvailable.useMutation({
    onSuccess: () => {
      toast.success("Order marked as Pick up Available ✓");
      onRefresh();
    },
    onError: () => toast.error("Failed to update order status"),
  });

  const markCompleted = trpc.admin.orders.markCompleted.useMutation({
    onSuccess: () => {
      toast.success("Order marked as Completed ✓");
      onRefresh();
    },
    onError: () => toast.error("Failed to update order status"),
  });

  const deleteOrder = trpc.admin.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("Order deleted");
      onRefresh();
    },
    onError: () => toast.error("Failed to delete order"),
  });
  const archiveOrder = trpc.admin.orders.archive.useMutation({
    onSuccess: () => {
      toast.success("Order archived");
      utils.admin.orders.listArchived.invalidate();
      utils.admin.orders.counts.invalidate();
      onRefresh();
    },
    onError: () => toast.error("Failed to archive order"),
  });
  const unarchiveOrder = trpc.admin.orders.unarchive.useMutation({
    onSuccess: () => {
      toast.success("Order restored");
      utils.admin.orders.listArchived.invalidate();
      utils.admin.orders.counts.invalidate();
      onRefresh();
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

  function handleIssueInvoice() {
    // Pass the locally edited specialInstructions so the invoice reflects unsaved edits too
    const msg = buildInvoiceMessage({ ...order, specialInstructions: specialInstructions.trim() || null }, items, deliveryCharge, bankDetails, openingSentence);
    const phone = order.phone.replace(/\D/g, "");
    const intlPhone = phone.startsWith("0") ? `61${phone.slice(1)}` : phone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
  const delivery = parseFloat(deliveryCharge) || 0;
  const grandTotal = subtotal + delivery;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    invoice_issued: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    remittance: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    paid: "bg-green-500/20 text-green-400 border-green-500/30",
    in_progress: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    pickup_available: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock size={11} />,
    invoice_issued: <MessageCircle size={11} />,
    remittance: <DollarSign size={11} />,
    paid: <CheckCircle2 size={11} />,
    in_progress: <Loader2 size={11} />,
    pickup_available: <Package size={11} />,
    completed: <CheckCircle2 size={11} />,
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
          {selectable && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={() => onToggleSelect?.(order.id)}
              onClick={(e) => e.stopPropagation()}
              className="accent-[#c73e3a] w-4 h-4 shrink-0 cursor-pointer"
            />
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono-brand text-[13px] font-bold text-[#f5f2ec]">
                {order.phone}
              </span>
              {order.invoiceNumber && (
                <span className="font-mono-brand text-[10px] text-[#c73e3a] border border-[#c73e3a]/40 px-1.5 py-0.5 tracking-wider">
                  {order.invoiceNumber}
                </span>
              )}
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
                  <React.Fragment key={idx}>
                  <div
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center text-[12px]"
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

                    {/* Remove item button */}
                    <button
                      type="button"
                      title="Remove item"
                      className="text-[#8a857c] hover:text-[#c73e3a] transition-colors"
                      onClick={() => {
                        const updated = items.filter((_, i) => i !== idx);
                        setItems(updated);
                        updateItems.mutate({ id: order.id, items: updated });
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {/* Per-item customer request note */}
                  {item.note && (
                    <div className="mt-0.5 mb-1 flex items-start gap-1.5 text-[11px] text-[#c9a96e]">
                      <span className="shrink-0 mt-0.5">↳</span>
                      <span className="font-mono-brand italic">{item.note}</span>
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Add Item form */}
            {showAddItem ? (
              <div className="mt-3 border border-white/15 bg-white/3 p-4 space-y-3">
                <p className="font-display text-[10px] tracking-widest text-[#8a857c]">ADD ITEM</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-display text-[9px] tracking-widest text-[#8a857c] block mb-1">NAME *</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g. Wagyu Ribeye"
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[11px] px-2 py-1.5 focus:outline-none focus:border-[#c73e3a]/60"
                    />
                  </div>
                  <div>
                    <label className="font-display text-[9px] tracking-widest text-[#8a857c] block mb-1">CUT / DESCRIPTION</label>
                    <input
                      type="text"
                      value={newItemCut}
                      onChange={(e) => setNewItemCut(e.target.value)}
                      placeholder="e.g. MS7+"
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[11px] px-2 py-1.5 focus:outline-none focus:border-[#c73e3a]/60"
                    />
                  </div>
                  <div>
                    <label className="font-display text-[9px] tracking-widest text-[#8a857c] block mb-1">QTY *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[11px] px-2 py-1.5 focus:outline-none focus:border-[#c73e3a]/60"
                    />
                  </div>
                  <div>
                    <label className="font-display text-[9px] tracking-widest text-[#8a857c] block mb-1">PRICE *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="e.g. 42.00"
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[11px] px-2 py-1.5 focus:outline-none focus:border-[#c73e3a]/60"
                    />
                  </div>
                  <div>
                    <label className="font-display text-[9px] tracking-widest text-[#8a857c] block mb-1">UNIT</label>
                    <input
                      type="text"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      placeholder="e.g. / kg"
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[11px] px-2 py-1.5 focus:outline-none focus:border-[#c73e3a]/60"
                    />
                  </div>
                  <div>
                    <label className="font-display text-[9px] tracking-widest text-[#8a857c] block mb-1">NOTE (OPTIONAL)</label>
                    <input
                      type="text"
                      value={newItemNote}
                      onChange={(e) => setNewItemNote(e.target.value)}
                      placeholder="e.g. Extra trim please"
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[11px] px-2 py-1.5 focus:outline-none focus:border-[#c73e3a]/60"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-[#c73e3a] hover:bg-[#a83330] text-white"
                    disabled={!newItemName.trim() || !newItemPrice || !newItemQty || updateItems.isPending}
                    onClick={() => {
                      const newItem: OrderItem = {
                        id: Date.now(),
                        name: newItemName.trim(),
                        cut: newItemCut.trim(),
                        qty: parseFloat(newItemQty) || 1,
                        price: parseFloat(newItemPrice).toFixed(2),
                        unit: newItemUnit.trim() || "/ kg",
                        ...(newItemNote.trim() ? { note: newItemNote.trim() } : {}),
                      };
                      const updated = [...items, newItem];
                      setItems(updated);
                      updateItems.mutate({ id: order.id, items: updated }, {
                        onSuccess: () => {
                          toast.success("Item added");
                          setShowAddItem(false);
                          setNewItemName("");
                          setNewItemCut("");
                          setNewItemQty("1");
                          setNewItemPrice("");
                          setNewItemUnit("/ kg");
                          setNewItemNote("");
                        },
                        onError: () => toast.error("Failed to add item"),
                      });
                    }}
                  >
                    {updateItems.isPending ? "Saving…" : "Add Item"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-display text-[10px] tracking-widest text-[#8a857c] hover:text-[#f5f2ec]"
                    onClick={() => {
                      setShowAddItem(false);
                      setNewItemName("");
                      setNewItemCut("");
                      setNewItemQty("1");
                      setNewItemPrice("");
                      setNewItemUnit("/ kg");
                      setNewItemNote("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec] hover:bg-white/10 gap-1.5"
                onClick={() => setShowAddItem(true)}
              >
                <span className="text-[#c73e3a] font-bold">+</span> Add Item
              </Button>
            )}

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

          {/* Special instructions — always shown, editable */}
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-2">
              SPECIAL INSTRUCTIONS
            </p>
            {editingInstructions ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Add special instructions…"
                  rows={3}
                  maxLength={1000}
                  className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/60 resize-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSpecialInstructions(order.specialInstructions ?? "");
                      setEditingInstructions(false);
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      updateSpecialInstructions.mutate({
                        id: order.id,
                        specialInstructions: specialInstructions.trim() || null,
                      });
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec] hover:bg-white/10"
                    disabled={updateSpecialInstructions.isPending}
                    onClick={() =>
                      updateSpecialInstructions.mutate({
                        id: order.id,
                        specialInstructions: specialInstructions.trim() || null,
                      })
                    }
                  >
                    {updateSpecialInstructions.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-display text-[10px] tracking-widest text-[#8a857c] hover:text-[#f5f2ec]"
                    onClick={() => {
                      setSpecialInstructions(order.specialInstructions ?? "");
                      setEditingInstructions(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-start gap-2 cursor-pointer group"
                onClick={() => setEditingInstructions(true)}
              >
                <span className="font-mono-brand text-[12px] text-[#f5f2ec]/80 group-hover:text-[#f5f2ec] whitespace-pre-wrap">
                  {specialInstructions || (
                    <span className="text-[#8a857c] italic">Add special instructions…</span>
                  )}
                </span>
                <span className="font-mono-brand text-[10px] text-[#8a857c] group-hover:text-[#c73e3a] shrink-0">✎</span>
              </div>
            )}
          </div>

          {/* Location / Delivery Address — editable */}
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-2">
              LOCATION
            </p>
            {editingLocation ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="flex-1 bg-[#1a1a1a] border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/60"
                  >
                    <option value="cranbourne">Cranbourne</option>
                    <option value="clayton">Clayton</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
                {editLocation === "delivery" && (
                  <input
                    type="text"
                    value={editDeliveryAddress}
                    onChange={(e) => setEditDeliveryAddress(e.target.value)}
                    placeholder="Delivery address"
                    className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/60"
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec] hover:bg-white/10"
                    disabled={updateLocation.isPending || (editLocation === "delivery" && !editDeliveryAddress.trim())}
                    onClick={() => updateLocation.mutate({ id: order.id, location: editLocation, deliveryAddress: editLocation === "delivery" ? editDeliveryAddress.trim() : undefined })}
                  >
                    {updateLocation.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-display text-[10px] tracking-widest text-[#8a857c] hover:text-[#f5f2ec]"
                    onClick={() => { setEditLocation(order.location); setEditDeliveryAddress(order.deliveryAddress ?? ""); setEditingLocation(false); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setEditingLocation(true)}
              >
                <span className="font-mono-brand text-[12px] text-[#f5f2ec]/80 group-hover:text-[#f5f2ec]">
                  {locationLabel(editLocation, editLocation === "delivery" ? editDeliveryAddress || null : null)}
                </span>
                <span className="font-mono-brand text-[10px] text-[#8a857c] group-hover:text-[#c73e3a]">✎</span>
              </div>
            )}
          </div>

          {/* Phone number — editable */}
          <div>
            <p className="font-display text-[10px] tracking-widest text-[#8a857c] mb-2">
              PHONE NUMBER
            </p>
            {editingPhone ? (
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 0412 345 678"
                  className="flex-1 bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 focus:outline-none focus:border-[#c73e3a]/60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editPhone.trim()) updatePhone.mutate({ id: order.id, phone: editPhone.trim() });
                    if (e.key === "Escape") { setEditPhone(order.phone); setEditingPhone(false); }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="font-display text-[10px] tracking-widest border-white/20 text-[#f5f2ec] hover:bg-white/10"
                  disabled={updatePhone.isPending || !editPhone.trim()}
                  onClick={() => updatePhone.mutate({ id: order.id, phone: editPhone.trim() })}
                >
                  {updatePhone.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="font-display text-[10px] tracking-widest text-[#8a857c] hover:text-[#f5f2ec]"
                  onClick={() => { setEditPhone(order.phone); setEditingPhone(false); }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setEditingPhone(true)}
              >
                <span className="font-mono-brand text-[12px] text-[#f5f2ec]/80 group-hover:text-[#f5f2ec]">
                  {editPhone}
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

          {/* Pickup units — shown for in_progress and pickup_available orders */}
          {(order.status === "in_progress" || order.status === "pickup_available") && (
            <div className="border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
              <p className="font-display text-[10px] tracking-widest text-purple-300 mb-2">PICKUP UNITS</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: "Bags", value: pickupBags, setter: setPickupBags },
                  { label: "Boxes", value: pickupBoxes, setter: setPickupBoxes },
                  { label: "Freezer Bags", value: pickupFreezerBags, setter: setPickupFreezerBags },
                  { label: "Freezer Boxes", value: pickupFreezerBoxes, setter: setPickupFreezerBoxes },
                ] as { label: string; value: string; setter: (v: string) => void }[]).map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="font-display text-[9px] tracking-widest text-[#8a857c] block mb-1">{label.toUpperCase()}</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent border border-white/15 text-[#f5f2ec] font-mono-brand text-[12px] px-3 py-2 focus:outline-none focus:border-purple-500/60"
                    />
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                className="font-display text-[10px] tracking-widest bg-purple-700 hover:bg-purple-600 text-white"
                disabled={updatePickupUnits.isPending}
                onClick={() => updatePickupUnits.mutate({
                  id: order.id,
                  pickupBags: pickupBags !== "" ? parseInt(pickupBags, 10) : null,
                  pickupBoxes: pickupBoxes !== "" ? parseInt(pickupBoxes, 10) : null,
                  pickupFreezerBags: pickupFreezerBags !== "" ? parseInt(pickupFreezerBags, 10) : null,
                  pickupFreezerBoxes: pickupFreezerBoxes !== "" ? parseInt(pickupFreezerBoxes, 10) : null,
                })}
              >
                {updatePickupUnits.isPending ? "Saving…" : "Save Pickup Units"}
              </Button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* ─── Casual order: simplified action cluster ─────────────────────────────
                Casual orders are fulfilled in-store. Actions: Copy summary, Acknowledge &
                Archive (copies then archives), and Delete. No pipeline buttons. */}
            {!order.isPowerDrop && !order.archived && (
              <>
                {/* Standalone Copy button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="font-display text-[10px] tracking-widest border-[#8a857c]/40 text-[#8a857c] hover:bg-white/5 gap-1.5"
                  onClick={async () => {
                    const summary = buildCasualSummary(
                      { ...order, specialInstructions: specialInstructions.trim() || null },
                      items,
                      deliveryCharge
                    );
                    try {
                      await navigator.clipboard.writeText(summary);
                      toast.success("Order summary copied to clipboard");
                    } catch {
                      toast.error("Could not copy — check clipboard permissions");
                    }
                  }}
                >
                  <Copy size={13} />
                  Copy
                </Button>

                {/* Acknowledge & Archive — copies summary first, then archives */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-display text-[10px] tracking-widest border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
                      disabled={archiveOrder.isPending}
                    >
                      <Archive size={13} />
                      {archiveOrder.isPending ? "Archiving…" : "Acknowledge & Archive"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="section-ink border-white/10">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Acknowledge & archive this casual order?</AlertDialogTitle>
                      <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                        The order summary will be copied to your clipboard, then the order will be removed from the Casual tab. It will be kept in the Archived tab for records. Casual orders do not feed loyalty analytics.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="font-display text-[10px] tracking-widest">Keep</AlertDialogCancel>
                      <AlertDialogAction
                        className="font-display text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700"
                        onClick={async () => {
                          const summary = buildCasualSummary(
                            { ...order, specialInstructions: specialInstructions.trim() || null },
                            items,
                            deliveryCharge
                          );
                          try {
                            await navigator.clipboard.writeText(summary);
                            toast.success("Summary copied — archiving order");
                          } catch {
                            toast("Archiving order (clipboard unavailable)");
                          }
                          archiveOrder.mutate({ id: order.id });
                        }}
                      >
                        Acknowledge & Archive
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* ─── Power Drop pipeline actions ─────────────────────────────────────── */}
            {/* Issue WhatsApp Invoice */}
            {order.isPowerDrop && <AlertDialog open={confirmInvoice} onOpenChange={setConfirmInvoice}>
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
                    onClick={() => {
      setConfirmInvoice(false);
      handleIssueInvoice();
      // Transition order to Invoice Issued status
      markInvoiceIssued.mutate({ id: order.id });
    }}
                  >
                    Send Invoice
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>}

            {/* Final Call reminder */}
            {order.status !== "paid" && (
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
                      {"POWERDROP FINAL CALL\n\nJust a quick reminder — the 24-hour window to lock in your GroupBuy Power-Drop order is almost up.\n\nIf you no longer require the order, no stress at all. Simply let the invoice lapse tonight and we'll catch you on the next Power-Drop\n\nIf you'd like to keep your order:\n\n1. Settle the invoice\n2. Send me a screenshot of the remittance\n\nOnce I receive the remittance, I'll get your order locked in and moved through to processing.\n\nCheers!"}
                    </div>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white"
                      onClick={() => {
                        setConfirmFinalCall(false);
                        const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                        const msg = "POWERDROP FINAL CALL\n\nJust a quick reminder — the 24-hour window to lock in your GroupBuy Power-Drop order is almost up.\n\nIf you no longer require the order, no stress at all. Simply let the invoice lapse tonight and we'll catch you on the next Power-Drop\n\nIf you'd like to keep your order:\n\n1. Settle the invoice\n2. Send me a screenshot of the remittance\n\nOnce I receive the remittance, I'll get your order locked in and moved through to processing.\n\nCheers!";
                        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                      }}
                    >
                      Send Message
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {/* Mark as Paid */}
            {order.status !== "paid" && (
              <AlertDialog open={confirmMarkPaid} onOpenChange={setConfirmMarkPaid}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-blue-700 hover:bg-blue-600 text-white gap-1.5"
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
                      className="font-display text-[10px] tracking-widest bg-blue-700 hover:bg-blue-600"
                      onClick={() => {
                        setConfirmMarkPaid(false);
                        markPaid.mutate({ id: order.id });
                      }}
                    >
                      Mark as Paid
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Payment Confirmation WhatsApp message */}
            <AlertDialog open={confirmPaymentConfirmation} onOpenChange={setConfirmPaymentConfirmation}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white gap-1.5"
                >
                  <MessageCircle size={13} />
                  Payment Confirmation
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Send payment confirmation?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    This will send the following message to {order.phone}:
                  </AlertDialogDescription>
                  <div className="mt-3 bg-white/5 border border-white/10 px-4 py-3 font-mono-brand text-[12px] text-[#f5f2ec] whitespace-pre-line">
                    {`Your payment for the GroupBuy Power-Drop order has been received and is now locked-in.\nSee you next week (${order.pickupDate}) at (${locationLabel(order.location, order.deliveryAddress)})`}
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white"
                    onClick={() => {
                      setConfirmPaymentConfirmation(false);
                      const locStr = locationLabel(order.location, order.deliveryAddress);
                      const msg = `Your payment for the GroupBuy Power-Drop order has been received and is now locked-in.\nSee you next week (${order.pickupDate}) at (${locStr})`;
                      const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                    }}
                  >
                    Send Message
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Pick up Available WhatsApp message */}
            <AlertDialog open={confirmPickupAvailableMsg} onOpenChange={setConfirmPickupAvailableMsg}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white gap-1.5"
                >
                  <MessageCircle size={13} />
                  Pick up Available
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="section-ink border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Send pick up available message?</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                    This will send the following message to {order.phone}:
                  </AlertDialogDescription>
                  <div className="mt-3 bg-white/5 border border-white/10 px-4 py-3 font-mono-brand text-[12px] text-[#f5f2ec] whitespace-pre-line">
                    {(() => {
                      const locLine = locationLabel(order.location, order.deliveryAddress);
                      const inv = order.invoiceNumber ?? `GB-${String(order.id).padStart(5, '0')}`;
                      const unitParts: string[] = [];
                      if (order.pickupBags) unitParts.push(`${order.pickupBags} Bag${order.pickupBags !== 1 ? 's' : ''}`);
                      if (order.pickupBoxes) unitParts.push(`${order.pickupBoxes} Box${order.pickupBoxes !== 1 ? 'es' : ''}`);
                      if (order.pickupFreezerBags) unitParts.push(`${order.pickupFreezerBags} Frz Bag${order.pickupFreezerBags !== 1 ? 's' : ''}`);
                      if (order.pickupFreezerBoxes) unitParts.push(`${order.pickupFreezerBoxes} Frz Box${order.pickupFreezerBoxes !== 1 ? 'es' : ''}`);
                      const unitsStr = unitParts.length > 0 ? ` ${unitParts.join(', ')}` : '';
                      const hubsSection = order.location !== 'delivery' ? `\n\n*PICK-UP HUBS*\nClayton — BQ Direct\n126 Fairbank Rd, Clayton South VIC 3169\n\nCranbourne — Mitchells Quality Meat\nCranbourne Park Shopping Centre\n\nHours: Monday – Saturday | 9:00am – 5:00pm` : '';
                      const deliverySection = order.location === 'delivery' ? `\n\n*DELIVERY*\nIf delivery was selected, your driver will contact you to arrange scheduling.\n\nPlease allow a full-day delivery window.\n\nIf nobody will be home, reply with safe-drop instructions.` : '';
                      return `*GROUPBUY POWER-DROP ORDER IS READY!*\n\n*PICK-UP / DELIVERY STATUS*\nYour order has been prepared and will be ready from your selected hub from *Tomorrow* onwards.\n\n*YOUR SELECTED LOCATION*\n${locLine}\n\n*PICKING UP YOUR ORDER*\npresent these details to the crew upon collection.\n\n*ORDER DETAILS*\nPhone: *${order.phone}*\nInvoice: *${inv}*\nPick up Units:${unitsStr}${hubsSection}${deliverySection}`;
                    })()}
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="font-display text-[10px] tracking-widest bg-[#25D366] hover:bg-[#1da851] text-white"
                    onClick={() => {
                      setConfirmPickupAvailableMsg(false);
                      // Auto-advance to completed when pickup message is sent
                      markCompleted.mutate({ id: order.id });
                      const intlPhone = order.phone.replace(/\D/g, "").replace(/^0/, "61");
                      const locLine = locationLabel(order.location, order.deliveryAddress);
                      const inv = order.invoiceNumber ?? `GB-${String(order.id).padStart(5, '0')}`;
                      const unitParts: string[] = [];
                      if (order.pickupBags) unitParts.push(`${order.pickupBags} Bag${order.pickupBags !== 1 ? 's' : ''}`);
                      if (order.pickupBoxes) unitParts.push(`${order.pickupBoxes} Box${order.pickupBoxes !== 1 ? 'es' : ''}`);
                      if (order.pickupFreezerBags) unitParts.push(`${order.pickupFreezerBags} Frz Bag${order.pickupFreezerBags !== 1 ? 's' : ''}`);
                      if (order.pickupFreezerBoxes) unitParts.push(`${order.pickupFreezerBoxes} Frz Box${order.pickupFreezerBoxes !== 1 ? 'es' : ''}`);
                      const unitsStr = unitParts.length > 0 ? ` ${unitParts.join(', ')}` : '';
                      const hubsSection = order.location !== 'delivery' ? `\n\n*PICK-UP HUBS*\nClayton — BQ Direct\n126 Fairbank Rd, Clayton South VIC 3169\n\nCranbourne — Mitchells Quality Meat\nCranbourne Park Shopping Centre\n\nHours: Monday – Saturday | 9:00am – 5:00pm` : '';
                      const deliverySection = order.location === 'delivery' ? `\n\n*DELIVERY*\nIf delivery was selected, your driver will contact you to arrange scheduling.\n\nPlease allow a full-day delivery window.\n\nIf nobody will be home, reply with safe-drop instructions.` : '';
                      const msg = `*GROUPBUY POWER-DROP ORDER IS READY!*\n\n*PICK-UP / DELIVERY STATUS*\nYour order has been prepared and will be ready from your selected hub from *Tomorrow* onwards.\n\n*YOUR SELECTED LOCATION*\n${locLine}\n\n*PICKING UP YOUR ORDER*\npresent these details to the crew upon collection.\n\n*ORDER DETAILS*\nPhone: *${order.phone}*\nInvoice: *${inv}*\nPick up Units:${unitsStr}${hubsSection}${deliverySection}`;
                      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                    }}
                  >
                    Send Message
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Move to Remittance */}
            {order.status === "invoice_issued" && (
              <AlertDialog open={confirmMarkRemittance} onOpenChange={setConfirmMarkRemittance}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-cyan-700 hover:bg-cyan-600 text-white gap-1.5"
                    disabled={markRemittance.isPending}
                  >
                    <DollarSign size={13} />
                    {markRemittance.isPending ? "Saving…" : "Move to Remittance"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="section-ink border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Move order to Remittance?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                      Order #{order.phone} will be moved to the Remittance tab, indicating a payment remittance has been received and is pending verification.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-cyan-700 hover:bg-cyan-600"
                      onClick={() => {
                        setConfirmMarkRemittance(false);
                        markRemittance.mutate({ id: order.id });
                      }}
                    >
                      Move to Remittance
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Mark as Paid — also available from Remittance */}
            {order.status === "remittance" && (
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
                        markPaid.mutate({ id: order.id });
                      }}
                    >
                      Mark as Paid
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Mark as In Progress */}
            {order.isPowerDrop && order.status === "paid" && (
              <AlertDialog open={confirmMarkInProgress} onOpenChange={setConfirmMarkInProgress}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-orange-700 hover:bg-orange-600 text-white gap-1.5"
                    disabled={markInProgress.isPending}
                  >
                    <Loader2 size={13} />
                    {markInProgress.isPending ? "Saving…" : "Move to In Progress"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="section-ink border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Mark order as In Progress?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                      Order #{order.phone} will be moved to the In Progress tab. Use this to indicate the order is being prepared.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-orange-700 hover:bg-orange-600"
                      onClick={() => {
                        setConfirmMarkInProgress(false);
                        markInProgress.mutate({ id: order.id });
                      }}
                    >
                      Move to In Progress
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Mark as Pick up Available */}
            {order.isPowerDrop && (order.status === "paid" || order.status === "in_progress") && (
              <AlertDialog open={confirmMarkPickupAvailable} onOpenChange={setConfirmMarkPickupAvailable}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-purple-700 hover:bg-purple-600 text-white gap-1.5"
                    disabled={markPickupAvailable.isPending}
                  >
                    <Package size={13} />
                    {markPickupAvailable.isPending ? "Saving…" : "Pick up Available"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="section-ink border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Mark order as Pick up Available?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                      Order #{order.phone} will be moved to the Pick up Available tab. The customer's order is ready for collection.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-purple-700 hover:bg-purple-600"
                      onClick={() => {
                        setConfirmMarkPickupAvailable(false);
                        markPickupAvailable.mutate({ id: order.id });
                      }}
                    >
                      Mark as Pick up Available
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Mark as Completed */}
            {order.status === "pickup_available" && (
              <AlertDialog open={confirmMarkCompleted} onOpenChange={setConfirmMarkCompleted}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="font-display text-[10px] tracking-widest bg-emerald-700 hover:bg-emerald-600 text-white gap-1.5"
                    disabled={markCompleted.isPending}
                  >
                    <CheckCircle2 size={13} />
                    {markCompleted.isPending ? "Saving…" : "Mark as Completed"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="section-ink border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Mark order as Completed?</AlertDialogTitle>
                    <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                      Order #{order.phone} will be moved to the Completed tab. This confirms the customer has picked up or received their order.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="font-display text-[10px] tracking-widest bg-emerald-700 hover:bg-emerald-600"
                      onClick={() => {
                        setConfirmMarkCompleted(false);
                        markCompleted.mutate({ id: order.id });
                      }}
                    >
                      Mark as Completed
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Packing Slip PDF */}
            <Button
              size="sm"
              variant="outline"
              className="font-display text-[10px] tracking-widest border-slate-500/40 text-slate-300 hover:bg-slate-500/10 gap-1.5"
              onClick={handleDownloadPackingSlip}
              disabled={downloadingSlip}
            >
              <FileText size={13} />
              {downloadingSlip ? "Generating…" : "Packing Slip"}
            </Button>

            {/* Cancel Order removed */}
            {false && (
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
                      onClick={() => {}}
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
            {/* Archive Order — only shown for non-archived Power Drop orders.
                 Casual orders use the Acknowledge & Archive button above instead. */}
            {!order.archived && order.isPowerDrop && <AlertDialog>
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
                    Order #{order.phone} will be hidden from the active tabs but kept for analytics. You can restore it from the Archived tab.
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
    "PayID: 0400032420\nAccount Name: Best Quality Butcher Pty Ltd\nBSB: 013268\nAccount No: 661195191"
  );
  const [editingBank, setEditingBank] = useState(false);
  const [downloadingInvoices, setDownloadingInvoices] = useState(false);

  const [downloadingSchedule, setDownloadingSchedule] = useState(false);
  const [downloadingItems, setDownloadingItems] = useState(false);
  const [downloadingAllSlips, setDownloadingAllSlips] = useState(false);
  const [downloadingItemsCsv, setDownloadingItemsCsv] = useState(false);
  const [downloadingCasualCsv, setDownloadingCasualCsv] = useState(false);

  async function handleDownloadAllSlips() {
    setDownloadingAllSlips(true);
    try {
      const res = await fetch(`/api/admin/packing-slips/download`, { credentials: "include" });
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
      a.download = `packing-slips-${timestamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    } finally {
      setDownloadingAllSlips(false);
    }
  }

  async function handleDownloadItemsCsv() {
    setDownloadingItemsCsv(true);
    try {
      const res = await fetch(`/api/admin/items-ordered/download-csv`, { credentials: "include" });
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
      a.download = `items-ordered-${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    } finally {
      setDownloadingItemsCsv(false);
    }
  }

  async function handleDownloadCasualCsv() {
    setDownloadingCasualCsv(true);
    try {
      // Build CSV client-side from the already-loaded allCasual list
      const rows = allCasual.map((o) => {
        const items = parseItems(o.items);
        const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
        const delivery = parseFloat(o.deliveryCharge ?? "0") || 0;
        const total = subtotal + delivery;
        const itemSummary = items.map((i) => `${i.qty}× ${i.name}${i.cut ? ` (${i.cut})` : ""} @$${parseFloat(i.price).toFixed(2)}${i.unit}`).join(" | ");
        return [
          o.id,
          new Date(o.createdAt).toLocaleString("en-AU"),
          o.phone,
          o.customerName ?? "",
          locationLabel(o.location, o.deliveryAddress),
          o.pickupDate,
          itemSummary,
          total.toFixed(2),
          o.specialInstructions ?? "",
          o.status,
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
      const header = '"ID","Created","Phone","Customer Name","Location","Pickup Date","Items","Total","Notes","Status"';
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `casual-orders-${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setDownloadingCasualCsv(false);
    }
  }

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
      const res = await fetch(`/api/admin/packing-sheet/download`, {
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
      a.download = `packing-sheet-${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    } finally {
      setDownloadingInvoices(false);
    }
  }

  // ─── Bulk selection state (scoped to pickup_available tab) ──────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Clear selection when switching tabs
  useEffect(() => { setSelectedIds(new Set()); }, [statusFilter]);

  const [confirmBulkComplete, setConfirmBulkComplete] = useState(false);

  const bulkMarkCompleted = trpc.admin.orders.bulkMarkCompleted.useMutation({
    onSuccess: (result) => {
      toast.success(`Marked ${result.count} order${result.count === 1 ? "" : "s"} as Completed ✓`);
      setSelectedIds(new Set());
      handleRefresh();
      utils.admin.orders.counts.invalidate();
    },
    onError: () => toast.error("Failed to mark orders as completed"),
  });

  // ─── Bulk transfer paid → in_progress mutation ──────────────────────────────
  const transferPaidToPickupAvailable = trpc.admin.orders.transferPaidToPickupAvailable.useMutation({
    onSuccess: (result) => {
      toast.success(`Transferred ${result.transferredCount} paid order${result.transferredCount === 1 ? "" : "s"} to In Progress`);
      handleRefresh();
      utils.admin.orders.counts.invalidate();
    },
    onError: () => toast.error("Failed to transfer paid orders"),
  });

  // ─── Phone search state ─────────────────────────────────────────────────────
  const [phoneSearch, setPhoneSearch] = useState("");
  const [debouncedPhoneSearch, setDebouncedPhoneSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPhoneSearch(phoneSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [phoneSearch]);

    // Detect if query looks like a total-due amount: optional $, digits, optional decimal (e.g. "45", "$45.50")
  const isTotalSearch = /^\$\d+(\.\d{0,2})?$/.test(debouncedPhoneSearch.trim());
  // Treat as active phone/invoice search only when NOT a total search
  const isSearchingPhone = !isTotalSearch && (debouncedPhoneSearch.replace(/\D/g, "").length > 0 || /^GB-?\d*/i.test(debouncedPhoneSearch.trim()));
  const { data: phoneSearchResults, isLoading: isPhoneSearchLoading } =
    trpc.admin.orders.searchByPhone.useQuery(
      { phoneQuery: debouncedPhoneSearch, archived: statusFilter === "archived" },
      { enabled: user?.role === "admin" && isSearchingPhone }
    );

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

  const { data: casualOrdersData, isLoading: isLoadingCasual } = trpc.admin.orders.listCasual.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 30_000,
  });
  const allCasual = (casualOrdersData as Order[] | undefined) ?? [];

  const [confirmArchiveAllCasual, setConfirmArchiveAllCasual] = useState(false);
  const [confirmArchiveAllCompleted, setConfirmArchiveAllCompleted] = useState(false);
  const archiveAllCasual = trpc.admin.orders.archiveAllCasual.useMutation({
    onSuccess: (result) => {
      toast.success(`Archived ${result.archivedCount} casual order${result.archivedCount === 1 ? "" : "s"} ✓`);
      utils.admin.orders.listCasual.invalidate();
      utils.admin.orders.counts.invalidate();
    },
    onError: () => toast.error("Failed to archive casual orders"),
  });

  const archiveAllCompleted = trpc.admin.orders.archiveAllCompleted.useMutation({
    onSuccess: (result) => {
      toast.success(`Archived ${result.archivedCount} completed order${result.archivedCount === 1 ? "" : "s"} ✓`);
      utils.admin.orders.list.invalidate();
      utils.admin.orders.counts.invalidate();
    },
    onError: () => toast.error("Failed to archive completed orders"),
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

  // When searching by phone, use server search results instead of paginated list.
  // Status filter still applies to search results (except archived which is handled server-side).
  const searchResults = (phoneSearchResults as Order[] | undefined) ?? [];

  // Helper: compute order total for total-due search
  function getOrderTotal(o: Order): number {
    const items = parseItems(o.items);
    const subtotal = items.reduce((sum, i) => sum + calcItemTotal(i), 0);
    return subtotal + (parseFloat(o.deliveryCharge ?? "0") || 0);
  }

  const baseOrders = statusFilter === "archived"
    ? allArchived
    : statusFilter === "casual"
    ? allCasual
    : statusFilter === "all"
    ? allOrders
    : allOrders.filter((o) => o.status === statusFilter);

  const filtered = isSearchingPhone
    ? statusFilter === "archived"
      ? searchResults
      : statusFilter === "casual"
      ? searchResults.filter((o) => !o.isPowerDrop)
      : statusFilter === "all"
      ? searchResults
      : searchResults.filter((o) => o.status === statusFilter)
    : isTotalSearch
      ? (() => {
          const target = parseFloat(debouncedPhoneSearch.replace("$", ""));
          return baseOrders.filter((o) => Math.abs(getOrderTotal(o) - target) < 0.005);
        })()
    : baseOrders;

  // Use server-provided counts for filter tabs and export buttons — never capped by pagination.
  // Fall back to loaded-order counts while the server count query is still loading.
  const counts = {
    all: serverCounts?.all ?? allOrders.length,
    pending: serverCounts?.pending ?? allOrders.filter((o) => o.status === "pending").length,
    invoice_issued: serverCounts?.invoice_issued ?? allOrders.filter((o) => o.status === "invoice_issued").length,
    remittance: serverCounts?.remittance ?? allOrders.filter((o) => o.status === "remittance").length,
    paid: serverCounts?.paid ?? allOrders.filter((o) => o.status === "paid").length,
    in_progress: serverCounts?.in_progress ?? allOrders.filter((o) => o.status === "in_progress").length,
    pickup_available: serverCounts?.pickup_available ?? allOrders.filter((o) => o.status === "pickup_available").length,
    completed: serverCounts?.completed ?? allOrders.filter((o) => o.status === "completed").length,
    archived: allArchived.length,
    casual: serverCounts?.casual ?? 0,
  };
  // No longer needed — counts come from the server
  const countSuffix = "";

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "invoice_issued", label: "Invoice Issued" },
    { key: "remittance", label: "Remittance" },
    { key: "paid", label: "Paid" },
    { key: "in_progress", label: "In Progress" },
    { key: "pickup_available", label: "Pick up Available" },
    { key: "completed", label: "Completed" },
    { key: "casual", label: "Casual" },
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

  // Derived selection helpers — must come after sortedFiltered
  const pickupAvailableOrders = useMemo<Order[]>(
    () => (sortedFiltered as Order[]).filter((o) => o.status === "pickup_available"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedFiltered]
  );
  const allPickupSelected =
    pickupAvailableOrders.length > 0 &&
    pickupAvailableOrders.every((o: Order) => selectedIds.has(o.id));
  const somePickupSelected = pickupAvailableOrders.some((o: Order) => selectedIds.has(o.id));

  function toggleSelectAll() {
    if (allPickupSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pickupAvailableOrders.forEach((o: Order) => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pickupAvailableOrders.forEach((o: Order) => next.add(o.id));
        return next;
      });
    }
  }

  function toggleOneOrder(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
          {/* Transfer Paid → In Progress — bulk action button with confirmation dialog */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={transferPaidToPickupAvailable.isPending || counts.paid === 0}
                className="flex items-center gap-1.5 font-mono-brand text-[10px] text-orange-400/70 hover:text-orange-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-orange-500/30 hover:border-orange-400/50 rounded px-2 py-1"
                title="Transfer all paid orders to In Progress"
              >
                <Loader2 size={12} />
                {transferPaidToPickupAvailable.isPending ? "Transferring…" : `Transfer Paid${counts.paid > 0 ? ` (${counts.paid})` : ""}`}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="section-ink border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Transfer all paid orders to In Progress?</AlertDialogTitle>
                <AlertDialogDescription className="font-mono-brand text-[#8a857c] space-y-1">
                  <span className="block">This will move all currently paid, non-archived orders to the In Progress tab.</span>
                  <span className="block mt-2 text-orange-400/80">{counts.paid} paid order{counts.paid !== 1 ? "s" : ""} will be transferred.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => transferPaidToPickupAvailable.mutate()}
                  className="font-display text-[10px] tracking-widest bg-orange-700 hover:bg-orange-600 text-white"
                >
                  Transfer Paid Orders
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="w-px h-4 bg-white/10" />
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
            title={`Download schedule list${counts.pickup_available > 0 ? ` for ${counts.pickup_available} pick up available order${counts.pickup_available !== 1 ? "s" : ""}` : ""}`}
          >
            <FileDown size={13} />
            {downloadingSchedule ? "Generating…" : `Schedule List${counts.pickup_available > 0 ? ` (${counts.pickup_available})` : ""}`}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleDownloadItemsCsv}
            disabled={downloadingItemsCsv}
            className="flex items-center gap-1.5 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download all items ordered (CSV) from all non-archived orders"
          >
            <FileDown size={13} />
            {downloadingItemsCsv ? "Generating…" : "Items Ordered CSV"}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleDownloadAllSlips}
            disabled={downloadingAllSlips}
            className="flex items-center gap-1.5 font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Download all packing slips${counts.paid > 0 ? ` for ${counts.paid} paid order${counts.paid !== 1 ? "s" : ""}` : ""}`}
          >
            <FileText size={13} />
            {downloadingAllSlips ? "Generating…" : `All Packing Slips${counts.paid > 0 ? ` (${counts.paid})` : ""}`}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => handleRefresh()}
            className="font-mono-brand text-[10px] text-[#8a857c] hover:text-[#f5f2ec] transition-colors"
          >
            Refresh
          </button>
          <div className="w-px h-4 bg-white/10" />
          {/* Archive All Casual */}
          <AlertDialog open={confirmArchiveAllCasual} onOpenChange={setConfirmArchiveAllCasual}>
            <AlertDialogTrigger asChild>
              <button
                disabled={archiveAllCasual.isPending || counts.casual === 0}
                className="flex items-center gap-1.5 font-mono-brand text-[10px] text-amber-400/70 hover:text-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/30 hover:border-amber-400/50 rounded px-2 py-1"
                title="Archive all casual orders"
              >
                <Archive size={12} />
                {archiveAllCasual.isPending ? "Archiving…" : `Archive Casual${counts.casual > 0 ? ` (${counts.casual})` : ""}`}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="section-ink border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Archive all casual orders?</AlertDialogTitle>
                <AlertDialogDescription className="font-mono-brand text-[#8a857c] space-y-1">
                  <span className="block">This will archive all {counts.casual} casual order{counts.casual !== 1 ? "s" : ""}. They will be hidden from the Casual tab but kept for records.</span>
                  <span className="block mt-2 text-amber-400/80">Casual orders do not feed loyalty analytics.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { setConfirmArchiveAllCasual(false); archiveAllCasual.mutate(); }}
                  className="font-display text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700"
                >
                  Archive All Casual
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="w-px h-4 bg-white/10" />
          {/* Archive All Completed */}
          <AlertDialog open={confirmArchiveAllCompleted} onOpenChange={setConfirmArchiveAllCompleted}>
            <AlertDialogTrigger asChild>
              <button
                disabled={archiveAllCompleted.isPending || counts.completed === 0}
                className="flex items-center gap-1.5 font-mono-brand text-[10px] text-green-400/70 hover:text-green-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-green-500/30 hover:border-green-400/50 rounded px-2 py-1"
                title="Archive all completed orders"
              >
                <Archive size={12} />
                {archiveAllCompleted.isPending ? "Archiving…" : `Archive Completed${counts.completed > 0 ? ` (${counts.completed})` : ""}`}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="section-ink border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">Archive all completed orders?</AlertDialogTitle>
                <AlertDialogDescription className="font-mono-brand text-[#8a857c] space-y-1">
                  <span className="block">This will archive all {counts.completed} completed order{counts.completed !== 1 ? "s" : ""}. They will be hidden from the active tabs but kept for records.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { setConfirmArchiveAllCompleted(false); archiveAllCompleted.mutate(); }}
                  className="font-display text-[10px] tracking-widest bg-green-700 hover:bg-green-800"
                >
                  Archive All Completed
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

        {/* Phone search */}
        <div className="flex items-center gap-2 border border-white/10 px-3 py-2">
          <Search size={13} className="text-[#8a857c] shrink-0" />
          <input
            type="text"
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            placeholder="Search phone, invoice (GB-…), or total due ($45.50)…"
            className="flex-1 bg-transparent text-[#f5f2ec] font-mono-brand text-[12px] placeholder-[#8a857c] focus:outline-none"
          />
          {phoneSearch && (
            <button
              onClick={() => setPhoneSearch("")}
              className="text-[#8a857c] hover:text-[#f5f2ec] transition-colors"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
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
        {isSearchingPhone && (
          <p className="font-mono-brand text-[10px] text-[#8a857c]">
            {isPhoneSearchLoading
              ? "Searching…"
              : `Showing phone search results for “${debouncedPhoneSearch.replace(/\D/g, "")}”`}
          </p>
        )}
        {((!isSearchingPhone && isLoading) || (!isSearchingPhone && statusFilter === "archived" && isLoadingArchived) || (!isSearchingPhone && statusFilter === "casual" && isLoadingCasual) || (isSearchingPhone && isPhoneSearchLoading)) ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 border border-white/10 animate-pulse bg-white/3" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Package size={40} className="text-[#8a857c]/30" />
            <p className="font-display text-[11px] tracking-widest text-[#8a857c]">
              {statusFilter === "all" ? "NO ORDERS YET" : statusFilter === "archived" ? "NO ARCHIVED ORDERS" : statusFilter === "casual" ? "NO CASUAL ORDERS" : statusFilter === "invoice_issued" ? "NO INVOICE ISSUED ORDERS" : statusFilter === "pickup_available" ? "NO PICK UP AVAILABLE ORDERS" : statusFilter === "completed" ? "NO COMPLETED ORDERS" : `NO ${statusFilter.toUpperCase()} ORDERS`}
            </p>
            <p className="font-mono-brand text-[11px] text-[#8a857c]/60">
              {statusFilter === "all"
                ? "Orders will appear here when customers check out."
                : statusFilter === "casual"
                ? "Casual orders placed outside a Power Drop will appear here."
                : "Try switching to a different filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Bulk action toolbar — only visible in pickup_available tab when ≥1 order is selected */}
            {statusFilter === "pickup_available" && selectedIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-900/30 border border-emerald-500/30">
                <span className="font-mono-brand text-[11px] text-emerald-300">
                  {selectedIds.size} order{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <AlertDialog open={confirmBulkComplete} onOpenChange={setConfirmBulkComplete}>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={bulkMarkCompleted.isPending}
                      className="flex items-center gap-1.5 font-display text-[10px] tracking-widest px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={12} />
                      {bulkMarkCompleted.isPending ? "Marking…" : `Mark ${selectedIds.size} as Completed`}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="section-ink border-white/10">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display tracking-widest text-[#f5f2ec]">
                        Mark {selectedIds.size} order{selectedIds.size !== 1 ? "s" : ""} as Completed?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-mono-brand text-[#8a857c]">
                        This will move all {selectedIds.size} selected order{selectedIds.size !== 1 ? "s" : ""} to the Completed tab. This confirms the customers have picked up or received their orders.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="font-display text-[10px] tracking-widest">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="font-display text-[10px] tracking-widest bg-emerald-700 hover:bg-emerald-600"
                        onClick={() => {
                          setConfirmBulkComplete(false);
                          bulkMarkCompleted.mutate({ ids: Array.from(selectedIds) });
                        }}
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Select-all row — only visible in pickup_available tab */}
            {statusFilter === "pickup_available" && pickupAvailableOrders.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 border border-white/10 bg-white/[0.02]">
                <input
                  type="checkbox"
                  checked={allPickupSelected}
                  ref={(el) => { if (el) el.indeterminate = somePickupSelected && !allPickupSelected; }}
                  onChange={toggleSelectAll}
                  className="accent-[#c73e3a] w-4 h-4 shrink-0 cursor-pointer"
                />
                <span className="font-mono-brand text-[11px] text-[#8a857c]">
                  {allPickupSelected ? "Deselect all" : `Select all ${pickupAvailableOrders.length}`}
                </span>
              </div>
            )}

            {sortedFiltered.map((order) => (
              <OrderCard
                key={order.id}
                order={order as Order}
                bankDetails={bankDetails}
                onRefresh={handleRefresh}
                selectable={statusFilter === "pickup_available"}
                selected={selectedIds.has(order.id)}
                onToggleSelect={toggleOneOrder}
              />
            ))}
          </div>
        )}

        {/* Load More — only shown for pipeline views (not archived/casual) and when not searching */}
        {statusFilter !== "archived" && statusFilter !== "casual" && !isSearchingPhone && (
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
