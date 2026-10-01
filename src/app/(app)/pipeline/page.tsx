import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getBoardData } from '@/lib/queries/requests';
import { getReferenceData } from '@/lib/data/references';
import { PipelineBoard } from '@/components/pipeline/pipeline-board';

export const metadata: Metadata = { title: 'Pipeline' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PipelinePage({ searchParams }: PageProps) {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const params = await searchParams;

  const [rows, references] = await Promise.all([
    getBoardData({
      channelIds: multi(params.channel),
      assigneeIds: multi(params.user),
      search: single(params.q),
      currentUserId: session.profile.id,
    }),
    getReferenceData(),
  ]);

  return (
    <PipelineBoard
      rows={rows}
      stages={references.stages}
      channels={references.channels}
      canChangeStatus={permission.canChangeStatus}
      currentUserId={session.profile.id}
    />
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function multi(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = (Array.isArray(value) ? value : value.split(',')).filter(Boolean);
  return list.length ? list : undefined;
}