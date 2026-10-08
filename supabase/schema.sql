-- ============================================================
-- SISTEMA DE BOLETERÍA CONFIGURABLE (Colombia)
-- Ejecuta este script en Supabase: SQL Editor > New query > Run
-- ============================================================

-- ---------- EXTENSIONES ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLAS
-- ============================================================

-- Configuración global del sistema (todo lo "configurable")
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  icon       text,
  sort_order int  default 0
);

create table if not exists public.venues (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  city    text not null,
  address text,
  map_url text
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category_id uuid references public.categories,
  venue_id    uuid references public.venues,
  description text,
  image_url   text,
  sale_mode   text not null default 'general' check (sale_mode in ('general','assigned')),
  status      text not null default 'draft' check (status in ('draft','published','ended','cancelled')),
  created_at  timestamptz not null default now(),
  constraint events_category_id_fkey foreign key (category_id) references public.categories(id),
  constraint events_venue_id_fkey foreign key (venue_id) references public.venues(id)
);

-- Fechas / funciones de un evento (un evento puede tener varias)
create table if not exists public.event_functions (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events on delete cascade,
  name            text,
  starts_at       timestamptz not null,
  doors_open_at   timestamptz,
  sales_start_at  timestamptz,
  sales_end_at    timestamptz,
  is_active       boolean not null default true,
  constraint event_functions_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade
);

-- Zonas / localidades con precio por función
create table if not exists public.zones (
  id          uuid primary key default gen_random_uuid(),
  function_id uuid not null references public.event_functions on delete cascade,
  name        text not null,
  price       numeric(12,2) not null,
  capacity    int,
  sold_count  int not null default 0,
  color       text not null default '#7c3aed',
  sort_order  int not null default 0,
  map_coords  text,
  parent_id   uuid,
  constraint zones_function_id_fkey foreign key (function_id) references public.event_functions(id) on delete cascade
);

-- Sillas (solo cuando sale_mode = 'assigned')
create table if not exists public.seats (
  id              uuid primary key default gen_random_uuid(),
  zone_id         uuid not null references public.zones on delete cascade,
  function_id     uuid not null references public.event_functions on delete cascade,
  row_name        text not null,
  number          text not null,
  status          text not null default 'available' check (status in ('available','held','sold')),
  hold_expires_at timestamptz,
  constraint seats_zone_id_fkey foreign key (zone_id) references public.zones(id) on delete cascade,
  constraint seats_function_id_fkey foreign key (function_id) references public.event_functions(id) on delete cascade,
  unique (zone_id, row_name, number)
);

create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users,
  email                text not null,
  customer_name        text,
  customer_phone       text,
  customer_id_number   text,
  status               text not null default 'pending' check (status in ('pending','paid','failed','cancelled')),
  subtotal             numeric(12,2) not null default 0,
  service_fee          numeric(12,2) not null default 0,
  tax                  numeric(12,2) not null default 0,
  total                numeric(12,2) not null default 0,
  currency             text not null default 'COP',
  payment_method       text,
  payment_ref          text,
  wompi_transaction_id text,
  receipt_url          text,
  created_at           timestamptz not null default now(),
  constraint orders_user_id_fkey foreign key (user_id) references auth.users(id)
);
create index if not exists orders_email_idx on public.orders (email);
create index if not exists orders_user_idx on public.orders (user_id);

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders on delete cascade,
  zone_id     uuid references public.zones,
  seat_id     uuid references public.seats,
  function_id uuid references public.event_functions,
  quantity    int not null default 1,
  unit_price  numeric(12,2) not null,
  constraint order_items_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade,
  constraint order_items_zone_id_fkey foreign key (zone_id) references public.zones(id),
  constraint order_items_seat_id_fkey foreign key (seat_id) references public.seats(id),
  constraint order_items_function_id_fkey foreign key (function_id) references public.event_functions(id)
);

create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders on delete cascade,
  function_id uuid references public.event_functions,
  zone_id     uuid references public.zones,
  seat_id     uuid references public.seats,
  holder_name text,
  code        text not null unique,
  qr_data     text not null,
  status      text not null default 'active' check (status in ('active','redeemed','transferred','cancelled')),
  issued_at   timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint tickets_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade,
  constraint tickets_function_id_fkey foreign key (function_id) references public.event_functions(id),
  constraint tickets_zone_id_fkey foreign key (zone_id) references public.zones(id),
  constraint tickets_seat_id_fkey foreign key (seat_id) references public.seats(id)
);
create index if not exists tickets_code_idx on public.tickets (code);

create table if not exists public.promo_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  discount_type  text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null,
  event_id       uuid references public.events,
  max_uses       int,
  used_count     int not null default 0,
  expires_at     timestamptz,
  constraint promo_codes_event_id_fkey foreign key (event_id) references public.events(id)
);

-- Perfil de usuarios (rol: customer / admin / organizer)
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text,
  role       text not null default 'customer' check (role in ('customer','admin','organizer')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCIONES AUXILIARES
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'customer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.app_config      enable row level security;
alter table public.categories      enable row level security;
alter table public.venues          enable row level security;
alter table public.events          enable row level security;
alter table public.event_functions enable row level security;
alter table public.zones           enable row level security;
alter table public.seats           enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.tickets         enable row level security;
alter table public.promo_codes     enable row level security;
alter table public.profiles        enable row level security;

-- Lectura pública
create policy "public read config"        on public.app_config      for select using (true);
create policy "public read categories"    on public.categories      for select using (true);
create policy "public read venues"        on public.venues          for select using (true);
create policy "public read published events" on public.events for select using (status = 'published');
create policy "public read functions"     on public.event_functions for select using (exists (select 1 from events e where e.id = event_id and e.status = 'published'));
create policy "public read zones"         on public.zones           for select using (exists (select 1 from event_functions f join events e on e.id = f.event_id where f.id = function_id and e.status = 'published'));
create policy "public read seats"         on public.seats           for select using (exists (select 1 from event_functions f join events e on e.id = f.event_id where f.id = function_id and e.status = 'published'));

-- Admin: todo sobre catálogo
create policy "admin manage categories" on public.categories      for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage venues"     on public.venues          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage events"     on public.events          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage functions"  on public.event_functions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage zones"      on public.zones           for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage seats"      on public.seats           for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage config"     on public.app_config      for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage orders"     on public.orders          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage items"      on public.order_items     for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage tickets"    on public.tickets         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage promo"      on public.promo_codes     for all using (public.is_admin()) with check (public.is_admin());

-- Usuarios: su propio perfil
create policy "own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Usuarios: sus órdenes y boletas
create policy "own orders" on public.orders for select using (auth.uid() = user_id);
create policy "own tickets" on public.tickets for select using (exists (select 1 from orders o where o.id = tickets.order_id and o.user_id = auth.uid()));

-- Compra como invitado o con cuenta: crear la orden (solo su propia orden)
create policy "insert orders" on public.orders
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "insert order items" on public.order_items
  for insert with check (
    exists (select 1 from orders o
            where o.id = order_id
              and (o.user_id = auth.uid() or o.user_id is null))
  );

-- El comprador genera sus boletas (métodos de aprobación inmediata)
create policy "owner insert tickets" on public.tickets
  for insert with check (
    exists (select 1 from orders o
            where o.id = order_id
              and (o.user_id = auth.uid() or o.user_id is null))
  );

-- ============================================================
-- CONFIGURACIÓN INICIAL
-- ============================================================
insert into public.app_config (key, value) values
  ('company_name',       '{"name": "Boletería Colombia"}'::jsonb),
  ('currency',           '{"value": "COP"}'::jsonb),
  ('tax_rate',           '{"value": 0}'::jsonb),
  ('service_fee_fixed',  '{"value": 2500}'::jsonb),
  ('service_fee_percent','{"value": 0.05}'::jsonb),
  ('hold_minutes',       '{"value": 15}'::jsonb)
on conflict (key) do nothing;

insert into public.categories (name, slug, icon, sort_order) values
  ('Conciertos', 'conciertos', '🎤', 1),
  ('Teatro',     'teatro',     '🎭', 2),
  ('Deportes',   'deportes',   '⚽', 3),
  ('Familiar',   'familiar',   '🎡', 4),
  ('Festivales', 'festivales', '🎪', 5),
  ('Foros',      'foros',      '💬', 6),
  ('Museos',     'museos',     '🖼️', 7),
  ('Experiencias','experiencias','✨', 8)
on conflict (slug) do nothing;

insert into public.venues (name, city, address) values
  ('Movistar Arena', 'Bogotá', 'Dg. 61c #26-36, Teusaquillo'),
  ('Teatro Jorge Eliécer Gaitán', 'Bogotá', 'Cra. 7 #22-47, Santa Fe'),
  ('Estadio Pascual Guerrero', 'Cali', 'Cra. 36 #5B-00')
on conflict do nothing;

-- ============================================================
-- EVENTOS DE EJEMPLO
-- ============================================================

-- Evento 1: admisión general (concierto)
insert into public.events (slug, name, category_id, venue_id, description, image_url, sale_mode, status)
select
  'morat-yem-world-tour',
  'MORAT | YEM WORLD TOUR',
  (select id from categories where slug = 'conciertos'),
  (select id from venues where name = 'Movistar Arena'),
  'La gira más esperada del año llega a Bogotá. YEM World Tour con todos los éxitos de MORAT y una producción de talla mundial.',
  'https://picsum.photos/seed/morat/1200/675',
  'general',
  'published'
where not exists (select 1 from events where slug = 'morat-yem-world-tour');

insert into public.event_functions (event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at)
select id, 'JUEVES 12 DIC', '2026-12-12 20:00:00-05', '2026-12-12 18:00:00-05', now() - interval '1 day', '2026-12-12 19:00:00-05'
from events where slug = 'morat-yem-world-tour'
  and not exists (select 1 from event_functions f where f.event_id = events.id and f.name = 'JUEVES 12 DIC');

insert into public.event_functions (event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at)
select id, 'VIERNES 13 DIC', '2026-12-13 20:00:00-05', '2026-12-13 18:00:00-05', now() - interval '1 day', '2026-12-13 19:00:00-05'
from events where slug = 'morat-yem-world-tour'
  and not exists (select 1 from event_functions f where f.event_id = events.id and f.name = 'VIERNES 13 DIC');

insert into public.zones (function_id, name, price, capacity, color, sort_order)
select f.id, z.name, z.price, z.capacity, z.color, z.sort_order
from event_functions f
cross join (values
  ('VIP',     450000, 2000, '#e11d48', 1),
  ('PLATEA',  280000, 4000, '#7c3aed', 2),
  ('LATERAL', 90000,  3500, '#0ea5e9', 3),
  ('GENERAL', 120000, 6000, '#22c55e', 4)
) as z(name, price, capacity, color, sort_order)
where f.event_id = (select id from events where slug = 'morat-yem-world-tour')
  and not exists (select 1 from zones z2 where z2.function_id = f.id and z2.name = z.name);

-- Evento 2: asientos asignados (teatro)
insert into public.events (slug, name, category_id, venue_id, description, image_url, sale_mode, status)
select
  'mamma-mia-teatro',
  'MAMMA MIA! EL MUSICAL',
  (select id from categories where slug = 'teatro'),
  (select id from venues where name = 'Teatro Jorge Eliécer Gaitán'),
  'El musical más famoso del mundo, con los grandes éxitos de ABBA. Funciones de jueves a domingo.',
  'https://picsum.photos/seed/mamma/1200/675',
  'assigned',
  'published'
where not exists (select 1 from events where slug = 'mamma-mia-teatro');

insert into public.event_functions (event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at)
select id, 'SÁBADO 21 NOV', '2026-11-21 19:00:00-05', '2026-11-21 17:30:00-05', now() - interval '1 day', '2026-11-21 18:00:00-05'
from events where slug = 'mamma-mia-teatro'
  and not exists (select 1 from event_functions f where f.event_id = events.id and f.name = 'SÁBADO 21 NOV');

insert into public.zones (function_id, name, price, capacity, color, sort_order)
select f.id, z.name, z.price, z.capacity, z.color, z.sort_order
from event_functions f
cross join (values
  ('NORTE', 60000, 20, '#f59e0b', 1),
  ('SUR',   60000, 20, '#ec4899', 2)
) as z(name, price, capacity, color, sort_order)
where f.event_id = (select id from events where slug = 'mamma-mia-teatro')
  and not exists (select 1 from zones z2 where z2.function_id = f.id and z2.name = z.name);

-- Genera las sillas del teatro (filas A-D, columnas 1-5)
insert into public.seats (zone_id, function_id, row_name, number)
select z.id, z.function_id, chr(64 + r) as row_name, n::text as number
from zones z
cross join generate_series(1, 4) as r
cross join generate_series(1, 5) as n
where z.name in ('NORTE', 'SUR')
  and z.function_id in (select id from event_functions where event_id = (select id from events where slug = 'mamma-mia-teatro'))
  and not exists (
    select 1 from seats s
    where s.zone_id = z.id and s.row_name = chr(64 + r) and s.number = n::text
  );
