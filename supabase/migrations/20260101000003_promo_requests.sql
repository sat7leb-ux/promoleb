-- ===========================================================================
-- SAT-7 Promo — 003: the promo request and everything hanging off it
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- promo_requests
--
-- Business chain enforced by FKs:
--   project -> program -> channel -> promo_request -> shifts -> participants
--
-- `shift_count` is a cached mirror of request_shifts so the list view and
-- dashboard never need a child join. A trigger below keeps it truthful.
-- `request_code` is the human-facing reference (e.g. PR-2026-0007).
-- ---------------------------------------------------------------------------
create table public.promo_requests (
  id                    uuid primary key default gen_random_uuid(),
  request_code          text unique,
  title                 text not null,

  -- --- Basic information ---------------------------------------------------
  request_date          date not null default current_date,
  requested_by_id       uuid references public.profiles (id) on delete set null,
  requested_by_name     text,
  company_department    text,
  program_id            uuid references public.programs (id) on delete set null,
  channel_id            uuid references public.channels (id) on delete set null,
  project_id            uuid references public.projects (id) on delete set null,
  episodes_count        integer,
  promo_type_id         uuid references public.promo_types (id) on delete set null,
  goal_id               uuid references public.promo_goals (id) on delete set null,
  priority              public.priority_level not null default 'normal',
  due_date              date,

  -- --- Production information ---------------------------------------------
  assigned_to_id        uuid references public.profiles (id) on delete set null,
  shift_count           integer not null default 1,
  production_start_date date,
  production_end_date   date,
  call_time             time,
  location              text,
  notes                 text,
  special_instructions  text,
  internal_notes        text,

  -- --- Promo information ---------------------------------------------------
  promo_goal            text,
  target_audience       text,
  promo_description     text,
  key_message           text,
  required_deliverables text,
  duration_seconds      integer,
  format                text,
  language              text,
  version               text,
  deadline              timestamptz,

  -- --- Workflow ------------------------------------------------------------
  stage_id              uuid not null references public.pipeline_stages (id),
  -- denormalised for fast "is this cancelled" filtering + audit readability
  stage_name            text not null,
  stage_position        integer not null default 0,
  is_completed          boolean not null default false,
  completed_at          timestamptz,

  status                public.record_status not null default 'active',
  -- computed by trigger: on_track | due_soon | overdue | completed
  due_state             text not null default 'on_track',

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint promo_requests_shift_count_positive check (shift_count >= 0),
  constraint promo_requests_production_dates_ordered
    check (
      production_end_date is null
      or production_start_date is null
      or production_end_date >= production_start_date
    )
);

-- Covering indexes for the hot paths: list filters, board load, dashboards.
create index promo_requests_stage_idx    on public.promo_requests (stage_id);
create index promo_requests_program_idx  on public.promo_requests (program_id);
create index promo_requests_channel_idx  on public.promo_requests (channel_id);
create index promo_requests_project_idx  on public.promo_requests (project_id);
create index promo_requests_assigned_idx on public.promo_requests (assigned_to_id);
create index promo_requests_goal_idx     on public.promo_requests (goal_id);
create index promo_requests_priority_idx on public.promo_requests (priority);
create index promo_requests_due_date_idx on public.promo_requests (due_date);
create index promo_requests_request_date_idx on public.promo_requests (request_date desc);
create index promo_requests_due_state_idx   on public.promo_requests (due_state);
create index promo_requests_status_idx      on public.promo_requests (status);
create index promo_requests_completed_idx   on public.promo_requests (is_completed);
-- Global search support
create index promo_requests_title_trgm
  on public.promo_requests using gin (title gin_trgm_ops);
create index promo_requests_code_trgm
  on public.promo_requests using gin (request_code gin_trgm_ops);

-- Composite index tuned for the default list view (active first, newest first)
create index promo_requests_list_idx
  on public.promo_requests (status, created_at desc);

create trigger promo_requests_set_updated_at
  before update on public.promo_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- request_participants
-- Deliberately distinct from assigned_to_id:
--   assigned_to = one accountable producer ("who owns it")
--   participants = everyone else contributing ("who is helping")
-- ---------------------------------------------------------------------------
create table public.request_participants (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.promo_requests (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  responsibility  text,
  notes           text,
  added_by_id     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  -- a user participates at most once per request
  constraint request_participants_unique unique (request_id, user_id)
);

create index request_participants_user_idx    on public.request_participants (user_id);
create index request_participants_request_idx on public.request_participants (request_id);

-- ---------------------------------------------------------------------------
-- request_shifts
-- Created automatically (shift_count rows) when a request is created or when
-- the shift count grows. Deleted automatically when it shrinks.
-- ---------------------------------------------------------------------------
create table public.request_shifts (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.promo_requests (id) on delete cascade,
  shift_number integer not null,
  shift_date   date,
  start_time   time,
  end_time     time,
  assigned_to_id uuid references public.profiles (id) on delete set null,
  location     text,
  notes        text,
  status       public.shift_status not null default 'planned',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint request_shifts_unique unique (request_id, shift_number),
  constraint request_shifts_number_positive check (shift_number > 0)
);

create index request_shifts_request_idx on public.request_shifts (request_id, shift_number);
create index request_shifts_user_idx    on public.request_shifts (assigned_to_id);
create index request_shifts_date_idx    on public.request_shifts (shift_date);

create trigger request_shifts_set_updated_at
  before update on public.request_shifts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- request_notes: timestamped, attributable commentary
-- ---------------------------------------------------------------------------
create table public.request_notes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.promo_requests (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

create index request_notes_request_idx on public.request_notes (request_id, created_at desc);

-- ---------------------------------------------------------------------------
-- attachments (Supabase Storage objects, linked to any entity)
-- ---------------------------------------------------------------------------
create table public.attachments (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references public.promo_requests (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete cascade,
  program_id    uuid references public.programs (id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  kind          text not null default 'other', -- image | document | video | other
  uploaded_by_id uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint attachments_one_owner check (
    num_nonnulls(request_id, project_id, program_id) = 1
  )
);

create index attachments_request_idx on public.attachments (request_id);
create index attachments_project_idx on public.attachments (project_id);
create index attachments_program_idx on public.attachments (program_id);

-- ---------------------------------------------------------------------------
-- activity_logs: append-only audit trail
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  entity_type text not null,  -- 'request' | 'project' | 'program' | 'user' | 'settings'
  entity_id   uuid,
  action      public.activity_action not null,
  summary     text not null,
  metadata    jsonb,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text,
  created_at  timestamptz not null default now()
);

create index activity_logs_entity_idx  on public.activity_logs (entity_type, entity_id, created_at desc);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_action_idx  on public.activity_logs (action);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  body       text,
  link       text,
  entity_type text,
  entity_id  uuid,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx    on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;