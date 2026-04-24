/*
 * GROUPBUY Cart Drawer
 * Design: Ink background slide-in panel, items list with JetBrains Mono prices
 * Checkout CTA in red, close button top-right
 * Power Drop: indicator in header + note in WhatsApp checkout message
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, MessageCircle, Zap } from "lucide-react";

export interface CartItem {
  id: number;
  name: string;
  cut: string;
  price: number;
  unit: string;
  qty: number;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemove: (id: number) => void;
  onQtyChange: (id: number, qty: number) => void;
  powerDropActive?: boolean;
}

export default function CartDrawer({
  open,
  onClose,
  items,
  onRemove,
  onQtyChange,
  powerDropActive = false,
}: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm section-ink border-l border-white/10 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-[11px] tracking-widest text-[#f5f2ec]">
                    Your Order
                  </p>
                  {powerDropActive && (
                    <span className="flex items-center gap-1 font-mono-brand text-[9px] tracking-wider text-[#c73e3a] border border-[#c73e3a]/40 px-1.5 py-0.5">
                      <Zap size={8} className="fill-current" />
                      POWER DROP
                    </span>
                  )}
                </div>
                <p className="font-mono-brand text-[11px] text-[#8a857c] mt-0.5">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors"
                aria-label="Close cart"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-16 h-16 opacity-10">
                    <img
                      src="/manus-storage/groupbuy-gmark-dark_d5ad0418.svg"
                      alt=""
                      className="w-full h-full"
                    />
                  </div>
                  <p className="font-mono-brand text-[12px] text-[#8a857c]">
                    Your cart is empty.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 border-b border-white/8 pb-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-[13px] font-bold text-[#f5f2ec] leading-snug">
                          {item.name}
                        </p>
                        <p className="font-mono-brand text-[10px] text-[#8a857c] mt-0.5">
                          {item.cut}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          {/* Qty control */}
                          <div className="flex items-center border border-white/15">
                            <button
                              onClick={() =>
                                item.qty > 1
                                  ? onQtyChange(item.id, item.qty - 1)
                                  : onRemove(item.id)
                              }
                              className="w-7 h-7 flex items-center justify-center text-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors font-mono-brand text-[14px]"
                            >
                              −
                            </button>
                            <span className="w-7 text-center font-mono-brand text-[12px] text-[#f5f2ec]">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => onQtyChange(item.id, item.qty + 1)}
                              className="w-7 h-7 flex items-center justify-center text-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors font-mono-brand text-[14px]"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-mono-brand text-[14px] font-bold text-[#c73e3a]">
                            ${(item.price * item.qty).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="text-[#8a857c] hover:text-[#c73e3a] transition-colors self-start mt-1"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-6 py-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-[11px] tracking-widest text-[#8a857c]">
                    Total
                  </span>
                  <span className="font-mono-brand text-[24px] font-bold text-[#f5f2ec]">
                    ${total.toFixed(2)}
                  </span>
                </div>
                <a
                  href={(() => {
                    const lines = items.map(
                      (i) =>
                        `• ${i.name} (${i.cut}) x${i.qty} — $${(i.price * i.qty).toFixed(2)}`
                    );
                    const powerDropNote = powerDropActive
                      ? "\n⚡ *POWER DROP PRICING APPLIED*\n"
                      : "";
                    const msg = `Hi! I'd like to place an order:${powerDropNote}\n\n${lines.join(
                      "\n"
                    )}\n\nTotal: $${total.toFixed(2)}`;
                    return `https://wa.me/61407249272?text=${encodeURIComponent(msg)}`;
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 font-display text-[11px] tracking-widest bg-[#c73e3a] text-[#f5f2ec] py-4 hover:bg-[#a83330] transition-colors mb-2"
                >
                  <MessageCircle size={14} strokeWidth={1.5} />
                  Checkout via WhatsApp
                </a>
                <p className="font-mono-brand text-[10px] text-[#8a857c] text-center">
                  Payment by bank transfer or card on confirmation
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
