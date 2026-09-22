# Grad Command Center — Design Spec

**Status:** Approved for planning
**Author:** Dipesh Bhatta (via design session with Claude)
**Date:** 2026-09-22

## 1. Purpose

Replace the Claude Artifact-based "Deadline Compass" tracker with a real, standalone
personal system for managing PhD applications: a ranked, filterable directory of
US R1+R2 (and Canada/Australia) computer science programs, per-school outreach
tracking, an activity timeline that folds in Gmail replies automatically, and a
dashboard. Built to grow later into a broader personal command center (research
project tracking, KACOF/work tracking) without a redesign.

The Claude Artifact tracker (`db` capability) was outgrown because artifacts run in
a sandboxed browser context that cannot make network calls to an external database
like Supabase — this app steps outside that sandbox entirely.

## 2. Non-goals (explicitly out of scope for this build)

- Sending or composing email from the app. Read-only Gmail tracking only — the user
  writes and sends every email themselves from Gmail.
- Research-project tracking (the Nepali benchmark study) and work/KACOF tracking
  modules. Same database, future phase, not built now.
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

## 9. Dashboard (Phase 1)

- Stat strip: total schools, outreach-started count, submitted+ count, accepted
  count (same as the Artifact tracker's version).
- Status-funnel chart: counts per `school_status` value, in pipeline order.
- Score-vs-rank scatter: `composite_score` (y) against `csranking_nlp_rank` (x),
  one point per school, colored by `verified_fit`.
- Region/country filter tabs, same UX pattern as the Artifact tracker.

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
