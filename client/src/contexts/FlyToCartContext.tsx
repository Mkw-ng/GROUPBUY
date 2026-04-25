/**
 * FlyToCart — "fly-to-cart" animation system
 *
 * Usage:
 *   1. Wrap the app (or Home) in <FlyToCartProvider>.
 *   2. In Navbar, attach `onCartIconRef` to the cart button element.
 *   3. In DealsSection, call `triggerFly(imgSrc, sourceRect)` on add-to-cart.
 *
 * The provider renders a fixed-position overlay with a small image clone that
 * animates from the product card to the cart icon using a CSS keyframe.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

interface FlyItem {
  id: number;
  imgSrc: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface FlyToCartContextValue {
  /** Register the cart icon element so we know where to fly to */
  setCartIconEl: (el: HTMLElement | null) => void;
  /** Trigger a fly animation from the given source rect */
  triggerFly: (imgSrc: string, sourceRect: DOMRect) => void;
}

const FlyToCartContext = createContext<FlyToCartContextValue>({
  setCartIconEl: () => {},
  triggerFly: () => {},
});

export function useFlyToCart() {
  return useContext(FlyToCartContext);
}

const FLY_SIZE = 56; // px — size of the flying thumbnail
const FLY_DURATION = 620; // ms — total animation duration

export function FlyToCartProvider({ children }: { children: React.ReactNode }) {
  const cartIconElRef = useRef<HTMLElement | null>(null);
  const [items, setItems] = useState<FlyItem[]>([]);
  const nextId = useRef(0);

  const setCartIconEl = useCallback((el: HTMLElement | null) => {
    cartIconElRef.current = el;
  }, []);

  const triggerFly = useCallback((imgSrc: string, sourceRect: DOMRect) => {
    const cartEl = cartIconElRef.current;
    if (!cartEl) return;

    const cartRect = cartEl.getBoundingClientRect();

    // Start: centre of the product image
    const startX = sourceRect.left + sourceRect.width / 2 - FLY_SIZE / 2;
    const startY = sourceRect.top + sourceRect.height / 2 - FLY_SIZE / 2;

    // End: centre of the cart icon
    const endX = cartRect.left + cartRect.width / 2 - FLY_SIZE / 2;
    const endY = cartRect.top + cartRect.height / 2 - FLY_SIZE / 2;

    const id = nextId.current++;
    setItems((prev) => [...prev, { id, imgSrc, startX, startY, endX, endY }]);

    // Remove after animation completes
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, FLY_DURATION + 100);
  }, []);

  return (
    <FlyToCartContext.Provider value={{ setCartIconEl, triggerFly }}>
      {children}

      {/* Fixed overlay — renders flying image clones */}
      {items.map((item) => (
        <FlyingImage key={item.id} item={item} duration={FLY_DURATION} size={FLY_SIZE} />
      ))}
    </FlyToCartContext.Provider>
  );
}

// ── FlyingImage ───────────────────────────────────────────────────────────────

interface FlyingImageProps {
  item: FlyItem;
  duration: number;
  size: number;
}

function FlyingImage({ item, duration, size }: FlyingImageProps) {
  const dx = item.endX - item.startX;
  const dy = item.endY - item.startY;

  // Inline keyframe via CSS custom properties + a unique animation name per item
  const animName = `fly-${item.id}`;

  const keyframes = `
    @keyframes ${animName} {
      0%   { transform: translate(0, 0) scale(1);    opacity: 1; }
      70%  { transform: translate(${dx * 0.85}px, ${dy * 0.85}px) scale(0.55); opacity: 1; }
      90%  { transform: translate(${dx}px, ${dy}px) scale(0.25); opacity: 0.7; }
      100% { transform: translate(${dx}px, ${dy}px) scale(0.1);  opacity: 0; }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div
        style={{
          position: "fixed",
          top: item.startY,
          left: item.startX,
          width: size,
          height: size,
          borderRadius: 4,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 9999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          animation: `${animName} ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
        }}
      >
        {item.imgSrc ? (
          <img
            src={item.imgSrc}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          /* Fallback: red square with cart icon when no image */
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#c73e3a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f5f2ec"
              strokeWidth="1.5"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
}
