import { NextResponse } from 'next/server';
import { getAppConfig } from '@/app/actions';
import { createClient } from '@/lib/supabase/server';
import { generateIntegritySignature } from '@/lib/wompi';

export async function POST(request: Request) {
  try {
    const { cartId, orderId } = await request.json();
    if (!cartId && !orderId) {
      return NextResponse.json({ error: 'Falta cartId o orderId' }, { status: 400 });
    }

    const publicKey = process.env.WOMPI_PUBLIC_KEY || process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;

    // Obtener credenciales de fallback si no están en ENV
    const config = await getAppConfig('wompi_config');
    const finalPublicKey = publicKey || config?.publicKey;
    const finalIntegritySecret = integritySecret || config?.integritySecret || '';

    if (!finalPublicKey) {
      return NextResponse.json({ error: 'Configuración de llave pública Wompi no encontrada' }, { status: 500 });
    }

    const supabase = await createClient();
    let totalInCents = 0;
    let reference = '';

    if (orderId) {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, total, payment_ref')
        .eq('id', orderId)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
      }

      totalInCents = Math.round(order.total * 100);
      reference = order.payment_ref || order.id;
    } else {
      const { data: cart, error: cartError } = await supabase
        .from('shopping_carts')
        .select(`
          id,
          items:shopping_cart_items(
            quantity,
            zone:zones(price)
          )
        `)
        .eq('id', cartId)
        .single();

      if (cartError || !cart) {
        return NextResponse.json({ error: 'Carrito no encontrado' }, { status: 404 });
      }

      const total = cart.items.reduce((sum: number, item: any) => {
        return sum + (item.quantity * item.zone.price);
      }, 0);

      totalInCents = Math.round(total * 100);
      reference = `REF-CART-${cartId.substring(0, 8)}-${Date.now()}`;
    }

    const signature = await generateIntegritySignature(
      reference,
      totalInCents,
      'COP',
      finalIntegritySecret
    );

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://boleteria.co';
    const redirectUrl = `${origin}/payment-status?ref=${encodeURIComponent(reference)}`;

    const checkoutUrl = new URL('https://checkout.wompi.co/p/');
    checkoutUrl.searchParams.set('public-key', finalPublicKey);
    checkoutUrl.searchParams.set('currency', 'COP');
    checkoutUrl.searchParams.set('amount-in-cents', totalInCents.toString());
    checkoutUrl.searchParams.set('reference', reference);
    checkoutUrl.searchParams.set('signature:integrity', signature);
    checkoutUrl.searchParams.set('redirect-url', redirectUrl);

    return NextResponse.json({ url: checkoutUrl.toString(), reference });
  } catch (error: any) {
    console.error('Error en pago Wompi:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
