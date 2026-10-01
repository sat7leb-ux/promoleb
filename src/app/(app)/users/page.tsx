import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { UsersView } from '@/components/users/users-view';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const params = await searchParams;

  // Every authenticated user can browse the directory; only admins can change it.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');

  if (error) {
    console.error('[users] list query failed:', error.message);
  }

  return (
    <UsersView
      profiles={(data ?? []) as typeof data extends null ? never : NonNullable<typeof data>}
      canManage={permission.canManageUsers}
      currentUserId={session.profile.id}
      initialRole={typeof params.role === 'string' ? params.role : undefined}
    />
  );
}