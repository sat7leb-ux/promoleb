import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  ActivityLog,
  Attachment,
  Notification,
  RequestNote,
  RequestParticipant,
  RequestShift,
  PromoRequest,
} from '@/types/database';

/**
 * Single-request read model.
 *
 * One page load fetches the request plus every child collection it renders, in
 * parallel. Doing this as separate page-level awaits would serialise into five
 * round trips.
 */

/**
 * A request row with its one-to-one relations joined in. Base columns are still
 * present, so callers read `detail.request.title`, `detail.request.channel.name`
 * and so on from a single object.
 */
export interface RequestDetail extends PromoRequest {
  channel: { id: string; name: string; color: string; category: string | null } | null;
  program: { id: string; name: string; description: string | null; image_url: string | null } | null;
  project: { id: string; name: string; code: string | null; status: string } | null;
  goal: { id: string; name: string; color: string; description: string | null } | null;
  promo_type: { id: string; name: string } | null;
  stage: { id: string; name: string; position: number; color: string; is_terminal: boolean; is_cancelled: boolean } | null;
  assigned_to: { id: string; full_name: string; email: string; avatar_url: string | null; role: string } | null;
  requested_by: { id: string; full_name: string; avatar_url: string | null } | null;
}

export interface RequestParticipantWithUser extends RequestParticipant {
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
    role: string;
  } | null;
}

export interface RequestShiftWithUser extends RequestShift {
  user: { id: string; full_name: string; avatar_url: string | null } | null;
}

export interface RequestNoteWithAuthor extends RequestNote {
  author: { id: string; full_name: string; avatar_url: string | null } | null;
}

export interface AttachmentWithUser extends Attachment {
  user: { id: string; full_name: string } | null;
}

const DETAIL_SELECT = `
  *,
  channel:channels ( id, name, color, category ),
  program:programs ( id, name, description, image_url ),
  project:projects ( id, name, code, status ),
  goal:promo_goals ( id, name, color, description ),
  promo_type:promo_types ( id, name ),
  stage:pipeline_stages ( id, name, position, color, is_terminal, is_cancelled ),
  assigned_to:profiles!promo_requests_assigned_to_id_fkey ( id, full_name, email, avatar_url, role ),
  requested_by:profiles!promo_requests_requested_by_id_fkey ( id, full_name, avatar_url )
`;

/** Everything the request detail page renders, fetched in one pass. */
export interface RequestDetailData {
  request: RequestDetail;
  participants: RequestParticipantWithUser[];
  shifts: RequestShiftWithUser[];
  notes: RequestNoteWithAuthor[];
  attachments: AttachmentWithUser[];
  activity: ActivityLog[];
}

export async function getRequestDetail(id: string): Promise<RequestDetailData | null> {
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from('promo_requests')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error || !request) {
    if (error) console.error('[request] detail query failed:', error.message);
    return null;
  }

  const [participants, shifts, notes, attachments, activity] = await Promise.all([
    supabase
      .from('request_participants')
      .select('*, user:profiles ( id, full_name, email, avatar_url, job_title )')
      .eq('request_id', id)
      .order('created_at'),

    supabase
      .from('request_shifts')
      .select('*, user:profiles!request_shifts_assigned_to_id_fkey ( id, full_name, avatar_url )')
      .eq('request_id', id)
      .order('shift_number'),

    supabase
      .from('request_notes')
      .select('*, author:profiles ( id, full_name, avatar_url )')
      .eq('request_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('attachments')
      .select('*, user:profiles ( id, full_name )')
      .eq('request_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('activity_logs')
      .select('*')
      .eq('entity_type', 'request')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (participants.error) console.error('[request] participants:', participants.error.message);
  if (shifts.error) console.error('[request] shifts:', shifts.error.message);
  if (notes.error) console.error('[request] notes:', notes.error.message);
  if (attachments.error) console.error('[request] attachments:', attachments.error.message);
  if (activity.error) console.error('[request] activity:', activity.error.message);

  return {
    request: request as unknown as RequestDetail,
    // `request` above is already the joined row; expose its relation fields at
    // the top level too so view components can read either shape.
    participants: (participants.data ?? []) as unknown as RequestParticipantWithUser[],
    shifts: (shifts.data ?? []) as unknown as RequestShiftWithUser[],
    notes: (notes.data ?? []) as unknown as RequestNoteWithAuthor[],
    attachments: (attachments.data ?? []) as unknown as AttachmentWithUser[],
    activity: (activity.data ?? []) as ActivityLog[],
  };
}

export async function getNotifications(userId: string, limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[notifications] query failed:', error.message);
    return [] as Notification[];
  }
  return (data ?? []) as Notification[];
}

export async function getUnreadNotificationCount(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('[notifications] count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getGlobalActivity(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[activity] query failed:', error.message);
    return [] as ActivityLog[];
  }
  return (data ?? []) as ActivityLog[];
}

/** Notifications tied to a specific request, for the detail page bell. */
export async function getRequestNotifications(requestId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('entity_type', 'request')
    .eq('entity_id', requestId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[notifications] request query failed:', error.message);
    return [] as Notification[];
  }
  return (data ?? []) as Notification[];
}