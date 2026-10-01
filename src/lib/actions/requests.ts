'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import {
  promoRequestSchema,
  shiftSchema,
  noteSchema,
  participantSchema,
} from '@/lib/validation/schemas';
import type { ActionResult } from '@/lib/auth/actions';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/field-errors';
import { getRequestDetail } from '@/lib/queries/details';

/**
 * Promo request mutations.
 *
 * Every action re-checks permissions server-side. The UI hides controls a user
 * cannot use, but RLS plus these checks are the actual boundary — a hidden
 * button is a convenience, not a control.
 */

function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function revalidateRequestPaths(id: string) {
  revalidatePath('/dashboard');
  revalidatePath('/requests');
  revalidatePath('/pipeline');
  revalidatePath(`/requests/${id}`);
  revalidatePath('/reports');
  revalidatePath('/reports/requests');
}

function getAll(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter(Boolean);
}

function toNullableUuid(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  return v.length > 0 ? v : null;
}

/** Builds the shared field object from a FormData payload. */
function formToRequestInput(formData: FormData) {
  return {
    title: formData.get('title'),
    request_date: formData.get('request_date'),
    requested_by_id: toNullableUuid(formData.get('requested_by_id')),
    requested_by_name: formData.get('requested_by_name') ?? '',
    company_department: formData.get('company_department') ?? '',
    project_id: toNullableUuid(formData.get('project_id')),
    program_id: toNullableUuid(formData.get('program_id')),
    channel_id: toNullableUuid(formData.get('channel_id')),
    goal_id: toNullableUuid(formData.get('goal_id')),
    promo_type_id: toNullableUuid(formData.get('promo_type_id')),
    episodes_count: formData.get('episodes_count') ?? '',
    priority: formData.get('priority') ?? 'normal',
    due_date: formData.get('due_date') ?? '',
    assigned_to_id: toNullableUuid(formData.get('assigned_to_id')),
    shift_count: formData.get('shift_count') ?? '1',
    production_start_date: formData.get('production_start_date') ?? '',
    production_end_date: formData.get('production_end_date') ?? '',
    call_time: formData.get('call_time') ?? '',
    location: formData.get('location') ?? '',
    notes: formData.get('notes') ?? '',
    special_instructions: formData.get('special_instructions') ?? '',
    internal_notes: formData.get('internal_notes') ?? '',
    promo_goal: formData.get('promo_goal') ?? '',
    target_audience: formData.get('target_audience') ?? '',
    promo_description: formData.get('promo_description') ?? '',
    key_message: formData.get('key_message') ?? '',
    required_deliverables: formData.get('required_deliverables') ?? '',
    duration_seconds: formData.get('duration_seconds') ?? '',
    format: formData.get('format') ?? '',
    language: formData.get('language') ?? '',
    version: formData.get('version') ?? '',
    stage_id: formData.get('stage_id'),
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
/**
 * Creates a request, then redirects to it.
 *
 * Returns `ActionResult` with no payload: on success the caller is navigated
 * away, so there is nothing useful to hand back to the form.
 */
export async function createRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canCreateRequests) {
    return fail('You do not have permission to create promo requests.');
  }

  const participantIds = getAll(formData, 'participant_ids');
  const parsed = promoRequestSchema.safeParse(formToRequestInput(formData));

  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('promo_requests')
    .insert({
      ...parsed.data,
      requested_by_id: parsed.data.requested_by_id ?? session.profile.id,
    })
    .select('id, request_code')
    .single();

  if (error || !data) {
    console.error('[requests] create failed:', error?.message);
    return fail('We could not create the request. Please try again.');
  }

  // Participants are inserted after the request exists so each row can fire the
  // participant notification trigger.
  if (participantIds.length > 0) {
    const { error: participantError } = await supabase.from('request_participants').insert(
      participantIds.map((user_id) => ({
        request_id: data.id,
        user_id,
        added_by_id: session.profile.id,
      })),
    );

    if (participantError) {
      // Non-fatal: the request exists. Warn rather than discarding the work.
      console.error('[requests] participant insert failed:', participantError.message);
      revalidateRequestPaths(data.id);
      redirect(`/requests/${data.id}?warning=participants`);
    }
  }

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: data.id,
    p_action: 'request_created',
    p_summary: `Request created: ${parsed.data.title}`,
    p_metadata: { shift_count: parsed.data.shift_count },
  });

  revalidateRequestPaths(data.id);
  redirect(`/requests/${data.id}`);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
export async function updateRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  const id = String(formData.get('id') ?? '');
  if (!id) return fail('Missing request id.');

  const detail = await getRequestDetail(id);
  if (!detail) return fail('That request no longer exists.');

  const participantIds = detail.participants.map((p) => p.user_id);
  const canEdit =
    permission.canManageProjects ||
    detail.request.assigned_to_id === session.profile.id ||
    detail.request.requested_by_id === session.profile.id ||
    participantIds.includes(session.profile.id);

  if (!canEdit) {
    return fail('You do not have permission to edit this request.');
  }

  const parsed = promoRequestSchema.safeParse(formToRequestInput(formData));
  if (!parsed.success) {
    return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));
  }

  // Only a manager may reassign work or move a request between stages.
  if (
    !permission.canAssignRequests &&
    parsed.data.assigned_to_id !== detail.request.assigned_to_id
  ) {
    return fail('Only a manager can change the assigned producer.');
  }
  if (!permission.canChangeStatus && parsed.data.stage_id !== detail.request.stage_id) {
    return fail('Only a manager can change the request status.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('promo_requests').update(parsed.data).eq('id', id);

  if (error) {
    console.error('[requests] update failed:', error.message);
    return fail('We could not save the request. Please try again.');
  }

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: id,
    p_action: 'request_updated',
    p_summary: 'Request details updated',
    p_metadata: null,
  });

  revalidateRequestPaths(id);
  return { ok: true, data: undefined, message: 'Request saved.' };
}

// ---------------------------------------------------------------------------
// Stage change (Kanban drag-and-drop and the detail page dropdown)
// ---------------------------------------------------------------------------
export async function changeStageAction(
  requestId: string,
  stageId: string,
): Promise<ActionResult> {
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  const detail = await getRequestDetail(requestId);
  if (!detail) return fail('That request no longer exists.');

  if (!permission.canChangeStatus && detail.request.assigned_to_id !== session.profile.id) {
    return fail('You do not have permission to change this request status.');
  }

  if (detail.request.stage_id === stageId) {
    return { ok: true, data: undefined };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('promo_requests')
    .update({ stage_id: stageId })
    .eq('id', requestId);

  if (error) {
    console.error('[requests] stage change failed:', error.message);
    return fail('We could not move that request. Please try again.');
  }

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Status updated.' };
}

// ---------------------------------------------------------------------------
// Archive / restore
// ---------------------------------------------------------------------------
export async function archiveRequestAction(requestId: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canArchiveRequests) {
    return fail('You do not have permission to archive requests.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('promo_requests')
    .update({ status: 'archived' })
    .eq('id', requestId);

  if (error) return fail('We could not archive that request.');

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: requestId,
    p_action: 'request_archived',
    p_summary: 'Request archived',
    p_metadata: null,
  });

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Request archived.' };
}

export async function restoreRequestAction(requestId: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canArchiveRequests) {
    return fail('You do not have permission to restore requests.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('promo_requests')
    .update({ status: 'active' })
    .eq('id', requestId);

  if (error) return fail('We could not restore that request.');

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Request restored.' };
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------
export async function duplicateRequestAction(
  requestId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canCreateRequests) {
    return fail('You do not have permission to create promo requests.');
  }

  const detail = await getRequestDetail(requestId);
  if (!detail) return fail('That request no longer exists.');

  const r = detail.request;
  const supabase = await createClient();

  // A duplicate always restarts at New rather than inheriting a mid-flight stage.
  const { data: newStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('key', 'new')
    .maybeSingle();

  const { data, error } = await supabase
    .from('promo_requests')
    .insert({
      title: `${r.title} (copy)`,
      request_date: new Date().toISOString().slice(0, 10),
      requested_by_id: session.profile.id,
      requested_by_name: r.requested_by_name,
      company_department: r.company_department,
      project_id: r.project_id,
      program_id: r.program_id,
      channel_id: r.channel_id,
      goal_id: r.goal_id,
      promo_type_id: r.promo_type_id,
      episodes_count: r.episodes_count,
      priority: r.priority,
      due_date: r.due_date,
      assigned_to_id: r.assigned_to_id,
      shift_count: r.shift_count,
      production_start_date: r.production_start_date,
      production_end_date: r.production_end_date,
      call_time: r.call_time,
      location: r.location,
      notes: r.notes,
      special_instructions: r.special_instructions,
      promo_goal: r.promo_goal,
      target_audience: r.target_audience,
      promo_description: r.promo_description,
      key_message: r.key_message,
      required_deliverables: r.required_deliverables,
      duration_seconds: r.duration_seconds,
      format: r.format,
      language: r.language,
      version: r.version,
      stage_id: newStage?.id ?? r.stage_id,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[requests] duplicate failed:', error?.message);
    return fail('We could not duplicate the request.');
  }

  // Copy participants too — the same team is usually needed again.
  if (detail.participants.length > 0) {
    await supabase.from('request_participants').insert(
      detail.participants.map((p) => ({
        request_id: data.id,
        user_id: p.user_id,
        responsibility: p.responsibility,
        notes: p.notes,
        added_by_id: session.profile.id,
      })),
    );
  }

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: data.id,
    p_action: 'request_duplicated',
    p_summary: `Duplicated from ${r.request_code ?? 'a request'}`,
    p_metadata: { source_id: requestId },
  });

  revalidateRequestPaths(data.id);
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------
export async function assignRequestAction(
  requestId: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canAssignRequests) {
    return fail('Only a manager can change the assigned producer.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('promo_requests')
    .update({ assigned_to_id: assigneeId })
    .eq('id', requestId);

  if (error) return fail('We could not change the assignment.');

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Assignment updated.' };
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------
export async function addParticipantAction(
  requestId: string,
  input: { user_id: string; responsibility?: string | null },
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageParticipants) {
    return fail('You do not have permission to manage participants.');
  }

  const parsed = participantSchema.safeParse({
    user_id: input.user_id,
    responsibility: input.responsibility ?? '',
  });

  if (!parsed.success) {
    return fail('Select a valid user.', toFieldErrors(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.from('request_participants').insert({
    request_id: requestId,
    user_id: parsed.data.user_id,
    responsibility: parsed.data.responsibility,
    added_by_id: session.profile.id,
  });

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return fail('That person is already a participant on this request.');
    }
    console.error('[requests] add participant failed:', error.message);
    return fail('We could not add that participant.');
  }

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Participant added.' };
}

export async function removeParticipantAction(
  requestId: string,
  participantId: string,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageParticipants) {
    return fail('You do not have permission to manage participants.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('request_participants')
    .delete()
    .eq('id', participantId)
    .eq('request_id', requestId);

  if (error) return fail('We could not remove that participant.');

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: requestId,
    p_action: 'participant_removed',
    p_summary: 'Participant removed',
    p_metadata: { participant_id: participantId },
  });

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Participant removed.' };
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

/**
 * Replaces the shift set for a request.
 *
 * Rows are individually addressable so the UI can submit adds, edits and
 * deletes together in one call. Removed rows are detected by id diff.
 */
export async function updateShiftsAction(
  requestId: string,
  shifts: Array<z.input<typeof shiftSchema>>,
): Promise<ActionResult> {
  const session = await requireUser();
  const permission = permissionsFor(session.role);

  if (!permission.canManageShifts) {
    return fail('You do not have permission to manage shifts.');
  }

  const parsed = z.array(shiftSchema).safeParse(shifts);
  if (!parsed.success) {
    return fail('Please correct the shift details.', toFieldErrors(parsed.error));
  }

  const detail = await getRequestDetail(requestId);
  if (!detail) return fail('That request no longer exists.');

  const isContributor =
    detail.request.assigned_to_id === session.profile.id ||
    detail.participants.some((p) => p.user_id === session.profile.id);

  if (!permission.canManageProjects && !isContributor) {
    return fail('You can only edit shifts on requests you are working on.');
  }

  const supabase = await createClient();
  const existingIds = detail.shifts.map((s) => s.id);
  const incomingIds = parsed.data.map((s) => s.id);

  for (const [index, shift] of parsed.data.entries()) {
    const payload = {
      request_id: requestId,
      // Numbering is always positional, so reordering renumbers cleanly.
      shift_number: index + 1,
      shift_date: shift.shift_date ?? null,
      start_time: shift.start_time ?? null,
      end_time: shift.end_time ?? null,
      assigned_to_id: shift.assigned_to_id ?? null,
      location: shift.location ?? null,
      notes: shift.notes ?? null,
      status: shift.status,
    };

    const { error } = existingIds.includes(shift.id)
      ? await supabase.from('request_shifts').update(payload).eq('id', shift.id)
      : await supabase.from('request_shifts').insert({ id: shift.id, ...payload });

    if (error) {
      console.error('[requests] shift upsert failed:', error.message);
      return fail('We could not save one of the shifts. Please try again.');
    }
  }

  const removedIds = existingIds.filter((id) => !incomingIds.includes(id));
  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('request_shifts')
      .delete()
      .in('id', removedIds)
      .eq('request_id', requestId);

    if (error) return fail('We could not remove the deleted shifts.');
  }

  // Keep the cached count in step with reality (the trigger handles the
  // insert/delete cases; this covers a pure reordering).
  const { error: countError } = await supabase
    .from('promo_requests')
    .update({ shift_count: parsed.data.length })
    .eq('id', requestId);

  if (countError) console.error('[requests] shift count sync failed:', countError.message);

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: requestId,
    p_action: 'shift_updated',
    p_summary: `Shifts updated (${parsed.data.length} total)`,
    p_metadata: null,
  });

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Shifts saved.' };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
export async function addNoteAction(
  requestId: string,
  body: string,
  isInternal: boolean,
): Promise<ActionResult> {
  const session = await requireUser();

  const parsed = noteSchema.safeParse({ body, is_internal: isInternal });
  if (!parsed.success) {
    return fail('Write something first.', toFieldErrors(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.from('request_notes').insert({
    request_id: requestId,
    author_id: session.profile.id,
    body: parsed.data.body,
    is_internal: parsed.data.is_internal,
  });

  if (error) {
    console.error('[requests] add note failed:', error.message);
    return fail('We could not add that note.');
  }

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: requestId,
    p_action: 'note_added',
    p_summary: parsed.data.is_internal ? 'Internal note added' : 'Note added',
    p_metadata: null,
  });

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Note added.' };
}

export async function deleteNoteAction(requestId: string, noteId: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageProjects) {
    return fail('Only a manager can delete notes.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('request_notes')
    .delete()
    .eq('id', noteId)
    .eq('request_id', requestId);

  if (error) return fail('We could not delete that note.');

  revalidateRequestPaths(requestId);
  return { ok: true, data: undefined, message: 'Note deleted.' };
}