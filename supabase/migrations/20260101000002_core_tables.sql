-- ===========================================================================
-- SAT-7 Promo — 002: profiles, roles plumbing, reference data tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, holds everything app-specific about a person
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  full_name     text not null,
  job_title     text,
  phone         text,
  avatar_url    text,
  role          public.app_role not null default 'viewer',
  status        public.record_status not null default 'active',
  -- free-form notes kept by admins about a user (skills, availability, ...)
  notes         text,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Application user profiles. Mirrors auth.users for identity, stores role and lifecycle status.';

create index profiles_role_idx   on public.profiles (role);
create index profiles_status_idx on public.profiles (status);
create index profiles_name_trgm  on public.profiles using gin (full_name gin_trgm_ops);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Handle new signups: create a profile row automatically.
-- The role defaults to 'viewer' — an admin must promote the user explicitly.
-- Security: the trigger runs as the auth server, search_path is pinned.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Reference data: pipeline stages (aka request statuses)
-- The kanban board columns and the request status filter both read this.
-- `is_terminal` marks Completed / Cancelled as end states for KPI maths.
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  name         text not null,
  description  text,
  position     integer not null default 0,
  color        text not null default 'slate',
  is_terminal  boolean not null default false,
  is_cancelled boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index pipeline_stages_position_idx on public.pipeline_stages (position);

create trigger pipeline_stages_set_updated_at
  before update on public.pipeline_stages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- channels
-- ---------------------------------------------------------------------------
create table public.channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  code        text unique,
  description text,
  -- e.g. 'Broadcast', 'Digital', 'Social' — used for grouping in reports
  category    text,
  color       text not null default 'brand',
  status      public.record_status not null default 'active',
  sort_order  integer not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index channels_status_idx on public.channels (status);

create trigger channels_set_updated_at
  before update on public.channels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------------
create table public.programs (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  description        text,
  channel_id         uuid references public.channels (id) on delete set null,
  responsible_id     uuid references public.profiles (id) on delete set null,
  image_url          text,
  status             public.record_status not null default 'active',
  start_date         date,
  end_date           date,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint programs_dates_ordered
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index programs_channel_idx on public.programs (channel_id);
create index programs_status_idx  on public.programs (status);
create index programs_name_trgm  on public.programs using gin (name gin_trgm_ops);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- promo_goals: the "why" of a request, searchable and reportable
-- ---------------------------------------------------------------------------
create table public.promo_goals (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  category    text,
  color       text not null default 'violet',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index promo_goals_active_idx on public.promo_goals (is_active);

create trigger promo_goals_set_updated_at
  before update on public.promo_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- promo_types (trailer / teaser / campaign / live promo / ...)
-- ---------------------------------------------------------------------------
create table public.promo_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger promo_types_set_updated_at
  before update on public.promo_types
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,
  name         text not null,
  description  text,
  manager_id   uuid references public.profiles (id) on delete set null,
  status       public.record_status not null default 'active',
  start_date   date,
  end_date     date,
  notes        text,
  -- drives the "is this project overdue" badge
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint projects_dates_ordered
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index projects_manager_idx on public.projects (manager_id);
create index projects_status_idx  on public.projects (status);
create index projects_name_trgm  on public.projects using gin (name gin_trgm_ops);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- project_members: assigned users on a project
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

-- project_programs: programs covered by a project
create table public.project_programs (
  project_id uuid not null references public.projects (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, program_id)
);