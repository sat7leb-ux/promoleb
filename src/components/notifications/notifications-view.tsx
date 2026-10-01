'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  FolderKanban,
  Layers,
  MessageSquare,
  Radio,
  Target,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import { markNotificationsReadAction } from '@/lib/auth/actions';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import type { Notification } from '@/types/database';

type Icon = React.ComponentType<{ className?: string }>;

type Meta = { icon: Icon; tone: string; label: string };

const NEUTRAL: Meta = {
  icon: Radio,
  tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  label: 'Update',
};

/** Icon and tone per notification type, so the feed reads at a glance. */
const TYPE_META: Record<string, Meta> = {
  assigned: {
    icon: UserPlus,
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-200',
    label: 'Assigned to you',
  },
  participant_added: {
    icon: UserPlus,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
    label: 'Participant',
  },
  status_changed: {
    icon: Layers,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200',
    label: 'Status change',
  },
  deadline_approaching: {
    icon: CalendarClock,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    label: 'Deadline soon',
  },
  overdue: {
    icon: CalendarClock,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
    label: 'Overdue',
  },
  project_assigned: {
    icon: FolderKanban,
    tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200',
    label: 'Project',
  },
  note_added: {
    icon: MessageSquare,
    tone: NEUTRAL.tone,
    label: 'Note',
  },
  mention: {
    icon: Target,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
    label: 'Mention',
  },
};

type Filter = 'all' | 'unread' | 'assigned' | 'overdue';

export function NotificationsView({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState(false);

  const counts = useMemo(() => {
    const isAssigned = (n: Notification) =>
      n.type === 'assigned' || n.type === 'participant_added';
    return {
      total: notifications.length,
      unread: notifications.filter((n) => !n.read_at).length,
      assigned: notifications.filter(isAssigned).length,
      overdue: notifications.filter((n) => n.type === 'overdue').length,
    };
  }, [notifications]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'unread':
        return notifications.filter((n) => !n.read_at);
      case 'assigned':
        return notifications.filter(
          (n) => n.type === 'assigned' || n.type === 'participant_added',
        );
      case 'overdue':
        return notifications.filter((n) => n.type === 'overdue');
      default:
        return notifications;
    }
  }, [notifications, filter]);

  async function markAllRead() {
    setPending(true);
    const result = await markNotificationsReadAction();
    setPending(false);

    if (result.ok) {
      toast.success('All notifications marked as read.');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const FILTERS: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'unread', label: 'Unread', count: counts.unread },
    { key: 'assigned', label: 'Assigned to me', count: counts.assigned },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description={
          counts.unread > 0
            ? `${counts.unread} unread notification${counts.unread === 1 ? '' : 's'}.`
            : 'You are all caught up.'
        }
        actions={
          counts.unread > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead} isLoading={pending}>
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter notifications">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {f.label}
            {f.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] tabular-nums',
                  filter === f.key ? 'bg-white/20' : 'bg-muted',
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-6" />}
          title={notifications.length === 0 ? 'No notifications yet' : 'Nothing in this filter'}
          description={
            notifications.length === 0
              ? 'You will be notified when a request is assigned to you, when a request you work on changes status, and when a deadline approaches.'
              : 'Try a different filter, or mark everything as read.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((notification, index) => {
            const meta = TYPE_META[notification.type] ?? NEUTRAL;
            const IconGlyph = meta.icon;
            const isUnread = !notification.read_at;

            const body = (
              <>
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    meta.tone,
                  )}
                >
                  <IconGlyph className="size-4" aria-hidden />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{notification.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {meta.label}
                    </Badge>
                    {isUnread && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                    )}
                  </span>

                  {notification.body && (
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {notification.body}
                    </span>
                  )}

                  <span className="mt-1 block text-xs text-muted-foreground">
                    <time dateTime={notification.created_at} title={formatDateTime(notification.created_at)}>
                      {formatRelative(notification.created_at)}
                    </time>
                  </span>
                </span>
              </>
            );

            const className = cn(
              'flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors',
              'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isUnread && 'border-primary/30 bg-primary/[0.03]',
            );

            return (
              <motion.li
                key={notification.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.2) }}
              >
                {notification.link ? (
                  <Link href={notification.link} className={className}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}

      <Separator />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bell className="size-3.5" aria-hidden />
        Notifications are generated automatically. Deadline reminders come from a scheduled
        sweep that is idempotent, so running it more often is safe.
      </p>
    </div>
  );
}