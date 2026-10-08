import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  const body = await req.json()
  const { id, name, icon, enabled, requires_verification, verification_config, display_order } = body

  if (!id || !name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .insert({
      id,
      name,
      icon,
      enabled: enabled ?? true,
      requires_verification: requires_verification ?? true,
      verification_config: verification_config || {},
      display_order: display_order ?? 0
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data[0])
}
