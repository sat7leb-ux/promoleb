# MEMORY — SAT-7 Promo

## What this project is

Promo request management web app for SAT-7. Built from scratch: Next.js 15 (App
Router), React 19, TypeScript, Tailwind, shadcn/ui, Framer Motion, Recharts,
@dnd-kit. Deployment target Vercel.

Covers the full chain:
`Project → Program → Channel → Promo Request → Shifts → Participants`

## Status: code complete, NOT yet functional (no database)

- `npx tsc --noEmit` → clean
- `npm run lint` (eslint 9 flat config) → 0 errors, 0 warnings
- `npm run build` → 32 pages, builds clean on Vercel
- GitHub: `sat7leb-ux/promoleb`, branch `main`, HEAD `db7c9fa`
- Live URL: **https://promoleb.vercel.app** (note the "e")

## CRITICAL: the URL

Working: `promoleb.vercel.app`
NOT working: `promolb.vercel.app` (no "e" — belongs to another Vercel account,
serves "Login - Vercel". Alias registered on our side but traffic does not come
to us. Only the owner or Vercel support can release it. Do not retry.)

Also never share `promoleb-<hash>-test-1-640c.vercel.app` URLs — per-build
throwaways, some deleted during cleanup.

## Database situation (the blocker)

Sign-in cannot work: the promo schema exists in NEITHER database.

**Supabase `nexbyquzytajhmklapjs`** — REJECTED. Different live app: 28 tables
(events, conversations, social_posts…), 4 real users. Its `profiles` schema is
incompatible (different `role` enum, `is_active` vs `status`). Migrations collide.
Separately: `permission denied to set parameter "db.schemas"` and the config API
returns 404 for the token, so the "separate schema" workaround is also blocked.
Probed and cleaned up fully — DB left exactly as found.
Token `sbp_fcd2...` sees 0 orgs, cannot create projects. Account at 2-project limit.

**Neon `old-cloud-00958272` (name `promoleb`), branch `production`
(`br-gentle-brook-b53k5huc`)** — PROVISIONED, empty, waiting.
- Postgres 18.6, 0 tables
- Neon Auth + Data API + private `promo-files` bucket all live
- `neon.ts` declares `auth: true, dataApi: true, buckets: {...}`
- Neon CLI 7.0.2, MCP connected, skills installed
- Key insight: Neon's **Data API is PostgREST-compatible**, built for Supabase
  migrations — so the 17 `supabase-js` query modules do NOT need rewriting to SQL.
  An earlier assumption that they would was wrong.
- `.env.local` holds 10 Neon vars, verified git-ignored

## Neon migration — DATABASE COMPLETE ✅ / APP NOT MIGRATED

**The Neon schema is fully built and verified live:**

| | |
|---|---|
| Tables | 18 |
| Indexes | 71 |
| Triggers | 20 |
| RLS policies | 41 |
| Functions | 17 (all) |
| Seed | 14 channels, 9 stages, 11 goals, 8 promo types, 3 settings |

**Use `scripts/migrate.mjs` — do not apply SQL by hand again.**

```powershell
node scripts/migrate.mjs --status   # what is applied / pending / skipped
node scripts/migrate.mjs           # apply pending
```

It reads the numbered files from `supabase/migrations` and executes them against
`DATABASE_URL` (loaded from `.env.local`), tracks applied files in
`public._migrations`, and reports each statement so a failure names itself.
**The point is that the SQL never passes through an agent's context** — that is
how 004–007 applied clean on the first attempt.

008 is skipped in code. 002 is hand-patched from its original first application
and recorded via `scripts/record-applied.mjs`; do not re-run it.

**The only patches Neon ever needed** (both in 002):

```sql
-- identity table
- id uuid primary key references auth.users (id)
+ id uuid primary key references neon_auth.user (id)

-- signup trigger: Neon Auth keeps the display name in `name`
- coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email,'@',1))
+ coalesce(new.name, split_part(new.email, '@', 1))
```

004–007 needed **no changes at all**.

## REMAINING WORK — the app side (nothing here is started)

1. Swap the client to `@neondatabase/neon-js` with `SupabaseAuthAdapter()`.
   Touches `src/lib/supabase/{client,server,middleware}.ts`. Reference guide:
   https://neon.com/docs/auth/migrate/from-supabase.md
2. **Resolve the `@supabase/ssr` question — the main risk.** It does cookie-based
   session refresh in `src/middleware.ts` and `src/lib/supabase/middleware.ts`.
   Prove Neon works here before touching the other 23 files.
3. Fix `changePasswordAction` in `src/lib/auth/actions.ts` — Neon Auth's
   `updateUser()` rejects `password` and `email`.
4. Move attachments to Neon Object Storage. `src/lib/actions/attachments.ts` uses
   `supabase.storage.*`; S3 credentials (`AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ENDPOINT_URL_S3`) are already in
   `.env.local`. `public.attachments` is already correct — it only stores
   `storage_path`.
5. Vercel: replace `NEXT_PUBLIC_SUPABASE_*` with the Neon base URL, redeploy,
   verify sign-in end to end.
6. Create the admin user (`eliekhachane@sat7.org`) and promote to administrator.
7. Update `.env.example`, README, `docs/SUPABASE_SETUP.md`, `docs/DEPLOYMENT.md`.
8. Commit and push.

## Neon migration — research COMPLETE

User said "go". Findings so far (verified empirically, not assumed):

**Good news — the migration is far smaller than first feared.**

- `auth.uid()` **already exists** in Neon (real `pg_session_jwt` C function).
  So all 21 RLS references port unchanged.
- Neon Auth created `neon_auth.user/session/account/jwks/...` in the `neon_auth` schema.
- Neon has an official Supabase→Neon guide:
  https://neon.com/docs/auth/migrate/from-supabase.md
  `@neondatabase/neon-js` + `SupabaseAuthAdapter()` keeps **both** `.auth.*` calls
  and `.from()` queries source-compatible. Mostly a find/replace.

**Verified environment:**
- Data API URL: `https://ep-muddy-paper-b53amxoe.apirest.c-7.us-east-2.aws.neon.tech/neondb/rest/v1`
- Data API responds (400 unauthenticated = endpoint live, needs auth headers)
- Postgres 18.6, region aws-us-east-2 (all services supported here)
- A throwaway `public.api_probe` table + RLS policies was created for testing — clean up
- `neon_auth.user` columns are camelCase: id, name, email, emailVerified, image,
  createdAt, updatedAt, role, banned, banReason, banExpires

**KNOWN BREAKAGES to handle:**
1. `updateUser()` does **not** support `password`/`email` — `changePasswordAction`
   in `src/lib/auth/actions.ts` uses `supabase.auth.updateUser({ password })`. Must change.
2. `@supabase/ssr` `createServerClient` (cookie session refresh) is used in
   `src/lib/supabase/{server,middleware}.ts` and `src/middleware.ts`. Neon JS is a
   different model — **this is the main integration risk**, verify before assuming.
3. Storage: `src/lib/actions/attachments.ts` uses `supabase.storage.*` + migration 008
   creates `storage.buckets`/`storage.objects`. Neon has S3 Object Storage instead
   (`AWS_*` vars are in `.env.local`) — needs the S3 SDK, not PostgREST.
4. Migration 002 has an `on_auth_user_created` trigger on `auth.users` — that table
   does not exist in Neon; must repoint to `neon_auth.user` or drop it.
5. Email verification flow differs from Supabase (Neon requires building the UI).
   The app currently creates users via admin API, so likely unaffected.

**Implementation order:**
1. Adapt + apply migrations to Neon (drop storage schema, fix `auth.users` trigger)
2. Swap client to `@neondatabase/neon-js`, resolve the `@supabase/ssr` question
3. Fix `changePasswordAction`
4. Move attachments to Neon Object Storage (S3)
5. Vercel: swap env vars → `NEXT_PUBLIC_NEON_URL` etc, redeploy, verify sign-in
6. Update `.env.example`, README, docs; commit and push

## Known-good CLI commands for this project

```powershell
# run DIRECTLY, never via Start-Job (job cwd resolution fails in this env)
$env:NEON_API_KEY='napi_hv8b5gi14p7qe3nn2mp1un1bl64ag367qc5ftputgjds2ssch3cto88acef5fzfb'
neon config plan      # dry run
neon deploy           # apply neon.ts
neon status
```

Neon MCP tools are also available via `execute` → `tools.Neon.*`
(`run_sql`, `run_sql_transaction`, `list_docs_resources`). Always pass
`project_id: "old-cloud-00958272"` and `branch_id: "br-gentle-brook-b53k5huc"`.

## Load-bearing technical conventions

- `src/types/database.ts` row types must be `type` aliases, **never `interface`**.
  An interface lacks an implicit index signature, fails the SDK's `GenericSchema`,
  and silently collapses every query to `never`. `Relationships` arrays are
  required — they drive embedded-resource inference.
- PostgREST `select()` strings must be **literals**; interpolation yields `ParserError`.
- `'use server'` modules may only export async functions. Plain exported objects
  are a build error (hence `toFieldErrors` in `field-errors.ts`, `ORG_SETTINGS_DEFAULTS`
  in `constants.ts`).
- Never key logic on stage **display names** — stages are renameable in Settings.
  Key on stable `key`/ids. (Was a real bug in 4 places.)
- Actions returning data need `ActionState<T>` widening in `useActionState`, or the
  action's `_prev` param must accept it.
- ESLint flat config `eslint.config.mjs` (not `next lint`, which prompts).

## Environment quirks that waste time

- **Absolute paths often fail to resolve; use relative paths from cwd.**
  `C:\Users\TITLEB\Documents\Default Project` resolves from the shell's cwd but
  `Test-Path` on the absolute path can return False. PowerShell `Start-Job` +
  `Set-Location` to that path fails, so files land in the wrong directory —
  run neon/vercel commands **directly**, never in a job.
- Vercel `link` rewrites `.gitignore` adding `.env*`, which un-tracks
  `.env.example`. Keep the `!.env.example` negation.
- Vercel CLI showed `UNKNOWN` for ~40 min on several deploys — transient network,
  not a quota. The build eventually succeeded.
- Console rendering of `·` (U+00B7) can look like corruption. Verify at byte level
  before "fixing" it — the files were fine.

## Credentials provided this session (all user-supplied, never committed)

- Supabase PAT: `sbp_fc3a…` (wrong account), `sbp_fcd2…` (right project, no org scope)
- Neon API key: `napi_hv8b…`
- Vercel CLI pre-authenticated as `sat7leb-6542`, team `test-1-640c`
- Admin account to provision: `eliekhachane@sat7.org` — password generated at
  setup time, never stored in source