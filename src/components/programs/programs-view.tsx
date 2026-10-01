'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Radio, Search, Tv } from 'lucide-react';
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
import { ProgramFormDialog } from './program-form';
import { STATUS_META } from '@/lib/constants';
import { percentage, normalise } from '@/lib/utils';
import type { Channel, Profile, Program } from '@/types/database';

interface ProgramStats {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  inProgressRequests: number;
  overdueRequests: number;
  totalShifts: number;
  assigneeIds: string[];
}

interface Props {
  programs: Program[];
  channels: Channel[];
  profiles: Profile[];
  stats: Record<string, ProgramStats>;
  canManage: boolean;
}

export function ProgramsView({ programs, channels, profiles, stats, canManage }: Props) {
  const [term, setTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('__all__');
  const [editing, setEditing] = useState<Program | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const visible = useMemo(() => {
    const needle = normalise(term.trim());
    return programs.filter((p) => {
      if (channelFilter !== '__all__' && p.channel_id !== channelFilter) return false;
      if (!needle) return true;
      return normalise(p.name).includes(needle) || normalise(p.description ?? '').includes(needle);
    });
  }, [programs, term, channelFilter]);

  const channelName = (id: string | null) => channels.find((c) => c.id === id)?.name;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(program: Program) {
    setEditing(program);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Programs"
        description="Shows carried by SAT-7 channels, with the promo workload attached to each."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/reports/programs">Program report</Link>
            </Button>
            {canManage && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Add program
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search programs…"
            aria-label="Search programs"
            className="pl-9"
          />
        </div>

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          aria-label="Filter by channel"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm sm:w-[200px]"
        >
          <option value="__all__">All channels</option>
          {channels
            .filter((c) => c.status === 'active')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Tv className="size-6" />}
          title={programs.length === 0 ? 'No programs yet' : 'No programs match'}
          description={
            programs.length === 0
              ? 'Programs connect a channel to the shows it carries, and make promo requests reportable.'
              : 'Try a different search or channel.'
          }
          action={
            programs.length === 0 && canManage ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add the first program
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((program) => {
            const s = stats[program.id];
            const completion = s ? percentage(s.completedRequests, s.totalRequests) : 0;

            return (
              <article key={program.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">{program.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Radio className="size-3 shrink-0" aria-hidden />
                      {channelName(program.channel_id) ?? 'No channel'}
                    </p>
                  </div>
                  {program.status !== 'active' && (
                    <StatusBadge
                      tone={STATUS_META[program.status]?.badge ?? STATUS_META.active.badge}
                      label={STATUS_META[program.status]?.label ?? program.status}
                    />
                  )}
                </div>

                {program.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {program.description}
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
                      People
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {s?.assigneeIds.length ?? 0}
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
                      aria-label={`${program.name} completion`}
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
                    <Link href={`/programs/${program.id}`}>Open</Link>
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(program)}>
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
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add a program'}</DialogTitle>
            <DialogDescription>
              Programs belong to a channel and are the unit the program report groups by.
            </DialogDescription>
          </DialogHeader>

          <ProgramFormDialog
            program={editing}
            channels={channels}
            profiles={profiles}
            onOpenChange={setDialogOpen}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}