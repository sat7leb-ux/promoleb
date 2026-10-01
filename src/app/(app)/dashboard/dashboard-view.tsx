'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock,
  FileStack,
  Plus,
  Radio,
  Tv,
  TrendingUp,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { UserChip } from '@/components/shared/user-avatar';
import { PRIORITY_META, DUE_STATE_META } from '@/lib/constants';
import { formatDate, formatNumber, percentage, cn } from '@/lib/utils';
import { DashboardFilters as FilterBar } from '@/components/dashboard/dashboard-filters';
import type { DashboardFilters } from '@/lib/queries/dashboard';
import type { DashboardData } from '@/lib/queries/dashboard';
import type { Permission } from '@/lib/auth/permissions';
import type { Channel, PipelineStage, Profile, Program, Project, PromoGoal } from '@/types/database';

/** Chart palette — brand-first, distinguishable, works in light and dark. */
const SERIES = [
  '#3366ff', '#22d3ee', '#8b5cf6', '#f59e0b', '#10b981',
  '#f43f5e', '#0ea5e9', '#84cc16', '#f97316', '#14b8a6',
];

interface Props {
  data: DashboardData;
  references: {
    channels: Channel[];
    programs: Program[];
    stages: PipelineStage[];
    goals: PromoGoal[];
    projects: Project[];
    profiles: Profile[];
  };
  permission: Permission;
  currentUser: { id: string; full_name: string; avatar_url: string | null };
  scope: 'all' | 'me';
  filters: DashboardFilters;
  denied: boolean;
}

export function DashboardView({
  data,
  references,
  permission,
  currentUser,
  scope,
  filters,
  denied,
}: Props) {
  const { kpis } = data;

  const stageChart = useMemo(
    () => data.byStage.map((s) => ({ name: s.stage_name, count: s.count, color: SERIES[data.byStage.indexOf(s) % SERIES.length] })),
    [data.byStage],
  );

  const channelChart = useMemo(
    () => data.byChannel.slice(0, 10).map((c) => ({ name: c.name, requests: c.count, shifts: c.shifts })),
    [data.byChannel],
  );

  const programChart = useMemo(
    () => data.byProgram.slice(0, 10).map((p) => ({ name: p.name, requests: p.count, shifts: p.shifts })),
    [data.byProgram],
  );

  const priorityChart = useMemo(
    () =>
      data.byPriority.map((p) => ({
        name: PRIORITY_META[p.id as keyof typeof PRIORITY_META]?.label ?? p.name,
        count: p.count,
        fill: PRIORITY_META[p.id as keyof typeof PRIORITY_META]?.dot.replace('bg-', '') ?? '#94a3b8',
      })),
    [data.byPriority],
  );

  const monthChart = useMemo(
    () =>
      data.byMonth.map((m) => ({
        month: new Date(`${m.month}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        requests: m.count,
        completed: m.completed,
      })),
    [data.byMonth],
  );

  const isEmpty = kpis.total === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${currentUser.full_name.split(' ')[0]}`}
        description={
          scope === 'me'
            ? 'Your personal workload across the promo pipeline.'
            : 'An overview of promo activity across every channel, program and project.'
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/pipeline">Open pipeline</Link>
            </Button>
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

      {denied && (
        <Alert variant="warning">
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>
            Your role does not have permission to view that page.
          </AlertDescription>
        </Alert>
      )}

      {data.error && (
        <Alert variant="warning">
          <AlertTitle>Partial data</AlertTitle>
          <AlertDescription>{data.error} Some figures may be missing.</AlertDescription>
        </Alert>
      )}

      <FilterBar
        references={references}
        permission={permission}
        scope={scope}
        filters={filters}
      />

      {/* --- KPI row --- */}
      <section aria-label="Key figures">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total Requests"
            value={kpis.total}
            icon={FileStack}
            hint={`${percentage(kpis.completed, kpis.total)}% completed`}
          />
          <KpiCard
            label="New"
            value={kpis.new}
            icon={CircleDot}
            tone="blue"
            hint="Awaiting first review"
          />
          <KpiCard
            label="In Progress"
            value={kpis.inProgress + kpis.pending}
            icon={TrendingUp}
            tone="violet"
            hint={`${kpis.pending} in review`}
          />
          <KpiCard
            label="Completed"
            value={kpis.completed}
            icon={CheckCircle2}
            tone="emerald"
            hint={`${kpis.cancelled} cancelled`}
          />
          <KpiCard
            label="Overdue"
            value={kpis.overdue}
            icon={AlertTriangle}
            tone={kpis.overdue > 0 ? 'rose' : 'slate'}
            hint={kpis.dueSoon > 0 ? `${kpis.dueSoon} due soon` : 'Nothing due soon'}
          />
          <KpiCard
            label="Assigned to Me"
            value={kpis.assignedToMe}
            icon={Users}
            tone="cyan"
            hint={`${kpis.totalShifts} shifts total`}
          />
        </div>
      </section>

      {/* --- secondary figures --- */}
      <section aria-label="Catalogue and shift figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Shifts"
          value={kpis.totalShifts}
          icon={Clock}
          size="sm"
          hint={`${kpis.shiftsCompleted} completed · ${kpis.averageShiftsPerRequest} avg per request`}
        />
        <KpiCard
          label="Active Programs"
          value={kpis.activePrograms}
          icon={Tv}
          size="sm"
          hint="Across all channels"
        />
        <KpiCard
          label="Active Channels"
          value={kpis.activeChannels}
          icon={Radio}
          size="sm"
          hint="Broadcast, digital and live"
        />
        <KpiCard
          label="Completion Rate"
          value={`${kpis.completionRate}%`}
          icon={TrendingUp}
          size="sm"
          tone="emerald"
          hint={`${kpis.onTrack} on track`}
        />
      </section>

      {isEmpty ? (
        <EmptyState
          icon={<FileStack className="size-6" />}
          title="No promo requests match these filters"
          description={
            scope === 'me'
              ? 'You have no requests assigned to you in this range. Try widening the date range or switching to the full department view.'
              : 'Once promo requests are created, this dashboard will show volume, status distribution, workload and shift analytics.'
          }
          action={
            permission.canCreateRequests ? (
              <Button asChild>
                <Link href="/requests/new">
                  <Plus className="size-4" />
                  Create the first request
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* --- charts --- */}
          <section className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              title="Requests by Status"
              description="How work is distributed across the pipeline"
              className="lg:col-span-1"
            >
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stageChart}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {stageChart.map((entry, index) => (
                      <Cell key={entry.name} fill={SERIES[index % SERIES.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [formatNumber(value), name]}
                  />
                  <Legend verticalAlign="bottom" height={60} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Request Volume by Month"
              description="Requests raised versus completed"
              className="lg:col-span-2"
            >
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthChart} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3366ff" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3366ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    name="Requests"
                    stroke="#3366ff"
                    strokeWidth={2}
                    fill="url(#gRequests)"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gCompleted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Requests by Channel"
              description="Where the work is going"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/reports/channels">
                    Report
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            >
              {data.byChannel.length === 0 ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={channelChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="requests" name="Requests" fill="#3366ff" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="shifts" name="Shifts" fill="#22d3ee" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Requests by Program"
              description="The ten busiest programs"
            >
              {data.byProgram.length === 0 ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={programChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                    <Bar dataKey="requests" name="Requests" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {/* --- overdue --- */}
            <div className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <h2 className="text-sm font-semibold">Overdue requests</h2>
                {kpis.overdue > 0 && (
                  <StatusBadge tone={DUE_STATE_META.overdue.badge} label={`${kpis.overdue} overdue`} />
                )}
              </div>
              {data.overdueRequests.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-6" />}
                  title="Nothing overdue"
                  description="Every request in this view is within its deadline."
                  className="py-10"
                />
              ) : (
                <ul className="divide-y">
                  {data.overdueRequests.map((r, i) => (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        href={`/requests/${r.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.request_code ?? '—'} · due {formatDate(r.due_date)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block text-xs font-semibold text-destructive">
                            {r.daysOverdue}d late
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {r.assigned_to?.full_name ?? 'Unassigned'}
                          </span>
                        </div>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {/* --- workload --- */}
            <div className="rounded-xl border bg-card lg:col-span-2">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <div>
                  <h2 className="text-sm font-semibold">Team workload</h2>
                  <p className="text-xs text-muted-foreground">Requests assigned per person</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/reports/users">
                    Report
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>

              {data.byUser.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="No assignments yet"
                  description="Assign a producer to a request and their workload will appear here."
                  className="py-10"
                />
              ) : (
                <ul className="divide-y">
                  {data.byUser.map((u) => {
                    const load = percentage(u.active, Math.max(u.assigned, 1));
                    return (
                      <li key={u.id} className="flex items-center gap-4 px-5 py-3">
                        <UserChip
                          name={u.name}
                          avatarUrl={u.avatar_url}
                          size="sm"
                          className="w-40 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {u.active} active · {u.completed} done · {u.shifts} shifts
                            </span>
                            <span className="tabular-nums">{u.assigned} total</span>
                          </div>
                          <div
                            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuenow={load}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${u.name} active load`}
                          >
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                load > 85 ? 'bg-rose-500' : load > 60 ? 'bg-amber-500' : 'bg-brand-500',
                              )}
                              style={{ width: `${Math.max(load, 3)}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* --- recent + priority --- */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card lg:col-span-2">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <h2 className="text-sm font-semibold">Recent requests</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/requests">
                    View all
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
              <ul className="divide-y">
                {data.recentRequests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/requests/${r.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{r.request_code ?? '—'}</span>
                          <span aria-hidden>·</span>
                          <span>{r.stage_name}</span>
                          {r.due_date && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="size-3" aria-hidden />
                                {formatDate(r.due_date)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge
                          tone={DUE_STATE_META[r.due_state as keyof typeof DUE_STATE_META]?.badge ?? DUE_STATE_META.on_track.badge}
                          label={DUE_STATE_META[r.due_state as keyof typeof DUE_STATE_META]?.label ?? 'On Track'}
                        />
                        {r.priority && (
                          <StatusBadge
                            tone={PRIORITY_META[r.priority].badge}
                            label={PRIORITY_META[r.priority].label}
                            dot={false}
                          />
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <ChartCard title="Priority Mix" description="How urgent the workload is">
              {data.byPriority.every((p) => p.count === 0) ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={priorityChart} margin={{ left: -22, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                    <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                      {priorityChart.map((entry, i) => (
                        <Cell key={i} fill={['#f43f5e', '#f59e0b', '#64748b', '#0ea5e9'][i % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </section>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      No data for these filters
    </div>
  );
}