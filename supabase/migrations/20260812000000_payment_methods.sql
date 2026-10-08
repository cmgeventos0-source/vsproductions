-- Migration: Create payment_methods and payment_verifications tables
-- Run with: supabase db push

-- 1. payment_methods table
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

-- 2. payment_verifications table
CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_object_id uuid NOT NULL REFERENCES storage.objects(id) ON DELETE CASCADE,
  payment_method_id text REFERENCES public.payment_methods(id),
  extracted_data jsonb,
  matched_transaction jsonb,
  status text DEFAULT 'processing',
  confidence_score int,
  verified_at timestamp,
  created_at timestamp DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pv_receipt ON public.payment_verifications(receipt_object_id);

-- 4. Trigger to update updated_at on payment_methods
CREATE OR REPLACE FUNCTION public.update_payment_methods_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_methods_timestamp ON public.payment_methods;
CREATE TRIGGER trg_payment_methods_timestamp
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_payment_methods_timestamp();

-- 5. Trigger to update updated_at on payment_verifications
CREATE OR REPLACE FUNCTION public.update_payment_verifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_verifications_timestamp ON public.payment_verifications;
CREATE TRIGGER trg_payment_verifications_timestamp
BEFORE UPDATE ON public.payment_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_payment_verifications_timestamp();

-- 6. Optional: create default admin method
INSERT INTO public.payment_methods (id, name, icon, enabled, requires_verification, verification_config, display_order)
SELECT 'nequi', 'Nequi', 'smartphone', true, true, jsonb_build_object('api_endpoint', 'https://api.nequi.com/v1/transactions', 'match_fields', array['amount','date','phone']), 1
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE id='nequi');

-- 7. Grant permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- End of migration
