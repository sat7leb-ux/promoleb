import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { getNotifications } from '@/lib/queries/details';
import { NotificationsView } from '@/components/notifications/notifications-view';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const session = await requireUser();

  // A generous limit: the header bell and this page read the same list, so a
  // user who ignores the bell still sees the full history here.
  const notifications = await getNotifications(session.profile.id, 200);

  return <NotificationsView notifications={notifications} />;
}