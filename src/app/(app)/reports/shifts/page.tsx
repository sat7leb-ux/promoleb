import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getReferenceData } from '@/lib/data/references';
import {
  getShiftsByChannel,
  getShiftsByProgram,
  getShiftsPerRequest,
} from '@/lib/reports/aggregate';
import { parseReportFilters, type FilterableDimension } from '@/components/reports/report-filters';
import { ShiftReportView } from '@/components/reports/shift-report-view';

export const metadata: Metadata = { title: 'Shift Report' };

const AVAILABLE: FilterableDimension[] = ['channel', 'program'];

export default async function ShiftReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const params = await searchParams;

  const filters = parseReportFilters(params, AVAILABLE);

  const [byChannel, byProgram, perRequest, references] = await Promise.all([
    getShiftsByChannel(filters),
    getShiftsByProgram(filters),
    getShiftsPerRequest(filters),
    getReferenceData(),
  ]);

  return (
    <ShiftReportView
      byChannel={byChannel}
      byProgram={byProgram}
      perRequest={perRequest}
      references={references}
      filters={filters}
      available={AVAILABLE}
      canViewUsers={permission.canViewUsers}
    />
  );
}