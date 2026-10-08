import Link from "next/link";
import type { Event } from "@/lib/types";
import { formatCOP, formatDate } from "@/lib/format";
import { getZonePricing } from "@/lib/pricing";

export default function EventCard({ event }: { event: Event }) {
  const fn = event.functions?.[0] ?? event.next_function;
  const allZones = event.functions?.flatMap((f) => f.zones ?? []) ?? [];
  const pricings = allZones.map((z) => getZonePricing(z));
  const hasPresale = pricings.some((p) => p.isPresale);
  const minPrice = pricings.length > 0 ? Math.min(...pricings.map((p) => p.currentPrice)) : undefined;

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0F1F]/70 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-purple-500/40 hover:shadow-[0_12px_40px_rgba(139,92,246,0.25)]"
    >
      {/* Image Container */}
      <div className="relative aspect-[16/11] overflow-hidden bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.image_url ?? "https://picsum.photos/seed/default/800/600"}
          alt={event.name}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F1F] via-[#0E0F1F]/40 to-transparent" />

        {/* Category badge */}
        <div className="absolute left-3.5 top-3.5 flex items-center gap-2">
          {event.category && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md shadow-lg">
              <span>{event.category.icon}</span>
              <span>{event.category.name}</span>
            </span>
          )}
          {hasPresale && (
            <span className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
              PREVENTA
            </span>
          )}
        </div>

        {/* Price tag */}
        {minPrice !== undefined && !isNaN(minPrice) && (
          <div className="absolute bottom-3.5 right-3.5 rounded-xl border border-purple-400/30 bg-gradient-to-r from-purple-600/90 to-pink-600/90 px-3.5 py-1 text-xs font-black text-white shadow-lg backdrop-blur-md">
            Desde {formatCOP(minPrice)}
          </div>
        )}
      </div>

      {/* Info Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-extrabold leading-snug tracking-tight text-white transition-colors duration-300 group-hover:text-purple-300">
          {event.name}
        </h3>

        <div className="mt-3.5 space-y-1.5">
          {event.venue && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="text-purple-400">📍</span>
              <span className="truncate">
                {event.venue.name} · <strong className="text-slate-300">{event.venue.city}</strong>
              </span>
            </div>
          )}

          {fn && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="text-pink-400">📅</span>
              <span>{formatDate(fn.starts_at)}</span>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Disponible
          </span>
          <span className="flex items-center gap-1 text-xs font-bold text-purple-400 transition-transform duration-300 group-hover:translate-x-1">
            Boletas →
          </span>
        </div>
      </div>
    </Link>
  );
}

