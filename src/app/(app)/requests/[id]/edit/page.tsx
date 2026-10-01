import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getRequestDetail } from '@/lib/queries/details';
import { getReferenceData } from '@/lib/data/references';
import { RequestForm } from '@/components/requests/request-form';

export const metadata: Metadata = { title: 'Edit Promo Request' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRequestPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  const [detail, references] = await Promise.all([getRequestDetail(id), getReferenceData()]);
  if (!detail) notFound();

  // Mirrors the server-side check in updateRequestAction so the form is never
  // rendered to someone who could not save it.
  const participantIds = detail.participants.map((p) => p.user_id);
  const canEdit =
    permission.canManageProjects ||
    detail.request.assigned_to_id === session.profile.id ||
    detail.request.requested_by_id === session.profile.id ||
    participantIds.includes(session.profile.id);

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">You cannot edit this request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can only edit requests you are assigned to, that you raised, or that you participate
          in. Ask the assigned producer or a manager to make changes.
        </p>
      </div>
    );
  }

  if (detail.request.status === 'archived') {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">This request is archived</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Archived requests are read-only. Restore it from the request page to make changes.
        </p>
      </div>
    );
  }

  const r = detail.request;

  return (
    <RequestForm
      mode="edit"
      references={references}
      initialParticipantIds={participantIds}
      currentUser={{
        id: session.profile.id,
        full_name: session.profile.full_name,
        email: session.profile.email,
      }}
      initialValues={{
        id: r.id,
        title: r.title,
        request_date: r.request_date,
        requested_by_id: r.requested_by_id,
        requested_by_name: r.requested_by_name,
        company_department: r.company_department,
        project_id: r.project_id,
        program_id: r.program_id,
        channel_id: r.channel_id,
        goal_id: r.goal_id,
        promo_type_id: r.promo_type_id,
        episodes_count: r.episodes_count,
        priority: r.priority,
        due_date: r.due_date,
        assigned_to_id: r.assigned_to_id,
        shift_count: r.shift_count,
        production_start_date: r.production_start_date,
        production_end_date: r.production_end_date,
        call_time: r.call_time,
        location: r.location,
        notes: r.notes,
        special_instructions: r.special_instructions,
        internal_notes: r.internal_notes,
        promo_goal: r.promo_goal,
        target_audience: r.target_audience,
        promo_description: r.promo_description,
        key_message: r.key_message,
        required_deliverables: r.required_deliverables,
        duration_seconds: r.duration_seconds,
        format: r.format,
        language: r.language,
        version: r.version,
        stage_id: r.stage_id,
      }}
    />
  );
}