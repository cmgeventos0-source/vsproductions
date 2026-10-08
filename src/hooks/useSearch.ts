'use client';

import { useCallback, useEffect, useState } from 'react';
import { SearchFilters, SearchResponse, SearchResult } from '@/types/search';
import { useAuth } from '@/hooks/useAuth';

export function useSearch() {
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});

  const search = useCallback(
    async (filters: SearchFilters) => {
      try {
        setLoading(true);
        setError(null);
        setCurrentFilters(filters);
        setCurrentPage(1);

        const queryParams = new URLSearchParams();
        if (filters.query) queryParams.append('query', filters.query);
        if (filters.category) queryParams.append('category', filters.category);
        if (filters.minPrice) queryParams.append('minPrice', filters.minPrice.toString());
        if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice.toString());
        if (filters.startDate) queryParams.append('startDate', filters.startDate);
        if (filters.endDate) queryParams.append('endDate', filters.endDate);
        if (filters.city) queryParams.append('city', filters.city);
        if (filters.latitude) queryParams.append('latitude', filters.latitude.toString());
        if (filters.longitude) queryParams.append('longitude', filters.longitude.toString());
        if (filters.radius) queryParams.append('radius', filters.radius.toString());
        if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
        if (filters.page) queryParams.append('page', filters.page.toString());
        if (filters.limit) queryParams.append('limit', filters.limit.toString());

        const response = await fetch(`/api/search?${queryParams.toString()}`);

        if (!response.ok) {
          throw new Error('Error al buscar eventos');
        }

        const data: SearchResponse = await response.json();
        setResults(data.results);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setCurrentPage(data.page);

        // Guardar búsqueda reciente
        if (user) {
          try {
            await fetch('/api/search/recent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filters,
                resultsCount: data.total,
              }),
            });
          } catch (err) {
            console.error('Error saving recent search:', err);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const loadMore = useCallback(async () => {
    try {
      setLoading(true);

      const nextFilters = {
        ...currentFilters,
        page: currentPage + 1,
      };

      const queryParams = new URLSearchParams();
      if (nextFilters.query) queryParams.append('query', nextFilters.query);
      if (nextFilters.category) queryParams.append('category', nextFilters.category);
      if (nextFilters.minPrice) queryParams.append('minPrice', nextFilters.minPrice.toString());
      if (nextFilters.maxPrice) queryParams.append('maxPrice', nextFilters.maxPrice.toString());
      if (nextFilters.startDate) queryParams.append('startDate', nextFilters.startDate);
      if (nextFilters.endDate) queryParams.append('endDate', nextFilters.endDate);
      if (nextFilters.city) queryParams.append('city', nextFilters.city);
      if (nextFilters.latitude) queryParams.append('latitude', nextFilters.latitude.toString());
      if (nextFilters.longitude) queryParams.append('longitude', nextFilters.longitude.toString());
      if (nextFilters.radius) queryParams.append('radius', nextFilters.radius.toString());
      if (nextFilters.sortBy) queryParams.append('sortBy', nextFilters.sortBy);
      queryParams.append('page', (currentPage + 1).toString());
      if (nextFilters.limit) queryParams.append('limit', nextFilters.limit.toString());

      const response = await fetch(`/api/search?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error('Error al cargar más eventos');
      }

      const data: SearchResponse = await response.json();
      setResults((prev) => [...prev, ...data.results]);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setCurrentPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [currentFilters, currentPage]);

  return {
    results,
    loading,
    error,
    total,
    hasMore,
    page: currentPage,
    search,
    loadMore,
    clear: () => setResults([]),
  };
}

export function useRecentSearches() {
  const { user } = useAuth();
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadSearches = async () => {
      try {
        const response = await fetch('/api/search/recent');

        if (!response.ok) {
          throw new Error('Error al cargar búsquedas recientes');
        }

        const data = await response.json();
        setSearches(data);
      } catch (error) {
        console.error('Error loading recent searches:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSearches();
  }, [user]);

  return { searches, loading };
}

export function useLocationPreference() {
  const { user } = useAuth();
  const [preference, setPreference] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadPreference = async () => {
      try {
        const response = await fetch('/api/search/location');

        if (!response.ok && response.status !== 404) {
          throw new Error('Error al cargar preferencia de ubicación');
        }

        const data = await response.json();
        setPreference(data);
      } catch (error) {
        console.error('Error loading location preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, [user]);

  const updatePreference = useCallback(
    async (latitude: number, longitude: number, radius: number = 50, cities: string[] = []) => {
      try {
        const response = await fetch('/api/search/location', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude,
            longitude,
            searchRadius: radius,
            preferredCities: cities,
          }),
        });

        if (!response.ok) {
          throw new Error('Error al actualizar preferencia');
        }

        const data = await response.json();
        setPreference(data);
        return data;
      } catch (error) {
        console.error('Error updating location preference:', error);
        throw error;
      }
    },
    []
  );

  return { preference, loading, updatePreference };
}
