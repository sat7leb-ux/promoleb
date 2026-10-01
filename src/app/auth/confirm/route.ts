import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/** Shape the SSR client uses to hand us refreshed session cookies. */
type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<typeof NextResponse.prototype.cookies.set>[2];
};

/**
 * PKCE / magic-link email confirmation handler.
 *
 * Supabase redirects here after the user follows an email link. The session
 * cookies are set on the outgoing response so the SSR client picks them up on
 * the next navigation, then the user is sent into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Only allow internal redirect targets, to avoid an open redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  // Build the destination first so the SSR client can write session cookies
  // directly onto the response we actually return.
  const response = NextResponse.redirect(`${origin}${safeNext}`);
  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // Write the session onto the redirect response, not a throwaway one.
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth] code exchange failed:', error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('That sign-in link is no longer valid.')}`,
    );
  }

  return response;
}