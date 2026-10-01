import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { deleteGoalAction, saveGoalAction } from '@/lib/actions/reference';
import { ReferenceDataManager } from '@/components/settings/reference-data-manager';
import type { PromoGoal } from '@/types/database';

export const metadata: Metadata = { title: 'Promo goals' };

export default async function GoalsSettingsPage() {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const supabase = await createClient();

  const { data, error } = await supabase.from('promo_goals').select('*').order('sort_order');

  if (error) {
    console.error('[settings/goals] read failed:', error.message);
  }

  if (!permission.canManageReferenceData) {
    return <p className="text-sm text-muted-foreground">You cannot change these settings.</p>;
  }

  return (
    <ReferenceDataManager
      title="Promo goals"
      description="Why a promo exists. Requests pick one goal, and it is a reportable dimension."
      emptyTitle="No promo goals yet"
      emptyDescription="Add the objectives promo requests should be measured against."
      items={(data ?? []) as PromoGoal[]}
      saveAction={saveGoalAction}
      deleteAction={deleteGoalAction}
      extraField="category"
    />
  );
}