import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { saveStageAction } from '@/lib/actions/reference';
import { StageManager } from '@/components/settings/stage-manager';
import type { PipelineStage } from '@/types/database';

export const metadata: Metadata = { title: 'Pipeline stages' };

export default async function StagesSettingsPage() {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('[settings/stages] read failed:', error.message);
  }

  if (!permission.canManageReferenceData) {
    return <p className="text-sm text-muted-foreground">You cannot change these settings.</p>;
  }

  return <StageManager stages={(data ?? []) as PipelineStage[]} saveAction={saveStageAction} />;
}