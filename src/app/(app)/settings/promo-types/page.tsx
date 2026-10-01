import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { deletePromoTypeAction, savePromoTypeAction } from '@/lib/actions/reference';
import { ReferenceDataManager } from '@/components/settings/reference-data-manager';
import type { PromoType } from '@/types/database';

export const metadata: Metadata = { title: 'Promo types' };

export default async function PromoTypesSettingsPage() {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const supabase = await createClient();

  const { data, error } = await supabase.from('promo_types').select('*').order('sort_order');

  if (error) {
    console.error('[settings/promo-types] read failed:', error.message);
  }

  if (!permission.canManageReferenceData) {
    return <p className="text-sm text-muted-foreground">You cannot change these settings.</p>;
  }

  return (
    <ReferenceDataManager
      title="Promo types"
      description="The kind of asset a request asks for — trailer, teaser, bumper, ident and so on."
      emptyTitle="No promo types yet"
      emptyDescription="Add the asset types producers can request."
      items={(data ?? []) as PromoType[]}
      saveAction={savePromoTypeAction}
      deleteAction={deletePromoTypeAction}
    />
  );
}