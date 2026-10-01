'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import type { ActionResult } from '@/lib/auth/actions';

/**
 * Attachment upload and removal, backed by Supabase Storage.
 *
 * Files land in a scoped bucket path keyed on the owning entity, so a leaked
 * signed URL still cannot read another request's files. Metadata is written to
 * `attachments` only after the object itself is stored.
 */

const BUCKET = 'promo-files';

/** 25 MB ceiling — generous for design files, small enough to stay responsive. */
const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
]);

/** Strips path separators and traversal sequences from a client filename. */
function safeFileName(name: string): string {
  return (
    name
      .replace(/[/\\]/g, '-')
      .replace(/\.\.+/g, '.')
      .replace(/[^\w.\- ]/g, '')
      .slice(0, 180) || 'file'
  );
}

function kindFromMime(mime: string): 'image' | 'video' | 'document' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}

export async function uploadAttachmentAction(
  requestId: string,
  formData: FormData,
): Promise<ActionResult<{ name: string; size: number }>> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canUploadFiles) {
    return { ok: false, error: 'You do not have permission to upload files.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file to upload.' };
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`,
    };
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: `Files of type ${file.type || 'unknown'} are not allowed. Upload an image, video, document or archive.`,
    };
  }

  const supabase = await createClient();

  // Confirm the request still exists before consuming the upload.
  const { data: request, error: requestError } = await supabase
    .from('promo_requests')
    .select('id')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError || !request) {
    return { ok: false, error: 'That request no longer exists.' };
  }

  const fileName = safeFileName(file.name);
  // Random prefix stops two users uploading "brief.pdf" from colliding.
  const path = `requests/${requestId}/${crypto.randomUUID()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[attachments] storage upload failed:', uploadError.message);
    return { ok: false, error: 'The file could not be uploaded. Please try again.' };
  }

  const { error: insertError } = await supabase.from('attachments').insert({
    request_id: requestId,
    storage_path: path,
    file_name: fileName,
    mime_type: file.type,
    size_bytes: file.size,
    kind: kindFromMime(file.type),
    uploaded_by_id: session.profile.id,
  });

  if (insertError) {
    // Do not leave an orphaned object behind.
    await supabase.storage.from(BUCKET).remove([path]);
    console.error('[attachments] metadata insert failed:', insertError.message);
    return { ok: false, error: 'The upload could not be recorded and has been undone.' };
  }

  await supabase.rpc('log_activity', {
    p_entity_type: 'request',
    p_entity_id: requestId,
    p_action: 'attachment_uploaded',
    p_summary: `File uploaded: ${fileName}`,
    p_metadata: { path, size: file.size },
  });

  revalidatePath(`/requests/${requestId}`);

  return { ok: true, data: { name: fileName, size: file.size } };
}

export async function deleteAttachmentAction(attachmentId: string): Promise<ActionResult> {
  const session = await requireUser();

  if (!permissionsFor(session.role).canManageProjects) {
    return { ok: false, error: 'You do not have permission to delete files.' };
  }

  const supabase = await createClient();

  const { data: attachment, error: lookupError } = await supabase
    .from('attachments')
    .select('id, storage_path, request_id, file_name')
    .eq('id', attachmentId)
    .maybeSingle();

  if (lookupError || !attachment) {
    return { ok: false, error: 'That file is no longer available.' };
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([attachment.storage_path]);

  if (storageError) {
    console.error('[attachments] storage remove failed:', storageError.message);
    return { ok: false, error: 'The file could not be removed from storage.' };
  }

  const { error: deleteError } = await supabase.from('attachments').delete().eq('id', attachmentId);

  if (deleteError) {
    return { ok: false, error: 'The file record could not be removed.' };
  }

  if (attachment.request_id) {
    await supabase.rpc('log_activity', {
      p_entity_type: 'request',
      p_entity_id: attachment.request_id,
      p_action: 'attachment_deleted',
      p_summary: `File deleted: ${attachment.file_name}`,
      p_metadata: null,
    });
    revalidatePath(`/requests/${attachment.request_id}`);
  }

  return { ok: true, data: undefined, message: 'File deleted.' };
}

/**
 * Issues a short-lived signed URL for viewing or downloading one file.
 * Generated per request so access is always checked against RLS first.
 */
export async function getAttachmentUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  await requireUser();
  const supabase = await createClient();

  // RLS on `attachments` restricts this select to authenticated users.
  const { data: attachment, error } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle();

  if (error || !attachment) {
    return { ok: false, error: 'That file is no longer available.' };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 10);

  if (signError || !signed) {
    console.error('[attachments] signed url failed:', signError?.message);
    return { ok: false, error: 'We could not prepare the file for download.' };
  }

  return { ok: true, data: { url: signed.signedUrl } };
}