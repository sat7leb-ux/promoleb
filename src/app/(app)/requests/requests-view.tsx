'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ClipboardList,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/filters/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RequestCard } from '@/components/requests/request-card';
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  DUE_STATE_META,
} from '@/lib/constants';
import { formatDate, cn } from '@/lib/utils';
import type { RequestListResult, RequestListItem, RequestFilters } from '@/lib/queries/requests';
import type { Permission } from '@/lib/auth/permissions';
import type { Channel, PipelineStage, Profile, Program, Project, PromoGoal } from '@/types/database';

interface Props {
  result: RequestListResult;
  references: {
    channels: Channel[];
    programs: Program[];
    stages: PipelineStage[];
    goals: PromoGoal[];
    projects: Project[];
    profiles: Profile[];
  };
  permission: Permission;
  currentUserId: string;
  filters?: RequestFilters;
  /**
   * `all` is the full list; `mine` is the personal view, which scopes wording
   * and the default empty state so the page explains itself properly.
   */
  variant?: 'all' | 'mine';
}

type ViewMode = 'table' | 'cards';

export function RequestsView({
  result,
  references,
  permission,
  currentUserId,
  variant = 'all',
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewMode: ViewMode = searchParams.get('view') === 'cards' ? 'cards' : 'table';

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === '' || value === '__all__') params.delete(key);
      else params.set(key, value);
      params.delete('page');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function sortBy(column: string) {
    const currentSort = searchParams.get('sort');
    const currentDir = searchParams.get('dir') ?? 'desc';
    const nextDir = currentSort === column && currentDir === 'desc' ? 'asc' : 'desc';
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', column);
    params.set('dir', nextDir);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const activeFilters = [
    searchParams.get('q') ? { key: 'q', label: `“${searchParams.get('q')}”` } : null,
    searchParams.get('stage')
      ? { key: 'stage', label: stageName(references.stages, searchParams.get('stage')!) }
      : null,
    searchParams.get('channel')
      ? { key: 'channel', label: nameOf(references.channels, searchParams.get('channel')!) }
      : null,
    searchParams.get('program')
      ? { key: 'program', label: nameOf(references.programs, searchParams.get('program')!) }
      : null,
    searchParams.get('project')
      ? { key: 'project', label: nameOf(references.projects, searchParams.get('project')!) }
      : null,
    searchParams.get('user')
      ? { key: 'user', label: userName(references.profiles, searchParams.get('user')!) }
      : null,
    searchParams.get('goal')
      ? { key: 'goal', label: goalName(references.goals, searchParams.get('goal')!) }
      : null,
    searchParams.get('priority')
      ? { key: 'priority', label: `Priority: ${searchParams.get('priority')}` }
      : null,
    searchParams.get('due')
      ? { key: 'due', label: `Due: ${searchParams.get('due')}` }
      : null,
    searchParams.get('status') === 'archived'
      ? { key: 'status', label: 'Archived' }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={variant === 'mine' ? 'My Requests' : 'Promo Requests'}
        description={
          result.total === 0
            ? variant === 'mine'
              ? 'Nothing is assigned to you right now.'
              : 'No requests to show.'
            : `${result.total} request${result.total === 1 ? '' : 's'}${variant === 'mine' ? ' assigned to you' : ''} · page ${result.page} of ${result.pageCount}`
        }
        actions={
          <>
            {variant === 'mine' && (
              <Button asChild variant="outline" size="sm">
                <Link href="/requests">All requests</Link>
              </Button>
            )}
            {permission.canCreateRequests && (
              <Button asChild size="sm">
                <Link href="/requests/new">
                  <Plus className="size-4" />
                  New request
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* --- toolbar --- */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput placeholder="Search title, code, notes…" className="flex-1" />

          <Select
            value={searchParams.get('channel') ?? '__all__'}
            onValueChange={(v) => update('channel', v)}
          >
            <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label="Filter by channel">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All channels</SelectItem>
              {references.channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={searchParams.get('stage') ?? '__all__'}
            onValueChange={(v) => update('stage', v)}
          >
            <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label="Filter by status">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <SlidersHorizontal className="size-4" />
                More filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Program</DropdownMenuLabel>
              {references.programs.slice(0, 12).map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => update('program', p.id)}>
                  {p.name}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              {PRIORITY_ORDER.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onSelect={() =>
                    update('priority', searchParams.get('priority') === p ? null : p)
                  }
                >
                  {PRIORITY_META[p].label}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Due state</DropdownMenuLabel>
              {(['overdue', 'due_soon', 'on_track'] as const).map((d) => (
                <DropdownMenuItem
                  key={d}
                  onSelect={() => update('due', searchParams.get('due') === d ? null : d)}
                >
                  {DUE_STATE_META[d].label}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => update('participating', null)}>
                Clear extra filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => update('view', null)}
              aria-pressed={viewMode === 'table'}
            >
              Table
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => update('view', 'cards')}
              aria-pressed={viewMode === 'cards'}
            >
              Cards
            </Button>
          </div>
        </div>

        <DateRangeRow />

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
            {activeFilters.map((f) => (
              <Badge key={f.key} variant="outline" className="gap-1 py-1">
                {f.label}
                <button
                  type="button"
                  onClick={() => update(f.key, null)}
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove filter ${f.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="h-6 text-xs text-muted-foreground"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* --- results --- */}
      {result.rows.length === 0 ? (
        <EmptyState
          icon={variant === 'mine' ? <ListChecks className="size-6" /> : <ClipboardList className="size-6" />}
          title={
            activeFilters.length > 0
              ? 'No requests match these filters'
              : variant === 'mine'
                ? 'No requests assigned to you'
                : 'No requests yet'
          }
          description={
            activeFilters.length > 0
              ? 'Try widening your search or clearing a filter.'
              : variant === 'mine'
                ? 'When a manager assigns you a promo request, or adds you as a participant, it will appear here.'
                : 'Create the first promo request to get started.'
          }
          action={
            activeFilters.length > 0 ? (
              <Button variant="outline" onClick={() => router.replace(pathname)}>
                Clear filters
              </Button>
            ) : variant === 'mine' ? undefined : permission.canCreateRequests ? (
              <Button asChild>
                <Link href="/requests/new">
                  <Plus className="size-4" />
                  New request
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {result.rows.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <RequestTable
          rows={result.rows}
          currentUserId={currentUserId}
          sort={searchParams.get('sort') ?? 'created_at'}
          dir={searchParams.get('dir') ?? 'desc'}
          onSort={sortBy}
        />
      )}

      {result.pageCount > 1 && (
        <Pagination page={result.page} pageCount={result.pageCount} total={result.total} />
      )}
    </div>
  );
}

/** Inline date range inputs, kept in the toolbar rather than a modal. */
function DateRangeRow() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setDate = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 border-t pt-3">
      <div className="space-y-1">
        <Label htmlFor="from" className="text-xs text-muted-foreground">
          Request date from
        </Label>
        <Input
          id="from"
          type="date"
          value={searchParams.get('from') ?? ''}
          onChange={(e) => setDate('from', e.target.value)}
          className="h-8 w-[150px] text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to" className="text-xs text-muted-foreground">
          to
        </Label>
        <Input
          id="to"
          type="date"
          value={searchParams.get('to') ?? ''}
          onChange={(e) => setDate('to', e.target.value)}
          className="h-8 w-[150px] text-xs"
        />
      </div>
      {searchParams.get('from') || searchParams.get('to') ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('from');
            params.delete('to');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }}
          className="h-8"
        >
          <X className="size-3.5" />
          Clear dates
        </Button>
      ) : null}
    </div>
  );
}

function RequestTable({
  rows,
  currentUserId,
  sort,
  dir,
  onSort,
}: {
  rows: RequestListItem[];
  currentUserId: string;
  sort: string;
  dir: string;
  onSort: (column: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Promo requests. Use the column headers to sort.
          </caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <SortHeader column="request_code" label="Ref" sort={sort} dir={dir} onSort={onSort} />
              <th className="h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Request
              </th>
              <SortHeader column="stage_position" label="Status" sort={sort} dir={dir} onSort={onSort} />
              <th className="h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Channel
              </th>
              <th className="h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Assigned
              </th>
              <SortHeader column="shift_count" label="Shifts" sort={sort} dir={dir} onSort={onSort} className="text-right" />
              <SortHeader column="due_date" label="Due" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader column="priority" label="Priority" sort={sort} dir={dir} onSort={onSort} />
              <th className="h-11 w-10 px-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {request.request_code ?? '—'}
                </td>
                <td className="max-w-[26rem] px-3 py-2.5">
                  <Link
                    href={`/requests/${request.id}`}
                    className="block truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {request.title}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {request.program && <span>{request.program.name}</span>}
                    {request.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden />
                        {request.location}
                      </span>
                    )}
                    {request.participant_count > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden />
                        {request.participant_count}
                      </span>
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusBadge tone={stageTone(request.stage?.color)} label={request.stage_name} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm">
                  {request.channel?.name ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm">
                  {request.assigned_to ? (
                    <span
                      className={cn(
                        request.assigned_to.id === currentUserId && 'font-medium text-primary',
                      )}
                    >
                      {request.assigned_to.full_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {request.shift_count}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs">
                    <CalendarDays className="size-3 text-muted-foreground" aria-hidden />
                    {formatDate(request.due_date)}
                  </span>
                  <StatusBadge
                    className="mt-1"
                    tone={DUE_STATE_META[request.due_state]?.badge ?? DUE_STATE_META.on_track.badge}
                    label={DUE_STATE_META[request.due_state]?.label ?? 'On Track'}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusBadge
                    tone={PRIORITY_META[request.priority].badge}
                    label={PRIORITY_META[request.priority].label}
                    dot={false}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${request.title}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/requests/${request.id}`}>Open</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/requests/${request.id}/edit`}>Edit</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  column,
  label,
  sort,
  dir,
  onSort,
  className,
}: {
  column: string;
  label: string;
  sort: string;
  dir: string;
  onSort: (column: string) => void;
  className?: string;
}) {
  const isSorted = sort === column;
  const Icon = !isSorted ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th className={cn('h-11 px-3 align-middle', className)} scope="col" aria-sort={
      isSorted ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
    }>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        {label}
        <Icon className={cn('size-3', isSorted && 'text-foreground')} aria-hidden />
      </button>
    </th>
  );
}

function Pagination({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    router.replace(`${pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-muted-foreground">
        Page {page} of {pageCount} · {total} total
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        {Array.from({ length: Math.min(pageCount, 5) }).map((_, i) => {
          // Window the page numbers around the current page.
          const start = Math.max(1, Math.min(page - 2, pageCount - 4));
          const target = start + i;
          if (target > pageCount) return null;
          return (
            <Button
              key={target}
              variant={target === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => goTo(target)}
              aria-current={target === page ? 'page' : undefined}
              aria-label={`Page ${target}`}
              className="w-9"
            >
              {target}
            </Button>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page + 1)}
          disabled={page >= pageCount}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

// --- small label helpers -----------------------------------------------------
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

function nameOf<T extends { id: string; name: string }>(list: T[], id: string): string {
  return list.find((x) => x.id === id)?.name ?? id;
}

/** Profiles are keyed on `full_name`, not `name`. */
function userName(list: Profile[], id: string): string {
  return list.find((p) => p.id === id)?.full_name ?? id;
}

function stageName(list: PipelineStage[], id: string): string {
  return list.find((x) => x.id === id)?.name ?? id;
}

function goalName(list: PromoGoal[], id: string): string {
  return list.find((x) => x.id === id)?.name ?? id;
}

export { SkeletonRows };