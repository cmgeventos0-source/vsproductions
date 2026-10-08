-- Migration: Agregar columna sale_type a la tabla public.zones
-- 'individual': venta por entrada/silla individual
-- 'full_zone': venta por palco o zona completa a precio único
ALTER TABLE public.zones 
ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'individual';
