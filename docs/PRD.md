# HAK Wholesales Tracker — PRD & Build Guide

Oct 8, 2026 · @HAK

## Summary and key decisions

HAK Wholesales Tracker replaces the Excel partner tracker with a web app and a Windows/Mac desktop app. Both work offline and sync on their own through a server on your Hostinger subdomain. Only people the super admin creates can log in, and each person sees only what their role allows.

| Decision | Choice | Reason |
| --- | --- | --- |
| Hosting | Your Hostinger Premium plan, on a subdomain such as `tracker.yourdomain.com` | You already pay for it; free SSL; MySQL included |
| Server | **Laravel 13 (PHP 8.5)** with a REST API | Runs on every Hostinger shared plan. Hostinger's Node.js apps need the Business or Cloud plan. |
| Cloud database | **MySQL** on Hostinger | Your choice; one source of truth |
| Database on each device | **SQLite** (in the browser and inside the desktop app) | Instant screens; full offline use |
| Sync | A small **custom push/pull sync** built into the Laravel API | Shared hosting does not allow the database replication that ready-made sync tools need |
| Screens | **React + TypeScript + Vite**, with the TailAdmin dashboard design, installable as an offline web app (PWA) | One set of screens for web and desktop |
| Desktop | **Electron**, the same React app bundled inside | Windows and Mac installers that auto-update from your subdomain |
| Login and roles | Laravel Sanctum tokens + spatie/laravel-permission | Proven, free; the super admin manages users, roles and permissions |
| Editor | Cursor | Every build step below includes a ready prompt and its tests |

**Users:** Haseeb (super admin), the partners Dr. Waseem (20%), Haseeb (40%) and Umar (40%), plus any staff the super admin adds later.

**Running cost:** €0 extra beyond your Hostinger plan. Optional code signing for the desktop installer costs about €100–300 per year.

## Roles and permissions

The super admin creates every login and decides what each role can do. The app ships with five roles. The super admin can edit them or create new ones by ticking permissions, so no code change is needed.

**Default roles**

| Role | Meant for | Summary |
| --- | --- | --- |
| Super Admin | Haseeb | Everything, including users, roles, settings and devices. Cannot be deleted; at least one must always exist. |
| Partner | Dr. Waseem, Umar | All business data, profit and partner balances. No user management. |
| Manager | A trusted staff member | Stock, purchases, sales, payments and customers. No profit, cost prices or partner balances. |
| Salesperson | Staff who sell | Creates sales and records customer payments; sees products, selling prices and customers. |
| Viewer | Accountant | Read-only reports and export. |

**Permission matrix (default)**

| Permission | Super Admin | Partner | Manager | Salesperson | Viewer |
| --- | --- | --- | --- | --- | --- |
| Dashboard: sales and stock | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard: profit and partner balances | ✓ | ✓ | — | — | ✓ |
| Products: view | ✓ | ✓ | ✓ | ✓ | ✓ |
| Products: create / edit / archive | ✓ | ✓ | ✓ | — | — |
| See cost prices and margins | ✓ | ✓ | — | — | ✓ |
| Stock adjustments | ✓ | ✓ | ✓ | — | — |
| Purchases and supplier payments | ✓ | ✓ | ✓ | — | view |
| Sales: create | ✓ | ✓ | ✓ | ✓ | — |
| Sales: edit / archive | ✓ | ✓ | ✓ | own, same day | — |
| Customer payments | ✓ | ✓ | ✓ | ✓ | view |
| Customers: create / edit | ✓ | ✓ | ✓ | ✓ | — |
| Suppliers | ✓ | ✓ | ✓ | — | view |
| Expenses | ✓ | ✓ | ✓ | — | view |
| Partner transfers | ✓ | ✓ | — | — | view |
| Reports and export | ✓ | ✓ | ✓ | — | ✓ |
| Activity log | ✓ | ✓ | — | — | — |
| Settings (shares, categories, alerts) | ✓ | — | — | — | — |
| Users, roles and devices | ✓ | — | — | — | — |

**CRM permissions:** Super Admin, Partner, Manager and Salesperson can move pipeline stages, log activities and manage follow-ups; a Viewer can only read them. “Customers: assigned only” is off by default and can be switched on per role, for example for Salesperson.

**What the super admin can do (Users screen)**

1. **Create a login:** name, email, role and an optional phone. The app generates a temporary password to share privately. The user must change it at first login.
2. **Edit a user:** change role, reset password, require two-factor login, set an expiry date (for temporary staff).
3. **Deactivate a user:** the account is blocked at once. At their next sync, their devices log out and the local data is wiped.
4. **Roles screen:** copy a role, rename it, and tick or untick any permission in the matrix. Changes reach users at their next sync.
5. **Devices screen:** see each user's devices (name, last sync, app version) and revoke any one.
6. **Activity log:** every login, failed login, user change and data change, with who, when and from which device.

Permissions are checked in two places. The server refuses any action the role does not allow. The server also never sends data the role may not see; for example, a Salesperson's device never receives cost prices.

## Authentication and security

The first login on a device must be online. After that, the app opens offline with a PIN, and the server re-checks the user at every sync. A deactivated user is locked out of all devices at their next connection.

| Area | Requirement |
| --- | --- |
| Accounts | Created only by the super admin. No public sign-up page. |
| Passwords | At least 10 characters; stored with bcrypt; a temporary password must be changed at first login. |
| Brute force | 5 failed attempts per minute, then a 15-minute lock for that email; every failure is logged. |
| Two-factor login | Authenticator app (TOTP). Required for Super Admin and Partners; optional for other roles. |
| Session tokens | Laravel Sanctum token per device, valid 30 days and renewed at each sync; revoked on logout, deactivation or device revoke. |
| Token storage | Desktop: encrypted with Electron safeStorage in the OS keychain. Web: browser storage protected by a strict Content Security Policy. |
| Offline unlock | A 6-digit PIN set at first login, checked against a hash on the device; auto-lock after 15 minutes idle; 5 wrong PINs require an online login. |
| Permissions on device | Role and permissions are cached on the device for the menus; the server re-checks every upload. |
| Data the role can't see | Never sent to the device (e.g. cost prices for Salesperson). |
| Revoked device | The server replies “revoked”; the app wipes its local database and returns to the login screen. |
| Transport | HTTPS only (free Hostinger SSL); HSTS on; CORS limited to the app's own domain and the desktop app. |
| Audit | Logins, failed logins, password resets, user and role changes, and every data change are logged with user, device, IP and time. |
| Super admin recovery | A server command (`php artisan hak:reset-admin`) run over SSH, so the owner can never be locked out. |

## Features

Version 1 carries over every tab of the Excel tracker and gives the same totals for the same data.

| Module | What it does |
| --- | --- |
| Dashboard | Sales, net profit and margin, customers owe us, we owe suppliers, stock value, stock alerts, partner balances with “who owes whom”, 12-month chart, date filter |
| Products & stock | Code, name, category, colour, model, selling price, alert level, photo, barcode; stock = bought − sold ± adjustments; LOW / OUT alerts |
| Purchases | Supplier order with lines (product, qty, cost per piece); adds stock; weighted average cost |
| Supplier payments | Who paid, which supplier, for what, amount, currency, FX rate, euro value |
| Sales | Invoice with lines; price from product, can be overridden; discount; removes stock; profit per line |
| Customer payments | Amount, method, which partner received the money, allocated to invoices; Unpaid / Part-paid / Paid; overdue list |
| Expenses | Category, amount, currency, paid by, receipt photo |
| Partner transfers | Money moved between partners to settle up |
| Customers | Shop name, contact, phone, NIF, address, email, credit limit; totals bought, paid, owed; duplicate warning |
| Suppliers | Contact details; totals purchased, paid, owed |
| Reports & export | Profit by month, product, customer, category; invoice and statement PDFs; export to Excel/CSV; one-time import from the Excel tracker |
| Admin | Users, roles and permissions, devices, settings (partner shares, categories, colours, alert level, currencies), activity log |

**CRM features**

| Feature | What it does |
| --- | --- |
| Customer 360 page | Shop profile with Call, WhatsApp and Email buttons, NIF, address, tags and status; cards for total bought, paid, owed, last order and average order; tabs for Sales, Payments, Activities, Follow-ups and Notes |
| Pipeline | Stages Lead → Contacted → Sample sent → First order → Active → Inactive, shown as a drag-and-drop board. A shop with no order for 60 days (a setting) is marked Inactive automatically. |
| Activities | Timeline of calls, visits, WhatsApp messages and notes, each with the user and time |
| Follow-ups | Task with a customer, title, due date, assigned user and done tick; shown in the Calendar, the dashboard's Upcoming schedule and notifications. An overdue invoice creates a payment-reminder follow-up automatically. |
| Segments | Filter customers by city, shop type, tag, status, assigned salesperson or balance owed; export the list |
| Assigned salesperson | Each customer can have an owner. With the permission “Customers: assigned only”, a Salesperson sees only their own shops. |
| Sales targets | Monthly target per business and per salesperson, shown as target vs actual on the dashboard |

**Not in version 1:** online shop, card payments, certified tax invoices (AT/SAF-T), multi-warehouse stock, a native phone app. The web app works in a phone browser.

## Architecture

Both app types use the same React screens and the same local SQLite. Only the Laravel API talks to MySQL.

```text
+------------------------------+        +------------------------------+
| Web app (any browser)        |        | Desktop app (Electron)       |
| React screens -> local SQLite|        | React screens -> local SQLite|
| Outbox keeps offline changes |        | Outbox keeps offline changes |
| Sync worker: push, then pull |        | Sync worker: push, then pull |
+-------------+----------------+        +---------------+--------------+
        push  |  ^ pull                         push    |  ^ pull
              v  |      HTTPS, every 10 s               v  |
+----------------------------------------------------------------------+
| Hostinger · tracker.yourdomain.com                                   |
|  +----------------------------------------------------------------+  |
|  | Laravel 13 API (PHP 8.5) /api                                  |  |
|  | Login, tokens, roles, 2FA checked on every call                |  |
|  | Sync: saves each change once (op ID + record ID), role filter  |  |
|  +-------------------------------+--------------------------------+  |
|                                  v                                   |
|  +----------------+   +----------------------+   +----------------+  |
|  | Web app files  |   | MySQL database       |<--| Cron (1 min)   |  |
|  | React at /     |   | Single source of     |   | Nightly backup |  |
|  | /downloads     |   | truth, ledgers       |   | Log cleanup    |  |
|  +----------------+   +----------------------+   +----------------+  |
+----------------------------------------------------------------------+
```

If the internet or the server is down, both apps keep working from SQLite; the outbox empties when the connection returns.

## Sync and duplicate prevention

Each device writes to its own SQLite first, then pushes its changes to the Laravel API and pulls everyone else's. Every upload carries a unique ID that the server remembers, so the same change can arrive ten times and is saved once. Shared hosting has no live connections, so devices check for changes every 10 seconds while online; a sale reaches the other partners within about 10–15 seconds.

**Push (device → server)**

1. Every local save also writes a row to the device's `outbox` table: `op_id` (new UUID), table, record ID, data, time.
2. The sync worker sends up to 200 outbox rows to `POST /api/sync/push`.
3. In one database transaction, the server skips any `op_id` already in `processed_ops`. It checks the user's permission, then saves the record with `Laravel upsert()` by record ID, adds a row to `sync_changes` with a new sequence number, and stores the `op_id`.
4. The server answers with accepted and rejected op IDs. The device deletes the accepted rows from its outbox and moves rejected ones to a “Needs attention” list.

**Pull (server → device)**

1. The device calls `GET /api/sync/pull?since=<last sequence>`.
2. The server returns up to 500 changed records after that number, filtered by the user's role, plus the new last sequence.
3. The device writes them into SQLite and saves the new sequence. It repeats until nothing is left.
4. The order is always push first, then pull, so local unsent changes are never overwritten.

**When sync runs:** at app start, when the internet comes back, 2 seconds after any local save, and every 10 seconds while online. A status bar shows Synced 12:41 · Syncing · Offline with N waiting · Needs attention.

**The rules that prevent duplicates and lost data**

| # | Rule | Prevents |
| --- | --- | --- |
| 1 | Record IDs are UUID v7, made on the device before saving. | The same sale stored twice after a retry. |
| 2 | Every upload has an `op_id`; the server ignores one it has already processed. | Double processing when a response is lost mid-sync. |
| 3 | Stock and money are ledgers (sales, purchases, payments, adjustments are rows); totals are always calculated. | Two partners selling the last pieces offline and overwriting each other's stock. |
| 4 | No hard deletes; records are archived with `deleted_at`. | Deleted records coming back after sync. |
| 5 | Invoice numbers use a device prefix from the server plus a counter (e.g. `UMR1-0042`). | Two offline devices issuing the same number. |
| 6 | Customers are checked by NIF and phone, on the device while typing and on the server after sync; the super admin can merge duplicates. | The same shop added twice. |
| 7 | When two edits hit the same master record (e.g. a customer address), the later edit wins and the older value goes to the activity log. | Silent loss of an edit. |
| 8 | The save button locks after one press; the same customer, product, quantity and amount within 2 minutes asks “Save anyway?” | Human double entry. |

**Acceptance tests:** two devices offline for a day each enter 50 sales, then reconnect: both show 100 sales and the same stock. The network is cut during push 20 times: zero duplicates. The app is closed with unsent changes and reopened: the changes are still queued.

## Technology stack

Everything below is free and open-source and runs on Hostinger shared hosting plus each user's device.

| Layer | Library / tool | Version (checked 8 Oct 2026) | Purpose |
| --- | --- | --- | --- |
| Server framework | Laravel | **13.x** (13.0 released March 2026) | REST API, business rules, sync endpoints |
| Server language | PHP | **8.5** (use 8.4 if Hostinger does not list 8.5 yet; Laravel 13 needs 8.3+) | Runs Laravel |
| Login | Laravel Sanctum | Latest for Laravel 13 (`php artisan install:api`) | Per-device API tokens |
| Two-factor login | Laravel Fortify | Latest for Laravel 13 | Authenticator-app codes |
| Roles and permissions | spatie/laravel-permission | **8.x**; if Composer refuses it on Laravel 13, take the newest it accepts | Roles, permission matrix, editable by the super admin |
| Audit | spatie/laravel-activitylog | Latest | Who changed what, when |
| Backups | spatie/laravel-backup | Latest | Nightly database backup, run by Hostinger cron |
| Cloud database | MySQL or MariaDB, as Hostinger provides | Check in phpMyAdmin; use the same engine and version locally | Source of truth |
| Build tools runtime | Node.js | **24 LTS** (24.21) | Runs Vite, tests and Electron builds on your PC |
| App screens | React, React Router, Vite | **React 19.3**, **React Router 8**, **Vite 8** | One codebase for web and desktop |
| Language | TypeScript | **7.0** (new native compiler); fall back to 6.0 only if a tool does not support 7 yet | Type-safe code |
| UI | TailAdmin React (free, MIT), Tailwind CSS, TanStack Table, ApexCharts, FullCalendar, flatpickr | TailAdmin React 2.4, **Tailwind CSS 4.3**, latest | Forms, data tables, dashboard charts |
| Forms | React Hook Form + Zod | Latest, **Zod 4** | Fast entry with validation |
| Local database | SQLocal + Drizzle ORM | **SQLocal 0.18**, **Drizzle 0.45** (stable; not the 1.0 release candidate) | Offline storage and fast queries on every device (OPFS) |
| Offline web app | vite-plugin-pwa | **2.0** (confirm Vite 8 support at install; 1.3+ supports Vite 8) | The web app opens without internet |
| IDs | `uuid` | Latest (UUID v7) | IDs made on the device |
| PDFs and Excel | @react-pdf/renderer, SheetJS | Latest; install SheetJS from cdn.sheetjs.com (its npm copy is outdated) | Invoices, statements, Excel import and export |
| Desktop | Electron, electron-vite, electron-builder, electron-updater | **Electron 44** (44.7), others latest | Windows and Mac installers; auto-update from your subdomain |
| Tests | Pest, Vitest, Playwright, Bruno | **Pest 4**, others latest | A test after every build step |
| Code quality | ESLint (flat config), Prettier, Laravel Pint | Latest | Consistent code |
| Code storage | Git + private GitHub repository | — | History and deploy source |
| Editor | Cursor (Agent mode) with project rules | Latest | Builds each step from the prompts in the build guide |

**Version rules:** the lock files (`composer.lock`, `package-lock.json`) pin the exact versions, and both are committed to Git. Once a month, run `composer outdated` and `npm outdated`. Install patch and minor updates when all tests pass. Do major upgrades only between build steps, with every test green before and after. Node.js 26 is due to become LTS in late October 2026; move to it after its first LTS release.

## Frontend UI: TailAdmin with a CRM layout

The screens use the **free TailAdmin React template** (MIT licence, v2.4, updated September 2026) as the design and component base. It already uses React 19, React Router 8, Vite 8 and Tailwind CSS 4.3, so it drops straight into this stack. The HTML version you linked has the same design but is built with Alpine.js and Webpack, which do not fit a React app.

**The CRM dashboard is a TailAdmin Pro page.** The free template has the layout, components and an eCommerce dashboard, not the CRM dashboard. We rebuild the CRM layout with the free components, mapped to HAK data below. If you want TailAdmin's exact CRM files instead, Pro React Starter costs $59 one-time (1 seat, 3 projects, non-SaaS end products), which fits an internal tool.

**What we take from the template**

| Template part | Files | Used for |
| --- | --- | --- |
| Layout | `layout/AppLayout`, `AppSidebar`, `AppHeader`, `Backdrop` | Main shell, collapsible sidebar, mobile menu |
| Theme | `context/ThemeContext`, `ThemeToggleButton` | Light and dark mode |
| Sign-in | `components/auth/SignInForm` | Login screen (the sign-up page is removed: only the super admin creates users) |
| UI kit | `ui/button`, `badge`, `alert`, `modal`, `dropdown`, `table`, `avatar` | All buttons, status badges (LOW, Paid, Overdue), dialogs, tables |
| Forms | `form/input/InputField`, `Select`, `MultiSelect`, `date-picker` (flatpickr), `PhoneInput`, `Checkbox`, `Switch`, `TextArea`, `DropZone` | Every form; DropZone for receipt and product photos |
| Charts | ApexCharts (`react-apexcharts`), `ChartTab` | Revenue and profit charts, monthly/quarterly/annual tabs |
| Calendar | FullCalendar (`components/calendar`) | Follow-ups and payment due dates |
| Header | `NotificationDropdown`, `UserDropdown` | Stock alerts and overdue payments; profile, security, logout |
| Profile | `UserProfile/UserMetaCard`, `Security` | My profile, password, two-factor login |
| Languages | react-i18next (`i18n`, `locales`) | English now; Portuguese and Urdu later |
| Drag and drop | react-dnd (already a template dependency) | CRM pipeline board |

**What we remove:** demo pages (videos, images, avatars, buttons showcase, blank page, sign-up), maps (Leaflet, MapLibre, jsvectormap), Swiper, Prism and the AI settings page, so the app stays small. The template's `LICENSE.md` stays in the repository.

**CRM dashboard: TailAdmin Pro card → HAK version**

| TailAdmin CRM card | HAK card | Data |
| --- | --- | --- |
| Active Deal / Revenue Total / Closed Deals (with % vs last month) | Sales this month / Net profit / Customers owe us / Stock alerts | Calculated in `calc.ts`; % vs last month |
| Statistics chart (Monthly / Quarterly / Annually) | Revenue and profit chart | Sales and expenses ledgers |
| Estimated Revenue (goals with % bars) | Sales target vs actual this month | Targets set in Settings |
| Sales Category (% split) | Sales by product category | Sale lines × product category |
| Upcoming Schedule | Follow-ups and payments due | Follow-ups + overdue invoices |
| Recent Orders table (Deal ID, Customer, Product, Value, Close date, Status) | Recent sales (Invoice no., Shop, Items, Total, Date, Paid / Part-paid / Unpaid) | Sales + payment allocations |
| — | Partner panel and “who owes whom” (Partners and Super Admin only) | Partner calculations |

**Sidebar menu** (each item hidden when the role lacks the permission)

1. Dashboard
2. CRM: Customers, Pipeline, Follow-ups, Calendar
3. Sales: Invoices, Customer payments
4. Stock: Products, Purchases, Adjustments
5. Suppliers: Suppliers, Supplier payments
6. Money: Expenses, Partner transfers
7. Reports
8. Admin: Users, Roles, Devices, Settings, Activity log

**UI rules:** copy only the needed template components into `/app/src/ui` and keep their Tailwind classes and colours. Data tables use TanStack Table rendered with the TailAdmin table styles. Forms use React Hook Form + Zod wired to the TailAdmin inputs. No second UI kit (no shadcn/ui).

## Data model

The MySQL server and the SQLite on each device use the same business tables. Stock, balances and profit are never stored; they are calculated from the ledger tables.

| Table | Key fields | Group |
| --- | --- | --- |
| users | name, email (unique), password, phone, is\_active, must\_change\_password, expires\_at, two\_factor\_secret | Auth |
| roles, permissions, role\_has\_permissions, model\_has\_roles | Created by spatie/laravel-permission | Auth |
| personal\_access\_tokens | Sanctum tokens (one per device) | Auth |
| devices | user\_id, name, platform, app\_version, invoice\_prefix, last\_sync\_at, revoked\_at | Auth |
| partners | name, share\_pct, user\_id | Business |
| products | code (unique), name, category, colour, model, sell\_price, alert\_level, barcode, photo\_path | Business |
| customers | shop\_name, contact, phone, nif (unique when set), address, city, email, credit\_limit | Business |
| suppliers | name (unique), contact, phone, country, email | Business |
| purchases, purchase\_lines | supplier\_id, date, invoice\_no / product\_id, qty, unit\_cost | Ledger |
| sales, sale\_lines | invoice\_no (unique), customer\_id, date, sold\_by / product\_id, qty, unit\_price, discount, unit\_cost\_at\_sale | Ledger |
| stock\_adjustments | product\_id, qty (+/−), reason | Ledger |
| supplier\_payments | supplier\_id, paid\_by, amount, currency, fx\_rate, amount\_eur, method, purpose | Ledger |
| customer\_payments, payment\_allocations | customer\_id, received\_by, amount, method / sale\_id, amount | Ledger |
| expenses | category, amount, currency, fx\_rate, amount\_eur, paid\_by, receipt\_path | Ledger |
| partner\_transfers | from\_partner, to\_partner, amount, method, note | Ledger |
| settings | key, value (categories, colours, default alert level, overdue days) | Business |
| activity\_log | user, device, action, table, record\_id, old/new values, IP, time | Audit |
| sync\_changes | seq (auto-increment), table\_name, record\_id, changed\_at | Sync (server) |
| processed\_ops | op\_id (unique), device\_id, processed\_at | Sync (server) |
| outbox, sync\_state | op\_id, table, record\_id, payload / last\_seq | Sync (device only) |

**CRM tables and fields**

| Table | Key fields | Group |
| --- | --- | --- |
| customers (extra fields) | status (lead, contacted, sample\_sent, first\_order, active, inactive), shop\_type, tags (JSON), source, assigned\_to (user) | Business |
| customer\_activities | customer\_id, type (call, visit, whatsapp, note), body, user\_id, happened\_at | Ledger |
| follow\_ups | customer\_id, title, due\_at, assigned\_to, done\_at, auto\_reason (e.g. overdue invoice) | Business |
| sales\_targets | month, user\_id (empty = whole business), amount | Business |

**Columns on every business table:** `id` CHAR(36) UUID v7 · `created_at`, `created_by`, `device_id` · `updated_at`, `updated_by` · `deleted_at`.

`unit_cost_at_sale` keeps each sale's profit fixed when later purchases change the average cost.

## Hostinger setup

One subdomain serves everything: the web app, the API under `/api`, and the desktop installers under `/downloads`. Because the web app and the API share one address, there are no cross-site login problems. All settings below are in hPanel.

1. **Subdomain:** Domains → Subdomains → create `tracker` (e.g. `tracker.yourdomain.com`) with its own folder.
2. **PHP:** Advanced → PHP Configuration → PHP 8.5 (or 8.4 if 8.5 is not listed yet). Make sure these extensions are on: pdo\_mysql, mbstring, openssl, bcmath, fileinfo, intl, zip, sodium.
3. **Database:** Databases → MySQL Databases → create the database, a user and a strong password. Save them in a password manager; they go into the server `.env` file.
4. **SSL:** Security → SSL → install the free certificate for the subdomain and turn on Force HTTPS.
5. **SSH:** Advanced → SSH Access → enable it and add your SSH key. Check that `php -v` shows 8.5 (or 8.4) and that `composer -V` works. If SSH is not available on your plan, build everything on your PC and upload a zip that includes the `vendor` folder.
6. **Code location:** clone the repository to your home folder (e.g. `~/hak-tracker`), outside the public folder, so `.env` and the source code are never reachable from the web. Point the subdomain's folder at `~/hak-tracker/api/public` with a symlink. If Hostinger blocks the symlink, use the documented fallback: copy `public/` into the subdomain folder and fix the two paths in `index.php`.
7. **First deploy (over SSH):** `composer install --no-dev --optimize-autoloader` → copy `.env.example` to `.env` and fill in the values → `php artisan key:generate` → `php artisan migrate --force` → `php artisan hak:create-super-admin` → `php artisan optimize` → `php artisan storage:link`.
8. **Web app files:** `npm run build` on your PC; the deploy script copies the build into `api/public`, so React is served at `/` and Laravel at `/api`.
9. **Cron:** Advanced → Cron Jobs → every minute: `cd ~/hak-tracker/api && php artisan schedule:run`. The scheduler runs the nightly backup (02:00), cleans old tokens and prunes sync logs older than 90 days.
10. **Backups:** spatie/laravel-backup makes a password-protected zip of the database every night, keeps 30 days on the server and emails it to the super admin. Hostinger's weekly backup is the second layer.
11. **Production settings:** `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, a `noindex` header so search engines never list the site, and no directory listing.
12. **Desktop updates:** upload each new installer and its `latest.yml` to `api/public/downloads`. The desktop apps check that folder and update themselves.

**Deploy script (`deploy.sh`, run on your PC):** run tests → build React → `git push` → SSH to Hostinger: `git pull`, `composer install --no-dev`, `php artisan migrate --force`, `php artisan optimize` → upload the React build → check `/api/health`.

## Build guide in Cursor

Build in 20 small steps, and do not start the next step until every test of the current one passes. Each step has what to build, a prompt to paste into Cursor's Agent, the tests, and a “done when” line. Commit to Git after every green step, so a bad change is always one `git reset` away.

**How to work in Cursor**

1. Save this PRD as `docs/PRD.md` in the repository, so Cursor can read it.
2. Create `.cursor/rules/hak.mdc` with the project rules below. Cursor applies them to every prompt.
3. Use Agent mode, one step per chat. Start each prompt with “Read docs/PRD.md section X”.
4. Review every diff before accepting it, then run the tests yourself. Never accept a step on Cursor's word alone.

```markdown
---
description: HAK Wholesales Tracker project rules
alwaysApply: true
---
- Stack: Laravel 13 (PHP 8.5) API in /api; React 19.3 + TypeScript + Vite 8 + Tailwind CSS 4 in /app; Electron 44 in /desktop; shared types in /app/src/shared.
- Use the versions in docs/PRD.md ‘Technology stack’. Never downgrade a package or switch to another major version without asking.
- Read docs/PRD.md before changing behaviour. Never invent features that are not in it.
- All IDs are UUID v7 strings created on the client. Never use auto-increment IDs for business tables.
- Stock, balances and profit are always calculated from ledger rows, never stored.
- Never hard-delete business records: set deleted_at.
- Save synced records with Laravel upsert() so it works on both MySQL and MariaDB.
- Every API route needs auth:sanctum plus a permission check; add a Pest test for allowed and forbidden roles.
- Every money value is DECIMAL(12,2) in the database and handled in cents in TypeScript.
- Write tests with every change: Pest for /api, Vitest for /app logic, Playwright for flows.
- Keep components small; use the TailAdmin components in /app/src/ui (no other UI kit); forms use React Hook Form + Zod.
```

### Step 0 — Tools on your PC

**Build:** install Git, Node.js 24 LTS, PHP 8.5 with Composer (Laravel Herd on Windows/Mac is the easiest), the same database engine and version as Hostinger locally (MySQL or MariaDB, via Herd Pro, Laragon or DBngin), Cursor, and Bruno for API calls. Create a private GitHub repository `hak-wholesales-tracker`.

**Test:**

- [ ] `git --version`, `node -v` (24.x), `php -v` (8.5), `composer -V` and `mysql --version` all print a version.
- [ ] You can clone the empty repository and push a README.

**Done when:** every command works and the repository exists.

### Step 1 — Project skeleton

**Build:** a monorepo with `/api` (new Laravel 13 app: `composer create-project laravel/laravel api`), `/app` (the TailAdmin React template, already Vite 8 + React + TypeScript: `git clone https://github.com/TailAdmin/free-react-tailwind-admin-dashboard.git app`), `/desktop` (empty for now), `/docs/PRD.md`, `.cursor/rules/hak.mdc`, and a root README with run commands.

After creating both, check the versions: `php artisan --version` shows Laravel 13.x, and `npm ls react vite typescript` in /app shows React 19.3, Vite 8 and TypeScript 7 (or 6). TailAdmin currently ships React 19.2 and TypeScript 5.8, so run npm install react@latest react-dom@latest typescript@latest in /app and fix any type errors before going further.

**Cursor prompt:** “Create the monorepo from docs/PRD.md ‘Technology stack’: Laravel 13 in /api with Pest 4, React 19.3 + TypeScript + Vite 8 + Tailwind CSS 4 in /app, starting from a clone of the TailAdmin React free template with its demo pages removed (docs/PRD.md ‘Frontend UI’), at the versions in the ‘Technology stack’ table, with Vitest and Playwright, ESLint, Prettier and Pint. Add GET /api/health returning {status:'ok', time}. Add npm scripts: dev, test, build.”

**Test:**

- [ ] `php artisan serve` then open `http://127.0.0.1:8000/api/health` → `{"status":"ok"}`.
- [ ] `npm run dev` in /app shows the starter page.
- [ ] `php artisan test` and `npm test` both pass, with at least one test each.

**Done when:** both apps run locally and the tests are green.

### Step 2 — Deploy “hello world” to Hostinger

Do this early, so hosting problems show up in week 1, not at launch.

**Build:** follow “Hostinger setup” steps 1–7 and 11, and write `deploy.sh`.

**Cursor prompt:** “Write deploy.sh per docs/PRD.md ‘Hostinger setup’: run tests, build /app, push, SSH to Hostinger, pull, composer install --no-dev, migrate --force, optimize, upload the /app build into /api/public, then curl /api/health and fail if it isn't ok. Read host, user and path from a .deploy.env file that is git-ignored.”

**Test:**

- [ ] `https://tracker.yourdomain.com/api/health` returns ok over HTTPS with a padlock.
- [ ] `https://tracker.yourdomain.com/.env` returns 404 or 403, never the file.
- [ ] `http://` redirects to `https://`.
- [ ] Running `./deploy.sh` twice in a row works without errors.

**Done when:** a code change on your PC reaches the subdomain with one command.

### Step 3 — Database tables

**Build:** Laravel migrations for every table in “Data model”, with UUID primary keys, the common columns, foreign keys, unique indexes (product code, customer NIF, supplier name, invoice number) and `DECIMAL(12,2)` money columns. Add factories and a seeder with sample data.

**Cursor prompt:** “Create migrations, Eloquent models (HasUuids with UUID v7, SoftDeletes) and factories for every table in docs/PRD.md ‘Data model’. Add a DemoSeeder with 5 products, 3 customers, 2 suppliers and a few sales. Add Pest tests for the unique constraints.”

**Test:**

- [ ] `php artisan migrate:fresh --seed` runs without errors locally.
- [ ] Pest: a duplicate product code, a duplicate invoice number and a duplicate non-empty NIF are each rejected.
- [ ] Pest: an archived (soft-deleted) product is hidden from normal queries but still in the table.
- [ ] Deploy, then `php artisan migrate --force` on Hostinger succeeds.

**Done when:** the schema exists locally and on Hostinger, and the constraint tests pass.

### Step 4 — Login and tokens

**Build:** Sanctum token login: `POST /api/auth/login` (email, password, device name) → token + user + permissions; `POST /api/auth/logout`; `GET /api/auth/me`; forced password change; login rate limit with lockout; the artisan commands `hak:create-super-admin` and `hak:reset-admin`.

**Cursor prompt:** “Implement authentication per docs/PRD.md ‘Authentication and security’ with Sanctum per-device tokens (30-day expiry), throttle 5 attempts/min and a 15-minute lock, must\_change\_password, is\_active and expires\_at checks, logging of failed logins, and the two artisan commands. Pest tests for every rule.”

**Test:**

- [ ] Pest: a correct login returns a token; a wrong password returns 401; the 6th try in a minute returns 429.
- [ ] Pest: an inactive or expired user can't log in; a revoked token gets 401 on `/me`.
- [ ] Pest: a user with `must_change_password` can only call change-password until it is done.
- [ ] Bruno: log in on Hostinger with the super admin, call `/me`, log out, and `/me` now fails.

**Done when:** you can log in and out on the live subdomain using Bruno.

### Step 5 — Roles and permissions

**Build:** install spatie/laravel-permission; seed the five roles and the permission matrix from “Roles and permissions”; protect every route with a permission; the super admin bypasses checks.

**Cursor prompt:** “Add spatie/laravel-permission. Seed permissions named module.action (e.g. sales.create, products.view\_cost) and the five roles exactly as the matrix in docs/PRD.md. Protect every API route. Write one Pest dataset test that loops over every role × route and asserts 200 or 403 as the matrix says.”

**Test:**

- [ ] The role × route Pest test passes, and it fails if you untick one permission in the seeder (proves the test works).
- [ ] The super admin can call every route; a Viewer gets 403 on any create.

**Done when:** the matrix in this PRD is enforced by the server and covered by tests.

### Step 6 — User, role and device management

**Build:** API and screens for Users (create with a temporary password, edit role, reset password, deactivate, expiry date), Roles (copy, rename, tick permissions) and Devices (list, revoke). Only Super Admin.

**Cursor prompt:** “Build the super admin features in docs/PRD.md ‘What the super admin can do’: API endpoints with Pest tests, and React screens under /admin using TailAdmin tables and modals. Show the temporary password once with a copy button. Log every action to activity\_log.”

**Test:**

- [ ] Playwright: the super admin creates a Salesperson → logs out → logs in as the Salesperson with the temporary password → is forced to set a new one → sees no Admin menu.
- [ ] Playwright: the super admin deactivates that user → the user's next API call fails and the app returns to login.
- [ ] Playwright: the super admin unticks “Customers: create” for Salesperson → after the next sync the button is gone and the API returns 403.
- [ ] The activity log shows all three actions with time and user.

**Done when:** you can create and control logins without touching code.

### Step 7 — App shell and login screen

**Build:** React login screen, change-password and two-factor screens, the main layout with a role-aware menu, route guards, an API client with the token, and the sync status bar (placeholder).

**Cursor prompt:** “Build the React shell on TailAdmin's AppLayout, AppSidebar and AppHeader with the sidebar menu from docs/PRD.md ‘Frontend UI’: login (adapted from SignInForm), forced password change, TOTP setup and verify, layout with sidebar menu filtered by permissions, route guards, and an API client that sends the token and handles 401 by logging out. Vitest for the guards, Playwright for login.”

**Test:**

- [ ] Playwright: wrong password shows an error; correct login lands on the dashboard.
- [ ] Vitest: a Salesperson typing `/admin/users` in the address bar is redirected away.
- [ ] Playwright: a Partner must complete two-factor setup at first login.

**Done when:** every role sees only its own menu, on the live subdomain.

### Step 8 — Local SQLite on the device

**Build:** SQLite WASM via SQLocal with Drizzle, the same business tables as the server plus `outbox` and `sync_state`, a repository layer that all screens use, and the PWA service worker. Add a 6-digit PIN for offline unlock.

**Cursor prompt:** “Add SQLocal (OPFS) + Drizzle in /app/src/db mirroring the server tables, plus outbox and sync\_state. Every write goes through a repository that saves the record and an outbox row in one transaction. Add vite-plugin-pwa so the app loads offline, and the offline PIN unlock from docs/PRD.md.”

**Test:**

- [ ] Vitest: saving a product writes 1 product row and 1 outbox row in the same transaction; a failure writes neither.
- [ ] Manual: log in, open DevTools → Network → Offline, reload → the app opens and asks for the PIN.
- [ ] Manual: offline, add a product, reload → it is still there.
- [ ] Five wrong PINs force an online login.

**Done when:** the app works fully offline in the browser.

### Step 9 — Sync engine

This is the most important step. Take your time, and do not continue until every test passes.

**Build:** server `POST /api/sync/push` and `GET /api/sync/pull` exactly as “Sync and duplicate prevention” describes, with role-based field filtering; the device sync worker (push then pull, triggers, retries with back-off, “Needs attention” list) and the live status bar.

**Cursor prompt:** “Implement sync per docs/PRD.md ‘Sync and duplicate prevention’ rules 1–4 and 7. Server: one transaction per batch, processed\_ops for idempotency, Laravel upsert() (works on MySQL and MariaDB), sync\_changes sequence, permission check per op, field filtering per role on pull. Client: worker with triggers (start, online event, 2 s after a write, every 10 s), exponential back-off, status bar. Pest + Vitest + Playwright tests as listed in the PRD.”

**Test:**

- [ ] Pest: pushing the same batch twice creates each record once and returns the op IDs as accepted both times.
- [ ] Pest: pull with `since=0` returns everything in sequence order; `since=last` returns nothing.
- [ ] Pest: a Salesperson's pull never contains `unit_cost` or `unit_cost_at_sale`.
- [ ] Pest: a Viewer's push is rejected and nothing is saved.
- [ ] Playwright, two browser contexts A and B: both go offline, A adds 5 products and B adds 5, both go online → within 20 seconds both show the same 10 products.
- [ ] Playwright: abort the push request mid-flight 20 times in a loop → the server has exactly the expected number of rows, no duplicates.
- [ ] Manual: close the browser with 3 unsent changes, reopen online → they upload.

**Done when:** every sync acceptance test in this PRD passes on the live subdomain.

### Step 10 — Products and stock

**Build:** product list (search, filter by category and status), product form (code, name, category, colour, model, selling price, alert level, photo, barcode), stock adjustments with a reason, and LOW / OUT badges.

**Cursor prompt:** “Build Products per docs/PRD.md ‘Features’ using the repository layer only (no direct API calls). Stock = purchases − sales ± adjustments, calculated in /app/src/shared/calc.ts with Vitest tests. Hide cost fields unless the user has products.view\_cost.”

**Test:**

- [ ] Vitest: stock with 100 bought, 95 sold and −1 adjustment = 4.
- [ ] Vitest: status is OUT at 0, LOW at or below the alert level (default 10), CHECK when negative.
- [ ] Playwright: logged in as Salesperson, no cost price appears anywhere.
- [ ] A product added on one device appears on another within 20 seconds.

**Done when:** products and stock levels sync between devices and roles see the right fields.

### Step 11 — Customers, CRM and suppliers

**Build:** customer and supplier lists and forms, a duplicate warning while typing (same NIF or phone), the super admin's “Possible duplicates” screen with Merge, and the balance columns.

**Cursor prompt:** “Build Customers and Suppliers per docs/PRD.md, including duplicate rule 6 (warning on the device, server detection after sync, merge that moves all sales and payments to the kept record, logged).”

**Test:**

- [ ] Typing an existing NIF shows the warning before saving.
- [ ] Two devices offline each add “Loja Central” with the same NIF → after sync the server lists them as possible duplicates.
- [ ] Merge keeps one customer, and every sale and payment now points to it.

**Done when:** a duplicate shop can be caught and merged.

**CRM part of this step**

**Build:** the Customer 360 page, the pipeline board (react-dnd), activities timeline, follow-ups with the FullCalendar view, segments and filters, assigned salesperson, sales targets, and the automatic rules (Inactive after 60 days, payment-reminder follow-up for overdue invoices).

**Cursor prompt:** “Build the CRM features in docs/PRD.md ‘CRM features’ and ‘CRM tables and fields’ using TailAdmin components: Customer 360 with tabs, a pipeline board with react-dnd, activities, follow-ups shown in the TailAdmin Calendar, segment filters with export, assigned salesperson with the ‘Customers: assigned only’ permission, and sales targets. All writes go through the repository and sync. Pest + Vitest + Playwright tests.”

**Test:**

- [ ] Dragging a shop from Lead to Contacted saves the new status, logs an activity, and shows on another device after sync.
- [ ] A follow-up due tomorrow appears in the Calendar, in the dashboard's Upcoming schedule and as a notification on the day.
- [ ] An invoice unpaid for 31 days creates exactly one payment-reminder follow-up, even after several syncs.
- [ ] A shop with no order for 61 days shows as Inactive.
- [ ] With “Customers: assigned only” on, a Salesperson sees only their own shops, on screen and in the synced data.
- [ ] The WhatsApp button opens a chat with the shop's phone number.

**Done when:** every shop has a full history and nobody forgets a follow-up.

### Step 12 — Purchases and supplier payments

**Build:** purchase with several lines (adds stock), supplier payment with currency and FX rate, supplier balance.

**Cursor prompt:** “Build Purchases (header + lines) and Supplier Payments per docs/PRD.md. Euro value = amount ÷ FX rate when the currency is not EUR. Weighted average cost per product in calc.ts. Tests.”

**Test:**

- [ ] Vitest: 100 × €1.00 then 100 × €1.20 → average cost €1.10.
- [ ] Vitest: 108 USD at 1.08 = €100.00.
- [ ] A supplier with €180 purchased and €180 paid shows €0 owed.

**Done when:** buying stock and paying suppliers match the Excel results.

### Step 13 — Sales and invoice numbers

**Build:** sale with several lines, price from the product (can be overridden), discount, “sold by”, `unit_cost_at_sale`, device-prefix invoice numbers, a stock warning that does not block, and the double-entry guard (rule 8).

**Cursor prompt:** “Build Sales per docs/PRD.md: invoice numbers from the device prefix the server assigns at device registration plus a local counter; copy average cost into unit\_cost\_at\_sale; non-blocking stock and credit-limit warnings; save button lock and the 2-minute repeat check.”

**Test:**

- [ ] Two devices offline each create 10 sales → after sync, 20 different invoice numbers and no conflicts.
- [ ] Double-clicking Save creates one sale.
- [ ] The same sale typed again within 2 minutes asks “Save anyway?”.
- [ ] Changing a product's cost later does not change the profit of an old sale.

**Done when:** sales from all devices are unique and correct.

### Step 14 — Customer payments

**Build:** payment form (amount, method, received by), allocation to invoices (oldest first by default), invoice status Unpaid / Part-paid / Paid, overdue list after 30 days (a setting).

**Test:**

- [ ] A €300 payment against invoices of €200 and €270 marks the first Paid and the second Part-paid (€170 left).
- [ ] The customer balance equals the sales total minus the payments total.
- [ ] An invoice 31 days old and unpaid appears in the overdue list.

**Done when:** you can see exactly who owes what.

### Step 15 — Expenses and partner transfers

**Build:** expense form with currency, paid by and receipt photo (queued for upload when offline); partner transfer form.

**Test:**

- [ ] A receipt photo taken offline uploads after reconnecting and opens from another device.
- [ ] A transfer from Haseeb to Umar of €50 changes both partners' balances by €50.

**Done when:** every cost and settlement can be recorded.

### Step 16 — Calculations and dashboard

**Build:** all formulas in `calc.ts` (one place, used by every screen), then the dashboard in the CRM layout from ‘Frontend UI’: KPI cards, profit and loss for a date range, the partner panel with the “who owes whom” sentences, stock alerts, top debtors, suppliers to pay, sales by category and the 12-month chart.

**Golden test:** this sample was checked by hand in the Excel tracker. Enter it as a Vitest fixture and in a fresh install; the app must show exactly these numbers.

| Input | Value |
| --- | --- |
| Products | Case (C1, Black, sells €5, alert 10); Charger (CH1, White, sells €10, alert 3, adjustment −1) |
| Purchases | 100 × C1 at €1 from Shenzhen Co; 20 × CH1 at €4 from Lahore Traders |
| Supplier payments | Umar 108 USD at 1.08 to Shenzhen Co; Haseeb €80 to Lahore Traders |
| Sales | Shop A 95 × C1 at list price, €5 discount; Shop B 15 × CH1 at €9 |
| Customer payment | Shop A €300, received by Haseeb |
| Expense | Dr. Waseem €20 freight |
| Partner transfer | Haseeb → Umar €50 |

| Expected result | Value |
| --- | --- |
| Sales revenue / cost of goods / gross profit | €605 / €155 / €450 |
| Net profit / margin | €430 / 71.1% |
| Customers owe us / we owe suppliers | €305 / €0 |
| Stock | C1 5 pcs LOW; CH1 4 pcs OK; value at cost €21 |
| Partner balances | Dr. Waseem +€40; Haseeb −€130; Umar +€90 |
| Profit share (20/40/40) | €86 / €172 / €172 |

**Test:**

- [ ] Vitest golden test passes.
- [ ] Playwright: entering the same data through the screens shows the same dashboard numbers.
- [ ] A Manager's dashboard shows no profit or partner panel.

**Done when:** the app and the Excel tracker agree to the cent.

### Step 17 — Reports, PDFs, export and Excel import

**Build:** reports (profit by month, product, customer, category), invoice and customer statement PDFs (shared by WhatsApp or email), export of any list to Excel/CSV, the activity log screen, and a one-time import of `Mobile_Accessories_Partner_Tracker.xlsx`.

**Test:**

- [ ] An invoice PDF opens offline and shows the right lines, totals and invoice number.
- [ ] Importing the golden sample from an Excel file gives the step 16 numbers.
- [ ] Importing the same file twice does not create duplicates (the import uses fixed IDs per row).

**Done when:** your real Excel data is in the app with matching totals.

### Step 18 — Desktop app

**Build:** Electron in `/desktop`, loading the built React app from a secure custom `app://` protocol (so offline storage works); the token stored with `safeStorage`; electron-builder installers for Windows and Mac; electron-updater pointing to `https://tracker.yourdomain.com/downloads`.

**Cursor prompt:** “Create the Electron 44 app per docs/PRD.md: electron-vite, register app:// as a privileged secure standard scheme, load /app's build, contextIsolation on, nodeIntegration off, safeStorage for the token via a preload bridge, electron-builder (NSIS for Windows, dmg for Mac), electron-updater with a generic provider at the downloads URL.”

**Test:**

- [ ] Install on a Windows PC; log in online; disconnect Wi-Fi; restart the PC; open the app with the PIN; record a sale; reconnect → the sale appears on the web app.
- [ ] Publish version 1.0.1 to `/downloads` → the installed 1.0.0 offers the update and restarts on 1.0.1.
- [ ] Revoke the device from Admin → the desktop app logs out and its local data is gone.

**Done when:** partners can install the app and it updates itself.

### Step 19 — Security, backups and go-live

**Build:** HSTS, Content Security Policy, the noindex header, production `.env` checks, the nightly backup via cron, and a restore script.

**Test:**

- [ ] Download last night's backup, restore it into your local MySQL, and log in locally: data is complete.
- [ ] `https://tracker.yourdomain.com/api/users` without a token returns 401; logged in as a Viewer it returns 403.
- [ ] A free security header scan (e.g. securityheaders.com) shows HSTS and CSP.
- [ ] All Pest, Vitest and Playwright tests pass in one run: `npm run test:all`.
- [ ] **Parallel run:** for one week, enter everything in both Excel and the app; the totals match every evening.

**Done when:** the partners agree to stop using Excel.

## Go-live checklist and open questions

The app goes live when every step's tests are green and the one-week parallel run matches Excel.

**Go-live checklist**

- [ ] All 20 steps done, and `npm run test:all` is green.
- [ ] Super admin has two-factor login on, and `hak:reset-admin` has been tried once.
- [ ] Partner and staff logins created, and each person has logged in on their own devices.
- [ ] Real Excel data imported, and the totals match.
- [ ] A backup was restored successfully at least once.
- [ ] Desktop installers are in `/downloads` and installed on each partner's PC.
- [ ] The Excel file is archived read-only, dated on the switch day.

**Open questions**

- [ ] Which domain and subdomain name? (e.g. `tracker.hakwholesales.com`)
- [ ] In hPanel, does your Premium plan show SSH access and a Node.js option? SSH changes how you deploy (zip upload vs. command line).
- [ ] Windows only, or Mac too, for the desktop app?
- [ ] Which staff roles do you need on day one besides the partners?
- [ ] Should invoices carry a logo and NIF of the business? They stay internal documents, not certified tax invoices.

## Sources

- [Hostinger: How to add a Node.js web app (Business and Cloud plans)](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger)
- [Hostinger web hosting plans](https://www.hostinger.com/web-hosting)
- [PowerSync source database requirements (why ready-made sync needs database replication access)](https://docs.powersync.com/configuration/source-db/setup)

* [Laravel release notes and support policy](https://laravel.com/docs/master/releases) and [laravel/framework releases](https://github.com/laravel/framework/releases)
* [PHP supported versions](https://www.php.net/supported-versions.php)
* [Node.js releases](https://nodejs.org/en/about/previous-releases)
* [React versions](https://react.dev/versions) · [Vite releases](https://vite.dev/releases) · [React Router releases](https://github.com/remix-run/react-router/releases) · [TypeScript releases](https://github.com/microsoft/TypeScript/releases)
* [Tailwind CSS releases](https://github.com/tailwindlabs/tailwindcss/releases) · [Pest releases](https://github.com/pestphp/pest/releases) · [spatie/laravel-permission releases](https://github.com/spatie/laravel-permission/releases)
* [Drizzle ORM releases](https://github.com/drizzle-team/drizzle-orm/releases) · [SQLocal releases](https://github.com/DallasHoff/sqlocal/releases) · [vite-plugin-pwa releases](https://github.com/vite-pwa/vite-plugin-pwa/releases)
* [Electron releases](https://releases.electronjs.org/)

- [TailAdmin React free template (used)](https://github.com/TailAdmin/free-react-tailwind-admin-dashboard) · [TailAdmin HTML free template (link provided)](https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template) · [TailAdmin Pro CRM demo](https://demo.tailadmin.com/crm) · [TailAdmin pricing](https://tailadmin.com/pricing)
