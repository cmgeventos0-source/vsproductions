import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDate } from "@/lib/format";
import TicketQR from "../../../components/TicketQR";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<Metadata> {
  const { orderId } = await params;
  return { title: `Pedido ${orderId.substring(0, 8).toUpperCase()}` };
}

import { createAdminClient } from "@/lib/supabase/admin";

export default async function PagoResultPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) notFound();

  let tickets: any[] = [];
  if (order.status === "paid") {
    const { data } = await supabase
      .from("tickets")
      .select("id, order_id, function_id, zone_id, seat_id, holder_name, code, qr_data, status, issued_at, redeemed_at")
      .eq("order_id", orderId);
    tickets = data ?? [];

    if (tickets.length > 0) {
      const zoneIds = Array.from(new Set(tickets.map((t) => t.zone_id).filter(Boolean)));
      const seatIds = Array.from(new Set(tickets.map((t) => t.seat_id).filter(Boolean)));
      const functionIds = Array.from(new Set(tickets.map((t) => t.function_id).filter(Boolean)));

      const [zoneRes, seatRes, funcRes] = await Promise.all([
        zoneIds.length ? supabase.from("zones").select("id, name, color").in("id", zoneIds) : Promise.resolve({ data: [] }),
        seatIds.length ? supabase.from("seats").select("id, row_name, number").in("id", seatIds) : Promise.resolve({ data: [] }),
        functionIds.length ? supabase.from("event_functions").select("id, name, starts_at, event_id").in("id", functionIds) : Promise.resolve({ data: [] }),
      ]);

      const zoneMap = new Map((zoneRes.data || []).map((z: any) => [z.id, z]));
      const seatMap = new Map((seatRes.data || []).map((s: any) => [s.id, s]));
      const funcMap = new Map((funcRes.data || []).map((f: any) => [f.id, f]));

      const eventIds = Array.from(new Set((funcRes.data || []).map((f: any) => f.event_id).filter(Boolean)));
      const { data: events } = eventIds.length ? await supabase.from("events").select("id, name, image_url").in("id", eventIds) : { data: [] };
      const eventMap = new Map((events || []).map((e: any) => [e.id, e]));

      for (const ticket of tickets) {
        ticket.zone = zoneMap.get(ticket.zone_id) || null;
        ticket.seat = seatMap.get(ticket.seat_id) || null;
        const fn = funcMap.get(ticket.function_id) || null;
        ticket.function = fn ? { ...fn, event: fn.event_id ? eventMap.get(fn.event_id) || null : null } : null;
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="card p-8 text-center space-y-6">
        {order.status === "paid" ? (
          <>
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400">
              ✅
            </div>
            <h1 className="text-2xl font-black">¡Pago Confirmado!</h1>
            <p className="text-sm text-muted">
              Tu pedido <strong className="text-foreground">{order.id.substring(0, 8).toUpperCase()}</strong> ha sido procesado exitosamente.
            </p>
          </>
        ) : order.status === "pending" ? (
          <>
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-3xl text-amber-400">
              ⏳
            </div>
            <h1 className="text-2xl font-black">Pago Pendiente</h1>
            <p className="text-sm text-muted">
              Tu pedido está esperando verificación. Recibirás una notificación cuando sea aprobado.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-3xl text-red-400">
              ❌
            </div>
            <h1 className="text-2xl font-black">Pago No Procesado</h1>
            <p className="text-sm text-muted">
              Tu pedido fue cancelado o no pudo ser procesado.
            </p>
          </>
        )}

        <div className="rounded-xl border border-border bg-surface-2 p-4 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">Pedido:</span>
            <span className="font-mono font-bold">{order.id.substring(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Método:</span>
            <span className="font-semibold">{order.payment_method}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Total:</span>
            <span className="font-bold text-accent-2">{formatCOP(order.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Estado:</span>
            <span className={`font-bold ${order.status === "paid" ? "text-emerald-400" : order.status === "pending" ? "text-amber-400" : "text-red-400"}`}>
              {order.status === "paid" ? "Pagado" : order.status === "pending" ? "Pendiente" : "Cancelado"}
            </span>
          </div>
        </div>

        {tickets.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-t border-border pt-4">Tus Boletas</h2>
            {tickets.map((ticket: any) => (
              <div key={ticket.id} className="card p-5 text-left space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-white">{ticket.function?.event?.name}</p>
                    <p className="text-xs text-muted">{ticket.function?.name} · {ticket.function?.starts_at ? formatDate(ticket.function.starts_at) : ""}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                    {ticket.status === "active" ? "ACTIVA" : ticket.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="rounded-lg px-2 py-1 text-white" style={{ backgroundColor: ticket.zone?.color ?? "#7c3aed" }}>
                    {ticket.zone?.name ?? "General"}
                  </span>
                  {ticket.seat && (
                    <span className="text-muted">
                      Fila {ticket.seat.row_name} - Silla {ticket.seat.number}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-center gap-3 border-t border-border pt-3">
                  <TicketQR code={ticket.code} />
                  <p className="font-mono text-lg font-black tracking-wider text-white">{ticket.code}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Link href="/mis-boletas" className="btn-primary flex-1">Mis Boletas</Link>
          <Link href="/eventos" className="btn-outline flex-1">Explorar Eventos</Link>
        </div>
      </div>
    </div>
  );
}
