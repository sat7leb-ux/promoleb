import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { getProjectStats } from '@/lib/queries/stats';
import { ProjectsView } from '@/components/projects/projects-view';
import type { Profile, Program, Project } from '@/types/database';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const supabase = await createClient();

  // Projects, their memberships and their program links all load together so
  // the list view never needs a round trip per card.
  const [projectsRes, membersRes, linksRes, profilesRes, programsRes, stats] = await Promise.all([
    supabase.from('projects').select('*').order('status').order('name'),
    supabase.from('project_members').select('project_id, user_id'),
    supabase.from('project_programs').select('project_id, program_id'),
    supabase
      .from('profiles')
      .select('*')
      .eq('status', 'active')
      .order('full_name'),
    supabase.from('programs').select('*').eq('status', 'active').order('name'),
    getProjectStats(),
  ]);

  const projects = (projectsRes.data ?? []) as Project[];

  // Fold the join rows into maps once, rather than scanning arrays per card.
  const membersByProject: Record<string, string[]> = {};
  for (const row of (membersRes.data ?? []) as Array<{ project_id: string; user_id: string }>) {
    (membersByProject[row.project_id] ??= []).push(row.user_id);
  }

  const programsByProject: Record<string, string[]> = {};
  for (const row of (linksRes.data ?? []) as Array<{
    project_id: string;
    program_id: string;
  }>) {
    (programsByProject[row.project_id] ??= []).push(row.program_id);
  }

  const memberCounts = Object.fromEntries(
    Object.entries(membersByProject).map(([k, v]) => [k, v.length]),
  );

  return (
    <ProjectsView
      projects={projects}
      profiles={(profilesRes.data ?? []) as Profile[]}
      programs={(programsRes.data ?? []) as Program[]}
      membersByProject={membersByProject}
      programsByProject={programsByProject}
      memberCounts={memberCounts}
      stats={stats}
      canManage={permission.canManageProjects}
    />
  );
}