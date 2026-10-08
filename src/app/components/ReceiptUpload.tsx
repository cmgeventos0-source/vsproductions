'use client'

import { useState } from 'react'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

type ReceiptUploadProps = {
  orderId: string
  paymentMethod: string
  amount: number
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function ReceiptUpload({ orderId, paymentMethod, amount, onSuccess, onError }: ReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setStatus('error')
        setMessage('El archivo es demasiado grande (máximo 10MB)')
        onError?.('Archivo demasiado grande')
        return
      }
      setFile(selectedFile)
      setStatus('idle')
      setMessage('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setStatus('error')
      setMessage('Por favor selecciona un comprobante')
      return
    }

    setLoading(true)
    setStatus('uploading')

    try {
      // 1. Upload file to Supabase storage
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'receipts')
      formData.append('orderId', orderId)

      const uploadRes = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const error = await uploadRes.json()
        throw new Error(error.message || 'Error al subir comprobante')
      }

      const { fileUrl, fileId } = await uploadRes.json()

      // 2. Verify payment via Edge Function
      const verifyRes = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentMethod,
          amount,
          reference,
          phone,
          receiptUrl: fileUrl,
          fileId,
        }),
      })

      if (!verifyRes.ok) {
        const error = await verifyRes.json()
        throw new Error(error.message || 'Error al verificar pago')
      }

      const result = await verifyRes.json()

      setStatus('success')
      setMessage(result.message || 'Comprobante enviado exitosamente')
      setFile(null)
      setReference('')
      setPhone('')

      onSuccess?.()
    } catch (error) {
      setStatus('error')
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      setMessage(errorMsg)
      onError?.(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed border-white/20 p-6 text-center hover:border-white/40 transition-colors">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <label className="block">
              <div className="flex flex-col items-center gap-2 cursor-pointer">
                <Upload className="w-8 h-8 text-purple-400" />
                <span className="text-sm font-medium text-white">Subir comprobante</span>
                <span className="text-xs text-gray-400">PNG, JPG o PDF (máx. 10MB)</span>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
              />
            </label>

            {file && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white flex-1 truncate">{file.name}</span>
              </div>
            )}
          </div>

          {/* Datos del pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Referencia (Nequi/Transf.)</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ej: 123456"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Teléfono (Nequi)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 3001234567"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading}
              />
            </div>
          </div>

          {/* Monto */}
          <div className="text-center pt-2">
            <span className="text-xs text-gray-400">Monto:</span>
            <p className="text-lg font-bold text-green-400">
              ${amount.toLocaleString('es-CO')}
            </p>
          </div>

          {/* Botón enviar */}
          <button
            type="submit"
            disabled={!file || loading}
            className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
              loading
                ? 'bg-purple-500/50 text-white cursor-wait'
                : file
                ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : (
              'Enviar Comprobante'
            )}
          </button>
        </form>
      </div>

      {/* Mensajes de estado */}
      {status === 'success' && (
        <div className="flex gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-400">{message}</p>
            <p className="text-xs text-green-400/70 mt-0.5">Tu pago será verificado por nuestro equipo</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}
