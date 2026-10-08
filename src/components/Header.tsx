import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../app/auth-actions";

export default async function Header() {
  let user = null;
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || err?.message?.includes("Dynamic server usage")) {
      throw err;
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#05050D]/80 backdrop-blur-2xl transition-all duration-300">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="group flex items-center gap-3 text-xl font-black tracking-tight">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 text-xl text-white shadow-lg shadow-violet-500/25 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-violet-500/40">
            <span className="drop-shadow-md">🎫</span>
            <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Boletería<span className="text-pink-500 drop-shadow-[0_0_12px_rgba(236,72,153,0.8)]">.</span>CO
          </span>
        </Link>

        {/* Navigation items */}
        <nav className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] p-1.5 backdrop-blur-md md:flex">
          <Link
            href="/eventos"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            🔥 Todos los Eventos
          </Link>
          <Link
            href="/eventos?categoria=conciertos"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-400 transition-all hover:bg-white/[0.08] hover:text-purple-300"
          >
            🎤 Conciertos
          </Link>
          <Link
            href="/eventos?categoria=teatro"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-400 transition-all hover:bg-white/[0.08] hover:text-pink-300"
          >
            🎭 Teatro
          </Link>
          <Link
            href="/eventos?categoria=deportes"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-400 transition-all hover:bg-white/[0.08] hover:text-cyan-300"
          >
            ⚽ Deportes
          </Link>
        </nav>

        {/* User actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/carrito"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-white/10 hover:border-purple-500/50"
          >
            <span>🛒</span> Carrito
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 backdrop-blur-md transition-all hover:border-amber-500/50 hover:bg-amber-500/20 sm:flex"
            >
              <span>⚙️</span> Panel Admin
            </Link>
          )}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/mis-boletas"
                className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-xs font-bold text-purple-200 transition-all hover:border-purple-500/50 hover:bg-purple-500/20 shadow-md shadow-purple-950/40"
              >
                <span>🎟️</span> Mis Boletas
              </Link>
              <form action={signOut}>
                <button
                  className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                  type="submit"
                >
                  Salir
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                className="hidden rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white sm:inline-flex"
              >
                Ingresar
              </Link>
              <Link
                href="/registro"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-size-200 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-purple-600/30 transition-all hover:scale-105 hover:shadow-purple-600/50"
              >
                Registrarse ✨
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
