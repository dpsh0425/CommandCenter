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

**Dashboard:**
- Stat strip: total schools, outreach-started count, submitted+ count, accepted
  count.
- Status-funnel chart: counts per `school_status` value, in pipeline order.
- Score-vs-rank scatter: `composite_score` (y) against `csranking_nlp_rank` (x),
  one point per school, colored by `verified_fit`.
- Overdue-task count and an upcoming-deadlines strip pulling from `tasks.due_date`
  across both schools and research milestones, not just the school deadline
  dates — this is the one dashboard element that spans the whole task engine,
  not just the grad pipeline.

**Tasks board:** a kanban-style view (To do / In progress / Blocked / Done),
filterable by area (school-linked / research-linked / general), assignee, and
priority, with an "overdue" filter. Status changes via a control on the card,
not drag-and-drop (see Non-goals).

**People page:** list of people with add/edit/permanent-delete, each showing
their current task load (count of non-done tasks assigned to them).

**School and research-milestone detail pages** each show their linked tasks
inline, not just the existing notes/activity feed — a task created from a
school's page pre-fills `school_id`; same pattern for research milestones.

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
