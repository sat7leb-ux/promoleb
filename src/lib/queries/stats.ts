import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Stage keys treated as "not started yet".
 *
 * Pipeline stages are renamed and reordered in Settings, so anything that needs
 * to recognise a stage must key on its stable `key` — never on its display
 * name. Both the seeded `new` and `review` stages count as pending.
 */
export const PENDING_STAGE_KEYS = ['new', 'review'] as const;

/**
 * Resolves the stage ids for a set of stable stage keys.
 *
 * Returns an empty set when the lookup fails, which makes the caller's
 * classification fall through to "in progress" rather than miscounting
 * everything as pending.
 */
export async function pendingStageIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('pipeline_stages')
    .select('id, key')
    .in('key', PENDING_STAGE_KEYS as unknown as string[]);

  return new Set((data ?? []).map((s: { id: string }) => s.id));
}

export interface ChannelStats {
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  pendingRequests: number;
  inProgressRequests: number;
  overdueRequests: number;
  totalShifts: number;
  programCount: number;
}

/**
 * Per-channel aggregates for the channel list, the channel detail page and the
 * channel report.
 *
 * A single grouped pass rather than N per-row counts, so these stay cheap as
 * the archive grows.
 */
export async function getChannelStats(): Promise<Record<string, ChannelStats>> {
  const supabase = await createClient();

  const [requestsRes, programsRes, pendingIds] = await Promise.all([
    supabase
      .from('promo_requests')
      .select('channel_id, is_completed, due_state, shift_count, stage_id'),
    supabase.from('programs').select('channel_id'),
    pendingStageIds(supabase),
  ]);

  if (requestsRes.error) console.error('[stats] channel requests:', requestsRes.error.message);

  const stats: Record<string, ChannelStats> = {};

  const ensure = (channelId: string): ChannelStats => {
    if (!stats[channelId]) {
      stats[channelId] = {
        totalRequests: 0,
        activeRequests: 0,
        completedRequests: 0,
        pendingRequests: 0,
        inProgressRequests: 0,
        overdueRequests: 0,
        totalShifts: 0,
        programCount: 0,
      };
    }
    return stats[channelId];
  };

  for (const row of requestsRes.data ?? []) {
    if (!row.channel_id) continue;
    const s = ensure(row.channel_id);
    s.totalRequests += 1;
    s.totalShifts += row.shift_count ?? 0;
    if (row.is_completed) s.completedRequests += 1;
    else s.activeRequests += 1;
    if (row.due_state === 'overdue') s.overdueRequests += 1;
    if (pendingIds.has(row.stage_id)) s.pendingRequests += 1;
    else if (!row.is_completed) s.inProgressRequests += 1;
  }

  const programCounts = new Map<string, number>();
  for (const row of programsRes.data ?? []) {
    if (!row.channel_id) continue;
    ensure(row.channel_id);
    programCounts.set(row.channel_id, (programCounts.get(row.channel_id) ?? 0) + 1);
  }
  for (const [channelId, count] of programCounts) {
    stats[channelId].programCount = count;
  }

  return stats;
}

/**
 * Per-program aggregates. Same shape as channel stats, keyed by program id.
 */
export async function getProgramStats(): Promise<
  Record<
    string,
    {
      totalRequests: number;
      completedRequests: number;
      pendingRequests: number;
      inProgressRequests: number;
      overdueRequests: number;
      totalShifts: number;
      assigneeIds: string[];
    }
  >
> {
  const supabase = await createClient();

  // One query. Assignees come straight off the request rather than through a
  // join on request_participants: assignment is a column on the request, and a
  // join would measure participants rather than assignees.
  const [requestsRes, pendingIds] = await Promise.all([
    supabase
      .from('promo_requests')
      .select('program_id, assigned_to_id, is_completed, due_state, shift_count, stage_id'),
    pendingStageIds(supabase),
  ]);

  if (requestsRes.error) console.error('[stats] program requests:', requestsRes.error.message);

  const requests = requestsRes.data;

  const stats: Record<
    string,
    {
      totalRequests: number;
      completedRequests: number;
      pendingRequests: number;
      inProgressRequests: number;
      overdueRequests: number;
      totalShifts: number;
      assigneeIds: string[];
    }
  > = {};

  for (const row of requests ?? []) {
    if (!row.program_id) continue;
    if (!stats[row.program_id]) {
      stats[row.program_id] = {
        totalRequests: 0,
        completedRequests: 0,
        pendingRequests: 0,
        inProgressRequests: 0,
        overdueRequests: 0,
        totalShifts: 0,
        assigneeIds: [],
      };
    }
    const s = stats[row.program_id];
    s.totalRequests += 1;
    s.totalShifts += row.shift_count ?? 0;
    if (row.is_completed) s.completedRequests += 1;
    if (row.due_state === 'overdue') s.overdueRequests += 1;
    if (pendingIds.has(row.stage_id)) s.pendingRequests += 1;
    else if (!row.is_completed) s.inProgressRequests += 1;

    // De-duplicated: one person assigned ten requests still counts once.
    if (row.assigned_to_id && !s.assigneeIds.includes(row.assigned_to_id)) {
      s.assigneeIds.push(row.assigned_to_id);
    }
  }

  return stats;
}

/**
 * Per-project aggregates including a completion percentage.
 */
export async function getProjectStats(): Promise<
  Record<
    string,
    {
      totalRequests: number;
      completedRequests: number;
      activeRequests: number;
      totalShifts: number;
      completionRate: number;
      assigneeIds: string[];
    }
  >
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('promo_requests')
    .select('project_id, is_completed, shift_count, status');

  if (error) {
    console.error('[stats] project requests:', error.message);
    return {};
  }

  const stats: Record<
    string,
    {
      totalRequests: number;
      completedRequests: number;
      activeRequests: number;
      totalShifts: number;
      completionRate: number;
      assigneeIds: string[];
    }
  > = {};

  for (const row of data ?? []) {
    if (!row.project_id) continue;
    if (!stats[row.project_id]) {
      stats[row.project_id] = {
        totalRequests: 0,
        completedRequests: 0,
        activeRequests: 0,
        totalShifts: 0,
        completionRate: 0,
        assigneeIds: [],
      };
    }
    const s = stats[row.project_id];
    s.totalRequests += 1;
    s.totalShifts += row.shift_count ?? 0;
    if (row.is_completed) s.completedRequests += 1;
    else if (row.status === 'active') s.activeRequests += 1;
  }

  for (const s of Object.values(stats)) {
    s.completionRate = s.totalRequests
      ? Math.round((s.completedRequests / s.totalRequests) * 100)
      : 0;
  }

  return stats;
}