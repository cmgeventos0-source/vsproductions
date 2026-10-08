"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "../../actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
};

export default function AdminCategoriasPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order");
    setCategories(data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setSlug("");
    setIcon("");
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(c: Category) {
    setEditId(c.id);
    setName(c.name);
    setSlug(c.slug);
    setIcon(c.icon ?? "");
    setShowForm(true);
  }

  function handleNameChange(v: string) {
    setName(v);
    if (!editId) {
      setSlug(
        v
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      );
    }
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    const s = slug || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const res = editId
      ? await updateCategoryAction(editId, name.trim(), s, icon)
      : await createCategoryAction(name.trim(), s, icon);
    setSaving(false);
    if (res.success) {
      setToast(editId ? "Categoría actualizada" : "Categoría creada");
      resetForm();
      load();
    } else {
      setToast("Error: " + res.error);
    }
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(c: Category) {
    if (!confirm(`Eliminar "${c.name}"? Los eventos en esta categoría no se eliminarán.`)) return;
    const res = await deleteCategoryAction(c.id);
    if (res.success) {
      setToast("Categoría eliminada");
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
          <h1 className="text-2xl font-black">Gestión de Categorías</h1>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn-primary text-xs ml-auto"
          >
            + Nueva Categoría
          </button>
        </div>

        {showForm && (
          <div className="card p-6 mb-6 space-y-4">
            <h2 className="font-bold">{editId ? "Editar Categoría" : "Nueva Categoría"}</h2>
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Conciertos, Deportes..."
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Slug</label>
                <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generado" />
              </div>
              <div>
                <label className="label">Icono (emoji o texto)</label>
                <input className="input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🎤" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={!name.trim() || saving} className="btn-primary flex-1">
                {saving ? "Guardando..." : editId ? "Actualizar" : "Crear"}
              </button>
              <button onClick={resetForm} className="btn-outline flex-1">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="card p-6">
          {loading ? (
            <p className="text-center text-muted py-8">Cargando...</p>
          ) : categories.length === 0 ? (
            <p className="text-center text-muted py-8">No hay categorías. Crea la primera.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors"
                >
                  <span className="text-xl">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{c.name}</p>
                    <p className="text-xs text-muted">/{c.slug}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEdit(c)} className="btn-outline !py-1 !px-3 text-xs">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(c)} className="btn-outline !py-1 !px-3 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10">
                      Eliminar
                    </button>
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
