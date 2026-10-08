-- Tabla de índices para búsqueda full-text
CREATE TABLE IF NOT EXISTS public.event_search_index (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  search_text tsvector, -- Índice full-text
  keywords text[], -- Array de palabras clave
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Tabla de preferencias de ubicación del usuario
CREATE TABLE IF NOT EXISTS public.user_location_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  search_radius int DEFAULT 50, -- km
  preferred_cities text[],
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabla de búsquedas recientes
CREATE TABLE IF NOT EXISTS public.recent_searches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  search_query text NOT NULL,
  filters jsonb, -- {category, minPrice, maxPrice, startDate, endDate, city, radius}
  results_count int,
  created_at timestamp DEFAULT now()
);

-- Índices para optimizar búsqueda
CREATE INDEX IF NOT EXISTS idx_event_search ON public.event_search_index USING GIN(search_text);
CREATE INDEX IF NOT EXISTS idx_event_keywords ON public.event_search_index USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_event_location ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON public.recent_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_searches_date ON public.recent_searches(created_at);

-- RLS
ALTER TABLE public.event_search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_index_public" ON public.event_search_index
  FOR SELECT USING (true);

CREATE POLICY "location_user_access" ON public.user_location_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "location_user_write" ON public.user_location_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "recent_searches_user_access" ON public.recent_searches
  FOR SELECT USING (auth.uid() = user_id OR session_id IS NOT NULL);

-- Función para actualizar índice de búsqueda
CREATE OR REPLACE FUNCTION update_event_search_index()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.event_search_index (event_id, search_text, keywords)
  VALUES (
    NEW.id,
    to_tsvector('spanish', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, ''))
      || to_tsvector('spanish', COALESCE(NEW.city, '')),
    array[
      LOWER(NEW.name),
      LOWER(NEW.city),
      (SELECT category_name FROM public.categories WHERE id = NEW.category_id LIMIT 1),
      to_char(NEW.created_at, 'YYYY-MM')
    ]
  )
  ON CONFLICT (event_id) DO UPDATE SET
    search_text = to_tsvector('spanish', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, ''))
      || to_tsvector('spanish', COALESCE(NEW.city, '')),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para mantener índice actualizado
CREATE TRIGGER trigger_update_event_search
AFTER INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION update_event_search_index();
