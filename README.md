# SAT-7 Promo

Centralised promo request management for SAT-7. Replaces ad-hoc spreadsheets and
email threads with one auditable system covering the whole chain:

```
Project → Program → Channel → Promo Request → Shifts → Participants
```

Every link in that chain is a first-class, reportable entity. A request knows
which project it belongs to, which program and channel it promotes, how many
shifts it needs, who is working on it, and every change it has ever been through.

Built with Next.js (App Router), React, TypeScript, Tailwind, Supabase
(PostgreSQL + Auth + Storage), deployed on Vercel.

---

## What it does

**Requests** — full CRUD with search, filtering, sorting and pagination. A
multi-section create form covers basic details, production scheduling and promo
brief. Specifying a shift count creates that many shifts up front, each
editable. Requests can be duplicated, archived and restored.

**Pipeline** — a Kanban board with stages you configure yourself. Dragging a
card between columns changes the request's stage, and every transition is
written to the request's timeline.

**Shifts** — date, call time, location, assigned producer and status, per
request. Changing a request's shift count reconciles the shift list without
losing data on the shifts that survive.

**People** — assignment (who owns the work) is kept separate from participation
(who is involved). Both notify differently, and both are reported on.

**Projects, programs, channels** — each with its own detail page showing live
totals, completion rate, and the requests underneath.

**Reports** — by channel, program, project, request, user workload and shift.
Export any report to CSV or Excel, or print it.

**Notifications** — automatic, internal, and in-app. Assignments, participant
additions, status changes and deadline reminders all land in the header bell
and on a dedicated page.

**Audit trail** — every meaningful change is logged with actor, timestamp and a
summary, and rendered as a timeline on the request.

---

## Getting started

You need a Supabase project and a Vercel account.

```bash
git clone <your-repo>
cd sat7-promo
npm install
cp .env.example .env.local     # then fill in the four values
```

Full walkthrough: **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)** for the
database, **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Vercel.

Then:

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
npm run lint
```

### Creating the first administrator

Credentials are never stored in the repository. The setup script reads them
from environment variables and talks to the Supabase Admin API directly:

```bash
$env:SUPABASE_URL              = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
$env:ADMIN_EMAIL               = "you@sat7.org"
$env:ADMIN_PASSWORD            = "<at least 12 characters>"
$env:ADMIN_FULL_NAME           = "Your Name"     # optional

npm run admin:setup
```

Re-running it is safe and doubles as a password reset for a locked-out admin.
`npm run admin:reset-password` does the same for any user, without touching
their role. Both scripts refuse to guess: they fail loudly on a missing variable
rather than half-running.

Change the password from **Settings → Security** after the first sign-in. If you
prefer to do it entirely in SQL, `select public.promote_to_administrator('you@sat7.org');`
in the Supabase SQL editor works too.

---

## Environment variables

| Variable | Where it runs | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public anon key, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin API: user creation, signed URLs. **Never** prefix this with `NEXT_PUBLIC_` and never commit it |
| `NEXT_PUBLIC_SITE_URL` | Browser + server | Absolute site URL, used for auth redirect origins and password-reset links |
| `CRON_SECRET` | Server only | Guards the deadline sweep endpoint against being called by anyone |

`.env.example` documents all of them. `.gitignore` excludes `.env*`.

---

## Architecture

```
src/
  app/
    (auth)/            login, forgot-password, reset-password
    (app)/             the signed-in shell: dashboard, requests, pipeline,
                       projects, programs, channels, reports, users,
                       notifications, settings
    api/health/        GET health check, POST deadline sweep (cron-guarded)
    auth/confirm/      OAuth / magic-link callback
  components/
    ui/                shadcn/ui primitives, lightly themed
    requests/          form, detail view, shifts, participants, attachments
    dashboard/         KPI cards and filters
    pipeline/          Kanban board (dnd-kit)
    reports/           shared report table and export controls
    projects/ settings/ channels/ programs/ users/ notifications/
  lib/
    auth/              session, permissions, auth actions
    actions/           server actions (the only place writes happen)
    queries/           read helpers, one concern per file
    validation/        zod schemas
    supabase/          browser, server and middleware clients
    reports/           aggregation and CSV/Excel export
  types/database.ts    hand-written Supabase types
supabase/migrations/   numbered SQL, applied in order
scripts/               admin bootstrap, password reset, type generation
```

### Conventions worth knowing before you change things

**Row types in `src/types/database.ts` are `type` aliases, never `interface`.**
This is load-bearing, not style. An `interface` has no implicit index signature,
so it fails the Supabase SDK's `GenericSchema` constraint and every query
silently resolves to `never` — the error surfaces far from its cause. Each
relationship also needs its `Relationships` array; that array is what lets the
SDK infer embedded resources from a `select()`.

**PostgREST `select()` strings must be literals.** Interpolating into a select
string yields a `ParserError` at build time. They are written out in full.

**`'use server'` modules may only export async functions.** A plain exported
constant or helper is a build error, which is why `toFieldErrors` lives in
`lib/validation/field-errors.ts` and the settings defaults live in
`lib/constants.ts`.

**Roles are enforced in three places that must agree:** the permission map in
`lib/auth/permissions.ts` (what the UI shows), the RLS policies in migration
005 (what the database permits), and the server actions (what the action will
accept). Changing one without the others produces a UI that offers an action the
database will reject.

---

## Data model

Full column-level detail is in **[docs/SCHEMA.md](docs/SCHEMA.md)**. At a
glance:

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user; holds role and status |
| `pipeline_stages` | Kanban columns, ordered by `position` |
| `channels`, `programs`, `promo_goals`, `promo_types` | Reference data, admin-editable |
| `projects`, `project_members`, `project_programs` | Campaigns and their scope |
| `promo_requests` | The request itself; carries denormalised `stage_name`, `due_state`, `shift_count` |
| `request_shifts` | One row per shoot day |
| `request_participants` | Who is involved, with a responsibility |
| `request_notes`, `attachments` | Collaboration and files |
| `activity_logs` | Append-only audit trail |
| `notifications` | In-app notifications, strictly per-user |
| `settings` | Organisation-wide key/value configuration |

All primary keys are UUIDs, every foreign key is indexed, and every table
carries `created_at` / `updated_at`.

---

## Reference data

The app ships with 14 SAT-7 channels, a default pipeline, promo goals and promo
types, all seeded by migration 006. **Every one of these is editable in Settings**
— the seed is a starting point, not a constraint. Add, rename, reorder or
archive channels, stages, goals and types without touching SQL.

Pipeline stages shipped: New, Review, Planning, Assigned, Production, Editing,
Approval, Completed (terminal), Cancelled (terminal, marks the request
cancelled).

---

## Permissions

| Role | Can do |
|---|---|
| **Administrator** | Everything, including user management, settings and all reference data |
| **Promo Manager** | Create and edit anything, manage projects, assign work, upload files, view reports |
| **Producer / Team Member** | Create requests, update production data and shifts on requests assigned to them or that they participate in, upload files |
| **Viewer** | Read-only |

Users self-register through the sign-in page and land as **Viewer** by default.
An administrator promotes them from **Users**. New roles are added by editing
one table in `lib/auth/permissions.ts`.

---

## Deployment

Push to GitHub, import into Vercel, add the five environment variables, done.
Vercel's cron job can call `POST /api/health` daily to run the deadline sweep
that raises due-soon and overdue notifications; the endpoint refuses requests
without a matching `CRON_SECRET` header. See
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

Target: **https://promolb.vercel.app**

---

## Notes on judgement calls

A few things the brief left open, decided deliberately:

- **Reference data lives in the database, not in code.** Channels, stages, goals
  and types are all rows. An admin can rename a channel without a deploy.
- **Assignment and participation are separate.** "Owns this" and "is working on
  this" are different facts with different consequences, so they get different
  columns, different notifications and separate report dimensions.
- **Denormalised counters on `promo_requests`** (`shift_count`, `due_state`,
  `stage_name`) are maintained by triggers. Listing and filtering a board would
  otherwise need a correlated aggregate per row.
- **Due state is computed, not stored by the user.** A trigger derives it from
  `due_date` and the terminal flag, so it cannot drift out of sync.
- **Kanban dragging is pointer-only.** Drag and drop has no reliable keyboard
  equivalent, so the status dropdown on the request page is the accessible path
  and is always available.
- **Excel export is SpreadsheetML, not xlsx.** It opens in Excel and LibreOffice
  without pulling in a zip library. CSV carries a UTF-8 BOM and a
  formula-injection guard.
- **Attachments are private.** The bucket is not public; downloads use
  short-lived signed URLs minted by a server action that re-checks permissions.

---

## Licence

Proprietary — internal SAT-7 use.