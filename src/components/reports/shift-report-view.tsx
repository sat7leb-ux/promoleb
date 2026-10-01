'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportCsv, exportExcel, printReport } from '@/lib/reports/export';
import type { ShiftReportRow } from '@/lib/reports/aggregate';
import type { ReportFilters } from '@/lib/reports/aggregate';
import type { Channel, PipelineStage, Profile, Program, Project, PromoGoal } from '@/types/database';
import type { FilterableDimension } from '@/components/reports/report-filters';

const NONE = '__none__';

type PerRequestRow = {
  id: string;
  name: string;
  sublabel: string | null;
  totalShifts: number;
  doneShifts: number;
};

interface Props {
  byChannel: ShiftReportRow[];
  byProgram: ShiftReportRow[];
  perRequest: PerRequestRow[];
  references: {
    channels: Channel[];
    programs: Program[];
    projects: Project[];
    stages: PipelineStage[];
    goals: PromoGoal[];
    profiles: Profile[];
  };
  filters: ReportFilters;
  available: FilterableDimension[];
  canViewUsers: boolean;
}

/**
 * Shift report.
 *
 * Shifts are counted from `request_shifts` rather than the cached
 * `shift_count` on each request, so the figures here always match the actual
 * shift rows — including shifts added or removed after the request was created.
 */
export function ShiftReportView({ byChannel, byProgram, perRequest, references, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const totalShifts = byChannel.reduce((s, r) => s + r.totalShifts, 0);
  const doneShifts = byChannel.reduce((s, r) => s + r.doneShifts, 0);
  const shiftsPerRequest = perRequest.length
    ? Math.round((totalShifts / perRequest.length) * 10) / 10
    : 0;

  function exportDimension(label: string, rows: ShiftReportRow[]) {
    if (rows.length === 0) {
      toast.error('There is nothing to export.');
      return;
    }
    const headers = [label, 'Shifts', 'Done', 'Planned', 'In progress', 'Requests', 'Shifts per request'];
    const data = rows.map((r) => [
      r.name,
      r.totalShifts,
      r.doneShifts,
      r.plannedShifts,
      r.inProgressShifts,
      r.requests,
      r.requests ? Math.round((r.totalShifts / r.requests) * 10) / 10 : 0,
    ]);
    return { headers, data };
  }

  function exportRequests() {
    if (perRequest.length === 0) {
      toast.error('There is nothing to export.');
      return;
    }
    return {
      headers: ['Request', 'Reference', 'Shifts', 'Completed'],
      data: perRequest.map((r) => [r.name, r.sublabel ?? '', r.totalShifts, r.doneShifts]),
    };
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shift Report"
        description="Production effort in shifts: how many were planned, worked, and completed, by channel, program and request."
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
                    const payload = exportDimension('Channel', byChannel);
                    if (!payload) return;
                    exportCsv('shifts-by-channel', payload.headers, payload.data);
                    toast.success('Exported shifts by channel.');
                  }}
                >
                  <Download className="size-4" />
                  CSV — by channel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    const payload = exportDimension('Program', byProgram);
                    if (!payload) return;
                    exportExcel('shifts-by-program', payload.headers, payload.data);
                    toast.success('Exported shifts by program.');
                  }}
                >
                  <FileSpreadsheet className="size-4" />
                  Excel — by program
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    const payload = exportRequests();
                    if (!payload) return;
                    exportCsv('shifts-by-request', payload.headers, payload.data);
                    toast.success('Exported shifts by request.');
                  }}
                >
                  <Download className="size-4" />
                  CSV — by request
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <section aria-label="Shift totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total shifts" value={totalShifts} />
        <Tile label="Completed" value={doneShifts} tone="emerald" />
        <Tile
          label="Outstanding"
          value={totalShifts - doneShifts}
          tone={totalShifts - doneShifts > 0 ? 'amber' : 'slate'}
        />
        <Tile label="Avg shifts per request" value={shiftsPerRequest} />
      </section>

      <div className="rounded-xl border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant={expanded ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            Filters
          </Button>

          {expanded && (
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-from" className="text-xs">
                  Shift date from
                </Label>
                <Input
                  id="s-from"
                  type="date"
                  value={filters.dateFrom ?? ''}
                  max={filters.dateTo ?? undefined}
                  onChange={(e) => updateParam(router, pathname, searchParams, 'from', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-to" className="text-xs">
                  to
                </Label>
                <Input
                  id="s-to"
                  type="date"
                  value={filters.dateTo ?? ''}
                  min={filters.dateFrom ?? undefined}
                  onChange={(e) => updateParam(router, pathname, searchParams, 'to', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-channel" className="text-xs">
                  Channel
                </Label>
                <Select
                  value={filters.channelIds?.[0] ?? NONE}
                  onValueChange={(v) => updateParam(router, pathname, searchParams, 'channel', v)}
                >
                  <SelectTrigger id="s-channel" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>All channels</SelectItem>
                    {references.channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="s-program" className="text-xs">
                  Program
                </Label>
                <Select
                  value={filters.programIds?.[0] ?? NONE}
                  onValueChange={(v) => updateParam(router, pathname, searchParams, 'program', v)}
                >
                  <SelectTrigger id="s-program" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>All programs</SelectItem>
                    {references.programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="channel">
        <TabsList>
          <TabsTrigger value="channel">By channel</TabsTrigger>
          <TabsTrigger value="program">By program</TabsTrigger>
          <TabsTrigger value="request">By request</TabsTrigger>
        </TabsList>

        <TabsContent value="channel">
          <ShiftTable rows={byChannel} caption="Shifts by channel" firstColumn="Channel" />
        </TabsContent>

        <TabsContent value="program">
          <ShiftTable rows={byProgram} caption="Shifts by program" firstColumn="Program" />
        </TabsContent>

        <TabsContent value="request">
          {perRequest.length === 0 ? (
            <EmptyState
              title="No shifts recorded"
              description="Shifts appear here once a request has production shifts scheduled."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Shifts per request</caption>
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th scope="col" className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Request
                      </th>
                      <th scope="col" className="h-11 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Shifts
                      </th>
                      <th scope="col" className="h-11 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Completed
                      </th>
                      <th scope="col" className="h-11 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {perRequest.map((row) => (
                      <tr key={row.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                        <th scope="row" className="px-3 py-2.5 text-left font-medium">
                          <Link
                            href={`/requests/${row.id}`}
                            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                          >
                            {row.name}
                          </Link>
                          {row.sublabel && (
                            <span className="block font-mono text-[11px] font-normal text-muted-foreground">
                              {row.sublabel}
                            </span>
                          )}
                        </th>
                        <td className="px-3 py-2.5 text-right tabular-nums">{row.totalShifts}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">
                          {row.doneShifts}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.totalShifts - row.doneShifts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ShiftTable({
  rows,
  caption,
  firstColumn,
}: {
  rows: ShiftReportRow[];
  caption: string;
  firstColumn: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No shifts recorded"
        description="Once requests have production shifts scheduled, they are counted here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="h-11 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {firstColumn}
              </th>
              {['Shifts', 'Done', 'Planned', 'In progress', 'Requests', 'Per request'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="h-11 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                <th scope="row" className="px-3 py-2.5 text-left font-medium">
                  {row.name}
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{row.totalShifts}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{row.doneShifts}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.plannedShifts}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">
                  {row.inProgressShifts}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.requests}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.requests ? Math.round((row.totalShifts / row.requests) * 10) / 10 : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'amber';
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          'mt-1 text-xl font-semibold tabular-nums ' +
          (tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : '')
        }
      >
        {value}
      </p>
    </div>
  );
}

function updateParam(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  key: string,
  value: string,
) {
  const params = new URLSearchParams(searchParams.toString());
  if (!value || value === NONE) params.delete(key);
  else params.set(key, value);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}