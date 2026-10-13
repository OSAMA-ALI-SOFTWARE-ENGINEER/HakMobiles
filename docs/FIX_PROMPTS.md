# HAK Wholesales Tracker — Cursor prompts: MySQL, full CRUD, real-time, UI/UX, test data and Playwright

These 8 prompts fix the current build so that **every piece of data lives in MySQL**, every module has **full create / read / update / delete (archive) / restore**, other users see changes **within about 2 seconds**, the UI matches `docs/MODULES.md`, and everything is proven by **Playwright** tests on realistic dummy data.

## How to use

1. Save this file in the repository as `docs/FIX_PROMPTS.md`, next to `docs/PRD.md` and `docs/MODULES.md`.
2. Run the prompts **in order, one per new Cursor Agent chat**. Do not combine them.
3. After each prompt: review the diff, run the tests it lists, check the app in the browser, then commit.
4. If Cursor says "done" but a test fails, paste the failing output back into the same chat and ask it to fix the cause.

**How data flows after the fix (the rule every prompt follows)**

```text
User action in the UI
  → validated form (Zod)
  → repository: save to local SQLite + outbox (instant, works offline)
  → push to Laravel API right away when online
  → Laravel validates again, saves to MySQL in a transaction, returns the saved record
  → local record replaced with the server version (server is the truth)
  → Laravel broadcasts "records changed" through Pusher
  → every other open device pulls the change and its screen updates by itself
```

MySQL is the single source of truth. The local SQLite copy exists only for speed and offline use. Nothing in the app (lists, dropdown options, settings, demo numbers, charts) may come from hardcoded arrays, JSON files or localStorage.

---

## Prompt 1 — Audit: find every piece of hardcoded data

```text
Read docs/PRD.md, docs/MODULES.md and docs/FIX_PROMPTS.md first.

TASK: Audit only. Do not change any code.

Search the whole repository (/app, /desktop, /api) for data that is hardcoded instead of coming from the database:
- arrays or objects of business data in .ts/.tsx/.js files (customers, products, orders, stats, chart series, notifications, users, menu badges, dropdown options such as categories, colours, payment methods, statuses, pipeline stages)
- leftover TailAdmin demo data (eCommerce metrics, recent orders, country maps, demo users, demo images)
- JSON/CSV files imported by the UI
- data kept in localStorage or sessionStorage (except UI preferences like theme)
- numbers typed directly into JSX (totals, percentages, counts)
- Laravel controllers or seeders returning fixed data outside DemoSeeder/GoldenSeeder

Write the result to docs/AUDIT.md as a table: file | line | what is hardcoded | which MySQL table/endpoint must provide it | which fix prompt (2–8) will remove it.
End with a count per module. Then stop.
```

**Check:** open `docs/AUDIT.md` and confirm it lists the demo dashboard data, dropdown lists and any mock customers/products you have seen on screen.

---

## Prompt 2 — Create the MySQL database schema

```text
Read docs/PRD.md ('Data model', 'CRM tables and fields', 'Sync and duplicate prevention'), docs/MODULES.md ('Editing framework') and docs/AUDIT.md.

TASK: Create the complete MySQL schema with Laravel 13 migrations. The schema must also work on MariaDB (Hostinger may use it).

Tables (one migration per group, in this order):
1. Auth: users, roles/permissions (spatie), personal_access_tokens, devices, user_preferences, notification_preferences, login_history.
2. Settings and lists (everything that was hardcoded): settings (key/value JSON), lookup_lists + lookup_items (type, label, sort_order, colour, is_active) for product categories, colours, phone models, units, payment methods, expense categories, shop types, tags, follow-up types; currencies (code, symbol, default_fx_rate); pipeline_stages (name, order, colour, kind); templates (type, locale, subject, body); custom_field_definitions (entity, key, label, type, options JSON, required, show_in_table, filterable, sort_order); period_locks; sales_targets.
3. Partners: partners (name, user_id), partner_share_history (partner_id, share_pct, effective_from).
4. Master data: products, customers, suppliers, customer_special_prices.
5. Ledgers: purchases, purchase_lines, purchase_extra_costs, purchase_receipts; sales (type: quote/sale/credit_note, status), sale_lines; stock_adjustments; supplier_payments; customer_payments, payment_allocations; expenses (+ recurring_rule); partner_transfers (type: settlement/withdrawal).
6. CRM: customer_activities, follow_ups.
7. Framework: record_versions, notes, attachments, saved_views, import_batches, activity_log.
8. Sync: sync_changes, processed_ops.

Rules for every business table:
- id CHAR(36) UUID v7 primary key (HasUuids with v7); created_at, created_by, updated_at, updated_by, device_id, deleted_at (SoftDeletes); a `version` unsigned int for optimistic locking; `custom` JSON for custom field values where the entity supports custom fields.
- Money: DECIMAL(12,2). Quantities: INT. FX rates: DECIMAL(12,6). Percent: DECIMAL(5,2).
- Foreign keys with ON DELETE RESTRICT; indexes on every foreign key, every date used in filters, status columns, and search columns (name, code, phone, nif, invoice_no).
- Unique: products.code, suppliers.name, sales.invoice_no, customers.nif (unique when not null), processed_ops.op_id, lookup_items(type,label).
- Use utf8mb4_unicode_ci.

Also:
- Eloquent models with relationships, casts (money as decimal:2, JSON as array), and SoftDeletes.
- A docs/DB.md file listing every table, its columns and relationships (generated, not hand-typed), with a Mermaid ER diagram.
- Update the Drizzle schema in /app/src/db to mirror the business, CRM and lookup tables exactly (same column names).

TESTS (Pest, using a real MySQL test database `hak_test`, not SQLite):
- migrate:fresh runs cleanly; every unique constraint rejects a duplicate; soft-deleted rows are hidden by default; foreign keys block deleting a customer that has sales.

Run `php artisan migrate:fresh` and `php artisan test`, and show the results.
```

**Check:** in phpMyAdmin or TablePlus, the `hak` database shows all tables; `docs/DB.md` shows the ER diagram.

---

## Prompt 3 — Realistic dummy data for testing

```text
Read docs/PRD.md (golden test in step 16) and docs/DB.md.

TASK: Create factories and seeders that fill MySQL with realistic, consistent test data. All business records must be created through the same service classes the API uses (SaleService, PurchaseService, PaymentService, StockService...), never raw inserts, so stock, balances and history are correct.

1. LookupSeeder (runs in every environment, including production): default categories (Phone Cases, Screen Protectors, Chargers, Cables, Earphones, Headphones, Power Banks, Holders, Smart Watches, Speakers, Memory, Selfie Sticks, Car Accessories, Other), colours, payment methods (Cash, Bank Transfer, MB Way, Card, Cheque), expense categories, shop types, pipeline stages, currencies (EUR, USD, CNY, PKR, AED, GBP, HKD), templates, default settings.
2. DemoSeeder (dev and testing only; refuse in production) with Faker locale pt_PT and a fixed seed (2026) so data is identical every run:
   - 5 users, one per role (superadmin@hak.test, partner@hak.test, manager@hak.test, sales@hak.test, viewer@hak.test), password from .env DEMO_PASSWORD.
   - 3 partners: Dr. Waseem 20%, Haseeb 40%, Umar 40%.
   - 8 suppliers (Shenzhen, Guangzhou, Lahore, Dubai, Lisbon).
   - 120 products in ~35 families with colour/model variants, realistic codes (CASE-IP15-BLK), prices €2–€45, alert levels.
   - 60 customers (shops) in Lisboa, Porto, Braga, Coimbra, Faro, Setúbal with VALID Portuguese NIFs (correct check digit), +351 phone numbers, valid postcodes, spread across all pipeline stages, some with credit limits and special prices.
   - 6 months of history: 40 purchases (some partly received, with shipping/customs spread), 600 sales with 1–6 lines, 15 quotes, 8 returns; customer payments with a mix of fully paid, part-paid and overdue; supplier payments in EUR/USD/CNY by different partners; monthly rent + random expenses; 6 partner transfers; 150 activities; 80 follow-ups (overdue, today, upcoming, done); monthly sales targets.
   - Deliberate edge cases for testing: 5 products at LOW stock, 3 OUT of stock, 2 customers with the same phone (duplicate detection), 1 customer over credit limit, 1 locked period (two months ago).
3. GoldenSeeder: exactly the golden dataset from docs/PRD.md step 16 on an empty database (used by Playwright to check numbers to the cent).
4. Artisan commands: `php artisan hak:demo-seed --fresh` and `php artisan hak:golden-seed --fresh` (both refuse in production and print a summary table of row counts).

TESTS (Pest): after DemoSeeder, no product has negative stock except the deliberate cases; every sale total equals the sum of its lines; every customer balance equals sales − payments; every NIF passes validation; running the seeder twice gives identical totals.
Run both commands and the tests, and show the summary tables.
```

**Check:** run `php artisan hak:demo-seed --fresh`, log in as `superadmin@hak.test`, and the app is full of believable data, with nothing left from the TailAdmin demo.

---

## Prompt 4 — Full CRUD API for every module

```text
Read docs/PRD.md, docs/MODULES.md (all 18 modules) and docs/DB.md.

TASK: Build a complete, consistent REST API in Laravel 13 for every module. Use one pattern for all modules so the front end can rely on it.

For every resource (customers, products, suppliers, purchases, sales, quotes, credit-notes, customer-payments, supplier-payments, expenses, partner-transfers, stock-adjustments, follow-ups, activities, lookup-items, pipeline-stages, templates, custom-fields, users, roles, devices, saved-views, sales-targets, period-locks, settings):
- GET /api/{resource}: pagination (cursor), search (q), filters (filter[status]=...), sort (sort=-date), include related (include=lines,customer), fields selection.
- GET /api/{resource}/{id}
- POST /api/{resource}: create (client may send its own UUID v7 id; repeat with the same id returns the existing record, never a duplicate).
- PATCH /api/{resource}/{id}: partial update for inline editing; requires the record's `version`; a stale version returns 409 with the current record and the changed fields.
- DELETE /api/{resource}/{id}: archive (soft delete) with its side effects reversed (e.g. stock returned for a cancelled sale).
- POST /api/{resource}/{id}/restore
- POST /api/{resource}/bulk: {action, ids, data} for bulk edit/archive/assign/tag.
- GET /api/{resource}/export?format=xlsx|csv with the same filters.
- GET /api/{resource}/{id}/history: field-level version history; POST .../history/{versionId}/restore.

Implementation rules:
- FormRequest validation for every store/update, matching the Zod schemas field by field (share the rules list in docs/VALIDATION.md).
- Policies using spatie permissions for every action; hidden fields (cost, margin, profit, partner data) removed in API Resources for roles without permission.
- Service classes wrap every money operation in a DB transaction and update stock movements, balances, invoice statuses and the activity log together.
- Money-record safety rules from docs/MODULES.md: reason required for edits older than today, period lock check, invoice numbers never change.
- Every write records a record_versions row and a sync_changes row, and fires the RecordsChanged event (Prompt 6).
- One JSON error format: {message, errors:{field:[...]}, code}.
- Generate API docs with Scribe into /api/public/docs (dev only).

TESTS (Pest, MySQL test DB with DemoSeeder): for every resource, create, read, list with filter/sort/search, update, stale-version 409, archive, restore, bulk, export, history restore, plus allowed/forbidden per role. Show the test count and results.
```

**Check:** open `http://127.0.0.1:8000/docs`; every module has its endpoints. Try a create and an update in Bruno, and check the row in MySQL.

---

## Prompt 5 — Connect every screen to the database (remove all hardcoded data)

```text
Read docs/AUDIT.md, docs/MODULES.md and the API docs.

TASK: Make every screen read and write real data. After this prompt, docs/AUDIT.md must have zero open items.

1. Data layer in /app/src/data:
   - A typed API client generated from the Laravel routes (or written by hand with Zod response schemas).
   - The repository writes to local SQLite + outbox and pushes immediately when online; it then replaces the local record with the server's version.
   - Reactive queries (SQLocal reactiveQuery) so any change in SQLite re-renders the screens using it, without a reload.
   - Per-module hooks with one naming pattern: useCustomers(filters), useCustomer(id), useCreateCustomer(), useUpdateCustomer(), useArchiveCustomer(), useRestoreCustomer(), useBulkCustomers(), and the same for every module.
   - Optimistic updates with rollback and a clear toast when the server rejects a change (validation, permission, 409 conflict with Keep mine / Keep theirs).
2. Replace every hardcoded item listed in docs/AUDIT.md:
   - Dropdown options come from lookup_items / pipeline_stages / currencies via useLookup('categories') etc.
   - Dashboard cards, charts, recent sales, schedule and alerts come from calc.ts over real records.
   - Notifications, user menu, sidebar badges (e.g. overdue count) come from real data.
   - Delete the TailAdmin demo data files and demo images.
3. Full CRUD in the UI for every module, using DataTable, RecordDrawer and form fields: create, view, inline edit, drawer edit, archive with Undo, Archive view with restore, bulk actions, export, history with restore.
4. Loading skeletons, empty states with the main action, and error states with Retry on every list and detail screen.
5. Guard against regressions:
   - ESLint rule (no-restricted-imports + a custom rule) that fails on imports from any mock/demo/fixtures folder outside tests.
   - A script `npm run check:no-hardcoded` that fails if business-looking arrays (objects with id + name/price/total) appear in src outside tests.

TESTS: Vitest for every hook (create → appears in list; update → list updates; archive → disappears and Undo restores; server rejection → rollback). Run `npm run lint`, `npm run check:no-hardcoded` and `npm test`, and show the results. Then mark every row in docs/AUDIT.md as fixed with the commit hash.
```

**Check:** log in, create a customer, edit it inline, archive it, restore it, then look at the `customers` table in MySQL. Every change must be there, with history rows.

---

## Prompt 6 — Real-time updates across devices

```text
Read docs/PRD.md ('Sync and duplicate prevention') and docs/FIX_PROMPTS.md (data flow).

TASK: Make changes appear on every other open device within about 2 seconds, using services that work on Hostinger shared hosting.

1. Laravel broadcasting with the Pusher driver (`php artisan install:broadcasting --pusher`). Use a Pusher Channels Sandbox app (free) in the EU cluster; keys in .env only.
2. Event RecordsChanged implements ShouldBroadcastNow (shared hosting has no queue worker), on the private channel `hak.changes`, payload {table, ids[], seq}. Never put business data in the payload: only IDs, so permissions still apply when the device pulls.
3. Channel authorisation through Sanctum tokens (web and Electron).
4. Front end: @laravel/echo-react with useEcho on `hak.changes`; on an event, run the sync pull immediately. Keep the 10-second polling as a fallback, and switch to it automatically if Pusher is disconnected or over its limits. Show the connection state in the status bar (Live / Polling / Offline).
5. Presence channel `hak.presence`: show who is online in the header, and on a record drawer show "Umar is viewing/editing this" when another user has the same record open.
6. Debounce: many changes in one transaction send one event.

TESTS:
- Pest: every service write dispatches exactly one RecordsChanged with the right table and IDs (Event::fake).
- Playwright: two browser contexts (Super Admin and Manager). A creates a sale; B's sales list and dashboard show it in under 3 seconds. Then block the Pusher host in B: the change still arrives through polling in under 15 seconds.
Run them and show the results.
```

**Check:** open the app in Chrome and in a private window as two users, put them side by side, and add a sale in one. The other updates by itself.

---

## Prompt 7 — UI and UX fix pass

```text
Read docs/MODULES.md ('Design direction and ease of use', 'Editing framework') and every module section.

TASK: Audit and fix the UI and UX of every screen. First list the problems you find per screen in docs/UI_AUDIT.md, then fix them all.

Apply these standards everywhere:
- Layout: one page header pattern (title, breadcrumb, short description, primary action on the right, secondary actions in a menu). An 8 px spacing scale. Max content width 1440 px. 12 px radius cards with 1 px borders, no heavy shadows.
- HAK theme only: primary teal #0F766E, status colours (green paid/OK, amber low/part-paid/due soon, red out/overdue, grey archived), Inter with tabular numbers; remove all TailAdmin branding, demo logos and the default favicon; add the HAK logo.
- Tables: consistent column alignment (text left, numbers and money right), status badges, row hover, sticky header, compact/comfortable density, visible row actions on hover and in a ⋯ menu, selection bar with bulk actions.
- Forms: labels above inputs, required marker, helper text, inline validation as you type, two columns on desktop and one on mobile, logical tab order, Enter to next field, Ctrl+Enter to save, primary button bottom-right, unsaved-changes guard, draft autosave.
- Feedback: skeletons, empty states with one action, toasts with Undo, ConfirmDialog only for destructive actions, plain-language errors.
- Formatting: € 1.234,56 (pt-PT), dates dd/mm/yyyy, relative times ("2 h ago") with exact time on hover.
- Navigation: active sidebar state, collapsible sidebar, Ctrl+K command bar, + New menu, mobile bottom bar, breadcrumbs, back from drawers.
- Accessibility: keyboard everything, focus rings, aria labels on icon buttons, WCAG AA contrast in light and dark.
- Responsive at 360, 768, 1280 and 1920 px with no horizontal page scroll.
- Performance: lists of 10,000 rows scroll smoothly (virtualised); no layout shift on load.

TESTS:
- Playwright visual snapshots for every main screen in light, dark and mobile (390 px), using the DemoSeeder data with a frozen clock.
- @axe-core/playwright on every main screen: zero serious or critical violations.
- Show before/after screenshots for the 5 screens with the biggest changes.
```

**Check:** click through every menu item in light mode, dark mode and phone size. Nothing looks like the stock template, nothing is cut off, and every action is easy to find.

---

## Prompt 8 — Complete Playwright test suite

```text
Read docs/PRD.md, docs/MODULES.md (every 'Live check' list) and docs/FIX_PROMPTS.md.

TASK: Build a full end-to-end test suite with Playwright that tests the real app against a real MySQL test database.

Setup:
- playwright.config.ts with projects: chromium desktop, mobile (Pixel 7), dark mode (colorScheme: 'dark').
- webServer starts `php artisan serve --env=testing` and `npm run dev` (or the built preview).
- globalSetup: `php artisan migrate:fresh --env=testing` then `php artisan hak:demo-seed` (or hak:golden-seed for the numbers suite); log in once per role and save storageState files (superadmin, partner, manager, sales, viewer).
- Fixtures: `asRole(role)`, `api` (direct API calls to set up data quickly), `db` (read MySQL to assert what was saved), `twoUsers` (two contexts for sync and real-time).
- Use data-testid attributes for stable selectors; add them to components where missing.
- Trace, video and screenshot on failure; HTML report.

Test files (one per module plus cross-cutting), covering every 'Live check' item in docs/MODULES.md:
- auth.spec: login, wrong password, lockout, forced password change, 2FA, logout, offline PIN.
- users-roles.spec: create user, edit role permissions, View as role, deactivate, device revoke.
- For every business module (customers, pipeline, follow-ups, products, purchases, suppliers, supplier-payments, sales, quotes, returns, customer-payments, expenses, partners, reports, settings, import-export):
  CREATE → appears in list and in MySQL; READ → detail shows correct data; UPDATE inline and in drawer → saved in MySQL with a history row; ARCHIVE → hidden + Undo works; RESTORE from Archive view; BULK action; EXPORT file downloads with the right rows; VALIDATION errors shown for bad input; PERMISSIONS: a role without access cannot see or call it.
- numbers.spec (GoldenSeeder): dashboard, partner balances, settle-up suggestions, ageing report match the golden values to the cent.
- sync.spec: context.setOffline(true), create 5 records, go online → all 5 in MySQL exactly once; abort the push 20 times → no duplicates.
- realtime.spec: two users, change in A visible in B in < 3 s; fallback polling in < 15 s.
- a11y.spec and visual.spec from Prompt 7.
- Tag the fastest 10 critical tests with @smoke for running against the live subdomain (BASE_URL env).

CI: .github/workflows/test.yml running Pest, Vitest and Playwright with a MySQL 8 service container on every push; upload the Playwright report as an artifact.

Run the whole suite locally (`npx playwright test`), fix every failure in the app (not by weakening tests), and show: number of tests per file, pass/fail, and the report path.
```

**Check:** `npx playwright show-report` shows every test green, for desktop, mobile and dark mode.

---

## Done when

- [ ] `docs/AUDIT.md` has zero open items, and `npm run check:no-hardcoded` passes.
- [ ] Every module supports create, read, inline and drawer update, archive, restore, bulk, export and history, all saved in MySQL.
- [ ] Two devices side by side update each other in under 3 seconds; offline changes sync with no duplicates.
- [ ] Pest, Vitest and Playwright are all green locally and in GitHub Actions.
- [ ] The UI passes the visual, mobile, dark-mode and accessibility tests.
- [ ] After `./deploy.sh`, `BASE_URL=https://tracker.yourdomain.com npx playwright test --grep @smoke` passes on Hostinger.

## Notes

- **Pusher Sandbox** is free: 200,000 messages per day and 100 simultaneous connections, far more than a team of a few users needs. If Pusher is unavailable, the app keeps working through 10-second polling.
- **Use a separate MySQL database for tests** (`hak_test`), never the live one. Dummy data must never be seeded on Hostinger: the seed commands refuse to run in production.
- On Hostinger, only `LookupSeeder` runs at go-live; real data comes from the Excel import (module 18).
