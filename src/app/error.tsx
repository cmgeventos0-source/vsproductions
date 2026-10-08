'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-3xl border border-white/10 bg-[#0E0F1F]/80 p-8 text-center backdrop-blur-2xl shadow-2xl space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/20 text-3xl text-pink-400">
          ⚠️
        </div>
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">¡Algo salió mal!</h2>
          <p className="mt-2 text-sm text-slate-300">
            {error.message || 'Ha ocurrido un error inesperado al cargar la página.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-xs font-bold text-white shadow-lg transition-all hover:scale-105"
          >
            Reintentar 🔄
          </button>
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold text-slate-300 transition-all hover:bg-white/10 hover:text-white"
          >
            Ir al Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
