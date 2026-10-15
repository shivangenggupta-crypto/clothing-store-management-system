begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('manager', 'sales_staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text unique,
  size text not null,
  color text not null,
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  cost_price numeric(12, 2) check (cost_price >= 0),
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique,
  payment_method text not null
    check (payment_method in ('cash', 'card', 'upi', 'other')),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'completed'
    check (status in ('completed', 'voided')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  size_snapshot text not null,
  color_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2)
    generated always as (quantity * unit_price) stored,
  unique (sale_id, variant_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  movement_type text not null
    check (movement_type in ('opening', 'restock', 'sale', 'adjustment')),
  quantity_change integer not null check (quantity_change <> 0),
  sale_item_id uuid unique references public.sale_items(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (movement_type = 'sale' and quantity_change < 0 and sale_item_id is not null)
    or (movement_type in ('opening', 'restock') and quantity_change > 0)
    or movement_type = 'adjustment'
  )
);

create function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_quantity integer;
begin
  select quantity_on_hand
  into current_quantity
  from public.product_variants
  where id = new.variant_id
  for update;

  if not found then
    raise exception 'Product variant does not exist';
  end if;

  if current_quantity + new.quantity_change < 0 then
    raise exception 'Insufficient stock for this inventory movement';
  end if;

  update public.product_variants
  set quantity_on_hand = current_quantity + new.quantity_change,
      updated_at = pg_catalog.now()
  where id = new.variant_id;

  return new;
end;
$$;

create trigger inventory_movement_updates_stock
before insert on public.inventory_movements
for each row execute function public.apply_inventory_movement();

create function public.prevent_inventory_movement_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Inventory movements are append-only and cannot be changed or deleted';
end;
$$;

create trigger inventory_movements_are_append_only
before update or delete on public.inventory_movements
for each row execute function public.prevent_inventory_movement_change();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;

commit;