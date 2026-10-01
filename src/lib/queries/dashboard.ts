import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PriorityLevel } from '@/types/database';

/**
 * Resolves pipeline stage ids from their stable keys.
 *
 * Stages are user-renameable in Settings, so anything that has to recognise a
 * specific stage must key on `key`, never on the display name. An unknown key
 * yields an empty set, which makes the caller fall through to its default
 * classification rather than miscount.
 */
async function stageIdsByKey(key: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from('pipeline_stages').select('id').eq('key', key);
  return new Set((data ?? []).map((s: { id: string }) => s.id));
}

/**
 * Dashboard analytics.
 *
 * Every number here is computed in Postgres from real data. There are no seeded
 * constants in this file — if a chart is empty, the database genuinely has no
 * matching rows.
 *
 * All queries run in parallel, so the dashboard costs a fixed handful of round
 * trips regardless of how much data exists.
 */

export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  channelIds?: string[];
  programIds?: string[];
  projectIds?: string[];
  assigneeIds?: string[];
  stageIds?: string[];
  goalIds?: string[];
  priorities?: PriorityLevel[];
  /** Restrict to a single assignee for the personal view. */
  userId?: string;
  /** Which date column the range applies to. */
  dateField?: 'request_date' | 'due_date' | 'created_at';
}

export interface KpiTotals {
  total: number;
  new: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  dueSoon: number;
  onTrack: number;
  totalShifts: number;
  shiftsCompleted: number;
  activePrograms: number;
  activeChannels: number;
  assignedToMe: number;
  averageShiftsPerRequest: number;
  completionRate: number;
}

export interface StageCount {
  stage_id: string;
  stage_name: string;
  position: number;
  color: string;
  count: number;
}

export interface DimensionCount {
  id: string | null;
  name: string;
  count: number;
  shifts: number;
}

export interface MonthlyCount {
  month: string;
  count: number;
  completed: number;
}

export interface UserWorkload {
  id: string;
  name: string;
  avatar_url: string | null;
  assigned: number;
  active: number;
  completed: number;
  shifts: number;
}

export interface DashboardData {
  kpis: KpiTotals;
  byStage: StageCount[];
  byChannel: DimensionCount[];
  byProgram: DimensionCount[];
  byProject: DimensionCount[];
  byGoal: DimensionCount[];
  byPriority: DimensionCount[];
  byUser: UserWorkload[];
  byMonth: MonthlyCount[];
  shiftAnalytics: {
    totalShifts: number;
    shiftsPerChannel: DimensionCount[];
    shiftsPerProgram: DimensionCount[];
  };
  recentRequests: DashboardRequest[];
  overdueRequests: DashboardRequest[];
  /** Set when some queries failed, so the UI can say so without hiding data. */
  error: string | null;
}

export interface DashboardRequest {
  id: string;
  request_code: string | null;
  title: string;
  stage_name?: string;
  priority?: PriorityLevel;
  due_state?: string;
  due_date: string | null;
  daysOverdue?: number;
  assigned_to: { id: string; full_name: string } | null;
}

/** Applies the shared filter set. Typed loosely because PostgREST builders vary. */
function applyFilters<T>(query: T, filters: DashboardFilters): T {
  let q = query as {
    gte: (c: string, v: string) => typeof q;
    lte: (c: string, v: string) => typeof q;
    in: (c: string, v: unknown[]) => typeof q;
    eq: (c: string, v: unknown) => typeof q;
  };
  const field = filters.dateField ?? 'request_date';
  if (filters.dateFrom) q = q.gte(field, filters.dateFrom);
  if (filters.dateTo) q = q.lte(field, filters.dateTo);
  if (filters.channelIds?.length) q = q.in('channel_id', filters.channelIds);
  if (filters.programIds?.length) q = q.in('program_id', filters.programIds);
  if (filters.projectIds?.length) q = q.in('project_id', filters.projectIds);
  if (filters.goalIds?.length) q = q.in('goal_id', filters.goalIds);
  if (filters.priorities?.length) q = q.in('priority', filters.priorities);
  if (filters.stageIds?.length) q = q.in('stage_id', filters.stageIds);
  if (filters.assigneeIds?.length) q = q.in('assigned_to_id', filters.assigneeIds);
  else if (filters.userId) q = q.eq('assigned_to_id', filters.userId);
  return q as T;
}

/**
 * Groups joined rows by a relation into a name -> count map.
 * `pick` returns the relation payload for one row.
 */
function tally<T>(
  rows: T[],
  pick: (row: T) => { id: string | null; name: string | null },
  shiftsOf: (row: T) => number,
  fallbackName: string,
): DimensionCount[] {
  const map = new Map<string, DimensionCount>();
  for (const row of rows) {
    const resolved = pick(row);
    const id = resolved.id;
    const key = id ?? '__none__';
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.shifts += shiftsOf(row);
    } else {
      map.set(key, {
        id,
        name: resolved.name ?? fallbackName,
        count: 1,
        shifts: shiftsOf(row),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  const supabase = await createClient();

  const [
    totalsRes,
    stageRes,
    channelRes,
    programRes,
    projectRes,
    goalRes,
    priorityRes,
    userRes,
    monthRes,
    shiftChannelRes,
    shiftProgramRes,
    shiftStatusRes,
    activeProgramsRes,
    activeChannelsRes,
    mineRes,
    recentRes,
    overdueRes,
    stageMetaRes,
  ] = await Promise.all([
    applyFilters(
      supabase
        .from('promo_requests')
        .select('stage_id, stage_name, priority, due_state, shift_count, is_completed'),
      filters,
    ).eq('status', 'active'),

    supabase.from('promo_requests').select('stage_id, stage_name, stage_position'),

    applyFilters(
      supabase.from('promo_requests').select('channel_id, shift_count, channel:channels(id, name)'),
      filters,
    ),

    applyFilters(
      supabase.from('promo_requests').select('program_id, shift_count, program:programs(id, name)'),
      filters,
    ),

    applyFilters(
      supabase
        .from('promo_requests')
        .select('project_id, shift_count, project:projects(id, name, code)'),
      filters,
    ),

    applyFilters(
      supabase.from('promo_requests').select('goal_id, shift_count, goal:promo_goals(id, name)'),
      filters,
    ),

    applyFilters(supabase.from('promo_requests').select('priority'), filters),

    applyFilters(
      supabase
        .from('promo_requests')
        .select(
          'assigned_to_id, shift_count, is_completed, status, assignee:profiles!promo_requests_assigned_to_id_fkey(id, full_name, avatar_url)',
        ),
      filters,
    ),

    applyFilters(
      supabase.from('promo_requests').select('request_date, is_completed'),
      filters,
    ),

    supabase.from('request_shifts').select(
      'id, shift:promo_requests(channel:channels(id, name), program:programs(id, name))',
    ),

    supabase.from('request_shifts').select('id'),

    supabase.from('request_shifts').select('status'),

    supabase.from('programs').select('id').eq('status', 'active'),
    supabase.from('channels').select('id').eq('status', 'active'),

    filters.userId
      ? supabase
          .from('promo_requests')
          .select('id')
          .eq('assigned_to_id', filters.userId)
          .eq('status', 'active')
      : Promise.resolve({ data: [], error: null } as never),

    applyFilters(
      supabase
        .from('promo_requests')
        .select(
          'id, request_code, title, stage_name, priority, due_state, due_date, assigned_to:profiles!promo_requests_assigned_to_id_fkey(id, full_name)',
        ),
      filters,
    )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8),

    applyFilters(
      supabase
        .from('promo_requests')
        .select(
          'id, request_code, title, due_date, assigned_to:profiles!promo_requests_assigned_to_id_fkey(id, full_name)',
        )
        .eq('due_state', 'overdue'),
      filters,
    )
      .eq('status', 'active')
      .order('due_date', { ascending: true })
      .limit(8),

    supabase.from('pipeline_stages').select('id, color'),
  ]);

  const failures = [
    totalsRes.error, stageRes.error, channelRes.error, programRes.error, projectRes.error,
    goalRes.error, priorityRes.error, userRes.error, monthRes.error,
    shiftProgramRes.error, shiftStatusRes.error, activeProgramsRes.error,
    activeChannelsRes.error, recentRes.error, overdueRes.error, stageMetaRes.error,
  ].filter(Boolean);

  for (const f of failures) console.error('[dashboard] query failed:', (f as Error).message);
  const error = failures.length > 0 ? 'Some dashboard data could not be loaded.' : null;

  // --- KPI totals ----------------------------------------------------------
  const totals = (totalsRes.data ?? []) as Array<{
    stage_id: string;
    stage_name: string;
    priority: PriorityLevel;
    due_state: string;
    shift_count: number;
    is_completed: boolean;
  }>;

  const totalShifts = totals.reduce((sum, r) => sum + (r.shift_count ?? 0), 0);
  const completedCount = totals.filter((r) => r.is_completed).length;

  // Buckets are keyed on stable stage ids, not display names: stages get
  // renamed in Settings, and a literal 'Review' would silently stop matching.
  const newStageIds = await stageIdsByKey('new');
  const pendingStageIds = await stageIdsByKey('review');
  const cancelledStageIds = await stageIdsByKey('cancelled');

  const isNew = (r: (typeof totals)[number]) => newStageIds.has(r.stage_id);
  const isPending = (r: (typeof totals)[number]) => pendingStageIds.has(r.stage_id);
  const isCancelled = (r: (typeof totals)[number]) => cancelledStageIds.has(r.stage_id);

  const kpis: KpiTotals = {
    total: totals.length,
    new: totals.filter(isNew).length,
    pending: totals.filter(isPending).length,
    inProgress: totals.filter(
      (r) => !r.is_completed && !isNew(r) && !isPending(r) && !isCancelled(r),
    ).length,
    completed: completedCount,
    cancelled: totals.filter(isCancelled).length,
    overdue: totals.filter((r) => r.due_state === 'overdue').length,
    dueSoon: totals.filter((r) => r.due_state === 'due_soon').length,
    onTrack: totals.filter((r) => r.due_state === 'on_track').length,
    totalShifts,
    shiftsCompleted: ((shiftStatusRes.data ?? []) as Array<{ status: string }>).filter(
      (s) => s.status === 'done',
    ).length,
    activePrograms: (activeProgramsRes.data ?? []).length,
    activeChannels: (activeChannelsRes.data ?? []).length,
    assignedToMe: (mineRes.data ?? []).length,
    averageShiftsPerRequest: totals.length
      ? Math.round((totalShifts / totals.length) * 10) / 10
      : 0,
    completionRate: totals.length ? Math.round((completedCount / totals.length) * 100) : 0,
  };

  // --- stage distribution --------------------------------------------------
  const stageColors = new Map(
    ((stageMetaRes.data ?? []) as Array<{ id: string; color: string }>).map((s) => [
      s.id,
      s.color,
    ]),
  );

  const stageMap = new Map<string, StageCount>();
  for (const row of (stageRes.data ?? []) as Array<{
    stage_id: string;
    stage_name: string;
    stage_position: number;
  }>) {
    const existing = stageMap.get(row.stage_id);
    if (existing) existing.count += 1;
    else
      stageMap.set(row.stage_id, {
        stage_id: row.stage_id,
        stage_name: row.stage_name,
        position: row.stage_position ?? 0,
        color: stageColors.get(row.stage_id) ?? 'slate',
        count: 1,
      });
  }
  const byStage = [...stageMap.values()].sort((a, b) => a.position - b.position);

  // --- dimensions ----------------------------------------------------------
  const byChannel = tally(
    (channelRes.data ?? []) as Array<{
      channel: { id: string; name: string } | null;
      shift_count: number;
    }>,
    (r) => (r.channel ? { id: r.channel.id, name: r.channel.name } : { id: null, name: null }),
    (r) => r.shift_count ?? 0,
    'No channel',
  );

  const byProgram = tally(
    (programRes.data ?? []) as Array<{ program: { id: string; name: string } | null; shift_count: number }>,
    (r) => (r.program ? { id: r.program.id, name: r.program.name } : { id: null, name: null }),
    (r) => r.shift_count ?? 0,
    'No program',
  );

  const byProject = tally(
    (projectRes.data ?? []) as Array<{
      project: { id: string; name: string; code: string | null } | null;
      shift_count: number;
    }>,
    (r) =>
      r.project
        ? {
            id: r.project.id,
            name: r.project.code ? `${r.project.code} · ${r.project.name}` : r.project.name,
          }
        : { id: null, name: null },
    (r) => r.shift_count ?? 0,
    'No project',
  );

  const byGoal = tally(
    (goalRes.data ?? []) as Array<{ goal: { id: string; name: string } | null; shift_count: number }>,
    (r) => (r.goal ? { id: r.goal.id, name: r.goal.name } : { id: null, name: null }),
    (r) => r.shift_count ?? 0,
    'No goal',
  );

  const priorityRows = (priorityRes.data ?? []) as Array<{ priority: PriorityLevel }>;
  const byPriority: DimensionCount[] = (['urgent', 'high', 'normal', 'low'] as PriorityLevel[]).map(
    (p) => ({
      id: p,
      name: p.charAt(0).toUpperCase() + p.slice(1),
      count: priorityRows.filter((r) => r.priority === p).length,
      shifts: 0,
    }),
  );

  // --- user workload -------------------------------------------------------
  const userMap = new Map<string, UserWorkload>();
  for (const row of (userRes.data ?? []) as Array<{
    assigned_to_id: string | null;
    shift_count: number;
    is_completed: boolean;
    status: string;
    assignee: { id: string; full_name: string; avatar_url: string | null } | null;
  }>) {
    const key = row.assignee?.id ?? '__unassigned__';
    const isCompleted = Boolean(row.is_completed);
    const isActive = row.status === 'active' && !isCompleted;
    const existing = userMap.get(key);
    if (existing) {
      existing.assigned += 1;
      existing.shifts += row.shift_count ?? 0;
      if (isCompleted) existing.completed += 1;
      if (isActive) existing.active += 1;
    } else {
      userMap.set(key, {
        id: row.assignee?.id ?? 'unassigned',
        name: row.assignee?.full_name ?? 'Unassigned',
        avatar_url: row.assignee?.avatar_url ?? null,
        assigned: 1,
        active: isActive ? 1 : 0,
        completed: isCompleted ? 1 : 0,
        shifts: row.shift_count ?? 0,
      });
    }
  }
  const byUser = [...userMap.values()].sort((a, b) => b.assigned - a.assigned).slice(0, 12);

  // --- monthly volume ------------------------------------------------------
  const monthMap = new Map<string, MonthlyCount>();
  for (const row of (monthRes.data ?? []) as Array<{ request_date: string; is_completed: boolean }>) {
    const month = String(row.request_date).slice(0, 7);
    const existing = monthMap.get(month);
    if (existing) {
      existing.count += 1;
      if (row.is_completed) existing.completed += 1;
    } else {
      monthMap.set(month, { month, count: 1, completed: row.is_completed ? 1 : 0 });
    }
  }
  const byMonth = [...monthMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  // --- shift analytics -----------------------------------------------------
  const channelShiftMap = new Map<string, DimensionCount>();
  const programShiftMap = new Map<string, DimensionCount>();

  // Each shift joins up to its request, which carries the channel and program.
  for (const row of (shiftChannelRes.data ?? []) as Array<{
    shift: {
      channel: { id: string; name: string } | null;
      program: { id: string; name: string } | null;
    } | null;
  }>) {
    const channel = row.shift?.channel ?? null;
    const program = row.shift?.program ?? null;

    const cKey = channel?.id ?? '__none__';
    const cExisting = channelShiftMap.get(cKey);
    if (cExisting) cExisting.count += 1;
    else
      channelShiftMap.set(cKey, {
        id: channel?.id ?? null,
        name: channel?.name ?? 'No channel',
        count: 1,
        shifts: 1,
      });

    const pKey = program?.id ?? '__none__';
    const pExisting = programShiftMap.get(pKey);
    if (pExisting) pExisting.count += 1;
    else
      programShiftMap.set(pKey, {
        id: program?.id ?? null,
        name: program?.name ?? 'No program',
        count: 1,
        shifts: 1,
      });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    kpis,
    byStage,
    byChannel,
    byProgram,
    byProject,
    byGoal,
    byPriority,
    byUser,
    byMonth,
    shiftAnalytics: {
      totalShifts: (shiftProgramRes.data ?? []).length,
      shiftsPerChannel: [...channelShiftMap.values()].sort((a, b) => b.count - a.count),
      shiftsPerProgram: [...programShiftMap.values()].sort((a, b) => b.count - a.count),
    },
    recentRequests: (recentRes.data ?? []) as DashboardRequest[],
    overdueRequests: ((overdueRes.data ?? []) as DashboardRequest[]).map((r) => {
      const daysOverdue = r.due_date
        ? Math.max(
            0,
            Math.round((today.getTime() - new Date(r.due_date).setHours(0, 0, 0, 0)) / 86400000),
          )
        : 0;
      return { ...r, daysOverdue };
    }),
    error,
  };
}