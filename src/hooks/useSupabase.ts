import { createClient } from '@/lib/supabase/client';

export function useSupabase() {
  // Browser code must only ever receive the publishable-key client.
  const supabaseClient = createClient();

  return { supabaseClient };
}
