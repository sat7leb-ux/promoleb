import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ProgramsView } from '@/components/programs/programs-view';
import { getProgramStats } from '@/lib/queries/stats';
import type { Channel, Profile, Program } from '@/types/database';

export const metadata: Metadata = { title: 'Manage programs' };

/**
 * Settings view of programs. Reuses the programs list component — see the
 * channels settings page for the same reasoning.
 */
export default async function SettingsProgramsPage() {
  await requireUser();
  const supabase = await createClient();

  const [programsRes, channelsRes, profilesRes, stats] = await Promise.all([
    supabase.from('programs').select('*').order('name'),
    supabase.from('channels').select('*').order('name'),
    // The program form offers a responsible person, so it needs the roster.
    supabase.from('profiles').select('*').eq('status', 'active').order('full_name'),
    getProgramStats(),
  ]);

  if (programsRes.error) {
    console.error('[settings/programs] read failed:', programsRes.error.message);
  }

  return (
    <section className="space-y-4">
      <div>
        <Link
          href="/programs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          View programs with request counts
        </Link>
      </div>

      <ProgramsView
        programs={(programsRes.data ?? []) as Program[]}
        channels={(channelsRes.data ?? []) as Channel[]}
        profiles={(profilesRes.data ?? []) as Profile[]}
        stats={stats}
        canManage
      />
    </section>
  );
}