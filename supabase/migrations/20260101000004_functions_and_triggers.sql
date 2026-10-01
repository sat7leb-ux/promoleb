-- ===========================================================================
-- SAT-7 Promo — 004: business logic (triggers + RPCs)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Keep request_code auto-generated on insert: PR-<year>-<4 digits>
-- ---------------------------------------------------------------------------
create or replace function public.generate_request_code()
returns trigger
language plpgsql
as $$
declare
  v_year text;
  v_next integer;
begin
  if new.request_code is not null and new.request_code <> '' then
    return new;
  end if;

  v_year := to_char(now(), 'YYYY');
  select coalesce(max(substring(request_code from 9)::integer), 0) + 1
    into v_next
    from public.promo_requests
   where request_code like 'PR-' || v_year || '-%';

  new.request_code := 'PR-' || v_year || '-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

create trigger promo_requests_generate_code
  before insert on public.promo_requests
  for each row execute function public.generate_request_code();

-- ---------------------------------------------------------------------------
-- Mirror the pipeline stage onto the request so list views and KPI counts
-- never need a join, and stamp completion timestamps.
-- ---------------------------------------------------------------------------
create or replace function public.sync_request_stage()
returns trigger
language plpgsql
as $$
begin
  select name, position, is_terminal
    into new.stage_name, new.stage_position, new.is_completed
  from public.pipeline_stages
   where id = new.stage_id;

  if new.stage_name is null then
    raise exception 'Unknown pipeline stage: %', new.stage_id;
  end if;

  if new.is_completed then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger promo_requests_sync_stage
  before insert or update of stage_id on public.promo_requests
  for each row execute function public.sync_request_stage();

-- ---------------------------------------------------------------------------
-- due_state: On Track / Due Soon / Overdue / Completed
--   completed  -> terminal stage
--   overdue    -> past due_date
--   due_soon   -> due within 3 days (configurable via app_settings)
--   on_track   -> everything else
-- ---------------------------------------------------------------------------
create or replace function public.compute_due_state()
returns trigger
language plpgsql
as $$
declare
  v_window integer := 3;
begin
  if new.is_completed then
    new.due_state := 'completed';
  elsif new.due_date is null then
    new.due_state := 'on_track';
  elsif new.due_date < current_date then
    new.due_state := 'overdue';
  elsif new.due_date <= current_date + v_window then
    new.due_state := 'due_soon';
  else
    new.due_state := 'on_track';
  end if;
  return new;
end;
$$;

create trigger promo_requests_due_state
  before insert or update of due_date, is_completed on public.promo_requests
  for each row execute function public.compute_due_state();

-- ---------------------------------------------------------------------------
-- Shift synchronisation.
--   * Creating a request materialises shift_count shift rows.
--   * Raising shift_count appends new rows (existing ones are untouched so
--     production data is never destroyed).
--   * Lowering shift_count removes only the highest-numbered trailing shifts.
--   * request_shifts.shift_count is recomputed on every child change.
-- ---------------------------------------------------------------------------
create or replace function public.sync_shift_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.promo_requests
     set shift_count = (
       select count(*) from public.request_shifts
        where request_id = coalesce(new.request_id, old.request_id)
     )
   where id = coalesce(new.request_id, old.request_id);
  return null;
end;
$$;

create trigger request_shifts_sync_count
  after insert or delete on public.request_shifts
  for each row execute function public.sync_shift_count();

-- Materialise shifts after the request row exists (needs the FK).
create or replace function public.create_initial_shifts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  i integer;
begin
  if new.shift_count > 0 then
    for i in 1..new.shift_count loop
      insert into public.request_shifts (request_id, shift_number)
      values (new.id, i)
      on conflict (request_id, shift_number) do nothing;
    end loop;
  end if;
  return new;
end;
$$;

create trigger promo_requests_create_shifts
  after insert on public.promo_requests
  for each row execute function public.create_initial_shifts();

-- Append/trim shifts when shift_count is edited directly on the request.
create or replace function public.reconcile_shifts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_existing integer;
  v_target   integer;
  i          integer;
begin
  select count(*) into v_existing
    from public.request_shifts where request_id = new.id;

  v_target := greatest(new.shift_count, 0);

  if v_target > v_existing then
    for i in (v_existing + 1)..v_target loop
      insert into public.request_shifts (request_id, shift_number)
      values (new.id, i)
      on conflict (request_id, shift_number) do nothing;
    end loop;
  elsif v_target < v_existing then
    -- only remove the trailing shifts, never the populated early ones
    delete from public.request_shifts
     where request_id = new.id
       and shift_number > v_target
       and coalesce(status, 'planned') = 'planned';
  end if;

  return new;
end;
$$;

create trigger promo_requests_reconcile_shifts
  after update of shift_count on public.promo_requests
  for each row
  when (old.shift_count is distinct from new.shift_count)
  execute function public.reconcile_shifts();

-- ---------------------------------------------------------------------------
-- Participant housekeeping: notify + audit in one place.
-- ---------------------------------------------------------------------------
create or replace function public.notify_participants()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_title text;
  v_body  text;
begin
  select r.title, coalesce(r.request_code, 'Request')
    into v_title, v_body
  from public.promo_requests r
   where r.id = new.request_id;

  insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
  values (
    new.user_id,
    'participant_added',
    'You were added as a participant',
    v_body || ' — ' || v_title,
    '/requests/' || new.request_id::text,
    'request',
    new.request_id
  );

  perform public.log_activity(
    'request', new.request_id, 'participant_added',
    'Participant added', jsonb_build_object('user_id', new.user_id, 'responsibility', new.responsibility)
  );
  return new;
end;
$$;

create trigger request_participants_notify
  after insert on public.request_participants
  for each row execute function public.notify_participants();

-- Notify the new assignee when assigned_to_id changes.
create or replace function public.notify_assignee_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.assigned_to_id is not null
     and new.assigned_to_id is distinct from old.assigned_to_id then

    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
    values (
      new.assigned_to_id,
      'assigned',
      'A promo request was assigned to you',
      coalesce(new.request_code, 'Request') || ' — ' || new.title,
      '/requests/' || new.id::text,
      'request',
      new.id
    );

    perform public.log_activity(
      'request', new.id, 'assignee_changed',
      'Request assigned',
      jsonb_build_object('from', old.assigned_to_id, 'to', new.assigned_to_id)
    );
  end if;
  return new;
end;
$$;

create trigger promo_requests_notify_assignee
  after update of assigned_to_id on public.promo_requests
  for each row execute function public.notify_assignee_change();

-- Notify assignee + participants on every stage change.
create or replace function public.notify_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid;
begin
  if new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  perform public.log_activity(
    'request', new.id, 'status_changed',
    'Status changed: ' || old.stage_name || ' → ' || new.stage_name,
    jsonb_build_object('from', old.stage_name, 'to', new.stage_name)
  );

  -- audience = assignee + all participants, de-duplicated
  for v_user in
    select distinct u from (
      select new.assigned_to_id as u
      union
      select user_id from public.request_participants where request_id = new.id
    ) x
    where u is not null and u <> new.assigned_to_id
  loop
    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
    values (
      v_user,
      'status_changed',
      'Status changed to ' || new.stage_name,
      coalesce(new.request_code, 'Request') || ' — ' || new.title,
      '/requests/' || new.id::text,
      'request',
      new.id
    );
  end loop;

  return new;
end;
$$;

create trigger promo_requests_notify_stage
  after update of stage_id on public.promo_requests
  for each row execute function public.notify_status_change();

-- ---------------------------------------------------------------------------
-- Deadline sweep: creates the "due soon" / "overdue" notifications.
-- Idempotent — safe to run from pg_cron, a Vercel cron route, or by hand.
-- Returns the number of notifications created.
-- ---------------------------------------------------------------------------
create or replace function public.run_deadline_sweep()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_created integer := 0;
  v_row    record;
begin
  for v_row in
    select r.id, r.title, r.request_code, r.due_state, r.due_date, r.assigned_to_id
      from public.promo_requests r
     where r.status = 'active'
       and r.due_date is not null
       and r.due_state in ('due_soon', 'overdue')
  loop
    -- recipient = assignee, else the requester
    if exists (
      select 1 from public.notifications n
       where n.user_id = coalesce(v_row.assigned_to_id, (select requested_by_id from public.promo_requests where id = v_row.id))
         and n.entity_id = v_row.id
         and n.type = (case when v_row.due_state = 'overdue' then 'overdue'::public.notification_type else 'deadline_approaching'::public.notification_type end)
    ) then
      continue;
    end if;

    insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
    values (
      coalesce(v_row.assigned_to_id, (select requested_by_id from public.promo_requests where id = v_row.id)),
      (case when v_row.due_state = 'overdue' then 'overdue'::public.notification_type else 'deadline_approaching'::public.notification_type end),
      (case when v_row.due_state = 'overdue' then 'Request is overdue' else 'Request deadline approaching' end),
      coalesce(v_row.request_code, 'Request') || ' — ' || v_row.title || ' (due ' || v_row.due_date || ')',
      '/requests/' || v_row.id::text,
      'request',
      v_row.id
    );

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

-- ---------------------------------------------------------------------------
-- current_profile(): the app's entry point for "who am I and what may I do".
-- ---------------------------------------------------------------------------
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select role = 'administrator' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.can_manage()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  -- administrators and promo managers may create/edit; producers may update
  -- production data on requests assigned to them (enforced in policies).
  select coalesce(
    (select role in ('administrator', 'promo_manager') from public.profiles where id = auth.uid()),
    false
  );
$$;