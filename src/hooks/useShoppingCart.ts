'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, CartItem } from '@/types/cart';
import { useAuth } from '@/hooks/useAuth';

export function useShoppingCart() {
  const { user } = useAuth();
  const [cart, setCart] = useState<ShoppingCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Generar o recuperar sessionId para usuarios no autenticados
  useEffect(() => {
    if (!user) {
      let storedSessionId = localStorage.getItem('cart_session_id');
      if (!storedSessionId) {
        storedSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('cart_session_id', storedSessionId);
      }
      setSessionId(storedSessionId);
    }
  }, [user]);

  // Cargar carrito
  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/cart', {
        headers: {
          'x-session-id': sessionId || '',
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar carrito');
      }

      const data = await response.json();
      setCart(data);

      // Sincronizar con localStorage
      localStorage.setItem('cart_data', JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Intentar recuperar del localStorage
      const stored = localStorage.getItem('cart_data');
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId || user) {
      loadCart();
    }
  }, [sessionId, user, loadCart]);

  // Añadir item al carrito
  const addItem = useCallback(
    async (item: CartItem) => {
      if (!cart) return;

      try {
        const response = await fetch('/api/cart/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId || '',
          },
          body: JSON.stringify({
            cartId: cart.id,
            item,
          }),
        });

        if (!response.ok) {
          throw new Error('Error al añadir item');
        }

        const updatedCart = await response.json();
        setCart(updatedCart);
        localStorage.setItem('cart_data', JSON.stringify(updatedCart));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      }
    },
    [cart, sessionId]
  );

  // Actualizar cantidad de item
  const updateItemQuantity = useCallback(
    async (
      functionId: string,
      zoneId: string,
      quantity: number,
      seatIds?: string[]
    ) => {
      if (!cart) return;

      try {
        const response = await fetch('/api/cart/items', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId || '',
          },
          body: JSON.stringify({
            cartId: cart.id,
            functionId,
            zoneId,
            quantity,
            seatIds,
          }),
        });

        if (!response.ok) {
          throw new Error('Error al actualizar cantidad');
        }

        const updatedCart = await response.json();
        setCart(updatedCart);
        localStorage.setItem('cart_data', JSON.stringify(updatedCart));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      }
    },
    [cart, sessionId]
  );

  // Eliminar item
  const removeItem = useCallback(
    async (functionId: string, zoneId: string, seatIds?: string[]) => {
      if (!cart) return;

      try {
        const response = await fetch('/api/cart/items', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId || '',
          },
          body: JSON.stringify({
            cartId: cart.id,
            functionId,
            zoneId,
            seatIds,
          }),
        });

        if (!response.ok) {
          throw new Error('Error al eliminar item');
        }

        const updatedCart = await response.json();
        setCart(updatedCart);
        localStorage.setItem('cart_data', JSON.stringify(updatedCart));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      }
    },
    [cart, sessionId]
  );

  // Vaciar carrito
  const clearCart = useCallback(async () => {
    if (!cart) return;

    try {
      const response = await fetch('/api/cart/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId || '',
        },
        body: JSON.stringify({ cartId: cart.id }),
      });

      if (!response.ok) {
        throw new Error('Error al vaciar carrito');
      }

      const emptyCart = await response.json();
      setCart(emptyCart);
      localStorage.removeItem('cart_data');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  }, [cart, sessionId]);

  // Aplicar código promocional
  const applyPromoCode = useCallback(
    async (promoCode: string) => {
      if (!cart) return;

      try {
        const response = await fetch('/api/cart/promo-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId || '',
          },
          body: JSON.stringify({
            cartId: cart.id,
            promoCode,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al aplicar código');
        }

        const result = await response.json();

        // Recargar carrito para obtener datos actualizados
        await loadCart();

        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      }
    },
    [cart, sessionId, loadCart]
  );

  // Remover código promocional
  const removePromoCode = useCallback(async () => {
    if (!cart) return;

    try {
      const response = await fetch('/api/cart/promo-code', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId || '',
        },
        body: JSON.stringify({ cartId: cart.id }),
      });

      if (!response.ok) {
        throw new Error('Error al remover código promocional');
      }

      const updatedCart = await response.json();
      setCart(updatedCart);
      localStorage.setItem('cart_data', JSON.stringify(updatedCart));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    }
  }, [cart, sessionId]);

  return {
    cart,
    loading,
    error,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    applyPromoCode,
    removePromoCode,
    reload: loadCart,
  };
}
