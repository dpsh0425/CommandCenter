# Workspaces, project templates, the KACOF team layer and GitHub: design

Date: 2026-09-24
Status: draft for review

## 1. Goal

Grad Command Center is single-owner today. This design lets other students and the KACOF team use it, keeps
each person's application data private, shares project work through workspaces with roles, adapts projects to
other domains, adds team tooling (instructions, onboarding, check-ins, reviews), and connects GitHub.

## 2. Decisions already made

| Topic | Decision |
| --- | --- |
| Accounts | Separate accounts. Each user has a private personal space. Projects are shared through workspaces. |
| Sharing model | Approach B: personal data stays owner-scoped; shared work is scoped by project membership. |
| KACOF | A mix of research group, organization and community. Needs both research and operations tooling. |
| GitHub | Personal account with some private repos. Token-based connection first, GitHub App later. |
| Hosting | Vercel plus the existing Supabase. |
| Sign-up | Invite-only. |

Rejected alternatives: every table scoped to a workspace (rewrites access rules on about 40 tables,
including personal ones, for no benefit); a separate database per team (too heavy to operate).

## 3. Scope and decomposition

Independent sub-projects, each with its own implementation plan and its own acceptance check:

1. Foundations (deploy, staging, backups, CI, key rotation).
2. Monday email live, and GitHub stage 1.
3. Workspaces and roles.
4. Project templates.
5. Team layer (handbook, onboarding, check-ins, reviews, dashboard, notifications).
6. GitHub stages 2 and 3.

## 4. Who can see what

### 4.1 Spaces
- **Personal space:** one per user, private. Schools, applications, professors, resume, personal tasks and notes.
  Unchanged from today apart from being keyed to each user rather than the one owner.
- **Workspace:** a shared container (for example "KACOF"). A user can belong to several. It holds projects,
  the handbook and the member list.

### 4.2 Roles
- Workspace roles: `owner`, `lead`, `member`.
- Project roles: `lead`, `contributor`, `viewer`. A member sees only projects they are added to.
  A workspace owner or lead acts as project lead on every project in that workspace.

| Action | Viewer | Contributor | Project lead | Workspace lead/owner |
| --- | --- | --- | --- | --- |
| Read project | yes | yes | yes | yes, all projects |
| Log work, edit tasks, upload | no | yes | yes | yes |
| Manage members, delete project | no | no | yes | yes |
| Create projects, manage handbook | no | no | no | yes |
| Invite to workspace, remove members | no | no | no | owner and lead |

### 4.3 Enforcement
The database enforces access through row-level security. The application also checks, but is not trusted to be
the only line of defence.

## 5. Data model

All additions are additive. Nothing existing is renamed except the "who did it" references in research tables
(section 5.3).

### 5.1 New tables
- `workspaces(id, name, created_by, created_at)`
- `workspace_members(workspace_id, user_id, role, invited_by, joined_at)`, primary key `(workspace_id, user_id)`
- `profiles(user_id, display_name, color, github_login)`
- `project_members(project_id, user_id, role)`, primary key `(project_id, user_id)`. Replaces
  `research_project_members`, which points at the personal contacts list.
- `invitations(id, workspace_id, project_id null, email, role, token_hash, invited_by, expires_at, accepted_at)`
- `research_projects` gains `workspace_id`, `template` (text key) and `settings` (jsonb).

### 5.2 Access functions
Four `security definer` functions with a fixed `search_path`, marked `stable`, backed by indexes on
`workspace_members(user_id, workspace_id)` and `project_members(user_id, project_id)`:

- `is_workspace_member(ws, min_role)`
- `project_role(project)`: the project role, or lead for workspace owner/lead
- `can_read_project(project)`
- `can_write_project(project)`: contributor or higher

Every project table (milestones, tasks with a project, journal entries, experiments, sections, papers,
meetings, links and documents with a project) gets a read rule via `can_read_project` and a write rule via
`can_write_project`. Tables that can be personal or project-owned (tasks, links, documents) use a two-part
rule: no project means "own rows only"; a project means the project rules.

### 5.3 People versus users
Today "who did it" and "assigned to" reference the personal contacts list (`people`). In shared projects they
must reference accounts. Research tables currently hold no such references, so `person_id` becomes a user
reference (`member_id`) with a clean migration. `tasks` serves both worlds, so it gains `assignee_user_id`
and keeps the contact assignee for personal tasks.

### 5.4 Storage
New project files go under `projects/<project_id>/...` with a storage policy calling `can_read_project` /
`can_write_project`. Existing personal files under `<user_id>/...` keep their current policy.

## 6. Migration (safe, reversible)

1. Add tables and functions. No behaviour change.
2. Create the owner's workspace, make them owner and lead of the existing project, attach the project.
3. Add the new policies alongside the old owner-only ones. Verify. Drop the old ones. Rollback is re-adding them.
4. Replace `OWNER_USER_ID` checks in the app with a project-access helper (`requireProjectAccess(projectId, minRole)`),
   and personal pages with an "is your own data" check.
5. Run the SQL access-test matrix (section 11).

Prerequisite: run the whole migration first on a staging Supabase project loaded with a copy of production data,
after taking a backup.

Known risks:
- Background jobs (the Monday email, GitHub sync) use the service key, which bypasses row-level security. They must
  filter to one user's projects explicitly.
- Owner-only pages (Today, quick add, search, nav) must show a new user their own data. An empty personal space
  needs an onboarding step, including copying the school list.
- Removing a member keeps their history and revokes access.

## 7. Project templates

A template is a typed configuration in code (`lib/project-templates.ts`), not database tables. A project stores
the template key and optional overrides. A template defines: which tabs appear, tab names (vocabulary),
journal activity types, writing outlines and starter milestones.

| Template | Experiments tab becomes | Reading becomes | Writing becomes | Journal adds |
| --- | --- | --- | --- | --- |
| Research (current) | Experiments | Reading | Paper sections | coding, analysis |
| Lab science | Experiments (protocol, samples) | Reading | Paper sections | bench work, data collection |
| Social science | Studies | Sources | Report sections | fieldwork, coding data |
| Humanities or thesis | hidden | Sources | Chapters | archive work, drafting |
| Engineering or build | Builds and tests | References | Docs and reports | prototyping, deployment |
| Course or capstone | hidden | References | Deliverables | lectures, group work |
| Team operations | hidden | hidden | hidden | planning, delivery, support |

- The fixed activity-type check on journal entries is removed from the database; the app validates against the
  template. Existing rows are unaffected.
- An unknown or missing template falls back to Research.
- Workspace leads can hide or show tabs per project. Custom templates are out of scope.

## 8. Team layer (workspace level)

First version:

1. **Handbook.** Markdown pages, workspace-wide or per project, with a sidebar order and a version on every save.
   A page can be required reading for a role. Members confirm per version. A "material change" edit requests
   confirmation again. Leads see who has and has not read each page.
2. **Onboarding.** Lead-built checklist templates (read pages, set GitHub username, first task) copied to each new
   member, with progress visible to leads.
3. **Weekly check-ins.** What I did, what is next, blockers. Prefilled from journal and task activity. Readable
   only by the author and leads. Missing check-ins and blockers roll up to the dashboard.
4. **Reviews.** Any task, document or writing section can be sent for review with a named reviewer:
   requested, changes requested, approved, with comments.
5. **Team dashboard.** Members against projects, activity this week, overdue tasks, check-in blockers, pending
   reviews, unread required pages, GitHub activity later.
6. **Notifications.** Email for invites, review requests, assignments, required reading and the weekly digest,
   per-user preferences. In-app notification centre later.

Deferred: recurring tasks and task templates, comments and @mentions, custom templates, in-app notification centre.

### Navigation
A workspace switcher at the top. Personal sidebar unchanged. Each workspace adds Projects, Handbook, Team,
Check-ins and Reviews. Users can switch personal modules off (for example Schools, Outreach, Materials).

## 9. GitHub

### 9.1 Connection
- Each user connects a **fine-grained personal access token** limited to chosen repos, read-only
  (metadata, contents, pull requests, issues).
- A GitHub App installed on an organization can replace the token later behind the same internal client interface.
- Tokens are encrypted on the server (AES-256-GCM, key in an environment variable). The connections table has no
  client-readable policy. Tokens never reach the browser or the logs.

### 9.2 Linking
`project_repos(project_id, connection_id, github_repo_id, owner, name, default_branch, added_by)`. The numeric
repo id survives renames. Any GitHub link in the Library can be upgraded with "Connect this repo". Connecting a
private repo warns that all project members will see its commit and pull request titles. Contributors and up can
connect; only a lead can remove.

### 9.3 Data
Metadata only, never code. `github_events` caches commits, pull requests, issues and releases (author username,
title, link, state, time), plus per-repo `last_synced_at` and `etag`. Refresh: on opening the Code tab (at most every
5 minutes), a daily job, and webhooks in stage 3. Conditional requests and `since` keep usage inside rate limits.
Authors map to members by `profiles.github_login`, with commit email as a fallback and a one-click mapping for
unlinked contributors.

### 9.4 Where it appears
1. Project Overview: a repo card (last commit, open pull requests and issues).
2. A Code tab: commits, pull requests, issues and releases, filterable by person.
3. Weekly summary, who-did-what and the Monday email: for example "Code: 14 commits, 2 PRs merged".
4. Experiments: "Record current commit" fills the code reference, which becomes a link.
5. Tasks: paste an issue or pull request link to show its live state (stage 2).

### 9.5 Stage 3 (two-way, needs the deployed URL)
A webhook endpoint verifies GitHub's HMAC signature and ignores duplicate deliveries. A merged pull request linked
to a task can close it (per-project switch). A "create issue from task" action asks for confirmation.

### 9.6 Failure handling
Expired or revoked token: "needs reconnect" banner. Rate limited: cached data with an "updated N minutes ago"
label. Repo deleted: marked unavailable, history kept. The person who connected a repo leaves: their token is
deleted and the repo shows "needs reconnect" for another member to take over.

## 10. Email, hosting and operations

- **Email:** Resend from `kcc@kacof.tech` (domain already verified). Notifications go through a `notifications`
  table with status, retries and an idempotency key. Non-essential mail carries an unsubscribe link. The Monday
  digest becomes per person and covers only that person's projects. The Resend key lives only in Vercel's
  environment settings. The key previously pasted in chat should be rotated.
- **Hosting:** Vercel plus the existing Supabase. Vercel's free tier allows scheduled jobs only once a day and is
  for personal, non-commercial use, so organizational use by KACOF may require the paid tier. On the free tier the
  weekly digest and a daily GitHub refresh still work.
- **Staging:** a second Supabase project for migrations and testing, plus a backup before any production migration.
- **Safety:** confirm public sign-up is disabled in Supabase; rate-limit invites; an audit log of invites, role
  changes, removals and repo connections; error monitoring; CI running the type-check and the access tests;
  a "download my data" export and a leave-workspace flow.

## 11. Testing

- **Access matrix (SQL, run against staging and in CI):** a non-member sees nothing; a viewer cannot write; a
  contributor can write; only a lead manages members; workspaces cannot see each other; personal tables are
  unaffected; handbook readable by members and writable only by leads; confirmations visible only to the person and
  leads; check-ins visible only to the author and leads; reviews visible to project members.
- **Templates:** each template's tabs and journal types are consistent.
- **GitHub:** client tested against recorded responses (no live calls); webhook signature checking; duplicate
  delivery handling; author matching; re-running a sync does not duplicate rows.
- **Each phase:** applied on staging, deployed, and checked with real data before moving on.

## 12. Rollout

| Phase | Contents | Size | Risk |
| --- | --- | --- | --- |
| 0 | Deploy to Vercel, staging Supabase, backups, CI, rotate keys | S to M | Low |
| 1 | Monday email live; GitHub stage 1 (token, read-only, Code tab, weekly summary) | M | Low |
| 2 | Workspaces and roles, personal space per user, onboarding, module switches | L | Highest |
| 3 | Project templates | M | Low |
| 4 | Team layer: 4a handbook and onboarding, 4b check-ins and reviews, 4c dashboard and notification preferences | L | Medium |
| 5 | GitHub stages 2 and 3, optional GitHub App | M to L | Medium |

## 13. Open items to confirm

These have recommended defaults, which the plan will use unless changed:

1. Create a separate staging Supabase project. Default: yes.
2. Accept Vercel's paid tier if KACOF use requires it. Default: yes, decided at phase 0.
3. Data export and leave-workspace at the launch of phase 2; full account deletion after launch.
4. Scheduled-job time zone. Default: the owner's time zone via `APP_TIMEZONE`.

## 14. Out of scope

Recurring tasks and task templates, comments and @mentions, custom templates, an in-app notification centre,
open sign-up, billing, and per-workspace GitHub Apps beyond the interface described.
