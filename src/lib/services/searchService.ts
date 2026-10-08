import { createClient } from '@supabase/supabase-js';
import {
  SearchFilters,
  SearchResponse,
  SearchResult,
  LocationPreference,
  RecentSearch,
} from '@/types/search';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
  return createClient(url, key);
}

export class SearchService {
  /**
   * Busca eventos con filtros avanzados
   */
  static async searchEvents(filters: SearchFilters): Promise<SearchResponse> {
    const {
      query = '',
      category,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      city,
      latitude,
      longitude,
      radius = 50,
      sortBy = 'relevance',
      page = 1,
      limit = 20,
    } = filters;

    const offset = (page - 1) * limit;
    const supabase = getSupabase();
    let queryBuilder = supabase
      .from('events')
      .select(
        `
        id, name, description, image_url, category_id, city,
        categories(id, category_name),
        functions(event_date, event_time)
      `,
        { count: 'exact' }
      )
      .eq('published', true);

    // Búsqueda full-text
    if (query.trim()) {
      const searchTerms = query
        .trim()
        .split(' ')
        .map((t) => `${t}:*`)
        .join(' & ');

      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,description.ilike.%${query}%,city.ilike.%${query}%`
      );
    }

    // Filtro de categoría
    if (category) {
      queryBuilder = queryBuilder.eq('category_id', category);
    }

    // Filtro de ciudad
    if (city) {
      queryBuilder = queryBuilder.ilike('city', `%${city}%`);
    }

    // Filtro de rango de fechas
    if (startDate) {
      queryBuilder = queryBuilder.gte('functions.event_date', startDate);
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte('functions.event_date', endDate);
    }

    // Ordenamiento
    switch (sortBy) {
      case 'price_asc':
        queryBuilder = queryBuilder.order('price', { ascending: true });
        break;
      case 'price_desc':
        queryBuilder = queryBuilder.order('price', { ascending: false });
        break;
      case 'date_asc':
        queryBuilder = queryBuilder.order('functions.event_date', { ascending: true });
        break;
      case 'trending':
        queryBuilder = queryBuilder.order('popularity', { ascending: false });
        break;
      case 'newest':
        queryBuilder = queryBuilder.order('created_at', { ascending: false });
        break;
      default:
        // 'relevance' - ya ordenado por la búsqueda
        break;
    }

    // Paginación
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) throw error;

    // Procesar resultados
    const results = (data || []).map((event: any): SearchResult | null => {
      let distance: number | undefined;

      // Calcular distancia si se proporciona ubicación
      if (latitude && longitude && event.latitude && event.longitude) {
        distance = this.calculateDistance(
          latitude,
          longitude,
          event.latitude,
          event.longitude
        );

        // Filtrar por radio
        if (distance > radius) {
          return null;
        }
      }

      return {
        id: event.id,
        name: event.name,
        description: event.description,
        imageUrl: event.image_url,
        categoryId: event.category_id,
        categoryName: event.categories?.category_name,
        city: event.city,
        price: event.price || 0,
        date: event.functions?.[0]?.event_date || '',
        distance,
      };
    }).filter((item): item is SearchResult => item !== null);

    const total = count || 0;

    return {
      results,
      total,
      page,
      pageSize: limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Búsqueda por radio geográfico
   */
  static async searchByRadius(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    filters?: Partial<SearchFilters>
  ): Promise<SearchResponse> {
    return this.searchEvents({
      ...filters,
      latitude,
      longitude,
      radius: radiusKm,
    });
  }

  /**
   * Obtiene ciudades populares
   */
  static async getPopularCities(): Promise<string[]> {
    const { data, error } = await getSupabase()
      .from('events')
      .select('city')
      .eq('published', true)
      .order('popularity', { ascending: false })
      .limit(20);

    if (error) throw error;

    const cities = [...new Set((data || []).map((e: any) => e.city))];
    return cities;
  }

  /**
   * Obtiene categorías con conteo
   */
  static async getCategoriesWithCounts() {
    const { data, error } = await getSupabase()
      .from('categories')
      .select(
        `
        id, category_name,
        events(id)
      `
      )
      .eq('events.published', true);

    if (error) throw error;

    return (data || []).map((cat: any) => ({
      id: cat.id,
      name: cat.category_name,
      count: cat.events?.length || 0,
    }));
  }

  /**
   * Guarda una búsqueda reciente
   */
  static async saveRecentSearch(
    filters: SearchFilters,
    resultsCount: number,
    userId?: string,
    sessionId?: string
  ): Promise<RecentSearch> {
    const { data, error } = await getSupabase()
      .from('recent_searches')
      .insert({
        user_id: userId || null,
        session_id: sessionId || null,
        search_query: filters.query || '',
        filters,
        results_count: resultsCount,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      searchQuery: data.search_query,
      filters: data.filters,
      resultsCount: data.results_count,
      createdAt: data.created_at,
    };
  }

  /**
   * Obtiene búsquedas recientes del usuario
   */
  static async getRecentSearches(userId: string, limit: number = 10): Promise<RecentSearch[]> {
    const { data, error } = await getSupabase()
      .from('recent_searches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((search: any) => ({
      id: search.id,
      searchQuery: search.search_query,
      filters: search.filters,
      resultsCount: search.results_count,
      createdAt: search.created_at,
    }));
  }

  /**
   * Obtiene o crea preferencia de ubicación del usuario
   */
  static async getUserLocationPreference(userId: string): Promise<LocationPreference | null> {
    const { data, error } = await getSupabase()
      .from('user_location_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      latitude: data.latitude,
      longitude: data.longitude,
      searchRadius: data.search_radius,
      preferredCities: data.preferred_cities || [],
      updatedAt: data.updated_at,
    };
  }

  /**
   * Actualiza preferencia de ubicación
   */
  static async updateLocationPreference(
    userId: string,
    latitude: number,
    longitude: number,
    searchRadius: number = 50,
    preferredCities: string[] = []
  ): Promise<LocationPreference> {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('user_location_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    let data, error;

    if (existing) {
      ({ data, error } = await supabase
        .from('user_location_preferences')
        .update({
          latitude,
          longitude,
          search_radius: searchRadius,
          preferred_cities: preferredCities,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('user_location_preferences')
        .insert({
          user_id: userId,
          latitude,
          longitude,
          search_radius: searchRadius,
          preferred_cities: preferredCities,
        })
        .select()
        .single());
    }

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      latitude: data.latitude,
      longitude: data.longitude,
      searchRadius: data.search_radius,
      preferredCities: data.preferred_cities || [],
      updatedAt: data.updated_at,
    };
  }

  /**
   * Calcula distancia entre dos puntos (Haversine formula)
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Obtiene estadísticas de búsqueda
   */
  static async getSearchStats(userId: string) {
    const { data: searches, error } = await getSupabase()
      .from('recent_searches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const totalSearches = searches?.length || 0;
    const averageResults =
      searches && searches.length > 0
        ? searches.reduce((sum: number, s: any) => sum + (s.results_count || 0), 0) / searches.length
        : 0;

    const categories: Record<string, number> = {};
    const cities: Record<string, number> = {};
    let totalRadius = 0;
    let radiusCount = 0;

    searches?.forEach((search: any) => {
      if (search.filters?.category) {
        categories[search.filters.category] = (categories[search.filters.category] || 0) + 1;
      }
      if (search.filters?.city) {
        cities[search.filters.city] = (cities[search.filters.city] || 0) + 1;
      }
      if (search.filters?.radius) {
        totalRadius += search.filters.radius;
        radiusCount++;
      }
    });

    return {
      totalSearches,
      averageResultsPerSearch: Math.round(averageResults),
      mostSearchedCategories: Object.entries(categories)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      mostSearchedCities: Object.entries(cities)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      averageSearchRadius: radiusCount > 0 ? Math.round(totalRadius / radiusCount) : 0,
    };
  }
}
