"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from '@/lib/supabase/client'
import { formatCOP, formatDateTime } from "@/lib/format";
import { regenerateTicketsAction, resendTicketsEmailAction } from "../../actions";
import type { Order, Ticket, Event, EventFunction, Zone } from "@/lib/types";
import TicketQR from "../../../components/TicketQR";
import QRCode from "qrcode";

type OrderRow = Order & { tickets: Ticket[] };

export default function AdminBoletasPage() {
  const router = useRouter();
  const [events, setEvents] = useState<(Event & { functions: EventFunction[] })[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select("id, slug, name, description, image_url, sale_mode, status, created_at, category_id, venue_id")
        .order("created_at", { ascending: false });
      setEvents((data ?? []) as any);
    })();
  }, []);

  async function loadOrders(eventId?: string) {
    const eid = eventId || selectedEventId;
    if (!eid) return;
    setLoading(true);
    const supabase = createClient();

    const { data: functions } = await supabase
      .from("event_functions")
      .select("id")
      .eq("event_id", eid);
    const functionIds = (functions ?? []).map((f) => f.id);

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (functionIds.length > 0) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("order_id")
        .in("function_id", functionIds);
      const orderIds = [...new Set((orderItems ?? []).map((i) => i.order_id))];
      if (orderIds.length > 0) {
        query = query.in("id", orderIds);
      } else {
        setOrders([]);
        setLoading(false);
        return;
      }
    } else {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: orderRows } = await query.limit(100);
    if (!orderRows || orderRows.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, order_id, function_id, zone_id, seat_id, holder_name, code, qr_data, status, issued_at, redeemed_at")
      .in("order_id", orderRows.map((o) => o.id));

    if (tickets && tickets.length > 0) {
      const zoneIds = Array.from(new Set(tickets.map((t) => t.zone_id).filter(Boolean)));
      const seatIds = Array.from(new Set(tickets.map((t) => t.seat_id).filter(Boolean)));
      const functionIds = Array.from(new Set(tickets.map((t) => t.function_id).filter(Boolean)));

      const [zoneRes, seatRes, funcRes] = await Promise.all([
        zoneIds.length ? supabase.from("zones").select("id, name, color").in("id", zoneIds) : Promise.resolve({ data: [] }),
        seatIds.length ? supabase.from("seats").select("id, row_name, number").in("id", seatIds) : Promise.resolve({ data: [] }),
        functionIds.length ? supabase.from("event_functions").select("id, name, starts_at, event_id").in("id", functionIds) : Promise.resolve({ data: [] }),
      ]);

      const eventIds = Array.from(new Set((funcRes.data || []).map((f: any) => f.event_id).filter(Boolean)));
      const { data: events } = eventIds.length ? await supabase.from("events").select("id, name").in("id", eventIds) : { data: [] };

      const zoneMap = new Map((zoneRes.data || []).map((z: any) => [z.id, z]));
      const seatMap = new Map((seatRes.data || []).map((s: any) => [s.id, s]));
      const funcMap = new Map((funcRes.data || []).map((f: any) => [f.id, f]));
      const eventMap = new Map((events || []).map((e: any) => [e.id, e]));

      for (const ticket of tickets) {
        (ticket as any).zone = zoneMap.get(ticket.zone_id) || null;
        (ticket as any).seat = seatMap.get(ticket.seat_id) || null;
        const fn = funcMap.get(ticket.function_id) || null;
        (ticket as any).function = fn ? { ...fn, event: fn.event_id ? eventMap.get(fn.event_id) || null : null } : null;
      }
    }

    const ticketsByOrder = new Map<string, Ticket[]>();
    for (const t of tickets ?? []) {
      const list = ticketsByOrder.get(t.order_id) ?? [];
      list.push(t);
      ticketsByOrder.set(t.order_id, list);
    }

    setOrders(
      orderRows.map((o) => ({
        ...o,
        tickets: ticketsByOrder.get(o.id) ?? [],
      }))
    );
    setLoading(false);
  }

  async function handleRegenerate(orderId: string) {
    const res = await regenerateTicketsAction(orderId);
    setToast(res.message);
    setTimeout(() => setToast(null), 3000);
    if (res.success) loadOrders();
  }

  async function handleResendEmail(orderId: string) {
    setSendingEmailId(orderId);
    try {
      const res = await resendTicketsEmailAction(orderId);
      setToast(res.success ? (res.message || "Boletas reenviadas por correo") : `❌ Error: ${res.error}`);
    } catch (err: any) {
      setToast(`❌ Error al enviar: ${err.message || String(err)}`);
    } finally {
      setSendingEmailId(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const filtered = searchQuery
    ? orders.filter((o) => {
        const q = searchQuery.toLowerCase();
        return (
          o.email?.toLowerCase().includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.customer_phone?.toLowerCase().includes(q) ||
          o.id.substring(0, 8).toLowerCase().includes(q)
        );
      })
    : orders;

  const totalPaid = orders.filter((o) => o.status === "paid").reduce((a, o) => a + o.total, 0);
  const totalTickets = orders.reduce((a, o) => a + o.tickets.length, 0);
  const totalPending = orders.filter((o) => o.status === "pending").length;

  function statusColor(s: string) {
    if (s === "paid") return "bg-emerald-500/20 text-emerald-400";
    if (s === "pending") return "bg-amber-500/20 text-amber-400";
    if (s === "cancelled") return "bg-red-500/20 text-red-400";
    return "bg-surface-2 text-muted";
  }

  function statusLabel(s: string) {
    if (s === "paid") return "Pagado";
    if (s === "pending") return "Pendiente";
    if (s === "cancelled") return "Cancelado";
    return s;
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  async function downloadTicket(ticket: Ticket) {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, 400, 600);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ticket.function?.event?.name ?? "Evento", 200, 40);

    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#9a9ab0";
    ctx.fillText(ticket.function?.name ?? "", 200, 60);
    ctx.fillText(ticket.zone?.name ?? "General", 200, 80);
    if (ticket.seat) {
      ctx.fillText(`Fila ${ticket.seat.row_name} · Silla ${ticket.seat.number}`, 200, 98);
    }

    const qrDataUrl = await QRCode.toDataURL(ticket.code, {
      width: 250,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    const img = new Image();
    img.src = qrDataUrl;
    await new Promise((r) => { img.onload = r; });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(70, 110, 260, 260);
    ctx.drawImage(img, 75, 115, 250, 250);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(ticket.code, 200, 420);

    ctx.fillStyle = "#9a9ab0";
    ctx.font = "10px sans-serif";
    ctx.fillText("Presenta este código QR en la entrada", 200, 450);
    ctx.fillText(`Estado: ${ticket.status === "active" ? "ACTIVA" : ticket.status}`, 200, 470);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boleta-${ticket.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <button onClick={() => router.push("/admin")} className="btn-outline text-xs">Volver</button>
          <h1 className="text-2xl font-black">Boletas por Evento</h1>
        </div>

        <div className="card p-4 mb-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[250px]">
              <label className="label">Selecciona un evento</label>
              <select
                className="input"
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setSearchQuery("");
                  setExpandedId(null);
                  if (e.target.value) loadOrders(e.target.value);
                }}
              >
                <option value="">-- Selecciona evento --</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
            {selectedEventId && (
              <div className="flex-1 min-w-[250px]">
                <label className="label">Buscar cliente</label>
                <input
                  className="input"
                  placeholder="Email, nombre, teléfono o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          {selectedEventId && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-surface-2 p-3">
                <span className="text-[10px] text-muted block uppercase">Total Vendido</span>
                <span className="text-lg font-black text-emerald-400">{formatCOP(totalPaid)}</span>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <span className="text-[10px] text-muted block uppercase">Boletas Emitidas</span>
                <span className="text-lg font-black text-white">{totalTickets}</span>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <span className="text-[10px] text-muted block uppercase">Pendientes Aprob.</span>
                <span className="text-lg font-black text-amber-400">{totalPending}</span>
              </div>
            </div>
          )}
        </div>

        {loading && <div className="card p-8 text-center text-muted">Cargando pedidos...</div>}

        {!loading && selectedEventId && filtered.length === 0 && (
          <div className="card p-8 text-center text-muted">No hay pedidos para este evento</div>
        )}

        <div className="space-y-3">
          {filtered.map((order) => (
            <div key={order.id} className="card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-white">{order.id.substring(0, 8).toUpperCase()}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                    <span className="text-[10px] text-muted">{order.payment_method}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{order.customer_name}</p>
                  <p className="text-xs text-muted">{order.email}{order.customer_phone ? ` · ${order.customer_phone}` : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-accent-2">{formatCOP(order.total)}</p>
                  <p className="text-[10px] text-muted">{new Date(order.created_at).toLocaleString("es-CO")}</p>
                </div>
              </div>

              {order.receipt_url && (
                <a href={order.receipt_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-2 underline">
                  Ver comprobante
                </a>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  className="btn-outline flex-1 text-[10px] !py-1.5"
                >
                  {expandedId === order.id ? "Ocultar" : `${order.tickets.length} boleta(s)`}
                </button>
                {order.email && (
                  <button
                    onClick={() => handleResendEmail(order.id)}
                    disabled={sendingEmailId === order.id}
                    className="btn-outline text-[10px] !py-1.5 !px-3 flex items-center gap-1 border-purple-500/40 text-purple-300 hover:bg-purple-600/20 disabled:opacity-50"
                  >
                    ✉️ {sendingEmailId === order.id ? "Enviando..." : "Reenviar Correo"}
                  </button>
                )}
                {order.status === "paid" && order.tickets.length === 0 && (
                  <button
                    onClick={() => handleRegenerate(order.id)}
                    className="btn-primary text-[10px] !py-1.5 !px-3"
                  >
                    Generar Boletas
                  </button>
                )}
              </div>

              {expandedId === order.id && order.tickets.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 border-t border-border pt-3">
                  {order.tickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-xl border border-border bg-surface-2 p-3 text-center space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          ticket.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                          ticket.status === "redeemed" ? "bg-amber-500/20 text-amber-400" :
                          "bg-surface text-muted"
                        }`}>
                          {ticket.status === "active" ? "ACTIVA" : ticket.status === "redeemed" ? "USADA" : ticket.status}
                        </span>
                        {ticket.zone && (
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: ticket.zone.color ?? "#7c3aed" }}>
                            {ticket.zone.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted">{ticket.function?.event?.name}</p>
                      {ticket.seat && <p className="text-[9px] text-muted">Fila {ticket.seat.row_name} · Silla {ticket.seat.number}</p>}
                      <TicketQR code={ticket.code} />
                      <p className="font-mono text-xs font-black tracking-wider text-white">{ticket.code}</p>
                      <button onClick={() => downloadTicket(ticket)} className="btn-primary text-[10px] !py-1 w-full">
                        Descargar Boleta
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {expandedId === order.id && order.tickets.length === 0 && (
                <div className="border-t border-border pt-3 text-center">
                  <p className="text-xs text-muted mb-2">No hay boletas generadas</p>
                  <button
                    onClick={() => handleRegenerate(order.id)}
                    className="btn-primary text-xs !py-1.5"
                  >
                    Generar Boletas Ahora
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-surface border border-white/10 px-6 py-3 text-sm font-semibold shadow-2xl text-white animate-pulse">{toast}</div>
      )}
    </div>
  );
}

