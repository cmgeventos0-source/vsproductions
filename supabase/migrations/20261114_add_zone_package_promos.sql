-- Migración completa para promociones de boletas por combo/paquete en zonas
-- Soporta:
-- 1. Activar / Desactivar promoción (is_promo_active)
-- 2. Precio individual en promo (promo_single_price) ej: 1 por $90.000
-- 3. Cantidad de boletas para el combo (promo_package_qty) ej: 2
-- 4. Precio especial del combo (promo_package_price) ej: 2 por $170.000
-- 5. Fecha y hora límite de fin del combo (promo_end_at)
-- 6. Etiqueta / Nombre del combo (promo_package_name)

ALTER TABLE public.zones
ADD COLUMN IF NOT EXISTS is_promo_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS promo_single_price numeric(12,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_package_qty integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_package_price numeric(12,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_package_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_end_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.zones.is_promo_active IS 'Indica si la promoción está activada o desactivada para esta zona';
COMMENT ON COLUMN public.zones.promo_single_price IS 'Precio promocional de 1 boleta individual mientras la promo esté activa';
COMMENT ON COLUMN public.zones.promo_package_qty IS 'Cantidad de boletas del combo (ej: 2, 3, etc.)';
COMMENT ON COLUMN public.zones.promo_package_price IS 'Precio total del combo (ej: 2 por $170.000)';
COMMENT ON COLUMN public.zones.promo_package_name IS 'Nombre de la promoción (ej: Promo Fin de Semana, Combo Pareja 2x1)';
COMMENT ON COLUMN public.zones.promo_end_at IS 'Fecha y hora límite de finalización de la promoción';
