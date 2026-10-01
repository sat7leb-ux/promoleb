-- ===========================================================================
-- SAT-7 Promo - 008: storage bucket for request attachments
--
-- Attachments are private. Nothing is world-readable: downloads go through a
-- short-lived signed URL minted by a server action, so a leaked URL expires in
-- minutes rather than granting permanent public access to a promo brief.
--
-- Object paths are always 'requests/<request_id>/<uuid>-<name>'. The RLS
-- policies below key off that shape, which is why the upload action builds the
-- path the way it does.
--
-- These rules mirror the table policies in 005 exactly — same audience (every
-- authenticated user may read), same write gate (can_manage()) — so a file is
-- never more or less accessible than the request that owns it.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'promo-files',
  'promo-files',
  false,
  26214400, -- 25 MB, matching MAX_BYTES in lib/actions/attachments.ts
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- attachment_request_id(path)
--
-- The request id encoded in an object's storage path, or null if the path is
-- not shaped like one of ours. Returning null makes every policy below fail
-- closed, so a hand-crafted path cannot be used to slip past them.
-- ---------------------------------------------------------------------------
create or replace function public.attachment_request_id(p_path text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    (regexp_match(
      p_path,
      '^requests/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
    ))[1],
    ''
  )::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Policies
--
-- storage.objects already has RLS enabled; these add the application rules.
-- Policy names are unique, so re-running this migration is safe.
-- ---------------------------------------------------------------------------

-- Reading: any signed-in user, matching promo_requests_select_authenticated.
-- (Uploads and deletes still go through can_manage().)
create policy promo_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'promo-files'
    and public.attachment_request_id(name) is not null
  );

-- Writing: managers only, matching attachments_insert_contributor. The path must
-- parse as a request path, so an object cannot be written outside requests/.
create policy promo_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'promo-files'
    and public.can_manage()
    and public.attachment_request_id(name) is not null
  );

create policy promo_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'promo-files'
    and public.can_manage()
    and public.attachment_request_id(name) is not null
  );

-- No update policy on purpose. Objects are immutable; a "change" is a delete plus
-- an upload, and the attachments row records both in the audit log.

-- ---------------------------------------------------------------------------
-- Grants
--
-- createSignedUrl runs with the service role on the server and so bypasses
-- select RLS by design: the action re-checks permissions before minting one.
-- These grants just let the authenticated key evaluate the helper.
-- ---------------------------------------------------------------------------

grant usage on function public.attachment_request_id(text) to authenticated;