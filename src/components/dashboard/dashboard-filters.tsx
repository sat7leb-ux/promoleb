'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { isoDateOffset, todayIso } from '@/lib/utils';
import { PRIORITY_ORDER, PRIORITY_META } from '@/lib/constants';
import type { DashboardFilters } from '@/lib/queries/dashboard';
import type { Permission } from '@/lib/auth/permissions';
import type { Channel, PipelineStage, Profile, Program, Project, PromoGoal } from '@/types/database';

interface Props {
  references: {
    channels: Channel[];
    programs: Program[];
    stages: PipelineStage[];
    goals: PromoGoal[];
    projects: Project[];
    profiles: Profile[];
  };
  permission: Permission;
  scope: 'all' | 'me';
  filters: DashboardFilters;
}

const RANGE_PRESETS = [
  { label: 'Last 30 days', from: () => isoDateOffset(-30), to: () => todayIso() },
  { label: 'Last 90 days', from: () => isoDateOffset(-90), to: () => todayIso() },
  { label: 'This year', from: () => `${todayIso().slice(0, 4)}-01-01`, to: () => todayIso() },
  { label: 'All time', from: () => '', to: () => '' },
];

/**
 * Dashboard filters.
 *
 * State lives entirely in the URL: the server component re-queries on every
 * change, so KPI figures can never drift out of step with what is displayed.
 */
export function DashboardFilters({ references, permission, scope, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === '' || value === '__all__') params.delete(key);
      else params.set(key, value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const activeCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.channelIds?.length,
    filters.programIds?.length,
    filters.projectIds?.length,
    filters.assigneeIds?.length,
    filters.stageIds?.length,
    filters.goalIds?.length,
    filters.priorities?.length,
  ].filter(Boolean).length;

  const currentRange =
    RANGE_PRESETS.find(
      (p) => filters.dateFrom === (p.from() || undefined) && filters.dateTo === (p.to() || undefined),
    )?.label ?? 'Custom range';

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Button
          variant={expanded ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <Filter className="size-4" />
          Filters
          {activeCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 min-w-5 justify-center px-1.5 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>

        <Select
          value={scope}
          onValueChange={(v) => update('scope', v === 'all' ? null : v)}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Whole department</SelectItem>
            <SelectItem value="me">My requests only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={
            RANGE_PRESETS.find((p) => p.label === currentRange)?.label ?? '__custom__'
          }
          onValueChange={(v) => {
            const preset = RANGE_PRESETS.find((p) => p.label === v);
            if (!preset) return;
            const params = new URLSearchParams(searchParams.toString());
            const from = preset.from();
            const to = preset.to();
            if (from) params.set('from', from);
            else params.delete('from');
            if (to) params.set('to', to);
            else params.delete('to');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_PRESETS.map((p) => (
              <SelectItem key={p.label} value={p.label}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.replace(pathname, { scroll: false })
            }
            className="text-muted-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {expanded && (
        <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-from" className="text-xs">
              From date
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={filters.dateFrom ?? ''}
              max={filters.dateTo ?? undefined}
              onChange={(e) => update('from', e.target.value || null)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-to" className="text-xs">
              To date
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={filters.dateTo ?? ''}
              min={filters.dateFrom ?? undefined}
              onChange={(e) => update('to', e.target.value || null)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-datefield" className="text-xs">
              Date applies to
            </Label>
            <Select
              value={filters.dateField ?? 'request_date'}
              onValueChange={(v) => update('dateField', v === 'request_date' ? null : v)}
            >
              <SelectTrigger id="filter-datefield" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="request_date">Request date</SelectItem>
                <SelectItem value="due_date">Due date</SelectItem>
                <SelectItem value="created_at">Created date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-channel" className="text-xs">
              Channel
            </Label>
            <Select
              value={filters.channelIds?.[0] ?? '__all__'}
              onValueChange={(v) => update('channel', v)}
            >
              <SelectTrigger id="filter-channel" className="h-8 text-xs">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All channels</SelectItem>
                {references.channels
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-program" className="text-xs">
              Program
            </Label>
            <Select
              value={filters.programIds?.[0] ?? '__all__'}
              onValueChange={(v) => update('program', v)}
            >
              <SelectTrigger id="filter-program" className="h-8 text-xs">
                <SelectValue placeholder="All programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All programs</SelectItem>
                {references.programs
                  .filter((p) => p.status === 'active')
                  .slice(0, 200)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-project" className="text-xs">
              Project
            </Label>
            <Select
              value={filters.projectIds?.[0] ?? '__all__'}
              onValueChange={(v) => update('project', v)}
            >
              <SelectTrigger id="filter-project" className="h-8 text-xs">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All projects</SelectItem>
                {references.projects
                  .filter((p) => p.status === 'active')
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code ? `${p.code} · ${p.name}` : p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-stage" className="text-xs">
              Status
            </Label>
            <Select
              value={filters.stageIds?.[0] ?? '__all__'}
              onValueChange={(v) => update('stage', v)}
            >
              <SelectTrigger id="filter-stage" className="h-8 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                {references.stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {permission.canViewUsers && (
            <div className="space-y-1.5">
              <Label htmlFor="filter-user" className="text-xs">
                Assigned to
              </Label>
              <Select
                value={filters.assigneeIds?.[0] ?? '__all__'}
                onValueChange={(v) => update('user', v)}
              >
                <SelectTrigger id="filter-user" className="h-8 text-xs">
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Anyone</SelectItem>
                  {references.profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label className="text-xs">Priority</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_ORDER.map((p) => {
                const active = filters.priorities?.includes(p) ?? false;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const current = filters.priorities ?? [];
                      const next = active
                        ? current.filter((x) => x !== p)
                        : [...current, p];
                      update('priority', next.length ? next.join(',') : null);
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? PRIORITY_META[p].badge + ' ring-2 ring-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}