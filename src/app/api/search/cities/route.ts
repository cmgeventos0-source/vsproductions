import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/lib/services/searchService';

export async function GET(request: NextRequest) {
  try {
    const cities = await SearchService.getPopularCities();

    return NextResponse.json(cities);
  } catch (error) {
    console.error('Error getting popular cities:', error);
    return NextResponse.json(
      { error: 'Error al obtener ciudades populares' },
      { status: 500 }
    );
  }
}
