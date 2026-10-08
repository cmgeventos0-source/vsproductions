"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCOP } from '@/lib/format';
import type { EventFunction, Zone, Seat } from "@/lib/types";
import { getZonePricing } from "@/lib/pricing";

type PaymentMethod = {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  requires_verification: boolean;
  verification_config: any;
  display_order: number;
};

export default function CheckoutForm({
  eventFunction,
  zone,
  seats,
  initialQuantity = 1,
}: {
  eventFunction: EventFunction & { event?: any };
  zone?: Zone;
  seats?: Seat[];
  initialQuantity?: number;
}) {
  const router = useRouter();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [methodsLoading, setMethodsLoading] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [copiedNumber, setCopiedNumber] = useState(false);

  // Cargar métodos de pago disponibles
  useEffect(() => {
    async function loadPaymentMethods() {
      try {
        const res = await fetch("/api/admin/payment-methods");
        if (res.ok) {
          const methods = await res.json();
          const enabledMethods = methods.filter((m: PaymentMethod) => m.enabled);
          setPaymentMethods(enabledMethods);
          if (enabledMethods.length > 0) {
            setSelectedMethod(enabledMethods[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading payment methods:", error);
      } finally {
        setMethodsLoading(false);
      }
    }
    loadPaymentMethods();
  }, []);

  const [customQty, setCustomQty] = useState<number>(initialQuantity || 1);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);

  const event = eventFunction.event;
  const isAssigned = seats && seats.length > 0;
  const quantity = isAssigned ? seats.length : Math.max(1, customQty);
  const zonePricing = zone ? getZonePricing(zone) : { currentPrice: 0, fullPrice: 0 };
  const unitPrice = zonePricing.currentPrice;
  const subtotal = isAssigned
    ? seats.reduce((acc, s) => acc + unitPrice, 0)
    : unitPrice * quantity;

  const serviceFee = 0;
  const total = subtotal;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!selectedMethod) {
      setError("Por favor selecciona un método de pago.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("customerName", customerName);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("idNumber", idNumber);
    formData.append("paymentMethod", selectedMethod);
    formData.append("total", total.toString());
    formData.append("subtotal", subtotal.toString());
    formData.append("serviceFee", serviceFee.toString());
    formData.append("functionId", eventFunction.id);
    if (zone) formData.append("zoneId", zone.id);
    if (event?.id) formData.append("eventId", event.id);
    if (seats && seats.length > 0) formData.append("seatIds", JSON.stringify(seats.map(s => s.id)));
    if (receiptFile) formData.append("receiptFile", receiptFile);
    if (promoCode) formData.append("promoCode", promoCode);
    formData.append("quantity", quantity.toString());

    try {
      const { createOrder } = await import("../app/actions");
      const result = await createOrder(formData);

      if (result.success) {
        if (selectedMethod === "wompi") {
          const res = await fetch("/api/payments/wompi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: result.orderId }),
          });
          const wompiData = await res.json();
          if (wompiData.url) {
            window.location.href = wompiData.url;
            return;
          } else {
            throw new Error(wompiData.error || "Error al conectar con Wompi");
          }
        } else {
          setOrderCompleted(result.orderId);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al procesar el pedido.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (orderCompleted) {
    return (
      <div className="mx-auto max-w-xl p-6 sm:p-8 text-center card my-6 sm:my-10 space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400">
          ✅
        </div>
        <h2 className="text-2xl font-black text-white">¡Pedido Registrado con Éxito!</h2>
        <p className="text-sm text-muted">
          Tu orden <strong className="text-foreground">{orderCompleted}</strong> ha sido creada correctamente.
        </p>

        <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 p-4 text-xs text-purple-200 text-left space-y-1">
          <p className="font-bold text-sm text-white">📧 Información de entrega</p>
          <p>Tus boletas digitales han sido asociadas al correo: <strong className="text-purple-300">{email}</strong> y celular <strong className="text-purple-300">{phone}</strong>.</p>
        </div>

        {selectedMethod?.includes("direct") ? (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-300 space-y-2 text-left">
            <p className="font-bold">⏳ Estado: Pendiente de Verificación</p>
            <p>
              Nuestro equipo revisará el comprobante de transferencia. Una vez verificado, las boletas se activarán automáticamente.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-300 text-left">
            <p className="font-bold">🎉 Pago Confirmado</p>
            <p>Tus boletas digitales con código QR dinámico están listas.</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <a href="/eventos" className="btn-primary flex-1 py-3 text-center">
            Explorar Más Eventos
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-10 pb-28 sm:pb-10">
      {/* Banner sin registro obligatorio */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-purple-900/40 via-violet-900/30 to-slate-900/40 border border-purple-500/30 p-4 text-xs sm:text-sm text-purple-200 flex items-center gap-3 shadow-lg">
        <span className="text-2xl shrink-0">⚡</span>
        <div>
          <p className="font-bold text-white">Compra Directa y Rápida (Sin Registro Necesario)</p>
          <p className="text-muted text-xs">Completa los datos del comprador abajo y tus boletas llegarán a tu correo al instante.</p>
        </div>
      </div>

      <h1 className="mb-6 text-2xl sm:text-3xl font-black text-white">Finalizar Compra</h1>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Formulario Principal */}
        <form onSubmit={handleCheckout} className="space-y-6 lg:col-span-2">
          {/* Datos del Asistente */}
          <div className="card p-5 sm:p-6 space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold">1</span>
              Datos del Comprador
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label text-xs sm:text-sm font-semibold">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input w-full text-base py-3"
                />
              </div>
              <div>
                <label className="label text-xs sm:text-sm font-semibold">Cédula / Documento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1098765432"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="input w-full text-base py-3"
                />
              </div>
              <div>
                <label className="label text-xs sm:text-sm font-semibold">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input w-full text-base py-3"
                />
              </div>
              <div>
                <label className="label text-xs sm:text-sm font-semibold">Teléfono Celular</label>
                <input
                  type="tel"
                  required
                  placeholder="3001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input w-full text-base py-3"
                />
              </div>
            </div>
          </div>

          {/* Método de Pago */}
          <div className="card p-5 sm:p-6 space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold">2</span>
              Método de Pago
            </h3>

            {methodsLoading ? (
              <div className="text-center py-4 text-gray-400">Cargando métodos de pago...</div>
            ) : paymentMethods.length > 0 ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethod(method.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedMethod === method.id
                        ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500"
                        : "border-border bg-surface-2 hover:border-muted"
                    }`}
                  >
                    <span className="block font-bold text-white text-sm sm:text-base">
                      {method.icon === 'smartphone' && '📱'}
                      {method.icon === 'banknote' && '🏦'}
                      {method.icon === 'wallet' && '💰'}
                      {method.icon === 'credit-card' && '💳'}
                      {' '}{method.name}
                    </span>
                    <span className="text-xs text-muted block mt-0.5">
                      {method.requires_verification ? 'Verificación manual' : 'Confirmación inmediata'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-red-400">No hay métodos de pago disponibles</div>
            )}

            {/* Instrucciones según el método */}
            {selectedMethod && (() => {
              const currentMethodObj = paymentMethods.find(m => m.id === selectedMethod);
              const config = currentMethodObj?.verification_config || {};
              const accountNumber = config.account_number || "310 987 6543";
              const accountType = config.account_type || currentMethodObj?.name || "Cuenta";
              const accountOwner = config.account_owner || "";
              const customInstructions = config.instructions;

              return (
                <div className="mt-4 rounded-2xl border border-white/10 bg-surface-2 p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-purple-300">💡 Datos para Transferir ({currentMethodObj?.name})</span>
                    {accountNumber && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(accountNumber.replace(/\s+/g, ""))}
                        className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg hover:bg-purple-500/30 transition-colors"
                      >
                        {copiedNumber ? "✓ ¡Copiado!" : "📋 Copiar Número"}
                      </button>
                    )}
                  </div>
                  <div className="text-xs space-y-1.5 text-muted">
                    <p>
                      • Transfiere el valor exacto de <strong className="text-white text-sm">{formatCOP(total)}</strong> a:
                    </p>
                    <div className="rounded-xl bg-surface p-3 border border-white/10 space-y-1">
                      <p className="font-mono text-sm sm:text-base font-black text-emerald-400 flex items-center gap-2">
                        💳 {accountNumber}
                      </p>
                      <p className="text-xs text-white font-semibold">
                        {accountType} {accountOwner ? `· Titular: ${accountOwner}` : ""}
                      </p>
                    </div>
                    <p className="pt-1">• {customInstructions || "Adjunta la captura o comprobante de tu pago a continuación:"}</p>
                  </div>

                  {currentMethodObj?.requires_verification && (
                    <div className="pt-2">
                      <label className="label text-xs font-semibold">Comprobante de Pago (Imagen o PDF)</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        required
                        onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                        className="input w-full cursor-pointer text-xs py-2"
                      />
                      {receiptFile && (
                        <p className="text-xs text-green-400 mt-2">✓ Comprobante listo: {receiptFile.name}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="card p-5 sm:p-6 space-y-3">
            <label className="label text-xs sm:text-sm font-semibold">Código de Descuento (Opcional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej: DESCUENTO20"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="input flex-1 text-base uppercase"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-surface-2 p-4 text-xs space-y-2">
            <label className="flex items-start gap-3 cursor-pointer text-muted">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-border text-purple-600 focus:ring-purple-500 shrink-0"
                required
              />
              <span className="leading-snug">
                Acepto los <strong className="text-white">Términos y Condiciones</strong> y la{" "}
                <strong className="text-white">Política de Datos (Ley 1581)</strong> para la emisión de mi boleta digital.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !acceptedTerms}
            className="btn-primary w-full py-4 text-base sm:text-lg font-black disabled:opacity-40 disabled:cursor-not-allowed shadow-xl"
          >
            {isSubmitting ? "Procesando Pedido..." : `Confirmar y Pagar ${formatCOP(total)}`}
          </button>
        </form>

        {/* Resumen lateral */}
        <div className="card p-5 sm:p-6 h-fit space-y-4">
          <h3 className="text-base sm:text-lg font-bold border-b border-border pb-3 text-white">Resumen de Compra</h3>
          <div>
            <span className="text-xs text-muted block">{event?.name}</span>
            <span className="font-semibold text-sm text-white">{eventFunction.name}</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted">Localidad:</span>
              <span className="font-bold text-white">{zone?.name ?? "General"}</span>
            </div>
            {isAssigned ? (
              <div className="flex justify-between items-center">
                <span className="text-muted">Sillas:</span>
                <span className="font-semibold text-purple-300">
                  {seats.map((s) => `Fila ${s.row_name} - Silla ${s.number}`).join(", ")}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center border-t border-border pt-3">
                <span className="text-muted font-bold text-white">Boletas:</span>
                <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                    disabled={customQty <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface font-bold text-white hover:bg-purple-600 disabled:opacity-30 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-extrabold text-sm text-purple-300">
                    {customQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => q + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface font-bold text-white hover:bg-purple-600 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted">Precio Unitario:</span>
              <span className="text-white">{formatCOP(unitPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Subtotal ({quantity} boletas):</span>
              <span className="text-white">{formatCOP(subtotal)}</span>
            </div>
            {serviceFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Servicio Tuboleta:</span>
                <span className="text-white">{formatCOP(serviceFee)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-sm sm:text-base font-black text-white">
              <span>Total a pagar:</span>
              <span className="text-accent-2">{formatCOP(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de pago flotante para móvil */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-[#09090f]/95 border-t border-white/10 backdrop-blur-md z-40 flex items-center justify-between gap-3 shadow-2xl">
        <div>
          <p className="text-[10px] text-muted">{quantity} boleta(s) · Total</p>
          <p className="text-lg font-black text-white leading-none">{formatCOP(total)}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            const form = document.querySelector("form");
            if (form) form.requestSubmit();
          }}
          disabled={isSubmitting || !acceptedTerms}
          className="btn-primary py-3 px-6 text-sm font-black disabled:opacity-40"
        >
          {isSubmitting ? "Procesando..." : "Pagar Ahora →"}
        </button>
      </div>
    </div>
  );
}
