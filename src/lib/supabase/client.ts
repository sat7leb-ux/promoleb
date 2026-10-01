'use client';

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Browser Supabase client.
 *
 * Only ever called from client components. RLS is enforced by Postgres, so this
 * client holds no privileges of its own: the anon key is safe in the browser
 * precisely because the policies do the real work.
 *
 * The SDK import is aliased because a same-named local export would shadow it
 * and make this function call itself.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and fill in your project URL and anon key.',
    );
  }

  return createSupabaseBrowserClient<Database>(url, anonKey);
}