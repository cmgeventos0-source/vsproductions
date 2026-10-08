"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Event, Seat, Zone } from "@/lib/types";
import { formatCOP, formatDateTime } from "@/lib/format";
import { addToCart } from "@/app/actions";
import { SafeDateRender } from "@/components/SafeDateRender";

type SeatsByFunction = Record<string, Seat[]>;

function getCentroid(coordsStr: string) {
  const pairs = coordsStr.trim().split(/\s+/);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const pair of pairs) {
    const parts = pair.split(",");
    if (parts.length === 2) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (!isNaN(x) && !isNaN(y)) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (count === 0) return { x: 0, y: 0 };
  return { x: sumX / count, y: sumY / count };
}

export default function PurchasePanel({
  event,
  seatsByFunction,
}: {
  event: Event;
  seatsByFunction: SeatsByFunction;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const functions = event.functions ?? [];
  const [functionId, setFunctionId] = useState(functions[0]?.id ?? "");
  const activeFunction = functions.find((f) => f.id === functionId);

  const zones = useMemo(() => {
    const all = activeFunction?.zones ?? [];
    const parentIds = new Set(all.filter((z) => z.parent_id).map((z) => z.parent_id));
    const hasSubdivisions = parentIds.size > 0;
    if (hasSubdivisions) {
      return all.filter((z) => !parentIds.has(z.id) || all.some((c) => c.parent_id === z.id))
        .filter((z) => z.parent_id !== null || !parentIds.has(z.id));
    }
    return all.filter((z) => !z.parent_id);
  }, [activeFunction]);

  const [zoneId, setZoneId] = useState("");
  const activeZone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const [qty, setQty] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  

  const seats = activeFunction ? seatsByFunction[activeFunction.id] ?? [] : [];
  const seatsByZone = useMemo(() => {
    const map: Record<string, Seat[]> = {};
    for (const s of seats) {
      (map[s.zone_id] ??= []).push(s);
    }
    return map;
  }, [seats]);

  const availableSeats = activeZone ? seatsByZone[activeZone.id] ?? [] : [];
  const rows = [...new Set(availableSeats.map((s) => s.row_name))].sort();

  const hasVisualMap = useMemo(() => zones.some((z) => z.map_coords), [zones]);

  if (!mounted) return null;

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;
    setSelectedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else if (next.size < 10) next.add(seat.id);
      return next;
    });
  }

  async function continueToCheckout() {
    console.log("Intentando continuar al checkout...");
    if (!activeFunction) {
      console.error("No hay función activa");
      return;
    }
    
    setIsAdding(true);
    try {
      console.log("Llamando a addToCart con:", {
        functionId: activeFunction.id,
        zoneId: activeZone?.id ?? null,
        seatIds: [...selectedSeats],
        quantity: qty
      });
      await addToCart({
        functionId: activeFunction.id,
        zoneId: activeZone?.id ?? null,
        seatIds: [...selectedSeats],
        quantity: qty
      });
      console.log("Redirigiendo a /carrito");
      router.push("/carrito");
    } catch (err) {
      console.error("Error crítico al añadir al carrito:", err);
      alert("Error al añadir al carrito. Revisa la consola.");
    } finally {
      setIsAdding(false);
    }
  }

  if (functions.length === 0) {
    return (
      <div className="card p-6 text-sm text-muted">
        Este evento aún no tiene funciones disponibles.
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="text-xl font-black">Compra tus boletas</h2>

      <label className="mt-5 block">
        <span className="label">Función</span>
        <SafeDateRender>
          <select
            className="input"
            value={functionId}
            onChange={(e) => {
              setFunctionId(e.target.value);
              setSelectedSeats(new Set());
            }}
          >
            {functions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {formatDateTime(f.starts_at)}
              </option>
            ))}
          </select>
        </SafeDateRender>
      </label>

      {/* Visual interactive map */}
      {hasVisualMap && (
        <div className="mt-5 space-y-2">
          <span className="label">Ubicación</span>
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-2">
            <svg
              viewBox="0 0 800 500"
              className="w-full h-auto max-h-[260px]"
            >
              <rect width="800" height="500" rx="12" fill="#0b0b14" />
              <path
                d="M 0,100 L 800,100 M 0,200 L 800,200 M 0,300 L 800,300 M 0,400 L 800,400 M 100,0 L 100,500 M 200,0 L 200,500 M 300,0 L 300,500 M 400,0 L 400,500 M 500,0 L 500,500 M 600,0 L 600,500 M 700,0 L 700,500"
                stroke="#171725"
                strokeWidth="0.5"
              />
              
              {/* Escenario */}
              <rect x="250" y="15" width="300" height="35" rx="6" fill="#1e1e2f" stroke="#33334d" strokeWidth="1" />
              <text x="400" y="32" textAnchor="middle" dominantBaseline="central" fill="#8f8fa3" fontSize="11" fontWeight="bold" letterSpacing="3">ESCENARIO</text>

              {zones.map((z) => {
                if (!z.map_coords) return null;
                const isActive = activeZone?.id === z.id;
                const centroid = getCentroid(z.map_coords);
                return (
                  <g key={z.id} className="group">
                    <polygon
                      points={z.map_coords}
                      fill={z.color}
                      fillOpacity={isActive ? 0.8 : 0.35}
                      stroke={isActive ? "#ffffff" : z.color}
                      strokeWidth={isActive ? 2.5 : 1}
                      className="cursor-pointer transition-all duration-200 hover:fill-opacity-95"
                      onClick={() => {
                        setZoneId(z.id);
                        setSelectedSeats(new Set());
                      }}
                    />
                    {centroid.x > 0 && (
                      <g className="pointer-events-none">
                        <rect
                          x={centroid.x - 55}
                          y={centroid.y - 11}
                          width="110"
                          height="22"
                          rx="11"
                          fill="rgba(0,0,0,0.65)"
                          stroke={isActive ? "rgba(255,255,255,0.3)" : "transparent"}
                          strokeWidth="0.5"
                        />
                        <text
                          x={centroid.x}
                          y={centroid.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {z.name}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="text-center text-[10px] text-muted">
              💡 Haz clic en una zona del mapa para seleccionarla
            </div>
          </div>
        </div>
      )}

      {event.sale_mode === "general" ? (
        <>
          <div className="mt-5 space-y-3">

            {zones.map((z: Zone) => {
              const available = (z.capacity ?? Infinity) - z.sold_count;
              const disabled = available <= 0;
              return (
                <button
                  key={z.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setZoneId(z.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    activeZone?.id === z.id
                      ? "border-accent bg-surface-2"
                      : "border-border hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{z.name}</p>
                      <p className="text-xs text-muted">
                        {disabled ? "Agotado" : `${available.toLocaleString("es-CO")} disponibles`}
                      </p>
                    </div>
                    <p className="font-black text-accent-2">{formatCOP(z.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {activeZone && (
            <div className="mt-5 flex items-center gap-4">
              <div>
                <span className="label">Cantidad</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn-outline h-9 w-9 rounded-lg !px-0"
                    onClick={() => setQty((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold">{qty}</span>
                  <button
                    type="button"
                    className="btn-outline h-9 w-9 rounded-lg !px-0"
                    onClick={() => setQty((n) => Math.min(10, n + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setZoneId(z.id)}
                className="chip"
                style={activeZone?.id === z.id ? { borderColor: "var(--accent)", color: "var(--foreground)" } : undefined}
              >
                {z.name} · {formatCOP(z.price)}
              </button>
            ))}
          </div>

          {activeZone && (
            <div className="rounded-xl border border-border p-4">
              <p className="mb-3 text-center text-xs uppercase tracking-widest text-muted">
                Escenario
              </p>
              <div className="space-y-1.5">
                {rows.map((row) => (
                  <div key={row} className="flex items-center justify-center gap-1.5">
                    <span className="w-5 text-right text-xs text-muted">{row}</span>
                    {availableSeats
                      .filter((s) => s.row_name === row)
                      .sort((a, b) => Number(a.number) - Number(b.number))
                      .map((s) => {
                        const taken = Boolean(s.status === "sold" || (s.status === "held" && s.hold_expires_at && new Date(s.hold_expires_at) > new Date()));
                        const picked = selectedSeats.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={taken}
                            onClick={() => toggleSeat(s)}
                            title={`${row}${s.number}`}
                            className="flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold transition-colors disabled:cursor-not-allowed"
                            style={
                              taken
                                ? { background: "#3f3f52", color: "#6b6b80" }
                                : picked
                                  ? { background: "linear-gradient(135deg,#7c3aed,#ec4899)", color: "#fff" }
                                  : { background: "var(--surface-2)", color: "var(--foreground)" }
                            }
                          >
                            {s.number}
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted">
                <span><span className="mr-1 inline-block h-3 w-3 rounded" style={{ background: "var(--surface-2)" }} /> Disponible</span>
                <span><span className="mr-1 inline-block h-3 w-3 rounded" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }} /> Seleccionada</span>
                <span><span className="mr-1 inline-block h-3 w-3 rounded" style={{ background: "#3f3f52" }} /> Ocupada</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted">
          {event.sale_mode === "assigned"
            ? `${selectedSeats.size} silla(s) seleccionada(s)`
            : `${qty} boleta(s) · ${activeZone ? formatCOP(activeZone.price * qty) : ""}`}
        </p>
        <button
          className="btn-primary"
          type="button"
          onClick={continueToCheckout}
          disabled={
            isAdding || (event.sale_mode === "assigned"
              ? selectedSeats.size === 0
              : !activeZone)
          }
        >
          {isAdding ? "Añadiendo..." : "Continuar →"}
        </button>
      </div>
    </div>
  );
}

