import { permissionsFor, canEditThisRequest } from '@/lib/auth/permissions';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { getRequestDetail } from '@/lib/queries/details';
import { getReferenceData } from '@/lib/data/references';
import { RequestDetailView } from '@/components/requests/request-detail-view';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getRequestDetail(id);
  if (!detail) return { title: 'Request not found' };
  return {
    title: detail.request.request_code ?? 'Request',
    description: detail.request.title,
  };
}

export default async function RequestDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const session = await requireUser();
  const permission = permissionsFor(session.role);

  const [detail, references] = await Promise.all([getRequestDetail(id), getReferenceData()]);

  if (!detail) notFound();

  const participantIds = detail.participants.map((p) => p.user_id);
  const canEdit = canEditThisRequest(permission, detail.request, session.profile.id, participantIds);

  return (
    <RequestDetailView
      detail={detail}
      references={references}
      permission={permission}
      canEdit={canEdit}
      currentUserId={session.profile.id}
      currentUserName={session.profile.full_name}
      warning={query.warning}
    />
  );
}