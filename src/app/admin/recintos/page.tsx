"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createVenueAction,
  updateVenueAction,
  deleteVenueAction,
} from "../../actions";

type Venue = {
  id: string;
  name: string;
  city: string;
  address: string | null;
};

export default function AdminRecintosPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("venues").select("*").order("name");
    setVenues(data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setCity("");
    setAddress("");
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(v: Venue) {
    setEditId(v.id);
    setName(v.name);
    setCity(v.city);
    setAddress(v.address ?? "");
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!name.trim() || !city.trim()) return;
    setSaving(true);
    const res = editId
      ? await updateVenueAction(editId, name.trim(), city.trim(), address.trim())
      : await createVenueAction(name.trim(), city.trim(), address.trim());
    setSaving(false);
    if (res.success) {
      setToast(editId ? "Recinto actualizado" : "Recinto creado");
      resetForm();
      load();
    } else {
      setToast("Error: " + res.error);
    }
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(v: Venue) {
    if (!confirm(`Eliminar "${v.name}"?`)) return;
    const res = await deleteVenueAction(v.id);
    if (res.success) {
      setToast("Recinto eliminado");
      load();
    } else {
      setToast("Error: " + res.error);
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <button onClick={() => router.push("/admin")} className="btn-outline text-xs">
            ← Volver
          </button>
          <h1 className="text-2xl font-black">Gestión de Recintos</h1>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary text-xs ml-auto"
          >
            + Nuevo Recinto
          </button>
        </div>

        {showForm && (
          <div className="card p-6 mb-6 space-y-4">
            <h2 className="font-bold">{editId ? "Editar Recinto" : "Nuevo Recinto"}</h2>
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Movistar Arena" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Ciudad</label>
                <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej: Bogotá" />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={!name.trim() || !city.trim() || saving} className="btn-primary flex-1">
                {saving ? "Guardando..." : editId ? "Actualizar" : "Crear"}
              </button>
              <button onClick={resetForm} className="btn-outline flex-1">Cancelar</button>
            </div>
          </div>
        )}

        <div className="card p-6">
          {loading ? (
            <p className="text-center text-muted py-8">Cargando...</p>
          ) : venues.length === 0 ? (
            <p className="text-center text-muted py-8">No hay recintos. Crea el primero.</p>
          ) : (
            <div className="space-y-2">
              {venues.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors">
                  <span className="text-xl">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{v.name}</p>
                    <p className="text-xs text-muted">{v.city}{v.address ? ` · ${v.address}` : ""}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEdit(v)} className="btn-outline !py-1 !px-3 text-xs">Editar</button>
                    <button onClick={() => handleDelete(v)} className="btn-outline !py-1 !px-3 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-surface border border-white/10 px-6 py-3 text-sm font-semibold shadow-2xl text-white animate-pulse">
          {toast}
        </div>
      )}
    </div>
  );
}
