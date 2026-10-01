'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { settingsSchema } from '@/lib/validation/schemas';
import { toFieldErrors } from '@/lib/validation/field-errors';
import type { ActionResult } from '@/lib/auth/actions';
import { ORG_SETTINGS_DEFAULTS } from '@/lib/constants';

/**
 * Organisation-wide settings, stored as a key/value table.
 *
 * Values live in `public.settings.value` as jsonb, so each key is written as
 * its own row. That keeps unrelated settings from clobbering each other when
 * two admins edit different things at once, and means a missing key falls back
 * to a documented default instead of failing the read.
 *
 * Note the shape and defaults live in `@/lib/constants` rather than here: a
 * `'use server'` module may only export async functions, so exporting a plain
 * object from this file is a build error.
 */

export type OrgSettings = {
  org_name: string;
  due_soon_days: number;
  timezone: string;
};

/** Reads the settings, filling any missing or malformed key from the defaults. */
export async function getOrgSettings(): Promise<OrgSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('settings').select('key, value');

  if (error) {
    // Settings are cosmetic plus one threshold; never block a page render on
    // them. The defaults keep the app usable and the deadline logic sane.
    console.error('[settings] read failed:', error.message);
    return { ...ORG_SETTINGS_DEFAULTS };
  }

  const read = (key: string): unknown => {
    const row = (data ?? []).find((r: { key: string }) => r.key === key);
    return row ? (row as { value: unknown }).value : undefined;
  };

  const dueSoon = Number(read('due_soon_days'));

  return {
    org_name: typeof read('org_name') === 'string' ? (read('org_name') as string) : ORG_SETTINGS_DEFAULTS.org_name,
    due_soon_days: Number.isFinite(dueSoon) && dueSoon >= 1 ? Math.floor(dueSoon) : ORG_SETTINGS_DEFAULTS.due_soon_days,
    timezone: typeof read('timezone') === 'string' ? (read('timezone') as string) : ORG_SETTINGS_DEFAULTS.timezone,
  };
}

export async function updateOrgSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageSettings) {
    return { ok: false, error: 'You do not have permission to change settings.' };
  }

  const parsed = settingsSchema.safeParse({
    org_name: formData.get('org_name'),
    due_soon_days: formData.get('due_soon_days'),
    timezone: formData.get('timezone'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();

  // One upsert per key rather than a single batch, so a partial failure leaves
  // the untouched settings at their previous values.
  const writes: Array<{ key: string; value: unknown }> = [
    { key: 'org_name', value: parsed.data.org_name },
    { key: 'due_soon_days', value: parsed.data.due_soon_days },
    { key: 'timezone', value: parsed.data.timezone },
  ];

  for (const write of writes) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: write.key, value: write.value as never, updated_by: session.profile.id });

    if (error) {
      console.error(`[settings] write ${write.key} failed:`, error.message);
      return { ok: false, error: `We could not save "${write.key.replace(/_/g, ' ')}".` };
    }
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true, data: undefined, message: 'Settings saved.' };
}