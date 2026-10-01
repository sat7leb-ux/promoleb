import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getNotifications, getUnreadNotificationCount } from '@/lib/queries/details';
import { AppTopbar } from '@/components/app-topbar';
import { AppShell } from '@/components/shell-shell';

/**
 * Authenticated app shell.
 *
 * The session is resolved once here and passed down, so no child re-queries the
 * profile. Route protection lives in middleware; this layout also verifies the
 * account is still active, so a deactivated user is signed out rather than
 * left browsing with stale permissions.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();

  if (session.profile.status !== 'active') {
    redirect('/login?reason=inactive');
  }

  const permission = permissionsFor(session.role);

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(session.profile.id, 20),
    getUnreadNotificationCount(session.profile.id),
  ]);

  return (
    <AppShell
      permission={permission}
      unreadNotifications={unreadCount}
      topbar={
        <Suspense fallback={<div className="h-14 border-b bg-background" />}>
          <AppTopbar
            profile={session.profile}
            notifications={notifications}
            unreadCount={unreadCount}
          />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}