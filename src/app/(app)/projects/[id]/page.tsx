import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarRange, FileText, FolderKanban, UserCog, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { getProjectStats } from '@/lib/queries/stats';
import { getRequests } from '@/lib/queries/requests';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RequestCard } from '@/components/requests/request-card';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EditProjectDialog } from '@/components/projects/edit-project-dialog';
import { percentage, formatDate } from '@/lib/utils';
import type { Profile, Program, Project } from '@/types/database';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('projects').select('name').eq('id', id).maybeSingle();
  return { title: (data as { name: string } | null)?.name ?? 'Project' };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const supabase = await createClient();

  const [projectRes, membersRes, linksRes, profilesRes, programsRes, stats, requests] =
    await Promise.all([
      supabase.from('projects').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('project_members')
        .select('user_id, user:profiles ( id, full_name, job_title, avatar_url )')
        .eq('project_id', id),
      supabase
        .from('project_programs')
        .select('program:programs ( id, name, status )')
        .eq('project_id', id),
      // Reference data for the edit dialog, so it offers every valid choice.
      supabase
        .from('profiles')
        .select('*')
        .eq('status', 'active')
        .order('full_name'),
      supabase.from('programs').select('*').eq('status', 'active').order('name'),
      getProjectStats(),
      getRequests({ projectIds: [id], currentUserId: session.profile.id, pageSize: 24 }),
    ]);

  if (projectRes.error || !projectRes.data) notFound();

  const project = projectRes.data as Project;
  const s = stats[id];

  const members = ((membersRes.data ?? []) as Array<{
    user_id: string;
    user: Profile | null;
  }>)
    .map((r) => r.user)
    .filter((u): u is Profile => Boolean(u));

  const programs = (
    (linksRes.data ?? []) as Array<{ program: { id: string; name: string; status: string } | null }>
  )
    .map((r) => r.program)
    .filter((p): p is { id: string; name: string; status: string } => Boolean(p));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/projects">
            <ArrowLeft className="size-4" />
            All projects
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              {project.status !== 'active' && (
                <Badge variant="secondary" className="capitalize">
                  {project.status}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[project.code, project.status === 'archived' ? 'Archived' : null]
                .filter(Boolean)
                .join(' · ') || 'Project'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/projects?project=${project.id}`}>Project report</Link>
            </Button>
            {permission.canManageProjects && (
              <EditProjectDialog
                project={project}
                profiles={(profilesRes.data ?? []) as Profile[]}
                programs={(programsRes.data ?? []) as Program[]}
                memberIds={members.map((m) => m.id)}
                programIds={programs.map((p) => p.id)}
              />
            )}
            {permission.canCreateRequests && (
              <Button asChild size="sm">
                <Link href={`/requests/new?project=${project.id}`}>New request</Link>
              </Button>
            )}
          </div>
        </div>

        {project.description && (
          <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
        )}

        {(project.start_date || project.end_date) && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarRange className="size-4" aria-hidden />
            {project.start_date ? formatDate(project.start_date) : 'No start date'}
            {' → '}
            {project.end_date ? formatDate(project.end_date) : 'No end date'}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total requests" value={s?.totalRequests ?? 0} />
        <Stat label="Active" value={s?.activeRequests ?? 0} />
        <Stat label="Completed" value={s?.completedRequests ?? 0} tone="emerald" />
        <Stat label="Total shifts" value={s?.totalShifts ?? 0} />
      </div>

      {s && s.totalRequests > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Completion rate</span>
            <span className="tabular-nums font-semibold">
              {percentage(s.completedRequests, s.totalRequests)}%
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percentage(s.completedRequests, s.totalRequests)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Project completion rate"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.max(percentage(s.completedRequests, s.totalRequests), 2)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <UserCog className="size-4" aria-hidden />
            Manager
          </h2>
          {project.manager_id ? (
            <ManagerCard managerId={project.manager_id} />
          ) : (
            <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
              No project manager assigned.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4" aria-hidden />
            Team ({members.length})
          </h2>
          {members.length === 0 ? (
            <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
              Nobody has been added to this project yet.
            </p>
          ) : (
            <ul className="space-y-1 rounded-xl border bg-card p-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.full_name}</p>
                    {m.job_title && (
                      <p className="truncate text-xs text-muted-foreground">{m.job_title}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <FileText className="size-4" aria-hidden />
            Programs ({programs.length})
          </h2>
          {programs.length === 0 ? (
            <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
              No programs linked. Requests can still be created against any channel.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {programs.map((p) => (
                <Link
                  key={p.id}
                  href={`/programs/${p.id}`}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {p.name}
                  {p.status !== 'active' && (
                    <span className="ml-1.5 text-muted-foreground">({p.status})</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <FolderKanban className="size-4" aria-hidden />
            Requests ({requests.total})
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/requests?project=${project.id}`}>See all</Link>
          </Button>
        </div>

        {requests.rows.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="size-6" />}
            title="No requests in this project yet"
            description="Requests raised against this project will appear here, with their shifts and deadlines."
            className="border"
            action={
              permission.canCreateRequests ? (
                <Button asChild>
                  <Link href={`/requests/new?project=${project.id}`}>Create a request</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {requests.rows.map((request, index) => (
              <RequestCard key={request.id} request={request} index={index} />
            ))}
          </div>
        )}
      </section>

      {project.notes && (
        <section className="rounded-xl border bg-muted/40 p-4">
          <h2 className="text-sm font-semibold">Internal notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{project.notes}</p>
        </section>
      )}
    </div>
  );
}

async function ManagerCard({ managerId }: { managerId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', managerId)
    .maybeSingle();

  const manager = data as Profile | null;
  if (!manager) {
    return (
      <p className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
        The assigned manager no longer has an active profile.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
      <UserAvatar name={manager.full_name} avatarUrl={manager.avatar_url} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{manager.full_name}</p>
        {manager.job_title && (
          <p className="truncate text-xs text-muted-foreground">{manager.job_title}</p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'emerald';
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' +
          (tone === 'emerald' ? 'text-emerald-600' : '')
        }
      >
        {value}
      </p>
    </div>
  );
}