'use client';

import { useCallback, useState } from 'react';
import { useLocationPreference } from '@/hooks/useSearch';
import { MapPin, Loader } from 'lucide-react';

export function GeoSearchButton() {
  const { updatePreference, loading } = useLocationPreference();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeoSearch = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en tu navegador');
      return;
    }

    try {
      setSearching(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;

            // Guardar preferencia de ubicación
            await updatePreference(latitude, longitude, 50, []);

            // Redirigir a búsqueda con parámetros de ubicación
            const params = new URLSearchParams({
              latitude: latitude.toString(),
              longitude: longitude.toString(),
              radius: '50',
            });

            window.location.href = `/buscar?${params.toString()}`;
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar ubicación');
            setSearching(false);
          }
        },
        (err) => {
          setError('No se pudo obtener tu ubicación. Asegúrate de permitir el acceso.');
          setSearching(false);
        }
      );
    } catch (err) {
      setError('Error al acceder a la geolocalización');
      setSearching(false);
    }
  }, [updatePreference]);

  return (
    <div className="space-y-2">
      <button
        onClick={handleGeoSearch}
        disabled={searching || loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
      >
        {searching || loading ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Detectando ubicación...
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            Buscar cerca de mi
          </>
        )}
      </button>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
