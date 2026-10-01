'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import {
  channelSchema,
  programSchema,
  projectSchema,
  goalSchema,
  promoTypeSchema,
  stageSchema,
} from '@/lib/validation/schemas';
import type { ActionResult, ActionState } from '@/lib/auth/actions';

/**
 * Reference-data mutations: channels, programs, projects, goals, promo types
 * and pipeline stages. All administrator-managed.
 */

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

async function assertCanManage() {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageReferenceData) {
    throw new Error('You do not have permission to change this.');
  }
  return session;
}

/**
 * Reads a multi-value field.
 *
 * The project form submits member and program lists through `UserMultiSelect`
 * and a checkbox grid, which both emit one entry per value, so `getAll` is the
 * primary path. The CSV fallback keeps the helper usable from a plain
 * `<input>` and makes the action tolerant of either encoding.
 */
function idList(formData: FormData, name: string): string[] {
  const entries = formData.getAll(name).filter((v): v is string => typeof v === 'string');
  const raw = entries.length > 0 ? entries : csvToArray(formData.get(name));
  return raw
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

function csvToArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------
export async function saveChannelAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertCanManage();

  const id = toNullableUuid(formData.get('id'));
  const parsed = channelSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code') ?? '',
    description: formData.get('description') ?? '',
    category: formData.get('category') ?? '',
    color: formData.get('color') ?? 'brand',
    sort_order: formData.get('sort_order') ?? '0',
    notes: formData.get('notes') ?? '',
    status: formData.get('status') ?? 'active',
  });

  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from('channels').update(parsed.data).eq('id', id);
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return fail('A channel with that name already exists.', { name: ['Already in use'] });
      }
      return fail('We could not save the channel.');
    }
  } else {
    const { error } = await supabase.from('channels').insert(parsed.data);
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return fail('A channel with that name already exists.', { name: ['Already in use'] });
      }
      return fail('We could not create the channel.');
    }
  }

  revalidatePath('/channels');
  revalidatePath('/settings/channels');
  return { ok: true, data: undefined, message: id ? 'Channel updated.' : 'Channel created.' };
}

export async function deleteChannelAction(channelId: string): Promise<ActionResult> {
  await assertCanManage();
  const supabase = await createClient();

  // Channels are referenced by every historical request, so archive rather
  // than hard-delete: that would break reporting.
  const { error } = await supabase.from('channels').update({ status: 'archived' }).eq('id', channelId);
  if (error) return fail('We could not archive the channel.');

  revalidatePath('/channels');
  revalidatePath('/settings/channels');
  return { ok: true, data: undefined, message: 'Channel archived.' };
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------
export async function saveProgramAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertCanManage();

  const id = toNullableUuid(formData.get('id'));
  const parsed = programSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    channel_id: toNullableUuid(formData.get('channel_id')),
    responsible_id: toNullableUuid(formData.get('responsible_id')),
    image_url: formData.get('image_url') ?? '',
    status: formData.get('status') ?? 'active',
    start_date: formData.get('start_date') ?? '',
    end_date: formData.get('end_date') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from('programs').update(parsed.data).eq('id', id);
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return fail('A program with that name already exists.', { name: ['Already in use'] });
      }
      return fail('We could not save the program.');
    }
  } else {
    const { error } = await supabase.from('programs').insert(parsed.data);
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return fail('A program with that name already exists.', { name: ['Already in use'] });
      }
      return fail('We could not create the program.');
    }
  }

  revalidatePath('/programs');
  revalidatePath('/settings/programs');
  return { ok: true, data: undefined, message: id ? 'Program updated.' : 'Program created.' };
}

export async function deleteProgramAction(programId: string): Promise<ActionResult> {
  await assertCanManage();
  const supabase = await createClient();

  const { error } = await supabase.from('programs').update({ status: 'archived' }).eq('id', programId);
  if (error) return fail('We could not archive the program.');

  revalidatePath('/programs');
  revalidatePath('/settings/programs');
  return { ok: true, data: undefined, message: 'Program archived.' };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export async function saveProjectAction(
  _prev: ActionState<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageProjects) {
    return fail('You do not have permission to manage projects.');
  }

  const id = toNullableUuid(formData.get('id'));
  const parsed = projectSchema.safeParse({
    code: formData.get('code') ?? '',
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    manager_id: toNullableUuid(formData.get('manager_id')),
    status: formData.get('status') ?? 'active',
    start_date: formData.get('start_date') ?? '',
    end_date: formData.get('end_date') ?? '',
    notes: formData.get('notes') ?? '',
    member_ids: idList(formData, 'member_ids'),
    program_ids: idList(formData, 'program_ids'),
  });

  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { member_ids: memberIds, program_ids: programIds, ...values } = parsed.data;

  let projectId = id;

  if (id) {
    const { error } = await supabase.from('projects').update(values).eq('id', id);
    if (error) return fail('We could not save the project.');
  } else {
    const { data, error } = await supabase.from('projects').insert(values).select('id').single();
    if (error || !data) return fail('We could not create the project.');
    projectId = data.id;
  }

  if (!projectId) return fail('We could not identify the project to save.');

  // Replace membership and linked programs wholesale: simpler and correct for a
  // form that submits the full desired set.
  if (memberIds.length > 0 || id) {
    await supabase.from('project_members').delete().eq('project_id', projectId);
    if (memberIds.length > 0) {
      await supabase.from('project_members').insert(
        memberIds.map((user_id) => ({ project_id: projectId, user_id })),
      );
    }
  }

  if (programIds.length > 0 || id) {
    await supabase.from('project_programs').delete().eq('project_id', projectId);
    if (programIds.length > 0) {
      await supabase.from('project_programs').insert(
        programIds.map((program_id) => ({ project_id: projectId, program_id })),
      );
    }
  }

  await supabase.rpc('log_activity', {
    p_entity_type: 'project',
    p_entity_id: projectId,
    p_action: id ? 'project_updated' : 'project_created',
    p_summary: id ? `Project updated: ${values.name}` : `Project created: ${values.name}`,
    p_metadata: null,
  });

  revalidatePath('/projects');
  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/settings/projects');

  if (id) return { ok: true, data: { id: projectId }, message: 'Project updated.' };
  return { ok: true, data: { id: projectId } };
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageProjects) {
    return fail('You do not have permission to archive projects.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('projects').update({ status: 'archived' }).eq('id', projectId);
  if (error) return fail('We could not archive the project.');

  revalidatePath('/projects');
  return { ok: true, data: undefined, message: 'Project archived.' };
}

export async function deleteProjectAndRedirect(projectId: string): Promise<void> {
  await deleteProjectAction(projectId);
  redirect('/projects');
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
export async function saveGoalAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertCanManage();

  const id = toNullableUuid(formData.get('id'));
  const parsed = goalSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    category: formData.get('category') ?? '',
    color: formData.get('color') ?? 'violet',
    is_active: formData.get('is_active') === 'on',
    sort_order: formData.get('sort_order') ?? '0',
  });

  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from('promo_goals').update(parsed.data).eq('id', id);
    if (error) return fail('We could not save the goal.');
  } else {
    const { error } = await supabase.from('promo_goals').insert(parsed.data);
    if (error) return fail('We could not create the goal.');
  }

  revalidatePath('/settings/goals');
  return { ok: true, data: undefined, message: id ? 'Goal updated.' : 'Goal created.' };
}

export async function deleteGoalAction(goalId: string): Promise<ActionResult> {
  await assertCanManage();
  const supabase = await createClient();

  // Goals drive reporting, so deactivate instead of deleting.
  const { error } = await supabase.from('promo_goals').update({ is_active: false }).eq('id', goalId);
  if (error) return fail('We could not deactivate the goal.');

  revalidatePath('/settings/goals');
  return { ok: true, data: undefined, message: 'Goal deactivated.' };
}

// ---------------------------------------------------------------------------
// Promo types
// ---------------------------------------------------------------------------
export async function savePromoTypeAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertCanManage();

  const id = toNullableUuid(formData.get('id'));
  const parsed = promoTypeSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    is_active: formData.get('is_active') === 'on',
    sort_order: formData.get('sort_order') ?? '0',
  });

  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from('promo_types').update(parsed.data).eq('id', id);
    if (error) return fail('We could not save the promo type.');
  } else {
    const { error } = await supabase.from('promo_types').insert(parsed.data);
    if (error) return fail('We could not create the promo type.');
  }

  revalidatePath('/settings/promo-types');
  return { ok: true, data: undefined, message: id ? 'Promo type updated.' : 'Promo type created.' };
}

export async function deletePromoTypeAction(typeId: string): Promise<ActionResult> {
  await assertCanManage();
  const supabase = await createClient();

  const { error } = await supabase.from('promo_types').update({ is_active: false }).eq('id', typeId);
  if (error) return fail('We could not deactivate the promo type.');

  revalidatePath('/settings/promo-types');
  return { ok: true, data: undefined, message: 'Promo type deactivated.' };
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------
export async function saveStageAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionResult> {
  await assertCanManage();

  const id = toNullableUuid(formData.get('id'));
  const parsed = stageSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    position: formData.get('position') ?? '0',
    color: formData.get('color') ?? 'slate',
    is_terminal: formData.get('is_terminal') === 'on',
    is_cancelled: formData.get('is_cancelled') === 'on',
  });

  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from('pipeline_stages').update(parsed.data).eq('id', id);
    if (error) return fail('We could not save the stage.');
  } else {
    const { error } = await supabase.from('pipeline_stages').insert(parsed.data);
    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        return fail('A stage with that key already exists.');
      }
      return fail('We could not create the stage.');
    }
  }

  revalidatePath('/settings/stages');
  revalidatePath('/pipeline');
  revalidatePath('/dashboard');
  return { ok: true, data: undefined, message: id ? 'Stage updated.' : 'Stage created.' };
}

export async function deleteStageAction(stageId: string): Promise<ActionResult> {
  await assertCanManage();
  const supabase = await createClient();

  // Requests reference stage_id with a hard FK, so only delete stages that are
  // genuinely unused. Check first rather than failing on the constraint.
  const { count, error: countError } = await supabase
    .from('promo_requests')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', stageId);

  if (countError) return fail('We could not check whether that stage is in use.');

  if ((count ?? 0) > 0) {
    return fail(
      `${count} request${count === 1 ? '' : 's'} still use this stage. Move them first, or archive the stage instead.`,
    );
  }

  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId);
  if (error) return fail('We could not delete the stage.');

  revalidatePath('/settings/stages');
  revalidatePath('/pipeline');
  return { ok: true, data: undefined, message: 'Stage deleted.' };
}

// ---------------------------------------------------------------------------
// Pipeline stage ordering
// ---------------------------------------------------------------------------
export async function reorderStageAction(stageId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  await assertCanManage();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, position')
    .order('position', { ascending: true });

  if (error) return fail('We could not load the pipeline stages.');
  if (!data || data.length === 0) return fail('There are no pipeline stages to reorder.');

  const ordered = data as Array<{ id: string; position: number }>;
  const index = ordered.findIndex((s) => s.id === stageId);
  if (index === -1) return fail('We could not find that stage.');

  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= ordered.length) return fail('That stage is already at the end.');

  // Positions are rewritten as a dense 1..n sequence rather than swapped
  // pairwise: gaps and duplicates would otherwise accumulate every time
  // someone reorders, and the board sorts on position.
  const next = ordered.map((s, i) => ({ id: s.id, position: i + 1 }));
  const moved = next.splice(index, 1)[0];
  next.splice(swapWith, 0, moved);

  const { error: updateError } = await supabase
    .from('pipeline_stages')
    .upsert(next.map((s) => ({ id: s.id, position: s.position })));

  if (updateError) return fail('We could not reorder the pipeline stages.');

  revalidatePath('/settings/stages');
  revalidatePath('/pipeline');
  return { ok: true, data: undefined, message: 'Stage moved.' };
}

function toNullableUuid(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  return v.length > 0 ? v : null;
}