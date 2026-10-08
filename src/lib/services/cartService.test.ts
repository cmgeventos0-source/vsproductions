import { CartService } from '@/lib/services/cartService';
import { createClient } from '@supabase/supabase-js';

// Mock de Supabase
jest.mock('@supabase/supabase-js');

describe('CartService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      }),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('getOrCreateCart', () => {
    it('debe obtener un carrito existente para un usuario', async () => {
      const mockCart = {
        id: 'cart-1',
        user_id: 'user-1',
        items: [],
        subtotal: 0,
        discount_amount: 0,
        total: 0,
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      };

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: mockCart,
        error: null,
      });

      const cart = await CartService.getOrCreateCart('user-1');

      expect(cart).toEqual({
        id: 'cart-1',
        userId: 'user-1',
        items: [],
        subtotal: 0,
        discountAmount: 0,
        total: 0,
        createdAt: '2026-08-13T00:00:00Z',
        updatedAt: '2026-08-13T00:00:00Z',
      });
    });

    it('debe crear un nuevo carrito si no existe', async () => {
      const mockCart = {
        id: 'cart-new',
        user_id: 'user-1',
        items: [],
        subtotal: 0,
        discount_amount: 0,
        total: 0,
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      };

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSupabase.from('shopping_carts').insert().select().single.mockResolvedValue({
        data: mockCart,
        error: null,
      });

      const cart = await CartService.getOrCreateCart('user-1');

      expect(cart.id).toBe('cart-new');
    });
  });

  describe('addItem', () => {
    it('debe añadir un item al carrito', async () => {
      const cartId = 'cart-1';
      const newItem = {
        functionId: 'func-1',
        eventId: 'event-1',
        zoneId: 'zone-1',
        quantity: 2,
        price: 50000,
        eventName: 'Concierto',
        zoneName: 'VIP',
        functionDateTime: '2026-09-01 20:00',
      };

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: {
          items: [],
          subtotal: 0,
        },
        error: null,
      });

      mockSupabase.from('shopping_carts').update().eq().select().single.mockResolvedValue({
        data: {
          id: cartId,
          items: [newItem],
          subtotal: 100000,
          discount_amount: 0,
          total: 100000,
          created_at: '2026-08-13T00:00:00Z',
          updated_at: '2026-08-13T00:00:00Z',
        },
        error: null,
      });

      const result = await CartService.addItem(cartId, newItem);

      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(100000);
    });

    it('debe incrementar cantidad si el item ya existe', async () => {
      const cartId = 'cart-1';
      const existingItem = {
        functionId: 'func-1',
        eventId: 'event-1',
        zoneId: 'zone-1',
        quantity: 1,
        price: 50000,
        eventName: 'Concierto',
        zoneName: 'VIP',
        functionDateTime: '2026-09-01 20:00',
      };

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: {
          items: [existingItem],
          subtotal: 50000,
        },
        error: null,
      });

      mockSupabase.from('shopping_carts').update().eq().select().single.mockResolvedValue({
        data: {
          id: cartId,
          items: [{ ...existingItem, quantity: 2 }],
          subtotal: 100000,
          discount_amount: 0,
          total: 100000,
          created_at: '2026-08-13T00:00:00Z',
          updated_at: '2026-08-13T00:00:00Z',
        },
        error: null,
      });

      const result = await CartService.addItem(cartId, existingItem);

      expect(result.items[0].quantity).toBe(2);
      expect(result.subtotal).toBe(100000);
    });
  });

  describe('applyPromoCode', () => {
    it('debe aplicar un código promocional válido', async () => {
      const cartId = 'cart-1';
      const promoCode = 'PROMO10';

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: {
          subtotal: 100000,
          items: [],
          promo_code_id: null,
        },
        error: null,
      });

      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      mockSupabase.from('promo_codes').select().eq().single.mockResolvedValue({
        data: {
          id: 'promo-1',
          code: 'PROMO10',
          discount_type: 'percentage',
          discount_value: 10,
          min_purchase: null,
          max_uses: null,
          current_uses: 0,
          valid_from: pastDate.toISOString(),
          valid_until: futureDate.toISOString(),
          active: true,
        },
        error: null,
      });

      mockSupabase.from('shopping_carts').update().eq().mockResolvedValue({
        error: null,
      });

      const result = await CartService.applyPromoCode(cartId, promoCode);

      expect(result.success).toBe(true);
      expect(result.discountAmount).toBe(10000); // 10% de 100000
      expect(result.finalTotal).toBe(90000);
    });

    it('debe rechazar código promocional expirado', async () => {
      const cartId = 'cart-1';
      const promoCode = 'EXPIRED';

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: {
          subtotal: 100000,
          items: [],
          promo_code_id: null,
        },
        error: null,
      });

      const expiredDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      mockSupabase.from('promo_codes').select().eq().single.mockResolvedValue({
        data: {
          id: 'promo-1',
          code: 'EXPIRED',
          discount_type: 'percentage',
          discount_value: 10,
          min_purchase: null,
          max_uses: null,
          current_uses: 0,
          valid_from: pastDate.toISOString(),
          valid_until: expiredDate.toISOString(),
          active: true,
        },
        error: null,
      });

      await expect(CartService.applyPromoCode(cartId, promoCode)).rejects.toThrow(
        'Código promocional expirado'
      );
    });

    it('debe rechazar código agotado', async () => {
      const cartId = 'cart-1';
      const promoCode = 'AGOTADO';

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: {
          subtotal: 100000,
          items: [],
          promo_code_id: null,
        },
        error: null,
      });

      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      mockSupabase.from('promo_codes').select().eq().single.mockResolvedValue({
        data: {
          id: 'promo-1',
          code: 'AGOTADO',
          discount_type: 'percentage',
          discount_value: 10,
          min_purchase: null,
          max_uses: 5,
          current_uses: 5,
          valid_from: pastDate.toISOString(),
          valid_until: futureDate.toISOString(),
          active: true,
        },
        error: null,
      });

      await expect(CartService.applyPromoCode(cartId, promoCode)).rejects.toThrow(
        'Código promocional agotado'
      );
    });
  });

  describe('removeItem', () => {
    it('debe eliminar un item del carrito', async () => {
      const cartId = 'cart-1';

      mockSupabase.from('shopping_carts').select().eq().single.mockResolvedValue({
        data: {
          items: [
            {
              functionId: 'func-1',
              zoneId: 'zone-1',
              quantity: 2,
              price: 50000,
            },
          ],
          subtotal: 100000,
        },
        error: null,
      });

      mockSupabase.from('shopping_carts').update().eq().select().single.mockResolvedValue({
        data: {
          id: cartId,
          items: [],
          subtotal: 0,
          discount_amount: 0,
          total: 0,
          created_at: '2026-08-13T00:00:00Z',
          updated_at: '2026-08-13T00:00:00Z',
        },
        error: null,
      });

      const result = await CartService.removeItem(cartId, 'func-1', 'zone-1');

      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('debe vaciar todos los items del carrito', async () => {
      const cartId = 'cart-1';

      mockSupabase.from('shopping_carts').update().eq().select().single.mockResolvedValue({
        data: {
          id: cartId,
          items: [],
          subtotal: 0,
          discount_amount: 0,
          total: 0,
          promo_code_id: null,
          created_at: '2026-08-13T00:00:00Z',
          updated_at: '2026-08-13T00:00:00Z',
        },
        error: null,
      });

      const result = await CartService.clearCart(cartId);

      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe(0);
      expect(result.total).toBe(0);
      expect(result.promoCodeId).toBeNull();
    });
  });
});
