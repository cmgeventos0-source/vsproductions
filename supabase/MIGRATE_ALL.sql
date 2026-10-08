-- ============================================================
-- MIGRACION COMPLETA: Ejecutar en Supabase SQL Editor
-- Copia TODO este archivo y pega en: SQL Editor > New query > Run
-- ============================================================

-- 1. Columnas faltantes en orders
alter table public.orders
  add column if not exists receipt_url text,
  add column if not exists customer_phone text,
  add column if not exists customer_id_number text;

-- 2. Columna map_coords, preventa y sale_type en zones
alter table public.zones add column if not exists map_coords text;
alter table public.zones add column if not exists presale_price numeric;
alter table public.zones add column if not exists presale_end_at timestamptz;
alter table public.zones add column if not exists sale_type text default 'individual';

-- 3. Columna parent_id en zones (palcos subdivididos)
alter table public.zones add column if not exists parent_id uuid references public.zones on delete cascade;
create index if not exists zones_parent_idx on public.zones (parent_id);

-- 4. Bucket de comprobantes
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "Usuarios autenticados pueden subir comprobantes" on storage.objects;
drop policy if exists "Cualquiera puede ver comprobantes" on storage.objects;
drop policy if exists "Cualquiera puede subir comprobantes al bucket receipts" on storage.objects;

create policy "Cualquiera puede subir comprobantes al bucket receipts"
  on storage.objects for insert
  with check ( bucket_id = 'receipts' );

create policy "Cualquiera puede ver comprobantes"
  on storage.objects for select
  using ( bucket_id = 'receipts' );

-- 5. Policies RLS: insert para invitados
drop policy if exists "insert orders" on public.orders;
create policy "insert orders" on public.orders
  for insert with check (auth.uid() = user_id or user_id is null);

drop policy if exists "insert order items" on public.order_items;
create policy "insert order items" on public.order_items
  for insert with check (
    exists (select 1 from orders o
            where o.id = order_id
              and (o.user_id = auth.uid() or o.user_id is null))
  );

drop policy if exists "owner insert tickets" on public.tickets;
create policy "owner insert tickets" on public.tickets
  for insert with check (
    exists (select 1 from orders o
            where o.id = order_id
              and (o.user_id = auth.uid() or o.user_id is null))
  );

-- 6. Bucket de imágenes de eventos
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

drop policy if exists "admin can upload images" on storage.objects;
drop policy if exists "public can view images" on storage.objects;

create policy "admin can upload images"
  on storage.objects for insert
  with check ( bucket_id = 'images' );

create policy "public can view images"
  on storage.objects for select
  using ( bucket_id = 'images' );

-- Listo. Reinicia el servidor si estaba corriendo (npm run dev)
