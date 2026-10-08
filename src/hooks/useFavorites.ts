'use client';

import { useCallback, useEffect, useState } from 'react';
import { Favorite } from '@/types/cart';
import { useAuth } from '@/hooks/useAuth';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/favorites');

      if (!response.ok) {
        throw new Error('Error al cargar favoritos');
      }

      const data = await response.json();
      setFavorites(data);

      // Guardar en localStorage
      localStorage.setItem('favorites_data', JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Intentar recuperar del localStorage
      const stored = localStorage.getItem('favorites_data');
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [user, loadFavorites]);

  const addToFavorites = useCallback(
    async (eventId: string) => {
      if (!user) {
        setError('Se requiere autenticación');
        return;
      }

      try {
        setError(null);

        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eventId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al añadir favorito');
        }

        await loadFavorites();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      }
    },
    [user, loadFavorites]
  );

  const removeFromFavorites = useCallback(
    async (eventId: string) => {
      if (!user) {
        setError('Se requiere autenticación');
        return;
      }

      try {
        setError(null);

        const response = await fetch('/api/favorites', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eventId }),
        });

        if (!response.ok) {
          throw new Error('Error al eliminar favorito');
        }

        await loadFavorites();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      }
    },
    [user, loadFavorites]
  );

  const isFavorite = useCallback(
    (eventId: string): boolean => {
      return favorites.some((fav: any) => fav.event?.id === eventId);
    },
    [favorites]
  );

  return {
    favorites,
    loading,
    error,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    reload: loadFavorites,
  };
}
