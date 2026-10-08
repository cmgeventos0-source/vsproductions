'use client';

import { SearchBar } from '@/components/SearchBar';
import { SearchResults } from '@/components/SearchResults';
import { Suspense } from 'react';

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Buscar Eventos</h1>
        <p className="text-gray-600 mb-8">
          Encuentra los mejores eventos, conciertos y actividades cerca de ti
        </p>

        {/* Barra de búsqueda */}
        <div className="mb-12">
          <SearchBar showFilters={true} />
        </div>

        {/* Resultados */}
        <Suspense fallback={<div className="text-center py-12">Cargando eventos...</div>}>
          <SearchResults />
        </Suspense>
      </div>
    </div>
  );
}
