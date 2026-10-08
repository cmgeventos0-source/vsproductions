"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImageAction } from "../../../actions";
import type { Event, EventFunction, Zone } from "@/lib/types";

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();

  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [functions, setFunctions] = useState<EventFunction[]>([]);

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saleMode, setSaleMode] = useState<"general" | "assigned">("general");

  // Function management
  const [newFunction, setNewFunction] = useState({
    name: "",
    starts_at: "",
    doors_open_at: "",
    sales_start_at: "",
    sales_end_at: "",
  });
  const [editingFunctionId, setEditingFunctionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editDoorsOpenAt, setEditDoorsOpenAt] = useState("");
  const [editSalesStartAt, setEditSalesStartAt] = useState("");
  const [editSalesEndAt, setEditSalesEndAt] = useState("");

  // Load event and related data
  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (ev) setEvent(ev);
      const { data: cat } = await supabase.from("categories").select("*");
      const { data: ven } = await supabase.from("venues").select("*");
      setCategories(cat ?? []);
      setVenues(ven ?? []);
      const { data: funcs } = await supabase
        .from("event_functions")
        .select("*, zones(*)")
        .eq("event_id", id);
      setFunctions(funcs ?? []);
    }
    load();
  }, [id]);

  // Sync form with loaded event
  useEffect(() => {
    if (event) {
      setName(event.name);
      setSlug(event.slug);
      setCategoryId(event.category_id ?? "");
      setVenueId(event.venue_id ?? "");
      setDescription(event.description ?? "");
      setImageUrl(event.image_url ?? "");
      setSaleMode(event.sale_mode ?? "general");
    }
  }, [event]);

  // Handle input changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    const newSlug = newName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 100);
    setSlug(newSlug);
  };
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryId(e.target.value);
  };
  const handleVenueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setVenueId(e.target.value);
  };
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUrl(e.target.value);
  };
  const handleSaleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSaleMode(e.target.value as any);
  };

  // Save event changes
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!event) return;
    const { error } = await supabase.from("events").update({
      name: name,
      slug: slug,
      category_id: categoryId || null,
      venue_id: venueId || null,
      description: description || null,
      image_url: imageUrl || null,
      sale_mode: saleMode,
    }).eq("id", id);
    if (error) {
      alert("Error al guardar evento: " + error.message);
      return;
    }
    router.push("/admin");
  };

function toLocalDatetimeInputString(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return "";
  const d = new Date(dateStrOrObj);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoStringFromInput(inputVal: string | null | undefined): string | null {
  if (!inputVal || !inputVal.trim()) return null;
  const d = new Date(inputVal);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

  // Add a new function
  const handleAddFunction = async () => {
    if (!event) return;

    // Validar que la fecha de inicio sea obligatoria y válida
    if (!newFunction.starts_at || newFunction.starts_at.trim() === "") {
      alert("La fecha de inicio (starts_at) es obligatoria. Por favor, seleccione una fecha y hora válidas.");
      return;
    }

    const { data, error } = await supabase.from("event_functions").insert({
      event_id: id,
      name: newFunction.name || null,
      starts_at: toIsoStringFromInput(newFunction.starts_at),
      doors_open_at: toIsoStringFromInput(newFunction.doors_open_at),
      sales_start_at: toIsoStringFromInput(newFunction.sales_start_at),
      sales_end_at: toIsoStringFromInput(newFunction.sales_end_at),
      is_active: true,
    }).select().single();

    if (error) {
      alert("Error al crear función: " + error.message);
      return;
    }

    const { data: refreshed } = await supabase
      .from("event_functions")
      .select("*")
      .eq("event_id", id);

    setFunctions(refreshed ?? []);
    setNewFunction({ name: "", starts_at: "", doors_open_at: "", sales_start_at: "", sales_end_at: "" });
  };

  // Delete a function
  const handleDeleteFunction = async (funcId: string) => {
    if (!window.confirm("¿Estás seguro de eliminar esta función?")) return;
    const { error } = await supabase.from("event_functions").delete().eq("id", funcId);
    if (error) {
      alert("Error al eliminar función: " + error.message);
      return;
    }
    const { data: refreshed } = await supabase
      .from("event_functions")
      .select("*")
      .eq("event_id", id);
    setFunctions(refreshed ?? []);
  };

  // Open edit modal for a function
  const openEditModal = (func: EventFunction) => {
    setEditingFunctionId(func.id);
    setEditName(func.name ?? "");
    setEditStartsAt(toLocalDatetimeInputString(func.starts_at));
    setEditDoorsOpenAt(toLocalDatetimeInputString(func.doors_open_at));
    setEditSalesStartAt(toLocalDatetimeInputString(func.sales_start_at));
    setEditSalesEndAt(toLocalDatetimeInputString(func.sales_end_at));
  };

  // Save edited function
  const handleEditSubmit = async () => {
    if (!editingFunctionId) return;

    // Validar que la fecha de inicio sea obligatoria y válida
    if (!editStartsAt || editStartsAt.trim() === "") {
      alert("La fecha de inicio (starts_at) es obligatoria. Por favor, seleccione una fecha y hora válidas.");
      return;
    }

    const { error } = await supabase.from("event_functions").update({
      name: editName || null,
      starts_at: toIsoStringFromInput(editStartsAt),
      doors_open_at: toIsoStringFromInput(editDoorsOpenAt),
      sales_start_at: toIsoStringFromInput(editSalesStartAt),
      sales_end_at: toIsoStringFromInput(editSalesEndAt),
    }).eq("id", editingFunctionId);
    if (error) {
      alert("Error al actualizar función: " + error.message);
      return;
    }
    const { data: refreshed } = await supabase
      .from("event_functions")
      .select("*")
      .eq("event_id", id);
    setFunctions(refreshed ?? []);
    setEditingFunctionId(null);
  };

  // Render
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="card p-6 space-y-6">
        <h1 className="text-3xl font-black">Editar Evento</h1>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-muted">Nombre del Evento</label>
              <input type="text" value={name}
                onChange={handleNameChange}
                className="input text-sm p-2.5 rounded-xl border border-border bg-surface w-full" />
            </div>
            <div>
              <label className="block text-[10px] text-muted">Slug (auto)</label>
              <input type="text" value={slug}
                className="input text-sm p-2.5 rounded-xl border border-border bg-surface w-full" disabled />
            </div>
            <div>
              <label className="block text-[10px] text-muted">Categoría</label>
              <select value={categoryId}
                onChange={handleCategoryChange}
                className="input text-sm p-2.5 rounded-xl border border-border bg-surface w-full"
              >
                <option value="">Selecciona categoría</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted">Recinto</label>
              <select value={venueId}
                onChange={handleVenueChange}
                className="input text-sm p-2.5 rounded-xl border border-border bg-surface w-full"
              >
                <option value="">Selecciona recinto</option>
                {venues.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted">Descripción</label>
              <textarea value={description}
                onChange={handleDescriptionChange}
                rows={4}
                className="input text-sm p-2.5 rounded-xl border border-border bg-surface w-full" />
            </div>
            <div>
              <label className="block text-[10px] text-muted">Imagen del Evento</label>
              {imageUrl ? (
                <div className="relative mt-1">
                  <img src={imageUrl} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-border" />
                  <button type="button" onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-lg">Quitar</button>
                </div>
              ) : (
                <div className="flex items-center gap-4 mt-1">
                  <label className="btn-outline cursor-pointer text-xs">
                    Subir imagen
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const res = await uploadImageAction(file);
                      if (res.success && res.url) setImageUrl(res.url);
                    }} className="hidden" />
                  </label>
                  <span className="text-xs text-muted">o</span>
                  <input type="text" value={imageUrl}
                    onChange={handleImageChange}
                    className="input flex-1" placeholder="URL de imagen" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] text-muted">Modo de Venta</label>
              <select value={saleMode}
                onChange={handleSaleModeChange}
                className="input text-sm p-2.5 rounded-xl border border-border bg-surface w-full"
              >
                <option value="general">General</option>
                <option value="assigned">Asignado</option>
              </select>
            </div>
            <button type="submit"
              className="btn btn-primary w-full py-2.5"
            >
              Guardar Cambios
            </button>
          </div>
          </form>

          {/* Functions Section */}
          <div className="space-y-6 mt-8">
            <h2 className="text-2xl font-bold">Funciones</h2>

            {functions && functions.length > 0 ? (
              functions.map((fn: EventFunction) => (
                <div key={fn.id} className="card p-4 space-y-4 border border-white/5 bg-surface rounded-lg">
                  <h3 className="text-lg font-semibold">{fn.name || "Sin nombre"}</h3>
                  <div className="space-y-1 text-[10px] text-muted">
                    <p>Inicia: {fn.starts_at || "—"}</p>
                    <p>Modo: {event?.sale_mode ?? "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(fn)}
                      className="btn btn-outline text-xs px-3 py-1.5"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteFunction(fn.id)}
                      className="btn btn-outline text-xs px-3 py-1.5"
                    >
                      Eliminar
                    </button>
                  </div>

                  {/* Zones list */}
                  {fn.zones && fn.zones.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-[10px] text-muted">Zonas ({fn.zones.length})</p>
                      <ul className="list-disc pl-5 space-y-0.5 text-[10px] text-muted">
                        {fn.zones.map((z: Zone) => (
                          <li key={z.id}>
                            {z.name} <span className="text-[10px] text-muted">({z.capacity} butacas)</span>
                            <a href={`/admin/funciones/${fn.id}/mapa`}
                              className="ml-2 text-purple-400 hover:underline text-[9px]"
                            >
                              🗺 Editar Mapa
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted">Sin zonas.</p>
                  )}

                  {/* Edit Modal */}
                  {editingFunctionId === fn.id && (
                    <div className="mt-4 p-3 bg-surface-1 rounded-xl">
                      <h4 className="text-xs font-medium">Editar Función</h4>
                      <div className="space-y-2">
                        <input type="text"
                          placeholder="Nombre"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                        <input type="datetime-local"
                          value={editStartsAt}
                          onChange={(e) => setEditStartsAt(e.target.value)}
                          className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                        <input type="datetime-local"
                          value={editDoorsOpenAt}
                          onChange={(e) => setEditDoorsOpenAt(e.target.value)}
                          className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                        <input type="datetime-local"
                          value={editSalesStartAt}
                          onChange={(e) => setEditSalesStartAt(e.target.value)}
                          className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                        <input type="datetime-local"
                          value={editSalesEndAt}
                          onChange={(e) => setEditSalesEndAt(e.target.value)}
                          className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                      </div>
                      <button
                        onClick={handleEditSubmit}
                        className="btn btn-primary text-xs px-3 py-1.5"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingFunctionId(null)}
                        className="btn btn-outline text-xs px-3 py-1.5"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted">No hay funciones creadas.</p>
            )}

            {/* Add Function Form */}
            <div className="mt-4 p-3 bg-surface-1 rounded-lg">
              <h3 className="text-sm font-semibold">+ Añadir Función</h3>
              <div className="space-y-2">
                <input type="text"
                  placeholder="Nombre"
                  value={newFunction.name}
                  onChange={(e) => setNewFunction({ ...newFunction, name: e.target.value })}
                  className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                <input type="datetime-local"
                  value={newFunction.starts_at}
                  onChange={(e) => setNewFunction({ ...newFunction, starts_at: e.target.value })}
                  className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                <input type="datetime-local"
                  value={newFunction.doors_open_at}
                  onChange={(e) => setNewFunction({ ...newFunction, doors_open_at: e.target.value })}
                  className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                <input type="datetime-local"
                  value={newFunction.sales_start_at}
                  onChange={(e) => setNewFunction({ ...newFunction, sales_start_at: e.target.value })}
                  className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
                <input type="datetime-local"
                  value={newFunction.sales_end_at}
                  onChange={(e) => setNewFunction({ ...newFunction, sales_end_at: e.target.value })}
                  className="input input text-xs p-1.5 rounded-xl border border-border bg-surface w-full" />
              </div>
              <button
                type="button"
                onClick={handleAddFunction}
                className="btn btn-primary text-xs px-3 py-1.5 mt-2"
              >
                Crear Función
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}