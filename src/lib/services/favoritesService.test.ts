import { FavoritesService, ReferralService } from '@/lib/services/favoritesService';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('FavoritesService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
      }),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('getUserFavorites', () => {
    it('debe obtener los IDs de eventos favoritos del usuario', async () => {
      mockSupabase.from('favorites').select().eq().mockResolvedValue({
        data: [{ event_id: 'event-1' }, { event_id: 'event-2' }],
        error: null,
      });

      const favorites = await FavoritesService.getUserFavorites('user-1');

      expect(favorites).toEqual(['event-1', 'event-2']);
    });

    it('debe retornar array vacío si no hay favoritos', async () => {
      mockSupabase.from('favorites').select().eq().mockResolvedValue({
        data: [],
        error: null,
      });

      const favorites = await FavoritesService.getUserFavorites('user-1');

      expect(favorites).toEqual([]);
    });
  });

  describe('addToFavorites', () => {
    it('debe añadir un evento a favoritos', async () => {
      const mockFavorite = {
        id: 'fav-1',
        user_id: 'user-1',
        event_id: 'event-1',
        created_at: '2026-08-13T00:00:00Z',
      };

      mockSupabase.from('favorites').insert().select().single.mockResolvedValue({
        data: mockFavorite,
        error: null,
      });

      const result = await FavoritesService.addToFavorites('user-1', 'event-1');

      expect(result.id).toBe('fav-1');
      expect(result.eventId).toBe('event-1');
    });

    it('debe rechazar si el evento ya está en favoritos', async () => {
      mockSupabase.from('favorites').insert().select().single.mockResolvedValue({
        data: null,
        error: { code: '23505' }, // Unique constraint violation
      });

      await expect(FavoritesService.addToFavorites('user-1', 'event-1')).rejects.toThrow(
        'Evento ya está en favoritos'
      );
    });
  });

  describe('removeFromFavorites', () => {
    it('debe eliminar un evento de favoritos', async () => {
      mockSupabase.from('favorites').delete().eq().mockResolvedValue({
        error: null,
      });

      await expect(
        FavoritesService.removeFromFavorites('user-1', 'event-1')
      ).resolves.not.toThrow();
    });
  });

  describe('isFavorite', () => {
    it('debe retornar true si el evento está en favoritos', async () => {
      mockSupabase.from('favorites').select().eq().single.mockResolvedValue({
        data: { id: 'fav-1' },
        error: null,
      });

      const result = await FavoritesService.isFavorite('user-1', 'event-1');

      expect(result).toBe(true);
    });

    it('debe retornar false si el evento no está en favoritos', async () => {
      mockSupabase.from('favorites').select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await FavoritesService.isFavorite('user-1', 'event-1');

      expect(result).toBe(false);
    });
  });

  describe('getUserFavoritesWithDetails', () => {
    it('debe obtener favoritos con detalles del evento', async () => {
      mockSupabase.from('favorites').select().eq().order().mockResolvedValue({
        data: [
          {
            id: 'fav-1',
            created_at: '2026-08-13T00:00:00Z',
            event: {
              id: 'event-1',
              name: 'Concierto',
              description: 'Gran concierto',
              image_url: 'https://example.com/img.jpg',
              category_id: 'cat-1',
              city: 'Bogotá',
            },
          },
        ],
        error: null,
      });

      const result = await FavoritesService.getUserFavoritesWithDetails('user-1');

      expect(result).toHaveLength(1);
      expect((result[0].event as any).name).toBe('Concierto');
    });
  });
});

describe('ReferralService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
      }),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('generateReferralCode', () => {
    it('debe generar un nuevo código referral', async () => {
      mockSupabase.from('referral_codes').select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSupabase.from('referral_codes').insert().select().single.mockResolvedValue({
        data: {
          id: 'ref-1',
          user_id: 'user-1',
          code: 'REF12345ABC',
          discount_percentage: 5,
          total_referrals: 0,
          total_earned: 0,
          active: true,
          created_at: '2026-08-13T00:00:00Z',
        },
        error: null,
      });

      const result = await ReferralService.generateReferralCode('user-1', 5);

      expect(result.code).toBeDefined();
      expect(result.discountPercentage).toBe(5);
      expect(result.totalReferrals).toBe(0);
    });

    it('debe retornar código existente si ya existe', async () => {
      mockSupabase.from('referral_codes').select().eq().single.mockResolvedValue({
        data: {
          id: 'ref-1',
          user_id: 'user-1',
          code: 'EXISTENTE',
          discount_percentage: 5,
          total_referrals: 2,
          total_earned: 50000,
          active: true,
          created_at: '2026-08-13T00:00:00Z',
        },
        error: null,
      });

      const result = await ReferralService.generateReferralCode('user-1', 5);

      expect(result.code).toBe('EXISTENTE');
      expect(result.totalReferrals).toBe(2);
    });
  });

  describe('getUserReferralCode', () => {
    it('debe obtener el código referral del usuario', async () => {
      mockSupabase.from('referral_codes').select().eq().single.mockResolvedValue({
        data: {
          id: 'ref-1',
          user_id: 'user-1',
          code: 'MICODIGO',
          discount_percentage: 5,
          total_referrals: 1,
          total_earned: 25000,
          active: true,
          created_at: '2026-08-13T00:00:00Z',
        },
        error: null,
      });

      const result = await ReferralService.getUserReferralCode('user-1');

      expect(result?.code).toBe('MICODIGO');
      expect(result?.totalReferrals).toBe(1);
    });

    it('debe retornar null si no existe código', async () => {
      mockSupabase.from('referral_codes').select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await ReferralService.getUserReferralCode('user-1');

      expect(result).toBeNull();
    });
  });

  describe('applyReferralCode', () => {
    it('debe aplicar código referral a una orden', async () => {
      mockSupabase.from('referral_codes').select().eq().single.mockResolvedValue({
        data: {
          id: 'ref-1',
          user_id: 'referrer-1',
          code: 'REFERRAL5',
          discount_percentage: 5,
          total_referrals: 0,
          total_earned: 0,
          active: true,
        },
        error: null,
      });

      mockSupabase.from('orders').select().eq().single.mockResolvedValue({
        data: {
          id: 'order-1',
          total: 100000,
          user_id: 'user-1',
        },
        error: null,
      });

      mockSupabase.from('referral_uses').insert().mockResolvedValue({
        error: null,
      });

      mockSupabase.from('referral_codes').update().eq().mockResolvedValue({
        error: null,
      });

      const result = await ReferralService.applyReferralCode('REFERRAL5', 'order-1');

      expect(result.discount).toBe(5000); // 5% de 100000
      expect(result.referrerEarned).toBe(2500); // 50% del descuento
    });

    it('debe rechazar código referral inválido', async () => {
      mockSupabase.from('referral_codes').select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(ReferralService.applyReferralCode('INVALIDO', 'order-1')).rejects.toThrow(
        'Código referral inválido'
      );
    });
  });

  describe('getReferralStats', () => {
    it('debe obtener estadísticas del código referral', async () => {
      mockSupabase.from('referral_codes').select().eq().single.mockResolvedValue({
        data: {
          id: 'ref-1',
          user_id: 'user-1',
          code: 'STATS',
          discount_percentage: 5,
          total_referrals: 3,
          total_earned: 75000,
          active: true,
        },
        error: null,
      });

      mockSupabase.from('referral_uses').select().eq().order().mockResolvedValue({
        data: [
          { discount_applied: 25000, created_at: '2026-08-13T00:00:00Z' },
          { discount_applied: 25000, created_at: '2026-08-12T00:00:00Z' },
          { discount_applied: 25000, created_at: '2026-08-11T00:00:00Z' },
        ],
        error: null,
      });

      const result = await ReferralService.getReferralStats('user-1');

      expect(result?.code).toBe('STATS');
      expect(result?.totalReferrals).toBe(3);
      expect(result?.totalEarned).toBe(75000);
      expect(result?.recentUses).toHaveLength(3);
    });
  });

  describe('deactivateReferralCode', () => {
    it('debe desactivar un código referral', async () => {
      mockSupabase.from('referral_codes').update().eq().mockResolvedValue({
        error: null,
      });

      await expect(
        ReferralService.deactivateReferralCode('user-1')
      ).resolves.not.toThrow();
    });
  });
});
