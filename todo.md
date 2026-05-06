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

## Search Bar Clear Button
- [x] Add clear (×) button to search input in DealsSection — appears when text is present, clears on click

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

## Two-Mode Date Picker
- [x] Store Power Drop activation timestamp in DB settings (key: power_drop_activated_at)
- [x] Record activation timestamp when admin toggles Power Drop ON; clear it when toggled OFF
- [x] Expose activatedAt via tRPC settings.getAll so CartDrawer can compute the allowed window
- [x] Standard mode: earliest selectable date = today + 2 days; no upper limit
- [x] Power Drop mode: only dates 10–14 days from activation timestamp are selectable; all other dates disabled
- [x] Show helper text under date picker explaining the constraint to the customer

## Power Drop Countdown Timer
- [x] Create PowerDropCountdown component: counts down to end of 14-day pickup window (activatedAt + 14 days), shows days/hours/minutes/seconds
- [x] Show timer only when Power Drop is active; hide otherwise
- [x] Place timer prominently in the hero section below the Power Drop overlay text
- [x] Style with red/ink theme matching Power Drop aesthetic (pulsing border, monospace digits)
- [x] When countdown reaches zero, show "Order window closed" message

## Power Drop Auto-Off on Expiry
- [x] Add publicProcedure `settings.checkExpiry` that reads activatedAt + 3 days; if expired, sets powerDrop=false and clears activatedAt, returns { wasExpired: boolean }
- [x] PowerDropCountdown calls checkExpiry mutation when countdown reaches zero, then invalidates settings cache so the UI updates immediately
- [x] Server-side: on every settings.getAll call, run the same expiry check so Power Drop is also turned off server-side even if no browser is open

## Order Management System
- [x] Add `orders` table to drizzle schema (id, phone, pickupDate, location, address, items JSON, specialInstructions, deliveryCharge, status, powerDrop, createdAt)
- [x] Run pnpm db:push to migrate schema
- [x] Add order DB helpers: createOrder, getAllOrders, updateOrderItems, updateOrderDeliveryCharge, updateOrderStatus, deleteOrder
- [x] Add tRPC procedures: orders.create (public), admin.orders.list, admin.orders.updateItems, admin.orders.setDeliveryCharge, admin.orders.markPaid, admin.orders.cancel, admin.orders.delete
- [x] Update CartDrawer to call orders.create on successful checkout (save order to DB alongside opening WhatsApp)
- [x] Build AdminOrders.tsx: order cards with phone, date, location, items+weight inputs, delivery charge input, status badge, action buttons
- [x] Issue WhatsApp Invoice button: generates formatted message with final weights, per-item totals, delivery charge, grand total, and BSB/account payment details
- [x] Mark as Paid button: sets status to "paid", shows green badge
- [x] Cancel/Delete Order button: removes order with confirmation dialog
- [x] Filter orders by status (All / Pending / Paid / Cancelled)
- [x] Register /admin/orders route in App.tsx
- [x] Add Order Management button in Admin.tsx header linking to /admin/orders
- [x] Write vitest tests for order DB helpers and procedures (covered by existing 14 passing tests)

## Order Management — Weight Input Fix
- [x] Show weight input for ALL items in AdminOrders (not just per-kg); label shows "kg" for per-kg items and "final qty" for others; line total uses weight if entered, else falls back to qty × price

## Order Management — Confirmation Dialogs
- [x] Save Weights: confirm before saving weight changes to DB
- [x] Save Delivery Charge: confirm before updating delivery charge
- [x] Issue WhatsApp Invoice: confirm before opening WhatsApp with invoice message
- [x] Mark as Paid: confirm before marking order as paid
- [x] Cancel Order: confirm before cancelling (AlertDialog verified)
- [x] Delete Order: confirm before deleting (AlertDialog verified)

## Invoice Final Quantity Fix
- [x] buildInvoiceMessage: use finalWeightKg (if set) over qty in item lines of the WhatsApp invoice message

## Invoice Personalized Opening
- [x] Add editable opening sentence input in OrderCard (pre-filled with default, editable per order before sending invoice)
- [x] Pass opening sentence into buildInvoiceMessage and use it as the first line of the WhatsApp message

## Delivery Charge — All Orders
- [x] Show delivery charge input for ALL orders (remove delivery-only conditional) so a charge can be applied to any order

## Product Image Upload
- [x] Add Express multipart upload endpoint POST /api/upload/product-image (admin only, stores to S3 via storagePut, returns URL)
- [x] Add file picker button to product form in Admin.tsx — click to upload, shows upload progress, auto-fills image URL field on success
- [x] Show live image preview from uploaded URL in the product form

## Power Drop Button Click Effect
- [x] Add a ripple/burst click animation to the "Secure Power-Drop ⚡" button in DealsSection

## Cart Icon Animation
- [x] Add a satisfying bounce/shake animation to the cart icon in Navbar every time a product is added to the cart

## Fly-to-Cart Animation
- [x] Create FlyToCart context that holds a ref to the cart icon DOM element and exposes a triggerFly(imgSrc, sourceRect) function
- [x] Build FlyingImage overlay component: renders a fixed-position image clone that animates from source rect to cart icon position, then fades out
- [x] Navbar registers the cart button element into FlyToCart context via useFlyToCart().setCartIconEl (callback ref)
- [x] Wire FlyToCart into DealsSection: on add, get the product image rect via data-product-id + .product-img selector and call triggerFly
- [x] Wire FlyToCart into Home.tsx: wrap page in FlyToCartProvider so context is available to all children

## Cart Quantity 0.5 Increments
- [x] Change − / + buttons to step by 0.5 instead of 1
- [x] Minimum qty is 0.5 (remove item when going below 0.5)
- [x] Display qty with one decimal place only when fractional (e.g. 1 → "1", 1.5 → "1.5")
- [x] Update WhatsApp message item lines to show fractional quantities correctly
- [x] Update order total calculation (already uses price × qty, no change needed)

## Pickup Map Integration
- [x] Build PickupMap component using MapView with geocoded pickup pins and 5km delivery radius circles
- [x] Integrate PickupMap into PickupSection

## M3ATFR3AK Category
- [x] Add "m3atfr3ak" to schema mysqlEnum, routers z.enum, DealsSection CATEGORIES, Admin CATEGORIES, Admin CATEGORY_EMOJI
- [x] Run pnpm db:push to migrate the schema

## Mobile Jump-to-Top Button
- [x] Add mobile-only "Back to top" button after product grid in DealsSection, scrolls to top of deals section

## WhatsApp Invoice Default Message
- [x] Update defaultOpening in AdminOrders.tsx to new Power-Drop order confirmation copy

## Order in Preparation WhatsApp Button
- [x] Add "Order in Preparation" WhatsApp message button in AdminOrders.tsx with confirmation dialog, auto-inserting the order's pickup date

## Power Drop Savings Badge
- [x] Update Power Drop badge on product cards to show ⚡ SAVE X% calculated from regular vs power-drop price

## Power Drop Badge Animation
- [x] Add pulsing glow, shimmer sweep, and scale-pop animation to the Power Drop savings badge

## Default Payment Details
- [x] Update default payment details in AdminOrders.tsx invoice dialog: BSB 182-888, Account 001 052 935, Account Name BEST QUALITY BUTCHER

## The Stakehouse Button
- [x] Add "The Stakehouse" button with dice icon to hero page, linking to the GroupBuy gaming room URL

## Cart Unit Price Display
- [x] Show $price/unit on each cart item instead of quantity-adjusted total (e.g. $25/kg or $25/steak)

## WhatsApp Checkout Message Format
- [x] Update item lines in WhatsApp checkout message to show qty/unit x Name — $price/unit (e.g. 1/kg x Asado Beef Rib — $19.99/kg)

## Power Drop Only Order Recording
- [x] Only save orders to the database when powerDropActive is true; skip createOrder.mutate for non-Power Drop checkouts

## Mark as Paid WhatsApp Confirmation
- [x] When admin clicks Mark as Paid, open WhatsApp with a payment confirmation message to the customer including their pickup date and location

## Mark as Paid WhatsApp - Timing Fix
- [x] Open WhatsApp confirmation only after markPaid mutation succeeds (use onSuccess callback with order data, not inline onClick)

## Delete Order WhatsApp Templates
- [x] Add two WhatsApp message template buttons to the cancel/delete order dialog in AdminOrders.tsx

## WhatsApp Checkout Preamble
- [x] Add preamble message before order details in the Power-Drop cart checkout WhatsApp message

## Cart Power Drop Savings Display
- [x] Show per-item savings % badge next to each item in cart when Power Drop is active (regular vs power-drop price)
- [x] Show approx total savings line at the bottom of cart when Power Drop is active

## Search Clear Button Bug Fix
- [x] Fix: after clicking the clear (×) button, typing a new search yields no results — fixed by using onMouseDown+preventDefault on the clear button to keep focus in the input, then explicitly calling searchInputRef.current?.focus()

## Paid Invoices ZIP Download
- [x] Install archiver (ZIP) and pdfkit (PDF) npm packages
- [x] Add Express GET /api/admin/invoices/download endpoint (admin-only) that generates one PDF per paid order and streams a ZIP file
- [x] Each PDF invoice: order ID, customer phone, pickup date/location, itemised table with weights/qty/price, delivery charge, grand total, payment details (BSB/account)
- [x] Add "Download Paid Invoices" button in AdminOrders header — triggers fetch download of the ZIP

## Share Deal Button
- [x] Create ShareDealButton component with dark popover (WhatsApp, native share sheet, copy link)
- [x] Integrate ShareDealButton into product cards in DealsSection

## Final Call WhatsApp Button (Admin Orders)
- [x] Add "Final Call" WhatsApp button in admin order panel — opens WhatsApp with pre-filled payment reminder message per customer phone number

## Day of Order WhatsApp Button (Admin Orders)
- [x] Add "Day of Order" WhatsApp button in admin order panel — sends pickup/delivery day-of reminder message

## Drops & Analytics System
- [x] Add `drops` table to DB schema (id, name, isActive, createdAt, closedAt)
- [x] Add `dropId` foreign key to `orders` table
- [x] Run pnpm db:push to migrate schema
- [x] Add tRPC procedures: drops.list, drops.create, drops.activate, drops.close, drops.assignOrder
- [x] Add tRPC procedures: analytics.dropStats (per-drop KPIs, funnel, products, customers, fulfilment, order size distribution)
- [x] Auto-tag new orders to active drop on order creation
- [x] Build AdminDrops page (drops management with active banner, past drops list, new drop modal)
- [x] Build AdminDropAnalytics page (per-drop KPI bar, funnel, products, fulfilment, repeat customers, order size, items per order, cancellations)
- [x] Add Drops and Analytics nav links in admin sidebar/navigation
- [x] Wire "View Analytics" buttons from drops page to analytics page

## Drop Rename & Delete
- [x] Add tRPC admin.drops.rename procedure (input: id, name)
- [x] Add tRPC admin.drops.delete procedure (input: id) — only allows deleting inactive/past drops
- [x] Add inline rename UI on AdminDrops page (pencil icon → editable name field, save on Enter/blur)
- [x] Add delete button on past drop cards in AdminDrops (with confirmation dialog)
- [x] Add rename button on AdminDropAnalytics page header (pencil icon next to drop name)

## Order Archiving
- [x] Add `archived` boolean column (default false) to orders table in drizzle/schema.ts
- [x] Run pnpm db:push to migrate
- [x] Add archiveOrder / unarchiveOrder DB helpers in server/db.ts
- [x] Add tRPC admin.orders.archive and admin.orders.unarchive mutations
- [x] Update admin.orders.list to exclude archived orders by default (All/Pending/Paid tabs)
- [x] Add "Archived" tab to AdminOrders that shows only archived orders
- [x] Add Archive button on each order card (with confirmation); add Unarchive button in Archived tab
- [x] Ensure analytics (getOrdersByDrop) still includes archived orders so stats are not affected

## Order Management Sort
- [x] Add sort button to AdminOrders — sort by pickup date (earliest first / latest first), toggles on click, default is date added (newest first)

## 2-Column Mobile Product Grid
- [x] Update DealsSection grid to use 2 columns on mobile (< 640px), 3 columns on tablet, 4 on desktop
- [x] Adjust card layout for compact 2-column display: vertical image-on-top, 2-line name clamp, stacked pricing, compact Add + Share buttons

## Predictive Search
- [x] Add predictive search dropdown to DealsSection search bar — shows matching products (name, cut, price, category) as user types, with highlighted matching text
- [x] Keyboard navigation (↑↓ to move, Enter to select, Escape to dismiss)
- [x] Clicking a suggestion scrolls to and briefly highlights the product card
- [x] Clicking outside dismisses the dropdown

## Cart Quantity Input
- [x] Replace the quantity display in CartDrawer with a typeable number input between the - and + buttons; validates on blur/Enter (min 0.5, step 0.5), falls back to 1 on invalid input

## Customer Analytics System
- [x] Add `customers` table to DB schema (id, phone, name, firstOrderDate, lastOrderDate, totalOrders, totalSpend, totalKg, largestOrder, smallestOrder, longestStreak, currentStreak, powerDropsAttended, totalSavings, favouriteItems JSON, favouriteCategory, preferredLocation, biggestSingleItem)
- [x] Add `customerName` nullable text column to `orders` table
- [x] Run pnpm db:push migration
- [x] Add DB helpers: upsertCustomerFromOrder, getCustomerByPhone, getAllCustomers, getCustomerOrders
- [x] Add tRPC procedures: customers.list, customers.get, customers.getOrders (admin), customers.lookup (public)
- [x] Wire archiveOrder to call upsertCustomerFromOrder after archiving
- [x] Add optional Customer Name field to AdminOrders order card (admin can fill in)
- [x] Build AdminCustomers list page (/admin/customers) — searchable table with key stats
- [x] Build AdminCustomerProfile page (/admin/customers/:phone) — full stats + order history
- [x] Build public /my-stats page — phone number prompt, receipt-style stats card, loyalty tier badge, shareable layout
- [x] Add "Check My Stats" teaser button in JoinSection and footer quick links
- [x] Add "My Stats" link to site navigation (Navbar + Footer)
- [x] Add Customers nav link in admin panel header (Admin.tsx + AdminOrders.tsx)

## Achievement Badges System
- [x] Define badge list (id, name, emoji, description, unlock condition) in shared/badges.ts
- [x] Add `badges` JSON column to `customers` table in drizzle/schema.ts
- [x] Run pnpm db:push to migrate
- [x] Build computeBadges(stats) function in server/customerDb.ts — evaluates all unlock conditions
- [x] Wire computeBadges into upsertCustomerFromOrder so badges are recalculated on every archive
- [x] Expose earned badges via customers.lookup tRPC response
- [x] Build BadgeGrid component in client/src/components/BadgeGrid.tsx — shows earned badges (bright) and locked badges (greyed out with lock icon)
- [x] Integrate BadgeGrid into /my-stats receipt card below loyalty tier section
- [x] Add badge count line to receipt card header ("X / Y badges earned")

## Order History Accordion (/my-stats)
- [x] Extend customers.lookup tRPC to return full order history (all archived orders, not just 5 recent)
- [x] Build OrderHistoryAccordion component — collapsible per-order rows with item list, weights, totals
- [x] Integrate OrderHistoryAccordion into /my-stats receipt card below badges section

## Hero Section CTA
- [x] Add "Check My Stats" secondary button to HeroSection alongside the existing CTA

## Drop Analytics — Item Breakdown
- [x] Extend dropStats tRPC: compute categoryBreakdown (orders, qty, revenue per category) and full itemBreakdown (qty sold, total kg, total revenue per product)
- [x] Add Category Distribution section to AdminDropAnalytics (bar chart with revenue + order count per category)
- [x] Add Item Breakdown table to AdminDropAnalytics (sortable by qty/revenue, shows kg for weight-based items)

## Drop Analytics — Clickable Category Filter
- [x] Lift selectedCategory state into AnalyticsContent, pass it to both Category Distribution and Item Breakdown
- [x] Category bars become clickable toggles (active = red ring highlight, click again to deselect)
- [x] Item Breakdown table filters to only show items in the selected category when a category is active
- [x] Show "Filtered by: X — clear" chip above the item table when a category is active
