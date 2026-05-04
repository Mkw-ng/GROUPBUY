/**
 * OrderHistoryAccordion — read-only order history for the /my-stats page.
 * Each row shows order date, location, total, and Power Drop indicator.
 * Expanding a row reveals the full item list with weights and line totals.
 * "Butcher's Receipt" aesthetic: cream/ink, mono font.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Zap, MapPin, Calendar, Package } from "lucide-react";

interface OrderItem {
  name: string;
  cut?: string;
  qty: number;
  price: string;
  unit: string;
  finalWeightKg?: string;
}

interface SafeOrder {
  id: number;
  createdAt: Date | string;
  pickupDate: string;
  location: string;
  status: string;
  isPowerDrop: boolean;
  deliveryCharge?: string | null;
  items: OrderItem[];
  total: string;
}

interface OrderHistoryAccordionProps {
  orders: SafeOrder[];
}

function calcLineTotal(item: OrderItem): number {
  const p = parseFloat(item.price) || 0;
  const isKg = (item.unit || "").toLowerCase().includes("kg");
  const w = parseFloat(item.finalWeightKg || "") || 0;
  return isKg && w > 0 ? p * w : p * item.qty;
}

function OrderRow({ order, index }: { order: SafeOrder; index: number }) {
  const [open, setOpen] = useState(false);

  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();

  const delivery = parseFloat(order.deliveryCharge ?? "0") || 0;
  const statusColor =
    order.status === "paid"
      ? "text-green-700"
      : order.status === "cancelled"
      ? "text-red-600"
      : "text-[#8a857c]";

  return (
    <div className="border-b border-dashed border-[#2b2b2b]/15 last:border-b-0">
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-3 text-left group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Order number */}
          <span className="font-mono text-[10px] text-[#8a857c] shrink-0">
            #{String(index + 1).padStart(2, "0")}
          </span>

          {/* Date */}
          <span className="font-mono text-[11px] text-[#2b2b2b] font-semibold shrink-0">
            {dateStr}
          </span>

          {/* Power Drop badge */}
          {order.isPowerDrop && (
            <span className="flex items-center gap-0.5 bg-[#c73e3a] text-white font-mono text-[8px] px-1.5 py-0.5 rounded-sm shrink-0">
              <Zap size={8} />
              PD
            </span>
          )}

          {/* Location — truncated on small screens */}
          <span className="font-mono text-[10px] text-[#8a857c] truncate hidden sm:block">
            {order.location}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-[12px] text-[#2b2b2b] font-bold">
            ${parseFloat(order.total).toFixed(2)}
          </span>
          <span className={`font-mono text-[9px] font-semibold uppercase ${statusColor} hidden sm:block`}>
            {order.status}
          </span>
          {open ? (
            <ChevronUp size={14} className="text-[#8a857c] group-hover:text-[#2b2b2b] transition-colors" />
          ) : (
            <ChevronDown size={14} className="text-[#8a857c] group-hover:text-[#2b2b2b] transition-colors" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="pb-4 space-y-3">
          {/* Meta row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <MapPin size={10} className="text-[#8a857c]" />
              <span className="font-mono text-[10px] text-[#5a5248]">{order.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={10} className="text-[#8a857c]" />
              <span className="font-mono text-[10px] text-[#5a5248]">
                Pickup: {order.pickupDate}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Package size={10} className="text-[#8a857c]" />
              <span className={`font-mono text-[10px] font-semibold uppercase ${statusColor}`}>
                {order.status}
              </span>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white border border-[#2b2b2b]/10 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-[#2b2b2b]/5 border-b border-[#2b2b2b]/10">
              <span className="font-mono text-[9px] text-[#8a857c] tracking-wider">ITEM</span>
              <span className="font-mono text-[9px] text-[#8a857c] tracking-wider text-right">QTY / WT</span>
              <span className="font-mono text-[9px] text-[#8a857c] tracking-wider text-right">PRICE</span>
              <span className="font-mono text-[9px] text-[#8a857c] tracking-wider text-right">TOTAL</span>
            </div>

            {/* Item rows */}
            {order.items.length === 0 ? (
              <div className="px-3 py-2">
                <span className="font-mono text-[10px] text-[#8a857c] italic">No item details available</span>
              </div>
            ) : (
              order.items.map((item, i) => {
                const isKg = (item.unit || "").toLowerCase().includes("kg");
                const finalKg = parseFloat(item.finalWeightKg || "") || 0;
                const qtyDisplay = isKg && finalKg > 0
                  ? `${finalKg.toFixed(2)} kg`
                  : `${item.qty} ${item.unit || "×"}`;
                const lineTotal = calcLineTotal(item);

                return (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 border-b border-[#2b2b2b]/5 last:border-b-0"
                  >
                    {/* Name + cut */}
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-[#2b2b2b] font-semibold leading-tight truncate">
                        {item.name}
                      </p>
                      {item.cut && (
                        <p className="font-mono text-[9px] text-[#8a857c] leading-tight truncate">
                          {item.cut}
                        </p>
                      )}
                    </div>

                    {/* Qty / weight */}
                    <span className="font-mono text-[10px] text-[#5a5248] text-right self-center whitespace-nowrap">
                      {qtyDisplay}
                    </span>

                    {/* Unit price */}
                    <span className="font-mono text-[10px] text-[#5a5248] text-right self-center whitespace-nowrap">
                      ${parseFloat(item.price).toFixed(2)}
                    </span>

                    {/* Line total */}
                    <span className="font-mono text-[10px] text-[#2b2b2b] font-semibold text-right self-center whitespace-nowrap">
                      ${lineTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })
            )}

            {/* Delivery charge row */}
            {delivery > 0 && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 border-t border-dashed border-[#2b2b2b]/15">
                <span className="font-mono text-[10px] text-[#8a857c] italic col-span-3">Delivery charge</span>
                <span className="font-mono text-[10px] text-[#5a5248] text-right">${delivery.toFixed(2)}</span>
              </div>
            )}

            {/* Order total footer */}
            <div className="flex justify-between items-center px-3 py-2 bg-[#2b2b2b]/5 border-t border-[#2b2b2b]/10">
              <span className="font-mono text-[10px] text-[#5a5248] font-bold tracking-wider">ORDER TOTAL</span>
              <span className="font-mono text-[13px] text-[#2b2b2b] font-bold">
                ${parseFloat(order.total).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Power Drop note */}
          {order.isPowerDrop && (
            <p className="font-mono text-[9px] text-[#c73e3a] flex items-center gap-1">
              <Zap size={9} />
              Power Drop pricing applied to this order
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderHistoryAccordion({ orders }: OrderHistoryAccordionProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="font-mono text-[11px] text-[#8a857c]">
          No archived orders yet. Stats appear after orders are processed.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] text-[#8a857c] tracking-widest">ORDER HISTORY</p>
        <span className="font-mono text-[10px] text-[#2b2b2b] font-bold">
          {orders.length} order{orders.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Accordion rows */}
      <div>
        {orders.map((order, i) => (
          <OrderRow key={order.id} order={order} index={i} />
        ))}
      </div>
    </div>
  );
}
