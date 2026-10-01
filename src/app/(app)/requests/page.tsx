import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getRequests, type RequestFilters } from '@/lib/queries/requests';
import { getReferenceData } from '@/lib/data/references';
import { RequestsView } from './requests-view';
import type { SortableRequestColumn } from '@/lib/constants';
import type { DueState } from '@/types/database';

export const metadata: Metadata = { title: 'Requests' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RequestsPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const params = await searchParams;
  const permission = permissionsFor(session.role);

  const sortParam = single(params.sort) as SortableRequestColumn | undefined;
  const filters: RequestFilters = {
    search: single(params.q),
    stageIds: multi(params.stage),
    channelIds: multi(params.channel),
    programIds: multi(params.program),
    projectIds: multi(params.project),
    assigneeIds: multi(params.user),
    goalIds: multi(params.goal),
    priorities: multi(params.priority) as RequestFilters['priorities'],
    dueStates: dueStates(params.due),
    status: (single(params.status) as RequestFilters['status']) ?? 'active',
    participating: single(params.participating) === '1' || undefined,
    requestedByMe: single(params.requested) === '1' || undefined,
    dateFrom: single(params.from),
    dateTo: single(params.to),
    dateField: single(params.dateField) as RequestFilters['dateField'],
    sort: sortParam,
    sortDir: (single(params.dir) as 'asc' | 'desc') ?? 'desc',
    page: Number(single(params.page) ?? 1) || 1,
  };

  const [result, references] = await Promise.all([
    getRequests(filters),
    getReferenceData(),
  ]);

  return (
    <RequestsView
      result={result}
      references={references}
      permission={permission}
      currentUserId={session.profile.id}
      filters={filters}
    />
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function multi(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : value.split(',');
  const filtered = list.filter(Boolean);
  return filtered.length ? filtered : undefined;
}
/** Narrows a comma-separated URL value to the due-state values the app knows. */
function dueStates(value: string | string[] | undefined): DueState[] | undefined {
  const allowed: DueState[] = ['on_track', 'due_soon', 'overdue', 'completed'];
  const list = multi(value) ?? [];
  const filtered = list.filter((v): v is DueState => allowed.includes(v as DueState));
  return filtered.length ? filtered : undefined;
}