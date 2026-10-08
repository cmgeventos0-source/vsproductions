export interface SearchFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: string; // ISO date
  endDate?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // km
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'date_asc' | 'trending' | 'newest';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  categoryName: string;
  city: string;
  price: number;
  date: string;
  distance?: number; // km si búsqueda geográfica
  popularity?: number; // 0-100
  matchScore?: number; // relevancia de búsqueda
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface LocationPreference {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  searchRadius: number;
  preferredCities: string[];
  updatedAt: string;
}

export interface RecentSearch {
  id: string;
  searchQuery: string;
  filters: SearchFilters;
  resultsCount: number;
  createdAt: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number; // metros
}

export interface SearchStats {
  totalSearches: number;
  averageResultsPerSearch: number;
  mostSearchedCategories: Array<{ name: string; count: number }>;
  mostSearchedCities: Array<{ name: string; count: number }>;
  averageSearchRadius: number;
}
