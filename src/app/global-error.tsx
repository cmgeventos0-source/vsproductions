'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#05050D] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-[#0E0F1F] p-8 text-center shadow-2xl space-y-6">
          <div className="text-4xl">🚨</div>
          <h1 className="text-2xl font-black">Error Crítico del Sistema</h1>
          <p className="text-sm text-slate-300">
            {error.message || 'Se produjo un error crítico en el servidor.'}
          </p>
          <button
            onClick={() => reset()}
            className="rounded-xl bg-purple-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-purple-700 transition-all"
          >
            Volver a Cargar
          </button>
        </div>
      </body>
    </html>
  );
}
