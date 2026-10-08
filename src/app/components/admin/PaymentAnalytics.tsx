'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/format'
import { BarChart3, TrendingUp, CheckCircle2, Clock, AlertCircle, DollarSign } from 'lucide-react'

type PaymentStats = {
  totalRevenue: number
  totalOrders: number
  pendingOrders: number
  verifiedOrders: number
  failedOrders: number
  byMethod: Record<string, { count: number; amount: number }>
  dailyRevenue: Array<{ date: string; amount: number; orders: number }>
}

export function PaymentAnalytics() {
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => {
    loadStats()
  }, [dateRange])

  async function loadStats() {
    try {
      const supabase = createClient()

      // Calcular fechas
      const now = new Date()
      let startDate = new Date()

      if (dateRange === 'week') {
        startDate.setDate(now.getDate() - 7)
      } else if (dateRange === 'month') {
        startDate.setMonth(now.getMonth() - 1)
      } else if (dateRange === 'year') {
        startDate.setFullYear(now.getFullYear() - 1)
      }

      // Obtener órdenes en el rango de fecha
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, status, payment_method, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString())
        .order('created_at', { ascending: false })

      if (error || !orders) {
        console.error('Error loading stats:', error)
        return
      }

      // Procesar estadísticas
      const stats: PaymentStats = {
        totalRevenue: 0,
        totalOrders: orders.length,
        pendingOrders: 0,
        verifiedOrders: 0,
        failedOrders: 0,
        byMethod: {},
        dailyRevenue: [],
      }

      const dailyMap = new Map<string, { amount: number; orders: number }>()

      orders.forEach((order: any) => {
        // Contar por estado
        if (order.status === 'paid') {
          stats.verifiedOrders++
          stats.totalRevenue += order.total || 0
        } else if (order.status === 'pending') {
          stats.pendingOrders++
        } else if (order.status === 'failed') {
          stats.failedOrders++
        }

        // Contar por método de pago
        const method = order.payment_method || 'unknown'
        if (!stats.byMethod[method]) {
          stats.byMethod[method] = { count: 0, amount: 0 }
        }
        stats.byMethod[method].count++
        if (order.status === 'paid') {
          stats.byMethod[method].amount += order.total || 0
        }

        // Agrupar por día
        const date = new Date(order.created_at).toLocaleDateString('es-CO')
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { amount: 0, orders: 0 })
        }
        const day = dailyMap.get(date)!
        day.orders++
        if (order.status === 'paid') {
          day.amount += order.total || 0
        }
      })

      // Convertir daily map a array
      stats.dailyRevenue = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }))

      setStats(stats)
    } catch (error) {
      console.error('Error loading payment analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return <div className="text-center py-8 text-gray-400">Cargando analytics...</div>
  }

  const successRate = stats.totalOrders > 0 ? Math.round((stats.verifiedOrders / stats.totalOrders) * 100) : 0
  const averageOrderValue = stats.verifiedOrders > 0 ? stats.totalRevenue / stats.verifiedOrders : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Reportes de Pagos</h2>
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                dateRange === range
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {range === 'week' ? 'Esta Semana' : range === 'month' ? 'Este Mes' : 'Este Año'}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Ingresos Totales</p>
              <p className="text-2xl font-bold text-green-400">{formatCOP(stats.totalRevenue)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400/30" />
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Órdenes Pagadas</p>
              <p className="text-2xl font-bold text-blue-400">{stats.verifiedOrders}</p>
              <p className="text-xs text-gray-500 mt-1">{successRate}% de éxito</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-blue-400/30" />
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.pendingOrders}</p>
              <p className="text-xs text-gray-500 mt-1">Por verificar</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400/30" />
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Valor Promedio</p>
              <p className="text-2xl font-bold text-purple-400">{formatCOP(averageOrderValue)}</p>
              <p className="text-xs text-gray-500 mt-1">Por orden</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-400/30" />
          </div>
        </div>
      </div>

      {/* Ingresos por Método de Pago */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Desglose por Método de Pago
        </h3>

        <div className="space-y-3">
          {Object.entries(stats.byMethod)
            .sort(([, a], [, b]) => b.amount - a.amount)
            .map(([method, data]) => {
              const percentage = stats.totalRevenue > 0 ? (data.amount / stats.totalRevenue) * 100 : 0
              return (
                <div key={method} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 capitalize">{method}</span>
                    <div className="text-right">
                      <p className="text-white font-semibold">{formatCOP(data.amount)}</p>
                      <p className="text-gray-500 text-xs">{data.count} órdenes</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Tabla de Ingresos Diarios */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Ingresos Diarios</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr className="text-gray-400">
                <th className="text-left py-2 px-3">Fecha</th>
                <th className="text-right py-2 px-3">Órdenes</th>
                <th className="text-right py-2 px-3">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {stats.dailyRevenue.slice(0, 30).map((day) => (
                <tr key={day.date} className="hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 px-3 text-gray-300">{day.date}</td>
                  <td className="py-2 px-3 text-right text-white">{day.orders}</td>
                  <td className="py-2 px-3 text-right text-green-400 font-semibold">
                    {formatCOP(day.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Errores */}
      {stats.failedOrders > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">{stats.failedOrders} Órdenes Fallidas</p>
            <p className="text-red-400/70 text-sm">Revisa manualmente estos pagos</p>
          </div>
        </div>
      )}
    </div>
  )
}
