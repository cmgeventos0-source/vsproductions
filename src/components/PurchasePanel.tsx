"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Event, Seat, Zone } from "@/lib/types";
import { formatCOP, formatDateTime, formatDate, formatTime } from "@/lib/format";
import { getZonePricing } from "@/lib/pricing";
import { addToCart } from "@/app/actions";
import { SafeDateRender } from "@/components/SafeDateRender";

type SeatsByFunction = Record<string, Seat[]>;

function parseCoords(coordsStr: string): { x: number; y: number }[] {
  return coordsStr.trim().split(/\s+/).map((p) => {
    const [x, y] = p.split(",").map(Number);
    return { x, y };
  }).filter((p) => !isNaN(p.x) && !isNaN(p.y));
}

function getCentroid(coordsStr: string) {
  const pairs = coordsStr.trim().split(/\s+/);
  let sumX = 0, sumY = 0, count = 0;
  for (const pair of pairs) {
    const parts = pair.split(",");
    if (parts.length === 2) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (!isNaN(x) && !isNaN(y)) { sumX += x; sumY += y; count++; }
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
  useEffect(() => { setMounted(true); }, []);

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
  const zoneLockStatus = useMemo(() => {
    const statusMap: Record<string, { isLocked: boolean; unlockThresholdPrevZoneName?: string; prevAvail?: number }> = {};
    const individualZones = zones.filter((z) => z.sale_type !== "full_zone");

    for (let i = 0; i < individualZones.length; i++) {
      const current = individualZones[i];
      if (current.is_locked) {
        statusMap[current.id] = { isLocked: true };
      } else if (i === 0) {
        statusMap[current.id] = { isLocked: false };
      } else {
        const prev = individualZones[i - 1];
        const prevAvail = (prev.capacity ?? Infinity) - prev.sold_count;
        const isLocked = prevAvail > 5;
        statusMap[current.id] = {
          isLocked,
          unlockThresholdPrevZoneName: prev.name,
          prevAvail,
        };
      }
    }

    zones.forEach((z) => {
      if (z.is_locked) {
        statusMap[z.id] = { isLocked: true };
      } else if (z.sale_type === "full_zone" && !statusMap[z.id]) {
        statusMap[z.id] = { isLocked: false };
      }
    });

    return statusMap;
  }, [zones]);

  const firstUnlockedZone = useMemo(() => zones.find((z) => !z.is_locked && !zoneLockStatus[z.id]?.isLocked), [zones, zoneLockStatus]);
  const activeZone = useMemo(
    () => zones.find((z) => z.id === zoneId && !z.is_locked && !zoneLockStatus[z.id]?.isLocked) ?? firstUnlockedZone ?? zones[0],
    [zones, zoneId, zoneLockStatus, firstUnlockedZone]
  );

  function handleSelectZone(z: Zone) {
    if (z.is_locked) {
      alert(`🔒 La zona "${z.name}" se encuentra bloqueada por el organizador y no se puede seleccionar actualmente.`);
      return;
    }
    const lockInfo = zoneLockStatus[z.id];
    if (lockInfo?.isLocked) {
      alert(`🔒 ${z.name} está bloqueado temporalmente.\nSe habilitará automáticamente cuando queden 5 o menos boletas disponibles en ${lockInfo.unlockThresholdPrevZoneName}.`);
      return;
    }
    setZoneId(z.id);
    setSelectedSeats(new Set());
  }

  const [qty, setQty] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [step, setStep] = useState(1);
  const [cartAddedMessage, setCartAddedMessage] = useState<string | null>(null);

  const seats = activeFunction ? seatsByFunction[activeFunction.id] ?? [] : [];
  const seatsByZone = useMemo(() => {
    const map: Record<string, Seat[]> = {};
    for (const s of seats) { (map[s.zone_id] ??= []).push(s); }
    return map;
  }, [seats]);

  const availableSeats = activeZone ? seatsByZone[activeZone.id] ?? [] : [];
  const rows = [...new Set(availableSeats.map((s) => s.row_name))].sort();

  const hasVisualMap = useMemo(() => zones.some((z) => z.map_coords), [zones]);
  const zoneHasSeats = activeZone ? activeZone.has_seats !== false : true;
  const hasAssignedSeats = event.sale_mode === "assigned" && zoneHasSeats;

  const mapBoundingBox = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasPoints = false;
    zones.forEach((z) => {
      if (z.map_coords) {
        const pts = parseCoords(z.map_coords);
        pts.forEach((p) => {
          hasPoints = true;
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
      }
    });
    if (!hasPoints) return "0 0 1200 700";
    const pad = 80;
    const x = Math.max(0, Math.floor(minX - pad));
    const y = Math.max(0, Math.floor(minY - pad));
    const w = Math.ceil(maxX - minX + pad * 2);
    const h = Math.ceil(maxY - minY + pad * 2);
    return `${x} ${y} ${Math.max(w, 400)} ${Math.max(h, 300)}`;
  }, [zones]);

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

  async function handleAddToCartOnly() {
    if (!activeFunction || !activeZone) return;
    setIsAdding(true);
    setCartAddedMessage(null);
    try {
      await addToCart({
        functionId: activeFunction.id,
        zoneId: activeZone.id,
        seatIds: [...selectedSeats],
        quantity: qty,
      });
      setCartAddedMessage("¡Añadido al carrito con éxito! 🛒");
      setTimeout(() => setCartAddedMessage(null), 3500);
      router.refresh();
    } catch (err: any) {
      console.error("Error añadiendo al carrito:", err);
      alert("Error al añadir al carrito.");
    } finally {
      setIsAdding(false);
    }
  }

  async function continueToCheckout() {
    if (!activeFunction || !activeZone) return;
    setIsAdding(true);
    try {
      await addToCart({
        functionId: activeFunction.id,
        zoneId: activeZone.id,
        seatIds: [...selectedSeats],
        quantity: qty,
      });

      const params = new URLSearchParams();
      params.set("functionId", activeFunction.id);
      params.set("zoneId", activeZone.id);
      if (selectedSeats.size > 0) {
        params.set("seats", [...selectedSeats].join(","));
      } else {
        params.set("qty", qty.toString());
      }
      router.push(`/checkout?${params.toString()}`);
    } catch (err) {
      console.error("Error al ir a pagar:", err);
      router.push(`/checkout?functionId=${activeFunction.id}&zoneId=${activeZone.id}&qty=${qty}`);
    } finally {
      setIsAdding(false);
    }
  }

  if (functions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-6 text-center py-12">
        <p className="text-3xl mb-3">📅</p>
        <p className="text-sm font-semibold text-muted">Este evento aún no tiene funciones disponibles.</p>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     STEP 2: Full-screen large map + seat picker
  ───────────────────────────────────────────────────────────── */
  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090f] flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0 bg-[#09090f]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={() => { setStep(1); setSelectedSeats(new Set()); }}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors"
          >
            ← Volver
          </button>
          <div className="text-center">
            <p className="text-xs text-muted">Selecciona tu ubicación</p>
            <p className="font-black text-white text-sm truncate max-w-[180px]">{event.name}</p>
          </div>
          <div className="text-right text-xs min-w-[90px]">
            {activeZone && (
              <span className="text-accent-2 font-bold">
                {activeZone.name}
              </span>
            )}
          </div>
        </div>
        {/* Content area */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          {/* Map area */}
          {hasVisualMap && (
            <div className="w-full lg:flex-1 flex flex-col items-center justify-center p-2 sm:p-4 bg-[#06060c] overflow-auto min-h-[42vh] lg:min-h-0">
              <div className="w-full max-w-5xl">
                <p className="text-center text-xs text-muted mb-2">💡 Toca una zona del mapa para seleccionarla</p>
                {(() => {
                  const bboxParts = mapBoundingBox.split(" ").map(Number);
                  const bx = bboxParts[0] || 0;
                  const by = bboxParts[1] || 0;
                  const bw = bboxParts[2] || 1200;
                  const bh = bboxParts[3] || 600;
                  const stageX = bx + Math.max(0, (bw - 500) / 2);
                  const stageY = Math.max(10, by + 10);

                  return (
                    <svg
                      viewBox={mapBoundingBox}
                      className="w-full h-auto"
                      style={{ maxHeight: "calc(100vh - 220px)" }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <rect x={bx - 200} y={by - 200} width={bw + 400} height={bh + 400} fill="#06060c" />
                      <g opacity="0.08">
                        {Array.from({ length: 30 }, (_, i) => (
                          <line key={`v${i}`} x1={bx + i * 50} y1={by} x2={bx + i * 50} y2={by + bh} stroke="#ffffff" strokeWidth="0.5" />
                        ))}
                        {Array.from({ length: 20 }, (_, i) => (
                          <line key={`h${i}`} x1={bx} y1={by + i * 50} x2={bx + bw} y2={by + i * 50} stroke="#ffffff" strokeWidth="0.5" />
                        ))}
                      </g>
                      {/* Stage */}
                      <rect x={stageX} y={stageY} width={500} height={50} rx={14} fill="#141428" stroke="#7c3aed" strokeWidth="2.5" />
                      <text x={stageX + 250} y={stageY + 25} textAnchor="middle" dominantBaseline="central" fill="#a78bfa" fontSize="16" fontWeight="900" letterSpacing="6">★ ESCENARIO ★</text>

                      {zones.map((z) => {
                        if (!z.map_coords) return null;
                        const isActive = activeZone?.id === z.id;
                        const pts = parseCoords(z.map_coords);
                        let sumX = 0, sumY = 0, count = 0;
                        let minPX = Infinity, maxPX = -Infinity;
                        pts.forEach((p) => {
                          sumX += p.x; sumY += p.y; count++;
                          if (p.x < minPX) minPX = p.x;
                          if (p.x > maxPX) maxPX = p.x;
                        });
                        const cx = count > 0 ? sumX / count : 0;
                        const cy = count > 0 ? sumY / count : 0;
                        const zoneWidth = maxPX - minPX;
                        const pricing = getZonePricing(z);
                        const lockInfo = zoneLockStatus[z.id];
                        const isLocked = Boolean(lockInfo?.isLocked);

                        return (
                          <g key={z.id} className="group cursor-pointer" onClick={() => handleSelectZone(z)}>
                            <polygon
                              points={z.map_coords}
                              fill={isLocked ? "#1e1e2d" : z.color}
                              fillOpacity={isLocked ? 0.35 : (isActive ? 0.88 : 0.55)}
                              stroke={isLocked ? "#4b5563" : (isActive ? "#ffffff" : z.color)}
                              strokeWidth={isActive ? 3.5 : 2}
                              className="transition-all duration-200 hover:fill-opacity-90"
                            />
                            {cx > 0 && (
                              <g className="pointer-events-none">
                                {zoneWidth > 110 ? (
                                  <g>
                                    <rect
                                      x={cx - 65} y={cy - 15}
                                      width={130} height={30} rx={15}
                                      fill="rgba(6, 6, 12, 0.92)"
                                      stroke={isActive ? "#ffffff" : z.color}
                                      strokeWidth={isActive ? 2 : 1.5}
                                    />
                                    <text x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="11" fontWeight="bold">{z.name}</text>
                                    <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="central" fill={isActive ? "#fde047" : "#c4b5fd"} fontSize="9.5" fontWeight="bold">
                                      {formatCOP(pricing.currentPrice)}
                                    </text>
                                  </g>
                                ) : (
                                  <g>
                                    <text
                                      x={cx} y={cy - 5}
                                      textAnchor="middle" dominantBaseline="central"
                                      fill="#ffffff" stroke="#000000" strokeWidth="3.5" paintOrder="stroke fill"
                                      fontSize="12" fontWeight="900"
                                    >
                                      {z.name}
                                    </text>
                                    <text
                                      x={cx} y={cy + 9}
                                      textAnchor="middle" dominantBaseline="central"
                                      fill={isActive ? "#fde047" : "#38bdf8"} stroke="#000000" strokeWidth="3" paintOrder="stroke fill"
                                      fontSize="10" fontWeight="800"
                                    >
                                      {formatCOP(pricing.currentPrice)}
                                    </text>
                                  </g>
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
          )}

          {/* Right/Bottom panel: zones + seat grid + actions */}
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden bg-[#09090f] max-h-[50vh] lg:max-h-none">







            {/* Zone list */}
            <div className="p-3 border-b border-white/10 overflow-y-auto max-h-60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-1 mb-2">Zonas disponibles</p>
              <div className="space-y-1.5">
                {zones.map((z: Zone) => {
                  const pricing = getZonePricing(z);
                  const isActive = activeZone?.id === z.id;
                  const avail = (z.capacity ?? Infinity) - z.sold_count;
                  const lockInfo = zoneLockStatus[z.id];
                  const isLocked = Boolean(z.is_locked || lockInfo?.isLocked);
                  return (
                    <button
                      key={z.id}
                      type="button"
                      disabled={avail <= 0 || isLocked}
                      onClick={() => handleSelectZone(z)}
                      className={`w-full rounded-xl p-2.5 text-left text-xs transition-all flex items-center gap-2 ${
                        isActive ? "bg-white/15 border border-white/25" : "bg-white/5 border border-transparent hover:bg-white/10"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: z.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-white truncate">{z.name}</p>
                          {z.sale_type === "full_zone" ? (
                            <span className="rounded bg-cyan-600/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">PALCO COMPLETO</span>
                          ) : z.has_seats === false ? (
                            <span className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">🧍 DE PIE</span>
                          ) : (
                            <span className="rounded bg-purple-600/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">SILLAS</span>
                          )}
                        </div>
                        <p className="text-muted truncate">
                          {z.is_locked ? (
                            <span className="text-amber-400 font-semibold">🔒 Bloqueada por organizador</span>
                          ) : isLocked ? (
                            <span className="text-amber-400 font-semibold">🔒 Habilita al quedar ≤5 en {lockInfo?.unlockThresholdPrevZoneName}</span>
                          ) : z.sale_type === "full_zone" ? (
                            <span className="text-cyan-400 font-semibold">{z.capacity ?? 1} entradas incl.</span>
                          ) : avail <= 0 ? (
                            "Agotado"
                          ) : (
                            `${avail} disp.`
                          )}
                          {pricing.isPresale && <span className="ml-1 text-pink-400">• PREVENTA</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {pricing.isPresale && <p className="text-[9px] text-muted line-through">{formatCOP(pricing.fullPrice)}</p>}
                        <p className="font-black text-accent-2">{isLocked ? "🔒 Bloqueado" : formatCOP(pricing.currentPrice)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seat grid (assigned mode) */}
            {hasAssignedSeats && activeZone && (
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                  Sillas — {selectedSeats.size} seleccionada(s)
                </p>
                <div className="space-y-1">
                  {rows.map((row) => (
                    <div key={row} className="flex items-center gap-1 flex-wrap">
                      <span className="w-4 text-right text-[9px] text-muted shrink-0">{row}</span>
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
                              className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-xs font-bold transition-all disabled:cursor-not-allowed touch-manipulation active:scale-95 shrink-0"
                              style={
                                taken
                                  ? { background: "#3f3f52", color: "#6b6b80" }
                                  : picked
                                    ? { background: "linear-gradient(135deg,#7c3aed,#ec4899)", color: "#fff", boxShadow: "0 0 10px rgba(124,58,237,0.5)" }
                                    : { background: "rgba(255,255,255,0.07)", color: "var(--foreground)" }
                              }
                            >
                              {s.number}
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[9px] text-muted">
                  <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded" style={{ background: "rgba(255,255,255,0.07)" }} />Disponible</span>
                  <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }} />Seleccionada</span>
                  <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded" style={{ background: "#3f3f52" }} />Ocupada</span>
                </div>
              </div>
            )}

            {/* Qty — general mode only */}
            {!hasAssignedSeats && activeZone && activeZone.sale_type !== "full_zone" && (
              <div className="p-3 border-t border-white/10">
                <p className="text-xs text-muted mb-2">Cantidad de boletas</p>
                <div className="flex items-center gap-3">
                  <button type="button" className="btn-outline h-9 w-9 rounded-lg !px-0" onClick={() => setQty((n) => Math.max(1, n - 1))}>−</button>
                  <span className="w-8 text-center font-black text-lg">{qty}</span>
                  <button type="button" className="btn-outline h-9 w-9 rounded-lg !px-0" onClick={() => setQty((n) => Math.min(10, n + 1))}>+</button>
                </div>
              </div>
            )}

            {/* CTA bottom */}
            <div className="p-3 border-t border-white/10 bg-[#09090f]/80 shrink-0">
              {cartAddedMessage && (
                <div className="mb-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-2 text-xs text-emerald-300 font-bold text-center">
                  {cartAddedMessage}
                </div>
              )}
              {activeZone?.sale_type === "full_zone" && (
                <div className="mb-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[10px] text-cyan-200 text-center">
                  🎪 Palco completo · {activeZone.capacity ?? 1} entradas
                </div>
              )}
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-muted">
                  {hasAssignedSeats ? `${selectedSeats.size} silla(s)` : `${qty} boleta(s)`}
                </span>
                <span className="font-black text-white">
                  {activeZone ? formatCOP(getZonePricing(activeZone).currentPrice * (hasAssignedSeats ? (selectedSeats.size || 1) : qty)) : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-outline flex-1 py-3 text-xs font-bold"
                  type="button"
                  onClick={handleAddToCartOnly}
                  disabled={isAdding || (hasAssignedSeats ? selectedSeats.size === 0 : !activeZone)}
                >
                  {isAdding ? "Añadiendo..." : "🛒 Al carrito"}
                </button>
                <button
                  className="btn-primary flex-1 py-3 text-xs font-black"
                  type="button"
                  onClick={continueToCheckout}
                  disabled={isAdding || (hasAssignedSeats ? selectedSeats.size === 0 : !activeZone)}
                >
                  ⚡ Confirmar y pagar
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

  /* ─────────────────────────────────────────────────────────────
     STEP 1: Function + Zone selection — compact single card
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-3">
      {/* Function selector — dropdown when multiple */}
      {functions.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <h2 className="text-sm font-black text-white mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-[9px] font-black text-white shrink-0">1</span>
            Función
          </h2>
          <SafeDateRender>
            <select
              className="input w-full text-sm"
              value={functionId}
              onChange={(e) => { setFunctionId(e.target.value); setSelectedSeats(new Set()); setZoneId(""); }}
            >
              {functions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || "Función principal"} · {formatDateTime(f.starts_at)}
                </option>
              ))}
            </select>
          </SafeDateRender>
        </div>
      )}

      {/* Main card: zone list + qty + CTA all in one */}
      <div className="rounded-2xl border border-white/10 bg-surface overflow-hidden">

        {/* Zone list header */}
        <div className="px-4 pt-4 pb-2 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-black text-white flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-400 text-[9px] font-black text-white shrink-0">
              {functions.length > 1 ? "2" : "1"}
            </span>
            Zona
          </h2>
          {activeZone && (
            <span className="text-[10px] font-bold text-accent-2 truncate ml-2 max-w-[180px]">
              ✓ {activeZone.name} · {formatCOP(getZonePricing(activeZone).currentPrice)}
            </span>
          )}
        </div>

        {/* Scrollable zone list */}
        <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
          {zones.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted text-center py-6">Sin zonas configuradas.</p>
          ) : (
            <div className="p-2 space-y-1.5">
              {zones.map((z: Zone) => {
                const available = (z.capacity ?? Infinity) - z.sold_count;
                const lockInfo = zoneLockStatus[z.id];
                const isLocked = Boolean(lockInfo?.isLocked);
                const disabled = available <= 0 || isLocked;
                const pricing = getZonePricing(z);
                const isActive = activeZone?.id === z.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelectZone(z)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      isActive
                        ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/50"
                        : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-1.5 rounded-full shrink-0" style={{ background: z.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-xs sm:text-sm text-white">{z.name}</p>
                          {z.sale_type === "full_zone" ? (
                            <span className="rounded bg-cyan-600/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">🎪 PALCO COMPLETO</span>
                          ) : z.has_seats === false ? (
                            <span className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">🧍 DE PIE / SIN SILLAS</span>
                          ) : (
                            <span className="rounded bg-purple-600/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">🪑 VENTA POR SILLAS</span>
                          )}
                          {pricing.isPresale && (
                            <span className="rounded bg-pink-600/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">PREVENTA</span>
                          )}
                        </div>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {z.is_locked ? <span className="text-amber-400 font-semibold">🔒 Bloqueada por organizador</span> : isLocked ? <span className="text-amber-400 font-semibold">🔒 Habilita al quedar ≤5 en {lockInfo?.unlockThresholdPrevZoneName}</span> : z.sale_type === "full_zone"
                            ? <span className="text-cyan-400 font-semibold">{z.capacity ?? 1} entradas incl.</span>
                            : disabled ? "Agotado" : `${available.toLocaleString("es-CO")} dispon.`
                          }
                          {pricing.isPresale && pricing.presaleEndAt && (
                            <SafeDateRender>
                              <span className="ml-1 text-pink-400 font-semibold">hasta {formatDate(pricing.presaleEndAt)}</span>
                            </SafeDateRender>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {pricing.isPresale && (
                          <p className="text-[10px] text-muted line-through leading-none">{formatCOP(pricing.fullPrice)}</p>
                        )}
                        <p className="font-black text-amber-400 text-sm sm:text-base leading-tight">{isLocked ? "🔒 Bloqueado" : formatCOP(pricing.currentPrice)}</p>
                        {pricing.isPresale && pricing.savings > 0 && (
                          <p className="text-[9px] text-green-400 font-bold leading-none mt-0.5">-{formatCOP(pricing.savings)}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-white/5" />

        {/* Qty row — general individual zones only */}
        {activeZone && event.sale_mode === "general" && activeZone.sale_type !== "full_zone" && (
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
            <span className="text-xs sm:text-sm font-bold text-white">Cantidad de entradas</span>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-outline h-9 w-9 rounded-xl !px-0 text-base font-black hover:bg-purple-600 active:scale-95" onClick={() => setQty((n) => Math.max(1, n - 1))}>-</button>
              <span className="w-8 text-center font-black text-base text-purple-300">{qty}</span>
              <button type="button" className="btn-outline h-9 w-9 rounded-xl !px-0 text-base font-black hover:bg-purple-600 active:scale-95" onClick={() => setQty((n) => Math.min(10, n + 1))}>+</button>
            </div>
          </div>
        )}

        {/* Palco completo notice */}
        {activeZone?.sale_type === "full_zone" && (
          <div className="mx-3 my-2 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.08] px-3 py-2 text-[10px] text-cyan-200 border-b border-white/5">
            Palco Completo: {activeZone.name} incluye {activeZone.capacity ?? 1} entradas
          </div>
        )}

        {/* CTA — always visible */}
        <div className="px-4 py-4">
          {cartAddedMessage && (
            <div className="mb-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 font-bold text-center">
              {cartAddedMessage}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-muted leading-none">
                {event.sale_mode === "assigned" ? "Precio / boleta" : `${qty} boleta(s) · ${activeZone?.name ?? "Sin zona"}`}
              </p>
              {activeZone ? (
                <p className="text-xl font-black text-white mt-0.5 leading-none">
                  {event.sale_mode === "general"
                    ? formatCOP(getZonePricing(activeZone).currentPrice * qty)
                    : formatCOP(getZonePricing(activeZone).currentPrice) + " / boleta"}
                </p>
              ) : (
                <p className="text-xs text-muted mt-0.5">Selecciona una zona</p>
              )}
            </div>
            {activeZone && getZonePricing(activeZone).isPresale && (
              <span className="shrink-0 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-2.5 py-1 text-[10px] font-black text-white">PREVENTA</span>
            )}
          </div>

          {(hasVisualMap || hasAssignedSeats) ? (
            <button className="btn-primary w-full" type="button" disabled={!activeZone} onClick={() => setStep(2)}>
              {hasAssignedSeats ? "Ver mapa y elegir asientos" : "Ver mapa del venue"}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                className="btn-outline flex-1 py-3 text-xs font-bold"
                type="button"
                onClick={handleAddToCartOnly}
                disabled={isAdding || !activeZone}
              >
                {isAdding ? "Añadiendo..." : "🛒 Al carrito"}
              </button>
              <button
                className="btn-primary flex-1 py-3 text-xs font-black"
                type="button"
                onClick={continueToCheckout}
                disabled={isAdding || !activeZone}
              >
                ⚡ Comprar ahora
              </button>
            </div>
          )}
          <p className="mt-2 text-center text-[10px] text-muted">Pago seguro · Boleta digital instantánea</p>
        </div>
      </div>
    </div>
  );
}
