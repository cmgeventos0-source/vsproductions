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
    const { error } = await supabase.from("events").insert({
      slug: slug,
      name: name,
      category_id: categoryId || null,
      venue_id: venueId || null,
      description: description || null,
      image_url: imageUrl || null,
      sale_mode: saleMode,
    });
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
            <button type='submit' disabled={uploading} className='btn-primary w-full py-3'>
              {uploading ? "Subiendo imagen..." : "Crear Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
