import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-guards'
import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { rateLimitMiddleware } from '@/lib/rateLimit'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL

async function handler(req: NextRequest) {
  try {
    const user = await requireAdmin()

    const { verificationId, status, orderId, adminNotes } = await req.json()

    if (!verificationId || !status) {
      return NextResponse.json(
        { error: 'Missing verificationId or status' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get verification details
    const { data: verification, error: verError } = await supabase
      .from('payment_verifications')
      .select('*')
      .eq('id', verificationId)
      .single()

    if (verError || !verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      )
    }

    const orderId_final = orderId || verification.extracted_data?.orderId

    // Update verification status
    await supabase
      .from('payment_verifications')
      .update({
        status,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
      })
      .eq('id', verificationId)

    // Update order status based on verification
    if (status === 'verified' && orderId_final) {
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId_final)

      // Update seats and zones
      const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId_final)
      if (items) {
        for (const item of items) {
          if (item.zone_id) {
            const { data: zone } = await supabase
              .from("zones")
              .select("sold_count")
              .eq("id", item.zone_id)
              .single()
            if (zone) {
              await supabase
                .from("zones")
                .update({ sold_count: (zone.sold_count || 0) + item.quantity })
                .eq("id", item.zone_id)
            }
          }
          if (item.seat_id) {
            await supabase
              .from("seats")
              .update({ status: "sold", hold_expires_at: null })
              .eq("id", item.seat_id)
          }
        }
      }

      // Generate tickets
      const { generateTicketsForOrder } = await import('@/app/actions')
      await generateTicketsForOrder(orderId_final)

      // Get order details for email
      const { data: order } = await supabase
        .from('orders')
        .select('email, customer_name, total, id')
        .eq('id', orderId_final)
        .single()

      // Send confirmation email
      if (order?.email) {
        await sendPaymentConfirmationEmail(
          order.email,
          order.customer_name,
          order.total,
          order.id
        )
      }

      // Log audit
      await logAudit(req, {
        action: 'approve_payment',
        resourceType: 'payment',
        resourceId: verificationId,
        changes: {
          before: { status: verification.status },
          after: { status: 'verified' },
        },
        notes: adminNotes,
      }, user.id)
    } else if (status === 'rejected' && orderId_final) {
      await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId_final)

      // Get order details for email
      const { data: order } = await supabase
        .from('orders')
        .select('email, customer_name')
        .eq('id', orderId_final)
        .single()

      // Send rejection email
      if (order?.email) {
        await sendPaymentRejectionEmail(
          order.email,
          order.customer_name,
          adminNotes
        )
      }

      // Log audit
      await logAudit(req, {
        action: 'reject_payment',
        resourceType: 'payment',
        resourceId: verificationId,
        changes: {
          before: { status: verification.status },
          after: { status: 'rejected' },
        },
        notes: adminNotes,
      }, user.id)
    }

    return NextResponse.json({
      success: true,
      message: `Payment verification ${status}`,
    })
  } catch (error) {
    console.error('Approval error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    )
  }
}

export const POST = rateLimitMiddleware('payment')(handler)

import { EmailService } from '@/lib/services/emailService'

async function sendPaymentConfirmationEmail(
  email: string,
  name: string,
  amount: number,
  orderId: string
) {
  await EmailService.sendEmail({
    to: email,
    subject: '✅ Pago Confirmado - Boletas Listas',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090f; color: #ffffff; padding: 24px; border-radius: 12px;">
        <h2 style="color: #a855f7;">¡Hola ${name}!</h2>
        <p>Tu pago de <strong>$${amount.toLocaleString('es-CO')}</strong> ha sido verificado exitosamente.</p>
        <p>Tu orden <strong>${orderId}</strong> está lista para descargar tus boletas.</p>
        <a href="${appUrl}/mis-boletas"
           style="display: inline-block; padding: 12px 24px; background-color: #9333ea; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">
          Ver mis boletas
        </a>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
          Gracias por tu compra en Boletería Colombia.
        </p>
      </div>
    `,
  })
}

async function sendPaymentRejectionEmail(
  email: string,
  name: string,
  notes?: string
) {
  await EmailService.sendEmail({
    to: email,
    subject: '❌ Pago Rechazado - Acción Requerida',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090f; color: #ffffff; padding: 24px; border-radius: 12px;">
        <h2 style="color: #ef4444;">Hola ${name},</h2>
        <p>Lamentablemente, tu pago no pudo ser verificado.</p>
        ${notes ? `<p><strong>Motivo:</strong> ${notes}</p>` : ''}
        <p>Por favor, intenta nuevamente o contacta con soporte.</p>
        <a href="${appUrl}/payment-status"
           style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">
          Reintentar pago
        </a>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
          Si necesitas ayuda, contacta a soporte@boleteria.com
        </p>
      </div>
    `,
  })
}
