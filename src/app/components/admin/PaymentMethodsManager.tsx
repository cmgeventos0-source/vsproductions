'use client'

import { useEffect, useState } from 'react'
import { Smartphone, Banknote, Wallet, CreditCard, Plus, Trash2, HelpCircle } from 'lucide-react'

type PaymentMethod = {
  id: string
  name: string
  icon: string
  enabled: boolean
  requires_verification: boolean
  verification_config: Record<string, any>
  display_order: number
}

const ICONS: Record<string, any> = {
  smartphone: Smartphone,
  banknote: Banknote,
  wallet: Wallet,
  'credit-card': CreditCard,
  otro: HelpCircle,
}

export function PaymentMethodsManager() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PaymentMethod | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchMethods()
  }, [])

  const fetchMethods = async () => {
    try {
      const res = await fetch('/api/admin/payment-methods')
      const data = await res.json()
      setMethods(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled })
      })
      fetchMethods()
    } catch (error) {
      console.error('Error toggling payment method:', error)
    }
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editing) return

    try {
      const formData = new FormData(e.currentTarget)
      const data = {
        name: formData.get('name'),
        icon: formData.get('icon'),
        requires_verification: formData.get('requires_verification') === 'on',
        enabled: formData.get('enabled') === 'on',
      }

      if (editing.id) {
        await fetch(`/api/admin/payment-methods/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      } else {
        await fetch('/api/admin/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: formData.get('id'), ...data })
        })
      }
      fetchMethods()
      setShowModal(false)
      setEditing(null)
    } catch (error) {
      console.error('Error saving payment method:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro?')) return
    try {
      await fetch(`/api/admin/payment-methods/${id}`, { method: 'DELETE' })
      fetchMethods()
    } catch (error) {
      console.error('Error deleting payment method:', error)
    }
  }

  if (loading) return <div className="p-4">Cargando...</div>

  return (
    <div className="card p-6 bg-[#0E0F1F]/80 border-white/10 space-y-6 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Métodos de Pago</h1>
          <p className="text-xs text-slate-400 mt-0.5">Configura los métodos de pago disponibles</p>
        </div>
        <button
          onClick={() => {
            setEditing({ id: '', name: '', icon: 'smartphone', enabled: true, requires_verification: true, verification_config: {}, display_order: 0 })
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs rounded-xl shadow-lg hover:scale-105 transition-all"
        >
          <Plus size={16} /> Nuevo método
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.05] border-b border-white/10 text-slate-400 uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Método</th>
              <th className="px-4 py-3 font-semibold">Verificación</th>
              <th className="px-4 py-3 font-semibold text-center">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {(methods || []).map((method) => {
              const IconComponent = ICONS[method.icon] || HelpCircle
              return (
                <tr key={method.id} className="hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                        <IconComponent className="w-4 h-4 text-purple-300" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{method.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{method.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      method.requires_verification ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {method.requires_verification ? 'Automática' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleEnabled(method.id, method.enabled)}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
                        method.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${method.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditing(method)
                          setShowModal(true)
                        }}
                        className="px-3 py-1 text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-500/20 rounded-lg transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(method.id)}
                        aria-label="Eliminar"
                        className="p-1.5 text-xs text-red-400 hover:text-red-200 hover:bg-red-500/20 rounded-lg transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0E0F1F] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">
              {editing.id ? 'Editar Método' : 'Nuevo Método'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              {!editing.id && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">ID</label>
                  <input
                    type="text"
                    name="id"
                    defaultValue={editing.id}
                    required
                    className="input"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editing.name}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Icono</label>
                <select name="icon" defaultValue={editing.icon} className="input">
                  <option value="smartphone" className="bg-[#0E0F1F]">Smartphone</option>
                  <option value="banknote" className="bg-[#0E0F1F]">Banknote</option>
                  <option value="wallet" className="bg-[#0E0F1F]">Wallet</option>
                  <option value="credit-card" className="bg-[#0E0F1F]">Credit Card</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="requires_verification" defaultChecked={editing.requires_verification} className="rounded accent-purple-500" />
                <span className="text-xs font-medium text-slate-300">Requiere verificación automática</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="enabled" defaultChecked={editing.enabled} className="rounded accent-purple-500" />
                <span className="text-xs font-medium text-slate-300">Activo</span>
              </label>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditing(null)
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-300 border border-white/10 rounded-xl hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs rounded-xl shadow-lg"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
