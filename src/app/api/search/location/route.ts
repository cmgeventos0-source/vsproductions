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

    const preference = await SearchService.getUserLocationPreference(user.id);

    return NextResponse.json(preference);
  } catch (error) {
    console.error('Error getting location preference:', error);
    return NextResponse.json(
      { error: 'Error al obtener preferencia de ubicación' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { latitude, longitude, searchRadius = 50, preferredCities = [] } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'latitude y longitude son requeridos' },
        { status: 400 }
      );
    }

    const preference = await SearchService.updateLocationPreference(
      user.id,
      latitude,
      longitude,
      searchRadius,
      preferredCities
    );

    return NextResponse.json(preference);
  } catch (error) {
    console.error('Error updating location preference:', error);
    return NextResponse.json(
      { error: 'Error al actualizar preferencia de ubicación' },
      { status: 500 }
    );
  }
}
