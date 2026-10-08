"use client";

import { useState, useEffect } from "react";
import { formatCOP } from '@/lib/format';
import { createClient } from "@/lib/supabase/client";
import { PaymentMethodsManager } from "../components/admin/PaymentMethodsManager";
import { PaymentAnalytics } from "../components/admin/PaymentAnalytics";
import { PaymentVerificationQueue } from "../components/admin/PaymentVerificationQueue";

type PendingPayment = {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  event: string;
  amount: number;
  paymentMethod: string;
  receiptUrl: string;
  createdAt: string;
};

type AdminTab = "payments" | "maps" | "events" | "users" | "reports" | "payment_methods" | "analytics" | "verification";

const adminSections: Array<{
  id: AdminTab;
  label: string;
  description: string;
  icon: string;
  count?: (data: { pendingPayments: PendingPayment[]; events: any[] }) => number;
}> = [
  {
    id: "payments",
    label: "Pagos",
    description: "Transferencias pendientes",
    icon: "💳",
    count: ({ pendingPayments }) => pendingPayments.length,
  },
  {
    id: "verification",
    label: "Verificación",
    description: "Comprobantes y validación",
    icon: "✅",
  },
  {
    id: "payment_methods",
    label: "Métodos de pago",
    description: "Nequi, Wompi y más",
    icon: "🏦",
  },
  {
    id: "events",
    label: "Eventos",
    description: "Publicación y edición",
    icon: "🎤",
    count: ({ events }) => events.length,
  },
  {
    id: "maps",
    label: "Mapas",
    description: "Zonas y asientos",
    icon: "🗺️",
  },
  {
    id: "reports",
    label: "Reportes",
    description: "Ventas y órdenes",
    icon: "📊",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Métricas avanzadas",
    icon: "📈",
  },
];

const quickActions = [
  { href: "/admin/eventos/nuevo", label: "Crear evento", icon: "+", primary: true },
  { href: "/validador", label: "Escáner", icon: "▣" },
  { href: "/admin/boletas", label: "Boletas", icon: "🎫" },
  { href: "/admin/categorias", label: "Categorías", icon: "🏷️" },
  { href: "/admin/recintos", label: "Recintos", icon: "📍" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "👥" },
];

function getOrderEventName(order: any) {
  return order.order_items?.[0]?.event_functions?.event?.name || "Sin evento";
}

function getOrderEventId(order: any) {
  return order.order_items?.[0]?.event_functions?.event?.id || "sin-evento";
}

function getOrderTicketCount(order: any) {
  return (order.order_items ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);
}

export default function AdminPage() {
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("payments");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalSales: 0, totalTickets: 0, totalOrders: 0 });
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [reportEventId, setReportEventId] = useState("all");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const supabase = createClient();
      
      // Fetch pending orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, customer_name, customer_phone, total, payment_method, receipt_url, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (orders) {
        const orderIds = orders.map((o: any) => o.id);
        const { data: orderItems } = orderIds.length ? await supabase.from("order_items").select("order_id, quantity, function_id").in("order_id", orderIds) : { data: [] };

        const functionIds = Array.from(new Set((orderItems || []).map((oi: any) => oi.function_id).filter(Boolean)));
        const { data: functions } = functionIds.length ? await supabase.from("event_functions").select("id, name, event_id").in("id", functionIds) : { data: [] };

        const eventIds = Array.from(new Set((functions || []).map((f: any) => f.event_id).filter(Boolean)));
        const { data: events } = eventIds.length ? await supabase.from("events").select("id, name").in("id", eventIds) : { data: [] };

        const functionMap = new Map((functions || []).map((f: any) => [f.id, f]));
        const eventMap = new Map((events || []).map((e: any) => [e.id, e]));

        const formatted = orders.map((o: any) => {
          const firstItem = (orderItems || []).find((oi: any) => oi.order_id === o.id);
          const fn = firstItem ? functionMap.get(firstItem.function_id) : null;
          const ev = fn ? eventMap.get(fn.event_id) : null;
          return {
            id: o.id,
            orderCode: o.id.substring(0, 8).toUpperCase(),
            customerName: o.customer_name || "N/A",
            customerPhone: "N/A",
            event: ev?.name || fn?.name || "Varios Eventos",
            amount: o.total,
            paymentMethod: o.payment_method || "N/A",
            receiptUrl: o.receipt_url || "",
            createdAt: new Date(o.created_at).toLocaleString(),
          };
        });
        setPendingPayments(formatted);
      }

      // Fetch all events with functions and zones
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, slug, name, description, image_url, sale_mode, status, created_at, category_id, venue_id")
        .order("created_at", { ascending: false });
      
      if (eventsData) {
        const categoryIds = Array.from(new Set(eventsData.map((e: any) => e.category_id).filter(Boolean)));
        const venueIds = Array.from(new Set(eventsData.map((e: any) => e.venue_id).filter(Boolean)));
        const eventIds = eventsData.map((e: any) => e.id);

        const [catRes, venueRes, funcRes] = await Promise.all([
          categoryIds.length ? supabase.from("categories").select("id, name, slug, icon").in("id", categoryIds) : Promise.resolve({ data: [] }),
          venueIds.length ? supabase.from("venues").select("id, name, city, address").in("id", venueIds) : Promise.resolve({ data: [] }),
          supabase.from("event_functions").select("id, event_id, name, starts_at, doors_open_at, sales_start_at, sales_end_at, is_active").in("event_id", eventIds),
        ]);

        const catMap = new Map((catRes.data || []).map((c: any) => [c.id, c]));
        const venueMap = new Map((venueRes.data || []).map((v: any) => [v.id, v]));
        const funcByEvent = new Map<string, any[]>();
        for (const fn of funcRes.data || []) {
          const list = funcByEvent.get(fn.event_id) || [];
          list.push(fn);
          funcByEvent.set(fn.event_id, list);
        }

        for (const ev of eventsData) {
          (ev as any).category = catMap.get(ev.category_id) || null;
          (ev as any).venue = venueMap.get(ev.venue_id) || null;
          (ev as any).functions = funcByEvent.get(ev.id) || [];
        }

        const functionIdsForZones = eventsData.flatMap((e: any) => (e.functions || []).map((f: any) => f.id));
        if (functionIdsForZones.length > 0) {
          const { data: zones } = await supabase.from("zones").select("*").in("function_id", functionIdsForZones);
          if (zones) {
            const zoneMap = new Map<string, any[]>();
            for (const z of zones) {
              const list = zoneMap.get(z.function_id) || [];
              list.push(z);
              zoneMap.set(z.function_id, list);
            }
            for (const ev of eventsData) {
              for (const fn of (ev as any).functions || []) {
                fn.zones = (zoneMap.get(fn.id) || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
              }
            }
          }
        }

        setEvents(eventsData);
      }

      // Fetch some basic metrics (Total paid orders and ticket count)
      const { data: paidOrders } = await supabase.from("orders").select("total").eq("status", "paid");
      const { count: ticketCount } = await supabase.from("tickets").select("id", { count: "exact", head: true });
      
      const totalSales = paidOrders ? paidOrders.reduce((acc, o) => acc + o.total, 0) : 0;
      
      const { data: allPaidOrders } = await supabase
        .from("orders")
        .select("id, customer_name, total, status, created_at")
        .in("status", ["paid", "cancelled"])
        .order("created_at", { ascending: false });
      
      if (allPaidOrders) {
        const orderIds = allPaidOrders.map((o: any) => o.id);
        const [itemsRes, ticketsRes] = await Promise.all([
          orderIds.length ? supabase.from("order_items").select("order_id, quantity, unit_price, zone_id, function_id").in("order_id", orderIds) : Promise.resolve({ data: [] }),
          orderIds.length ? supabase.from("tickets").select("id, order_id, code, status").in("order_id", orderIds) : Promise.resolve({ data: [] }),
        ]);

        const ticketsByOrder = new Map<string, any[]>();
        for (const t of ticketsRes.data || []) {
          const list = ticketsByOrder.get(t.order_id) || [];
          list.push(t);
          ticketsByOrder.set(t.order_id, list);
        }

        const functionIds = Array.from(new Set((itemsRes.data || []).map((oi: any) => oi.function_id).filter(Boolean)));
        const zoneIds = Array.from(new Set((itemsRes.data || []).map((oi: any) => oi.zone_id).filter(Boolean)));
        const [funcRes2, zoneRes2] = await Promise.all([
          functionIds.length ? supabase.from("event_functions").select("id, name, event_id").in("id", functionIds) : Promise.resolve({ data: [] }),
          zoneIds.length ? supabase.from("zones").select("id, name").in("id", zoneIds) : Promise.resolve({ data: [] }),
        ]);

        const eventIds = Array.from(new Set((funcRes2.data || []).map((f: any) => f.event_id).filter(Boolean)));
        const { data: events2 } = eventIds.length ? await supabase.from("events").select("id, name").in("id", eventIds) : { data: [] };
        const funcMap = new Map((funcRes2.data || []).map((f: any) => [f.id, f]));
        const zoneMap = new Map((zoneRes2.data || []).map((z: any) => [z.id, z]));
        const eventMap = new Map((events2 || []).map((e: any) => [e.id, e]));

        const enriched = allPaidOrders.map((o: any) => {
          const items = (itemsRes.data || []).filter((oi: any) => oi.order_id === o.id);
          const tickets = (ticketsByOrder.get(o.id) || []).map((t: any) => {
            const fn = funcMap.get(items.find((oi: any) => oi.function_id)?.function_id) || null;
            const ev = fn ? eventMap.get(fn.event_id) : null;
            return {
              ...t,
              function: fn ? { ...fn, event: ev } : null,
              zone: zoneMap.get(items.find((oi: any) => oi.zone_id)?.zone_id) || null,
            };
          });
          return { ...o, order_items: items, tickets };
        });
        setAllOrders(enriched);
      }
      
      setMetrics({ totalSales, totalTickets: ticketCount || 0, totalOrders: allPaidOrders?.filter((order: any) => order.status === "paid").length ?? 0 });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }


  async function approveOrder(id: string) {
    try {
      const { approveOrderAction } = await import("../actions");
      const res = await approveOrderAction(id);
      if (res.success) {
        setPendingPayments((prev) => prev.filter((p) => p.id !== id));
        loadDashboardData();
      } else {
        alert("Error: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + (err.message || "Error desconocido"));
    }
  }

  async function rejectOrder(id: string) {
    try {
      const { rejectOrderAction } = await import("../actions");
      const res = await rejectOrderAction(id);
      if (res.success) {
        setPendingPayments((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("Error: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + (err.message || "Error desconocido"));
    }
  }

  async function cancelSale(id: string) {
    if (!confirm("¿Anular esta venta? Las boletas se cancelarán y los asientos quedarán disponibles.")) return;

    try {
      setCancellingOrderId(id);
      const { cancelSaleAction } = await import("../actions");
      const res = await cancelSaleAction(id);

      if (res.success) {
        await loadDashboardData();
      } else {
        alert("Error: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + (err.message || "Error desconocido"));
    } finally {
      setCancellingOrderId(null);
    }
  }

  const reportEvents = events.map((event) => ({ id: event.id, name: event.name }));
  const filteredReportOrders = allOrders.filter((order) => {
    if (reportEventId === "all") return true;
    return getOrderEventId(order) === reportEventId;
  });
  const paidReportOrders = filteredReportOrders.filter((order) => order.status === "paid");
  const cancelledReportOrders = filteredReportOrders.filter((order) => order.status === "cancelled");
  const reportTotals = {
    sales: paidReportOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
    tickets: paidReportOrders.reduce((sum, order) => sum + getOrderTicketCount(order), 0),
    orders: paidReportOrders.length,
    cancelled: cancelledReportOrders.length,
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface/95 shadow-2xl shadow-black/20">
            <div className="border-b border-border p-5">
              <span className="badge badge-purple mb-3">Admin</span>
              <h1 className="text-2xl font-black leading-tight">Panel de control</h1>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Pagos, eventos, mapas y reportes en un solo lugar.
              </p>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {adminSections.map((section) => {
                const isActive = activeTab === section.id;
                const count = section.count?.({ pendingPayments, events });

                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveTab(section.id)}
                    className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                      isActive
                        ? "border-purple-500/50 bg-purple-500/15 text-white shadow-lg shadow-purple-950/20"
                        : "border-transparent text-muted hover:border-white/10 hover:bg-surface-2 hover:text-white"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${isActive ? "bg-purple-500/25" : "bg-white/5"}`}>
                      {section.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm font-bold">
                        {section.label}
                        {typeof count === "number" && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${count > 0 ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-muted"}`}>
                            {count}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">{section.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-border p-3">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Accesos rápidos</p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <a
                    key={action.href}
                    href={action.href}
                    className={`rounded-2xl border px-3 py-2 text-xs font-bold transition-colors ${
                      action.primary
                        ? "border-purple-500/40 bg-purple-600 text-white hover:bg-purple-500"
                        : "border-border bg-surface-2 text-muted hover:border-purple-500/40 hover:text-white"
                    }`}
                  >
                    <span className="mr-1.5">{action.icon}</span>
                    {action.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-purple-950/20 p-6 shadow-2xl shadow-black/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-300">Boletería Colombia</p>
                <h2 className="mt-2 text-3xl font-black">Gestión administrativa</h2>
                <p className="mt-1 text-sm text-muted">Control operativo de pagos, eventos, boletería y métricas.</p>
              </div>
              <a href="/admin/eventos/nuevo" className="btn-primary rounded-2xl px-4 py-2.5 text-xs font-black">
                + Crear evento
              </a>
            </div>
          </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6">
          <span className="text-xs text-muted block uppercase tracking-wider font-semibold">Ventas Totales</span>
          <span className="mt-2 block text-3xl font-black text-white">{formatCOP(metrics.totalSales)}</span>
        </div>
        <div className="card p-6">
          <span className="text-xs text-muted block uppercase tracking-wider font-semibold">Boletas Vendidas</span>
          <span className="mt-2 block text-3xl font-black text-white">{metrics.totalTickets} Boletas</span>
        </div>
        <div className="card p-6 border-amber-500/30 bg-amber-500/5">
          <span className="text-xs text-amber-400 block uppercase tracking-wider font-semibold">Pagos por Validar</span>
          <span className="mt-2 block text-3xl font-black text-amber-300">{pendingPayments.length} Pendientes</span>
          <span className="text-xs text-amber-400/80 mt-1 block">Requieren revisión manual</span>
        </div>
      </div>

      {activeTab === "payments" ? (
        <div className="card p-6 space-y-6">
          <h2 className="text-xl font-bold border-b border-border pb-4">
            Aprobación Manual de Transferencias
          </h2>

          {loading ? (
            <p className="py-8 text-center text-muted text-sm">Cargando pagos pendientes...</p>
          ) : pendingPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted uppercase">
                  <tr>
                    <th className="p-3">Código / Cliente</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Monto Total</th>
                    <th className="p-3">Método</th>
                    <th className="p-3">Comprobante</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-2/50">
                      <td className="p-3">
                        <span className="font-mono font-bold text-white block">{p.orderCode}</span>
                        <span className="text-muted block">{p.customerName}</span>
                      </td>
                      <td className="p-3 font-semibold">{p.event}</td>
                      <td className="p-3 font-bold text-emerald-400 text-sm">{formatCOP(p.amount)}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-semibold text-accent-2">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3">
                        {p.receiptUrl ? (
                          <button onClick={() => setSelectedReceipt(p.receiptUrl)} className="text-accent-2 underline font-semibold hover:text-white">
                            Ver Captura
                          </button>
                        ) : (
                          <span className="text-muted">Sin Comprobante</span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button onClick={() => approveOrder(p.id)} className="rounded-xl bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-500 transition-colors">
                          Aprobar
                        </button>
                        <button onClick={() => rejectOrder(p.id)} className="rounded-xl bg-red-600/30 border border-red-500/30 px-3 py-1.5 font-bold text-red-300 hover:bg-red-600/50 transition-colors">
                          Rechazar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted text-sm">No hay pagos pendientes por validar.</p>
          )}
        </div>
      ) : activeTab === "events" ? (
        <div className="card p-6 space-y-6">
          <h2 className="text-xl font-bold border-b border-border pb-4">Gestión de Eventos</h2>
          {events.map((ev) => (
            <div key={ev.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-surface p-4">
              <div>
                <h3 className="font-bold text-white">{ev.name}</h3>
                <p className="text-xs text-muted">
                  {ev.venue?.name} · {ev.venue?.city} · {ev.functions?.length ?? 0} función(es)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  ev.status === "published" ? "bg-emerald-500/20 text-emerald-400" : "bg-surface-2 text-muted"
                }`}>
                  {ev.status}
                </span>
                <a href={`/admin/eventos/${ev.id}`} className="btn-outline !py-1 !px-3 text-xs">Editar</a>
                <button
                  onClick={async () => {
                    const { updateEventStatusAction } = await import("../actions");
                    const newStatus = ev.status === "published" ? "draft" : "published";
                    await updateEventStatusAction(ev.id, newStatus);
                    setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, status: newStatus } : e));
                  }}
                  className="btn-outline !py-1 !px-3 text-xs"
                >
                  {ev.status === "published" ? "Ocultar" : "Publicar"}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Eliminar "${ev.name}"?`)) return;
                    const { deleteEventAction } = await import("../actions");
                    const result = await deleteEventAction(ev.id);
                    if (!result.success) {
                      alert("Error al eliminar evento: " + result.error);
                      return;
                    }
                    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
                  }}
                  className="btn-outline !py-1 !px-3 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "reports" ? (
        <div className="card p-6 space-y-6">
          <h2 className="text-xl font-bold border-b border-border pb-4">Reporte de Ventas</h2>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-xl bg-surface-2 p-4">
              <span className="text-xs text-muted block">Ingresos Totales</span>
              <span className="text-xl font-black text-emerald-400">{formatCOP(metrics.totalSales)}</span>
            </div>
            <div className="rounded-xl bg-surface-2 p-4">
              <span className="text-xs text-muted block">Órdenes Pagadas</span>
              <span className="text-xl font-black text-white">{metrics.totalOrders}</span>
            </div>
            <div className="rounded-xl bg-surface-2 p-4">
              <span className="text-xs text-muted block">Boletas Emitidas</span>
              <span className="text-xl font-black text-white">{metrics.totalTickets}</span>
            </div>
          </div>
          {allOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted uppercase">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Método</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allOrders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-surface-2/50">
                      <td className="p-3 text-muted">{new Date(o.created_at).toLocaleDateString("es-CO")}</td>
                      <td className="p-3 text-white">{o.customer_name}</td>
                      <td className="p-3">{o.order_items?.[0]?.event_functions?.event?.name || "—"}</td>
                      <td className="p-3">{o.payment_method}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">{formatCOP(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted text-sm">Aún no hay ventas registradas.</p>
          )}
        </div>
      ) : activeTab === "payment_methods" ? (
        <PaymentMethodsManager />
      ) : activeTab === "verification" ? (
        <PaymentVerificationQueue />
      ) : activeTab === "analytics" ? (
        <PaymentAnalytics />
      ) : (
        /* Mapas */
        <div className="card p-6 space-y-6">
          <h2 className="text-xl font-bold border-b border-border pb-4">Diseñador Visual de Ubicaciones</h2>
          <p className="text-sm text-muted">
            Configura los mapas interactivos (SVG) para cada función. Haz clic en "Diseñar Mapa" para dibujar las zonas.
          </p>

          {loading ? (
            <p className="py-8 text-center text-muted text-sm">Cargando eventos...</p>
          ) : events.length > 0 ? (
            <div className="space-y-6 divide-y divide-border">
              {events.map((ev) => (
                <div key={ev.id} className="pt-6 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{ev.name}</h3>
                      <p className="text-xs text-muted">
                        📍 {ev.venue?.name} · {ev.venue?.city} | Modo: <span className="font-semibold text-purple-400">{ev.sale_mode === 'assigned' ? 'Asientos Asignados' : 'Admisión General'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="ml-0 sm:ml-4 space-y-3">
                    {ev.functions && ev.functions.length > 0 ? (
                      ev.functions.map((fn: any) => {
                        const zonesWithMap = fn.zones?.filter((z: any) => z.map_coords).length ?? 0;
                        const totalZones = fn.zones?.length ?? 0;
                        
                        return (
                          <div key={fn.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-surface p-4">
                            <div className="space-y-1">
                              <p className="font-bold text-sm text-white">{fn.name || "Función única"}</p>
                              <p className="text-xs text-muted">
                                {new Date(fn.starts_at).toLocaleString("es-CO")}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {fn.zones?.map((z: any) => (
                                  <span
                                    key={z.id}
                                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold text-white/95"
                                    style={{ backgroundColor: z.color + "22", border: `1px solid ${z.color}44` }}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: z.color }} />
                                    {z.name} {z.map_coords ? "🎨" : "❌"}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <a
                                href={`/admin/funciones/${fn.id}/mapa`}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 transition-colors"
                              >
                                🎨 Diseñar Mapa ({zonesWithMap}/{totalZones})
                              </a>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted italic">Este evento no tiene funciones creadas.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted text-sm">No hay eventos disponibles.</p>
          )}
        </div>
      )}


      {/* Modal de Visor de Comprobante */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 space-y-4 text-center">
            <h4 className="text-lg font-bold">Comprobante de Transferencia Adjunto</h4>
            <div className="h-80 w-full overflow-hidden rounded-xl bg-black border border-border">
              <img src={selectedReceipt} alt="Comprobante" className="h-full w-full object-contain" />
            </div>
            <button onClick={() => setSelectedReceipt(null)} className="btn-primary w-full py-2">
              Cerrar Visor
            </button>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
