-- Tabla de auditoría para registrar acciones del admin
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'approve_payment', 'reject_payment', 'create_method', 'update_method', 'delete_method'
  resource_type text NOT NULL, -- 'payment', 'method', 'order'
  resource_id text NOT NULL,
  changes jsonb, -- {before: {}, after: {}}
  notes text,
  ip_address text,
  user_agent text,
  created_at timestamp DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON public.audit_logs(created_at);

-- RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin" ON public.audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "audit_insert_system" ON public.audit_logs
  FOR INSERT WITH CHECK (true);
