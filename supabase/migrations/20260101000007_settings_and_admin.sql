-- ===========================================================================
-- SAT-7 Promo - 007: settings + secure administrator bootstrap
-- ===========================================================================

create table public.settings (
  key        text primary key,
  value      jsonb not null default 'null'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;

create policy settings_select_authenticated on public.settings
  for select to authenticated using (true);

create policy settings_admin_all on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.settings (key, value) values
  ('org_name',      '"SAT-7 Promo"'),
  ('due_soon_days', '3'),
  ('timezone',      '"Asia/Beirut"')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- promote_to_administrator(email)
--
-- Run this ONCE in the Supabase SQL editor immediately after creating the
-- first auth user by hand. It upgrades that user's profile role.
--
-- This deliberately does NOT create the auth user or set a password: doing
-- that in SQL would require handling the password in plaintext on the way in.
-- Instead you create the user in Supabase Auth (or with the setup script in
-- scripts/setup-admin.mjs, which runs entirely on your machine), then run
-- this one-liner to grant the role.
-- ---------------------------------------------------------------------------
create or replace function public.promote_to_administrator(p_email text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from auth.users
   where lower(email) = lower(p_email);

  if v_id is null then
    raise exception 'No auth user found for %', p_email;
  end if;

  update public.profiles
     set role = 'administrator',
         status = 'active'
   where id = v_id;

  perform public.log_activity(
    'user', v_id, 'user_updated',
    'Account promoted to administrator',
    jsonb_build_object('email', p_email)
  );

  return v_id;
end;
$$;

-- Helper so any profile can be listed/updated by admins from SQL if needed.
create or replace function public.set_user_role(p_email text, p_role public.app_role)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then
    raise exception 'No auth user found for %', p_email;
  end if;
  update public.profiles set role = p_role where id = v_id;
  return v_id;
end;
$$;