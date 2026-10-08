import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCard from "../../components/EventCard";
import Filters from "../../components/Filters";
import type { Event } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Eventos" };

export default async function EventosPage({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; ciudad?: string }> }) {
  const { q, categoria, ciudad } = await searchParams;
  const supabase = await createClient();
  let events: Event[] = [];
  let categories: any[] = [];
  let venues: any[] = [];

  try {
    let query = supabase.from("events").select("id, slug, name, description, image_url, sale_mode, status, created_at, category_id, venue_id").eq("status", "published").order("created_at", { ascending: false });
    if (categoria) {
      const { data: cat } = await supabase.from("categories").select("id").eq("slug", categoria).maybeSingle();
      if (cat) query = query.eq("category_id", cat.id);
    }
    if (ciudad) query = query.eq("venue_id", (await supabase.from("venues").select("id").eq("city", ciudad).maybeSingle()).data?.id);
    if (q) query = query.ilike("name", `%${q}%`);
    const [evRes, catRes, venRes] = await Promise.all([
      query,
      supabase.from("categories").select("id, name, slug, icon, sort_order").order("sort_order"),
      supabase.from("venues").select("id, name, city, address"),
    ]);
    events = evRes.data || [];
    categories = catRes.data || [];
    venues = venRes.data || [];

    if (events.length > 0) {
      const categoryIds = Array.from(new Set(events.map((e) => e.category_id).filter(Boolean)));
      const venueIds = Array.from(new Set(events.map((e) => e.venue_id).filter(Boolean)));

      const [catMapRes, venueMapRes] = await Promise.all([
        categoryIds.length ? supabase.from("categories").select("id, name, slug, icon").in("id", categoryIds) : Promise.resolve({ data: [] }),
        venueIds.length ? supabase.from("venues").select("id, name, city, address").in("id", venueIds) : Promise.resolve({ data: [] }),
      ]);

      const catMap = new Map((catMapRes.data || []).map((c: any) => [c.id, c]));
      const venueMap = new Map((venueMapRes.data || []).map((v: any) => [v.id, v]));

      for (const ev of events) {
        ev.category = catMap.get(ev.category_id) || null;
        ev.venue = venueMap.get(ev.venue_id) || null;
      }
    }
  } catch (err) {
    console.error("Error loading eventos page data:", err);
  }

  const cities = [...new Set(venues.map((v) => v.city))].sort();
  const featuredEvent = events[0];
  const resultsLabel = events.length === 1 ? "evento disponible" : "eventos disponibles";

  return (
    <div className="min-h-screen overflow-hidden pb-20">
      <section className="relative border-b border-white/[0.08] bg-[#090A16]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[120px]" />
          <div className="absolute right-0 top-10 h-80 w-80 rounded-full bg-violet-600/25 blur-[110px]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3.5 py-1.5 text-xs font-extrabold tracking-wide text-pink-200">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_12px_#f472b6]" /> PLANES QUE SÍ DAN GANAS DE SALIR
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Encuentra el plan que va a <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">hacer historia.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-slate-300 sm:text-lg">Conciertos, teatro y experiencias para vivir en Colombia. Compra rápido, recibe tu QR y disfruta sin filas.</p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm font-bold text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2">🔒 Compra segura</span><span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2">⚡ QR al instante</span><span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2">🇨🇴 Hecho para Colombia</span>
            </div>
          </div>
          <div className="relative min-h-[280px] overflow-hidden rounded-[2rem] border border-white/15 bg-slate-900 shadow-2xl shadow-violet-950/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featuredEvent?.image_url ?? "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80"} alt={featuredEvent?.name ?? "Público disfrutando un concierto"} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090A16] via-[#090A16]/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">Destacado</span>
              <p className="mt-3 text-xl font-black text-white sm:text-2xl">{featuredEvent?.name ?? "La mejor cartelera está por comenzar"}</p>
              <Link href={featuredEvent ? `/eventos/${featuredEvent.slug}` : "/eventos"} className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-fuchsia-200 hover:text-white">Ver boletas <span aria-hidden>→</span></Link>
            </div>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <Suspense><Filters categories={categories} cities={cities} /></Suspense>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-fuchsia-300">Cartelera</p><h2 className="mt-1 text-3xl font-black tracking-tight text-white">Eventos para vivir ahora</h2></div>
          <p className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300"><span className="mr-1.5 text-white">{events.length}</span>{resultsLabel}</p>
        </div>
        {events.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>
            <aside className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-b from-violet-500/15 via-[#121329] to-[#0E0F1F] p-6 lg:sticky lg:top-24 lg:h-fit">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-fuchsia-500/30 blur-3xl" /><p className="relative text-3xl">🎉</p>
              <p className="relative mt-5 text-xs font-extrabold uppercase tracking-[0.15em] text-violet-300">No te pierdas nada</p><h3 className="relative mt-2 text-xl font-black leading-tight text-white">La próxima gran noche puede estar aquí.</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-slate-300">Guarda tus favoritos y ten tus boletas listas en el celular.</p>
              <Link href="/favoritos" className="relative mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-slate-950 transition-transform hover:-translate-y-0.5">Ver mis favoritos</Link>
            </aside>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-12 text-center"><p className="text-5xl">🎟️</p><h2 className="mt-4 text-xl font-black text-white">Aún no encontramos ese plan</h2><p className="mt-2 text-sm text-slate-400">Cambia la búsqueda o revisa todas las categorías disponibles.</p><Link href="/eventos" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-950">Limpiar filtros</Link></div>
        )}
      </main>
    </div>
  );
}
