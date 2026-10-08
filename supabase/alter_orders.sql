-- ============================================================
-- MIGRACIÓN: columnas faltantes en public.orders
-- (Ejecutar en Supabase SQL Editor)
-- ============================================================
alter table public.orders
  add column if not exists receipt_url text,
  add column if not exists customer_phone text,
  add column if not exists customer_id_number text;
