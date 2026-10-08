'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/format'
import { Check, X, Clock, AlertCircle, Loader2 } from 'lucide-react'

type Verification = {
  id: string
  payment_method_id: string
  extracted_data: any
  status: 'processing' | 'pending_review' | 'verified' | 'rejected'
  confidence_score: number
  created_at: string
}

export function PaymentVerificationQueue() {
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending')
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadVerifications()
    const interval = setInterval(loadVerifications, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  async function loadVerifications() {
    try {
      const supabase = createClient()
      const query = supabase
        .from('payment_verifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query.eq('status', filter)
      }

      const { data, error } = await query

      if (!error && data) {
        setVerifications(data)
      }
    } catch (error) {
      console.error('Error loading verifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(verificationId: string) {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId,
          status: 'verified',
          adminNotes,
        }),
      })

      if (response.ok) {
        setSelectedVerification(null)
        setAdminNotes('')
        loadVerifications()
      } else {
        alert('Error al aprobar el pago')
      }
    } catch (error) {
      console.error('Error approving payment:', error)
      alert('Error al procesar')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleReject(verificationId: string) {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId,
          status: 'rejected',
          adminNotes,
        }),
      })

      if (response.ok) {
        setSelectedVerification(null)
        setAdminNotes('')
        loadVerifications()
      } else {
        alert('Error al rechazar el pago')
      }
    } catch (error) {
      console.error('Error rejecting payment:', error)
      alert('Error al procesar')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
            <Check size={14} /> Verificado
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
            <X size={14} /> Rechazado
          </span>
        )
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-semibold">
            <Clock size={14} /> Revisión
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-semibold">
            <Loader2 size={14} className="animate-spin" /> Procesando
          </span>
        )
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Cargando cola de verificación...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Cola de Verificación de Pagos</h2>
        <div className="flex gap-2">
          {(['all', 'pending', 'verified', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f)
                loadVerifications()
              }}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'verified' ? 'Verificados' : 'Rechazados'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {verifications.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {filter === 'pending' ? 'No hay pagos pendientes de revisar' : 'No hay pagos en esta categoría'}
          </div>
        ) : (
          verifications.map((verification) => (
            <div
              key={verification.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(verification.status)}
                    <span className="text-xs text-gray-500">
                      {new Date(verification.created_at).toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                    {verification.extracted_data?.amount && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Monto</p>
                        <p className="text-green-400 font-bold">{formatCOP(verification.extracted_data.amount)}</p>
                      </div>
                    )}
                    {verification.extracted_data?.orderId && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Orden</p>
                        <p className="text-white font-mono text-xs">
                          {verification.extracted_data.orderId.substring(0, 8).toUpperCase()}
                        </p>
                      </div>
                    )}
                    {verification.extracted_data?.reference && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Referencia</p>
                        <p className="text-white">{verification.extracted_data.reference}</p>
                      </div>
                    )}
                    {verification.extracted_data?.phone && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Teléfono</p>
                        <p className="text-white">{verification.extracted_data.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {verification.status === 'pending_review' && (
                  <button
                    onClick={() => setSelectedVerification(verification)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    Revisar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Revisión */}
      {selectedVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Revisar Pago</h2>

            <div className="space-y-3 mb-4">
              {selectedVerification.extracted_data?.amount && (
                <div>
                  <p className="text-gray-400 text-xs mb-1">Monto</p>
                  <p className="text-green-400 font-bold text-lg">
                    {formatCOP(selectedVerification.extracted_data.amount)}
                  </p>
                </div>
              )}
              {selectedVerification.extracted_data?.reference && (
                <div>
                  <p className="text-gray-400 text-xs mb-1">Referencia</p>
                  <p className="text-white">{selectedVerification.extracted_data.reference}</p>
                </div>
              )}
              {selectedVerification.extracted_data?.phone && (
                <div>
                  <p className="text-gray-400 text-xs mb-1">Teléfono</p>
                  <p className="text-white">{selectedVerification.extracted_data.phone}</p>
                </div>
              )}
              {selectedVerification.extracted_data?.type && (
                <div>
                  <p className="text-gray-400 text-xs mb-1">Tipo</p>
                  <p className="text-white capitalize">{selectedVerification.extracted_data.type}</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-300 mb-2">Notas (Opcional)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Motivo de aprobación/rechazo..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedVerification(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReject(selectedVerification.id)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Rechazar'}
              </button>
              <button
                onClick={() => handleApprove(selectedVerification.id)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
