import type { DueState, PriorityLevel } from '@/types/database';
import type { ReportFilters } from '@/lib/reports/aggregate';

/**
 * Report filter parsing shared by every report page.
 *
 * Each report supports a different subset of filters, so the available list is
 * passed in and the helper only reads the params that apply. Values are
 * validated against a known set rather than cast: a hand-edited URL must not be
 * able to push an arbitrary string into the query.
 */

export type FilterableDimension =
  | 'channel'
  | 'program'
  | 'project'
  | 'goal'
  | 'user'
  | 'stage'
  | 'priority';

export function parseReportFilters(
  params: Record<string, string | string[] | undefined>,
  available: FilterableDimension[],
): ReportFilters {
  const filters: ReportFilters = {};

  const from = single(params.from);
  const to = single(params.to);
  if (isIsoDate(from)) filters.dateFrom = from;
  if (isIsoDate(to)) filters.dateTo = to;

  const dateField = single(params.dateField);
  if (dateField === 'request_date' || dateField === 'due_date' || dateField === 'created_at') {
    filters.dateField = dateField;
  }

  const search = single(params.q);
  if (search) filters.search = search;

  const status = single(params.status);
  if (status === 'active' || status === 'archived' || status === 'all') filters.status = status;

  if (available.includes('channel')) {
    const channel = single(params.channel);
    if (channel) filters.channelIds = [channel];
  }

  if (available.includes('program')) {
    const program = single(params.program);
    if (program) filters.programIds = [program];
  }

  if (available.includes('project')) {
    const project = single(params.project);
    if (project) filters.projectIds = [project];
  }

  if (available.includes('goal')) {
    const goal = single(params.goal);
    if (goal) filters.goalIds = [goal];
  }

  if (available.includes('user')) {
    const user = single(params.user);
    if (user) filters.assigneeIds = [user];
  }

  if (available.includes('stage')) {
    const stage = single(params.stage);
    if (stage) filters.stageIds = [stage];
  }

  if (available.includes('priority')) {
    const priorities = list(params.priority).filter(isPriority);
    if (priorities.length) filters.priorities = priorities;
  }

  const dueStates = list(params.due).filter(isDueState);
  if (dueStates.length) filters.dueStates = dueStates;

  return filters;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isPriority(value: string): value is PriorityLevel {
  return value === 'urgent' || value === 'high' || value === 'normal' || value === 'low';
}

function isDueState(value: string): value is DueState {
  return (
    value === 'on_track' ||
    value === 'due_soon' ||
    value === 'overdue' ||
    value === 'completed'
  );
}
