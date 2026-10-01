-- ===========================================================================
-- SAT-7 Promo — 001: extensions, enums, shared helpers
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- Roles are a Postgres enum so that RLS policies can compare against a fixed,
-- small, well-known set. Adding a role later = ALTER TYPE ... ADD VALUE.
do $$ begin
  create type public.app_role as enum (
    'administrator',
    'promo_manager',
    'producer',
    'viewer'
  );
exception when duplicate_object then null; end $$;

-- Priority is fixed: it drives dashboard sorting and overdue escalation.
do $$ begin
  create type public.priority_level as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.record_status as enum ('active', 'inactive', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shift_status as enum (
    'planned',
    'in_progress',
    'done',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'assigned',
    'participant_added',
    'status_changed',
    'deadline_approaching',
    'overdue',
    'project_assigned',
    'note_added',
    'mention'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_action as enum (
    'request_created',
    'request_updated',
    'request_archived',
    'request_duplicated',
    'status_changed',
    'assignee_changed',
    'participant_added',
    'participant_removed',
    'shift_created',
    'shift_updated',
    'shift_deleted',
    'note_added',
    'attachment_uploaded',
    'attachment_deleted',
    'program_created',
    'program_updated',
    'project_created',
    'project_updated',
    'user_created',
    'user_updated',
    'settings_updated'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Updated-at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Activity log helper.
-- SECURITY DEFINER so that inserts still work under RLS from server actions
-- and from client components without granting broad insert rights.
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(
  p_entity_type      text,
  p_entity_id        uuid,
  p_action           public.activity_action,
  p_summary          text,
  p_metadata         jsonb default null,
  p_actor_id         uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (
    entity_type, entity_id, action, summary, metadata, actor_id, actor_name
  )
  values (
    p_entity_type,
    p_entity_id,
    p_action,
    p_summary,
    p_metadata,
    p_actor_id,
    coalesce(
      (select full_name from public.profiles where id = p_actor_id),
      'System'
    )
  );
end;
$$;