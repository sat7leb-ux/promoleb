-- ===========================================================================
-- SAT-7 Promo — 005: Row Level Security
--
-- Policy summary
--   profiles        read: all authenticated | write: admin (self-read only)
--   reference data  read: all authenticated | write: admin
--   promo_requests  read: all authenticated | write: admin/manager
--                   producers may update rows assigned to them
--   shifts/notes/   read: all authenticated | write: manager or the
--   participants    assignee / an involved participant
--   notifications   strictly own rows
--   activity_logs   read: admin + manager | insert: via log_activity()
-- ===========================================================================

alter table public.profiles          enable row level security;
alter table public.pipeline_stages   enable row level security;
alter table public.channels          enable row level security;
alter table public.programs          enable row level security;
alter table public.promo_goals       enable row level security;
alter table public.promo_types       enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.project_programs  enable row level security;
alter table public.promo_requests    enable row level security;
alter table public.request_participants enable row level security;
alter table public.request_shifts    enable row level security;
alter table public.request_notes     enable row level security;
alter table public.attachments       enable row level security;
alter table public.notifications     enable row level security;
alter table public.activity_logs     enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid());

-- Admins manage everyone; self-management (name, avatar, phone) handled above.
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- reference data — readable by any signed-in user, editable by admins
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pipeline_stages','channels','programs','promo_goals','promo_types','projects']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select_authenticated', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

-- Projects: managers (non-admin) may create/edit projects too.
create policy projects_manager_insert on public.projects
  for insert to authenticated
  with check (public.can_manage());

create policy projects_manager_update on public.projects
  for update to authenticated
  using (public.can_manage())
  with check (public.can_manage());

create policy project_members_select_authenticated on public.project_members
  for select to authenticated using (true);

create policy project_members_admin_all on public.project_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy project_members_manage on public.project_members
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

create policy project_programs_select_authenticated on public.project_programs
  for select to authenticated using (true);

create policy project_programs_admin_all on public.project_programs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy project_programs_manage on public.project_programs
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

-- ---------------------------------------------------------------------------
-- promo_requests
-- ---------------------------------------------------------------------------
create policy promo_requests_select_authenticated on public.promo_requests
  for select to authenticated using (true);

create policy promo_requests_manager_all on public.promo_requests
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

-- A producer/team member may update a request assigned to them, or one they
-- participate in. Read access for everyone is already granted above.
create policy promo_requests_assigned_update on public.promo_requests
  for update to authenticated
  using (
    public.can_manage()
    or assigned_to_id = auth.uid()
    or exists (
      select 1 from public.request_participants rp
       where rp.request_id = promo_requests.id
         and rp.user_id = auth.uid()
    )
  )
  with check (true);

-- ---------------------------------------------------------------------------
-- children of a request
-- ---------------------------------------------------------------------------
create policy request_participants_select_authenticated on public.request_participants
  for select to authenticated using (true);

create policy request_participants_manager_all on public.request_participants
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

create policy request_shifts_select_authenticated on public.request_shifts
  for select to authenticated using (true);

-- Managers, or anyone working the request, may edit shift production data.
create policy request_shifts_contributor_all on public.request_shifts
  for all to authenticated
  using (
    public.can_manage()
    or exists (
      select 1 from public.promo_requests r
       where r.id = request_shifts.request_id
         and (
           r.assigned_to_id = auth.uid()
           or r.requested_by_id = auth.uid()
           or exists (
             select 1 from public.request_participants rp
              where rp.request_id = r.id and rp.user_id = auth.uid()
           )
         )
    )
  )
  with check (
    public.can_manage()
    or exists (
      select 1 from public.promo_requests r
       where r.id = request_shifts.request_id
         and (
           r.assigned_to_id = auth.uid()
           or exists (
             select 1 from public.request_participants rp
              where rp.request_id = r.id and rp.user_id = auth.uid()
           )
         )
    )
  );

create policy request_notes_select_authenticated on public.request_notes
  for select to authenticated using (true);

create policy request_notes_insert_contributor on public.request_notes
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.promo_requests r
       where r.id = request_notes.request_id
         and (
           public.can_manage()
           or r.assigned_to_id = auth.uid()
           or r.requested_by_id = auth.uid()
           or exists (
             select 1 from public.request_participants rp
              where rp.request_id = r.id and rp.user_id = auth.uid()
           )
         )
    )
  );

-- ---------------------------------------------------------------------------
-- attachments: read for authenticated, write for managers or the requester
-- ---------------------------------------------------------------------------
create policy attachments_select_authenticated on public.attachments
  for select to authenticated using (true);

create policy attachments_insert_contributor on public.attachments
  for insert to authenticated
  with check (uploaded_by_id = auth.uid() and public.can_manage());

create policy attachments_delete_owner on public.attachments
  for delete to authenticated
  using (public.is_admin() or (uploaded_by_id = auth.uid() and public.can_manage()));

-- ---------------------------------------------------------------------------
-- notifications: strictly private
-- ---------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activity_logs: readable by admin/manager; inserts go through log_activity()
-- (security definer) so the table needs no client insert policy.
-- ---------------------------------------------------------------------------
create policy activity_logs_select_managers on public.activity_logs
  for select to authenticated
  using (public.can_manage());