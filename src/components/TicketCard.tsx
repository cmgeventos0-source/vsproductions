"use client";

import { useState, useEffect } from "react";
import type { Ticket } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  const [totpCounter, setTotpCounter] = useState(30);
  const [qrTimestamp, setQrTimestamp] = useState(0);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferSuccess, setTransferSuccess] = useState(false);

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [currentTicket, setCurrentTicket] = useState(ticket);

  const handleTransfer = async () => {
    if (!transferEmail) return;
    setIsTransferring(true);
    setTransferError(null);

    try {
      const { transferTicketAction } = await import("@/app/actions");
      const res = await transferTicketAction(currentTicket.id, transferEmail);

      if (res.success) {
        setTransferSuccess(true);
        setCurrentTicket((prev) => ({
          ...prev,
          holder_name: res.holderName || prev.holder_name,
          code: res.newCode || prev.code,
          qr_data: res.newCode || prev.qr_data,
        }));
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferSuccess(false);
          setTransferEmail("");
        }, 2000);
      } else {
        setTransferError(res.error || "Error al transferir la boleta.");
      }
    } catch (err: any) {
      setTransferError(err.message || "Error al procesar la transferencia.");
    } finally {
      setIsTransferring(false);
    }
  };

  useEffect(() => {
    setQrTimestamp(Math.floor(Date.now() / 30000));

    const timer = setInterval(() => {
      setTotpCounter((prev) => (prev <= 1 ? 30 : prev - 1));
      setQrTimestamp(Math.floor(Date.now() / 30000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const event = (currentTicket.function as any)?.event;
  const functionInfo = currentTicket.function;
  const zone = currentTicket.zone;
  const seat = currentTicket.seat;

  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    JSON.stringify({ t: currentTicket.id, c: currentTicket.code, ts: qrTimestamp })
  )}&color=000000&bgcolor=ffffff`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl transition-transform hover:scale-[1.01]">
      {/* Event Header Banner */}
      <div className="relative h-44 w-full bg-surface-2 overflow-hidden">
        {event?.image_url ? (
          <img src={event.image_url} alt={event.name} className="h-full w-full object-cover opacity-60" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-purple-900 to-pink-900 opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        
        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
          <div>
            <span className="rounded-full bg-accent-2/20 px-3 py-1 text-xs font-bold text-accent-2 border border-accent-2/30 backdrop-blur">
              {zone?.name ?? "ENTRADA GENERAL"}
            </span>
            <h3 className="mt-2 text-xl font-black leading-snug text-white">{event?.name ?? "Evento Boletería.CO"}</h3>
            <p className="text-xs text-muted">
              {functionInfo?.starts_at ? formatDateTime(functionInfo.starts_at) : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Ticket Details */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface-2 p-4 text-xs">
          <div>
            <span className="text-muted block">Titular</span>
            <span className="font-bold text-foreground text-sm">{currentTicket.holder_name ?? "Asistente registrado"}</span>
          </div>
          <div>
            <span className="text-muted block">Ubicación / Silla</span>
            <span className="font-bold text-accent-2 text-sm">
              {seat ? `Fila ${seat.row_name} · Silla ${seat.number}` : "Ingreso Libre"}
            </span>
          </div>
          <div>
            <span className="text-muted block">Código Boleta</span>
            <span className="font-mono text-muted">{currentTicket.code}</span>
          </div>
          <div>
            <span className="text-muted block">Estado</span>
            <span className="font-semibold text-emerald-400">● Activa</span>
          </div>
        </div>

        {/* Dynamic Anti-Fraud QR Code Section */}
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-center text-slate-900 shadow-inner">
          <div className="relative p-2 bg-white rounded-xl">
            <img src={dynamicQrUrl} alt="QR de Ingreso" className="h-44 w-44 object-contain" />
          </div>
          
          <div className="mt-3 flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-semibold text-slate-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
            </span>
            <span>Actualizando QR en <strong className="text-purple-700 font-mono">{totpCounter}s</strong></span>
          </div>
          <span className="mt-1 text-[10px] text-slate-400">Protección anti-captura de pantalla activada</span>
        </div>

        {/* Ticket Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setShowTransferModal(true)}
            className="btn-outline flex-1 py-2.5 text-xs"
          >
            🔄 Transferir Boleta
          </button>
          <a
            href={`/api/ticket/download?id=${currentTicket.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost flex-1 py-2.5 text-xs text-center border border-border rounded-xl"
          >
            📄 PDF Oficial
          </a>
        </div>
      </div>

      {/* Modal de Transferencia */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h4 className="text-lg font-bold">Transferir Boleta ("Pásala")</h4>
            <p className="text-xs text-muted">
              Ingresa el correo electrónico del nuevo titular. Al transferirla, tu código actual se revocará por seguridad.
            </p>
            {transferSuccess ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center text-xs font-semibold text-emerald-400">
                ¡Boleta transferida con éxito!
              </div>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="correo@amigo.com"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className="input"
                  disabled={isTransferring}
                />
                {transferError && (
                  <p className="text-xs text-red-400">{transferError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTransferModal(false)}
                    className="btn-ghost flex-1"
                    disabled={isTransferring}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={isTransferring || !transferEmail}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {isTransferring ? "Procesando..." : "Confirmar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
