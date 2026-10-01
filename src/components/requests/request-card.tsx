import Link from 'next/link';
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DUE_STATE_META, PRIORITY_META } from '@/lib/constants';
import { formatDate, daysUntil } from '@/lib/utils';
import type { RequestListItem } from '@/lib/queries/requests';

/**
 * Compact request card used in card view, search results and the dashboard.
 * The whole card is a link target with a visible focus ring.
 */
export function RequestCard({
  request,
  index = 0,
  compact = false,
}: {
  request: RequestListItem;
  index?: number;
  compact?: boolean;
}) {
  const days = daysUntil(request.due_date);
  const dueMeta = DUE_STATE_META[request.due_state] ?? DUE_STATE_META.on_track;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
    >
      <Card className="group h-full transition-shadow hover:shadow-md">
        <Link
          href={`/requests/${request.id}`}
          className="block h-full rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-muted-foreground">
                {request.request_code ?? '—'}
              </p>
              <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                {request.title}
              </h3>
            </div>
            <StatusBadge
              tone={PRIORITY_META[request.priority].badge}
              label={PRIORITY_META[request.priority].label}
              dot={false}
            />
          </div>

          {!compact && (request.goal?.name || request.promo_type?.name) && (
            <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
              {request.goal?.name}
              {request.goal?.name && request.promo_type?.name ? ' · ' : ''}
              {request.promo_type?.name}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusBadge tone={dueMeta.badge} label={dueMeta.label} />
            <StatusBadge tone={stageTone(request.stage?.color)} label={request.stage_name} />
          </div>

          {!compact && (
            <dl className="mt-3 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <dt className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden />
                  Due
                </dt>
                <dd className="font-medium text-foreground">
                  {formatDate(request.due_date)}
                  {days !== null && days >= 0 && days <= 3 && !request.is_completed && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">
                      ({days === 0 ? 'today' : `${days}d`})
                    </span>
                  )}
                </dd>
              </div>

              {request.channel && (
                <div className="flex items-center justify-between gap-2">
                  <dt>Channel</dt>
                  <dd className="truncate font-medium text-foreground">{request.channel.name}</dd>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <dt className="inline-flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  Shifts
                </dt>
                <dd className="font-medium tabular-nums text-foreground">{request.shift_count}</dd>
              </div>

              <div className="flex items-center justify-between gap-2">
                <dt className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden />
                  Assigned
                </dt>
                <dd className="truncate font-medium text-foreground">
                  {request.assigned_to?.full_name ?? 'Unassigned'}
                </dd>
              </div>

              {request.location && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="inline-flex items-center gap-1">
                    <MapPin className="size-3" aria-hidden />
                    Location
                  </dt>
                  <dd className="truncate font-medium text-foreground">{request.location}</dd>
                </div>
              )}
            </dl>
          )}
        </Link>
      </Card>
    </motion.div>
  );
}

function stageTone(color?: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
    violet: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300',
    indigo: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300',
    cyan: 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
    orange: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300',
    lime: 'bg-lime-50 text-lime-700 ring-1 ring-inset ring-lime-200 dark:bg-lime-950/40 dark:text-lime-300',
    emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
    brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300',
  };
  return map[color ?? 'slate'] ?? 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300';
}