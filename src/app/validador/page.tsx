"use client";

import { useState } from "react";

export default function ValidadorPage() {
  const [manualCode, setManualCode] = useState("");
  const [stats, setStats] = useState({ scanned: 0, valid: 0, rejected: 0 });
  const [result, setResult] = useState<{
    status: "valid" | "invalid" | "already_redeemed";
    message: string;
    ticketDetails?: any;
  } | null>(null);

  const [isScanning, setIsScanning] = useState(false);

  async function handleScan(codeToValidate: string) {
    if (!codeToValidate) return;
    setIsScanning(true);

    try {
      const { redeemTicketAction } = await import("../actions");
      const res = await redeemTicketAction(codeToValidate);
      setResult(res as any);

      if (res.status === "valid") {
        setStats((prev) => ({ ...prev, scanned: prev.scanned + 1, valid: prev.valid + 1 }));
      } else {
        setStats((prev) => ({ ...prev, scanned: prev.scanned + 1, rejected: prev.rejected + 1 }));
      }
    } catch (error) {
      setResult({
        status: "invalid",
        message: "❌ Error de conexión con el servidor",
      });
      setStats((prev) => ({ ...prev, scanned: prev.scanned + 1, rejected: prev.rejected + 1 }));
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="text-center mb-6">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl text-white bg-purple-600 shadow-lg">
          🔍
        </span>
        <h1 className="mt-3 text-2xl font-black">Validador de Puerta</h1>
        <p className="text-xs text-muted">Escáner logístico para control de acceso en vivo</p>

        {/* Métricas de Aforo en Puerta */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-surface-2 p-3 text-center text-xs">
          <div>
            <span className="text-muted block text-[10px]">Lecturas</span>
            <strong className="text-base text-white">{stats.scanned}</strong>
          </div>
          <div>
            <span className="text-muted block text-[10px]">Ingresados</span>
            <strong className="text-base text-emerald-400">{stats.valid}</strong>
          </div>
          <div>
            <span className="text-muted block text-[10px]">Rechazados</span>
            <strong className="text-base text-red-400">{stats.rejected}</strong>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        {/* Simulación de Cámara / Escáner */}
        <div className="relative flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent/40 bg-surface-2 p-4 text-center overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent shadow-[0_0_15px_#7c3aed] animate-pulse" />
          <div className="text-4xl">📷</div>
          <p className="mt-2 text-xs font-semibold text-muted">Apunte la cámara al código QR de la boleta</p>
          <button
            onClick={() => handleScan("TB-" + Math.floor(100000 + Math.random() * 900000))}
            className="btn-primary mt-4 py-2 px-4 text-xs"
          >
            Simular Lectura de Cámara 📸
          </button>
        </div>

        {/* Ingreso manual por código corto */}
        <div className="space-y-2">
          <label className="label">O digite el código alfanumérico corto</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ej: TB-892341"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="input uppercase font-mono"
            />
            <button onClick={() => handleScan(manualCode)} className="btn-outline shrink-0">
              Validar
            </button>
          </div>
        </div>

        {/* Resultado del escaneo */}
        {result && (
          <div
            className={`rounded-2xl p-6 text-center space-y-3 transition-all ${
              result.status === "valid"
                ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300"
                : result.status === "already_redeemed"
                ? "bg-amber-500/20 border-2 border-amber-500 text-amber-300"
                : "bg-red-500/20 border-2 border-red-500 text-red-300"
            }`}
          >
            <h3 className="text-lg font-black">{result.message}</h3>

            {result.ticketDetails && (
              <div className="rounded-xl bg-black/40 p-4 text-left text-xs space-y-1.5 text-white">
                <p>
                  <strong>Evento:</strong> {result.ticketDetails.event}
                </p>
                <p>
                  <strong>Titular:</strong> {result.ticketDetails.holder}
                </p>
                <p>
                  <strong>Localidad:</strong> <span className="text-accent-2 font-bold">{result.ticketDetails.zone}</span>
                </p>
                <p>
                  <strong>Silla:</strong> {result.ticketDetails.seat}
                </p>
                <p>
                  <strong>Código:</strong> {result.ticketDetails.code}
                </p>
              </div>
            )}

            <button
              onClick={() => setResult(null)}
              className="mt-2 w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors"
            >
              Listo para Siguiente Boleta ➡️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
