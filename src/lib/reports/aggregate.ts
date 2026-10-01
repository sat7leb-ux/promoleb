import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { PAGE_SIZE } from '@/lib/constants';
import type { PriorityLevel, DueState } from '@/types/database';

/**
 * Reporting queries.
 *
 * Everything here is computed in Postgres from real data. Reports are read
 * paths, so they read under the caller's own RLS context rather than the
 * service role: a viewer cannot use a report to see rows they could not see in
 * the request list.
 *
 * Each report issues one grouped query and returns rows plus totals, so the UI
 * never has to re-aggregate in the browser.
 */

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  /** Which date column the range applies to. */
  dateField?: 'request_date' | 'due_date' | 'created_at';
  channelIds?: string[];
  programIds?: string[];
  projectIds?: string[];
  assigneeIds?: string[];
  goalIds?: string[];
  stageIds?: string[];
  priorities?: PriorityLevel[];
  dueStates?: DueState[];
  status?: 'active' | 'archived' | 'all';
  search?: string;
}

export interface ReportTotals {
  requests: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  overdue: number;
  totalShifts: number;
  /** Mean days from request_date to completion, over completed requests. */
  averageCompletionDays: number | null;
}

export interface ReportRow {
  id: string;
  name: string;
  sublabel?: string | null;
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  overdue: number;
  shifts: number;
  averageCompletionDays: number | null;
}

/**
 * Applies the shared filter set to a promo_requests query.
 *
 * Typed structurally rather than as the concrete PostgREST builder, so the
 * builder can be reassigned by each chained call without fighting the generic.
 * Every method used here exists on the real builder.
 */
interface FilterableQuery {
  gte: (column: string, value: string) => FilterableQuery;
  lte: (column: string, value: string) => FilterableQuery;
  in: (column: string, values: unknown[]) => FilterableQuery;
  eq: (column: string, value: unknown) => FilterableQuery;
  or: (filters: string) => FilterableQuery;
}

function applyFilters<T>(query: T, filters: ReportFilters): T {
  let q = query as unknown as FilterableQuery;

  if (filters.status === 'archived') q = q.eq('status', 'archived');
  else if (filters.status !== 'all') q = q.eq('status', 'active');

  const field = filters.dateField ?? 'request_date';
  if (filters.dateFrom) q = q.gte(field, filters.dateFrom);
  if (filters.dateTo) q = q.lte(field, filters.dateTo);
  if (filters.channelIds?.length) q = q.in('channel_id', filters.channelIds);
  if (filters.programIds?.length) q = q.in('program_id', filters.programIds);
  if (filters.projectIds?.length) q = q.in('project_id', filters.projectIds);
  if (filters.goalIds?.length) q = q.in('goal_id', filters.goalIds);
  if (filters.stageIds?.length) q = q.in('stage_id', filters.stageIds);
  if (filters.assigneeIds?.length) q = q.in('assigned_to_id', filters.assigneeIds);
  if (filters.priorities?.length) q = q.in('priority', filters.priorities);
  if (filters.dueStates?.length) q = q.in('due_state', filters.dueStates);

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[,()%]/g, ' ');
    if (term.length >= 2) {
      q = q.or(
        [
          `title.ilike.%${term}%`,
          `request_code.ilike.%${term}%`,
          `requested_by_name.ilike.%${term}%`,
          `notes.ilike.%${term}%`,
        ].join(','),
      );
    }
  }

  return q as unknown as T;
}

type RequestRow = {
  is_completed: boolean;
  stage_id: string;
  stage_name: string;
  due_state: string;
  shift_count: number;
  request_date: string;
  completed_at: string | null;
};

/**
 * Stage ids for the buckets a report splits by.
 *
 * Resolved once per report from the stable stage `key`, never from the display
 * name: stages are renamed in Settings, and a literal 'Review' would silently
 * stop matching — the report would still render, just with every request
 * counted as in-progress.
 */
type StageBuckets = {
  fresh: Set<string>;
  pending: Set<string>;
  cancelled: Set<string>;
};

async function stageBuckets(): Promise<StageBuckets> {
  const supabase = await createClient();
  const { data } = await supabase.from('pipeline_stages').select('id, key');
  const byKey = new Map((data ?? []).map((s: { id: string; key: string }) => [s.key, s.id]));

  const ids = (key: string) => {
    const id = byKey.get(key);
    return new Set(id ? [id] : []);
  };

  return { fresh: ids('new'), pending: ids('review'), cancelled: ids('cancelled') };
}

/** Rolls a set of request rows up into one report line. */
function toRow(
  id: string,
  name: string,
  sublabel: string | null,
  requests: RequestRow[],
  buckets: StageBuckets,
): ReportRow {
  const total = requests.length;
  const completed = requests.filter((r) => r.is_completed).length;
  const isCancelled = (r: RequestRow) => buckets.cancelled.has(r.stage_id);
  const cancelled = requests.filter(isCancelled).length;
  const isPending = (r: RequestRow) => buckets.pending.has(r.stage_id) || buckets.fresh.has(r.stage_id);
  const pending = requests.filter(isPending).length;
  const inProgress = requests.filter(
    (r) => !r.is_completed && !isPending(r) && !isCancelled(r),
  ).length;
  const overdue = requests.filter((r) => r.due_state === 'overdue').length;
  const shifts = requests.reduce((sum, r) => sum + (r.shift_count ?? 0), 0);

  // Mean turnaround over completed requests only; an in-flight request has no
  // completion time and would otherwise drag the average towards zero.
  const completedRequests = requests.filter((r) => r.completed_at && r.request_date);
  const averageCompletionDays = completedRequests.length
    ? Math.round(
        (completedRequests.reduce(
          (sum, r) =>
            sum +
            (new Date(r.completed_at as string).getTime() -
              new Date(r.request_date).getTime()) /
              86400000,
          0,
        ) /
          completedRequests.length) *
          10,
      ) / 10
    : null;

  return {
    id,
    name,
    sublabel,
    total,
    completed,
    pending,
    inProgress,
    cancelled,
    overdue,
    shifts,
    averageCompletionDays,
  };
}

function totalsOf(rows: ReportRow[]): ReportTotals {
  const requests = rows.reduce((s, r) => s + r.total, 0);
  const weighted = rows.filter((r) => r.averageCompletionDays !== null && r.completed > 0);

  return {
    requests,
    completed: rows.reduce((s, r) => s + r.completed, 0),
    pending: rows.reduce((s, r) => s + r.pending, 0),
    inProgress: rows.reduce((s, r) => s + r.inProgress, 0),
    cancelled: rows.reduce((s, r) => s + r.cancelled, 0),
    overdue: rows.reduce((s, r) => s + r.overdue, 0),
    totalShifts: rows.reduce((s, r) => s + r.shifts, 0),
    averageCompletionDays: weighted.length
      ? Math.round(
          (weighted.reduce(
            (s, r) => s + (r.averageCompletionDays ?? 0) * r.completed,
            0,
          ) /
            weighted.reduce((s, r) => s + r.completed, 0)) *
            10,
        ) / 10
      : null,
  };
}

// ---------------------------------------------------------------------------
// Report by dimension
// ---------------------------------------------------------------------------

type Dimension = 'channel' | 'program' | 'project' | 'goal' | 'assignee';

/**
 * One literal select string per dimension.
 *
 * These must stay literal. PostgREST parses the select string at the type
 * level to infer joined resources, so a computed or interpolated string yields
 * a `ParserError` row instead of a typed relation. `assigned_to_id` names its
 * constraint explicitly because `profiles` is referenced twice on this table.
 */
const CHANNEL_SELECT =
  'channel_id, channel:channels(id, name, code), is_completed, stage_id, stage_name, due_state, shift_count, request_date, completed_at';
const PROGRAM_SELECT =
  'program_id, program:programs(id, name), is_completed, stage_id, stage_name, due_state, shift_count, request_date, completed_at';
const PROJECT_SELECT =
  'project_id, project:projects(id, name, code), is_completed, stage_id, stage_name, due_state, shift_count, request_date, completed_at';
const GOAL_SELECT =
  'goal_id, goal:promo_goals(id, name), is_completed, stage_id, stage_name, due_state, shift_count, request_date, completed_at';
const ASSIGNEE_SELECT =
  'assigned_to_id, assignee:profiles!promo_requests_assigned_to_id_fkey(id, full_name), is_completed, stage_id, stage_name, due_state, shift_count, request_date, completed_at';

/** Key under which each dimension's relation is returned. */
const RELATION_KEY: Record<Dimension, string> = {
  channel: 'channel',
  program: 'program',
  project: 'project',
  goal: 'goal',
  assignee: 'assignee',
};

/**
 * Builds a report grouped by one dimension.
 *
 * Requests with no value for the dimension are collected into a single
 * "Unassigned"-style line rather than dropped, so the totals always reconcile
 * with the request list.
 */
export async function getDimensionReport(
  dimension: Dimension,
  filters: ReportFilters = {},
): Promise<{ rows: ReportRow[]; totals: ReportTotals }> {
  const supabase = await createClient();

  // Each branch passes a literal select string so PostgREST can parse it and
  // infer the joined relation. A computed string would yield ParserError.
  const query =
    dimension === 'channel'
      ? supabase.from('promo_requests').select(CHANNEL_SELECT)
      : dimension === 'program'
        ? supabase.from('promo_requests').select(PROGRAM_SELECT)
        : dimension === 'project'
          ? supabase.from('promo_requests').select(PROJECT_SELECT)
          : dimension === 'goal'
            ? supabase.from('promo_requests').select(GOAL_SELECT)
            : supabase.from('promo_requests').select(ASSIGNEE_SELECT);

  const [queryResult, buckets] = await Promise.all([applyFilters(query, filters), stageBuckets()]);
  const { data, error } = queryResult;

  if (error) {
    console.error(`[reports] ${dimension} query failed:`, error.message);
    return { rows: [], totals: totalsOf([]) };
  }

  const groups = new Map<string, { name: string; sublabel: string | null; rows: RequestRow[] }>();

  const relationKey = RELATION_KEY[dimension];

  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const id = (raw[dimension] as string | null) ?? '';
    const relation = raw[relationKey] as
      | { id: string; name: string; code?: string | null }
      | null;

    const name = relation?.name ?? (id ? id : UNASSIGNED_LABEL);
    const sublabel = relation?.code ?? null;
    const key = relation?.id ?? id ?? '__none__';

    if (!groups.has(key)) groups.set(key, { name, sublabel, rows: [] });
    groups.get(key)!.rows.push({
      is_completed: Boolean(raw.is_completed),
      stage_id: String(raw.stage_id ?? ''),
      stage_name: String(raw.stage_name ?? ''),
      due_state: String(raw.due_state ?? ''),
      shift_count: Number(raw.shift_count ?? 0),
      request_date: String(raw.request_date ?? ''),
      completed_at: (raw.completed_at as string | null) ?? null,
    });
  }

  const rows = [...groups.entries()]
    .map(([key, group]) => toRow(key, group.name, group.sublabel, group.rows, buckets))
    .sort((a, b) => b.total - a.total);

  return { rows, totals: totalsOf(rows) };
}

const UNASSIGNED_LABEL = 'Unassigned';

// ---------------------------------------------------------------------------
// Shift report
// ---------------------------------------------------------------------------

export interface ShiftReportRow {
  id: string;
  name: string;
  totalShifts: number;
  doneShifts: number;
  plannedShifts: number;
  inProgressShifts: number;
  requests: number;
}

async function getShiftReport(
  dimension: 'channel' | 'program',
  filters: ReportFilters = {},
): Promise<ShiftReportRow[]> {
  const supabase = await createClient();

  const select =
    dimension === 'channel'
      ? 'status, request:promo_requests(id, channel_id, channel:channels(id, name))'
      : 'status, request:promo_requests(id, program_id, program:programs(id, name))';

  let query = supabase.from('request_shifts').select(select);

  if (filters.channelIds?.length) query = query.in('request:promo_requests.channel_id', filters.channelIds);
  if (filters.programIds?.length) query = query.in('request:promo_requests.program_id', filters.programIds);

  const { data, error } = await query;

  if (error) {
    console.error(`[reports] shifts by ${dimension} failed:`, error.message);
    return [];
  }

  const groups = new Map<string, { name: string; totalShifts: number; doneShifts: number; plannedShifts: number; inProgressShifts: number; requestIds: Set<string> }>();

  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const request = raw.request as { id: string; channel?: { id: string; name: string } | null; program?: { id: string; name: string } | null } | null;
    const relation = (request?.channel ?? request?.program ?? null) as { id: string; name: string } | null;

    const key = relation?.id ?? '__none__';
    const name = relation?.name ?? 'Unassigned';

    if (!groups.has(key)) {
      groups.set(key, {
        name,
        totalShifts: 0,
        doneShifts: 0,
        plannedShifts: 0,
        inProgressShifts: 0,
        requestIds: new Set<string>(),
      });
    }

    const g = groups.get(key)!;
    const status = String(raw.status ?? 'planned');
    g.totalShifts += 1;
    if (status === 'done') g.doneShifts += 1;
    else if (status === 'planned') g.plannedShifts += 1;
    else if (status === 'in_progress') g.inProgressShifts += 1;
    if (request?.id) g.requestIds.add(request.id);
  }

  return [...groups.entries()]
    .map(([id, g]) => ({
      id,
      name: g.name,
      totalShifts: g.totalShifts,
      doneShifts: g.doneShifts,
      plannedShifts: g.plannedShifts,
      inProgressShifts: g.inProgressShifts,
      requests: g.requestIds.size,
    }))
    .sort((a, b) => b.totalShifts - a.totalShifts);
}

export function getShiftsByChannel(filters?: ReportFilters) {
  return getShiftReport('channel', filters);
}

export function getShiftsByProgram(filters?: ReportFilters) {
  return getShiftReport('program', filters);
}

/** Shifts per request, for the request-level shift breakdown. */
export async function getShiftsPerRequest(filters: ReportFilters = {}): Promise<
  Array<{ id: string; name: string; sublabel: string | null; totalShifts: number; doneShifts: number }>
> {
  const supabase = await createClient();

  let query = supabase
    .from('request_shifts')
    .select('status, request:promo_requests(id, title, request_code, channel_id, program_id)');

  if (filters.channelIds?.length) query = query.in('request:promo_requests.channel_id', filters.channelIds);
  if (filters.programIds?.length) query = query.in('request:promo_requests.program_id', filters.programIds);

  const { data, error } = await query.limit(PAGE_SIZE * 40);

  if (error) {
    console.error('[reports] shifts per request failed:', error.message);
    return [];
  }

  const groups = new Map<string, { name: string; sublabel: string | null; totalShifts: number; doneShifts: number }>();

  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const request = raw.request as { id: string; title: string; request_code: string | null } | null;
    if (!request) continue;

    if (!groups.has(request.id)) {
      groups.set(request.id, {
        name: request.title,
        sublabel: request.request_code,
        totalShifts: 0,
        doneShifts: 0,
      });
    }

    const g = groups.get(request.id)!;
    g.totalShifts += 1;
    if (raw.status === 'done') g.doneShifts += 1;
  }

  return [...groups.entries()]
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => b.totalShifts - a.totalShifts);
}

export { applyFilters as applyReportFilters, totalsOf, toRow };