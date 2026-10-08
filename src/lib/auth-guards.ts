import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Obtiene y valida la sesión del usuario actual desde las cookies del servidor.
 * Lanza un error si el usuario no está autenticado.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No autenticado. Debes iniciar sesión para continuar.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    role: profile?.role ?? "customer",
  };
}

/**
 * Valida que el usuario actual tenga rol de administrador ('admin').
 * Lanza un error si no está autenticado o no tiene permisos.
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (user.role !== "admin") {
    throw new Error("Acceso denegado: Se requieren permisos de administrador.");
  }

  return user;
}

/**
 * Valida que una petición HTTP a una tarea cron tenga el secret correcto en el header Authorization.
 */
export function requireCronSecret(req: { headers: { get(name: string): string | null } }): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("[Cron] CRON_SECRET no está configurado en las variables de entorno.");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token === cronSecret;
}
