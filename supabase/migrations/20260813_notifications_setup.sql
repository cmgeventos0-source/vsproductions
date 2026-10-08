-- supabase/migrations/20260813_notifications_setup.sql

-- Tabla para registrar logs de notificaciones enviadas
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  type text NOT NULL, -- payment_confirmed, payment_failed, order_processing, ticket_ready
  email_sent boolean DEFAULT false,
  email_error text,
  whatsapp_sent boolean DEFAULT false,
  whatsapp_error text,
  sms_sent boolean DEFAULT false,
  sms_error text,
  retry_count int DEFAULT 0,
  last_retry_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_notification_logs_order ON public.notification_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON public.notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON public.notification_logs(created_at);

-- RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_logs_admin_read" ON public.notification_logs
  FOR SELECT USING (
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Tabla para reintentos de notificaciones fallidas
CREATE TABLE IF NOT EXISTS public.notification_retries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_log_id uuid NOT NULL REFERENCES public.notification_logs(id) ON DELETE CASCADE,
  channel text NOT NULL, -- email, whatsapp, sms
  error text,
  scheduled_for timestamp NOT NULL,
  executed_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_retries_scheduled ON public.notification_retries(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_retries_executed ON public.notification_retries(executed_at);

-- Tabla de preferencias de notificación del usuario
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receive_email boolean DEFAULT true,
  receive_whatsapp boolean DEFAULT true,
  receive_sms boolean DEFAULT false,
  preferred_channel text DEFAULT 'email', -- email | whatsapp
  phone_verified boolean DEFAULT false,
  email_verified boolean DEFAULT false,
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_pref_user_access" ON public.user_notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_pref_user_update" ON public.user_notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);
