import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const orderId = formData.get('orderId') as string

    if (!file || !orderId) {
      return NextResponse.json({ error: 'Missing file or orderId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Convert file to buffer
    const buffer = await file.arrayBuffer()

    // Upload to storage
    const fileName = `${orderId}-${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(`orders/${fileName}`, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('receipts')
      .getPublicUrl(`orders/${fileName}`)

    return NextResponse.json({
      fileUrl: publicData.publicUrl,
      fileId: data.path,
      path: data.path,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
