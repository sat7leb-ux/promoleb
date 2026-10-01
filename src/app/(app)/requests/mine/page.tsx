import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getRequests, type RequestFilters } from '@/lib/queries/requests';
import { getReferenceData } from '@/lib/data/references';
import { RequestsView } from '../requests-view';
import type { SortableRequestColumn } from '@/lib/constants';
import type { DueState } from '@/types/database';

export const metadata: Metadata = { title: 'My Requests' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MyRequestsPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const params = await searchParams;

  // `mine` is forced on: this page is by definition the signed-in user's work.
  // Default ordering is soonest-due-first, which is what a producer wants.
  const filters: RequestFilters = {
    mine: true,
    search: single(params.q),
    stageIds: multi(params.stage),
    channelIds: multi(params.channel),
    dueStates: dueStates(params.due),
    priorities: multi(params.priority) as RequestFilters['priorities'],
    status: 'active',
    sort: (single(params.sort) as SortableRequestColumn) ?? 'due_date',
    sortDir: (single(params.dir) as 'asc' | 'desc') ?? 'asc',
    page: Number(single(params.page) ?? 1) || 1,
  };

  const [result, references] = await Promise.all([getRequests(filters), getReferenceData()]);

  return (
    <RequestsView
      result={result}
      references={references}
      permission={permission}
      currentUserId={session.profile.id}
      filters={filters}
      variant="mine"
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