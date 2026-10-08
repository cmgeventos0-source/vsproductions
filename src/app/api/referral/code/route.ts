import { NextRequest, NextResponse } from 'next/server';
import { ReferralService } from '@/lib/services/favoritesService';
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

    const referralCode = await ReferralService.getUserReferralCode(user.id);

    if (!referralCode) {
      // Generar uno nuevo
      const newCode = await ReferralService.generateReferralCode(user.id);
      return NextResponse.json(newCode);
    }

    return NextResponse.json(referralCode);
  } catch (error) {
    console.error('Error getting referral code:', error);
    return NextResponse.json(
      { error: 'Error al obtener código referral' },
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

    if (!user) {
      return NextResponse.json(
        { error: 'Se requiere autenticación' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { discountPercentage = 5 } = body;

    const referralCode = await ReferralService.generateReferralCode(
      user.id,
      discountPercentage
    );

    return NextResponse.json(referralCode);
  } catch (error) {
    console.error('Error generating referral code:', error);
    return NextResponse.json(
      { error: 'Error al generar código referral' },
      { status: 500 }
    );
  }
}
