import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCard from "../components/EventCard";
import type { Event, Category } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boletería.CO | Compra boletas para eventos en Colombia",
  description: "Compra y vende boletas para conciertos, teatro, deportes, festivales y experiencias en Colombia. Sistema configurable de boletería digital.",
  openGraph: {
    title: "Boletería.CO",
    description: "Compra boletas para los mejores eventos en vivo de Colombia",
    type: "website",
    locale: "es_CO",
  },
};

const STATS = [
  { value: "200K+", label: "Boletas vendidas" },
  { value: "850+",  label: "Eventos realizados" },
  { value: "40+",   label: "Ciudades en Colombia" },
];

export default async function Home() {
  let categories: any[] = [];
  let events: any[] = [];

  try {
    const supabase = await createClient();

    const [catRes, evRes] = await Promise.all([
      supabase.from("categories").select("id, name, slug, icon").order("sort_order"),
      supabase
        .from("events")
        .select("id, slug, name, description, image_url, sale_mode, status, created_at, category_id, venue_id")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (evRes.error) {
      console.error("Error fetching events:", evRes.error?.message || evRes.error, evRes.error?.details || evRes.error?.hint);
    }
    if (catRes.error) {
      console.error("Error fetching categories:", catRes.error?.message || catRes.error);
    }

    categories = catRes.data || [];
    events = evRes.data || [];

    if (events.length > 0) {
      const categoryIds = Array.from(new Set(events.map((e) => e.category_id).filter(Boolean)));
      const venueIds = Array.from(new Set(events.map((e) => e.venue_id).filter(Boolean)));
      const eventIds = events.map((e) => e.id);

      const [catMapRes, venueRes, funcRes] = await Promise.all([
        categoryIds.length
          ? supabase.from("categories").select("id, name, slug, icon").in("id", categoryIds)
          : Promise.resolve({ data: [] }),
        venueIds.length
          ? supabase.from("venues").select("id, name, city, address").in("id", venueIds)
          : Promise.resolve({ data: [] }),
        eventIds.length
          ? supabase.from("event_functions").select("id, event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at, is_active").in("event_id", eventIds)
          : Promise.resolve({ data: [] }),
      ]);

      const catMap = new Map((catMapRes.data || []).map((c: any) => [c.id, c]));
      const venueMap = new Map((venueRes.data || []).map((v: any) => [v.id, v]));
      const funcByEvent = new Map<string, any[]>();
      for (const fn of funcRes.data || []) {
        const list = funcByEvent.get(fn.event_id) || [];
        list.push(fn);
        funcByEvent.set(fn.event_id, list);
      }

      for (const ev of events) {
        ev.category = catMap.get(ev.category_id) || null;
        ev.venue = venueMap.get(ev.venue_id) || null;
        ev.functions = funcByEvent.get(ev.id) || [];
      }
    }
  } catch (err) {
    console.error("Error loading home page data:", err);
  }

  return (
    <div className="min-h-screen">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32">
        {/* Glow ambient background elements */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-gradient-to-b from-violet-600/30 via-pink-600/20 to-transparent blur-[120px] opacity-70" />
        <div className="pointer-events-none absolute top-1/4 -left-48 h-[400px] w-[400px] rounded-full bg-cyan-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute top-1/3 -right-48 h-[400px] w-[400px] rounded-full bg-pink-500/20 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill Badge */}
          <div className="animate-fade-up mx-auto mb-8 inline-flex items-center gap-2.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-2 text-xs font-extrabold text-purple-300 shadow-[0_0_20px_rgba(139,92,246,0.2)] backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
            </span>
            ⚡ Boletería Digital Inteligente en Colombia
          </div>

          {/* Main Title */}
          <h1
            className="animate-fade-up mx-auto max-w-5xl text-5xl font-black leading-[1.08] tracking-tight sm:text-7xl lg:text-8xl text-white"
            style={{ animationDelay: "0.1s" }}
          >
            Tu entrada a los{" "}
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300 bg-clip-text text-transparent drop-shadow-sm">
              mejores eventos
            </span>
          </h1>

          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-base sm:text-xl leading-relaxed text-slate-300 font-medium"
            style={{ animationDelay: "0.2s" }}
          >
            Conciertos, teatro, festivales y deportes en vivo. Compra tus entradas con acceso seguro mediante código QR dinámico.
          </p>

          {/* Search Bar Container */}
          <form
            action="/eventos"
            method="get"
            className="animate-fade-up mx-auto mt-10 flex max-w-3xl flex-col sm:flex-row gap-3 rounded-3xl border border-white/[0.12] bg-[#0E0F1F]/80 p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="relative flex-1 flex items-center px-3">
              <span className="text-xl text-slate-400 mr-3">🔍</span>
              <input
                name="q"
                placeholder="Busca artistas, eventos o ciudad..."
                className="w-full bg-transparent text-sm sm:text-base font-semibold text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
            <button
              className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4 text-sm font-extrabold text-white shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] hover:shadow-purple-600/50 active:scale-100 shrink-0"
              type="submit"
            >
              <span>Buscar Boletas</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </form>

          {/* Category Chips */}
          <div
            className="animate-fade-up mt-8 flex flex-wrap justify-center gap-2.5"
            style={{ animationDelay: "0.35s" }}
          >
            <Link
              href="/eventos"
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-300 backdrop-blur-md transition-all hover:border-purple-500/50 hover:bg-purple-500/20 hover:text-white"
            >
              🎪 Todos los eventos
            </Link>
            {categories?.map((c: Category) => (
              <Link
                key={c.id}
                href={`/eventos?categoria=${c.slug}`}
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-300 backdrop-blur-md transition-all hover:border-purple-500/50 hover:bg-purple-500/20 hover:text-white"
              >
                <span>{c.icon}</span> {c.name}
              </Link>
            ))}
          </div>

          {/* Stats Bar */}
          <div
            className="animate-fade-up mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4"
            style={{ animationDelay: "0.4s" }}
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-xl transition-all hover:border-purple-500/30 hover:bg-white/[0.04]"
              >
                <p className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  {s.value}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED EVENTS ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-extrabold text-amber-300 mb-2">
              <span>🔥</span> Cartelera Destacada
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Eventos Recomendados</h2>
          </div>
          <Link
            href="/eventos"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-xs font-bold text-white transition-all hover:border-purple-500/40 hover:bg-purple-500/10"
          >
            Ver todos los eventos →
          </Link>
        </div>

        {events && events.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((event: Event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E0F1F]/60 p-12 text-center backdrop-blur-xl">
            <p className="text-5xl">🎭</p>
            <p className="mt-4 font-bold text-slate-300">
              No se encontraron eventos activos en este momento.
            </p>
            <Link
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-xs font-extrabold text-white shadow-lg"
              href="/admin"
            >
              Crear evento nuevo →
            </Link>
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12 text-center">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-extrabold text-purple-300">
            ✨ Proceso Simple & Seguro
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight">¿Cómo comprar tu boleta?</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: "🎟️",
              step: "01",
              title: "Selecciona tu Evento",
              text: "Navega entre conciertos, teatro, deportes o comedia. Selecciona tu zona y número de boletas.",
              accent: "from-purple-500/20 to-indigo-500/10",
              borderColor: "border-purple-500/30",
            },
            {
              icon: "💳",
              step: "02",
              title: "Pago Inmediato y Seguro",
              text: "Paga fácil con Nequi, Daviplata, PSE o tarjetas bancarias con verificación instantánea.",
              accent: "from-pink-500/20 to-purple-500/10",
              borderColor: "border-pink-500/30",
            },
            {
              icon: "📱",
              step: "03",
              title: "Ingreso con Código QR",
              text: "Recibe tu boleta digital directo en tu celular. Preséntala en la entrada del evento sin imprimir.",
              accent: "from-cyan-500/20 to-blue-500/10",
              borderColor: "border-cyan-500/30",
            },
          ].map((s) => (
            <div
              key={s.step}
              className={`group relative overflow-hidden rounded-3xl border ${s.borderColor} bg-gradient-to-br ${s.accent} p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5`}
            >
              <span className="absolute right-6 top-4 text-7xl font-black text-white/5 transition-opacity group-hover:text-white/10">
                {s.step}
              </span>
              <div className="text-4xl">{s.icon}</div>
              <h3 className="mt-5 text-xl font-extrabold text-white">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-300 font-medium">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/60 via-slate-900/90 to-pink-950/60 p-10 sm:p-16 text-center shadow-2xl backdrop-blur-2xl">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-purple-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-pink-600/30 blur-3xl" />

          <h2 className="relative text-3xl sm:text-5xl font-black tracking-tight text-white">
            ¿Eres organizador de eventos?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-slate-300 font-medium text-base sm:text-lg">
            Administra tus funciones, zonas de silletería, códigos promocionales y ventas en tiempo real con nuestra plataforma.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/registro"
              className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4 text-sm font-extrabold text-white shadow-xl shadow-purple-600/30 transition-all hover:scale-105"
            >
              Crear Cuenta Gratis →
            </Link>
            <Link
              href="/eventos"
              className="rounded-2xl border border-white/20 bg-white/10 px-8 py-4 text-sm font-extrabold text-white backdrop-blur-md transition-all hover:bg-white/20"
            >
              Explorar Eventos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
