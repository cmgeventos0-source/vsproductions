import { NextRequest, NextResponse } from 'next/server';
import { SearchService } from '@/lib/services/searchService';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Se requiere autenticación' },
        { status: 401 }
      );
    }

    const searches = await SearchService.getRecentSearches(user.id);

    return NextResponse.json(searches);
  } catch (error) {
    console.error('Error getting recent searches:', error);
    return NextResponse.json(
      { error: 'Error al obtener búsquedas recientes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const { filters, resultsCount } = body;

    if (!filters) {
      return NextResponse.json(
        { error: 'filters es requerido' },
        { status: 400 }
      );
    }

    const search = await SearchService.saveRecentSearch(
      filters,
      resultsCount || 0,
      user?.id
    );

    return NextResponse.json(search);
  } catch (error) {
    console.error('Error saving search:', error);
    return NextResponse.json(
      { error: 'Error al guardar búsqueda' },
      { status: 500 }
    );
  }
}
