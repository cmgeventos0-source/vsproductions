'use client';

import { useCallback, useState, useEffect } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { SearchFilters } from '@/types/search';
import { Search, MapPin, Filter, X } from 'lucide-react';

interface SearchBarProps {
  onSearch?: (filters: SearchFilters) => void;
  showFilters?: boolean;
}

export function SearchBar({ onSearch, showFilters = true }: SearchBarProps) {
  const { search } = useSearch();
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    // Cargar ciudades y categorías
    const loadFilterData = async () => {
      try {
        const [citiesRes, categoriesRes] = await Promise.all([
          fetch('/api/search/cities'),
          fetch('/api/search/categories'),
        ]);

        if (citiesRes.ok) {
          const citiesData = await citiesRes.json();
          setCities(citiesData);
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
      }
    };

    loadFilterData();
  }, []);

  const [filters, setFilters] = useState<SearchFilters>({});

  const handleSearch = useCallback(() => {
    const searchFilters: SearchFilters = {
      query,
      ...filters,
    };

    search(searchFilters);
    onSearch?.(searchFilters);
  }, [query, filters, search, onSearch]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Barra de búsqueda principal */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Busca eventos, conciertos, deportes..."
          className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />

        <button
          onClick={handleSearch}
          className="absolute right-2 top-2.5 px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm"
        >
          Buscar
        </button>
      </div>

      {/* Botón de filtros avanzados */}
      {showFilters && (
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
        >
          <Filter className="w-4 h-4" />
          Filtros avanzados
        </button>
      )}

      {/* Panel de filtros avanzados */}
      {showAdvanced && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
          {/* Ciudad */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Ciudad</label>
            <select
              value={filters.city || ''}
              onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Todas las ciudades</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Categoría</label>
            <select
              value={filters.category || ''}
              onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          {/* Rango de precios */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Precio mínimo</label>
              <input
                type="number"
                value={filters.minPrice || ''}
                onChange={(e) =>
                  setFilters({ ...filters, minPrice: e.target.value ? parseInt(e.target.value) : undefined })
                }
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Precio máximo</label>
              <input
                type="number"
                value={filters.maxPrice || ''}
                onChange={(e) =>
                  setFilters({ ...filters, maxPrice: e.target.value ? parseInt(e.target.value) : undefined })
                }
                placeholder="999999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Desde</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Hasta</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Ordenamiento */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Ordenar por</label>
            <select
              value={filters.sortBy || 'relevance'}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="relevance">Relevancia</option>
              <option value="price_asc">Precio (menor a mayor)</option>
              <option value="price_desc">Precio (mayor a menor)</option>
              <option value="date_asc">Fecha (próximos)</option>
              <option value="trending">Tendencias</option>
              <option value="newest">Más recientes</option>
            </select>
          </div>

          {/* Radio geográfico */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Radio de búsqueda: {filters.radius || 50} km
            </label>
            <input
              type="range"
              min="1"
              max="200"
              value={filters.radius || 50}
              onChange={(e) => setFilters({ ...filters, radius: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Aplicar filtros
            </button>
            <button
              onClick={() => {
                setFilters({});
                setQuery('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
