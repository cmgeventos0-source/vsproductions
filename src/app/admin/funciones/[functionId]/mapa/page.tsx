"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveZoneCoordinatesAction, renameZoneAction, divideZoneAction, addZoneAction, deleteZoneAction, updateZoneAction } from "../../../../actions";
import { formatCOP } from "@/lib/format";
import { getZonePricing } from "@/lib/pricing";
import type { Zone } from "@/lib/types";

function getCentroid(coordsStr: string) {
  const pairs = coordsStr.trim().split(/\s+/);
  let sx = 0, sy = 0, n = 0;
  for (const p of pairs) {
    const [x, y] = p.split(",").map(Number);
    if (!isNaN(x) && !isNaN(y)) { sx += x; sy += y; n++; }
  }
  return n === 0 ? { x: 0, y: 0 } : { x: sx / n, y: sy / n };
}

function ptStr(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
}

function parseCoords(coordsStr: string): { x: number; y: number }[] {
  return coordsStr.trim().split(/\s+/).map((p) => {
    const [x, y] = p.split(",").map(Number);
    return { x, y };
  }).filter((p) => !isNaN(p.x) && !isNaN(p.y));
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 3) return ptStr(pts);
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    d += ` Q ${a.x},${a.y} ${mx},${my}`;
  }
  return d + " Z";
}

function pointInPoly(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

type FunctionRow = {
  id: string;
  name: string | null;
  starts_at: string;
  event: { id: string; name: string; slug: string } | null;
  zones: Zone[];
};

const SVG_W = 1200;
const SVG_H = 700;
const VERTEX_R = 6;
const HIT_R = 16;
const PALETTE = ["#e11d48", "#7c3aed", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#f97316"];

type Tool = "select" | "draw";

type Template = { id: string; name: string; icon: string; gen: () => { x: number; y: number }[] };

const TEMPLATES: Template[] = [
  { id: "rect", name: "Rectangulo", icon: "▬", gen: () => [{ x: 300, y: 120 }, { x: 900, y: 120 }, { x: 900, y: 380 }, { x: 300, y: 380 }] },
  { id: "arc", name: "Arco (estadio)", icon: "◠", gen: () => [{ x: 250, y: 100 }, { x: 600, y: 80 }, { x: 950, y: 100 }, { x: 920, y: 260 }, { x: 600, y: 280 }, { x: 280, y: 260 }] },
  { id: "circle", name: "Elipse", icon: "◯", gen: () => { const cx = 600, cy = 350, rx = 250, ry = 120; const pts: { x: number; y: number }[] = []; for (let i = 0; i < 16; i++) { const a = (Math.PI * 2 * i) / 16; pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); } return pts; } },
  { id: "trap", name: "Escalera/Trapezoide", icon: "⏢", gen: () => [{ x: 350, y: 150 }, { x: 850, y: 150 }, { x: 950, y: 450 }, { x: 250, y: 450 }] },
  { id: "lateral", name: "Lateral", icon: "◧", gen: () => [{ x: 100, y: 120 }, { x: 300, y: 120 }, { x: 350, y: 500 }, { x: 100, y: 500 }] },
];

export default function MapEditorPage() {
  const { functionId } = useParams<{ functionId: string }>();
  const router = useRouter();
  const [fn, setFn] = useState<FunctionRow | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [editPoints, setEditPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragPolygon, setDragPolygon] = useState<{ startX: number; startY: number; origPts: { x: number; y: number }[] } | null>(null);
  const [insertIdx, setInsertIdx] = useState<number | null>(null);

  const [showGrid, setShowGrid] = useState(true);
  const [snapGrid, setSnapGrid] = useState(true);
  const [curved, setCurved] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [divideModal, setDivideModal] = useState<Zone | null>(null);
  const [divideCount, setDivideCount] = useState(6);
  const [divideCapacity, setDivideCapacity] = useState(4);
  const [dividePrefix, setDividePrefix] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZonePrice, setNewZonePrice] = useState(0);
  const [newZonePresalePrice, setNewZonePresalePrice] = useState<number | null>(null);
  const [newZonePresaleEndAt, setNewZonePresaleEndAt] = useState("");
  const [newZoneSaleType, setNewZoneSaleType] = useState<"individual" | "full_zone">("individual");
  const [newZoneCapacity, setNewZoneCapacity] = useState<number | null>(null);
  const [newZoneColor, setNewZoneColor] = useState(PALETTE[0]);

  const [editDetailsModal, setEditDetailsModal] = useState<Zone | null>(null);
  const [editZoneName, setEditZoneName] = useState("");
  const [editZonePrice, setEditZonePrice] = useState(0);
  const [editZonePresalePrice, setEditZonePresalePrice] = useState<number | null>(null);
  const [editZonePresaleEndAt, setEditZonePresaleEndAt] = useState("");
  const [editZoneSaleType, setEditZoneSaleType] = useState<"individual" | "full_zone">("individual");
  const [editZoneCapacity, setEditZoneCapacity] = useState<number | null>(null);
  const [editZoneColor, setEditZoneColor] = useState(PALETTE[0]);

  useEffect(() => {
    if (!functionId) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("event_functions")
          .select("id, event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at, is_active")
          .eq("id", functionId)
          .maybeSingle();

        if (data) {
          let event = null;
          if (data.event_id) {
            const { data: ev } = await supabase.from("events").select("id, name, slug").eq("id", data.event_id).maybeSingle();
            event = ev;
          }
          const fn = { ...data, event, zones: [] };
          setFn(fn as unknown as FunctionRow);

          const { data: zones } = await supabase.from("zones").select("*").eq("function_id", functionId);
          const sorted = [...(zones ?? [])].sort((a: Zone, b: Zone) => a.sort_order - b.sort_order);
          setZones(sorted);
          if (sorted.length > 0) setActiveZoneId(sorted[0].id);
        }
      } catch (err) {
        console.error("Error loading function map data:", err);
      }
    })();
  }, [functionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "z" && drawing && points.length > 0) { setPoints((prev) => prev.slice(0, -1)); }
      if (e.key === "Escape") { if (drawing) { setPoints([]); setDrawing(false); setTool("select"); } else { cancelEdit(); } }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, [drawing, points.length]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const toSvg = useCallback((e: React.MouseEvent | MouseEvent | React.WheelEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * SVG_W, y: ((e.clientY - rect.top) / rect.height) * SVG_H };
  }, []);

  const snap = (v: number) => snapGrid ? Math.round(v / 10) * 10 : Math.round(v);

  const activeZone = zones.find((z) => z.id === activeZoneId);
  const parentZones = zones.filter((z) => !z.parent_id);
  const childrenOf = (pid: string) => zones.filter((z) => z.parent_id === pid);

  const viewBox = `0 0 ${SVG_W} ${SVG_H}`;

  function handleSvgMouseDown(e: React.MouseEvent) {
    if (drawing) return;
    if (tool === "select" && editPoints) {
      const pt = toSvg(e);
      let closest = -1, cd = Infinity;
      for (let i = 0; i < editPoints.length; i++) {
        const dx = pt.x - editPoints[i].x, dy = pt.y - editPoints[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < HIT_R && dist < cd) { cd = dist; closest = i; }
      }
      if (closest >= 0) { setDragIdx(closest); return; }
      const pts = editPoints;
      if (pointInPoly(pt.x, pt.y, pts)) {
        setDragPolygon({ startX: pt.x, startY: pt.y, origPts: [...pts] });
        return;
      }
      if (insertIdx !== null && editPoints.length >= 2) {
        const newPts = [...editPoints];
        newPts.splice(insertIdx, 0, { x: snap(pt.x), y: snap(pt.y) });
        setEditPoints(newPts);
        setInsertIdx(null);
        return;
      }
    }
  }

  function handleSvgClick(e: React.MouseEvent) {
    if (e.button === 1) return;
    if (drawing) {
      const pt = toSvg(e);
      if (points.length > 2) {
        const d0 = Math.sqrt((pt.x - points[0].x) ** 2 + (pt.y - points[0].y) ** 2);
        if (d0 < HIT_R) { finishPolygon(); return; }
      }
      setPoints((prev) => [...prev, { x: snap(pt.x), y: snap(pt.y) }]);
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (dragIdx !== null && editPoints) {
      const pt = toSvg(e);
      const snapped = { x: snap(pt.x), y: snap(pt.y) };
      setEditPoints((prev) => { if (!prev) return prev; const next = [...prev]; next[dragIdx] = snapped; return next; });
      return;
    }
    if (dragPolygon && editPoints) {
      const pt = toSvg(e);
      const dx = pt.x - dragPolygon.startX;
      const dy = pt.y - dragPolygon.startY;
      setEditPoints(dragPolygon.origPts.map((p) => ({ x: snap(p.x + dx), y: snap(p.y + dy) })));
      return;
    }
    if (editPoints && editPoints.length >= 2 && dragIdx === null && !dragPolygon) {
      const pt = toSvg(e);
      let closestIdx = -1, closestDist = Infinity;
      for (let i = 0; i < editPoints.length; i++) {
        const a = editPoints[i];
        const b = editPoints[(i + 1) % editPoints.length];
        const ex = b.x - a.x, ey = b.y - a.y;
        const lenSq = ex * ex + ey * ey;
        let t = lenSq === 0 ? 0 : ((pt.x - a.x) * ex + (pt.y - a.y) * ey) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t * ex - pt.x, py = a.y + t * ey - pt.y;
        const dist = Math.sqrt(px * px + py * py);
        if (dist < HIT_R && dist < closestDist) { closestDist = dist; closestIdx = i + 1; }
      }
      setInsertIdx(closestIdx >= 0 ? closestIdx : null);
    }
  }

  function handleMouseUp() {
    setDragIdx(null);
    setDragPolygon(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (drawing && points.length > 0) {
      setPoints((prev) => prev.slice(0, -1));
      return;
    }
    if (!editPoints) return;
    const pt = toSvg(e);
    let ci = -1, cd = Infinity;
    for (let i = 0; i < editPoints.length; i++) {
      const dx = pt.x - editPoints[i].x, dy = pt.y - editPoints[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < HIT_R && dist < cd) { cd = dist; ci = i; }
    }
    if (ci >= 0 && editPoints.length > 3) {
      setEditPoints(editPoints.filter((_, i) => i !== ci));
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (drawing && points.length >= 3) finishPolygon();
  }

  async function finishPolygon() {
    if (!activeZoneId || points.length < 3) return;
    const coords = ptStr(points);
    setSaving(activeZoneId);
    const res = await saveZoneCoordinatesAction(activeZoneId, coords);
    setSaving(null);
    if (res.success) {
      setZones((prev) => prev.map((z) => (z.id === activeZoneId ? { ...z, map_coords: coords } : z)));
      showToast("Poligono guardado");
    } else {
      showToast("Error: " + res.error);
    }
    setPoints([]);
    setDrawing(false);
  }

  async function clearZone(zoneId: string) {
    setSaving(zoneId);
    await saveZoneCoordinatesAction(zoneId, null);
    setSaving(null);
    setZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, map_coords: null } : z)));
    setEditPoints(null);
    showToast("Zona limpiada");
  }

  function startEditZone(z: Zone) {
    if (!z.map_coords) return;
    setActiveZoneId(z.id);
    setEditPoints(parseCoords(z.map_coords));
    setTool("select");
    setPoints([]);
    setDrawing(false);
  }

  function cancelEdit() { setEditPoints(null); setDragIdx(null); setDragPolygon(null); setInsertIdx(null); }

  async function saveEdit() {
    if (!activeZoneId || !editPoints || editPoints.length < 3) return;
    const coords = ptStr(editPoints);
    setSaving(activeZoneId);
    const res = await saveZoneCoordinatesAction(activeZoneId, coords);
    setSaving(null);
    if (res.success) {
      setZones((prev) => prev.map((z) => (z.id === activeZoneId ? { ...z, map_coords: coords } : z)));
      showToast("Poligono actualizado");
    } else {
      showToast("Error: " + res.error);
    }
    setEditPoints(null);
  }

  function removeVertex(idx: number) {
    if (!editPoints) return;
    const next = editPoints.filter((_, i) => i !== idx);
    if (next.length < 3) { showToast("Minimo 3 vertices"); return; }
    setEditPoints(next);
  }

  async function handleRename(z: Zone) {
    if (!renameValue.trim() || renameValue === z.name) { setRenamingId(null); return; }
    const res = await renameZoneAction(z.id, renameValue.trim());
    if (res.success) { setZones((prev) => prev.map((zz) => zz.id === z.id ? { ...zz, name: renameValue.trim() } : zz)); showToast("Renombrado"); }
    else showToast("Error: " + res.error);
    setRenamingId(null);
  }

  async function handleDivide() {
    if (!divideModal) return;
    const prefix = dividePrefix.trim() || divideModal.name;
    const divisions = Array.from({ length: divideCount }, (_, i) => ({ name: `${prefix} ${i + 1}`, capacity: divideCapacity }));
    setSaving(divideModal.id);
    const res = await divideZoneAction(divideModal.id, divisions);
    setSaving(null);
    if (res.success && res.zones) { setZones((prev) => [...prev, ...res.zones]); showToast(`${divisions.length} subzonas creadas`); }
    else showToast("Error: " + (res.error ?? ""));
    setDivideModal(null);
  }

  async function handleAddZone() {
    if (!fn || !newZoneName.trim()) return;
    setSaving("new");
    try {
      let presaleEndIso: string | null = null;
      if (newZonePresaleEndAt && newZonePresaleEndAt.trim() !== "") {
        const d = new Date(newZonePresaleEndAt);
        if (!isNaN(d.getTime())) presaleEndIso = d.toISOString();
      }

      const res = await addZoneAction(
        fn.id,
        newZoneName.trim(),
        newZonePrice,
        newZoneCapacity,
        newZoneColor,
        newZonePresalePrice,
        presaleEndIso,
        newZoneSaleType
      );
      setSaving(null);
      if (res.success && res.zone) {
        setZones((prev) => [...prev, res.zone]);
        setActiveZoneId(res.zone.id);
        showToast(`"${res.zone.name}" creada`);
        setAddModal(false);
        setNewZoneName("");
        setNewZonePrice(0);
        setNewZonePresalePrice(null);
        setNewZonePresaleEndAt("");
        setNewZoneCapacity(null);
        setNewZoneSaleType("individual");
      } else {
        alert("Error al crear zona: " + (res.error ?? "Desconocido"));
        showToast("Error: " + (res.error ?? "Desconocido"));
      }
    } catch (err: any) {
      setSaving(null);
      alert("Excepción al crear zona: " + (err.message ?? err));
      showToast("Error: " + (err.message ?? err));
    }
  }

  function openEditDetails(z: Zone) {
    setEditDetailsModal(z);
    setEditZoneName(z.name);
    setEditZonePrice(z.price);
    setEditZonePresalePrice(z.presale_price ?? null);
    setEditZonePresaleEndAt(z.presale_end_at ? new Date(z.presale_end_at).toISOString().slice(0, 16) : "");
    setEditZoneSaleType(z.sale_type ?? "individual");
    setEditZoneCapacity(z.capacity);
    setEditZoneColor(z.color);
  }

  async function handleSaveEditZone() {
    if (!editDetailsModal || !editZoneName.trim()) return;
    setSaving(editDetailsModal.id);
    try {
      let editPresaleEndIso: string | null = null;
      if (editZonePresaleEndAt && editZonePresaleEndAt.trim() !== "") {
        const d = new Date(editZonePresaleEndAt);
        if (!isNaN(d.getTime())) editPresaleEndIso = d.toISOString();
      }

      const res = await updateZoneAction(editDetailsModal.id, {
        name: editZoneName.trim(),
        price: editZonePrice,
        presale_price: editZonePresalePrice,
        presale_end_at: editPresaleEndIso,
        sale_type: editZoneSaleType,
        capacity: editZoneCapacity,
        color: editZoneColor,
      });
      setSaving(null);
      if (res.success && res.zone) {
        setZones((prev) => prev.map((z) => (z.id === editDetailsModal.id ? { ...z, ...res.zone } : z)));
        showToast("Zona actualizada correctamente");
        setEditDetailsModal(null);
      } else {
        alert("Error al actualizar zona: " + (res.error ?? "Desconocido"));
        showToast("Error: " + (res.error ?? "Desconocido"));
      }
    } catch (err: any) {
      setSaving(null);
      alert("Excepción al actualizar zona: " + (err.message ?? err));
      showToast("Error: " + (err.message ?? err));
    }
  }

  async function handleDeleteZone(z: Zone) {
    if (!confirm(`Eliminar "${zname(z)}" y sus subdivisiones?`)) return;
    setSaving(z.id);
    const res = await deleteZoneAction(z.id);
    setSaving(null);
    if (!res.success) {
      showToast("Error: " + (res.error ?? "No se pudo eliminar"));
      return;
    }
    setZones((prev) => prev.filter((zz) => zz.id !== z.id && zz.parent_id !== z.id));
    if (activeZoneId === z.id) { setActiveZoneId(null); setEditPoints(null); }
    showToast("Eliminada");
  }

  function zname(z: Zone) { return z.name; }

  function applyTemplate(t: Template) {
    if (!activeZoneId) { showToast("Selecciona una zona primero"); return; }
    const coords = ptStr(t.gen());
    saveZoneCoordinatesAction(activeZoneId, coords).then((res) => {
      if (res.success) {
        setZones((prev) => prev.map((z) => (z.id === activeZoneId ? { ...z, map_coords: coords } : z)));
        startEditZone({ ...activeZone!, map_coords: coords });
        showToast(`Plantilla "${t.name}" aplicada`);
      }
    });
  }

  const cursorStyle = drawing ? "crosshair" : "default";

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <button onClick={() => router.push("/admin")} className="btn-outline text-xs">Volver</button>
          <div>
            <h1 className="text-2xl font-black text-white">Editor de Mapa</h1>
            {fn && <p className="text-sm text-muted mt-0.5">{fn.event?.name} · {fn.name || new Date(fn.starts_at).toLocaleString("es-CO")}</p>}
          </div>
        </div>

        {!fn ? <p className="text-center text-muted py-20">Cargando...</p> : (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Zonas ({zones.length})</h2>
                  <button onClick={() => setAddModal(true)} className="btn-primary text-xs !px-3 !py-1.5">+ Nueva</button>
                </div>
                {parentZones.map((z) => {
                  const children = childrenOf(z.id);
                  return (
                    <div key={z.id} className="space-y-1">
                      <ZoneRow zone={z} active={activeZoneId === z.id} renamingId={renamingId} renameValue={renameValue}
                        onSetRename={setRenameValue} onStartRename={(zz) => { setRenamingId(zz.id); setRenameValue(zz.name); }}
                        onConfirmRename={handleRename} onCancelRename={() => setRenamingId(null)}
                        onSelect={() => { cancelEdit(); setActiveZoneId(z.id); setPoints([]); setDrawing(false); setTool("select"); }}
                        onEdit={() => startEditZone(z)} onEditDetails={() => openEditDetails(z)} onDivide={() => { setDivideModal(z); setDividePrefix(z.name); }}
                        onDelete={() => handleDeleteZone(z)} saving={saving} childCount={children.length} />
                      {children.map((child) => (
                        <div key={child.id} className="pl-4">
                          <ZoneRow zone={child} active={activeZoneId === child.id} renamingId={renamingId} renameValue={renameValue}
                            onSetRename={setRenameValue} onStartRename={(zz) => { setRenamingId(zz.id); setRenameValue(zz.name); }}
                            onConfirmRename={handleRename} onCancelRename={() => setRenamingId(null)}
                            onSelect={() => { cancelEdit(); setActiveZoneId(child.id); setPoints([]); setDrawing(false); setTool("select"); }}
                            onEdit={() => startEditZone(child)} onEditDetails={() => openEditDetails(child)} onDelete={() => handleDeleteZone(child)}
                            saving={saving} isChild />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {activeZone && (
                <div className="card p-4 space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Controles · {activeZone.name}</h2>
                  {editPoints ? (
                    <>
                      <p className="text-xs text-muted">Arrastra poligono para mover. Vertices grises para redibujar. Click en borde para agregar punto.</p>
                      <p className="text-xs font-semibold text-purple-300">{editPoints.length} vertices</p>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={editPoints.length < 3 || saving === activeZoneId} className="btn-primary flex-1 text-xs">Guardar</button>
                        <button onClick={cancelEdit} className="btn-outline flex-1 text-xs">Cancelar</button>
                      </div>
                      <button onClick={() => clearZone(activeZone.id)} disabled={saving === activeZone.id} className="btn-outline w-full text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">Borrar Poligono</button>
                    </>
                  ) : drawing ? (
                    <>
                      <p className="text-xs text-muted">{points.length} puntos. Click en primer punto o doble-click para cerrar. Z o clic derecho para deshacer.</p>
                      <div className="flex gap-2">
                        <button onClick={finishPolygon} disabled={points.length < 3 || saving === activeZoneId} className="btn-primary flex-1 text-xs">
                          {saving === activeZoneId ? "Guardando..." : "Cerrar y Guardar"}
                        </button>
                        <button onClick={() => { setPoints((prev) => prev.slice(0, -1)); }} disabled={points.length === 0} className="btn-outline text-xs !px-3">Deshacer</button>
                      </div>
                      <button onClick={() => { setPoints([]); setDrawing(false); setTool("select"); }} className="btn-outline w-full text-xs">Cancelar todo</button>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button onClick={() => { setPoints([]); setDrawing(true); setEditPoints(null); setTool("draw"); }}
                          className="btn-primary flex-1 text-xs" style={{ background: `linear-gradient(135deg, ${activeZone.color}cc, ${activeZone.color}88)` }}>
                          Dibujar
                        </button>
                        {activeZone.map_coords && (
                          <button onClick={() => startEditZone(activeZone)} className="btn-outline flex-1 text-xs">Editar</button>
                        )}
                      </div>
                      {activeZone.map_coords && (
                        <button onClick={() => clearZone(activeZone.id)} disabled={saving === activeZone.id} className="btn-outline w-full text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">Borrar</button>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="card p-4 space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Plantillas rapidas</h2>
                <p className="text-[10px] text-muted">Selecciona zona y aplica una forma predefinida:</p>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button key={t.id} onClick={() => applyTemplate(t)} disabled={!activeZoneId}
                      className="rounded-lg border border-border p-2 text-center text-xs hover:bg-surface-2 transition-colors disabled:opacity-40">
                      <span className="text-lg block">{t.icon}</span>
                      <span className="text-muted">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <main className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setTool("select")} className={`btn-outline text-xs ${tool === "select" && !drawing ? "!border-purple-500 !text-purple-300" : ""}`}>Selec/Mover</button>
                <button onClick={() => { if (activeZoneId) { setPoints([]); setDrawing(true); setEditPoints(null); setTool("draw"); } }} className={`btn-outline text-xs ${drawing ? "!border-purple-500 !text-purple-300" : ""}`}>Dibujar</button>
                <div className="w-px h-5 bg-border" />
                <button onClick={() => { setShowGrid(!showGrid); setSnapGrid(!showGrid); }} className={`btn-outline text-xs ${showGrid ? "!border-purple-500 !text-purple-300" : ""}`}>Grid</button>
                <button onClick={() => setCurved(!curved)} className={`btn-outline text-xs ${curved ? "!border-purple-500 !text-purple-300" : ""}`}>Curvas</button>
              </div>

              <div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-white/5 bg-black/60 select-none"
                style={{ cursor: cursorStyle }}>
                <svg ref={svgRef} viewBox={viewBox} className="w-full h-[600px] block" preserveAspectRatio="xMidYMid meet"
                  onClick={handleSvgClick} onMouseDown={handleSvgMouseDown} onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onContextMenu={handleContextMenu}
                  onDoubleClick={handleDoubleClick}>

                  <rect x={-2000} y={-2000} width={5000} height={5000} fill="#09090f" />
                  {showGrid && (
                    <g opacity="0.3">
                      {Array.from({ length: Math.ceil(SVG_W / 50) + 1 }, (_, i) => (
                        <line key={`gv${i}`} x1={i * 50} y1={0} x2={i * 50} y2={SVG_H} stroke="#1a1a30" strokeWidth={i % 5 === 0 ? 0.8 : 0.3} />
                      ))}
                      {Array.from({ length: Math.ceil(SVG_H / 50) + 1 }, (_, i) => (
                        <line key={`gh${i}`} x1={0} y1={i * 50} x2={SVG_W} y2={i * 50} stroke="#1a1a30" strokeWidth={i % 5 === 0 ? 0.8 : 0.3} />
                      ))}
                    </g>
                  )}

                  <rect x="350" y="20" width="500" height="50" rx="10" fill="#14141f" stroke="#2a2a3d" strokeWidth="1.5" />
                  <text x="600" y="45" textAnchor="middle" dominantBaseline="central" fill="#6b6b90" fontSize="13" fontWeight="bold" letterSpacing="5">ESCENARIO</text>

                  {zones.map((z) => {
                    if (!z.map_coords) return null;
                    const isEditing = editPoints !== null && z.id === activeZoneId;
                    if (isEditing) return null;
                    const isActive = z.id === activeZoneId;
                    const pts = parseCoords(z.map_coords);
                    const c = getCentroid(z.map_coords);
                    const isChild = !!z.parent_id;
                    const pathD = curved ? smoothPath(pts) : undefined;
                    return (
                      <g key={z.id}>
                        {pathD ? (
                          <path d={pathD} fill={z.color} fillOpacity={isActive ? 0.65 : isChild ? 0.2 : 0.28}
                            stroke={z.color} strokeWidth={isActive ? 3 : 1.5} strokeOpacity={isActive ? 1 : 0.5}
                            className="cursor-pointer transition-opacity" onClick={(e) => { if (!drawing) { e.stopPropagation(); cancelEdit(); setActiveZoneId(z.id); startEditZone({ ...z }); } }} />
                        ) : (
                          <polygon points={z.map_coords} fill={z.color} fillOpacity={isActive ? 0.65 : isChild ? 0.2 : 0.28}
                            stroke={z.color} strokeWidth={isActive ? 3 : 1.5} strokeOpacity={isActive ? 1 : 0.5}
                            className="cursor-pointer transition-opacity" onClick={(e) => { if (!drawing) { e.stopPropagation(); cancelEdit(); setActiveZoneId(z.id); startEditZone({ ...z }); } }} />
                        )}
                        {c.x > 0 && (
                          <g pointerEvents="none">
                            <rect x={c.x - 60} y={c.y - 11} width="120" height="22" rx="11" fill="rgba(0,0,0,0.8)" />
                            <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={isChild ? "9" : "10"} fontWeight="bold">{z.name}</text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {editPoints && editPoints.length >= 2 && (
                    <g>
                      {curved && editPoints.length >= 3 ? (
                        <path d={smoothPath(editPoints)} fill={activeZone?.color ?? "#a855f7"} fillOpacity={0.35} stroke={activeZone?.color ?? "#a855f7"} strokeWidth={2.5} />
                      ) : (
                        <>
                          <polygon points={ptStr(editPoints)} fill={activeZone?.color ?? "#a855f7"} fillOpacity={0.35} stroke={activeZone?.color ?? "#a855f7"} strokeWidth={2.5} />
                          {editPoints.map((_, i) => {
                            const a = editPoints[i], b = editPoints[(i + 1) % editPoints.length];
                            return <line key={`edge-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={HIT_R} style={{ cursor: "crosshair" }} />;
                          })}
                        </>
                      )}
                      {insertIdx !== null && editPoints.length >= 2 && (() => {
                        const prev = editPoints[insertIdx - 1 >= 0 ? insertIdx - 1 : editPoints.length - 1];
                        const next = editPoints[insertIdx % editPoints.length];
                        return <circle cx={(prev.x + next.x) / 2} cy={(prev.y + next.y) / 2} r={5} fill="#fff" stroke={activeZone?.color ?? "#a855f7"} strokeWidth={2} className="pointer-events-none" />;
                      })()}
                      {editPoints.map((p, i) => (
                        <circle key={`v-${i}`} cx={p.x} cy={p.y} r={VERTEX_R}
                          fill={dragIdx === i ? "#fff" : "#1a1a2e"} stroke={dragIdx === i ? activeZone?.color ?? "#a855f7" : "#c0c0d0"}
                          strokeWidth={dragIdx === i ? 3 : 2} style={{ cursor: "grab" }}
                          onMouseDown={(e) => { e.stopPropagation(); setDragIdx(i); }} />
                      ))}
                    </g>
                  )}

                  {drawing && points.length >= 2 && (
                    <polyline points={ptStr(points)} fill="none" stroke={activeZone?.color ?? "#a855f7"} strokeWidth={2} strokeDasharray="6 3" />
                  )}
                  {drawing && points.length >= 3 && (
                    <line x1={points[points.length - 1].x} y1={points[points.length - 1].y} x2={points[0].x} y2={points[0].y}
                      stroke={activeZone?.color ?? "#a855f7"} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.5} />
                  )}
                  {drawing && points.map((p, i) => (
                    <circle key={`p-${i}`} cx={p.x} cy={p.y} r={i === 0 ? 7 : 4}
                      fill={activeZone?.color ?? "#a855f7"} stroke="#fff" strokeWidth={1.5} />
                  ))}
                </svg>
              </div>

              <div className="card p-3">
                <div className="flex flex-wrap gap-2">
                  {zones.map((z) => (
                    <button key={z.id} onClick={() => { cancelEdit(); setActiveZoneId(z.id); }}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        z.id === activeZoneId ? "border-purple-500 text-white" : "border-border text-muted hover:text-white"
                      }`}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
                      {z.name}{z.map_coords ? " ✓" : " ○"}
                    </button>
                  ))}
                </div>
              </div>
            </main>
          </div>
        )}
      </div>

      {renamingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenamingId(null)}>
          <div className="card p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">Renombrar</h3>
            <input className="input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { const z = zones.find(zz => zz.id === renamingId); if (z) handleRename(z); } }} autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setRenamingId(null)} className="btn-outline flex-1 text-sm">Cancelar</button>
              <button onClick={() => { const z = zones.find(zz => zz.id === renamingId); if (z) handleRename(z); }} className="btn-primary flex-1 text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {divideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDivideModal(null)}>
          <div className="card p-6 w-96 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Dividir: {divideModal.name}</h3>
            <p className="text-xs text-muted">Crea subzonas individuales con su propio poligono y capacidad.</p>
            <div>
              <label className="label">Prefijo</label>
              <input className="input" value={dividePrefix} onChange={(e) => setDividePrefix(e.target.value)} placeholder={divideModal.name} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Cantidad</label><input type="number" min={2} max={50} className="input" value={divideCount} onChange={(e) => setDivideCount(Number(e.target.value))} /></div>
              <div><label className="label">Asientos/unidad</label><input type="number" min={1} max={100} className="input" value={divideCapacity} onChange={(e) => setDivideCapacity(Number(e.target.value))} /></div>
            </div>
            <p className="text-xs text-muted">Precio: <strong>{formatCOP(divideModal.price)}</strong> · {divideCapacity} asientos/ud</p>
            <div className="flex gap-2">
              <button onClick={() => setDivideModal(null)} className="btn-outline flex-1 text-sm">Cancelar</button>
              <button onClick={handleDivide} className="btn-primary flex-1 text-sm">Crear {divideCount} subzonas</button>
            </div>
          </div>
        </div>
      )}

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAddModal(false)}>
          <div className="card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Nueva zona</h3>
            <div><label className="label">Nombre</label><input className="input" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="VIP, Platea..." autoFocus /></div>
            
            <div className="rounded-xl border border-white/10 bg-surface-2/50 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-300">Configuración de Precios</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-[11px]">Precio Full ($)</label>
                  <input type="number" min={0} className="input" value={newZonePrice || ""} onChange={(e) => setNewZonePrice(Number(e.target.value))} placeholder="Ej: 50000" />
                </div>
                <div>
                  <label className="label text-[11px]">Precio Preventa ($)</label>
                  <input type="number" min={0} className="input" value={newZonePresalePrice ?? ""} onChange={(e) => setNewZonePresalePrice(e.target.value ? Number(e.target.value) : null)} placeholder="Opcional" />
                </div>
              </div>
              {newZonePresalePrice !== null && newZonePresalePrice > 0 && (
                <div>
                  <label className="label text-[11px]">Límite Fecha/Hora Preventa</label>
                  <input type="datetime-local" className="input text-xs" value={newZonePresaleEndAt} onChange={(e) => setNewZonePresaleEndAt(e.target.value)} />
                </div>
              )}
            </div>

            <div>
              <label className="label">Modo de Venta de la Zona</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setNewZoneSaleType("individual")}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    newZoneSaleType === "individual"
                      ? "border-purple-500 bg-purple-500/20 text-white font-bold"
                      : "border-border text-muted hover:bg-surface-2"
                  }`}
                >
                  🎟️ <strong>Por Silla / Individual</strong>
                  <p className="text-[10px] text-muted mt-0.5">Cobro por entrada individual</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNewZoneSaleType("full_zone")}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    newZoneSaleType === "full_zone"
                      ? "border-cyan-500 bg-cyan-500/20 text-white font-bold"
                      : "border-border text-muted hover:bg-surface-2"
                  }`}
                >
                  🎪 <strong>Palco / Zona Completa</strong>
                  <p className="text-[10px] text-muted mt-0.5">Precio único por la zona entera</p>
                </button>
              </div>
            </div>

            <div><label className="label">Capacidad de Asientos / Personas</label><input type="number" min={1} className="input" value={newZoneCapacity ?? ""} onChange={(e) => setNewZoneCapacity(e.target.value ? Number(e.target.value) : null)} placeholder="Ej: 10 (asientos del palco u aforo)" /></div>
            <div><label className="label">Color en Mapa</label><div className="flex gap-2">{PALETTE.map((c) => (<button key={c} type="button" onClick={() => setNewZoneColor(c)} className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110" style={{ backgroundColor: c, borderColor: newZoneColor === c ? "#fff" : "transparent" }} />))}</div></div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setAddModal(false)} className="btn-outline flex-1 text-sm">Cancelar</button>
              <button type="button" onClick={handleAddZone} disabled={!newZoneName.trim() || saving === "new"} className="btn-primary flex-1 text-sm">
                {saving === "new" ? "Creando..." : "Crear Zona"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditDetailsModal(null)}>
          <div className="card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Editar Zona: {editDetailsModal.name}</h3>
            <div><label className="label">Nombre</label><input className="input" value={editZoneName} onChange={(e) => setEditZoneName(e.target.value)} placeholder="VIP, General..." /></div>

            <div>
              <label className="label">Modo de Venta de la Zona</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setEditZoneSaleType("individual")}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    editZoneSaleType === "individual"
                      ? "border-purple-500 bg-purple-500/20 text-white font-bold"
                      : "border-border text-muted hover:bg-surface-2"
                  }`}
                >
                  🎟️ <strong>Por Silla / Individual</strong>
                  <p className="text-[10px] text-muted mt-0.5">Cobro por entrada individual</p>
                </button>
                <button
                  type="button"
                  onClick={() => setEditZoneSaleType("full_zone")}
                  className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    editZoneSaleType === "full_zone"
                      ? "border-cyan-500 bg-cyan-500/20 text-white font-bold"
                      : "border-border text-muted hover:bg-surface-2"
                  }`}
                >
                  🎪 <strong>Palco / Zona Completa</strong>
                  <p className="text-[10px] text-muted mt-0.5">Precio único por la zona entera</p>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-surface-2/50 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-300">Configuración de Precios</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-[11px]">Precio Full ($)</label>
                  <input type="number" min={0} className="input" value={editZonePrice || ""} onChange={(e) => setEditZonePrice(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label text-[11px]">Precio Preventa ($)</label>
                  <input type="number" min={0} className="input" value={editZonePresalePrice ?? ""} onChange={(e) => setEditZonePresalePrice(e.target.value ? Number(e.target.value) : null)} placeholder="Sin preventa" />
                </div>
              </div>
              <div>
                <label className="label text-[11px]">Límite Fecha/Hora Preventa</label>
                <input type="datetime-local" className="input text-xs" value={editZonePresaleEndAt} onChange={(e) => setEditZonePresaleEndAt(e.target.value)} />
                <p className="text-[10px] text-muted mt-1">Si finalizó la fecha o no hay precio preventa, se cobrará automáticamente la tarifa Full.</p>
              </div>
            </div>

            <div><label className="label">Capacidad de Asientos / Personas</label><input type="number" min={1} className="input" value={editZoneCapacity ?? ""} onChange={(e) => setEditZoneCapacity(e.target.value ? Number(e.target.value) : null)} placeholder="Sin límite" /></div>
            <div><label className="label">Color en Mapa</label><div className="flex gap-2">{PALETTE.map((c) => (<button key={c} type="button" onClick={() => setEditZoneColor(c)} className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110" style={{ backgroundColor: c, borderColor: editZoneColor === c ? "#fff" : "transparent" }} />))}</div></div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditDetailsModal(null)} className="btn-outline flex-1 text-sm">Cancelar</button>
              <button type="button" onClick={handleSaveEditZone} disabled={!editZoneName.trim() || saving === editDetailsModal.id} className="btn-primary flex-1 text-sm">
                {saving === editDetailsModal.id ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-surface border border-white/10 px-6 py-3 text-sm font-semibold shadow-2xl text-white animate-pulse">{toast}</div>
      )}
    </div>
  );
}

function ZoneRow({
  zone, active, renamingId, renameValue, onSetRename,
  onStartRename, onConfirmRename, onCancelRename,
  onSelect, onEdit, onEditDetails, onDivide, onDelete,
  saving, childCount, isChild,
}: {
  zone: Zone; active: boolean; renamingId: string | null; renameValue: string;
  onSetRename: (v: string) => void; onStartRename: (z: Zone) => void;
  onConfirmRename: (z: Zone) => void; onCancelRename: () => void;
  onSelect: () => void; onEdit: () => void; onEditDetails?: () => void; onDivide?: () => void;
  onDelete: () => void; saving: string | null; childCount?: number; isChild?: boolean;
}) {
  const isRenaming = renamingId === zone.id;
  const pricing = getZonePricing(zone);

  return (
    <div className={`rounded-xl border p-3 transition-colors cursor-pointer ${active ? "border-purple-500 bg-purple-500/10" : "border-border hover:bg-surface-2"}`} onClick={onSelect}>
      <div className="flex items-center gap-2 mb-1">
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: zone.color }} />
        {isRenaming ? (
          <input className="flex-1 bg-transparent border-b border-purple-500 text-sm text-white font-bold outline-none px-1" value={renameValue}
            onChange={(e) => onSetRename(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onConfirmRename(zone); if (e.key === "Escape") onCancelRename(); }}
            onClick={(e) => e.stopPropagation()} autoFocus />
        ) : (
          <span className="font-bold text-sm text-white truncate cursor-pointer hover:text-purple-300" onClick={(e) => { e.stopPropagation(); onStartRename(zone); }} title="Renombrar">{zone.name}</span>
        )}
        {zone.sale_type === "full_zone" && (
          <span className="rounded bg-gradient-to-r from-cyan-500 to-blue-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm shrink-0">
            PALCO COMPLETO
          </span>
        )}
        {pricing.isPresale && (
          <span className="rounded bg-gradient-to-r from-pink-500 to-purple-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm shrink-0">
            PREVENTA
          </span>
        )}
        {zone.map_coords ? (
          <span className="ml-auto text-[10px] text-emerald-400 font-semibold shrink-0">dibujada</span>
        ) : (
          <span className="ml-auto text-[10px] text-amber-400 font-semibold shrink-0">sin mapa</span>
        )}
      </div>
      <p className="text-xs text-muted pl-5">
        {pricing.isPresale ? (
          <span>
            <span className="line-through mr-1.5 text-[11px] text-muted">{formatCOP(pricing.fullPrice)}</span>
            <strong className="text-purple-300">{formatCOP(pricing.currentPrice)}</strong>
          </span>
        ) : (
          formatCOP(zone.price)
        )}
        {" · "}
        {zone.capacity != null ? `${zone.capacity} asientos` : "sin límite"}
        {childCount != null && childCount > 0 && ` · ${childCount} subzonas`}
      </p>
      <div className="flex gap-1 mt-2 pl-5">
        <button type="button" onClick={(e) => { e.stopPropagation(); onEditDetails?.(); }} className="text-[10px] px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors">Precios / Detalle</button>
        {zone.map_coords && <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-[10px] px-2 py-1 rounded bg-surface-2 text-muted hover:text-white transition-colors">Mapa</button>}
        {onDivide && childCount === 0 && <button type="button" onClick={(e) => { e.stopPropagation(); onDivide(); }} className="text-[10px] px-2 py-1 rounded bg-surface-2 text-muted hover:text-white transition-colors">Dividir</button>}
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-[10px] px-2 py-1 rounded bg-surface-2 text-red-400 hover:bg-red-500/10 transition-colors">Eliminar</button>
      </div>
    </div>
  );
}
