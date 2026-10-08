'use client';

import { useState } from 'react';
import { useShoppingCart } from '@/hooks/useShoppingCart';
import { ShoppingCart as CartIcon, Trash2, Plus, Minus } from 'lucide-react';
import Link from 'next/link';

export function ShoppingCartComponent() {
  const { cart, loading, error, removeItem, updateItemQuantity, applyPromoCode, removePromoCode } =
    useShoppingCart();
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin text-purple-400">
          <CartIcon className="w-8 h-8" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-sm">
        {error}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-16 card p-8 space-y-4">
        <CartIcon className="w-16 h-16 mx-auto text-muted mb-2" />
        <h2 className="text-2xl font-black text-white">Tu carrito está vacío</h2>
        <p className="text-sm text-muted">Aún no has agregado boletas a tu carrito de compras.</p>
        <div className="pt-2">
          <Link
            href="/eventos"
            className="btn-primary inline-flex px-6 py-3"
          >
            Explorar Eventos
          </Link>
        </div>
      </div>
    );
  }

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError('Ingresa un código promocional');
      return;
    }

    try {
      setApplyingPromo(true);
      setPromoError('');
      await applyPromoCode(promoCode);
      setPromoCode('');
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Error al aplicar código');
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleWompiPayment = async () => {
    try {
      const response = await fetch('/api/payments/wompi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: cart?.id }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Error al iniciar pago');
      }
    } catch (err) {
      alert('No se pudo conectar con Wompi: ' + err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Resumen de items */}
      <div className="space-y-3">
        {cart.items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-center justify-between gap-4 p-5 card hover:border-purple-500/30 transition-all"
          >
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-bold text-white text-base">{item.eventName}</h3>
              <p className="text-xs text-muted mt-0.5">
                {item.zoneName} • {item.functionDateTime}
              </p>
              <p className="text-xs text-emerald-400 font-semibold mt-2">
                ${item.price.toLocaleString('es-CO')} COP x {item.quantity} =
                <strong className="ml-2 text-white font-bold text-sm">
                  ${(item.price * item.quantity).toLocaleString('es-CO')} COP
                </strong>
              </p>
            </div>

            {/* Controles de cantidad */}
            <div className="flex items-center gap-3 bg-surface-2 p-1.5 rounded-xl border border-border">
              <button
                onClick={() =>
                  updateItemQuantity(item.functionId, item.zoneId, item.quantity - 1, item.seatIds)
                }
                disabled={item.quantity <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface font-bold text-white hover:bg-purple-600 disabled:opacity-30 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <span className="w-8 text-center font-black text-sm text-purple-300">
                {item.quantity}
              </span>

              <button
                onClick={() =>
                  updateItemQuantity(item.functionId, item.zoneId, item.quantity + 1, item.seatIds)
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface font-bold text-white hover:bg-purple-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => removeItem(item.functionId, item.zoneId, item.seatIds)}
                className="ml-2 p-1.5 text-red-400 hover:text-red-300 transition-colors"
                title="Eliminar del carrito"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Código promocional */}
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-white text-sm">Código promocional</h3>

        {cart.promoCodeId ? (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
            <div className="text-xs">
              <p className="text-emerald-400 font-bold">✓ Código promocional aplicado</p>
              <p className="text-muted mt-0.5">Descuento: ${cart.discountAmount.toLocaleString('es-CO')} COP</p>
            </div>
            <button
              onClick={() => removePromoCode()}
              className="text-xs text-red-400 hover:text-red-300 font-bold"
            >
              Remover
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Ej: DESCUENTO10"
              className="flex-1 input text-sm uppercase"
            />
            <button
              onClick={handleApplyPromo}
              disabled={applyingPromo || !promoCode.trim()}
              className="btn-primary px-5 py-2.5 text-xs"
            >
              {applyingPromo ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        )}

        {promoError && <p className="text-red-400 text-xs">{promoError}</p>}
      </div>

      {/* Resumen de totales */}
      <div className="card p-5 space-y-3">
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-muted">
            <span>Subtotal:</span>
            <span className="font-semibold text-white">${cart.subtotal.toLocaleString('es-CO')} COP</span>
          </div>

          {cart.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-400 font-semibold">
              <span>Descuento:</span>
              <span>-${cart.discountAmount.toLocaleString('es-CO')} COP</span>
            </div>
          )}

          <div className="border-t border-border pt-3 flex justify-between text-base font-black text-white">
            <span>Total a pagar:</span>
            <span className="text-accent-2">${cart.total.toLocaleString('es-CO')} COP</span>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link
          href="/eventos"
          className="btn-outline flex-1 py-3 text-center"
        >
          Explorar Más Eventos
        </Link>
        <Link
          href="/checkout"
          className="btn-primary flex-1 py-3 text-center font-bold"
        >
          🛒 Continuar a Checkout
        </Link>
      </div>
    </div>
  );
}
