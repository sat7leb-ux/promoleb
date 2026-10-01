# Data model

Fifteen tables plus a private storage bucket. All primary keys are UUIDs, every
foreign key is indexed, and every table carries `created_at` / `updated_at`
maintained by `set_updated_at()`.

The chain the whole app reports on:

```
Project ──< project_programs >── Program ──> Channel
   │                                      │
   └─< project_members >─ Profile         │
                                          ▼
                              PromoRequest ──> PipelineStage
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              request_shifts  request_  attachments
                              participants
                                    │
                                    ▼
                            activity_logs
```

`app_role`, `priority_level`, `record_status` and `shift_status` are PostgreSQL
enums. `due_state` is a generated text column, not an enum — see below.

---

## Enumerated types

| Type | Values |
|---|---|
| `app_role` | `administrator`, `promo_manager`, `producer`, `viewer` |
| `priority_level` | `low`, `normal`, `high`, `urgent` |
| `record_status` | `active`, `inactive`, `archived` |
| `shift_status` | `planned`, `in_progress`, `done`, `cancelled` |
| `due_state` (text) | `on_track`, `due_soon`, `overdue`, `completed` |

---

## Identity

### `profiles`

One row per auth user, created by trigger on first sign-up.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, references `auth.users` on delete cascade |
| `email` | text | unique, not null |
| `full_name` | text | not null |
| `job_title` | text | |
| `phone` | text | |
| `avatar_url` | text | |
| `role` | app_role | **defaults to `viewer`** |
| `status` | record_status | defaults to `active` |
| `notes` | text | admin-only |
| `last_seen_at` | timestamptz | |

New users land as **Viewer** deliberately. Self-promotion would mean any signup
could reach user management; promotion is an explicit admin action.

---

## Reference data

Editable in Settings. Seeded by migration 006, and never referenced in code.

### `channels`

`id`, `name`, `code`, `description`, `category`, `color`, `status`,
`sort_order`, `notes`

`color` is a token name (`brand`, `violet`, `emerald`, …), not a hex value, so
themes can restyle it. `category` groups channels in reports — Broadcast,
Digital, Social, Radio, Events.

Seeded with the 14 SAT-7 outlets: Arabic, English, French, Kids, Movies, Drama,
Documentaries, News, Religious, Sports, Digital, Social, Radio, Events.

### `programs`

`id`, `name`, `description`, `channel_id` → channels, `responsible_id` →
profiles, `image_url`, `status`, `start_date`, `end_date`, `notes`

A program belongs to a channel. Grouping by program rather than channel alone is
what makes "how many promos did this show get" answerable.

### `pipeline_stages`

`id`, `key` (unique slug), `name`, `description`, `position`, `color`,
`is_terminal`, `is_cancelled`

`position` orders the Kanban columns. `is_terminal` marks a request finished
when the stage is reached. `is_cancelled` additionally sets the request's status
to cancelled — reserved for the dedicated cancelled column.

Seeded: New, Review, Planning, Assigned, Production, Editing, Approval,
Completed (terminal), Cancelled (terminal + cancelling).

### `promo_goals`

`id`, `name`, `description`, `category`, `color`, `is_active`, `sort_order`

The objective a promo serves. A reportable dimension, and the closest thing the
system has to "why are we doing this".

### `promo_types`

`id`, `name`, `description`, `is_active`, `sort_order`

The kind of asset requested — trailer, teaser, bumper, ident.

---

## The request

### `promo_requests`

The centre of the model. Basic details, production scheduling and promo brief all
live on one row.

**Identity and ownership**

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `request_code` | generated, e.g. `PROMO-2026-0001` |
| `title` | not null |
| `request_date` | not null |
| `requested_by_id` | → profiles |
| `requested_by_name` | denormalised, survives a deleted user |
| `company_department` | free text |

**Classification** — `program_id` → programs, `channel_id` → channels,
`project_id` → projects, `promo_type_id` → promo_types, `goal_id` → promo_goals,
`episodes_count`

**Scheduling** — `priority` (priority_level), `due_date`, `deadline`,
`production_start_date`, `production_end_date`, `call_time`, `location`,
`assigned_to_id` → profiles

**Brief** — `promo_goal`, `target_audience`, `promo_description`, `key_message`,
`required_deliverables`, `duration_seconds`, `format`, `language`, `version`

**Internal** — `notes`, `special_instructions`, `internal_notes`

**Derived, trigger-maintained** — these are the columns that make listing and
filtering cheap. Do not write them directly.

| Column | Maintained by |
|---|---|
| `shift_count` | `sync_shift_count()`; kept equal to the number of `request_shifts` rows |
| `stage_id`, `stage_name`, `stage_position` | `sync_request_stage()`; copied from `pipeline_stages` |
| `is_completed`, `completed_at` | `sync_request_stage()`; from the stage's `is_terminal` flag |
| `due_state` | `compute_due_state()`; from `due_date` and `is_completed` |
| `status` | action-driven; `archived` hides a request from the default list |

`requested_by_name` and the four derived groups exist so the request list never
needs a correlated aggregate per row. That is the difference between one indexed
scan and a full join across requests, shifts and stages.

### `request_shifts`

`id`, `request_id` → promo_requests (cascade), `shift_number`, `shift_date`,
`start_time`, `end_time`, `assigned_to_id` → profiles, `location`, `notes`,
`status` (shift_status)

Setting `shift_count` on a request creates or removes shifts to match, preserving
edits on the ones that survive. `shift_number` is 1-based and renumbered on
reconcile so there are no gaps.

### `request_participants`

`id`, `request_id` → promo_requests (cascade), `user_id` → profiles,
`responsibility`, `notes`

Deliberately separate from `assigned_to_id`. Assignment is "this person owns the
work"; participation is "this person is involved". They notify differently and
are reported as different dimensions.

### `request_notes`

`id`, `request_id` → promo_requests (cascade), `author_id` → profiles, `body`,
`is_internal`

### `attachments`

`id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `kind`,
`uploaded_by_id` → profiles, plus one of `request_id` / `project_id` /
`program_id`

Exactly one owner. `kind` is derived from the MIME type on upload (image, video,
document, other) so the UI can pick a thumbnail without sniffing content.

Objects live at `requests/<request_id>/<uuid>-<name>` in the private
`promo-files` bucket. Downloads use short-lived signed URLs minted server-side.

### `activity_logs`

`id` (bigserial), `entity_type`, `entity_id`, `action`, `summary`, `metadata`
(jsonb), `actor_id` → profiles, `actor_name`, `created_at`

Append-only. `actor_name` is denormalised for the same reason as
`requested_by_name`. Written through `log_activity()` so every caller produces
the same shape.

### `notifications`

`id`, `user_id` → profiles, `type`, `title`, `body`, `link`, `entity_type`,
`entity_id`, `read_at`, `created_at`

Strictly per-user under RLS. `link` is an internal path, rendered as a router
link rather than a raw anchor.

---

## Scope

### `projects`

`id`, `code`, `name`, `description`, `manager_id` → profiles, `status`,
`start_date`, `end_date`, `notes`

### `project_members`

`project_id` → projects, `user_id` → profiles, composite PK

Drives the project report and workload roll-ups. Membership is not assignment.

### `project_programs`

`project_id` → projects, `program_id` → programs, composite PK

Scopes which programs are offered when creating a request inside the project.

---

## Configuration

### `settings`

`key` (text PK), `value` (jsonb), `updated_by` → profiles, `updated_at`

Organisation-wide key/value. Seeded with `org_name`, `due_soon_days` and
`timezone`. One row per key, so editing one setting cannot clobber another.

---

## Functions

| Function | Purpose |
|---|---|
| `set_updated_at()` | trigger; stamps `updated_at` on every table |
| `handle_new_user()` | trigger on `auth.users`; creates the `profiles` row as a Viewer |
| `generate_request_code()` | sequence behind `request_code` |
| `sync_request_stage()` | trigger; copies stage name and position onto the request, and derives `is_completed` / `completed_at` |
| `compute_due_state()` | trigger; derives `due_state` from `due_date` and completion |
| `sync_shift_count()` | trigger; keeps `promo_requests.shift_count` equal to the number of shift rows |
| `create_initial_shifts()` | trigger; creates the first `shift_count` shifts |
| `reconcile_shifts()` | trigger; adds or removes shifts when `shift_count` changes, preserving the survivors |
| `notify_participants()` | trigger; notifies participants on a stage change |
| `notify_assignee_change()` | trigger; notifies on assignment |
| `notify_status_change()` | trigger; notifies on stage or status change |
| `run_deadline_sweep()` | raises due-soon and overdue reminders; idempotent |
| `log_activity(...)` | the single entry point for writing the audit trail |
| `current_profile()` | the caller's profile row |
| `is_admin()` | `auth.uid()` is an administrator |
| `can_manage()` | administrator or promo manager |
| `attachment_request_id(text)` | parses the request id out of a storage path |
| `promote_to_administrator(text)` | one-shot role grant for initial setup |
| `set_user_role(text, app_role)` | admin role change |

---

## Row Level Security

RLS is enabled on every table. The full policy set is migration 005; storage
policies are migration 008. The shape:

| Data | Read | Write |
|---|---|---|
| `profiles` | any signed-in user | self, or admin |
| reference data | any signed-in user | admin |
| `promo_requests` | any signed-in user | admin/manager, or the assignee or a participant |
| `request_shifts`, `request_notes`, `request_participants` | any signed-in user | manager, or someone working on the request |
| `attachments` | any signed-in user | admin/manager; delete by admin or uploader |
| `notifications` | **own rows only** | own rows only |
| `activity_logs` | admin, manager | via `log_activity()` |
| `settings` | any signed-in user | admin |
| `storage.objects` (`promo-files`) | any signed-in user | admin/manager |

Three enforcement points must agree on any permission change:

1. `src/lib/auth/permissions.ts` — what the UI offers
2. RLS policies — what the database permits
3. Server actions — what the action accepts

Change one without the others and you get a button that the database rejects.

---

## Migrations

| File | Contents |
|---|---|
| `001_extensions_and_enums.sql` | extensions, enums, `set_updated_at` |
| `002_core_tables.sql` | profiles, reference data, projects and their joins |
| `003_promo_requests.sql` | requests, shifts, participants, notes, attachments, logs, notifications |
| `004_functions_and_triggers.sql` | codes, derived fields, notifications, deadline sweep |
| `005_rls.sql` | RLS on every table |
| `20260101000006_seed_reference_data.sql` | 14 channels, pipeline, goals, promo types |
| `007_settings_and_admin.sql` | settings table, role helpers, admin bootstrap |
| `008_storage.sql` | `promo-files` bucket and storage policies |

Migrations are forward-only and ordered. Later files depend on earlier ones, so
`supabase db push` applies them in sequence and never reverses one that has
already run.

---

## Regenerating types

`src/types/database.ts` is hand-written and drives every query's inferred type.

```bash
npx supabase gen types typescript --project-id <project-ref> --schema public \
  > src/types/database.generated.ts
npm run db:types
npm run typecheck
```

`db:types` writes a `.bak` of the previous file and asks you to typecheck — the
generated row shapes do not always match what the queries expect, and that
mismatch should be reviewed rather than accepted automatically.

Two conventions in that file are load-bearing:

- Row types are `type` aliases, **never `interface`**. An interface has no
  implicit index signature, so it fails the SDK's `GenericSchema` constraint and
  every query silently resolves to `never`.
- Every relationship needs its `Relationships` array. That array is what lets
  the SDK infer embedded resources from a `select()`.