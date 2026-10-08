// src/app/api/payments/webhook/route.ts
/**
 * Webhook de WOMPI para procesar pagos confirmados
 * Aquí se valida el pago y se envían notificaciones por email + WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notificationService } from '@/lib/services/notificationService';
import crypto from 'crypto';

import { verifyWebhookSignature } from '@/lib/wompi';

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.text();
    const event = JSON.parse(body || '{}');

    // 1️⃣ Verificar autenticidad del webhook de Wompi
    const isValid = await verifyWebhookSignature(event, body);
    if (!isValid) {
      console.error('❌ Webhook signature inválida');
      return NextResponse.json(
        { error: 'Firma inválida' },
        { status: 401 }
      );
    }

    console.log('📥 Webhook WOMPI recibido:', event.event);

    // 2️⃣ Solo procesar eventos de transacción completada
    if (event.event !== 'transaction.updated') {
      return NextResponse.json({ ok: true });
    }

    const transaction = event.data.transaction;
    const { id: transactionId, status, amount_in_cents, reference } = transaction;
    const amount = amount_in_cents / 100;

    // 3️⃣ Procesar solo transacciones aprobadas
    if (status !== 'APPROVED') {
      console.log(`⚠️ Transacción ${transactionId} con estado: ${status}`);

      // Si la transacción fue rechazada, notificar al usuario
      if (status === 'DECLINED' || status === 'ERROR') {
        await handlePaymentFailed(reference, status);
      }

      return NextResponse.json({ ok: true });
    }

    // 4️⃣ Obtener datos de la orden desde Supabase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, user_id, total, status, customer_name, email, customer_phone,
        order_items(id, zone_id, seat_id, quantity)
      `)
      .or(`payment_ref.eq.${reference},id.eq.${reference}`)
      .single();

    if (orderError || !order) {
      console.error('❌ Orden no encontrada:', reference);
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const orderData = order as any;

    // 5️⃣ Validar que el monto coincida
    if (Math.abs(orderData.total - amount) > 0.01) {
      console.error('❌ Monto no coincide:', { esperado: orderData.total, recibido: amount });
      return NextResponse.json(
        { error: 'Monto no coincide' },
        { status: 400 }
      );
    }

    // 6️⃣ Actualizar orden en BD
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'paid',
        transaction_id: transactionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderData.id);

    if (updateError) {
      console.error('❌ Error actualizando orden:', updateError);
      return NextResponse.json(
        { error: 'Error actualizando orden' },
        { status: 500 }
      );
    }

    // Update seats & zones, generate tickets
    const items = orderData.order_items || [];
    for (const item of items) {
      if (item.zone_id) {
        const { data: zone } = await supabase
          .from("zones")
          .select("sold_count")
          .eq("id", item.zone_id)
          .single();
        if (zone) {
          await supabase
            .from("zones")
            .update({ sold_count: (zone.sold_count || 0) + item.quantity })
            .eq("id", item.zone_id);
        }
      }
      if (item.seat_id) {
        await supabase
          .from("seats")
          .update({ status: "sold", hold_expires_at: null })
          .eq("id", item.seat_id);
      }
    }

    const { generateTicketsForOrder } = await import('@/app/actions');
    await generateTicketsForOrder(orderData.id);

    // 7️⃣ Marcar carrito como completado
    if (orderData.shopping_cart?.id) {
      await supabase
        .from('shopping_carts')
        .update({
          abandoned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderData.shopping_cart.id);
    }

    // 8️⃣ Crear entrada en audit log
    await supabase.from('audit_logs').insert({
      user_id: orderData.user_id,
      action: 'payment_confirmed',
      resource_type: 'order',
      resource_id: orderData.id,
      details: { transaction_id: transactionId, amount },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // 9️⃣ Extraer datos para notificación
    const cartItems = orderData.shopping_cart?.items || [];
    const firstItem = cartItems[0] || {};

    const notificationContext = {
      orderId: orderData.id,
      transactionId,
      customerName: orderData.customer_name || orderData.email?.split('@')[0] || 'Cliente',
      email: orderData.email,
      phone: orderData.customer_phone,
      amount,
      eventName: firstItem.eventName || 'Tu evento',
      eventDate: firstItem.functionDateTime || new Date().toISOString(),
      zone: firstItem.zoneName || 'General',
      quantity: cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0),
    };

    // 🔟 ENVIAR NOTIFICACIONES (email + WhatsApp)
    console.log('📤 Enviando notificaciones...');

    const results = await notificationService.sendMultiple({
      to: orderData.email!,
      type: 'payment_confirmed',
      context: notificationContext,
    });

    console.log('✅ Email enviado:', results.email?.success);
    console.log('✅ WhatsApp enviado:', results.whatsapp?.success);

    // 1️⃣1️⃣ Registrar intentos de notificación en BD
    await supabase.from('notification_logs').insert({
      order_id: orderData.id,
      type: 'payment_confirmed',
      email_sent: results.email?.success,
      email_error: results.email?.error,
      whatsapp_sent: results.whatsapp?.success,
      whatsapp_error: results.whatsapp?.error,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      order_id: orderData.id,
      notifications: results,
    });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    return NextResponse.json(
      { error: 'Error procesando webhook' },
      { status: 500 }
    );
  }
}

/**
 * Maneja pagos rechazados / fallidos
 */
async function handlePaymentFailed(reference: string, status: string) {
  try {
    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from('orders')
      .select('id, user_id, customer_name, email, customer_phone')
      .or(`payment_ref.eq.${reference},id.eq.${reference}`)
      .single();

    if (!order) return;

    const orderData = order as any;

    // Enviar notificación de pago fallido
    await notificationService.sendMultiple({
      to: orderData.email!,
      type: 'payment_failed',
      context: {
        orderId: orderData.id,
        customerName: orderData.customer_name || 'Usuario',
        phone: orderData.customer_phone,
        reason: status === 'DECLINED' ? 'Transacción rechazada por el banco' : 'Error procesando pago',
      },
    });

    // Actualizar estado de la orden
    await supabase
      .from('orders')
      .update({
        status: 'failed',
        payment_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderData.id);
  } catch (error) {
    console.error('Error manejando pago fallido:', error);
  }
}
