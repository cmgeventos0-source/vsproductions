'use client';

import { useSearch } from '@/hooks/useSearch';
import { SearchResult } from '@/types/search';
import { MapPin, Star, Loader } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { FavoriteButton } from '@/components/FavoriteButton';

interface SearchResultsProps {
  results?: SearchResult[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function SearchResults({
  results: externalResults,
  loading: externalLoading,
  hasMore: externalHasMore,
  onLoadMore: externalLoadMore,
}: SearchResultsProps) {
  const { results: hookResults, loading: hookLoading, hasMore: hookHasMore, loadMore: hookLoadMore } = useSearch();

  const results = externalResults || hookResults;
  const loading = externalLoading !== undefined ? externalLoading : hookLoading;
  const hasMore = externalHasMore !== undefined ? externalHasMore : hookHasMore;
  const loadMore = externalLoadMore || hookLoadMore;

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Buscando eventos...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">No se encontraron eventos</p>
        <p className="text-gray-500 text-sm mt-2">Intenta con otros filtros o términos de búsqueda</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grid de resultados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result: SearchResult) => (
          <Link key={result.id} href={`/eventos/${result.id}`}>
            <div className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition h-full flex flex-col">
              {/* Imagen */}
              <div className="relative h-48 bg-gray-200 overflow-hidden">
                {result.imageUrl && (
                  <Image
                    src={result.imageUrl}
                    alt={result.name}
                    fill
                    className="object-cover hover:scale-105 transition"
                  />
                )}
                <div className="absolute top-2 right-2">
                  <FavoriteButton eventId={result.id} />
                </div>
              </div>

              {/* Contenido */}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 line-clamp-2 mb-2">{result.name}</h3>

                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{result.description}</p>

                {/* Ubicación */}
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span>{result.city}</span>
                  {result.distance && <span className="text-xs">({result.distance.toFixed(1)} km)</span>}
                </div>

                {/* Categoría y fecha */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span className="bg-gray-100 px-2 py-1 rounded">{result.categoryName}</span>
                  <span>{new Date(result.date).toLocaleDateString('es-CO')}</span>
                </div>

                {/* Precio y trending */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200">
                  <span className="text-lg font-bold text-blue-600">
                    ${result.price.toLocaleString('es-CO')}
                  </span>

                  {result.popularity && result.popularity > 70 && (
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-xs font-semibold">Trending</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Botón para cargar más */}
      {hasMore && (
        <div className="flex justify-center pt-8">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-semibold"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 inline animate-spin mr-2" />
                Cargando...
              </>
            ) : (
              'Cargar más resultados'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function SearchResultsList() {
  const { results, loading, total } = useSearch();

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {total > 0 ? `Se encontraron ${total} eventos` : 'Sin resultados'}
        </h2>
      </div>

      <SearchResults />
    </div>
  );
}
