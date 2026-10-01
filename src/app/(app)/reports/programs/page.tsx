import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getReferenceData } from '@/lib/data/references';
import { getDimensionReport } from '@/lib/reports/aggregate';
import { parseReportFilters, type FilterableDimension } from '@/components/reports/report-filters';
import { ReportView, REPORT_COLUMNS } from '@/components/reports/report-view';

export const metadata: Metadata = { title: 'Program Report' };

/** The channel report filters by everything except the channel itself. */
const AVAILABLE: FilterableDimension[] = [
  'channel',
  'project',
  'goal',
  'user',
  'stage',
  'priority',
];

export default async function ProgramReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const params = await searchParams;

  const filters = parseReportFilters(params, AVAILABLE);
  const [report, references] = await Promise.all([
    getDimensionReport('program', filters),
    getReferenceData(),
  ]);

  return (
    <ReportView
      config={{
        title: 'Program Report',
        description:
          'Which shows are absorbing promo effort, with status mix, shift load and average turnaround per program.',
        dimensionLabel: 'Program',
        columns: REPORT_COLUMNS,
      }}
      rows={report.rows}
      totals={report.totals}
      references={references}
      filters={filters}
      available={AVAILABLE}
      canViewUsers={permission.canViewUsers}
    />
  );
}