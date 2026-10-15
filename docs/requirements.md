# Clothing Store Management System — Requirements (Version 1)

This document describes what the **first version** of the Clothing Store Management System should do. It is a planning document only. It does **not** mean a database, app, or hosting environment has been created.

**Audience:** store staff (not customers).  
**Scope of operations:** one physical clothing store.  
**Planned stack (from project goals):** React, TypeScript, Vite, Tailwind CSS, Supabase/Postgres, Python with scikit-learn for later sales forecasting.  
**Cost constraint:** free tiers only (for example Supabase free plan and Vercel Hobby). **No paid AI APIs.**

---

## 1. Product vision (first version)

Staff should be able to:

1. Keep a catalogue of clothing products and their **size/colour** variants.
2. Know how much stock is on hand for each variant.
3. Record who supplies stock (simple supplier list).
4. Record walk-in sales at the counter.
5. See **basic** sales reports (what sold, how much money, over a date range).

A **sales forecasting** feature is part of the longer-term product, not a first-version staff workflow. Version 1 should still **collect clean historical sales data** so forecasting can be added later with Python and scikit-learn on free tooling.

---

## 2. Assumptions that need your review

Please confirm or change these before implementation. They are **not** locked in.

| ID | Assumption | Why it matters |
| --- | --- | --- |
| A1 | There is **one store** only. No branches, warehouses, or stock transfers between locations. | Keeps inventory simple: one quantity per variant. |
| A2 | Users are **store staff**, not shoppers. There is no public shop website in version 1. | No customer accounts or online checkout. |
| A3 | Two staff roles are enough: **Manager** and **Sales staff**. | Fewer screens and simpler permissions. |
| A4 | Each product can have many **variants**. A variant is one **size** + one **colour** of that product (for example “Blue / M”). | Matches how clothing is usually stocked. |
| A5 | Version 1 tracks **on-hand quantity** per variant, not bins, racks, or hanging vs folded storage. | Avoids warehouse complexity. |
| A6 | Currency is **INR**, shown as rupees. Amounts are stored with two decimal places. | Affects all money columns and reports. |
| A7 | Sizes and colours are **free text** on each variant (for example `S`, `M`, `32`, `Navy`), not a separate size/colour lookup table. | Easier for a first version; you can standardise later if spellings get messy. |
| A8 | Stock can go to **zero**. Selling more than on-hand stock is **blocked** unless a Manager override is added later (not in v1). | Prevents silent negative stock. |
| A9 | Version 1 sales are **completed at the till**. No holds, quotes, or unpaid invoices. | One sale = one completed transaction. |
| A10 | **Returns, exchanges, discounts, tax, and GST invoices** are out of scope for version 1. | Keeps sales recording simple. |
| A11 | Authentication will use **Supabase Auth** (email/password for staff). | Free-tier friendly; no custom auth server. |
| A12 | Forecasting in a later version will use **historical `sale_items`**, run **offline or on a simple script** with scikit-learn, and will **not** call paid AI APIs. | Matches the cost and stack constraints. |

If any of A1–A12 is wrong, the database design in `docs/database-schema.md` should be updated before coding.

---

## 3. User roles

### 3.1 Manager

Typical person: store owner or shift manager.

Can:

- Create, edit, and archive **categories**, **products**, and **variants**.
- Manage the **supplier** list.
- Record **stock in** (purchases/receipts) and other inventory adjustments (damage, found stock, count correction).
- Record **sales** (same as sales staff).
- View **inventory** and **sales reports**.
- Invite or disable staff logins (**Assumption A3 / A11** — exact invite process to be decided later).

Cannot (version 1):

- Change completed sales history except through a future “void sale” feature (out of scope). Inventory and sale rows are kept as history.

### 3.2 Sales staff

Typical person: cashier / floor staff.

Can:

- Search products and see **variant stock and selling price**.
- Record a **sale** (select variants, quantities, complete the sale).
- View **today’s sales** they need for the counter (at minimum: confirmation after a sale).

Cannot:

- Change product catalogue, prices, or suppliers.
- Record supplier deliveries or stock adjustments.
- View full historical reports (Manager only).  
  **Assumption (needs review):** sales staff might still see “today’s till total.” Default for v1: **today’s own sales list only**, not store-wide profit reports.

### 3.3 Who is not a user in version 1

- Customers / public shoppers  
- Suppliers logging in  
- Accountants with a separate portal  
- Multi-store regional managers  

---

## 4. First-version features

### 4.1 Product and variant management

**Category**

- Staff (Manager) can add categories such as T-Shirts, Jeans, Dresses, Accessories.
- A product belongs to **one** category.  
  **Assumption (needs review):** products are not in multiple categories.

**Product**

- Name (required), optional description, optional brand.
- A product is the “parent” item (for example “Classic Crew Neck Tee”). It is **not** sold by itself; staff sell **variants**.

**Variant (size and colour)**

- Each variant has:
  - Size (required)
  - Colour (required)
  - Optional SKU / barcode-like code (typed by staff; no hardware scanner required in v1)
  - Current selling price
  - Optional cost price (what the store paid), Manager-only
  - Current on-hand quantity (updated by inventory movements and sales — see schema doc)
- Two variants of the same product should not share the same size **and** colour.  
  Example: you may have Blue/M and Blue/L, but not two Blue/M rows.

**Archive vs delete**

- Prefer **archive** (hide from new sales) so old sale lines still make sense.  
  **Assumption (needs review):** hard-delete is Manager-only and blocked if the variant was ever sold.

### 4.2 Inventory tracking

Version 1 tracks **how many units of each variant are in the store**.

Staff need to:

- See a list of variants with **low stock**.  
  **Assumption (needs review):** “low stock” means quantity at or below a **reorder level** stored on the variant (default 2). If you prefer a single store-wide number, say so.
- Record **stock received** from a supplier (quantity added).
- Record **adjustments** when stock is damaged, lost, or found during a count.

Every stock change should leave a **history row** (see `inventory_movements` in the schema). The screen can show “current stock”; the database should not rely on editing history.

Sales **reduce** stock when a sale is completed.

### 4.3 Suppliers

A simple address book for people/companies who supply stock:

- Name (required)
- Optional phone, email, notes, city

When receiving stock, Manager can **optionally** link the movement to a supplier.

Version 1 does **not** include purchase orders, supplier invoices, or automatic reordering.

### 4.4 Sales recording

At the counter, sales staff or Manager:

1. Search by product name, colour, size, or SKU.
2. Add one or more variants and quantities to a sale.
3. See line totals and a sale total (quantity × **current** selling price).
4. Confirm the sale.

On confirm:

- A **sale** header is stored (when, who recorded it, payment method, total).
- Each line is stored with **quantity and unit price at that moment** (so later price changes do not rewrite old receipts).
- Stock for those variants decreases.

**Payment method (v1):** cash, UPI, card — stored as a label only. No payment gateway.

**Assumption (needs review):** one payment method per sale; no split payments.

### 4.5 Basic sales reports (Manager)

Version 1 reports should answer:

- **Sales over a date range:** count of sales, units sold, revenue.
- **By day:** a simple daily total (table is enough; charts optional).
- **By product / variant:** which items sold most (units and revenue).
- **By category:** optional if easy once products have categories.

Reports use **stored sale line prices**, not today’s catalogue prices.

Version 1 does **not** need profit dashboards, staff commission, or comparison to forecasts.

### 4.6 Future sales forecasting (not a v1 staff feature)

**Goal (later version):** estimate future units sold (for example next week or next month) from **this store’s past sales**, to help the Manager buy stock.

**Constraints:**

- Use **Python and scikit-learn** (or similar free libraries).
- **No paid AI APIs** (no ChatGPT/Gemini paid keys, no paid forecasting SaaS).
- Stay on **free tiers** for hosting and database.

**Version 1 responsibility:**

- Record complete sale lines (variant, quantity, date, unit price).
- Do **not** build the forecast UI, training pipeline, or model in version 1.

**Later (out of v1 build, in scope of the overall product):**

- Export or read historical sales.
- Train a simple model (for example time-based or product-level regression).
- Show a Manager-only forecast with a clear label that it is an **estimate**.

---

## 5. Key user workflows (version 1)

### Workflow 1 — Add a new clothing item (Manager)

1. Log in as Manager.
2. Ensure a category exists (or create one).
3. Create the product (name, category, optional brand/description).
4. Add variants (each size/colour, selling price, optional cost, optional SKU, opening stock).
5. If opening stock is greater than zero, the system records an inventory movement such as `opening_stock` or `adjustment_in`.

### Workflow 2 — Receive stock from a supplier (Manager)

1. Open receive-stock (or inventory) screen.
2. Choose variant (or product then size/colour).
3. Enter quantity received.
4. Optionally choose supplier and a note (invoice number in the note field is enough for v1).
5. Save. On-hand quantity increases. A movement row is stored.

### Workflow 3 — Sell items at the counter (Sales staff or Manager)

1. Log in.
2. Start a new sale.
3. Add variants and quantities. System shows price and remaining stock.
4. Choose payment method. Confirm.
5. System saves the sale, saves line prices, reduces stock. Staff see a simple confirmation (sale number / time / total).

### Workflow 4 — Correct stock after a count (Manager)

1. Compare physical count to on-hand quantity.
2. Enter an adjustment (up or down) with a short reason.
3. On-hand quantity updates. History keeps the previous movements.

### Workflow 5 — Review performance (Manager)

1. Open reports.
2. Pick a from/to date.
3. See totals and top-selling variants/products.

### Workflow 6 — Forecasting (future, not v1)

1. Manager opens a forecast page (later).
2. System uses stored sales history and a local scikit-learn model.
3. Manager sees estimated demand. This workflow is **documented only** for version 1.

---

## 6. Data the first version must keep

These are the business records version 1 depends on (table names in `docs/database-schema.md`):

- Categories  
- Products  
- Product variants (size, colour, prices, quantity)  
- Suppliers  
- Inventory movements (stock history)  
- Sales and sale items (including **price at time of sale**)

Staff users live in **Supabase Auth**. Linking `created_by` to a login is described in the schema notes.

---

## 7. Explicitly out of scope for version 1

Do **not** build these in the first version:

| Area | Out of scope |
| --- | --- |
| Selling | Customer-facing e-commerce, carts, online payments, gift cards |
| Locations | Multiple stores, warehouses, transfers, “in transit” |
| Customers | Customer accounts, loyalty, stored customer phone book |
| Pricing | Promotions, coupons, automatic discounts, tax/GST breakup, multi-currency |
| After-sale | Returns, exchanges, refunds, void/edit completed sales |
| Purchasing | Purchase orders, supplier bills, partial receipts against POs |
| Inventory extras | Serial numbers, unique tags per garment, batch/expiry, barcode hardware |
| People | HR, payroll, staff roster, commission |
| Accounting | Tally/GST filing export, bank reconciliation |
| Forecasting UI | Training jobs, charts of predicted vs actual, paid AI |
| Platform | Native mobile apps, offline-first POS, receipt printers (nice later) |
| Cost | Any paid API or paid cloud add-on required to run the app |

These can be considered after version 1 if the core catalogue, stock, sales, and reports work.

---

## 8. Non-functional requirements (first version)

- **Beginner-friendly design:** few screens, plain language, no extra microservices.
- **Free tiers:** design so a small store’s data fits a free Postgres/Supabase project; no requirement for paid AI.
- **Single-store security:** only logged-in staff; Managers vs sales staff as in section 3.  
  Database **access policies will be designed before deployment** (see schema document). This requirements file does not claim policies are already in place.
- **History:** do not silently overwrite old sale prices or delete inventory history when stock changes.
- **Deployment:** planned later (for example Vercel Hobby + Supabase free). This document does not deploy anything.

---

## 9. Success criteria for version 1

Version 1 is successful if a Manager can set up products with size/colour variants, receive stock, and a staff member can record a sale that:

- reduces the correct variant’s quantity,
- stores the prices charged that day,
- appears on a date-range sales report,

and the project still has a clear path to **later** scikit-learn forecasting **without** paid AI APIs.

---

## 10. What this document is not

- It is **not** an implemented product, database, or live system.
- It does **not** replace `docs/database-schema.md` (proposed tables).
- Implementation should wait until you review the **assumptions** in section 2.
