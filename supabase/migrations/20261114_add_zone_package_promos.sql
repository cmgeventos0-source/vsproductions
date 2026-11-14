-- Migración para soporte de promociones por paquete/combo en zonas
-- Permite configurar por ejemplo: 2 boletas por $170.000 (o 3 por $240.000, etc.)

ALTER TABLE public.zones
ADD COLUMN IF NOT EXISTS promo_package_qty integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_package_price numeric(12,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_package_name text DEFAULT NULL;

COMMENT ON COLUMN public.zones.promo_package_qty IS 'Cantidad de boletas requeridas para activar la promoción de paquete (ej: 2, 3, 4)';
COMMENT ON COLUMN public.zones.promo_package_price IS 'Precio especial total del paquete de boletas (ej: 170000 para combo de 2)';
COMMENT ON COLUMN public.zones.promo_package_name IS 'Nombre visible o etiqueta de la promoción (ej: Combo 2x1, Combo Amigos)';
