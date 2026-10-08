import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service role: solo se usa en Server Actions y Route Handlers.
// NUNCA importar desde componentes de cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";

  return createSupabaseClient(
    url,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

