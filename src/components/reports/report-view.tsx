'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, FileSpreadsheet, Printer, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchInput } from '@/components/shared/filters/filter-bar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportCsv, exportExcel, printReport } from '@/lib/reports/export';
import { formatDaysToCompletion, formatNumber, percentage } from '@/lib/utils';
import type { ReportFilters, ReportRow, ReportTotals } from '@/lib/reports/aggregate';
import type { Channel, PipelineStage, PriorityLevel, Profile, Program, Project, PromoGoal } from '@/types/database';

const NONE = '__none__';

export interface ReportConfig {
  /** Report name, used for the page title and the export filename. */
  title: string;
  description: string;
  /** The row label shown in the first column. */
  dimensionLabel: string;
  /** Columns to show, and how to label them. */
  columns: ReportColumn[];
}

type ReportColumn = {
  key: keyof ReportRow | 'completionRate' | 'shiftsPerRequest';
  label: string;
  align?: 'left' | 'right';
  /** Renders the cell body. */
  render: (row: ReportRow) => React.ReactNode;
  /** Renders the CSV/Excel cell body. */
  exportValue: (row: ReportRow) => string | number | null;
};

interface Props {
  config: ReportConfig;
  rows: ReportRow[];
  totals: ReportTotals;
  references: {
    channels: Channel[];
    programs: Program[];
    projects: Project[];
    stages: PipelineStage[];
    goals: PromoGoal[];
    profiles: Profile[];
  };
  filters: ReportFilters;
  /** Filters this particular report supports. */
  available: Array<'channel' | 'program' | 'project' | 'goal' | 'user' | 'stage' | 'priority'>;
  canViewUsers: boolean;
}

/**
 * Shared report screen.
 *
 * Every report is the same table over a different grouping, so they share one
 * component rather than five near-identical ones. Filter state lives in the
 * URL, which keeps a report link shareable and lets the browser's back button
 * step through filter changes.
 */
export function ReportView({
  config,
  rows,
  totals,
  references,
  filters,
  available,
  canViewUsers,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const update = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === NONE) params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Export headers and rows are derived from the column config, so a column
  // added to the table can never be missing from the export.
  const exportHeaders = useMemo(
    () => ['Name', ...config.columns.map((c) => c.label)],
    [config.columns],
  );

  const exportRows = useMemo(
    () =>
      rows.map((row) => [
        row.name,
        ...config.columns.map((c) => c.exportValue(row)),
      ]),
    [rows, config.columns],
  );

  const activeFilters = [
    filters.dateFrom ? { key: 'from', label: `From ${filters.dateFrom}` } : null,
    filters.dateTo ? { key: 'to', label: `To ${filters.dateTo}` } : null,
    filters.channelIds?.length ? { key: 'channel', label: channelName(references, filters.channelIds[0]) } : null,
    filters.programIds?.length ? { key: 'program', label: nameOf(references.programs, filters.programIds[0]) } : null,
    filters.projectIds?.length ? { key: 'project', label: nameOf(references.projects, filters.projectIds[0]) } : null,
    filters.goalIds?.length ? { key: 'goal', label: nameOf(references.goals, filters.goalIds[0]) } : null,
    filters.assigneeIds?.length ? { key: 'user', label: userName(references, filters.assigneeIds[0]) } : null,
    filters.stageIds?.length ? { key: 'stage', label: nameOf(references.stages, filters.stageIds[0]) } : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => printReport()}>
              <Printer className="size-4" />
              Print
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Download className="size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Download as</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => {
                    if (rows.length === 0) {
                      toast.error('There is nothing to export.');
                      return;
                    }
                    exportCsv(config.title, exportHeaders, exportRows);
                    toast.success(`Exported ${rows.length} rows as CSV.`);
                  }}
                >
                  <Download className="size-4" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    if (rows.length === 0) {
                      toast.error('There is nothing to export.');
                      return;
                    }
                    exportExcel(config.title, exportHeaders, exportRows);
                    toast.success(`Exported ${rows.length} rows for Excel.`);
                  }}
                >
                  <FileSpreadsheet className="size-4" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => printReport()}>
                  <Printer className="size-4" />
                  Print / Save as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* --- totals --- */}
      <section aria-label="Report totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <TotalTile label="Requests" value={totals.requests} />
        <TotalTile label="Completed" value={totals.completed} tone="emerald" />
        <TotalTile label="Pending" value={totals.pending} tone="amber" />
        <TotalTile label="In progress" value={totals.inProgress} tone="brand" />
        <TotalTile label="Overdue" value={totals.overdue} tone={totals.overdue > 0 ? 'rose' : 'slate'} />
        <TotalTile label="Total shifts" value={totals.totalShifts} />
        <TotalTile
          label="Avg completion"
          value={formatDaysToCompletion(totals.averageCompletionDays)}
        />
      </section>

      {/* --- filters --- */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput placeholder="Search title, code, notes…" className="flex-1" />

          <Button
            variant={expanded ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilters.length > 0 && (
              <Badge variant="default" className="ml-1 h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {activeFilters.length}
              </Badge>
            )}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-from" className="text-xs">
                From date
              </Label>
              <Input
                id="r-from"
                type="date"
                value={filters.dateFrom ?? ''}
                max={filters.dateTo ?? undefined}
                onChange={(e) => update('from', e.target.value || null)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-to" className="text-xs">
                To date
              </Label>
              <Input
                id="r-to"
                type="date"
                value={filters.dateTo ?? ''}
                min={filters.dateFrom ?? undefined}
                onChange={(e) => update('to', e.target.value || null)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-datefield" className="text-xs">
                Date applies to
              </Label>
              <Select
                value={filters.dateField ?? 'request_date'}
                onValueChange={(v) => update('dateField', v === 'request_date' ? null : v)}
              >
                <SelectTrigger id="r-datefield" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="request_date">Request date</SelectItem>
                  <SelectItem value="due_date">Due date</SelectItem>
                  <SelectItem value="created_at">Created date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {available.includes('priority') && (
              <div className="space-y-1.5">
                <Label htmlFor="r-priority" className="text-xs">
                  Priority
                </Label>
                <Select
                  value={filters.priorities?.[0] ?? NONE}
                  onValueChange={(v) => update('priority', v)}
                >
                  <SelectTrigger id="r-priority" className="h-8 text-xs">
                    <SelectValue placeholder="Any priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any priority</SelectItem>
                    {(['urgent', 'high', 'normal', 'low'] as PriorityLevel[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {available.includes('channel') && (
              <FilterSelect
                id="r-channel"
                label="Channel"
                value={filters.channelIds?.[0] ?? NONE}
                onChange={(v) => update('channel', v)}
                options={references.channels.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}

            {available.includes('program') && (
              <FilterSelect
                id="r-program"
                label="Program"
                value={filters.programIds?.[0] ?? NONE}
                onChange={(v) => update('program', v)}
                options={references.programs.map((p) => ({ value: p.id, label: p.name }))}
              />
            )}

            {available.includes('project') && (
              <FilterSelect
                id="r-project"
                label="Project"
                value={filters.projectIds?.[0] ?? NONE}
                onChange={(v) => update('project', v)}
                options={references.projects.map((p) => ({
                  value: p.id,
                  label: p.code ? `${p.code} · ${p.name}` : p.name,
                }))}
              />
            )}

            {available.includes('goal') && (
              <FilterSelect
                id="r-goal"
                label="Goal"
                value={filters.goalIds?.[0] ?? NONE}
                onChange={(v) => update('goal', v)}
                options={references.goals.map((g) => ({ value: g.id, label: g.name }))}
              />
            )}

            {available.includes('stage') && (
              <FilterSelect
                id="r-stage"
                label="Status"
                value={filters.stageIds?.[0] ?? NONE}
                onChange={(v) => update('stage', v)}
                options={references.stages.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}

            {available.includes('user') && canViewUsers && (
              <FilterSelect
                id="r-user"
                label="Assigned to"
                value={filters.assigneeIds?.[0] ?? NONE}
                onChange={(v) => update('user', v)}
                options={references.profiles.map((p) => ({ value: p.id, label: p.full_name }))}
              />
            )}

            {activeFilters.length > 0 && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => router.replace(pathname, { scroll: false })}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- table --- */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="size-4" />}
          title="No data for these filters"
          description={
            activeFilters.length > 0
              ? 'Widen the date range or clear a filter to see results.'
              : 'No promo requests have been recorded yet.'
          }
          action={
            activeFilters.length > 0 ? (
              <Button variant="outline" onClick={() => router.replace(pathname, { scroll: false })}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card print:border-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {config.title}. {rows.length} rows.
              </caption>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th scope="col" className="h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {config.dimensionLabel}
                  </th>
                  {config.columns.map((c) => (
                    <th
                      key={String(c.key)}
                      scope="col"
                      className={
                        'h-11 px-3 align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground ' +
                        (c.align === 'right' ? 'text-right' : 'text-left')
                      }
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                    <th scope="row" className="px-3 py-2.5 text-left font-medium">
                      <span className="block truncate">{row.name}</span>
                      {row.sublabel && (
                        <span className="block truncate font-mono text-[11px] font-normal text-muted-foreground">
                          {row.sublabel}
                        </span>
                      )}
                    </th>
                    {config.columns.map((c) => (
                      <td
                        key={String(c.key)}
                        className={
                          'px-3 py-2.5 tabular-nums ' + (c.align === 'right' ? 'text-right' : '')
                        }
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/50 font-medium">
                <tr>
                  <th scope="row" className="px-3 py-2.5 text-left">
                    Total
                  </th>
                  {config.columns.map((c) => (
                    <td
                      key={String(c.key)}
                      className={
                        'px-3 py-2.5 tabular-nums ' + (c.align === 'right' ? 'text-right' : '')
                      }
                    >
                      {footerValue(c.key, totals)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground print:hidden">
        Figures reflect {formatNumber(totals.requests)} requests matching the current filters.
        Average completion time covers completed requests only.
      </p>
    </div>
  );
}

// --- helpers ----------------------------------------------------------------
// --- helpers ----------------------------------------------------------------

function TotalTile({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'brand' | 'emerald' | 'amber' | 'rose';
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          'mt-1 text-xl font-semibold tabular-nums ' +
          (tone === 'emerald'
            ? 'text-emerald-600'
            : tone === 'rose'
              ? 'text-rose-600'
              : tone === 'amber'
                ? 'text-amber-600'
                : tone === 'brand'
                  ? 'text-brand-600'
                  : '')
        }
      >
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 text-xs">
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>All {label.toLowerCase()}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Tfoot value for a column, falling back to an em dash when not meaningful. */
function footerValue(key: string, totals: ReportTotals): string | number {
  switch (key) {
    case 'total':
      return totals.requests;
    case 'completed':
      return totals.completed;
    case 'pending':
      return totals.pending;
    case 'inProgress':
      return totals.inProgress;
    case 'cancelled':
      return totals.cancelled;
    case 'overdue':
      return totals.overdue;
    case 'shifts':
      return totals.totalShifts;
    case 'completionRate':
      return `${percentage(totals.completed, totals.requests)}%`;
    case 'averageCompletionDays':
      return formatDaysToCompletion(totals.averageCompletionDays);
    default:
      return '—';
  }
}

function nameOf<T extends { id: string; name: string }>(list: T[], id: string): string {
  return list.find((x) => x.id === id)?.name ?? id;
}

function channelName(references: { channels: Channel[] }, id: string): string {
  return nameOf(references.channels, id);
}

function userName(references: { profiles: Profile[] }, id: string): string {
  return references.profiles.find((p) => p.id === id)?.full_name ?? id;
}

/**
 * Shared column definitions, so every report shows the same measures in the
 * same order and the export can never drift from the table.
 */
export const REPORT_COLUMNS: ReportColumn[] = [
  {
    key: 'total',
    label: 'Requests',
    align: 'right',
    render: (r) => r.total,
    exportValue: (r) => r.total,
  },
  {
    key: 'completed',
    label: 'Completed',
    align: 'right',
    render: (r) => <span className="text-emerald-600">{r.completed}</span>,
    exportValue: (r) => r.completed,
  },
  {
    key: 'pending',
    label: 'Pending',
    align: 'right',
    render: (r) => r.pending,
    exportValue: (r) => r.pending,
  },
  {
    key: 'inProgress',
    label: 'In progress',
    align: 'right',
    render: (r) => r.inProgress,
    exportValue: (r) => r.inProgress,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    align: 'right',
    render: (r) => r.cancelled,
    exportValue: (r) => r.cancelled,
  },
  {
    key: 'overdue',
    label: 'Overdue',
    align: 'right',
    render: (r) =>
      r.overdue > 0 ? <span className="font-medium text-rose-600">{r.overdue}</span> : 0,
    exportValue: (r) => r.overdue,
  },
  {
    key: 'shifts',
    label: 'Shifts',
    align: 'right',
    render: (r) => r.shifts,
    exportValue: (r) => r.shifts,
  },
  {
    key: 'completionRate',
    label: 'Completion',
    align: 'right',
    render: (r) => `${percentage(r.completed, r.total)}%`,
    exportValue: (r) => (r.total ? percentage(r.completed, r.total) / 100 : 0),
  },
  {
    key: 'averageCompletionDays',
    label: 'Avg completion',
    align: 'right',
    render: (r) => formatDaysToCompletion(r.averageCompletionDays),
    exportValue: (r) => r.averageCompletionDays,
  },
];