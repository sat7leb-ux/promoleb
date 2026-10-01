import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Refreshes the auth session on every matched request and, crucially, routes
 * unauthenticated users away from the app and keeps signed-in users out of the
 * auth screens.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token with Supabase Auth rather than
  // trusting the cookie contents. Do not substitute getSession() here.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/update-password';

  // Public routes that must stay reachable while signed out.
  const isPublicRoute = pathname.startsWith('/auth/confirm') || pathname === '/setup';

  if (error || !user) {
    if (!isAuthRoute && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Signed in and sitting on an auth screen -> go to the app.
  if (isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}