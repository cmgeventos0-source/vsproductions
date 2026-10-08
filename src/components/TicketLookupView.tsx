"use client";

import { useState } from "react";
import TicketCard from "./TicketCard";
import type { Ticket } from "@/lib/types";
import { getTicketsByDocumentAction } from "@/app/actions";

export default function TicketLookupView({
  initialTickets = [],
  isLoggedIn = false,
}: {
  initialTickets?: Ticket[];
  isLoggedIn?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await getTicketsByDocumentAction(query);
      setSearched(true);
      if (res.success) {
        setTickets(res.tickets || []);
        setOrders(res.orders || []);
        if (res.message) {
          setMessage(res.message);
        }
      } else {
        setError(res.error || "Ocurrió un error al buscar.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error de conexión al consultar boletas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Formulario de búsqueda por Cédula / Email */}
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-surface to-slate-900/40 p-6 sm:p-8 shadow-2xl">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-2xl text-purple-400">
            🔍
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Consultar Boletas por Cédula o Correo
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Si compraste sin registrarte o deseas buscar entradas de un pedido, ingresa tu número de documento de identidad (Cédula) o el correo usado en la compra.
          </p>

          <form onSubmit={handleSearch} className="pt-2 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="Ej: 1098765432 o tu@email.com"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input flex-1 text-base py-3 px-4 rounded-xl border-purple-500/30 focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="btn-primary py-3 px-8 text-base font-bold shrink-0 disabled:opacity-40"
            >
              {loading ? "Buscando..." : "Buscar Boletas 🔍"}
            </button>
          </form>

          {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
          {message && <p className="text-xs text-amber-300 font-semibold">{message}</p>}
        </div>
      </div>

      {/* Resultados de Órdenes Pendientes si hay alguna sin boleta aprobada aún */}
      {orders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-white">Historial de Pedidos Encontrados</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {orders.map((o) => (
              <div key={o.id} className="card p-4 text-xs space-y-1 border border-white/10">
                <div className="flex justify-between font-bold text-white">
                  <span>Orden #{o.id.substring(0, 8).toUpperCase()}</span>
                  <span className={o.status === 'paid' ? 'text-green-400' : 'text-amber-400'}>
                    {o.status === 'paid' ? '✓ Aprobada / Pagada' : '⏳ Pendiente de Verificación'}
                  </span>
                </div>
                <p className="text-muted">Comprador: <strong className="text-white">{o.customer_name}</strong> (Cédula: {o.customer_id_number})</p>
                <p className="text-muted">Correo: {o.email} · Total: <strong className="text-emerald-400">${o.total?.toLocaleString('es-CO')} COP</strong></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultados de Boletas */}
      <div>
        {tickets.length > 0 ? (
          <div>
            <h3 className="text-base font-bold text-white mb-4">
              🎫 Boletas Digitales Encontradas ({tickets.length})
            </h3>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {tickets.map((ticket: Ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          </div>
        ) : (
          searched && (
            <div className="card p-8 text-center space-y-2">
              <div className="text-4xl">🎫</div>
              <p className="font-bold text-white text-base">No se encontraron boletas activas</p>
              <p className="text-xs text-muted">
                Si realizaste el pago por transferencia manual, la aprobación toma entre 15 y 30 minutos.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
