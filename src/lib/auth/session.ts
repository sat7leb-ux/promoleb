import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, Profile } from '@/types/database';

export interface SessionUser {
  profile: Profile;
  role: AppRole;
}

/**
 * Returns the signed-in user's profile, or null.
 *
 * `cache` de-duplicates this across a single server render pass, so a layout
 * and three nested components cost one query rather than four.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[auth] profile lookup failed:', profileError.message);
    return null;
  }

  // Self-heal: a user created before the profile trigger existed gets one now.
  if (!profile) {
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        full_name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.email ?? 'User').split('@')[0],
        role: 'viewer',
      })
      .select('*')
      .single();

    if (created) return { profile: created, role: created.role };
    return null;
  }

  return { profile, role: profile.role };
});

/**
 * Same as getCurrentUser but throws a redirect when signed out.
 * Use in Server Components that must always have a session.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Guards a page for a set of roles. Redirects rather than throwing so callers
 * do not need try/catch.
 */
export async function requireRole(allowed: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect('/dashboard?denied=1');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole(['administrator']);
}

export async function requireManager(): Promise<SessionUser> {
  return requireRole(['administrator', 'promo_manager']);
}