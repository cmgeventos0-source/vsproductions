-- Migration: Agregar columnas de preventa a la tabla public.zones
ALTER TABLE public.zones 
ADD COLUMN IF NOT EXISTS presale_price NUMERIC,
ADD COLUMN IF NOT EXISTS presale_end_at TIMESTAMPTZ;
