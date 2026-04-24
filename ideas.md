# GROUPBUY Website Redesign — Design Ideas

## Brand Constraints (Non-Negotiable)
- Colours: Ink #0a0a0a · Paper #f5f2ec · Cream #eae3d2 · Red #c73e3a · Warm Gray #8a857c
- Fonts: Orbitron 800 (display/headlines) · Inter Tight 400/500/700 (body) · JetBrains Mono (prices/numbers)
- Logo: SVG assets provided — lockup-dark-red on Ink, lockup-light-red on Paper/Cream
- No gradients, no rounded corners on brand elements, no emoji in UI

---

<response>
<text>

## Option A — "Butcher's Receipt" (Chosen)

**Design Movement:** Post-industrial editorial meets high-end butcher shop receipt. Think Kinfolk meets Streetwear drop culture.

**Core Principles:**
1. Ink-dominant layout — dark sections anchor the page, Paper sections breathe
2. Every number is a statement — prices in JetBrains Mono, oversized, commanding
3. Horizontal rule language — thin 1px lines divide sections like a receipt printout
4. Red is a condiment — one red element per section maximum

**Color Philosophy:**
Primary canvas is Ink (#0a0a0a) for hero and key CTAs. Paper (#f5f2ec) for product browsing sections. Cream (#eae3d2) for informational panels. Red (#c73e3a) only for prices, key labels, and the "BUY" in the wordmark. Warm Gray (#8a857c) for secondary copy and dividers.

**Layout Paradigm:**
Asymmetric editorial grid. Hero: full-bleed Ink with left-aligned type, stat row in mono. Product section: Paper background, left sidebar category nav with right content area (not centered grid). Each section transitions with a thin horizontal rule, not a gradient fade.

**Signature Elements:**
1. Receipt-strip dividers — thin Paper/Cream strips with mono text labels (e.g. "— CURRENT DROPS —") between sections
2. Oversized price tags — product prices displayed large in JetBrains Mono with red accent
3. The G-mark as a watermark — large, low-opacity circle ring used as background texture in Ink sections

**Interaction Philosophy:**
Minimal, purposeful. Hover states reveal red underlines on nav links. Product cards lift with a 2px border-red reveal on hover. Category tabs slide with a sharp left-border indicator. No bouncy animations — everything is deliberate and quick.

**Animation:**
- Page load: nav fades in from top (200ms), hero text slides up from 8px (300ms stagger)
- Product cards: opacity 0→1 on scroll enter (150ms each, staggered)
- Category tab switch: instant content swap with a 100ms fade
- Cart button: brief scale(1.04) pulse on add

**Typography System:**
- Hero H1: Orbitron 800, 72–96px, uppercase, tracking 0.14em, Paper on Ink
- Section labels: Orbitron 800, 11px, uppercase, tracking 0.3em, Warm Gray — used as eyebrow text
- Product names: Inter Tight 700, 16px, Ink on Paper
- Prices: JetBrains Mono 700, 24px, Red
- Body copy: Inter Tight 400, 16px/25px, Ink
- Captions/meta: Inter Tight 400, 13px, Warm Gray

</text>
<probability>0.08</probability>
</response>

<response>
<text>

## Option B — "Drop Culture Zine"

**Design Movement:** Streetwear drop culture meets underground food zine. Bold, loud, unafraid.

**Core Principles:**
1. Type as texture — Orbitron headlines used at massive scale as background elements
2. Stark contrast — pure Ink and pure Paper, no middle ground
3. Stamp/sticker aesthetic — red labels feel applied, not designed
4. Scarcity language — "LIMITED" "CLOSING SOON" stamped across products

**Color Philosophy:** 90% Ink, 10% Paper, Red used as stamps/badges only.

**Layout Paradigm:** Single-column editorial scroll. Each section is a full-width "page" with its own distinct treatment. No sidebar navigation — category browsing is a horizontal scroll strip.

**Signature Elements:**
1. Diagonal crop marks in corners of product cards
2. "SOLD OUT" red stamp overlay on unavailable items
3. Running ticker tape of deal names at the top of the page

**Typography System:** Orbitron 800 at 120px+ for hero. Inter Tight 500 for everything else. Mono only for prices.

</text>
<probability>0.06</probability>
</response>

<response>
<text>

## Option C — "Premium Provisions"

**Design Movement:** High-end deli/provisions store meets minimal Scandinavian editorial.

**Core Principles:**
1. Paper-dominant — light, airy, premium
2. Generous whitespace — product photography breathes
3. Understated red — used only for prices and the wordmark accent
4. Serif-adjacent — Inter Tight at light weights for elegance

**Color Philosophy:** 70% Paper, 20% Cream, 5% Ink, 5% Red. Feels like a premium grocer's catalogue.

**Layout Paradigm:** Centered, generous margins, product cards in a clean 3-column grid with ample padding.

**Signature Elements:**
1. Thin ruled lines as section dividers
2. Product weight/cut displayed in small caps
3. Minimal iconography — no emoji, no colour icons

**Typography System:** Inter Tight 300 for body, Inter Tight 700 for product names, Orbitron 800 only for the logo and major price callouts.

</text>
<probability>0.05</probability>
</response>

---

## Selected Approach: **Option A — "Butcher's Receipt"**

This approach best honours the brand manual's editorial, street-smart aesthetic while maintaining the practical e-commerce functionality the site needs. The Ink-dominant hero creates immediate brand impact, the receipt-strip language ties back to the brand's print collateral, and the asymmetric layout avoids the generic centered-grid look.
