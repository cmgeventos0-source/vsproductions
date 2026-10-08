"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { Category } from "@/lib/types";

export default function Filters({
  categories,
  cities,
}: {
  categories: Category[];
  cities: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const categoria = params.get("categoria") ?? "";
  const ciudad = params.get("ciudad") ?? "";

  const apply = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/eventos?${next.toString()}`);
    },
    [params, router]
  );

  return (
    <div className="mb-10 rounded-3xl border border-white/[0.1] bg-[#121329]/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,.25)] backdrop-blur-xl md:grid md:grid-cols-[minmax(0,1fr)_190px_190px] md:gap-2">
      <label className="group flex min-w-0 items-center gap-3 rounded-2xl border border-transparent px-4 py-3.5 transition-colors focus-within:border-violet-400/40 focus-within:bg-white/[0.04]">
        <span className="text-lg">⌕</span>
        <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500" placeholder="Artista, evento o lugar" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") apply("q", q); }} />
        <button type="button" onClick={() => apply("q", q)} className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-violet-950/50 hover:brightness-110">Buscar</button>
      </label>
      <label className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3 md:border-l md:border-t-0"><span>🎭</span><select
        className="w-full bg-transparent text-sm font-bold text-slate-200 outline-none"
        value={categoria}
        onChange={(e) => apply("categoria", e.target.value)}
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select></label>
      <label className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3 md:border-l md:border-t-0"><span>📍</span><select
        className="w-full bg-transparent text-sm font-bold text-slate-200 outline-none"
        value={ciudad}
        onChange={(e) => apply("ciudad", e.target.value)}
      >
        <option value="">Todas las ciudades</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select></label>
    </div>
  );
}
