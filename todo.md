# GROUPBUY Redesign — TODO

## Phase 1: Initial Redesign (Complete)
- [x] Brand guidelines review and asset upload
- [x] Announcement banner component
- [x] Navbar with GROUPBUY lockup SVG and cart icon
- [x] Hero section with meat photography and Orbitron headline
- [x] How It Works section (4-step)
- [x] Deals section with category sidebar, search, 12 products
- [x] Cart drawer with WhatsApp checkout link
- [x] Pickup section with map embed
- [x] FAQ accordion
- [x] Join CTA section
- [x] Footer with wordmark

## Phase 2: Full Backend Upgrade (Complete)
- [x] Upgrade to full-stack (tRPC + Drizzle + MySQL)
- [x] Database schema: products table (name, category, cut, price, powerDropPrice, unit, badge, available, img, description, sortOrder)
- [x] Database schema: settings table (key/value — powerDropActive, announcementMessage, announcementActive)
- [x] tRPC procedures: products.list (public), products.upsert (admin), products.delete (admin)
- [x] tRPC procedures: settings.getAll (public), settings.set (admin), settings.setMultiple (admin)
- [x] Admin dashboard page at /admin (protected, admin role only)
- [x] Admin: Power Drop toggle (on/off) with live visual feedback
- [x] Admin: Product list table with edit/delete actions
- [x] Admin: Add/edit product form (all fields including powerDropPrice)
- [x] Admin: Stock/availability toggle per product
- [x] Admin: Announcement banner editor
- [x] Run pnpm db:push to sync schema
- [x] Seed database with 12 placeholder products and default settings

## Phase 3: Frontend Power Drop UI (Complete)
- [x] DealsSection reads products from tRPC instead of hardcoded array
- [x] AnnouncementBanner reads message from settings via tRPC (via Home.tsx)
- [x] Power Drop mode: product card shows original price crossed out + red Power Drop price
- [x] Power Drop mode: "Add to Cart" button changes to "Secure Power-Drop" with lightning icon
- [x] Power Drop mode: Hero section shows Power Drop banner/overlay
- [x] Power Drop mode: site-wide visual indicator (pulsing red badge in navbar)
- [x] CartDrawer: WhatsApp message includes Power Drop indicator when active

## Phase 4: Tests & Polish (Complete)
- [x] Vitest: products CRUD helpers (12 tests passing)
- [x] Vitest: settings get/set helpers
- [x] Vitest: Power Drop pricing logic
- [x] Final checkpoint and delivery

## Pending (User Input Required)
- [ ] Replace placeholder product data with real product names, cuts, prices, Power Drop prices
- [ ] Replace placeholder product images with real photography
- [ ] Confirm WhatsApp number (currently 61407249272)

## Admin Products Panel Improvements
- [x] Switch products table to a card grid (image thumbnail, name, cut, price, PD price, badge chip, availability toggle, edit/delete)
- [x] Category filter tabs (All / Beef / Pork / Lamb / Poultry / Seafood / Other) with count badges
- [x] Search/filter bar to find products by name or cut
- [x] Image preview thumbnail in the add/edit form (live preview from URL input)
- [x] Coloured badge chips in card and form (LIMITED=amber, POPULAR=green, NEW=blue, SOLD OUT=red)
- [x] Drag-to-reorder sort order (dnd-kit) with auto-save on drop
- [x] "Missing PD price" warning chip on cards when no Power Drop price is set
- [x] Improved empty state with illustration and clear CTA
- [x] Skeleton loading cards while products are fetching

## Admin Products Sort
- [x] Sort button/dropdown: sort by Name (A→Z / Z→A), Price (low→high / high→low), Date Added (newest / oldest)
- [x] Sort state is independent of drag-to-reorder (drag order is the manual "custom" sort)

## Admin Products Sort — Availability
- [x] Add "Availability (unavailable first)" and "Availability (available first)" sort options

## Category Update
- [x] Update drizzle schema category enum to include all 16 categories in correct order
- [x] Run pnpm db:push to migrate the schema
- [x] Update routers.ts productInput schema to match new enum
- [x] Update Admin.tsx CATEGORIES list, CATEGORY_EMOJI map, and product form select
- [x] Update DealsSection.tsx category filter tabs and emoji map
- [x] Update seed script with new categories

## Cart Order Details Form
- [x] Add WhatsApp phone number input below cart items (labelled "Your WhatsApp Number")
- [x] Add pickup date picker — calendar popover, future dates only (today and past disabled)
- [x] Add pickup location selector: Cranbourne / Clayton / Delivery radio group
- [x] When Delivery is selected, show address text input
- [x] Add special instructions textarea with placeholder "e.g., Please trim fat, cut into steaks, etc."
- [x] Include all order details fields in the WhatsApp checkout message
- [x] Validate required fields (phone, date, location/address) before allowing checkout

## Saved Customer Details
- [x] Create useSavedOrderDetails hook that reads/writes phone + location to localStorage
- [x] Auto-fill phone and location fields from saved details when cart opens
- [x] Show "Save my details" checkbox below the phone/location fields (checked by default when details are already saved)
- [x] Show "Saved ✓" indicator and "Update" / "Clear saved details" controls when details are already saved
- [x] Save details to localStorage on successful checkout

## Saved Delivery Address
- [x] Add deliveryAddress field to SavedOrderDetails type and localStorage schema
- [x] Auto-fill delivery address from saved details when Delivery is selected
- [x] Save delivery address to localStorage on checkout (alongside phone and location)

## Phone Number Validation
- [x] Validate phone is a 10-digit Australian number (mobile 04xx or landline 0[2-9]xx), strip spaces/hyphens before checking, reject non-numeric input with a clear error message
