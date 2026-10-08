import { createClient } from '@supabase/supabase-js';
import { ShoppingCart, CartItem, PromoCode } from '@/types/cart';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
  return createClient(url, key);
}

export class CartService {
  /**
   * Obtiene o crea un carrito para un usuario/sesión
   */
  static async getOrCreateCart(
    userId?: string,
    sessionId?: string
  ): Promise<ShoppingCart> {
    if (!userId && !sessionId) {
      throw new Error('Se requiere userId o sessionId');
    }

    const supabase = getSupabase();
    const query = userId
      ? supabase.from('shopping_carts').select('*').eq('user_id', userId)
      : supabase.from('shopping_carts').select('*').eq('session_id', sessionId);

    const { data, error } = await query.single();

    if (error && error.code === 'PGRST116') {
      // No existe, crear nuevo
      return this.createCart(userId, sessionId);
    }

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      items: data.items || [],
      subtotal: data.subtotal,
      discountAmount: data.discount_amount,
      promoCodeId: data.promo_code_id,
      total: data.total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Crea un nuevo carrito
   */
  static async createCart(
    userId?: string,
    sessionId?: string
  ): Promise<ShoppingCart> {
    const { data, error } = await getSupabase()
      .from('shopping_carts')
      .insert({
        user_id: userId || null,
        session_id: sessionId || null,
        items: [],
        subtotal: 0,
        discount_amount: 0,
        total: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      items: data.items || [],
      subtotal: data.subtotal,
      discountAmount: data.discount_amount,
      total: data.total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Añade un item al carrito
   */
  static async addItem(
    cartId: string,
    item: CartItem
  ): Promise<ShoppingCart> {
    const supabase = getSupabase();
    const { data: cartData, error: fetchError } = await supabase
      .from('shopping_carts')
      .select('items, subtotal')
      .eq('id', cartId)
      .single();

    if (fetchError) throw fetchError;

    const items = cartData.items || [];

    // Verificar si el item ya existe (mismo function, zone, seats)
    const existingIndex = items.findIndex(
      (i: CartItem) =>
        i.functionId === item.functionId &&
        i.zoneId === item.zoneId &&
        JSON.stringify(i.seatIds) === JSON.stringify(item.seatIds)
    );

    if (existingIndex !== -1) {
      items[existingIndex].quantity += item.quantity;
    } else {
      items.push(item);
    }

    const subtotal = this.calculateSubtotal(items);
    const { data, error } = await supabase
      .from('shopping_carts')
      .update({
        items,
        subtotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cartId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      items: data.items || [],
      subtotal: data.subtotal,
      discountAmount: data.discount_amount,
      promoCodeId: data.promo_code_id,
      total: data.total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Actualiza cantidad de un item
   */
  static async updateItemQuantity(
    cartId: string,
    functionId: string,
    zoneId: string,
    quantity: number,
    seatIds?: string[]
  ): Promise<ShoppingCart> {
    const supabase = getSupabase();
    const { data: cartData, error: fetchError } = await supabase
      .from('shopping_carts')
      .select('items')
      .eq('id', cartId)
      .single();

    if (fetchError) throw fetchError;

    const items = cartData.items || [];
    const itemIndex = items.findIndex(
      (i: CartItem) =>
        i.functionId === functionId &&
        i.zoneId === zoneId &&
        JSON.stringify(i.seatIds) === JSON.stringify(seatIds)
    );

    if (itemIndex === -1) {
      throw new Error('Item no encontrado en el carrito');
    }

    if (quantity <= 0) {
      items.splice(itemIndex, 1);
    } else {
      items[itemIndex].quantity = quantity;
    }

    const subtotal = this.calculateSubtotal(items);
    const { data, error } = await supabase
      .from('shopping_carts')
      .update({
        items,
        subtotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cartId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      items: data.items || [],
      subtotal: data.subtotal,
      discountAmount: data.discount_amount,
      promoCodeId: data.promo_code_id,
      total: data.total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Elimina un item del carrito
   */
  static async removeItem(
    cartId: string,
    functionId: string,
    zoneId: string,
    seatIds?: string[]
  ): Promise<ShoppingCart> {
    return this.updateItemQuantity(cartId, functionId, zoneId, 0, seatIds);
  }

  /**
   * Vacía completamente el carrito
   */
  static async clearCart(cartId: string): Promise<ShoppingCart> {
    const { data, error } = await getSupabase()
      .from('shopping_carts')
      .update({
        items: [],
        subtotal: 0,
        discount_amount: 0,
        total: 0,
        promo_code_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cartId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      items: data.items || [],
      subtotal: data.subtotal,
      discountAmount: data.discount_amount,
      promoCodeId: data.promo_code_id,
      total: data.total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Aplica un código promocional al carrito
   */
  static async applyPromoCode(
    cartId: string,
    promoCode: string
  ): Promise<{ success: boolean; discountAmount: number; total: number; finalTotal: number }> {
    const supabase = getSupabase();
    // Obtener datos del carrito
    const { data: cartData, error: cartError } = await supabase
      .from('shopping_carts')
      .select('items, subtotal, promo_code_id')
      .eq('id', cartId)
      .single();

    if (cartError) throw cartError;

    // Verificar código promocional
    const { data: promoData, error: promoError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoCode.toUpperCase())
      .eq('active', true)
      .single();

    if (promoError || !promoData) {
      throw new Error('Código promocional no válido');
    }

    // Verificar fechas
    const now = new Date();
    const validFrom = new Date(promoData.valid_from);
    const validUntil = new Date(promoData.valid_until);

    if (now < validFrom || now > validUntil) {
      throw new Error('Código promocional expirado');
    }

    // Verificar usos máximos
    if (promoData.max_uses && promoData.current_uses >= promoData.max_uses) {
      throw new Error('Código promocional agotado');
    }

    // Verificar compra mínima
    if (promoData.min_purchase && cartData.subtotal < promoData.min_purchase) {
      throw new Error(
        `Compra mínima requerida: ${promoData.min_purchase} COP`
      );
    }

    // Calcular descuento
    let discountAmount = 0;
    if (promoData.discount_type === 'percentage') {
      discountAmount = Math.floor(
        (cartData.subtotal * promoData.discount_value) / 100
      );
    } else {
      discountAmount = Math.min(promoData.discount_value, cartData.subtotal);
    }

    const total = Math.max(cartData.subtotal - discountAmount, 0);

    // Actualizar carrito
    const { error: updateError } = await supabase
      .from('shopping_carts')
      .update({
        promo_code_id: promoData.id,
        discount_amount: discountAmount,
        total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cartId);

    if (updateError) throw updateError;

    return { success: true, discountAmount, total, finalTotal: total };
  }

  /**
   * Remueve código promocional del carrito
   */
  static async removePromoCode(cartId: string): Promise<ShoppingCart> {
    const supabase = getSupabase();
    const { data: cartData, error: fetchError } = await supabase
      .from('shopping_carts')
      .select('subtotal')
      .eq('id', cartId)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('shopping_carts')
      .update({
        promo_code_id: null,
        discount_amount: 0,
        total: cartData.subtotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cartId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      items: data.items || [],
      subtotal: data.subtotal,
      discountAmount: data.discount_amount,
      promoCodeId: data.promo_code_id,
      total: data.total,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Marca carrito como abandonado
   */
  static async markCartAbandoned(cartId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('shopping_carts')
      .update({
        abandoned_at: new Date().toISOString(),
      })
      .eq('id', cartId);

    if (error) throw error;
  }

  /**
   * Obtiene carritos abandonados para enviar recordatorios
   */
  static async getAbandonedCarts(hoursAgo: number = 1): Promise<ShoppingCart[]> {
    const timeThreshold = new Date(
      Date.now() - hoursAgo * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await getSupabase()
      .from('shopping_carts')
      .select('id, user_id, session_id, items, created_at, updated_at')
      .eq('abandoned_at', null)
      .gte('updated_at', timeThreshold)
      .neq('items', '[]')
      .order('updated_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((cart: any) => ({
      id: cart.id,
      userId: cart.user_id,
      sessionId: cart.session_id,
      items: cart.items || [],
      subtotal: cart.subtotal,
      discountAmount: cart.discount_amount,
      promoCodeId: cart.promo_code_id,
      total: cart.total,
      createdAt: cart.created_at,
      updatedAt: cart.updated_at,
    }));
  }

  /**
   * Calcula el subtotal basado en items
   */
  private static calculateSubtotal(items: CartItem[]): number {
    return items.reduce((sum: number, item: CartItem) => {
      return sum + item.price * item.quantity;
    }, 0);
  }
}
