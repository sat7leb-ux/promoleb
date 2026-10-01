# Supabase setup

Ordered steps to stand up the database. Budget about 15 minutes.

---

## 1. Create the project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Pick a region close to Lebanon — **Middle East (Bahrain)** if available,
   otherwise **Europe (Frankfurt)**.
3. Save the database password somewhere safe. You will need it for the CLI and
   for direct SQL access. It is not recoverable from the dashboard later.
4. Wait for provisioning to finish.

---

## 2. Find your credentials

**Project URL and anon key** — dashboard → **Project Settings → API**. Copy:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon / publishable key>
```

**Service role key** — same page, further down, under **Service Role**. In newer
dashboards it may be labelled *Secret key*. This key **bypasses RLS**: it can
read and write every row regardless of policy. It is a server-only secret.

```bash
# .env.local — never commit this file
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=<any long random string>
```

> If your key starts with `sb_secret_` rather than `sb_publishable_`, that is
> the new key format. Use it as-is — the app passes it through the standard SDK
> header, which still works.

---

## 3. Apply the migrations

Migrations are numbered and must run in order — later files depend on earlier
ones.

### Option A — the SQL editor (quickest)

Dashboard → **SQL Editor** → **New query**. Open each file in
`supabase/migrations/` in ascending order and run it:

| File | What it does |
|---|---|
| `20260101000001_extensions_and_enums.sql` | Extensions, enums, shared helpers |
| `20260101000002_core_tables.sql` | Profiles, pipeline stages, reference data, projects |
| `20260101000003_promo_requests.sql` | Requests, shifts, participants, notes, attachments, logs, notifications |
| `20260101000004_functions_and_triggers.sql` | Request codes, derived fields, notifications, deadline sweep |
| `20260101000005_rls.sql` | Row Level Security on every table |
| `20260101000006_seed_reference_data.sql` | 14 channels, default pipeline, goals, promo types |
| `20260101000007_settings_and_admin.sql` | Settings table, role helpers, admin bootstrap |
| `20260101000008_storage.sql` | Private `promo-files` bucket and storage policies |

### Option B — the CLI (repeatable, recommended for real projects)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>

supabase db push          # applies everything not yet on the remote
supabase db reset         # or, locally: drop and rebuild from scratch
```

`db push` is the one to use against production; it only applies pending
migrations and never drops data.

---

## 4. Configure auth

Dashboard → **Authentication → Sign In / Providers**.

- **Email** — enable. Leave *Confirm email* on for any environment holding real
  data; turn it off locally if you want frictionless signups while testing.
- Set **Site URL** to `https://promolb.vercel.app` (and
  `http://localhost:3000` while developing).
- Under **Redirect URLs**, allow both:

```
http://localhost:3000/auth/confirm
https://promolb.vercel.app/auth/confirm
```

Those exact paths matter — password-reset emails point at
`${NEXT_PUBLIC_SITE_URL}/reset-password`, and the callback route is
`/auth/confirm`.

If you use a custom SMTP provider, configure it here; Supabase's built-in
service is rate-limited and unsuitable for production.

---

## 5. Create the first administrator

```bash
$env:SUPABASE_URL              = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
$env:ADMIN_EMAIL               = "you@sat7.org"
$env:ADMIN_PASSWORD            = "<at least 12 characters>"
$env:ADMIN_FULL_NAME           = "Your Name"

npm run admin:setup
```

Nothing is hard-coded in the script and nothing is written to disk. It prints
the target address and character counts, never the secrets.

**SQL-only alternative**, if you would rather not run a script:

1. Dashboard → **Authentication → Users → Add user**, with email confirmed.
2. SQL Editor:

   ```sql
   select public.promote_to_administrator('you@sat7.org');
   ```

The SQL route deliberately does not create users or set passwords — that would
mean handling a plaintext password through the SQL editor, which leaves it in
your query history.

---

## 6. Seed demo data (optional, non-production only)

Migration 006 seeds reference data (channels, stages, goals, types) — that is
reference data the app needs, and it belongs in every environment.

**Sample requests are not.** Generate them only against a throwaway database:

```sql
-- Run in the SQL editor of a dev/staging project only.
do $$
declare
  v_project uuid;
  v_program uuid;
  v_channel  uuid;
  v_stage    uuid;
  v_goal     uuid;
  v_type     uuid;
  v_user     uuid;
  r          record;
begin
  select id into v_user from public.profiles where role <> 'viewer' limit 1;
  if v_user is null then
    raise notice 'No staff profile yet — skipping sample requests.';
    return;
  end if;

  select id into v_channel from public.channels order by sort_order limit 1;
  select id into v_program from public.programs where channel_id = v_channel limit 1;
  select id into v_stage   from public.pipeline_stages where key = 'new' limit 1;
  select id into v_goal    from public.promo_goals order by sort_order limit 1;
  select id into v_type    from public.promo_types order by sort_order limit 1;

  for r in select 1, 'Ramadan 2026 opener'
    union all select 2, 'Kids block identity refresh'
    union all select 3, 'Documentaries trailer push'
  loop
    insert into public.promo_requests (
      requested_by_id, requested_by_name, title, channel_id, program_id,
      goal_id, promo_type_id, stage_id, priority, due_date,
      shift_count, status, location, promo_description, key_message
    )
    select v_user, 'Sample User', r.title, v_channel, v_program,
           v_goal, v_type, v_stage,
           (array['normal','high','urgent'])[r.1],
           current_date + (r.1 * 5),
           (r.1 % 3) + 1, 'active', 'Beirut',
           'Sample promo request generated for local development.',
           'Generated locally — safe to delete.'
    returning id into v_project;

    -- Shifts are created by trigger from shift_count, so nothing to insert.
  end loop;

  raise notice 'Sample requests created.';
end $$;
```

---

## 7. Verify

```bash
npm run typecheck
npm run build
npm run dev
```

Sign in as the administrator. Then:

- Dashboard renders KPIs and charts.
- **Pipeline** shows the board with nine columns.
- **Settings → Channels** lists 14 channels, and editing one works.
- Creating a request with shift count 3 produces three shifts.
- Dragging a card between columns updates the request and its timeline.
- Uploading a file to a request works and appears under **Files**.

If the dashboard is empty and every list errors, the usual cause is a migration
that did not apply. `supabase db push` or re-run the SQL files in order.

---

## Troubleshooting

**"Invalid API key" / all queries fail**
`NEXT_PUBLIC_SUPABASE_ANON_KEY` is wrong or has whitespace. Copy it again from
**Project Settings → API**.

**Signed out immediately after signing in**
The middleware cannot refresh the session. Check that `NEXT_PUBLIC_SITE_URL` is
set and that you are on `http`, not `file://` or a raw IP over http.

**Password reset returns to the wrong page**
The redirect URL is built from `NEXT_PUBLIC_SITE_URL`. It must match a **Site
URL** or **Redirect URL** configured in Supabase Auth.

**Uploads fail with "bucket not found"**
Migration 008 did not run. Re-run it — the `insert` is idempotent.

**Uploads fail with a permission error**
Storage RLS is missing. Re-run 008. It only grants to managers, matching the
table policy for `attachments`.

**No data after seeding**
`shift_count` and `due_state` are trigger-maintained. If you inserted rows with
`disable trigger`, they will read as zero — re-run migration 004's trigger
definitions.

**A user signed up but cannot see anything**
Expected. New users default to **Viewer**. Promote them from **Users**, or run
`select public.promote_to_administrator('their@email');`.