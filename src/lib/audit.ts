import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

type AuditAction =
  | 'approve_payment'
  | 'reject_payment'
  | 'create_method'
  | 'update_method'
  | 'delete_method'
  | 'view_analytics'

interface AuditLogData {
  action: AuditAction
  resourceType: 'payment' | 'method' | 'order' | 'analytics'
  resourceId: string
  changes?: {
    before?: Record<string, any>
    after?: Record<string, any>
  }
  notes?: string
}

export async function logAudit(req: NextRequest, data: AuditLogData, userId: string) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    await supabase.from('audit_logs').insert({
      admin_id: userId,
      action: data.action,
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      changes: data.changes || null,
      notes: data.notes || null,
      ip_address: ip,
      user_agent: userAgent,
    })
  } catch (error) {
    console.error('Error logging audit:', error)
    // No lanzar error para no afectar la operación principal
  }
}

export async function getAuditLogs(
  userId: string,
  options?: {
    action?: AuditAction
    resourceType?: string
    resourceId?: string
    limit?: number
    offset?: number
  }
) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.action) {
      query = query.eq('action', options.action)
    }

    if (options?.resourceType) {
      query = query.eq('resource_type', options.resourceType)
    }

    if (options?.resourceId) {
      query = query.eq('resource_id', options.resourceId)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1)
    }

    const { data, error } = await query

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return []
  }
}
