import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getDashboardData, type DashboardFilters } from '@/lib/queries/dashboard';
import { getReferenceData } from '@/lib/data/references';
import { DashboardView } from './dashboard-view';

export const metadata: Metadata = { title: 'Dashboard' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const params = await searchParams;
  const permission = permissionsFor(session.role);

  // Parse filters from the URL so dashboard state is shareable and survives a
  // refresh. `scope=me` narrows everything to the signed-in user's workload.
  const scope = single(params.scope) === 'me' ? 'me' : 'all';
  const filters: DashboardFilters = {
    dateFrom: single(params.from),
    dateTo: single(params.to),
    channelIds: multi(params.channel),
    programIds: multi(params.program),
    projectIds: multi(params.project),
    assigneeIds: multi(params.user),
    stageIds: multi(params.stage),
    goalIds: multi(params.goal),
    dateField: (single(params.dateField) as DashboardFilters['dateField']) ?? 'request_date',
    userId: scope === 'me' ? session.profile.id : undefined,
  };

  const [data, references] = await Promise.all([getDashboardData(filters), getReferenceData()]);

  return (
    <DashboardView
      data={data}
      references={references}
      permission={permission}
      currentUser={session.profile}
      scope={scope}
      filters={filters}
      denied={single(params.denied) === '1'}
    />
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function multi(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : value.split(',');
  return list.filter(Boolean);
}