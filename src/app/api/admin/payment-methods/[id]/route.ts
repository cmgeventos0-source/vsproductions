import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient()
  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('payment_methods')
    .update(body)
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
  }

  return NextResponse.json(data[0])
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient()
  const { id } = await params

  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
