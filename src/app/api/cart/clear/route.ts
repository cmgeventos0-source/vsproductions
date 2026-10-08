import { NextRequest, NextResponse } from 'next/server';
import { CartService } from '@/lib/services/cartService';
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
    const { cartId } = body;

    if (!cartId) {
      return NextResponse.json(
        { error: 'cartId es requerido' },
        { status: 400 }
      );
    }

    const cart = await CartService.getOrCreateCart(user?.id);
    if (cart.id !== cartId) {
      return NextResponse.json(
        { error: 'Carrito no autorizado' },
        { status: 403 }
      );
    }

    const clearedCart = await CartService.clearCart(cartId);

    return NextResponse.json(clearedCart);
  } catch (error) {
    console.error('Error clearing cart:', error);
    return NextResponse.json(
      { error: 'Error al vaciar carrito' },
      { status: 500 }
    );
  }
}
