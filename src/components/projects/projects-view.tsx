'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarRange, FolderKanban, Pencil, Plus, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectFormDialog } from './project-form';
import { STATUS_META } from '@/lib/constants';
import { normalise, formatDate } from '@/lib/utils';
import type { Profile, Program, Project } from '@/types/database';

interface Props {
  projects: Project[];
  profiles: Profile[];
  programs: Program[];
  /** Member ids per project, so the form round-trips an edit correctly. */
  membersByProject: Record<string, string[]>;
  /** Program ids per project, likewise. */
  programsByProject: Record<string, string[]>;
  memberCounts: Record<string, number>;
  stats: Record<string, { totalRequests: number; totalShifts: number; completionRate: number }>;
  canManage: boolean;
}

type Scope = 'active' | 'archived' | 'all';

export function ProjectsView({
  projects,
  profiles,
  programs,
  membersByProject,
  programsByProject,
  memberCounts,
  stats,
  canManage,
}: Props) {
  const [term, setTerm] = useState('');
  const [scope, setScope] = useState<Scope>('active');
  const [editing, setEditing] = useState<Project | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const visible = useMemo(() => {
    const needle = normalise(term.trim());
    return projects.filter((p) => {
      if (scope === 'active' && p.status !== 'active') return false;
      if (scope === 'archived' && p.status !== 'archived') return false;
      if (!needle) return true;
      return normalise(p.name).includes(needle) || normalise(p.code ?? '').includes(needle);
    });
  }, [projects, term, scope]);

  const counts = useMemo(
    () => ({
      active: projects.filter((p) => p.status === 'active').length,
      archived: projects.filter((p) => p.status === 'archived').length,
      all: projects.length,
    }),
    [projects],
  );

  const SCOPES: Array<{ key: Scope; label: string; count: number }> = [
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'archived', label: 'Archived', count: counts.archived },
    { key: 'all', label: 'All', count: counts.all },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        description="Campaigns and initiatives that group promo requests under a shared objective."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/reports/projects">
                <BarChart3 className="size-4" />
                Project report
              </Link>
            </Button>
            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                New project
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex gap-1 rounded-lg border p-1"
          role="tablist"
          aria-label="Filter projects"
        >
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={scope === s.key}
              onClick={() => setScope(s.key)}
              className={
                'rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                (scope === s.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground')
              }
            >
              {s.label}
              <span className="ml-1.5 tabular-nums opacity-70">{s.count}</span>
            </button>
          ))}
        </div>

        {projects.length > 5 && (
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search projects."
              aria-label="Search projects"
              className="pl-9"
            />
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title={
            projects.length === 0
              ? 'No projects yet'
              : scope === 'archived'
                ? 'No archived projects'
                : 'No projects match'
          }
          description={
            projects.length === 0
              ? 'Projects bundle related promo requests — a seasonal campaign, a channel relaunch, a special event.'
              : 'Try another filter or a different search term.'
          }
          action={
            projects.length === 0 && canManage ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Create the first project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => {
            const s = stats[project.id];
            const completion = s?.completionRate ?? 0;

            return (
              <article key={project.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {project.name}
                      </Link>
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {project.code || 'No code'}
                    </p>
                  </div>

                  {project.status !== 'active' && (
                    <StatusBadge
                      tone={STATUS_META[project.status]?.badge ?? STATUS_META.active.badge}
                      label={STATUS_META[project.status]?.label ?? project.status}
                    />
                  )}
                </div>

                {project.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {project.description}
                  </p>
                )}

                {(project.start_date || project.end_date) && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CalendarRange className="size-3 shrink-0" aria-hidden />
                    {project.start_date ? formatDate(project.start_date) : 'No start'}
                    {' → '}
                    {project.end_date ? formatDate(project.end_date) : 'No end'}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Requests
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {s?.totalRequests ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Shifts
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {s?.totalShifts ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Team
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {memberCounts[project.id] ?? 0}
                    </dd>
                  </div>
                </dl>

                {s && s.totalRequests > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{completion}% completed</span>
                    </div>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={completion}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${project.name} completion`}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(completion, 2)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <Button asChild variant="ghost" size="sm" className="flex-1">
                    <Link href={`/projects/${project.id}`}>
                      <Users className="size-3.5" />
                      Open
                    </Link>
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(project);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {visible.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {visible.length} of {projects.length} project
          {projects.length === 1 ? '' : 's'}.
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'New project'}</DialogTitle>
            <DialogDescription>
              A project carries its own team and linked programs, and feeds the project report.
            </DialogDescription>
          </DialogHeader>

          <ProjectFormDialog
            key={editing?.id ?? 'new'}
            project={editing}
            profiles={profiles}
            programs={programs}
            memberIds={editing ? (membersByProject[editing.id] ?? []) : []}
            programIds={editing ? (programsByProject[editing.id] ?? []) : []}
            onOpenChange={setDialogOpen}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}