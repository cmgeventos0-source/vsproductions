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

    const stats = await ReferralService.getReferralStats(user.id);

    return NextResponse.json(stats || {});
  } catch (error) {
    console.error('Error getting referral stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode, orderId, referredUserId } = body;

    if (!referralCode || !orderId) {
      return NextResponse.json(
        { error: 'referralCode y orderId son requeridos' },
        { status: 400 }
      );
    }

    const result = await ReferralService.applyReferralCode(
      referralCode,
      orderId,
      referredUserId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error applying referral code:', error);
    return NextResponse.json(
      { error: error.message || 'Error al aplicar código referral' },
      { status: 400 }
    );
  }
}
