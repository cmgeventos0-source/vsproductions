-- ==============================================================================
-- Migración: Configuración de Eventos para Menores con Adulto Obligatorio
-- ==============================================================================

-- 1. Campos en la tabla events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS allows_minors boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS max_minors_per_adult int DEFAULT 2;

-- 2. Precio de boleta de menor por zona/localidad
ALTER TABLE public.zones 
ADD COLUMN IF NOT EXISTS minor_price numeric(12,2) DEFAULT null;

-- 3. Tipo de boleta y vínculo con el adulto en tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS ticket_type text DEFAULT 'adult',
ADD COLUMN IF NOT EXISTS parent_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL;

-- 4. Tipo de item en order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'adult';

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON public.tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_parent_ticket ON public.tickets(parent_ticket_id);

