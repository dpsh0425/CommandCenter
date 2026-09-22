You're working in `C:\dev\grad-command-center`, an empty-ish repo containing only planning docs so far. Build the app described below.

Read these two files first, in full:
1. `docs/superpowers/specs/2026-09-22-grad-command-center-design.md` — the design spec (why every decision was made, what's explicitly out of scope)
2. `docs/superpowers/plans/2026-09-22-grad-command-center-implementation.md` — the implementation plan (13 tasks, exact files/code/commands)

Then execute the plan task-by-task — it's 26 tasks now, not a small build: the ranked school directory, a full ERP-style task engine (people, tasks, dependencies, reassignment, results), Gmail read-only tracking, an application-logistics layer (recommendation letters, SOP versions, interviews, visa checklist), a productivity layer (command palette, journey timeline, wins feed, focus mode), and a persistent navigation shell tying it all together. Use the `superpowers:subagent-driven-development` skill if available in this session (a fresh subagent per task, reviewed between tasks); otherwise use `superpowers:executing-plans`. If neither skill is available, just work through the plan's tasks in order — each one is self-contained with exact file paths, complete code, and verification steps, so it doesn't require the skill to execute correctly.

Tasks 14-26 depend on Tasks 1-13 already being done (they build on the base schema and the schools/auth pages) — don't skip ahead. Three tasks have ordering notes worth reading before you get there: Task 24 (nav shell) imports the command palette from Task 20, so do it after; Task 26 (dashboard upgrade) needs Task 19's `is_win` data to exist first; Task 25 just modifies Task 17's files, do it after that one. The plan's own "Self-review notes" section at the end spells this out too.

A few things to know going in:

- **Tasks 2, 6, and 11 need you (the human) to do something outside the code** — create a Supabase project, get your Supabase user id, and set up a Google Cloud OAuth app. Each of those tasks documents the exact manual steps. Stop and wait for confirmation that the external setup is done before writing code that depends on it (e.g., don't try to run `load_schools.py` before the Supabase project exists and env vars are filled in).
- **Task 5's Python ETL script needs manually downloaded Carnegie Classification data** (no stable public API for it) — the script's own docstring explains where to get it. Don't skip this by inventing placeholder data.
- **Task 5's fuzzy-match step will produce imperfect matches.** The plan requires writing low-confidence matches to a review file and flagging them rather than silently accepting anything below the threshold — don't "helpfully" auto-accept everything to make the pipeline look cleaner.
- **The composite score is a heuristic, explicitly labeled as such in the UI** (Task 10). Don't present it as an objective ranking anywhere in copy or comments.
- **Gmail integration is read-only, manual-trigger only.** Don't add send/compose capability or automatic scheduled sync — both are explicit non-goals in the spec (section 2).
- Follow the plan's commit-per-task structure — each task ends with its own commit, not one giant commit at the end.
- **Task dependencies (Task 17) are advisory, not enforced** — a task can still be marked done with an open dependency. Don't "fix" this into a hard lock; it's a deliberate design choice, documented in the spec's risks section.
- **The two automation rules (Tasks 17 and 23) are hardcoded**, not a configurable rules engine — don't build a rules UI, that's explicitly out of scope.
- **`is_win` (Task 19) must be set at every write path that inserts an `activity_log` or `task_updates` row** — go back and check Tasks 7, 8, 12, and 17's insert calls when you get to Task 19, not just the new code in that task.

If you hit a point where the plan is ambiguous or something doesn't work as written (e.g., a library version conflict, a Next.js API that's changed), use your own judgment to resolve it in the spirit of the design spec, and note what you changed and why — don't silently deviate.
