import { createClient } from '@supabase/supabase-js';
import { Favorite, ReferralCode } from '@/types/cart';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class FavoritesService {
  /**
   * Obtiene los favoritos del usuario
   */
  static async getUserFavorites(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('favorites')
      .select('event_id')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map((fav: any) => fav.event_id);
  }

  /**
   * Añade un evento a favoritos
   */
  static async addToFavorites(userId: string, eventId: string): Promise<Favorite> {
    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        event_id: eventId,
      })
      .select()
      .single();

    if (error && error.code === '23505') {
      // Ya existe
      throw new Error('Evento ya está en favoritos');
    }

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      eventId: data.event_id,
      createdAt: data.created_at,
    };
  }

  /**
   * Elimina un evento de favoritos
   */
  static async removeFromFavorites(
    userId: string,
    eventId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (error) throw error;
  }

  /**
   * Verifica si un evento está en favoritos
   */
  static async isFavorite(userId: string, eventId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single();

    if (error && error.code === 'PGRST116') {
      return false;
    }

    if (error) throw error;

    return !!data;
  }

  /**
   * Obtiene todos los favoritos con datos del evento
   */
  static async getUserFavoritesWithDetails(userId: string) {
    const { data, error } = await supabase
      .from('favorites')
      .select(
        `id, created_at,
        event:event_id(
          id, name, description, image_url, category_id, city,
          functions(id, event_date, event_time)
        )`
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  }
}

export class ReferralService {
  /**
   * Genera un código referral único para el usuario
   */
  static async generateReferralCode(
    userId: string,
    discountPercentage: number = 5
  ): Promise<ReferralCode> {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return {
        id: existing.id,
        userId: existing.user_id,
        code: existing.code,
        discountPercentage: existing.discount_percentage,
        totalReferrals: existing.total_referrals,
        totalEarned: existing.total_earned,
        active: existing.active,
        createdAt: existing.created_at,
      };
    }

    // Generar código único
    const code = `REF${userId.slice(0, 8).toUpperCase()}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const { data, error } = await supabase
      .from('referral_codes')
      .insert({
        user_id: userId,
        code,
        discount_percentage: discountPercentage,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      code: data.code,
      discountPercentage: data.discount_percentage,
      totalReferrals: data.total_referrals,
      totalEarned: data.total_earned,
      active: data.active,
      createdAt: data.created_at,
    };
  }

  /**
   * Obtiene el código referral del usuario
   */
  static async getUserReferralCode(userId: string): Promise<ReferralCode | null> {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      code: data.code,
      discountPercentage: data.discount_percentage,
      totalReferrals: data.total_referrals,
      totalEarned: data.total_earned,
      active: data.active,
      createdAt: data.created_at,
    };
  }

  /**
   * Aplica un código referral a una orden
   */
  static async applyReferralCode(
    referralCode: string,
    orderId: string,
    referredUserId?: string
  ): Promise<{ discount: number; referrerEarned: number }> {
    // Obtener referral code
    const { data: refCodeData, error: refError } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', referralCode)
      .eq('active', true)
      .single();

    if (refError || !refCodeData) {
      throw new Error('Código referral inválido');
    }

    // Obtener datos de la orden
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('total, user_id')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    // Calcular descuento
    const discount = Math.floor(
      (orderData.total * refCodeData.discount_percentage) / 100
    );
    const referrerEarned = Math.floor(discount * 0.5); // El referidor gana el 50% del descuento

    // Registrar uso
    await supabase.from('referral_uses').insert({
      referral_code_id: refCodeData.id,
      referred_user_id: referredUserId || orderData.user_id,
      order_id: orderId,
      discount_applied: discount,
    });

    // Actualizar estadísticas del referral
    await supabase
      .from('referral_codes')
      .update({
        total_referrals: refCodeData.total_referrals + 1,
        total_earned: refCodeData.total_earned + referrerEarned,
      })
      .eq('id', refCodeData.id);

    return { discount, referrerEarned };
  }

  /**
   * Obtiene estadísticas del código referral
   */
  static async getReferralStats(userId: string) {
    const { data: refCode } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!refCode) {
      return null;
    }

    const { data: uses, error: usesError } = await supabase
      .from('referral_uses')
      .select('discount_applied, created_at')
      .eq('referral_code_id', refCode.id)
      .order('created_at', { ascending: false });

    if (usesError) throw usesError;

    return {
      code: refCode.code,
      discountPercentage: refCode.discount_percentage,
      totalReferrals: refCode.total_referrals,
      totalEarned: refCode.total_earned,
      recentUses: uses || [],
    };
  }

  /**
   * Desactiva un código referral
   */
  static async deactivateReferralCode(userId: string): Promise<void> {
    const { error } = await supabase
      .from('referral_codes')
      .update({ active: false })
      .eq('user_id', userId);

    if (error) throw error;
  }
}
