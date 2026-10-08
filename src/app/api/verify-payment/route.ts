import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, paymentMethod, amount, reference, phone } = body
    const fileUrl = body.fileUrl || body.receiptUrl

    if (!orderId || !paymentMethod || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get payment method configuration
    const { data: method, error: methodError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', paymentMethod)
      .single()

    if (methodError || !method) {
      return NextResponse.json(
        { error: 'Payment method not configured' },
        { status: 400 }
      )
    }

    // If method doesn't require verification, mark order as paid
    if (!method.requires_verification) {
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_method: paymentMethod,
          receipt_url: fileUrl,
        })
        .eq('id', orderId)

      return NextResponse.json({
        success: true,
        status: 'verified',
        message: 'Pago verificado automáticamente',
      })
    }

    // For methods requiring verification, create verification record
    const { data: verification, error: insertError } = await supabase
      .from('payment_verifications')
      .insert({
        payment_method_id: paymentMethod,
        extracted_data: {
          amount,
          reference,
          phone,
          orderId,
        },
        status: 'pending_review',
      })
      .select()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // Update order to pending
    await supabase
      .from('orders')
      .update({
        status: 'pending',
        payment_method: paymentMethod,
        receipt_url: fileUrl,
      })
      .eq('id', orderId)

    return NextResponse.json({
      success: true,
      status: 'pending_review',
      verificationId: verification[0].id,
      message: 'Pago en revisión manual. Te notificaremos cuando sea verificado',
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    )
  }
}
