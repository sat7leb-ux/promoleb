import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  Channel,
  PipelineStage,
  Profile,
  Program,
  Project,
  PromoGoal,
  PromoType,
} from '@/types/database';

/**
 * Reference data lookups.
 *
 * These run once per server render pass (React `cache`) and are consumed by
 * layouts, forms and filters. Reference tables are small and change rarely, so
 * `unstable_cache` is layered on for anything rendered across requests.
 */

async function loadReferenceData() {
  const supabase = await createClient();

  const [channels, programs, stages, goals, promoTypes, projects, profiles] = await Promise.all([
    supabase.from('channels').select('*').order('sort_order').order('name'),
    supabase.from('programs').select('*').order('name'),
    supabase.from('pipeline_stages').select('*').order('position'),
    supabase.from('promo_goals').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('promo_types').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('projects').select('*').order('name'),
    supabase.from('profiles').select('*').eq('status', 'active').order('full_name'),
  ]);

  // A failure here is almost always a schema or RLS problem. Log it loudly and
  // return empties so pages render with clear empty states rather than crashing.
  const errors = [
    ['channels', channels.error],
    ['programs', programs.error],
    ['pipeline_stages', stages.error],
    ['promo_goals', goals.error],
    ['promo_types', promoTypes.error],
    ['projects', projects.error],
    ['profiles', profiles.error],
  ].filter(([, e]) => e);

  for (const [table, error] of errors) {
    console.error(`[references] failed to load ${table}:`, (error as Error).message);
  }

  return {
    channels: (channels.data ?? []) as Channel[],
    programs: (programs.data ?? []) as Program[],
    stages: (stages.data ?? []) as PipelineStage[],
    goals: (goals.data ?? []) as PromoGoal[],
    promoTypes: (promoTypes.data ?? []) as PromoType[],
    projects: (projects.data ?? []) as Project[],
    profiles: (profiles.data ?? []) as Profile[],
  };
}

export const getReferenceData = cache(loadReferenceData);

/** Active (non-archived) channels — the default for forms and filters. */
export async function getActiveChannels(): Promise<Channel[]> {
  const { channels } = await getReferenceData();
  return channels.filter((c) => c.status === 'active');
}

export async function getActivePrograms(): Promise<Program[]> {
  const { programs } = await getReferenceData();
  return programs.filter((p) => p.status === 'active');
}

export async function getActiveProjects(): Promise<Project[]> {
  const { projects } = await getReferenceData();
  return projects.filter((p) => p.status === 'active');
}

/** The "New" stage, used as the default for new requests. */
export async function getDefaultStage(): Promise<PipelineStage | null> {
  const { stages } = await getReferenceData();
  return stages.find((s) => s.key === 'new') ?? stages[0] ?? null;
}

/** Programs belonging to a channel — powers the cascading form selects. */
export async function getProgramsForChannel(channelId: string): Promise<Program[]> {
  const { programs } = await getReferenceData();
  return programs.filter(
    (p) => p.channel_id === channelId && p.status !== 'archived',
  );
}

export function findChannel(channels: Channel[], id: string | null): Channel | undefined {
  return id ? channels.find((c) => c.id === id) : undefined;
}

export function findProgram(programs: Program[], id: string | null): Program | undefined {
  return id ? programs.find((p) => p.id === id) : undefined;
}

export function findProject(projects: Project[], id: string | null): Project | undefined {
  return id ? projects.find((p) => p.id === id) : undefined;
}

export function findProfile(profiles: Profile[], id: string | null): Profile | undefined {
  return id ? profiles.find((p) => p.id === id) : undefined;
}

export function findStage(stages: PipelineStage[], id: string | null): PipelineStage | undefined {
  return id ? stages.find((s) => s.id === id) : undefined;
}

export function findGoal(goals: PromoGoal[], id: string | null): PromoGoal | undefined {
  return id ? goals.find((g) => g.id === id) : undefined;
}

export function findPromoType(types: PromoType[], id: string | null): PromoType | undefined {
  return id ? types.find((t) => t.id === id) : undefined;
}