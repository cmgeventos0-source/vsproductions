import { NextRequest, NextResponse } from 'next/server';
import { CartService } from '@/lib/services/cartService';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PUT(request: NextRequest) {
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
    const { cartId, functionId, zoneId, quantity, seatIds } = body;

    if (!cartId || !functionId || !zoneId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: cartId, functionId, zoneId, quantity' },
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

    const updatedCart = await CartService.updateItemQuantity(
      cartId,
      functionId,
      zoneId,
      quantity,
      seatIds
    );

    return NextResponse.json(updatedCart);
  } catch (error) {
    console.error('Error updating item quantity:', error);
    return NextResponse.json(
      { error: 'Error al actualizar cantidad' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { cartId, functionId, zoneId, seatIds } = body;

    if (!cartId || !functionId || !zoneId) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: cartId, functionId, zoneId' },
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

    const updatedCart = await CartService.removeItem(
      cartId,
      functionId,
      zoneId,
      seatIds
    );

    return NextResponse.json(updatedCart);
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return NextResponse.json(
      { error: 'Error al eliminar item' },
      { status: 500 }
    );
  }
}
