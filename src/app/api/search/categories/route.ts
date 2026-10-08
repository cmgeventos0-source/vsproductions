import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/lib/services/searchService';

export async function GET(request: NextRequest) {
  try {
    const categories = await SearchService.getCategoriesWithCounts();

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    return NextResponse.json(
      { error: 'Error al obtener categorías' },
      { status: 500 }
    );
  }
}
