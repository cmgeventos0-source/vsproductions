'use client';

import { FavoritesList } from '@/components/FavoriteButton';
import { Suspense } from 'react';

export default function FavoritesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Mis Favoritos</h1>

        <Suspense fallback={<div className="text-center py-12">Cargando favoritos...</div>}>
          <FavoritesList />
        </Suspense>
      </div>
    </div>
  );
}
