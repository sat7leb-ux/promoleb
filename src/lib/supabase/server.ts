import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env, assertServerOnly } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Supabase client bound to the current user's session.
 *
 * Auth is carried in cookies so that Server Components, Route Handlers and
 * Server Actions all share one session. Never cache the result across a
 * request boundary - always call this fresh.
 */
export async function createClient() {
  assertServerOnly();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. This is expected: the
          // middleware (src/middleware.ts) refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Supabase client using the service-role key, bypassing RLS.
 *
 * Use ONLY for privileged server-side work where RLS would correctly block us:
 * creating users, admin password resets, and aggregate reporting queries.
 * The returned object must never cross a client boundary.
 */
export async function createAdminClient() {
  assertServerOnly();
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}