/**
 * ShareDealButton
 * A small share icon button that opens a dark popover with three options:
 *  1. WhatsApp — pre-filled message with deal name, price, and site link
 *  2. Share…   — native OS share sheet (falls back to copy link on desktop)
 *  3. Copy link — copies mitchellsgroupbuy.com/#deals to clipboard
 */
import { useEffect, useRef, useState } from "react";
import { Share2, MessageCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ShareDealButtonProps {
  productName: string;
  price: string;       // e.g. "$34.00/steak"
  isPowerDrop?: boolean;
}

export default function ShareDealButton({
  productName,
  price,
  isPowerDrop = false,
}: ShareDealButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const SITE_URL = "https://mitchellsgroupbuy.com/#deals";

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleWhatsApp() {
    const pdTag = isPowerDrop ? " ⚡ Power Drop" : "";
    const text = encodeURIComponent(
      `Hey! Check out this GroupBuy deal 🥩\n\n*${productName}${pdTag}* — ${price}\n\nOrder here: ${SITE_URL}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  async function handleNativeShare() {
    const pdTag = isPowerDrop ? " ⚡ Power Drop" : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: `GroupBuy Deal — ${productName}`,
          text: `${productName}${pdTag} for ${price} — check it out on GroupBuy!`,
          url: SITE_URL,
        });
      } catch {
        // User cancelled or share failed — silently ignore
      }
    } else {
      // Desktop fallback: copy link
      await doCopyLink();
    }
    setOpen(false);
  }

  async function doCopyLink() {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function handleCopyLink() {
    await doCopyLink();
    setOpen(false);
  }

  return (
    <div className="relative flex-shrink-0">
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Share this deal"
        aria-expanded={open}
        className={`flex items-center justify-center w-9 h-9 border transition-colors ${
          open
            ? "border-[#0a0a0a] bg-[#eae3d2] text-[#0a0a0a]"
            : "border-[#0a0a0a]/18 bg-transparent text-[#8a857c] hover:border-[#0a0a0a] hover:bg-[#eae3d2] hover:text-[#0a0a0a]"
        }`}
      >
        <Share2 size={14} />
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute bottom-[calc(100%+8px)] right-0 w-52 bg-[#0a0a0a] border border-white/12 z-50"
          style={{
            animation: "sharePop 0.15s ease both",
          }}
        >
          {/* Arrow */}
          <div
            className="absolute -bottom-[5px] right-[10px] w-2.5 h-2.5 bg-[#0a0a0a] border-r border-b border-white/12"
            style={{ transform: "rotate(45deg)" }}
          />

          {/* Deal summary */}
          <div className="px-3.5 pt-3 pb-2.5">
            <p className="font-mono-brand text-[9px] tracking-[0.25em] text-white/40 uppercase mb-1.5">
              Share this deal
            </p>
            <p className="font-body text-[12px] font-semibold text-[#f5f2ec] truncate leading-tight">
              {productName}
            </p>
            <p className="font-mono-brand text-[11px] text-[#c73e3a] mt-0.5">
              {price}{isPowerDrop ? " · ⚡ Power Drop" : ""}
            </p>
          </div>

          <div className="h-px bg-white/10 mx-0" />

          {/* Options */}
          <div className="py-1.5">
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left hover:bg-white/8 transition-colors group"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#25D366] flex-shrink-0">
                <MessageCircle size={13} className="text-white" />
              </span>
              <span>
                <span className="block font-body text-[12px] font-medium text-[#f5f2ec]">
                  WhatsApp
                </span>
                <span className="block font-mono-brand text-[9px] text-white/40 mt-0.5">
                  Send to a contact
                </span>
              </span>
            </button>

            <button
              onClick={handleNativeShare}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left hover:bg-white/8 transition-colors"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/12 flex-shrink-0">
                <Share2 size={12} className="text-[#f5f2ec]" />
              </span>
              <span>
                <span className="block font-body text-[12px] font-medium text-[#f5f2ec]">
                  Share…
                </span>
                <span className="block font-mono-brand text-[9px] text-white/40 mt-0.5">
                  Native share sheet
                </span>
              </span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-left hover:bg-white/8 transition-colors"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/12 flex-shrink-0">
                {copied ? (
                  <Check size={12} className="text-green-400" />
                ) : (
                  <Copy size={12} className="text-[#f5f2ec]" />
                )}
              </span>
              <span>
                <span className="block font-body text-[12px] font-medium text-[#f5f2ec]">
                  Copy link
                </span>
                <span className="block font-mono-brand text-[9px] text-white/40 mt-0.5">
                  Paste anywhere
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sharePop {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
}
