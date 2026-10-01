import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getReferenceData } from '@/lib/data/references';
import { RequestForm } from '@/components/requests/request-form';

export const metadata: Metadata = { title: 'New Promo Request' };

interface PageProps {
  /** Detail pages deep-link here with ?project / ?program / ?channel preselected. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewRequestPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  if (!permission.canCreateRequests) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">You cannot create requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role is {session.role.replace('_', ' ')}. Ask a Promo Manager or Administrator to
          raise a request on your behalf.
        </p>
      </div>
    );
  }

  const references = await getReferenceData();

  // Preselect from the query string when arriving from a project, program or
  // channel page. Anything unrecognised is ignored rather than trusted — these
  // land in a form, and the form still validates, but there is no reason to
  // prefill a value that does not exist.
  const params = await searchParams;
  const one = (key: string): string | null => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() || null;
  };

  const preselect = {
    project_id: one('project'),
    program_id: one('program'),
    channel_id: one('channel'),
    goal_id: one('goal'),
    assigned_to_id: one('assignee'),
  };

  const hasPreselect = Object.values(preselect).some(Boolean);

  return (
    <RequestForm
      mode="create"
      references={references}
      preselect={hasPreselect ? preselect : undefined}
      currentUser={{
        id: session.profile.id,
        full_name: session.profile.full_name,
        email: session.profile.email,
      }}
    />
  );
}