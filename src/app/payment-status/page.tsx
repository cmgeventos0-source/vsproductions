'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/format'
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { ReceiptUpload } from '../components/ReceiptUpload'

type Order = {
  id: string
  customer_name: string
  total: number
  status: 'pending' | 'paid' | 'failed'
  payment_method: string
  created_at: string
  receipt_url?: string
}

export default function PaymentStatusPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  useEffect(() => {
    loadOrders()
    const interval = setInterval(loadOrders, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  async function loadOrders() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setOrders(data as Order[])
      }
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 border-green-500/30 text-green-400'
      case 'failed':
        return 'bg-red-500/10 border-red-500/30 text-red-400'
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pagado'
      case 'failed':
        return 'Falló'
      case 'pending':
        return 'Pendiente'
      default:
        return 'Desconocido'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="w-5 h-5" />
      case 'failed':
        return <AlertCircle className="w-5 h-5" />
      case 'pending':
        return <Clock className="w-5 h-5" />
      default:
        return <Loader2 className="w-5 h-5 animate-spin" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
          <p className="text-gray-400">Cargando tus órdenes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Estado de Pagos</h1>
          <p className="text-gray-400">Consulta el estado de tus órdenes y comprobantes</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No tienes órdenes registradas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 hover:bg-gray-800/70 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                      </div>
                      <div>
                        <p className="font-bold text-white">
                          Orden {order.id.substring(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleString('es-CO')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Monto</p>
                        <p className="text-green-400 font-bold">{formatCOP(order.total)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Estado</p>
                        <p className={`font-bold ${
                          order.status === 'paid' ? 'text-green-400' :
                          order.status === 'failed' ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>
                          {getStatusLabel(order.status)}
                        </p>
                      </div>
                      {order.payment_method && (
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Método</p>
                          <p className="text-gray-300 font-medium">{order.payment_method}</p>
                        </div>
                      )}
                      {order.receipt_url && (
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Comprobante</p>
                          <a
                            href={order.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 font-medium text-xs"
                          >
                            Ver archivo
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedOrder(order)
                          setShowUploadModal(true)
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        Subir Comprobante
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedOrder(order)
                        setShowUploadModal(true)
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      Detalles
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de subida */}
      {showUploadModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {selectedOrder.status === 'pending' ? 'Subir Comprobante' : 'Detalles de Orden'}
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {selectedOrder.status === 'pending' ? (
              <ReceiptUpload
                orderId={selectedOrder.id}
                paymentMethod={selectedOrder.payment_method || 'transferencia'}
                amount={selectedOrder.total}
                onSuccess={() => {
                  setShowUploadModal(false)
                  loadOrders()
                }}
                onError={(error) => console.error(error)}
              />
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Orden</p>
                  <p className="text-white font-bold">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Cliente</p>
                  <p className="text-white">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Monto</p>
                  <p className="text-green-400 font-bold">{formatCOP(selectedOrder.total)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Estado</p>
                  <p className={`font-bold ${
                    selectedOrder.status === 'paid' ? 'text-green-400' :
                    selectedOrder.status === 'failed' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {getStatusLabel(selectedOrder.status)}
                  </p>
                </div>
                {selectedOrder.receipt_url && (
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Comprobante</p>
                    <a
                      href={selectedOrder.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 font-bold text-sm"
                    >
                      Descargar comprobante
                    </a>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowUploadModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
