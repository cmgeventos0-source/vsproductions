'use client';

import { useFavorites } from '@/hooks/useFavorites';
import { Heart, Loader } from 'lucide-react';
import Link from 'next/link';

interface FavoriteButtonProps {
  eventId: string;
  className?: string;
}

export function FavoriteButton({ eventId, className = '' }: FavoriteButtonProps) {
  const { isFavorite, addToFavorites, removeFromFavorites, loading } = useFavorites();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (isFavorite(eventId)) {
        await removeFromFavorites(eventId);
      } else {
        await addToFavorites(eventId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const isFav = isFavorite(eventId);

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`p-2 rounded-full transition ${
        isFav
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } ${className}`}
      title={isFav ? 'Remover de favoritos' : 'Añadir a favoritos'}
    >
      {loading ? (
        <Loader className="w-5 h-5 animate-spin" />
      ) : (
        <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
      )}
    </button>
  );
}

export function FavoritesList() {
  const { favorites, loading } = useFavorites();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Heart className="w-8 h-8" />
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin favoritos</h2>
        <p className="text-gray-600 mb-4">No tienes eventos guardados aún</p>
        <Link
          href="/eventos"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Explorar eventos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {favorites.map((favorite: any) => (
        <Link
          key={favorite.id}
          href={`/eventos/${favorite.event.id}`}
          className="block p-4 border border-gray-200 rounded-lg hover:shadow-lg transition"
        >
          <div className="flex gap-4">
            {favorite.event.image_url && (
              <img
                src={favorite.event.image_url}
                alt={favorite.event.name}
                className="w-24 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{favorite.event.name}</h3>
              <p className="text-sm text-gray-600">{favorite.event.city}</p>
              {favorite.event.functions && favorite.event.functions.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Próximo: {new Date(favorite.event.functions[0].event_date).toLocaleDateString('es-CO')}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Guardado: {new Date(favorite.created_at).toLocaleDateString('es-CO')}
              </p>
            </div>
            <FavoriteButton eventId={favorite.event.id} />
          </div>
        </Link>
      ))}
    </div>
  );
}
