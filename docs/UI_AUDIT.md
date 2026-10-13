# UI audit — what is hard to understand

Checked the live shell at `http://127.0.0.1:5173/admin/users` while signed in as Haseeb. The screenshot showed the notices panel and the account menu open at the same time, drawn on top of each other.

## Fixed

| Screen | Problem | Change |
| --- | --- | --- |
| Header | The bell and the name menu both stayed open and covered each other. | Opening one closes the other. A click outside closes both. |
| Header | The bell list had no title, and the checkbox “Invoice overdue” did not say whether a tick shows or hides those invoices. | The panel is titled Notices. The checkbox reads “Show overdue invoices”. |
| Header | The search box said “Search or type command...” and showed ⌘K, but it only filters the sidebar. | The box now says “Filter menu”. |
| Users | Name, email, and role had no labels. The role box only showed the word Salesperson, so it looked like a name. | Each field has a label: Name, Email, Role. |
| Users | The list showed a name and an email, with no role, so a clerk and a partner looked the same. | Each row shows the role, for example Super Admin. |
| Products, customers, suppliers, sales, purchases, payments, expenses, transfers, activity | Several boxes only had placeholder text, so an empty box did not say what it was for. | Each field has a label above it. Placeholders stay, so existing tests that type into “Name” or “Selling price” still find the box. The product category box is labelled “Product category” so it stays separate from the category filter. |
| Dashboard | The chart was one bar called Sample, which is not a month. | The chart is titled “Sales by month” and groups real sale dates. With no sales it says “No sales yet”. |

Playwright covers the header and users in `app/e2e/shell.spec.ts`, and the form labels in the same file.

## Still hard to understand

These match the larger design notes in `docs/MODULES.md`. They are a separate pass from the labels.

| Screen | Problem |
| --- | --- |
| Every list | Rows are a plain list. There is no table, no row menu, and no archive or restore. |
| Settings | One footer box. Categories, colours, and payment methods cannot be edited. |
| Whole app | No + New menu, no Ctrl+K command bar, no drawers, and no undo after a save. |
| Money | Amounts show as €605.00. The module notes ask for the Portuguese form € 1.234,56. The current tests require €605.00, so the format stays as it is. |
