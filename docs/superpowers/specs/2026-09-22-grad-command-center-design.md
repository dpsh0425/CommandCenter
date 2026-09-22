# Grad Command Center — Design Spec

**Status:** Approved for planning
**Author:** Dipesh Bhatta (via design session with Claude)
**Date:** 2026-09-22

## 1. Purpose

Replace the Claude Artifact-based "Deadline Compass" tracker with a real, standalone
personal operations system: a ranked, filterable directory of US R1+R2 (and
Canada/Australia) computer science programs, per-school outreach tracking, an
activity timeline that folds in Gmail replies automatically, and a dashboard —
plus a genuine cross-project task engine (people, assignment, deadlines,
reassignment, results) that covers both the grad-application pipeline and the
Nepali benchmark research project (The Broken Ruler) from day one. Built to grow
later into KACOF/work tracking without a redesign.

This isn't a flat checklist with a coat of paint — tasks are first-class objects
that can be assigned to named people, reassigned, given deadlines, and closed
with a logged result, and they can optionally attach to a school or a research
milestone. That's what makes this "one system" rather than three trackers glued
together.

The Claude Artifact tracker (`db` capability) was outgrown because artifacts run in
a sandboxed browser context that cannot make network calls to an external database
like Supabase — this app steps outside that sandbox entirely.

The Claude Artifact tracker (`db` capability) was outgrown because artifacts run in
a sandboxed browser context that cannot make network calls to an external database
like Supabase — this app steps outside that sandbox entirely.

## 2. Non-goals (explicitly out of scope for this build)

- Sending or composing email from the app. Read-only Gmail tracking only — the user
  writes and sends every email themselves from Gmail.
- KACOF/work tracking module. Same database, future phase, not built now — the
  task engine's `entity_type` design (section 4a) leaves room for a `work_item`
  type later without a schema rewrite.
- Drag-and-drop on the task kanban board. Status changes happen via a control on
  the card (a select or a "move to..." action), not drag gestures — real
  drag-and-drop is a nice-to-have, not required for the board to work.
- File uploads (SOP PDFs, CVs, letters themselves). SOP versions and letters are
  tracked as structured metadata (label, status, dates, notes) — not file
  storage. If you want the actual files stored later, that's a Supabase Storage
  addition on top of this schema, not a redesign.
- Automation rules as a generic, user-configurable rules engine. The two
  specific rules described in section 4d (reply → follow-up task,
  acceptance → visa checklist) are hardcoded application logic, not a rules UI
  you can extend yourself — building a general automation-rule builder is real
  scope this phase doesn't need.
- Automatic (cron-based) Gmail sync. Manual "Sync Gmail" button only, because
  automatic background sync needs a live scheduler, which only makes sense once
  this is deployed (Vercel Cron), and deployment is explicitly deferred.
- A live Python/FastAPI service. Python is used only for one-time/re-runnable ETL
  scripts in this phase; a documented pattern for a future AI feature is included
  but nothing runs as a persistent Python process.
- Multi-user support. Real Supabase Auth is used (per the user's choice, for
  safety if this is ever deployed to a public URL), but the system is designed and
  RLS-scoped for exactly one user.

## 3. Architecture

- **Frontend/backend:** Next.js 14, App Router, TypeScript. Server Components for
  data fetching, Server Actions for mutations (school updates, Gmail sync trigger,
  action-item CRUD).
- **Database/Auth:** Supabase (Postgres + Supabase Auth), accessed via
  `@supabase/ssr` (server client in Server Components/Actions, browser client for
  any client-side interactivity). Row-Level Security scoped to the authenticated
  user's id on every table.
- **Hosting (this phase):** Local only, `npm run dev`. Designed so that deploying
  to Vercel later requires no architecture change — only adding environment
  variables in the Vercel dashboard and (for Gmail auto-sync) a Vercel Cron job.
- **App shell:** every page under `app/(app)/` renders inside one persistent
  navigation shell — a left rail on desktop (Dashboard, Today, Timeline, Wins,
  then Schools/Tasks/Research/People), a bottom tab bar on mobile (the five
  primary destinations only — Today/Timeline/Wins are reached from the
  dashboard's quick links or the command palette on mobile, not a sixth+
  bottom-bar icon). The rail's active item highlights from the current route.
  This is its own task (built once other pages exist and it's clear what needs
  linking to, not upfront) — see the implementation plan.
- **Python:** Used for the one-time ranked-list ETL pipeline (`scripts/`), run
  manually via `python scripts/build_school_list.py`, not a running service.
  Future AI features get a documented pattern for a Vercel Python serverless
  function (`/api/*.py`) — colocated with the Next.js deployment, no second host,
  see section 8.

## 4. Data model

All tables live in the `public` schema, RLS-enabled, policies scoped to
`auth.uid() = owner_id` (a column present on every table, defaulting to the
authenticated user's id at insert time via a trigger or Server Action check).

### `schools`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | default `gen_random_uuid()` |
| owner_id | uuid | FK to `auth.users`, RLS key |
| name | text | institution name, as it should display |
| country | text | `USA`, `Canada`, `Australia` |
| carnegie_tier | text, nullable | `R1`, `R2`, or null for non-US schools |
| csranking_nlp_rank | int, nullable | rank within the NLP area on CSRankings.org |
| csranking_nlp_score | numeric, nullable | raw adjusted-publication-count score |
| verified_fit | boolean, default false | true for the hand-researched schools |
| faculty | text, nullable | named faculty contact(s), free text |
| fit_note | text, nullable | one-line fit rationale |
| contact_email | text, nullable | the actual person's email, used for Gmail matching |
| composite_score | numeric, nullable | computed by the ETL pipeline, see section 6 |
| status | `school_status` enum | see below |
| deadline_note | text, nullable | e.g. "priority Dec 1, 2026 — unconfirmed" |
| deadline_date | date, nullable | only set when independently confirmed |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | updated by trigger on any row change |

`school_status` enum: `not_started`, `researching`, `contacted`, `replied`,
`submitted`, `interview`, `accepted`, `rejected`.

### `actions`

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| text | text | |
| done | boolean, default false | |
| order_index | int | display order |
| created_at | timestamptz | |

### `activity_log`

The unified per-school timeline: manual notes, status changes, and Gmail replies
all land here, rendered newest-first on each school's detail view.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| school_id | uuid | FK to `schools`, cascade delete |
| type | `activity_type` enum | `note`, `status_change`, `email_reply`, `comment` |
| content | text | the note text, or a generated string for status changes |
| email_message_id | text, nullable | Gmail message id, unique per owner — used for de-dup |
| email_snippet | text, nullable | short preview of the email body |
| occurred_at | timestamptz | when the event happened (email date, or now() for manual entries) |
| created_at | timestamptz | when the row was written |

Unique constraint: `(owner_id, email_message_id)` where `email_message_id is not
null` — prevents inserting the same Gmail message twice on repeated syncs.

### `gmail_tokens`

Server-only table — RLS policy allows the owner to read/write only via
Server Actions using the Supabase server client with the user's session; never
fetched from client-side code, never rendered anywhere in the UI beyond a
"connected" boolean.

| Column | Type | Notes |
|---|---|---|
| owner_id | uuid, PK | one row per user |
| refresh_token | text | encrypted at rest (Supabase Vault, see section 7) |
| access_token | text, nullable | short-lived, refreshed on demand |
| expires_at | timestamptz, nullable | |
| scope | text | should always be exactly `gmail.readonly` |
| connected_at | timestamptz | |
| last_synced_at | timestamptz, nullable | |

## 4a. The task engine (people, tasks, updates, research milestones)

This is the ERP-style core that makes the system feel like one operation
instead of a school tracker with a to-do list bolted on. All four tables below
are RLS-scoped the same way as section 4's tables.

### `people`

Fully user-managed — nothing pre-seeded. You are not a row here; "assigned to
me" is represented by a null `assignee_id` on `tasks` being treated as "you" in
the UI, or optionally by seeding one `people` row for yourself if that reads
more naturally in the board — implementer's call, document the choice.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| name | text | |
| role | text, nullable | free text, e.g. "Research co-annotator" |
| area | text, nullable | free text tag, e.g. "research", "grad apps" |
| email | text, nullable | optional, not used for Gmail matching (that's `schools.contact_email`) |
| color | text, nullable | hex, for the person's avatar chip in the UI |
| created_at | timestamptz | |

Deletion is permanent (a real `DELETE`, not a soft-disable flag) — the person
disappears from the People page entirely. `tasks.assignee_id` uses
`ON DELETE SET NULL`, so deleting a person un-assigns their tasks (back to
"Unassigned") rather than deleting or orphaning task history. The UI must
confirm before this delete, since it's irreversible.

### `research_milestones`

Seeded once, by hand or a one-time script, from the actual Week 1 foundation
plan already written for the Nepali benchmark study
(`nepali-benchmark/docs/superpowers/plans/2026-09-22-week1-foundation.md`) —
real milestones, not placeholders.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| title | text | e.g. "Verification gate", "Pilot annotation" |
| description | text, nullable | |
| target_date | date, nullable | |
| status | `milestone_status` enum | `not_started`, `in_progress`, `done`, `blocked` |
| created_at | timestamptz | |

### `tasks`

The central entity. Every task optionally links to exactly one of a school or
a research milestone (never both) via nullable foreign keys — a check
constraint enforces this exclusivity rather than leaving it to application
code to get right.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| title | text | |
| description | text, nullable | |
| school_id | uuid, nullable | FK to `schools`, cascade delete |
| research_milestone_id | uuid, nullable | FK to `research_milestones`, cascade delete |
| assignee_id | uuid, nullable | FK to `people`, `ON DELETE SET NULL` |
| status | `task_status` enum | `todo`, `in_progress`, `blocked`, `done`, `cancelled` |
| priority | `task_priority` enum | `low`, `medium`, `high` |
| due_date | date, nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger, same pattern as `schools` |

Check constraint: `not (school_id is not null and research_milestone_id is not
null)` — a task is either general, school-linked, or milestone-linked, never
both at once.

### `task_updates`

The log that makes "results" and "reassign" real instead of a status flag
flipping silently. Every status change, reassignment, and logged result is a
row here, newest-first on the task's detail view — structurally the same
pattern as `activity_log` on schools, generalized to tasks.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| task_id | uuid | FK to `tasks`, cascade delete |
| type | `task_update_type` enum | `note`, `status_change`, `reassignment`, `result` |
| content | text | free text, or a generated string for status/reassignment changes |
| created_at | timestamptz | |

A reassignment writes a row like `"Reassigned from You to <name>"`; a result on
a `done` task is where the actual outcome goes (e.g. "kappa = 0.52, protocol
revised" for a research task) — status alone never carries that information.

## 4b. Application logistics (letters, SOP versions, interviews, visa steps)

The parts of a real application season that quietly go wrong if nothing tracks
them — sourced from how applicants actually get burned, not from generic
"application tracker" feature lists.

### `letter_requests`

A recommendation letter is its own tracked object, separate from the school's
`status` — a school can be `submitted` while a letter is still `asked`, and
that gap is exactly what this table exists to surface.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| school_id | uuid | FK to `schools`, cascade delete |
| recommender_id | uuid | FK to `people` — a recommender is a `people` row like any other, `ON DELETE SET NULL` |
| status | `letter_status` enum | `not_asked`, `asked`, `confirmed`, `submitted` |
| letter_deadline | date, nullable | often earlier than the school's own application deadline — track separately |
| notes | text, nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger |

### `sop_versions` and school-level linkage

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| label | text | e.g. "v3 — Australia research-proposal variant" |
| description | text, nullable | what's different about this version |
| external_link | text, nullable | a link to the actual doc (Google Docs, etc.) — no file storage, see Non-goals |
| created_at | timestamptz | |

Add two nullable columns to `schools` (migration, not a new table):
`sop_version_id uuid references sop_versions(id) on delete set null` and
`sop_sent_at date`. A school shows which SOP version was actually sent and
when, directly on its detail page.

### `interviews`

One row per interview round — a school can have more than one (initial +
faculty interviews are common).

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| school_id | uuid | FK to `schools`, cascade delete |
| scheduled_at | timestamptz, nullable | |
| prep_notes | text, nullable | |
| questions_asked | text, nullable | filled in after — becomes a question bank across schools over time |
| outcome_notes | text, nullable | |
| status | `interview_status` enum | `not_scheduled`, `scheduled`, `completed` |
| created_at | timestamptz | |
| updated_at | timestamptz | trigger |

### `visa_steps`

Post-acceptance logistics — the second wave of deadlines that shows up only
after the application deadlines are behind you, and is easy to lose track of
in the relief of an acceptance.

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| school_id | uuid | FK to `schools`, cascade delete |
| step_name | text | e.g. "I-20 received", "Visa appointment", "Financial documents submitted" |
| status | `step_status` enum | `not_started`, `in_progress`, `done` |
| due_date | date, nullable | |
| notes | text, nullable | |
| created_at | timestamptz | |

## 4c. Productivity layer (command palette, journey timeline, wins feed, focus mode)

Features that make the system feel operated, not just filled in.

**Command palette** (Cmd/Ctrl+K, plus a visible "Search or jump to…" button in
the nav rail for anyone on a device without that keyboard shortcut handy): a
client-side overlay backed by a `globalSearch(query)` Server Action that
queries `schools`, `tasks`, `people`, and `research_milestones` by name/title
(`ilike`) and returns grouped results, plus a fixed list of quick actions (new
task, new person, new school). Doubles as the system's search — a separate
search feature is redundant with this and isn't built.

**Journey timeline**: a horizontal view, today through the latest known
deadline, plotting confirmed `schools.deadline_date` values and
`research_milestones.target_date` values as markers on one axis, with a "today"
line. Distinct from the dashboard's short deadline strip — this is the
whole-season view, not the next-two-weeks view.

**Wins feed**: a filtered read of `activity_log` and `task_updates` where a new
boolean column `is_win` is true. Set `is_win = true` at write time (not
computed at read time) for: any `email_reply` activity, a school `status_change`
whose new status is in `('replied','submitted','interview','accepted')`, any
`task_updates` row of type `result`, and a task `status_change` to `done`. This
keeps the feed's query a plain `where is_win = true order by created_at desc`
rather than reimplementing "what counts as good news" as read-time logic in
more than one place.

**Focus mode**: opens from a task's detail view. An in-page (not OS/browser
fullscreen — see the artifact platform's own constraints if this is ever
rebuilt as an Artifact; irrelevant for a real Next.js app but worth noting) expanded
layout: the task's title and description large, a countdown timer (default 25
minutes, adjustable), everything else visually quieted. On session end, prompt
to log a note to that task. Backed by a new `focus_sessions` table:

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid | |
| task_id | uuid | FK to `tasks`, cascade delete |
| started_at | timestamptz | |
| duration_minutes | int | planned duration |
| ended_at | timestamptz, nullable | null while a session is in progress |

This exists because the research project's own Master Plan explicitly warns
that annotation quality collapses when done in fragmented gaps and needs
concentrated blocks — focus mode is earned from something already written, not
a generic gamification bolt-on. It also gives an honest answer, later, to
"was the plan's 2-5-minutes-per-item annotation estimate right" by comparing
logged focus-session time against actual items completed.

## 4d. Task engine extensions: dependencies and automation

**Task dependencies**: a `task_dependencies` join table
(`task_id`, `depends_on_task_id`, both FK to `tasks` cascade delete, composite
PK) recording "task_id cannot start until depends_on_task_id is done." The UI
surfaces this as a visible "waiting on: <title>" warning **on the kanban card
itself**, not only on the task's detail page — a blocker you only discover
after clicking in is much less useful than one you see while scanning the
board. Not an enforced hard lock — you can still override status manually,
since the plan/spec's own troubleshooting sections are full of cases where
flexibility matters more than rigidity.

**Automation (two hardcoded rules, not a rules engine — see Non-goals):**
1. When a school's `status` changes to `replied` (whether by manual edit or by
   Gmail sync), auto-create a task: "Follow up with `<school name>`", linked to
   that school, due 3 business days out, unassigned. This does not require
   confirmation — creating a task is low-cost and reversible (delete it if
   unwanted), unlike the Gmail-sync status-change *suggestion* in section 7,
   which does require confirmation because it overwrites existing data.
2. When a school's `status` changes to `accepted`, auto-create a default set of
   `visa_steps` rows for that school (the four step names in section 4b's
   example, as a starting checklist) if none exist yet for that school.

## 5. Auth

Supabase Auth, email/password or magic link (implementer's choice at build time —
either is a few lines of difference). Every table's RLS policy requires
`auth.uid() = owner_id`. No public sign-up flow is exposed; the one account is
created directly in the Supabase dashboard or via a one-time script.

## 6. Ranked-list pipeline (Python, `scripts/build_school_list.py`)

Run manually, re-runnable, outputs a CSV for manual review before it touches the
database (never auto-writes to production data without a human look).

1. **Fetch CSRankings data.** Clone or download the CSV files from the
   `csrankings/csrankings` GitHub repository (`csrankings.csv`:
   name/affiliation/area/count columns; `country-info.csv` for filtering to
   US/Canada/Australia institutions). Compute each institution's NLP-area score
   using CSRankings' own published per-area adjusted-count methodology — do not
   invent a different scoring approach; replicate theirs so the number means what
   it claims to.
2. **Fetch Carnegie Classification data.** Pull the current public R1/R2
   institution list (Carnegie Classification of Institutions of Higher Education,
   ACE-hosted). Filter to the subset with a CS PhD program footprint (cross-check
   against the CSRankings institution list from step 1, since CSRankings already
   only includes CS-research-active departments).
3. **Fuzzy-match institution names** between the two datasets (Python `rapidfuzz`
   library, similarity threshold e.g. 90+). Write every match below the threshold,
   and every match resolved automatically, to the review CSV with a `match_confidence`
   column — do not silently accept low-confidence matches.
4. **Compute `composite_score`:**
   `normalize(csranking_nlp_score) * 0.6 + (verified_fit ? 25 : 0) + keyword_match_score * 0.15`
   where `keyword_match_score` is a count of hits (0-3+, capped) against a fixed
   keyword list (`low-resource`, `multilingual`, `endangered language`,
   `benchmark`, `evaluation`, `dataset quality`, `translation`) scanned against
   any known faculty/research-area text scraped incidentally during matching —
   this is a heuristic, not a guarantee, and the spec for the plan should say so
   in the script's own output/README.
5. **Merge with the 26 already-verified schools** (matched by name against the
   combined list; update in place rather than duplicate; preserve `faculty`,
   `fit_note`, `verified_fit=true` from the existing hand-researched data).
6. **Output** `schools_import.csv` for the implementer to review by hand before
   loading (via `supabase` Python client or a `COPY`/SQL insert script) into the
   `schools` table.

This script's output is data for a human to sanity-check, not something the plan
should treat as silently authoritative — flag this explicitly in the
implementation plan's task for this step.

## 7. Gmail integration

- **OAuth setup** (user does this manually, steps documented in the plan): create
  a Google Cloud Console project, configure the OAuth consent screen (Testing
  mode is sufficient for a single-user app — full verification is not required
  when the only test user is the account owner), create OAuth 2.0 credentials
  (Web application type), add `http://localhost:3000/api/gmail/callback` as an
  authorized redirect URI, request only the `https://www.googleapis.com/auth/gmail.readonly`
  scope.
- **Connect flow:** a "Connect Gmail" button starts the OAuth flow; on callback,
  the Next.js route exchanges the code for tokens and writes them to
  `gmail_tokens` via the server-side Supabase client. Store the refresh token
  using Supabase Vault (or, if Vault setup proves too heavy for this phase, at
  minimum ensure the table's RLS makes it unreachable from any client bundle —
  note the tradeoff explicitly in the plan rather than silently downgrading
  security).
- **Sync flow:** a "Sync Gmail" button triggers a Server Action that:
  1. Refreshes the access token if expired.
  2. Builds a Gmail API search query from all schools' `contact_email` values
     (e.g. `from:(a@x.edu OR b@y.edu) after:<last_synced_at>`).
  3. For each matching message, extracts sender, subject, snippet, and date.
  4. Matches the sender to a school by exact `contact_email` match, falling back
     to domain match if no exact match (flag domain-only matches distinctly in
     the UI, since they're lower-confidence).
  5. Inserts a `activity_log` row of type `email_reply` per new message,
     respecting the `(owner_id, email_message_id)` uniqueness constraint for
     de-dup.
  6. Updates `gmail_tokens.last_synced_at`.
  7. If a school's status is `contacted` and a reply is detected, prompt (not
     auto-apply) a status change to `replied` — surfaced as a UI suggestion the
     user confirms, not a silent automatic status change.

## 8. Future AI feature pattern (not built now)

When an AI feature is actually needed, add it as a Vercel Python serverless
function under `/api/<feature>.py`, using Vercel's Python runtime. This deploys
alongside the Next.js app on the same Vercel project — no second host, no
separate billing, same free tier. Document this pattern in the repo's README
once the app exists, including one worked example (a stub endpoint) so the
pattern is proven, not just described. If a future feature turns out to need a
persistent process (long-running jobs, WebSockets) rather than a request/response
serverless function, Render's free web-service tier is the fallback — noted, not
built.

## 9. Dashboard and views (Phase 1)

**Dashboard** (built in two passes — see the implementation plan's Task 10 vs.
its later dashboard-upgrade task — because the open-tasks/overdue/wins numbers
below don't exist until the task engine and wins feed are built):
- Stat strip, each tile a link to its own page: total schools (→ Schools),
  open tasks (→ Tasks), overdue count (→ Today), wins this month (→ Wins).
- Status-funnel chart: counts per `school_status` value, in pipeline order.
- Score-vs-rank scatter: `composite_score` (y) against `csranking_nlp_rank` (x),
  one point per school, colored by `verified_fit`.
- An upcoming-deadlines strip pulling from `tasks.due_date` across schools,
  research milestones, and general tasks — not just school deadlines — each
  item clickable through to its detail page, with a "full timeline" link to
  the Journey timeline page.

**Tasks board:** a kanban-style view (To do / In progress / Blocked / Done),
filterable by area (school-linked / research-linked / general), assignee, and
priority, with an "overdue" filter. Status changes via a control on the card,
not drag-and-drop (see Non-goals).

**People page:** list of people with add/edit/permanent-delete, each showing
their current task load (count of non-done tasks assigned to them).

**School and research-milestone detail pages** each show their linked tasks
inline, not just the existing notes/activity feed — a task created from a
school's page pre-fills `school_id`; same pattern for research milestones. A
school's detail page additionally shows its recommendation-letter requests, its
SOP version + sent date, its interview rounds, and (once accepted) its visa
checklist.

**Today view**: a single page, everything due within 7 days across schools,
tasks, and research milestones, one list — the working page, distinct from the
dashboard's summary strip.

**Journey timeline, wins feed, and command palette**: see section 4c.

**Focus mode**: see section 4c — reachable from any task's detail view.

## 10. Risks and open items

- **CSRankings/Carnegie name matching will not be perfect.** The fuzzy-match
  review step exists specifically to catch this; the plan must not skip it.
- **Composite score is a heuristic**, not a validated ranking — must be labeled
  as such in the UI (a tooltip or caption), not presented as objective truth.
- **Gmail OAuth in Testing mode** may show Google's "unverified app" warning
  screen — expected and fine for a single-user personal tool, but the plan should
  document this so it isn't mistaken for a bug.
- **Domain-only email matches** are lower confidence than exact contact-email
  matches (a department's general inbox address, a different person at the same
  university) — must be visually distinguished in the activity log, not merged
  indistinguishably with confirmed matches.
- **Person deletion is permanent and irreversible** by design (section 4a) — the
  UI must make this unambiguous at the point of deletion (a real confirmation,
  not a toast that's easy to dismiss without reading), since there's no undo.
- **The school-XOR-research-milestone check constraint on `tasks`** must be
  enforced at the database level, not just in the UI form — a bug in a future
  feature (e.g. a bulk-import script) shouldn't be able to produce a task linked
  to both.
- **Task dependencies are advisory, not enforced.** A dependent task can still
  be marked done while its dependency is open — this is a deliberate choice
  (section 4d), not an oversight; don't "fix" it into a hard lock without
  re-checking with the user first, since the plan's own troubleshooting
  guidance elsewhere is explicit about needing flexibility over rigidity.
- **`is_win` is set at write time, not computed at read time.** Every code path
  that writes an `activity_log` or `task_updates` row must set it correctly
  (section 4c) — a new write path added later (e.g. a bulk-import script) that
  forgets this silently breaks the wins feed rather than erroring.
- **The two automation rules in section 4d are hardcoded, not user-configurable.**
  Don't let scope creep turn this into a rules-builder UI — that's explicitly
  out of scope (section 2).
