import { NextRequest, NextResponse } from 'next/server'

// Rate limit store (en producción usar Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMITS = {
  api: { requests: 100, window: 60 * 1000 }, // 100 requests per minute
  payment: { requests: 10, window: 60 * 1000 }, // 10 payment attempts per minute
  upload: { requests: 5, window: 60 * 1000 }, // 5 uploads per minute
}

export function getRateLimitKey(req: NextRequest, type: string): string {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  return `${type}:${ip}`
}

export function checkRateLimit(
  key: string,
  type: 'api' | 'payment' | 'upload' = 'api'
): { allowed: boolean; remaining: number; resetIn: number } {
  const limit = RATE_LIMITS[type]
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + limit.window })
    return { allowed: true, remaining: limit.requests - 1, resetIn: limit.window }
  }

  if (record.count >= limit.requests) {
    const resetIn = Math.max(0, record.resetTime - now)
    return { allowed: false, remaining: 0, resetIn }
  }

  record.count++
  const remaining = limit.requests - record.count
  const resetIn = Math.max(0, record.resetTime - now)

  return { allowed: true, remaining, resetIn }
}

export function rateLimitMiddleware(type: 'api' | 'payment' | 'upload' = 'api') {
  return (handler: Function) => {
    return async (req: NextRequest, ...args: any[]) => {
      const key = getRateLimitKey(req, type)
      const { allowed, remaining, resetIn } = checkRateLimit(key, type)

      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': RATE_LIMITS[type].requests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(Date.now() + resetIn).toISOString(),
              'Retry-After': Math.ceil(resetIn / 1000).toString(),
            },
          }
        )
      }

      const response = await handler(req, ...args)

      // Agregar headers de rate limit a la respuesta
      response.headers.set('X-RateLimit-Limit', RATE_LIMITS[type].requests.toString())
      response.headers.set('X-RateLimit-Remaining', remaining.toString())
      response.headers.set('X-RateLimit-Reset', new Date(Date.now() + resetIn).toISOString())

      return response
    }
  }
}

// Cleanup de registros antiguos cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)
