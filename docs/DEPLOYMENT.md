# Deployment to Vercel

Target: **https://promolb.vercel.app**

---

## 1. Push to GitHub

The workspace may not be a git repository yet:

```bash
git init
git add .
git status              # confirm .env* and node_modules are NOT staged
git commit -m "SAT-7 Promo: promo request management"
git branch -M main
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```

`.gitignore` already excludes `.env*`, `node_modules`, `.next` and
`*.tsbuildinfo`. If `git status` shows an `.env.local`, stop and check that
`.gitignore` took effect before committing — it must never be pushed.

---

## 2. Import the project

1. [vercel.com/new](https://vercel.com/new) → **Add New → Project** → **Import**
   your repository.
2. Vercel detects Next.js and fills in the framework preset. Leave it.
3. Click **Deploy**. The first deploy will fail on Supabase env vars — expected,
   and fine.

---

## 3. Add environment variables

**Project → Settings → Environment Variables.** Add all five, for **all**
environments:

| Name | Value | Environment scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | The service role key | **Production + Preview** |
| `NEXT_PUBLIC_SITE_URL` | `https://promolb.vercel.app` | Production |
| `CRON_SECRET` | A long random string, e.g. `openssl rand -hex 32` | Production + Preview |

Set `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000` in the **Development**
environment so local password-reset emails point somewhere reachable.

> `SUPABASE_SERVICE_ROLE_KEY` must **not** start with `NEXT_PUBLIC_`. That prefix
> inlines the value into the JavaScript bundle, which would hand every visitor
> full database access. Vercel will happily let you do it; do not.

Generate a secret:

```bash
openssl rand -hex 32
```

---

## 4. Redeploy

Variables are read at build time, so an existing deploy does not pick them up.
**Deployments → ⋯ → Redeploy**.

---

## 5. Custom domain

**Project → Settings → Domains** → add `promolb.vercel.app`.

If the apex domain is already taken, Vercel will offer `www.promolb.vercel.app`.
Set `NEXT_PUBLIC_SITE_URL` to whichever you actually got, and redeploy — auth
redirects are built from it.

Vercel's HTTPS certificate provisions automatically, usually within a minute.

---

## 6. The deadline sweep

Reminders for due-soon and overdue requests are raised by
`public.run_deadline_sweep()`. It is idempotent — running it twice creates no
duplicate notifications — so the schedule is a floor, not a deadline.

**Project → Settings → Crons** → add:

```
0 7 * * *    /api/health
```

07:00 UTC daily, which is 10:00 in Beirut (EEST) or 09:00 (EET). Adjust if you
would rather it run overnight locally.

Vercel sends the cron request with `Authorization: Bearer $CRON_SECRET`, and
`CRON_SECRET` is set above, so the endpoint's own guard passes. If `CRON_SECRET`
is unset the endpoint returns `503` and stays disabled — deliberately, so a
misconfigured deployment does not expose an open trigger.

Verify manually:

```bash
curl -X POST https://promolb.vercel.app/api/health \
  -H "Authorization: Bearer $CRON_SECRET"
# {"ok":true,"notificationsCreated":3}
```

---

## 7. Supabase auth, for production

Back in Supabase **Authentication → URL Configuration**:

- **Site URL**: `https://promolb.vercel.app`
- **Redirect URLs**: add
  - `https://promolb.vercel.app/auth/confirm`
  - `https://promolb.vercel.app/reset-password`

Keep the localhost entries for local development. Turn off *Confirm email* only
if you want instant signups; leave it on in production so an address has to be
confirmed before it can be used.

---

## 8. Post-deploy checks

Work through this list. Each item is a real failure mode, not ceremony.

| Check | Expected |
|---|---|
| `/api/health` (GET) | `{"ok":true,...,"configured":true}` |
| `/login` | Sign-in form renders with the brand panel |
| Sign in as the administrator | Redirects to `/dashboard`, not back to login |
| `/dashboard` | KPIs and charts render with real numbers |
| `/pipeline` | Nine columns; drag a card; it moves and the timeline records it |
| `/requests/new` | Form saves; shift count 3 creates three shifts |
| `/requests/[id]` | Tabs: Production, Shifts, People, Files, Notes, Activity |
| Upload a file | Appears under Files; signed URL opens it |
| `/settings/channels` | 14 channels; edit one; change persists |
| `/settings/stages` | Reorder with the arrows; the board reorders |
| `/users` | Promote a test user to Producer; sign in as them |
| As a Viewer | No "New request", no edit affordances |
| Global search (⌘K) | Finds a request by title or code |
| A report | Exports to CSV; Excel opens the file |
| Mobile width | Sidebar collapses; tables scroll |

---

## Troubleshooting

**Blank page / `NEXT_PUBLIC_SUPABASE_URL is undefined`**
The variable was added after the deploy. Redeploy — Next.js inlines `NEXT_PUBLIC_*`
at build time.

**Every query returns empty**
Check Supabase **Logs → Postgres** for a failing query, then
**Logs → Auth** for rejected JWTs. A wrong anon key is the usual cause.

**Cron never fires**
Cron jobs only run on **production** deployments, not previews. Confirm the path
starts with `/`. Hobby plans limit crons to once per day — the schedule above
fits. Check the function logs for `run_deadline_sweep`.

**"Build failed: A 'use server' file can only export async functions"**
Something non-async is exported from a server action module. Plain constants and
helpers belong in `lib/constants.ts` or a dedicated non-`'use server'` file.

**Password reset lands on a Vercel 404**
`NEXT_PUBLIC_SITE_URL` does not match the deployed domain. It is read at request
time, so a redeploy is enough — but verify it is set on the production
environment, not just preview.

**Uploads fail**
Migration 008 did not run, or storage RLS is missing. Re-run it; it is
idempotent.

---

## Rollback

Vercel keeps every deployment. **Deployments → ⋯ → Promote to Production**
instantly routes traffic back. For a database rollback, migrations are
forward-only by design — take a snapshot first, and prefer writing a corrective
migration over reversing one that may already have run.