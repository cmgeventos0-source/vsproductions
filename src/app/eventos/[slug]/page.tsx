import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PurchasePanel from "../../../components/PurchasePanel";
import type { Event, Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("name, description, image_url, venue_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!event) return { title: "Evento no encontrado" };

  let venueName = "";
  let venueCity = "";

  if (event.venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("name, city")
      .eq("id", event.venue_id)
      .maybeSingle();
    venueName = venue?.name ?? "";
    venueCity = venue?.city ?? "";
  }

  return {
    title: event.name,
    description: event.description?.substring(0, 160) ?? `${event.name} en ${venueName} · ${venueCity}`,
    openGraph: {
      title: event.name,
      description: event.description?.substring(0, 160) ?? event.name,
      images: event.image_url ? [event.image_url] : [],
    },
  };
}

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, slug, name, description, image_url, sale_mode, status, created_at, category_id, venue_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!event || event.status !== "published") {
    notFound();
  }

  const [catRes, venueRes, funcRes] = await Promise.all([
    event.category_id ? supabase.from("categories").select("id, name, slug, icon").eq("id", event.category_id).maybeSingle() : Promise.resolve({ data: null }),
    event.venue_id ? supabase.from("venues").select("id, name, city, address, map_url").eq("id", event.venue_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("event_functions").select("id, event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at, is_active, zones(id, name, price, color, parent_id, map_coords)").eq("event_id", event.id),
  ]);

  (event as any).category = catRes.data || null;
  (event as any).venue = venueRes.data || null;
  (event as any).functions = funcRes.data || [];

  const eventData = event as any;
  const functionIds = eventData.functions?.map((f: any) => f.id) ?? [];
  let seatsByFunction: Record<string, Seat[]> = {};

  if (functionIds.length > 0 && event.sale_mode === "assigned") {
    const { data: seats } = await supabase
      .from("seats")
      .select("*")
      .in("function_id", functionIds);

    if (seats) {
      for (const s of seats) {
        (seatsByFunction[s.function_id] ??= []).push(s);
      }
    }
  }

  if (eventData.functions) {
    const zoneIds = Array.from(new Set(eventData.functions.flatMap((f: any) => (f.zones || []).map((z: any) => z.id))));
    if (zoneIds.length > 0) {
      const { data: zones } = await supabase.from("zones").select("*").in("id", zoneIds);
      if (zones) {
        const zoneMap = new Map(zones.map((z: any) => [z.id, z]));
        for (const f of eventData.functions) {
          f.zones = (f.zones || []).map((z: any) => zoneMap.get(z.id) || z).sort((a: any, b: any) => a.sort_order - b.sort_order);
        }
      }
    }
  }

  // Extract zones from first function for the map preview
  const firstFunction = eventData.functions?.[0];
  const mapZones: any[] = firstFunction?.zones ?? [];
  const hasMap = mapZones.some((z: any) => z.map_coords);

  return (
    <div className="flex flex-col bg-background">
      {/* ── HERO: poster + title + description ── */}
      <div className="relative overflow-hidden border-b border-white/5 py-10 md:py-16">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10 blur-2xl scale-105"
          style={{ backgroundImage: `url(${event.image_url ?? "https://picsum.photos/seed/default/1200/675"})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Poster */}
            <div className="shrink-0 w-44 md:w-56 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.image_url ?? "https://picsum.photos/seed/default/600/800"}
                alt={event.name}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Title + meta + description */}
            <div className="flex-1 space-y-4">
              {eventData.category && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3.5 py-1.5 text-xs font-semibold text-purple-300 border border-purple-500/20">
                  {eventData.category.icon} {eventData.category.name}
                </span>
              )}

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl text-white">
                {event.name}
              </h1>

              {eventData.venue && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    📍 <span>{eventData.venue.name} · {eventData.venue.city}</span>
                  </span>
                  {eventData.venue.address && (
                    <span className="flex items-center gap-1.5">
                      🏠 <span>{eventData.venue.address}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/20">
                    🏛️ Código PULEP: {eventData.pulep_code || `COL-${event.id.substring(0, 6).toUpperCase()}`}
                  </span>
                </div>
              )}

              {/* Descripción al lado del título */}
              {event.description && (
                <div className="mt-2 max-h-40 overflow-y-auto pr-1">
                  <p className="text-muted leading-relaxed whitespace-pre-line text-sm">
                    {event.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN: mapa grande izquierda | panel compra derecha ── */}
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-6 lg:grid-cols-5">

            {/* RIGHT: panel de compra (primero en móvil, derecha en desktop) */}
            <div className="lg:col-span-2 order-1 lg:order-2">
              <div className="sticky top-24">
                <PurchasePanel event={event as Event} seatsByFunction={seatsByFunction} />
              </div>
            </div>

            {/* LEFT: mapa del venue + términos (segundo en móvil, izquierda en desktop) */}
            <div className="lg:col-span-3 order-2 lg:order-1 space-y-6">

              {/* Mapa grande estático */}
              {hasMap ? (
                <div className="glass-card overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-white/5">
                    <h2 className="text-base font-bold text-white">🗺️ Mapa del Venue</h2>
                    <p className="text-xs text-muted mt-0.5">Haz clic en "Ver mapa del venue" para seleccionar tu zona interactivamente</p>
                  </div>
                  <div className="p-4 bg-[#06060c]">
                    {(() => {
                      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                      let hasPoints = false;
                      mapZones.forEach((z: any) => {
                        if (z.map_coords) {
                          const pairs = z.map_coords.trim().split(/\s+/);
                          pairs.forEach((pair: string) => {
                            const [px, py] = pair.split(",").map(Number);
                            if (!isNaN(px) && !isNaN(py)) {
                              hasPoints = true;
                              if (px < minX) minX = px;
                              if (px > maxX) maxX = px;
                              if (py < minY) minY = py;
                              if (py > maxY) maxY = py;
                            }
                          });
                        }
                      });
                      const pad = 60;
                      const bboxX = hasPoints ? Math.max(0, Math.floor(minX - pad)) : 0;
                      const bboxY = hasPoints ? Math.max(0, Math.floor(minY - pad)) : 0;
                      const bboxW = hasPoints ? Math.ceil(maxX - minX + pad * 2) : 1200;
                      const bboxH = hasPoints ? Math.ceil(maxY - minY + pad * 2) : 600;
                      const mapBBox = `${bboxX} ${bboxY} ${Math.max(bboxW, 400)} ${Math.max(bboxH, 300)}`;
                      const stageX = bboxX + Math.max(0, (bboxW - 500) / 2);
                      const stageY = Math.max(10, bboxY + 10);

                      return (
                        <svg
                          viewBox={mapBBox}
                          className="w-full h-auto max-h-[500px] min-h-[260px]"
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <rect x={bboxX - 100} y={bboxY - 100} width={bboxW + 200} height={bboxH + 200} fill="#06060c" />
                          <g opacity="0.08">
                            {Array.from({ length: 30 }, (_, i) => (
                              <line key={`v${i}`} x1={bboxX + i * 50} y1={bboxY} x2={bboxX + i * 50} y2={bboxY + bboxH} stroke="#ffffff" strokeWidth="0.5" />
                            ))}
                            {Array.from({ length: 20 }, (_, i) => (
                              <line key={`h${i}`} x1={bboxX} y1={bboxY + i * 50} x2={bboxX + bboxW} y2={bboxY + i * 50} stroke="#ffffff" strokeWidth="0.5" />
                            ))}
                          </g>
                          {/* Stage */}
                          <rect x={stageX} y={stageY} width={500} height={50} rx={14} fill="#141428" stroke="#7c3aed" strokeWidth="2.5" />
                          <text x={stageX + 250} y={stageY + 25} textAnchor="middle" dominantBaseline="central" fill="#a78bfa" fontSize="16" fontWeight="900" letterSpacing="6">★ ESCENARIO ★</text>

                          {mapZones.map((z: any) => {
                            if (!z.map_coords) return null;
                            const pairs = z.map_coords.trim().split(/\s+/);
                            let sumX = 0, sumY = 0, count = 0;
                            let minPX = Infinity, maxPX = -Infinity;
                            for (const pair of pairs) {
                              const [px, py] = pair.split(",").map(Number);
                              if (!isNaN(px) && !isNaN(py)) {
                                sumX += px; sumY += py; count++;
                                if (px < minPX) minPX = px;
                                if (px > maxPX) maxPX = px;
                              }
                            }
                            const cx = count > 0 ? sumX / count : 0;
                            const cy = count > 0 ? sumY / count : 0;
                            const zoneWidth = maxPX - minPX;

                            return (
                              <g key={z.id}>
                                <polygon
                                  points={z.map_coords}
                                  fill={z.color}
                                  fillOpacity={0.65}
                                  stroke={z.color}
                                  strokeWidth={2.5}
                                />
                                {cx > 0 && (
                                  <g>
                                    {zoneWidth > 110 ? (
                                      <g>
                                        <rect x={cx - 65} y={cy - 15} width={130} height={30} rx={15} fill="rgba(6,6,12,0.92)" stroke={z.color} strokeWidth={2} />
                                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="12" fontWeight="800">{z.name}</text>
                                      </g>
                                    ) : (
                                      <text
                                        x={cx}
                                        y={cy}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill="#ffffff"
                                        stroke="#000000"
                                        strokeWidth="3.5"
                                        paintOrder="stroke fill"
                                        fontSize="12"
                                        fontWeight="900"
                                      >
                                        {z.name}
                                      </text>
                                    )}
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 space-y-3">
                  <h2 className="text-base font-bold text-white">Acerca del evento</h2>
                  <p className="text-muted leading-relaxed whitespace-pre-line text-sm">
                    {event.description || "No hay descripción disponible."}
                  </p>
                </div>
              )}

              {/* Términos y condiciones */}
              <div className="glass-card p-5 space-y-3">
                <h2 className="text-sm font-bold border-b border-white/5 pb-3 text-white">
                  Términos y condiciones
                </h2>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-muted">
                  <li>Prohibido el ingreso de alimentos y bebidas al establecimiento.</li>
                  <li>Toda persona ingresa con boleta digital y código QR presentado en el celular.</li>
                  <li>No se realizan cambios de boletas ni devoluciones una vez confirmada la compra.</li>
                  <li>Llegar con mínimo 1 hora de anticipación a la apertura de puertas del evento.</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
