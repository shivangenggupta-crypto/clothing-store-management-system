# Clothing Store Management System — Proposed Database Schema

This document is a **design proposal** for Postgres (Supabase). It is written for version 1 of a **single-store, staff-only** app.

It does **not** mean a database has been created, migrated, or deployed. No tables have been applied to a live Supabase project as part of this document.

**Related document:** `docs/requirements.md` (features, roles, out of scope).

**Planned stack:** React / TypeScript / Vite / Tailwind CSS talking to Supabase (Postgres). Forecasting later uses Python and scikit-learn on sales history. **Free tiers only; no paid AI APIs.**

---

## 1. Design principles (keep it simple)

1. **One store** — no `stores` table.
2. **Sell variants, not parent products** — a T-shirt in Blue/M is a `product_variants` row.
3. **Current stock** lives on the variant for easy screens; **every change** is also stored in `inventory_movements`.
4. **Sale prices are copied onto `sale_items`** so later price edits do not change history.
5. **Prefer archive flags** over deleting rows that sales already reference.
6. Use **UUID** primary keys (normal for Supabase) and `timestamptz` for timestamps.
7. Staff identity lives in **`profiles`**, keyed to Supabase Auth. The `role` column is what later access policies will read.

---

## 2. Assumptions that need your review

| ID | Assumption | Impact if you change it |
| --- | --- | --- |
| S1 | Money is **INR**, type `numeric(12, 2)`. | Change precision if you want paise-only integers or another currency. |
| S2 | Size and colour are **text on the variant**, not lookup tables. | Lookup tables would be added if you want a fixed size chart. |
| S3 | `product_variants.quantity_on_hand` is the live stock number. Movements are the audit log. Application (or a database trigger, decided at implementation) must keep them in sync. | You could compute stock only from movements; that is harder for beginners. |
| S4 | Each Auth login has **one** `profiles` row. `id` is the same UUID as `auth.users.id`. `sales.created_by` and `inventory_movements.created_by` **FK** to `profiles.id`. | If you skip `profiles`, roles cannot be stored in Postgres for later RLS. |
| S5 | Supplier is **optional** on a stock-in movement. | Make it required if every receipt must name a supplier. |
| S6 | Completed sales are **not updated or deleted** in version 1. | Returns/voids would need extra tables later. |
| S7 | `sku` is unique **when present**; many variants may have no SKU. | Require SKU if you will print labels. |
| S8 | Categories cannot nest (no parent category). | Add `parent_id` only if you need “Men → T-Shirts”. |
| S9 | `profiles.role` is stored as **`manager`** or **`sales_staff`**. The app may show labels **Manager** and **Sales staff**. | Change the CHECK list if you want different codes. |

---

## 3. Table overview

```
auth.users  (Supabase Auth — not created by this app schema)
    └── profiles (role: manager | sales_staff)
            ├── inventory_movements.created_by
            └── sales.created_by

categories
    └── products
            └── product_variants
                    ├── inventory_movements ── (optional) suppliers
                    └── sale_items ── sales
```

- One **Auth user** has one **profile**.
- One **profile** may record many **sales** and many **inventory movements**.
- One **category** has many **products**.
- One **product** has many **variants**.
- One **variant** has many **inventory movements** and many **sale items**.
- One **sale** has many **sale items**.
- One **supplier** may appear on many **inventory movements**.

---

## 4. Tables

Conventions used below:

- **PK** = primary key  
- **FK** = foreign key  
- **Required** = `NOT NULL`  
- Default UUID: `gen_random_uuid()` (except `profiles.id`, which **is** the Auth user UUID)  
- Default time: `now()`

### 4.1 `profiles`

What it stores: one staff record per **Supabase Auth** login, including the person’s **role**. Auth itself (email, password, session) stays in Supabase’s `auth.users` table. This app schema only adds `public.profiles`.

The profile **primary key is the Auth user id** (not a second random UUID). That is the usual beginner-friendly Supabase pattern: `profiles.id` = `auth.users.id`.

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | | **PK**; **FK → `auth.users.id`**. Same value as the logged-in user. |
| `full_name` | `text` | yes | | Name shown in the app and on “who recorded this sale” |
| `role` | `text` | yes | | Stored values: **`manager`** or **`sales_staff`** only. Display labels: **Manager**, **Sales staff**. |
| `is_active` | `boolean` | yes | `true` | **`BOOLEAN NOT NULL DEFAULT TRUE`**. Inactive staff should not use the app once policies exist. |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

**Constraints**

- `PRIMARY KEY (id)`
- `FOREIGN KEY (id) REFERENCES auth.users(id)` **ON DELETE CASCADE**  
  If the Auth user is removed, the profile row goes with it.
- `role` **`NOT NULL`**
- `is_active` **`BOOLEAN NOT NULL DEFAULT TRUE`**
- `CHECK (role IN ('manager', 'sales_staff'))` — no other stored role values in version 1
- `CHECK (char_length(trim(full_name)) > 0)`

**Foreign keys:** `id` → `auth.users.id` only.

**Suggested index:** `role` (optional; useful later when listing managers vs sales staff).

**How a row is created (proposal only, not implemented)**

When a staff member is invited and gets an Auth account, a matching `profiles` row should be inserted with the same `id` and a `role`.  
**Assumption (needs review):** the first user is created with `role = 'manager'` by you (manual SQL or dashboard) so someone can then add other staff. Version 1 does not include a public sign-up form.

**How `role` will be used for access policies later**

This table is the **source of truth for role** (`manager` vs `sales_staff`) and whether the account is active (`is_active`). It does **not** replace access policies, and this document does **not** enable Row Level Security (RLS).

When policies are designed **before deployment**, they should:

1. Require a logged-in user: `auth.uid()` is not null.
2. Load that user’s profile: `profiles.id = auth.uid()`.
3. Read `profiles.role` (and `is_active`) to decide what the user may do.

Intended split (to match `docs/requirements.md`; exact SQL comes later):

| Stored `role` | Display label | Later policy intent (not implemented here) |
| --- | --- | --- |
| `manager` | Manager | Read/write categories, products, variants, suppliers, inventory movements, sales, and reports. May update other people’s `role` / `is_active` (details to review). |
| `sales_staff` | Sales staff | Read catalogue and stock needed at the till; **insert** sales (and the stock-out movements that belong to a sale). Must **not** change products, prices, suppliers, or non-sale inventory adjustments. Reports stay `manager`-only. |

Typical policy idea (wording only, not a live policy):

- “Allow insert on `sales` if the current user’s profile `role` is `manager` or `sales_staff` **and** `is_active` is `TRUE`.”
- “Allow insert/update on `products` only if the current user’s profile `role` is `manager` **and** `is_active` is `TRUE`.”
- “Allow a user to read their own `profiles` row; only `manager` may read or change other profiles.”  
  **Assumption (needs review):** `sales_staff` can see their own name/role only, not the full staff list.

`created_by` on sales and movements should equal `auth.uid()` so history can join to `profiles.full_name` and `profiles.role`. Policies should prevent forging `created_by` as another user.

Until those policies are written and reviewed, **do not** treat `role` or `is_active` as enforced security. The CHECK constraint only stops invalid role **strings**; `is_active` only stores a flag. Neither stops a `sales_staff` client from calling the API by itself.

---

### 4.2 `categories`

What it stores: named groups of products (T-Shirts, Jeans, etc.).

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | `gen_random_uuid()` | **PK** |
| `name` | `text` | yes | | Display name |
| `is_archived` | `boolean` | yes | `false` | Hidden from new product forms if true |
| `created_at` | `timestamptz` | yes | `now()` | |

**Constraints**

- `PRIMARY KEY (id)`
- `UNIQUE (name)` — avoid duplicate category names (case-sensitive in Postgres by default).  
  **Assumption (needs review):** unique names are enough; no separate code column.
- `CHECK (char_length(trim(name)) > 0)` — name not empty.

**Foreign keys:** none.

---

### 4.3 `products`

What it stores: the parent clothing item (style), not a sellable size/colour.

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | `gen_random_uuid()` | **PK** |
| `category_id` | `uuid` | yes | | **FK → `categories.id`** |
| `name` | `text` | yes | | Example: “Classic Crew Neck Tee” |
| `brand` | `text` | no | | Optional |
| `description` | `text` | no | | Optional |
| `is_archived` | `boolean` | yes | `false` | Archived products should not appear in new sales search |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | Application updates this on edit |

**Constraints**

- `PRIMARY KEY (id)`
- `FOREIGN KEY (category_id) REFERENCES categories(id)`  
  **On delete:** `RESTRICT` — do not delete a category that still has products.
- `CHECK (char_length(trim(name)) > 0)`

**Suggested index:** `category_id` (list products in a category).

---

### 4.4 `product_variants`

What it stores: one **size** + **colour** of a product, with live price and stock.

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | `gen_random_uuid()` | **PK** |
| `product_id` | `uuid` | yes | | **FK → `products.id`** |
| `size` | `text` | yes | | Example: `M`, `32`, `Free` |
| `colour` | `text` | yes | | Example: `Navy` |
| `sku` | `text` | no | | Staff-typed code; unique if set |
| `selling_price` | `numeric(12, 2)` | yes | | Current price for **new** sales |
| `cost_price` | `numeric(12, 2)` | no | | Optional; Manager-only in the app |
| `quantity_on_hand` | `integer` | yes | `0` | Live stock for this variant |
| `reorder_level` | `integer` | yes | `2` | Used for “low stock” lists |
| `is_archived` | `boolean` | yes | `false` | Hide from new sales if true |
| `created_at` | `timestamptz` | yes | `now()` | |
| `updated_at` | `timestamptz` | yes | `now()` | |

**Constraints**

- `PRIMARY KEY (id)`
- `FOREIGN KEY (product_id) REFERENCES products(id)` **ON DELETE RESTRICT**
- `UNIQUE (product_id, size, colour)` — one Blue/M per product
- `UNIQUE (sku)` **only for non-null sku** — in Postgres: unique index on `sku` `WHERE sku IS NOT NULL`
- `CHECK (char_length(trim(size)) > 0)`
- `CHECK (char_length(trim(colour)) > 0)`
- `CHECK (selling_price >= 0)`
- `CHECK (cost_price IS NULL OR cost_price >= 0)`
- `CHECK (quantity_on_hand >= 0)` — no negative stock in version 1
- `CHECK (reorder_level >= 0)`

**Suggested indexes:** `product_id`; optional `sku` (already unique when present).

**Note:** Changing `selling_price` here must **not** rewrite old `sale_items.unit_price`.

---

### 4.5 `suppliers`

What it stores: people or companies that supply stock.

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | `gen_random_uuid()` | **PK** |
| `name` | `text` | yes | | |
| `phone` | `text` | no | | |
| `email` | `text` | no | | Not validated beyond optional app checks |
| `city` | `text` | no | | Optional |
| `notes` | `text` | no | | Free text (address, GSTIN, etc. if you type them) |
| `is_archived` | `boolean` | yes | `false` | |
| `created_at` | `timestamptz` | yes | `now()` | |

**Constraints**

- `PRIMARY KEY (id)`
- `CHECK (char_length(trim(name)) > 0)`
- **Assumption (needs review):** supplier names are **not** unique (two “Raj Traders” in different cities could exist). Add `UNIQUE (name)` if you want.

**Foreign keys:** none.

---

### 4.6 `inventory_movements`

What it stores: a **permanent history** of stock going in or out. Do not update these rows except to fix a documented mistake (version 1: treat as **append-only**).

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | `gen_random_uuid()` | **PK** |
| `variant_id` | `uuid` | yes | | **FK → `product_variants.id`** |
| `supplier_id` | `uuid` | no | | **FK → `suppliers.id`**; used for stock received |
| `sale_id` | `uuid` | no | | **FK → `sales.id`**; set when movement is caused by a sale |
| `movement_type` | `text` | yes | | See allowed values below |
| `quantity_change` | `integer` | yes | | **Signed:** +10 receive, −2 sale. Never zero. |
| `unit_cost` | `numeric(12, 2)` | no | | Optional cost on that receipt |
| `reason` | `text` | no | | Damage, count correction, invoice note |
| `created_by` | `uuid` | no | | **FK → `profiles.id`** (Auth user who recorded it) |
| `created_at` | `timestamptz` | yes | `now()` | When the change happened |

**Allowed `movement_type` values (CHECK list)**

| Value | Typical `quantity_change` | When |
| --- | --- | --- |
| `opening_stock` | positive | First quantity when creating a variant |
| `stock_in` | positive | Received from a supplier or extra stock |
| `sale` | negative | Units sold (linked with `sale_id`) |
| `adjustment_in` | positive | Count found extra units |
| `adjustment_out` | negative | Damage, loss, count short |

**Constraints**

- `PRIMARY KEY (id)`
- `FOREIGN KEY (variant_id) REFERENCES product_variants(id)` **ON DELETE RESTRICT**
- `FOREIGN KEY (supplier_id) REFERENCES suppliers(id)` **ON DELETE SET NULL**  
  (keep the movement if a supplier is archived/removed)
- `FOREIGN KEY (sale_id) REFERENCES sales(id)` **ON DELETE RESTRICT**
- `FOREIGN KEY (created_by) REFERENCES profiles(id)` **ON DELETE SET NULL**
- `CHECK (movement_type IN ('opening_stock', 'stock_in', 'sale', 'adjustment_in', 'adjustment_out'))`
- `CHECK (quantity_change <> 0)`
- `CHECK (movement_type IN ('stock_in', 'opening_stock', 'adjustment_in') OR supplier_id IS NULL)`  
  — optional: only inbound types may set a supplier. **Assumption (needs review):** you may allow supplier on any type; if so, drop this check.
- `CHECK (unit_cost IS NULL OR unit_cost >= 0)`

**Suggested indexes:** `variant_id`, `created_at`, `sale_id`.

**How this preserves inventory history**

- Current stock on the variant is a **running total**.
- Each receive, sale, and adjustment **adds a new row** instead of editing an old one.
- You can later list “all changes for Blue/M” in date order.
- You should **not** overwrite `quantity_change` on old rows to “fix” stock; add a new `adjustment_*` row.

**Keeping `quantity_on_hand` aligned (implementation later)**

When recording a movement, in one transaction:

1. Insert `inventory_movements`.
2. Update `product_variants.quantity_on_hand = quantity_on_hand + quantity_change`.
3. Fail if the result would be negative (matches requirements: no overselling in v1).

This document does not implement that transaction.

---

### 4.7 `sales`

What it stores: one completed till transaction (header). Line details are in `sale_items`.

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | `gen_random_uuid()` | **PK** |
| `sold_at` | `timestamptz` | yes | `now()` | Business time of the sale |
| `payment_method` | `text` | yes | | `cash`, `upi`, or `card` |
| `total_amount` | `numeric(12, 2)` | yes | | Sum of line totals; stored for easy reports |
| `notes` | `text` | no | | Optional |
| `created_by` | `uuid` | no | | **FK → `profiles.id`** |
| `created_at` | `timestamptz` | yes | `now()` | Row insert time (usually same as `sold_at`) |

**Constraints**

- `PRIMARY KEY (id)`
- `CHECK (payment_method IN ('cash', 'upi', 'card'))`
- `CHECK (total_amount >= 0)`

**Foreign keys**

- `FOREIGN KEY (created_by) REFERENCES profiles(id)` **ON DELETE SET NULL**  
  (`profiles.id` is already the Auth user UUID.)

**Suggested index:** `sold_at` (date-range reports).

---

### 4.8 `sale_items`

What it stores: each variant on a sale, with **quantity and unit price at the time of sale**.

| Column | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | yes | `gen_random_uuid()` | **PK** |
| `sale_id` | `uuid` | yes | | **FK → `sales.id`** |
| `variant_id` | `uuid` | yes | | **FK → `product_variants.id`** |
| `quantity` | `integer` | yes | | Units sold on this line |
| `unit_price` | `numeric(12, 2)` | yes | | **Copied** from variant selling price when the sale is saved |
| `line_total` | `numeric(12, 2)` | yes | | `quantity * unit_price` (stored to make reports simple) |

**Constraints**

- `PRIMARY KEY (id)`
- `FOREIGN KEY (sale_id) REFERENCES sales(id)` **ON DELETE RESTRICT**  
  (do not delete a sale that has items; version 1 does not delete sales)
- `FOREIGN KEY (variant_id) REFERENCES product_variants(id)` **ON DELETE RESTRICT**  
  (keep the variant row forever once it has been sold)
- `CHECK (quantity > 0)`
- `CHECK (unit_price >= 0)`
- `CHECK (line_total = quantity * unit_price)`  
  (Postgres `numeric` should match if the app calculates the same way)

**Suggested indexes:** `sale_id`, `variant_id`.

**How this preserves historical sale prices**

- At confirm time, the app reads `product_variants.selling_price` and **writes that number into `sale_items.unit_price`**.
- Reports sum `sale_items.line_total` (or `quantity * unit_price`).
- If a Manager later changes the variant price from ₹799 to ₹699, **old receipts still show ₹799**.
- Cost at sale time is **not** snapshotted in version 1.  
  **Assumption (needs review):** if you want historical profit, add `unit_cost_at_sale` later.

The same sale should also insert `inventory_movements` with `movement_type = 'sale'`, `quantity_change = -quantity`, and `sale_id` set.

---

## 5. Relationship summary

| From | To | Type | Rule |
| --- | --- | --- | --- |
| `profiles.id` | `auth.users.id` | one profile → one Auth user | Required; same UUID |
| `inventory_movements.created_by` | `profiles.id` | many movements → one staff profile | Optional |
| `sales.created_by` | `profiles.id` | many sales → one staff profile | Optional |
| `products.category_id` | `categories.id` | many products → one category | Required |
| `product_variants.product_id` | `products.id` | many variants → one product | Required |
| `inventory_movements.variant_id` | `product_variants.id` | many movements → one variant | Required |
| `inventory_movements.supplier_id` | `suppliers.id` | many movements → one supplier | Optional |
| `inventory_movements.sale_id` | `sales.id` | movements for a sale | Optional; set for `sale` type |
| `sale_items.sale_id` | `sales.id` | many items → one sale | Required |
| `sale_items.variant_id` | `product_variants.id` | many items → one variant | Required |

There is **no** direct product → sale link. Sales always go through variants.

`created_by` is optional so a sale or movement can remain if the linked profile row is removed (`ON DELETE SET NULL`). Deactivating staff should normally use `profiles.is_active = false` instead of deleting the row. **Assumption (needs review):** you may make `created_by` required in version 1.

---

## 6. What is intentionally omitted

To stay beginner-friendly, version 1 has **no** tables for:

- Stores / locations  
- Customers  
- Purchase orders  
- Returns  
- Discounts / tax lines  
- Size or colour lookup  
- Forecast results (add later when the Python model exists)
- Extra stored roles beyond `manager` and `sales_staff`

---

## 7. Access policies (before deployment)

**Database access policies (including Supabase Row Level Security) will be designed before deployment.**

This schema proposal does **not** define the final policy rules, does **not** enable RLS, and does **not** grant production access.

Policies should use **`profiles.role`** and **`profiles.is_active`** for the current user (`profiles.id = auth.uid()`), as described in section 4.1. Compare stored codes (`manager`, `sales_staff`), not display labels. At a high level they should match `docs/requirements.md`:

- Only authenticated staff with `is_active = TRUE` can read/write business data.
- `role = 'manager'` can manage catalogue, suppliers, and inventory movements, and can view reports.
- `role = 'sales_staff'` can create sales and read stock/prices needed at the till.
- Historical `sales`, `sale_items`, and `inventory_movements` should not be freely rewritten.
- Users must not change their own `role` to `'manager'`.
- Inactive profiles (`is_active = FALSE`) should be denied even if `role` is still `'manager'`.

Until policies are designed and reviewed, do not treat this document as a ready-to-host system.

---

## 8. Mapping to later forecasting

Forecasting (future) can read:

- `sale_items.quantity`
- `sales.sold_at`
- `sale_items.variant_id` (and join to `products` / `categories`)

No extra “AI” tables and **no paid AI APIs** are required for this design. A later Python/scikit-learn script would query this history (or a CSV export). Version 1 only needs to **record** the history cleanly.

---

## 9. Status of this document

| This document does | This document does not |
| --- | --- |
| Propose tables, columns, keys, and constraints | Create a Supabase project |
| Explain how price and stock history are kept | Run SQL migrations |
| Flag assumptions for your review | Deploy the app or open public access |

After you confirm or change the assumptions in section 2 (and in `docs/requirements.md`), implementation can add SQL migrations. That work is a later milestone.
