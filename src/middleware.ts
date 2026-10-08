import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/mis-boletas",
  "/favoritos",
  "/referral",
];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAuthentication =
    pathname.startsWith("/admin") || isProtectedRoute(pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
            Object.entries(headers).forEach(([name, value]) =>
              supabaseResponse.headers.set(name, value)
            );
          },
        },
      }
    );

    // Refresh and validate the session before Server Components render.
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (requiresAuthentication) {
      if (!userId) {
        const url = new URL("/login", request.url);
        url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith("/admin")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        return NextResponse.redirect(new URL("/acceso-denegado", request.url));
      }
    }
  } catch (err) {
    console.error("[middleware] unexpected error:", err);
    // Never allow protected content through when validation is unavailable.
    if (requiresAuthentication) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
