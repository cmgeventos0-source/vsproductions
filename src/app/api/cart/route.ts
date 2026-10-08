import { NextRequest, NextResponse } from 'next/server';
import { CartService } from '@/lib/services/cartService';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ... imports ...

async function getCartHandler(request: NextRequest) {
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

    const sessionId = request.headers.get('x-session-id');

    if (!user && !sessionId) {
      return NextResponse.json(
        { error: 'Se requiere autenticación o sessionId' },
        { status: 401 }
      );
    }

    const cart = await CartService.getOrCreateCart(user?.id, sessionId || undefined);

    return NextResponse.json(cart);
  } catch (error) {
    console.error('Error getting cart:', error);
    return NextResponse.json(
      { error: 'Error al obtener carrito' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return getCartHandler(request);
}

export async function GET(request: NextRequest) {
  return getCartHandler(request);
}
