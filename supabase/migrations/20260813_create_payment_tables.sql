-- Create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text,
  enabled boolean DEFAULT true,
  requires_verification boolean DEFAULT true,
  verification_config jsonb,
  display_order int DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create payment_verifications table
CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_object_id uuid NOT NULL REFERENCES storage.objects(id) ON DELETE CASCADE,
  payment_method_id text REFERENCES public.payment_methods(id),
  extracted_data jsonb,
  matched_transaction jsonb,
  status text DEFAULT 'processing',
  confidence_score int,
  verified_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pv_receipt ON public.payment_verifications(receipt_object_id);
CREATE INDEX IF NOT EXISTS idx_pv_method ON public.payment_verifications(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_pm_enabled ON public.payment_methods(enabled);

-- Insert default payment methods
INSERT INTO public.payment_methods (id, name, icon, enabled, requires_verification, verification_config, display_order)
VALUES
  ('nequi', 'Nequi', 'smartphone', true, true, '{"match_fields": ["amount","date","phone"]}'::jsonb, 1),
  ('transferencia', 'Transferencia Bancaria', 'banknote', true, true, '{"match_fields": ["amount","date","reference"]}'::jsonb, 2),
  ('efectivo', 'Efectivo', 'wallet', true, false, '{}'::jsonb, 3),
  ('tarjeta', 'Tarjeta de Crédito', 'credit-card', false, true, '{"match_fields": ["amount","date"]}'::jsonb, 4)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_methods
CREATE POLICY "payment_methods_select" ON public.payment_methods
  FOR SELECT USING (true);

CREATE POLICY "payment_methods_insert" ON public.payment_methods
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "payment_methods_update" ON public.payment_methods
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "payment_methods_delete" ON public.payment_methods
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create RLS policies for payment_verifications
CREATE POLICY "payment_verifications_select" ON public.payment_verifications
  FOR SELECT USING (true);

CREATE POLICY "payment_verifications_insert" ON public.payment_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "payment_verifications_update" ON public.payment_verifications
  FOR UPDATE USING (true)
  WITH CHECK (true);
