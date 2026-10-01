import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { PAGE_SIZE, type SortableRequestColumn } from '@/lib/constants';
import type { DueState, PriorityLevel, PromoRequest } from '@/types/database';

/**
 * Promo request queries.
 *
 * All list filtering, sorting and pagination happens in Postgres. The client
 * never receives more than one page, and every query runs under RLS so a viewer
 * physically cannot fetch rows they should not see.
 */

export interface RequestFilters {
  search?: string;
  stageIds?: string[];
  channelIds?: string[];
  programIds?: string[];
  projectIds?: string[];
  assigneeIds?: string[];
  goalIds?: string[];
  priorities?: PriorityLevel[];
  dueStates?: DueState[];
  status?: 'active' | 'archived' | 'all';
  /** Only requests assigned to the current user. */
  mine?: boolean;
  /** Only requests the user participates in. */
  participating?: boolean;
  /** Only requests the user requested. */
  requestedByMe?: boolean;
  dateFrom?: string;
  dateTo?: string;
  /** Which date column the range applies to. */
  dateField?: 'request_date' | 'due_date' | 'created_at';
  sort?: SortableRequestColumn;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  /** Populated by getBoardData so participant filtering works there too. */
  currentUserId?: string;
}

export interface RequestWithRelations extends PromoRequest {
  channel: { id: string; name: string; color: string } | null;
  program: { id: string; name: string } | null;
  project: { id: string; name: string; code: string | null } | null;
  goal: { id: string; name: string; color: string } | null;
  promo_type: { id: string; name: string } | null;
  stage: { id: string; name: string; position: number; color: string } | null;
  assigned_to: { id: string; full_name: string; avatar_url: string | null } | null;
  requested_by: { id: string; full_name: string; avatar_url: string | null } | null;
  request_participants: Array<{ count: number }>;
}

export interface RequestListResult {
  rows: RequestListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const LIST_SELECT = `
  id,
  request_code, title, request_date, requested_by_id, requested_by_name,
  company_department, program_id, channel_id, project_id, episodes_count,
  promo_type_id, goal_id, priority, due_date, assigned_to_id, shift_count,
  production_start_date, production_end_date, call_time, location,
  is_completed, completed_at, status, due_state, stage_id, stage_name,
  stage_position, created_at, updated_at,
  channel:channels ( id, name, color ),
  program:programs ( id, name ),
  project:projects ( id, name, code ),
  goal:promo_goals ( id, name, color ),
  promo_type:promo_types ( id, name ),
  stage:pipeline_stages ( id, name, position, color ),
  assigned_to:profiles!promo_requests_assigned_to_id_fkey ( id, full_name, avatar_url ),
  requested_by:profiles!promo_requests_requested_by_id_fkey ( id, full_name, avatar_url ),
  request_participants ( user_id )
`;

/** Extracts the participant count from the nested array join. */
function participantCountOf(row: RequestWithRelations): number {
  return row.request_participants?.length ?? 0;
}

export type RequestListItem = RequestWithRelations & { participant_count: number };

export async function getRequests(
  filters: RequestFilters = {},
): Promise<{ rows: RequestListItem[]; total: number; page: number; pageSize: number; pageCount: number }> {
  const supabase = await createClient();

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? PAGE_SIZE, 1), 100);
  const from = (page - 1) * pageSize;
  const userId = filters.currentUserId;

  let query = supabase.from('promo_requests').select(LIST_SELECT, { count: 'exact' });

  // --- status scope --------------------------------------------------------
  if (filters.status === 'archived') {
    query = query.eq('status', 'archived');
  } else if (filters.status !== 'all') {
    query = query.eq('status', 'active');
  }

  // --- text search ---------------------------------------------------------
  // One round trip: PostgREST ORs the columns in the `or=(...)` filter.
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[,()%]/g, ' ');
    if (term.length >= 2) {
      query = query.or(
        [
          `title.ilike.%${term}%`,
          `request_code.ilike.%${term}%`,
          `requested_by_name.ilike.%${term}%`,
          `notes.ilike.%${term}%`,
          `promo_description.ilike.%${term}%`,
          `key_message.ilike.%${term}%`,
          `location.ilike.%${term}%`,
          `special_instructions.ilike.%${term}%`,
        ].join(','),
      );
    }
  }

  // --- relation filters ----------------------------------------------------
  if (filters.stageIds?.length) query = query.in('stage_id', filters.stageIds);
  if (filters.channelIds?.length) query = query.in('channel_id', filters.channelIds);
  if (filters.programIds?.length) query = query.in('program_id', filters.programIds);
  if (filters.projectIds?.length) query = query.in('project_id', filters.projectIds);
  if (filters.goalIds?.length) query = query.in('goal_id', filters.goalIds);
  if (filters.priorities?.length) query = query.in('priority', filters.priorities);
  if (filters.dueStates?.length) query = query.in('due_state', filters.dueStates);

  if (filters.assigneeIds?.length) {
    query = query.in('assigned_to_id', filters.assigneeIds);
  } else if (filters.mine && userId) {
    query = query.eq('assigned_to_id', userId);
  } else if (filters.requestedByMe && userId) {
    query = query.eq('requested_by_id', userId);
  }

  if (filters.participating && userId) {
    query = query.eq('request_participants.user_id', userId);
  }

  // --- date range ----------------------------------------------------------
  const dateField = filters.dateField ?? 'request_date';
  if (filters.dateFrom) query = query.gte(dateField, filters.dateFrom);
  if (filters.dateTo) query = query.lte(dateField, filters.dateTo);

  // --- sorting -------------------------------------------------------------
  const sort = filters.sort ?? 'created_at';
  const dir = filters.sortDir ?? 'desc';
  query = query.order(sort, { ascending: dir === 'asc', nullsFirst: false });
  // Stable secondary key keeps pagination deterministic across pages.
  query = query.order('id', { ascending: false });

  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[requests] list query failed:', error.message);
    return { rows: [], total: 0, page, pageSize, pageCount: 0 };
  }

  const rows = ((data ?? []) as unknown as RequestWithRelations[]).map((row) => ({
    ...row,
    participant_count: participantCountOf(row),
  }));

  const total = count ?? 0;

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(Math.ceil(total / pageSize), 1),
  };
}

/** Board payload: active requests bucketed by stage. */
export async function getBoardData(filters: RequestFilters = {}): Promise<RequestListItem[]> {
  const { rows } = await getRequests({
    ...filters,
    page: 1,
    pageSize: 100,
    status: 'active',
    sort: 'stage_position',
    sortDir: 'asc',
  });
  return rows;
}

/** Lightweight variant for pickers and autocomplete. */
export async function getRequestOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('promo_requests')
    .select('id, request_code, title, assigned_to_id')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[requests] options query failed:', error.message);
    return [] as Array<{ id: string; label: string; assignedToId: string | null }>;
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    label: `${r.request_code ?? '—'} · ${r.title}`,
    assignedToId: r.assigned_to_id,
  }));
}