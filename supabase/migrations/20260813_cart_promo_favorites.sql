-- Tabla de carritos
CREATE TABLE IF NOT EXISTS public.shopping_carts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text, -- Para usuarios no autenticados
  items jsonb DEFAULT '[]'::jsonb, -- [{functionId, zoneId, quantity, price, seatIds}]
  subtotal int DEFAULT 0,
  discount_amount int DEFAULT 0,
  promo_code_id uuid,
  total int DEFAULT 0,
  abandoned_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(session_id)
);

-- Tabla de cupones
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL, -- 'percentage' | 'fixed'
  discount_value int NOT NULL, -- porcentaje o monto en COP
  min_purchase int, -- compra mínima requerida
  max_uses int, -- usos máximos del cupón
  current_uses int DEFAULT 0,
  category_id uuid REFERENCES public.categories(id),
  event_id uuid REFERENCES public.events(id),
  valid_from timestamp NOT NULL,
  valid_until timestamp NOT NULL,
  active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Tabla de usos de cupones por usuario
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  order_id uuid REFERENCES public.orders(id),
  used_at timestamp DEFAULT now()
);

-- Tabla de favoritos
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- Tabla de código referral
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  discount_percentage int DEFAULT 5,
  total_referrals int DEFAULT 0,
  total_earned int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- Tabla de referrals usados
CREATE TABLE IF NOT EXISTS public.referral_uses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),
  referred_user_id uuid REFERENCES auth.users(id),
  order_id uuid REFERENCES public.orders(id),
  discount_applied int,
  created_at timestamp DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cart_user ON public.shopping_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_session ON public.shopping_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_promo_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_active ON public.promo_codes(active, valid_until);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_code ON public.referral_codes(code);

-- RLS
ALTER TABLE public.shopping_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_user_access" ON public.shopping_carts
  FOR SELECT USING (auth.uid() = user_id OR session_id IS NOT NULL);

CREATE POLICY "favorites_user_access" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "referral_user_access" ON public.referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "promo_public_read" ON public.promo_codes
  FOR SELECT USING (active = true);
