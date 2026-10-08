import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/lib/services/searchService';
import { SearchFilters } from '@/types/search';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters: SearchFilters = {
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      city: searchParams.get('city') || undefined,
      latitude: searchParams.get('latitude') ? parseFloat(searchParams.get('latitude')!) : undefined,
      longitude: searchParams.get('longitude') ? parseFloat(searchParams.get('longitude')!) : undefined,
      radius: searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : 50,
      sortBy: (searchParams.get('sortBy') as any) || 'relevance',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    };

    const results = await SearchService.searchEvents(filters);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching events:', error);
    return NextResponse.json(
      { error: 'Error al buscar eventos' },
      { status: 500 }
    );
  }
}
