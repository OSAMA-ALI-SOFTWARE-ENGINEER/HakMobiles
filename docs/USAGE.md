# Using HAK Wholesales Tracker

This is the day-to-day guide for the people who buy, sell, and check the books. Stock, what a shop owes, what HAK owes a supplier, and profit are worked out from the purchases, sales, payments, and adjustments. They are not typed in as a balance.

Money is shown in the Portuguese style: `€ 1.234,56`. A negative amount is `-€ 130,00`.

## Sign in

Open the app and sign in with the email and password an admin gave you.

| Person | Email | Starts as |
| --- | --- | --- |
| Haseeb | haseeb@hak.test | Super Admin |
| Dr. Waseem | waseem@hak.test | Partner |
| Umar | umar@hak.test | Partner |
| Sales desk | seller@hak.test | Salesperson |

The first three share the password `ChangeMe123!`. The sales desk password is `password1234`. Change these before the books are used by anyone outside the office.

A salesperson can sell and take shop payments. A salesperson does not see profit, cost, or partner balances. Partners and the super admin do.

The status line at the top should say Synced. If it says Needs attention, the change did not reach the server. Stay online and let it try again before you close the laptop.

On a phone the menu is the bar at the bottom: Dashboard, Sales, New, Customers, and More. Search sits on its own row at the top.

## A normal day

1. Open **Dashboard** and read the alerts. Low stock, overdue invoices, and follow-ups due today are listed there.
2. Record what you sold in **Sales**.
3. Record money that came in, or money paid to a supplier, in **Payments**.
4. If you bought stock, record it in **Purchases** before you expect the quantity to rise.
5. Glance at **Follow-ups** before you leave.

**New** in the header starts a sale, payment, customer, product, purchase, expense, or follow-up from any screen.

The search box finds a product, a shop, or an invoice. On a shop result you can start a sale for that shop.

## Dashboard

Pick the period at the top: today, this week, this month, last month, this quarter, this year, the last 12 months, or a custom range.

The cards are sales, profit, margin, cash, what customers owe, what HAK owes suppliers, and the value of stock. **Customers owe** opens the customer list limited to shops that still owe money.

Under the cards:

- **Alerts** can be marked read. A read alert comes back the next day if it is still true.
- **Partners** shows who should pay whom. **Record** opens a transfer with the amount filled in.
- Stock that is low has a **Reorder** link. It opens a purchase for that product.
- Recent invoices show Paid, Part-paid, or Unpaid.

## Customers, pipeline, and follow-ups

**Customers** is the shop list. Open a shop for its page: sales, payments, statement, special prices, and notes.

A shop needs a name. Phone, WhatsApp, NIF, address, postcode, city, shop type, tags, payment terms, and notes are optional. A NIF must be a valid Portuguese NIF. Two shops cannot share one NIF.

**Special prices** on a shop are used automatically the next time you sell that product to that shop.

**Pipeline** is the board from lead to active. You can add a shop with a name and a phone from a column. Dragging a card asks if you want a follow-up. A shop with no order for the number of days set in Settings (60 by default) moves to inactive. A lead that has never ordered is left alone.

**Follow-ups** are calls, visits, WhatsApp, payment reminders, deliveries, or anything else. You can snooze one to tomorrow or open WhatsApp for that shop. Opening this page creates one reminder for each overdue invoice that does not already have one.

**Calendar** shows the month. On a phone, a day with something booked shows a dot. Tap the day to read it. The heading stays the English month, for example October 2026.

## Products and purchases

**Products** lists the code, name, price, quantity, and status: OK, LOW, or OUT. Quantity is pieces on hand. If some are already on a purchase that has not been received, the cell also shows how many are on order.

Selling price is required and must be above zero. Cost is not typed on the product. It comes from purchases. The margin on the row is the selling price against the average cost.

**Count stock** saves the difference as an adjustment with the reason “count correction”. Adjustments stay in the list under the products. They are not deleted; they are archived.

**Purchases** is a delivery from a supplier. Each line is a product, a quantity, and a unit cost. You can also record the supplier’s invoice number and a shipping cost for the whole delivery. Choose the product, save, and the stock count includes that quantity.

A locked month refuses the save until a super admin unlocks that month in Settings.

## Sales and payments

**Sales** is one invoice. Choose the shop, add lines, and save. The invoice number is assigned for you and does not change later.

You can scan a barcode into **Scan barcode**. If that barcode is on a product, the line is filled in.

**Paid now** records a cash payment against this invoice at the same time. Anything above the invoice stays as credit on the shop.

The invoice on screen and the PDF use the logo, colour, and wording from Settings. The PDF is an internal invoice, not a certified tax document.

**Payments** has two kinds: money a shop paid HAK, and money HAK paid a supplier. Pick the method. A shop payment can be split across open invoices. What is left is shop credit.

## Expenses and partner transfers

**Expenses** is rent, freight, and the other costs in the expense list. Tick **Repeat monthly** to keep a template. Next month the Expenses page shows **Confirm** for that template, and confirming writes that month’s expense. Confirming twice in the same month does not write a second one.

**Transfers** moves money from one partner to another. Use it for the settle-up amounts on the dashboard.

## Reports and activity

**Reports** can show profit and loss, sales by product, customer, category, or month, best sellers, slow stock, suppliers, cash received by partner, expenses by category, and ageing. Statements download as a PDF with the same branding as the invoice.

**Activity** is the log of who changed what. Filter it by person or by a word in the search.

## Settings and admin

Settings is for a super admin.

- **Business** is the company name, NIF, address, phone, and email, plus the logo, brand colour, invoice heading, and footers.
- **Lists** are product categories, colours, payment methods, and expense categories. Remove a name with its Remove button. A name already in the list is refused.
- **Rules** are how many days until an invoice is overdue, how many quiet days mark a shop inactive, and which months are locked.
- **Replace data** loads the sample catalogue, imports a tracker workbook, or restores a backup. Each one asks you to confirm, because it replaces what is there. Only a super admin sees **Load sample data**.

**Admin** is the logins. You can change a role, reset a password, or deactivate someone. The last super admin cannot be deactivated.

Archive is the way to put a record away. The books do not hard-delete a sale, a product, a shop, or a payment. Archived rows can be restored. Emptying an archive is a separate purge, and it is logged.

## If the numbers look wrong

Check the period on the dashboard first. Then check whether a large expense or a freight cost is inside that period. Profit is sales, minus the cost of the goods sold, minus expenses. A big expense next to a small sale makes the margin look extreme. That is the formula, not a display error.

A figure on a phone that you cannot see in a table is further to the right. Scroll the table sideways. The rest of the page stays still.
