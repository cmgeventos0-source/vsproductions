"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImageAction } from "../../../actions";

export default function NewEventPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [venueId, setVenueId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saleMode, setSaleMode] = useState<"general" | "assigned">("general");
  const [allowsMinors, setAllowsMinors] = useState(false);
  const [maxMinorsPerAdult, setMaxMinorsPerAdult] = useState(2);
  const [categories, setCategories] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: cat } = await supabase.from("categories").select("*");
      const { data: venue } = await supabase.from("venues").select("*");
      setCategories(cat ?? []);
      setVenues(venue ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    const newSlug = newName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 100);
    setSlug(newSlug);
  };

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await uploadImageAction(file);
    setUploading(false);
    if (res.success && res.url) {
      setImageUrl(res.url);
    } else {
      alert("Error al subir imagen: " + res.error);
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const eventPayload: any = {
      slug: slug,
      name: name,
      category_id: categoryId || null,
      venue_id: venueId || null,
      description: description || null,
      image_url: imageUrl || null,
      sale_mode: saleMode,
      allows_minors: allowsMinors,
      max_minors_per_adult: maxMinorsPerAdult || 2,
    };

    let { error } = await supabase.from("events").insert(eventPayload);
    if (error && (error.message.includes("allows_minors") || error.code === "PGRST204")) {
      // Si la migración aún no se ha ejecutado en Supabase, reintentar sin las columnas
      delete eventPayload.allows_minors;
      delete eventPayload.max_minors_per_adult;
      const fallback = await supabase.from("events").insert(eventPayload);
      error = fallback.error;
    }

    if (error) {
      alert("Error al crear evento: " + error.message);
      return;
    }
    router.push("/admin");
  };

  return (
    <div className='mx-auto max-w-3xl px-4 py-10'>
      <div className='card p-6 space-y-6'>
        <h1 className='text-3xl font-black'>Crear Nuevo Evento</h1>
        <form onSubmit={handleSubmit}>
          <div className='space-y-4'>
            <div>
              <label className='label'>Nombre del Evento</label>
              <input type='text' value={name} onChange={handleNameChange} className='input' />
            </div>
            <div>
              <label className='label'>Slug (auto)</label>
              <input type='text' value={slug} className='input' disabled />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='label'>Categoría</label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className='input'>
                  <option value=''>Selecciona categoría</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className='label'>Recinto</label>
                <select value={venueId} onChange={e => setVenueId(e.target.value)} className='input'>
                  <option value=''>Selecciona recinto</option>
                  {venues.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className='label'>Descripción</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className='input' />
            </div>
            <div>
              <label className='label'>Imagen del Evento</label>
              {imageUrl ? (
                <div className="relative">
                  <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover rounded-xl border border-border" />
                  <button type="button" onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-lg">Quitar</button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <label className="btn-outline cursor-pointer text-xs">
                    {uploading ? "Subiendo..." : "Subir imagen local"}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                  </label>
                  <span className="text-xs text-muted">o</span>
                  <input type='text' value={imageUrl} onChange={e => setImageUrl(e.target.value)} className='input flex-1' placeholder="Pega una URL de imagen" />
                </div>
              )}
            </div>
            <div>
              <label className='label'>Modo de Venta</label>
              <select value={saleMode} onChange={e => setSaleMode(e.target.value as any)} className='input'>
                <option value='general'>Admisión General</option>
                <option value='assigned'>Asientos Asignados</option>
              </select>
            </div>

            {/* Configuración de Menores */}
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-bold text-white flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowsMinors}
                      onChange={(e) => setAllowsMinors(e.target.checked)}
                      className="h-4 w-4 rounded accent-purple-600 cursor-pointer"
                    />
                    👶 Evento para menores (requiere adulto acompañante)
                  </label>
                  <p className="text-xs text-muted mt-1">
                    Al activar esta opción, los menores solo podrán asistir si van con un adulto que compre su boleta. Podrás definir el precio de la boleta de menor por cada zona.
                  </p>
                </div>
              </div>

              {allowsMinors && (
                <div className="pt-2 border-t border-white/10">
                  <label className="label text-xs">Máximo de menores por cada adulto</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxMinorsPerAdult}
                    onChange={(e) => setMaxMinorsPerAdult(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="input w-full sm:w-48 text-sm"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Por defecto: 2 menores por adulto. Cada uno obtiene su propia boleta digital.
                  </p>
                </div>
              )}
            </div>
            <button type='submit' disabled={uploading} className='btn-primary w-full py-3'>
              {uploading ? "Subiendo imagen..." : "Crear Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
