import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getReferenceData } from '@/lib/data/references';
import { getProgramStats } from '@/lib/queries/stats';
import { ProgramsView } from '@/components/programs/programs-view';

export const metadata: Metadata = { title: 'Programs' };

export default async function ProgramsPage() {
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  const [references, stats] = await Promise.all([getReferenceData(), getProgramStats()]);

  return (
    <ProgramsView
      programs={references.programs}
      channels={references.channels}
      profiles={references.profiles}
      stats={stats}
      canManage={permission.canManageReferenceData}
    />
  );
}