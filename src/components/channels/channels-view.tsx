'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Layers, Pencil, Plus, Radio, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChannelFormDialog } from './channel-form';
import { STATUS_META } from '@/lib/constants';
import { percentage, normalise, cn } from '@/lib/utils';
import type { ChannelStats } from '@/lib/queries/stats';
import type { Channel } from '@/types/database';

interface Props {
  channels: Channel[];
  stats: Record<string, ChannelStats>;
  canManage: boolean;
}

export function ChannelsView({ channels, stats, canManage }: Props) {
  const [term, setTerm] = useState('');
  const [editing, setEditing] = useState<Channel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const visible = useMemo(() => {
    const needle = normalise(term.trim());
    if (!needle) return channels;
    return channels.filter(
      (c) =>
        normalise(c.name).includes(needle) ||
        normalise(c.code ?? '').includes(needle) ||
        normalise(c.category ?? '').includes(needle),
    );
  }, [channels, term]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(channel: Channel) {
    setEditing(channel);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Channels"
        description="Every SAT-7 broadcast, digital and live outlet that promo requests can target."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/reports/channels">
                <BarChart3 className="size-4" />
                Channel report
              </Link>
            </Button>
            {canManage && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Add channel
              </Button>
            )}
          </>
        }
      />

      {channels.length > 8 && (
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search channels…"
            aria-label="Search channels"
            className="pl-9"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" />}
          title={channels.length === 0 ? 'No channels yet' : 'No channels match that search'}
          description={
            channels.length === 0
              ? 'Add the SAT-7 channels promo requests should be tracked against.'
              : 'Try a different name or code.'
          }
          action={
            channels.length === 0 && canManage ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add the first channel
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((channel) => {
            const s = stats[channel.id];
            const completion = s ? percentage(s.completedRequests, s.totalRequests) : 0;

            return (
              <article key={channel.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('size-2 shrink-0 rounded-full', COLOR_DOTS[channel.color] ?? 'bg-brand-500')}
                        aria-hidden
                      />
                      <h2 className="truncate text-sm font-semibold">{channel.name}</h2>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[channel.code, channel.category].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>

                  {channel.status !== 'active' && (
                    <StatusBadge
                      tone={STATUS_META[channel.status]?.badge ?? STATUS_META.active.badge}
                      label={STATUS_META[channel.status]?.label ?? channel.status}
                    />
                  )}
                </div>

                {channel.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {channel.description}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Requests
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {s?.totalRequests ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Shifts
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {s?.totalShifts ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Programs
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {s?.programCount ?? 0}
                    </dd>
                  </div>
                </dl>

                {s && s.totalRequests > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{completion}% completed</span>
                      {s.overdueRequests > 0 && (
                        <span className="font-medium text-destructive">
                          {s.overdueRequests} overdue
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={completion}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${channel.name} completion`}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(completion, 2)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <Button asChild variant="ghost" size="sm" className="flex-1">
                    <Link href={`/channels/${channel.id}`}>
                      <Radio className="size-3.5" />
                      Requests
                    </Link>
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(channel)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add a channel'}</DialogTitle>
            <DialogDescription>
              Channels group promo requests by outlet and drive the channel report.
            </DialogDescription>
          </DialogHeader>

          <ChannelFormDialog
            channel={editing}
            onOpenChange={setDialogOpen}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

const COLOR_DOTS: Record<string, string> = {
  brand: 'bg-brand-500',
  cyan: 'bg-cyan-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  lime: 'bg-lime-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  slate: 'bg-slate-400',
};