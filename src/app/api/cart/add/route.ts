import { NextRequest, NextResponse } from 'next/server';
import { CartService } from '@/lib/services/cartService';
import { CartItem } from '@/types/cart';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const { cartId, item } = body;

    if (!cartId || !item) {
      return NextResponse.json(
        { error: 'cartId e item son requeridos' },
        { status: 400 }
      );
    }

    // Validar que el usuario sea dueño del carrito o tenga sessionId válida
    const cart = await CartService.getOrCreateCart(user?.id);
    if (cart.id !== cartId) {
      return NextResponse.json(
        { error: 'Carrito no autorizado' },
        { status: 403 }
      );
    }

    const updatedCart = await CartService.addItem(cartId, item as CartItem);

    return NextResponse.json(updatedCart);
  } catch (error) {
    console.error('Error adding item to cart:', error);
    return NextResponse.json(
      { error: 'Error al añadir item al carrito' },
      { status: 500 }
    );
  }
}
