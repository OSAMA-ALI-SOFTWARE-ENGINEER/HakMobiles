# HAK Wholesales Tracker — Modules and Cursor prompts

## How to use this tab

This tab defines exactly what every screen does, what users can edit, and how to test it live. Save it in the repository as `docs/MODULES.md` next to `docs/PRD.md`. In Cursor, paste the **master prompt** once, then build one module at a time with the **per-module prompt**, testing each module live before starting the next.

Build order: global design and editing framework first (sections 2–3), then the modules in the order of the build guide in the main PRD tab. Each module below lists its screens, features, what is editable, its rules, and the live checks that prove it works.

## Design direction and ease of use

The app must feel like HAK's own tool, not a stock template: TailAdmin supplies the structure and components, and a HAK theme on top changes the look. Every common job (a sale, a payment, a new shop) must take one click to start and under 30 seconds to finish, from any screen.

**HAK theme (applied through Tailwind theme tokens, so it is changed in one file)**

| Element | Choice |
| --- | --- |
| Primary colour | Deep teal (`#0F766E`) for buttons, links and active menu items; one colour, used sparingly |
| Status colours | Green = paid / OK, amber = low stock / part-paid / due soon, red = out of stock / overdue, grey = archived |
| Neutrals | Warm greys for backgrounds and borders; white cards on a light grey page; true dark mode |
| Font | Inter for everything, with tabular numbers so money columns line up |
| Shapes | 12 px rounded cards, 1 px borders, no heavy shadows or gradients |
| Density | Comfortable by default; a Compact switch per user for long tables |
| Money | Right-aligned, euro with the Portuguese format (€ 1.234,56) by default; the format is a setting |
| Logo and name | HAK Wholesales Tracker logo in the sidebar, login screen, invoices and the desktop app icon |

**Ease-of-use patterns used on every screen**

| Pattern | How it works |
| --- | --- |
| Command bar | Ctrl+K (Cmd+K on Mac) searches shops, products, invoices and people, and runs actions such as “New sale for Loja Central” |
| Quick add | A “+ New” button in the header with Sale, Payment, Customer, Product, Purchase, Expense, Follow-up |
| Shortcuts | `N S` new sale, `N P` new payment, `N C` new customer, `/` search, `?` shows all shortcuts |
| Drawers, not page jumps | Later. Create and edit stay in the current popup until a later pass. A side drawer is the intended pattern so the list stays in place, and it is not part of the current build. |
| Smart tables | Search, filter chips, sort, column chooser, saved views, sticky header, row selection, bulk actions, export, fast scrolling for thousands of rows |
| Smart forms | Today's date, “me” as partner, the last customer and the product's price are pre-filled; type-ahead dropdowns with “+ Create new” inside them; Enter moves to the next field; errors shown under the field as you type |
| Draft autosave | An unfinished form is kept as a draft and offered again when the user returns |
| Undo | Every save, archive or bulk change shows an Undo toast for 10 seconds |
| Clear states | Skeleton loading, empty screens with one main action and a short tip, plain-language errors |
| Sync visible | A cloud icon on each unsynced record and the status bar (Synced / Offline, N waiting) |
| Mobile | Bottom bar with Dashboard, Sales, + New, Customers, More; large tap targets; works at 360 px width |
| Accessibility | Full keyboard use, visible focus rings, WCAG AA contrast in both themes |

## Editing framework

Users can edit anything they are allowed to, from the place where they see it, without asking a developer. Money records stay trustworthy: every change is logged, can be reversed, and periods can be locked.

**Editing tools available in every module**

| Tool | What the user does |
| --- | --- |
| Inline edit | Click a cell (or press Enter), change it, Enter to save, Esc to cancel, Tab to the next cell |
| Edit drawer | Later. Full-record editing stays in the current popup. The side drawer, with history and attachments, is a future pass. |
| Bulk edit | Select rows → set a field for all (category, status, assigned salesperson, tags, price change by % or €) |
| Duplicate | Copy a record as a starting point (a product colour variant, a repeat order) |
| Archive and restore | Archive instead of delete; the Archive view restores any record |
| Notes and attachments | Every record has notes and files (photos, PDFs), offline-queued |
| Version history | Every record shows who changed which field, from what to what, when; “Restore this version” |
| My views | Each user saves columns, filters and sort as named views; Super Admin can share a view with a role |

**What the super admin can edit in Settings (no code changes)**

| Area | Editable |
| --- | --- |
| Lists | Product categories, colours, phone models, units, payment methods, expense categories, shop types, tags, currencies and default exchange rates |
| Pipeline | Stage names, order, colours, and which stage counts as Active or Inactive |
| Custom fields | Add fields to Customers, Products, Suppliers, Sales and Purchases: text, number, money, date, dropdown, checkbox, phone, link; choose required, shown in table, filterable |
| Templates | Invoice and statement layout (logo, company details, footer, shown fields), WhatsApp and email messages with placeholders such as {shop}, {invoice}, {amount}, {due\_date} |
| Dashboard | Which widgets each role sees and their order; each user can hide or reorder their own |
| Rules | Low-stock default, overdue days, inactive-customer days, invoice prefix format, number and date format |
| Labels | Rename menu items and field labels, per language |
| Company profile | Business name, NIF, address, logo, bank details for invoices |

**Safety rules for money records** (sales, purchases, payments, expenses, transfers)

1. Editing needs the module's edit permission. Edits to a record older than today ask for a short reason.
2. Stock, balances, profit and partner positions recalculate immediately after any edit.
3. Invoice numbers never change. A cancelled sale is archived, and its stock returns automatically.
4. **Period lock:** the super admin can lock a month after checking it. Locked records are read-only; changing one needs the super admin to unlock, which is logged.
5. If two people edit the same record, each field keeps the latest change, and the other person sees “Umar changed Phone 2 min ago” with Keep mine / Keep theirs.

## Modules A: Dashboard and CRM

### 1. Dashboard

One screen that answers “how are we doing, and what needs doing today?”, in the TailAdmin CRM layout.

**Features**

- KPI cards: Sales this period, Net profit and margin, Customers owe us, We owe suppliers, Stock value at cost, Stock alerts. Each card shows the change vs the previous period, and a click opens the matching filtered list.
- Revenue and profit chart with Monthly / Quarterly / Annually tabs and hover values.
- Sales target vs actual, for the business and per salesperson.
- Sales by category (share of revenue and pieces).
- Upcoming schedule: follow-ups and invoices due in the next 7 days.
- Recent sales: last 10 invoices with Paid / Part-paid / Unpaid badges.
- Stock alerts with a **Reorder** button that opens a new purchase pre-filled with the product and its last supplier.
- Top debtors with a **Remind** button (WhatsApp message from the template).
- Partner panel (Partners and Super Admin only): balances, profit share, “who owes whom”, and **Record settlement**, which opens a pre-filled partner transfer.
- Date range: Today, This week, This month, Last month, This year, Custom.
- “My day” view for Salespersons: my follow-ups today, my sales this month vs my target.

**Editable:** each user hides, shows and drags widgets into their own order; partners edit targets inline; the chosen date range is remembered.

**Rules:** every number comes from `calc.ts`; widgets a role cannot see are not rendered or synced.

**Live check**

- [ ] Enter the golden dataset (main PRD tab, step 16) → every card matches the expected numbers.
- [ ] Click “Customers owe us” → the customer list opens filtered to shops with a balance.
- [ ] Drag a widget to a new place, reload → it stays there for that user only.
- [ ] Log in as Salesperson → no profit, cost or partner widgets anywhere.

### 2. Customers (Customer 360)

Everything about a shop on one page, and a list that finds any shop in seconds.

**Customer list**

- Columns: shop, city, status, assigned salesperson, phone, owed, last order, total bought, tags, plus any custom fields.
- Filters: status, city, shop type, tag, assigned, “owes more than €X”, “no order for N days”.
- Saved views, e.g. “Owes money”, “Lisbon shops”, “My shops”.
- Bulk actions: assign salesperson, add or remove tag, change status, send statements, export, archive.

**Customer 360 page**

- Header: name, status (editable dropdown), tags, assigned salesperson, and buttons for Call, WhatsApp, Email and Open in Maps.
- Quick actions: New sale, Record payment, Log call or visit, Add follow-up, Send statement.
- Strip of numbers: total bought, paid, owed, credit used vs limit, last order, average order, number of orders.
- Tabs: **Overview** (latest activity, next follow-up) · **Sales** · **Payments** · **Statement** (date range, PDF or WhatsApp) · **Special prices** · **Activities** · **Follow-ups** · **Notes and files** · **Details** · **History**.

**Fields:** shop name\*, contact person, phone\* (+351 format), WhatsApp number (defaults to phone), NIF (9 digits with Portuguese check-digit validation), email, address, postcode (0000-000), city, shop type, status, tags, assigned salesperson, credit limit, payment terms (days), notes, custom fields.

**Special prices:** a per-shop price for chosen products; new sales for that shop use it automatically.

**Editable:** every field inline on the Details tab and in the list; status and tags from the header; bulk edits from the list.

**Rules:** duplicate warning on the same NIF or phone; archiving a shop that still owes money asks for confirmation; merging (Super Admin) moves all sales, payments, activities and follow-ups.

**Live check**

- [ ] Create a shop with an invalid NIF → a clear error appears under the field before saving.
- [ ] From the 360 page: New sale → save → Owed and Last order update without reloading.
- [ ] Set a special price, create a sale → the special price is filled in.
- [ ] Send a statement by WhatsApp → WhatsApp opens with the PDF link and the template text.
- [ ] Bulk-assign 5 shops to a salesperson → Undo restores all 5.

### 3. Pipeline

A board that shows where every shop stands, from first contact to regular buyer.

**Features**

- Columns per stage (default: Lead, Contacted, Sample sent, First order, Active, Inactive) with counts and last-30-day sales per column.
- Cards: shop, city, last contact, next follow-up, sales in the last 30 days.
- Drag a card to move it; the move is logged and offers “Add a follow-up?”.
- Quick add in any column: just name and phone; the rest can be filled later.
- Board or list view, filters by assigned salesperson, city and tag.
- Automatic moves: the first sale moves a shop to First order; a second order to Active; no order for 60 days to Inactive; a new order brings it back to Active.

**Editable:** stages (names, order, colours) in Settings; which fields cards show.

**Live check**

- [ ] Drag a shop to Contacted on one device → it moves on a second device within 20 seconds.
- [ ] Make the first sale to a Lead → it moves to First order automatically.
- [ ] Rename a stage in Settings → the board shows the new name without losing any cards.

### 4. Follow-ups and Calendar

Nobody forgets a call, a visit or a payment reminder.

**Screens:** Follow-ups list (Today, Overdue, Upcoming, Done) and Calendar (month, week, day, list).

**Fields:** title\*, type (call, visit, WhatsApp, payment reminder, delivery, other), customer, due date and time\*, assigned to, priority, notes, repeat (none, weekly, monthly).

**Features**

- Complete with one click, with an optional outcome note that is logged as an activity.
- Snooze: 1 hour, tomorrow, next week.
- Drag in the calendar to reschedule.
- Automatic payment reminders for overdue invoices, created once per invoice.
- WhatsApp button that opens the right template for the follow-up type.
- Reminders as browser and desktop notifications at the due time.

**Editable:** title, due date and assignee inline; follow-up types and their message templates in Settings.

**Live check**

- [ ] Create a follow-up due in 2 minutes → a desktop notification appears on time.
- [ ] Drag it to tomorrow in the calendar → the list shows the new date.
- [ ] Complete it with a note → the note appears in the shop's activity timeline.

## Modules B: Stock and buying

### 5. Products and stock

Know what you have, what it cost, what it earns, and when to reorder.

**Product list**

- Columns: photo, code, name, category, colour, model, selling price, in stock, status (OK / LOW / OUT), on order; with permission, also average cost and margin.
- Products with the same name group into one family with their colours and models as variants; expand a family to see each variant.
- Filters: category, colour, model, status, supplier. Saved views such as “Low stock” and “Best sellers this month”.
- Bulk actions: change category, price change by % or € with rounding (to .50 or .99), set alert level, print labels, export, archive.

**Product page**

- Stock card: in stock, on order, value, average cost, last purchase cost, margin.
- Stock movements: every purchase, sale and adjustment with a running balance.
- Suppliers with their last prices; best customers for this product; price history.

**Features**

- **Add variants:** pick colours × models once, and the app creates every variant with a suggested code (e.g. CASE-IP15-BLK).
- **Barcode:** scan with a USB scanner or the phone camera to find a product or add it to a sale; print an A4 sheet of barcode labels.
- **Stock adjustment:** + or − with a reason (damaged, lost, gift, return, count correction).
- **Stock count mode:** type the counted quantity for each product; the app shows the differences and creates the adjustments in one go.
- **Reorder suggestion:** average sales of the last 30 days × 1.5 − stock − on order, with a Reorder button that starts a purchase.

**Fields:** code\* (unique), name\*, category\*, colour, model / compatibility, selling price\*, alert level, barcode, photos, description, custom fields.

**Editable:** price, alert level, category and name inline in the list; everything in the drawer; bulk price changes with Undo.

**Rules:** stock is always calculated (never typed in); archiving a product that still has stock asks for confirmation; cost and margin are hidden and never synced without permission.

**Live check**

- [ ] Add a case in 3 colours × 2 models with Add variants → 6 products with unique codes.
- [ ] Raise all Chargers by 10% rounded to .99 → prices change, Undo restores them.
- [ ] Stock count: type 3 for a product that shows 5 → a −2 adjustment is created and the stock shows 3.
- [ ] Scan a barcode in the sales form → the right product line is added.

### 6. Purchases

Record what was ordered, what arrived, and what each piece really cost.

**Purchase list:** date, supplier, invoice no., items, total, status (Ordered / Partly received / Received), expected arrival, paid status. Filters by supplier, status and date.

**Purchase form**

- Supplier (type-ahead, with + Create new), date, supplier invoice no., expected arrival date, currency and exchange rate.
- Line grid: product (type-ahead or scan), quantity, cost per piece in the purchase currency, euro cost, line total. Enter adds a new line; rows can be pasted from Excel.
- **Extra costs** (shipping, customs, transport) with “spread over pieces” by quantity or by value, so each product's cost includes them (landed cost).
- Attach the supplier's invoice (photo or PDF).

**Receiving:** “Receive items” records the quantity that actually arrived per line, including partial deliveries. Only received pieces are added to stock; the rest shows as “on order”.

**Editable:** lines, prices and extra costs until the period is locked; an edit after receiving asks for a reason and recalculates average cost.

**Rules:** an extra cost entered on a purchase must not also be entered in Expenses; the form warns when an expense with the same amount and date exists.

**Live check**

- [ ] 100 pieces at €1.00 plus €20 shipping spread by quantity → the product's cost becomes €1.20.
- [ ] Receive 60 of 100 → stock +60, on order 40, status Partly received.
- [ ] Paste 5 rows copied from Excel into the line grid → 5 lines appear with products matched by code.

### 7. Suppliers and supplier payments

Who we buy from, what we owe them, and which partner paid what.

**Supplier list:** name, country, contact, phone or WeChat, total purchased, total paid, we owe, last order.

**Supplier page:** details, purchases, payments, statement (PDF), products supplied with last prices, notes and files.

**Supplier payment form:** date, paid by (partner)\*, supplier\*, purchases it pays for (optional), amount\*, currency, exchange rate (remembers the last rate per currency), bank fee (optional, saved as an expense), method, reference, receipt photo. Fields marked \* are required.

**Editable:** supplier details inline; payments with the money-record safety rules; exchange rates per currency in Settings.

**Live check**

- [ ] Pay 1,080 USD at 1.08 → €1,000 appears on the supplier and on the paying partner's balance.
- [ ] A €15 bank fee on that payment → a €15 bank-fee expense is created, paid by the same partner.
- [ ] The supplier statement PDF lists purchases and payments with the same balance as the screen.

## Modules C: Selling and money

### 8. Sales and invoices

A sale in under 30 seconds, on a phone in a shop or at a desk.

**Sales list:** invoice no., date, shop, items, total, paid, balance, status (Quote / Paid / Part-paid / Unpaid / Overdue / Cancelled), sold by, sync icon. Filters by date, shop, status, salesperson and product; views “Today”, “Unpaid”, “Overdue”.

**Fast sale screen**

- Shop picker with recent shops first, and a “Repeat last order” button.
- Product search or barcode scan; quantity with + and − buttons; the price fills in from the shop's special price or the list price; discount per line (% or €) and for the whole invoice.
- Live totals, a stock warning and a credit-limit warning (neither blocks the sale).
- “Paid now” switch: records the customer payment in the same save (method, received by me).
- Save (Ctrl+Enter), Save and new, Save and share.

**After saving:** invoice PDF with the HAK template; delivery note PDF without prices; share by WhatsApp or email, or print.

**Quotes:** save as Quote (no stock movement), send it, and convert it to a sale with one click.

**Returns:** “Return items” on an invoice creates a credit note: stock goes back and the shop's balance goes down.

**Required fields:** shop, date, at least one line with product and quantity.

**Editable:** lines, prices and discounts under the money-record safety rules; cancelling archives the sale and returns the stock; the invoice number never changes.

**Live check**

- [ ] Make a 3-line sale with the keyboard only, in under 30 seconds.
- [ ] “Paid now” €50 cash on a €80 sale → status Part-paid, balance €30, payment received by you.
- [ ] Return 2 pieces → stock +2, credit note PDF, shop balance reduced.
- [ ] Convert a quote → stock goes down only at conversion.
- [ ] Edit a sale from last week → a reason is required and the history shows the old and new values.

### 9. Customer payments

Record every euro received and who is holding it.

**Payment list:** date, shop, amount, method, received by, invoices paid, unallocated amount. Filters by shop, partner, method and date.

**Payment form**

- Shop: shows its open invoices with balances.
- Amount, method, received by (defaults to me), date, reference.
- Allocation: oldest invoice first automatically, and each invoice's amount can be changed.
- Overpayment stays as shop credit and is offered on the next invoice.
- Receipt PDF, or a WhatsApp thank-you message from the template.

**Editable:** amount, allocation and partner under the safety rules; invoice statuses and balances update at once.

**Live check**

- [ ] €300 against €200 + €270 invoices → Paid and Part-paid (€170 left).
- [ ] €500 against a €450 balance → €50 credit, applied automatically to the next invoice.
- [ ] Change “received by” from Haseeb to Umar → both partners' cash-held figures update.

### 10. Expenses

Every cost that is not stock, with its receipt.

**Expense list:** date, category, description, amount in €, paid by, method, receipt icon, plus a small chart of this month by category.

**Form:** date, category, description, amount, currency and exchange rate, paid by, method, receipt photo (phone camera), and **Repeat monthly** for costs such as rent, which creates a draft each month to confirm.

**Editable:** inline amount, category and description; categories in Settings.

**Live check**

- [ ] Take a receipt photo on the phone offline → it uploads after reconnecting and opens on the desktop.
- [ ] A monthly rent expense → next month's draft appears on the 1st and is confirmed with one click.

### 11. Partners and transfers

Shows each partner's money position at a glance and how to settle up in the fewest payments.

**Partners screen:** one card per partner with share %, paid in (suppliers + expenses), customer cash held, transfers sent and received, own money in the business, fair share, balance, profit share, and withdrawals.

**Settle up:** the app proposes the fewest transfers that bring everyone to zero (for example “Haseeb pays Umar €90” and “Haseeb pays Dr. Waseem €40”), each with a **Record** button.

**Transfer types:** Settlement between partners; Profit withdrawal (a partner takes his profit share out, shown against his share as “still to take”).

**Partner statement:** PDF per partner for any period.

**Share changes:** the super admin edits shares with an effective date; every owner confirms; the history is kept.

**Live check**

- [ ] Golden dataset → Settle up proposes exactly Haseeb → Umar €90 and Haseeb → Dr. Waseem €40.
- [ ] Record both → all three balances show €0.
- [ ] A €50 profit withdrawal by Umar → his “still to take” drops by €50.

## Modules D: Reports, settings and administration

### 12. Reports

Answers to business questions without building spreadsheets.

| Report | Shows |
| --- | --- |
| Profit and loss | Revenue, cost of goods, gross profit, expenses, net profit; compared with the previous period |
| Sales analysis | By product, category, colour, model, shop, city, salesperson; pieces, revenue, profit |
| Best sellers and slow movers | Top 20 products; products with no sale in 60 days and their stock value |
| Stock valuation and movements | Stock value at cost and selling price on any date; all movements per product |
| Customer ageing | What each shop owes, split into 0–30, 31–60, 61–90 and 90+ days |
| Supplier balances | Purchased, paid and owed per supplier |
| Cash received | Customer payments by partner and by method |
| Expenses | By category and month |
| Targets | Target vs actual per salesperson and month |
| Partner statement | Each partner's movements and balance for a period |

**Features:** period picker with comparison, group-by, chart or table view, drill-down to the records, export to Excel, CSV or PDF, favourites, and an optional **weekly summary email** to partners every Monday at 08:00 (sent by the server's cron).

**Editable:** columns, grouping and filters, saved as named reports per user.

**Live check**

- [ ] Customer ageing total = “Customers owe us” on the dashboard.
- [ ] Profit and loss for the golden dataset = net profit €430.
- [ ] Export the sales analysis to Excel → the file opens with the same totals.

### 13. Notifications

The right alert to the right person, without noise.

**Types:** low stock, out of stock, follow-up due, invoice overdue, large payment received, sync problem, login from a new device, period locked.

**Channels:** the bell in the header, browser and desktop notifications, and an optional daily email digest. Each user chooses per type in My profile.

**Live check**

- [ ] A sale that takes a product below its alert level → a low-stock notification appears for users with stock permission only.
- [ ] Turn off “invoice overdue” for yourself → you stop getting it; others still do.

### 14. Settings (content management)

The super admin's control room: everything that shapes the app without code.

| Page | What can be edited |
| --- | --- |
| Company profile | Name, NIF, address, phone, email, bank details, logo |
| Appearance | Logo, app name, primary colour from 6 presets, default theme and density |
| Lists | Categories, colours, models, units, payment methods, expense categories, shop types, tags, follow-up types, currencies and rates |
| Pipeline | Stage names, order, colours, automatic rules |
| Custom fields | Add, rename, reorder, hide fields for Customers, Products, Suppliers, Sales, Purchases |
| Templates | Invoice, delivery note, statement, receipt, WhatsApp and email messages, with live preview, placeholder list and Reset to default |
| Numbering | Invoice and quote number pattern (e.g. {device}-{yyyy}-{0000}) |
| Rules | Low-stock default, overdue days, inactive days, credit-limit warning, default payment terms |
| Dashboard | Widgets and their order per role |
| Labels and languages | Rename labels and menu items; English now, Portuguese and Urdu later |
| Partner shares | Shares with effective dates and history |
| Period lock | Lock or unlock months |
| Backup | Last backup status, Download backup now |

**Live check**

- [ ] Change the invoice footer → the next invoice PDF shows it, with no deploy.
- [ ] Add a custom field “Instagram” to Customers → it appears in the form, table, filters and export, and syncs to other devices.
- [ ] Lock September → a September sale cannot be edited; unlocking is logged.

### 15. Users, roles and devices

(Super Admin only.) Builds on the main PRD's roles section.

- **Users:** create with a temporary password, role, phone, expiry date; reset password; require two-factor; deactivate; see last login and login history; sign out of all devices.
- **Roles:** permission matrix with search, Copy from role, and **View as role**, which shows the app exactly as that role sees it, for checking permissions.
- **Devices:** name, user, platform, app version, last sync, unsynced changes; revoke.

**Live check**

- [ ] View as Salesperson → the menus and data match the matrix; leaving returns to Super Admin.
- [ ] Sign a user out of all devices → every one of their devices returns to the login screen at the next sync.

### 16. Activity log

A read-only, searchable record of who did what: filters by user, module, action and date; each entry links to the record and shows the before and after values; export to Excel. It cannot be edited or deleted.

**Live check:** edit a price → the log shows the user, device, old and new price, and time.

### 17. My profile

Name, photo, password, two-factor setup, offline PIN, language, theme, density, notification choices and my devices.

**Live check:** switch to dark mode and Compact → kept after reload and on the user's other devices.

### 18. Import and export

Get existing data in on day one, and everything out at any time.

- **Import wizard** for products, customers, suppliers, opening stock and opening balances (what shops owe and what we owe suppliers on the start date), plus the Excel tracker: upload Excel or CSV → columns matched automatically → preview with errors highlighted → import → **Undo this import** within 24 hours.
- **Export:** every list and report; and for the super admin, a full export of all data as a zip of CSV files.

**Live check**

- [ ] Import 50 customers where 2 have invalid NIFs → 48 imported, and the 2 errors can be downloaded and fixed.
- [ ] Undo that import → the 48 customers are removed, nothing else changes.
- [ ] Import the Excel tracker → the dashboard shows the same totals as its Dashboard tab.

## Cursor prompts

Use the master prompt once, at the start of a new Agent chat, to build the shared UI and editing framework. Then use the per-module prompt for each module in a fresh chat. Never ask Cursor for several modules at once: small steps are easier to review and test.

**Master prompt (paste as-is)**

```text
You are building HAK Wholesales Tracker. Read docs/PRD.md and docs/MODULES.md completely before writing code, and follow .cursor/rules/hak.mdc.

GOAL OF THIS TASK
Build the shared front-end foundation that every module will use: the HAK theme on top of TailAdmin, the global ease-of-use patterns, and the editing framework. Do not build any business module screens yet.

BUILD, in /app/src:
1. theme: Tailwind theme tokens for the HAK theme in docs/MODULES.md ‘Design direction’ (teal primary #0F766E, status colours, Inter font with tabular numbers, 12px radius, Comfortable/Compact density, light/dark). Remove TailAdmin demo pages listed in docs/PRD.md ‘Frontend UI’.
2. ui/AppShell: TailAdmin AppLayout, AppSidebar, AppHeader with the sidebar menu from docs/PRD.md, filtered by permissions; mobile bottom bar (Dashboard, Sales, + New, Customers, More); sync status bar.
3. ui/CommandBar: Ctrl/Cmd+K search across customers, products, invoices, users, plus actions (New sale, New payment, New customer...).
4. ui/QuickAdd: header “+ New” menu and keyboard shortcuts (N S, N P, N C, /, ?), with a shortcuts help dialog.
5. ui/DataTable: TanStack Table with TailAdmin styles: search, filter chips, sort, column chooser, saved views (per user, shareable to a role by Super Admin), sticky header, row selection, bulk actions slot, inline cell editing (Enter/Esc/Tab), CSV/Excel export, virtualised rows for 10,000+ records, empty state and skeleton.
6. ui/RecordDrawer: right-side drawer for create/edit/view with tabs slot, unsaved-changes guard, Ctrl+Enter to save.
7. ui/form: React Hook Form + Zod bound to TailAdmin inputs: TextField, MoneyField (€ pt-PT format, cents internally), NumberStepper, DateField (flatpickr), Select and Combobox with “+ Create new”, MultiSelect/Tags, PhoneField (+351), NifField (Portuguese check digit), FileDrop (offline queue), plus draft autosave to SQLite.
8. ui/feedback: Undo toast (10 s) for every save, archive and bulk change; ConfirmDialog only for destructive actions; plain-language error messages.
9. editing framework: Archive/Restore view, Duplicate, Notes and Files panel, Version History panel with field-level diff and Restore this version, “reason required” prompt for money records older than today, period-lock check, field-level conflict notice (Keep mine / Keep theirs).
10. custom fields: renderer that adds Super-Admin-defined fields to forms, tables, filters and exports for Customers, Products, Suppliers, Sales, Purchases.
11. dev seed: php artisan hak:demo-seed creating one user per role with known dev passwords and the golden dataset (dev environment only, refuses to run in production).

DATA: add migrations, Drizzle schema and sync support for: custom_field_definitions, custom field values (JSON column on each business table), record_versions, notes, attachments, saved_views, user_preferences, period_locks, templates, notification_preferences, import_batches. Every table follows the PRD rules (UUID v7, created/updated by, deleted_at, synced through the outbox).

QUALITY BAR
- Use only TailAdmin components restyled with the HAK theme; no other UI kit.
- Every interactive element works with the keyboard and has a visible focus ring; WCAG AA contrast in light and dark.
- Every screen works at 360 px wide.
- All reads come from local SQLite; nothing waits for the network.

TESTS (write them, run them, and show me the results)
- Vitest for DataTable inline edit, Undo, draft autosave, NifField, MoneyField, custom field renderer.
- Pest for the new tables, permissions and sync of custom fields and versions.
- Playwright: login as each demo role, open the command bar, create and undo a record in a demo table.

LIVE CHECK (do this yourself before saying you are done)
Start php artisan serve and npm run dev, open http://localhost:5173 in the browser tool, log in as super admin, and go through: theme light/dark, Compact density, command bar, quick add, a DataTable with inline edit + Undo, drawer with unsaved-changes guard, version history restore. Check the browser console has zero errors. Take a screenshot of each and list any problem you fixed.

WHEN DONE: list the files you changed, the test results, the screenshots, and anything you could not finish.
```

**Per-module prompt (copy, fill in the module name and number)**

```text
Read docs/PRD.md and docs/MODULES.md section <NUMBER>. <MODULE NAME> completely, and follow .cursor/rules/hak.mdc.

Build the <MODULE NAME> module exactly as specified: every screen, feature, field, editable item and rule in that section. Reuse the shared foundation (AppShell, DataTable, RecordDrawer, form fields, Undo, History, Notes and Files, custom fields); do not create new versions of them.

Requirements:
- All reads and writes go through the local repository and the sync outbox; it must work offline.
- Apply permissions from docs/PRD.md ‘Roles and permissions’ on screen and on the server; hidden fields must never be synced to roles that can't see them.
- Money records follow docs/MODULES.md ‘Safety rules for money records’.
- Every number comes from /app/src/shared/calc.ts; add any new formula there with Vitest tests.
- Empty states, skeletons, keyboard use, 360 px mobile layout, light and dark mode.

Tests: write Pest, Vitest and Playwright tests that cover every item in the section's ‘Live check’ list, run them, and show the results.

Live check: start the servers, open the app in the browser tool, log in as Super Admin and then as the most limited role that can use this module, and perform every ‘Live check’ item by hand. For sync items, use two browser windows (one normal, one private) logged in as different users, and use DevTools offline mode. Check the console has zero errors. Take screenshots, fix every problem you find, and repeat until all checks pass.

When done: list files changed, test results, screenshots, and open issues. Do not start another module.
```

**Example:** “Read docs/PRD.md and docs/MODULES.md section 2. Customers (Customer 360) completely…”, with the rest of the per-module prompt unchanged.

## Real-time testing

Every module is tested live in a real browser while it is built, by Cursor and then by you, and finally on the Hostinger subdomain. A module counts as done only when its automated tests pass and every item in its Live check list works by hand.

**One-time setup**

1. Give Cursor's Agent a browser: use Cursor's built-in browser tool, or add the Playwright MCP server in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] }
  }
}
```

2. Run `php artisan hak:demo-seed` to create one test user per role (Super Admin, Partner, Manager, Salesperson, Viewer) and the golden dataset. It works only in the dev environment.
3. Keep four terminals open while building:

| Terminal | Command | What it shows |
| --- | --- | --- |
| 1 | `php artisan serve` (in /api) | The local API at http://127.0.0.1:8000 |
| 2 | `npm run dev` (in /app) | The app at http://localhost:5173, reloading on every save |
| 3 | `npx vitest --watch` (in /app) | Logic tests re-running on every change |
| 4 | `npx playwright test --ui` (in /app) | Click-through tests you can watch step by step |

Run `php artisan test` after every server change.

**Live test routine for each module (about 15 minutes)**

1. **Cursor tests it:** the per-module prompt makes Cursor open the app, click through every Live check item, read the console and take screenshots. Review the screenshots.
2. **You test it as two roles:** Chrome window = Super Admin; private window = the most limited role that uses the module. Do every Live check item yourself.
3. **Offline and sync:** DevTools → Network → Offline in one window, make changes, go back online, and watch the other window update within 20 seconds.
4. **Phone size:** DevTools device toolbar at 390 px: the bottom bar, drawers and forms must be fully usable.
5. **Dark mode and Compact:** switch both on and check that nothing is unreadable.
6. **Desktop app** (from step 18 onward): run the Electron app in dev mode and repeat the main Live check item.
7. **On the subdomain:** after `./deploy.sh`, run `BASE_URL=https://tracker.yourdomain.com npx playwright test --grep @smoke` and repeat one Live check item by hand.

**Bug loop:** when something fails, paste into Cursor the failing step, the screenshot and the console error, and ask it to fix the cause, add a test that would have caught it, and re-run the live check. Commit only when everything is green.

**Module sign-off checklist**

- [ ] All Pest, Vitest and Playwright tests green.
- [ ] Every Live check item passed by hand as two roles.
- [ ] Works offline and syncs to a second window.
- [ ] Usable at 390 px, in dark mode and in Compact.
- [ ] No console errors.
- [ ] Smoke test passes on the subdomain.
