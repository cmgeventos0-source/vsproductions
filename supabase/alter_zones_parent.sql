-- ============================================================
-- MIGRACION: subdivisiones de zonas (Palcos divididos)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- parent_id: si una zona tiene parent_id, es una subdivision (ej. Palco 1, Palco 2)
-- La zona padre es el "contenedor" (ej. "Palcos") y no se vende directamente
alter table public.zones
  add column if not exists parent_id uuid references public.zones on delete cascade;

create index if not exists zones_parent_idx on public.zones (parent_id);

-- Asientos por subdivision (capacidad individual del palco)
-- capacity ya existe en zones y se usa para esto
