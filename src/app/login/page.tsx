import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirect?: string; next?: string }>;
}) {
  const { message, redirect: redirectTo, next } = await searchParams;
  // `next` comes from the admin middleware, `redirect` from other flows
  const destinationAfterLogin = next || redirectTo || "";

  async function loginAction(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const requestedRedirect = formData.get("redirect") as string;
    // Only allow in-app destinations; hidden inputs can be altered by clients.
    const redirectUrl =
      requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
        ? requestedRedirect
        : "/mis-boletas";

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect(`/login?message=${encodeURIComponent(error.message)}`);
    }

    return redirect(redirectUrl);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <div className="card w-full p-8">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
            🎫
          </span>
          <h1 className="mt-4 text-2xl font-black">Iniciar Sesión</h1>
          <p className="mt-1 text-sm text-muted">Ingresa a tu cuenta para ver y gestionar tus boletas</p>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-semibold text-red-400">
            {message}
          </div>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="redirect" value={destinationAfterLogin} />
          <div>
            <label className="label">Correo Electrónico</label>
            <input name="email" type="email" required placeholder="tu@email.com" className="input" />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input name="password" type="password" required placeholder="••••••••" className="input" />
          </div>
          <button type="submit" className="btn-primary w-full py-3">
            Ingresar
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-accent-2 hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
