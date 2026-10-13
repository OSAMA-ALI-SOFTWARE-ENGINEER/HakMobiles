# Hardcoded data audit

Audit only. No application code was changed. The live app is `app/src/App.tsx`. Screens under `app/src/pages/` are not mounted.

Dashboard totals, stock, and partner balances are calculated from local SQLite rows, not typed into the cards. The items below are still fixed in code, in a seeder other than `DemoSeeder` / `GoldenSeeder`, or are stubs that never read MySQL.

`localStorage` key `hak.session` and `sessionStorage` key `hak.unlocked` hold the login token and the PIN unlock flag. They are not business records. `sessionStorage` keys `hak.saleCustomer`, `hak.purchaseSupplier`, `hak.payCustomer`, and `hak.paySupplier` only remember the last dropdown choice in a form.

| File | Line | What is hardcoded | MySQL table / endpoint | Fix prompt |
| --- | --- | --- | --- | --- |
| `app/src/shared/crm.ts` | 1 | Pipeline stages Lead, Contacted, Sample sent, First order, Active, Inactive | `pipeline_stages` / `GET /api/pipeline-stages` | 5 |
| `app/src/crm/CrmScreens.tsx` | 65 | Shop status dropdown uses that stage list | `pipeline_stages` | 5 |
| `app/src/crm/CrmScreens.tsx` | 90 | Activity types Call, Visit, WhatsApp, Note | `lookup_items` type `follow-up` / activity types | 5 |
| `app/src/crm/CrmScreens.tsx` | 106 | Every new follow-up is saved as type `call` | `lookup_items` type `follow-up` | 5 |
| `app/src/App.tsx` | 573 | Chart is one bar labelled “Sample”, not 12 months of sales | sales ledger via `GET /api/reports` | 5 |
| `app/src/App.tsx` | 684 | Stock status filter OK, LOW, OUT, CHECK | calculated from stock; not a lookup | 5 |
| `app/src/App.tsx` | 878 | Supplier payments are saved as method `Transfer` | `lookup_items` type `payment-method` | 5 |
| `app/src/App.tsx` | 881 | Customer payments are saved as method `Cash` | `lookup_items` type `payment-method` | 5 |
| `app/src/App.tsx` | 897 | Currency field defaults to `EUR`; any text is accepted | `currencies` | 5 |
| `app/src/App.tsx` | 922 | Expenses are always currency `EUR` at rate 1 | `currencies` | 5 |
| `app/src/App.tsx` | 979 | New-user role list is Salesperson, Manager, Partner, Viewer | `roles` / `GET /api/roles` | 5 |
| `app/src/App.tsx` | 137 | “Invoice overdue” mute is stored in `localStorage` `hak.notify.{userId}` | `notification_preferences` | 5 |
| `app/src/shared/payments.ts` | 3 | Overdue threshold is 30 days | `settings` key `overdue_days` | 5 |
| `app/src/data/ledger.ts` | 63 | Default low-stock level is 10 when a product has none | `settings` key `default_alert_level` | 5 |
| `app/src/shared/calc.ts` | 253 | `goldenLedger()` is the full golden dataset in the client | `GoldenSeeder` / `POST /api/sync/sample` after seed | 3 |
| `app/src/data/ledger.ts` | 122 | `goldenTables()` is the same dataset used by Load sample | `GoldenSeeder` | 3 |
| `app/src/shared/trackerImport.ts` | 176 | `goldenTrackerWorkbook()` rebuilds that dataset as Excel | `GoldenSeeder` plus the Excel import | 3 |
| `app/src/sales/invoicePdf.tsx` | 35 | Invoice brand is the text “HAK Wholesales” | `settings` company profile | 5 |
| `app/src/sales/invoicePdf.tsx` | 47 | Footer fallback “Internal invoice. Not a certified tax document.” | `templates` type `invoice` | 5 |
| `app/src/reports/statementPdf.tsx` | 19 | Statement brand is the text “HAK Wholesales” | `settings` company profile | 5 |
| `app/src/reports/statementPdf.tsx` | 28 | Statement footer is fixed in the component | `templates` type `statement` | 5 |
| `app/src/admin/SettingsScreen.tsx` | 10 | Footer box starts with that same sentence before a row exists | `templates` / `settings` | 5 |
| `api/database/seeders/DatabaseSeeder.php` | 57 | Products C1, CH1, C2, CB1, SP1 with categories and colours | `products`; categories and colours belong in `lookup_items` | 3 |
| `api/database/seeders/DatabaseSeeder.php` | 68 | Customers Shop A, Shop B, Loja Central | `customers` via `GoldenSeeder` / `DemoSeeder` | 3 |
| `api/database/seeders/DatabaseSeeder.php` | 72 | Suppliers Shenzhen Co, Lahore Traders | `suppliers` | 3 |
| `api/database/seeders/DatabaseSeeder.php` | 76 | Settings values for alert level, overdue days, categories, colours, currencies | `settings`, `lookup_items`, `currencies` via `LookupSeeder` | 3 |
| `api/app/Http/Controllers/Api/RecordController.php` | 89 | `GET /api/dashboard` returns `{status: ok}` | dashboard aggregate from the ledgers | 4 |
| `api/app/Http/Controllers/Api/RecordController.php` | 94 | `GET /api/dashboard/profit` returns `{status: ok}` | same ledger calculation, permission `dashboard.view_profit` | 4 |
| `api/app/Http/Controllers/Api/RecordController.php` | 99 | `GET /api/reports` returns `{status: ok}` | report queries over the ledgers | 4 |
| `app/src/pages/DashboardPage.tsx` | 45 | Unused page still passes `defaultAlert: 10` | `settings` | 5 |
| `app/src/pages/ProductsPage.tsx` | 41 | Unused page saves every product as category `Cases` | `lookup_items` type `category` | 5 |
| `app/src/pages/RecordsPage.tsx` | 38 | Unused page saves every expense as €20 | `expenses` entered by the user | 5 |
| `app/src/pages/LoginPage.tsx` | 57 | Unused TailAdmin-style login still says “HAK Wholesales” | remove with the unused pages | 5 |
| `app/src/pages/Shell.tsx` | 19 | Unused shell, same brand text | remove with the unused pages | 5 |

`DemoSeeder` also inserts a short fixed set (Haseeb, Sales Desk, three partners, one sale). The audit rule allows fixed rows inside `DemoSeeder` and `GoldenSeeder`. Prompt 3 replaces that seeder with the full dummy set. There is no `GoldenSeeder` yet.

No JSON or CSV file is imported by the UI. No TailAdmin eCommerce metrics, country map, or demo-user array is rendered by `App.tsx`.

## Count per module

| Module | Open items |
| --- | --- |
| CRM (pipeline, activities, follow-ups) | 4 |
| Dashboard and reports | 4 |
| Payments, expenses, currencies | 4 |
| Settings and company documents | 6 |
| Products and stock defaults | 3 |
| Users and roles | 1 |
| Notifications | 1 |
| Seed data (`DatabaseSeeder`, client golden sample) | 6 |
| Unused `app/src/pages` screens | 5 |
| **Total** | **34** |
