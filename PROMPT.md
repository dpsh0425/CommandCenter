You're working in `C:\dev\grad-command-center`, an empty-ish repo containing only planning docs so far. Build the app described below.

Read these two files first, in full:
1. `docs/superpowers/specs/2026-09-22-grad-command-center-design.md` — the design spec (why every decision was made, what's explicitly out of scope)
2. `docs/superpowers/plans/2026-09-22-grad-command-center-implementation.md` — the implementation plan (13 tasks, exact files/code/commands)

Then execute the plan task-by-task. Use the `superpowers:subagent-driven-development` skill if available in this session (a fresh subagent per task, reviewed between tasks); otherwise use `superpowers:executing-plans`. If neither skill is available, just work through the plan's tasks in order — each one is self-contained with exact file paths, complete code, and verification steps, so it doesn't require the skill to execute correctly.

A few things to know going in:

- **Tasks 2, 6, and 11 need you (the human) to do something outside the code** — create a Supabase project, get your Supabase user id, and set up a Google Cloud OAuth app. Each of those tasks documents the exact manual steps. Stop and wait for confirmation that the external setup is done before writing code that depends on it (e.g., don't try to run `load_schools.py` before the Supabase project exists and env vars are filled in).
- **Task 5's Python ETL script needs manually downloaded Carnegie Classification data** (no stable public API for it) — the script's own docstring explains where to get it. Don't skip this by inventing placeholder data.
- **Task 5's fuzzy-match step will produce imperfect matches.** The plan requires writing low-confidence matches to a review file and flagging them rather than silently accepting anything below the threshold — don't "helpfully" auto-accept everything to make the pipeline look cleaner.
- **The composite score is a heuristic, explicitly labeled as such in the UI** (Task 10). Don't present it as an objective ranking anywhere in copy or comments.
- **Gmail integration is read-only, manual-trigger only.** Don't add send/compose capability or automatic scheduled sync — both are explicit non-goals in the spec (section 2).
- Follow the plan's commit-per-task structure — each task ends with its own commit, not one giant commit at the end.

If you hit a point where the plan is ambiguous or something doesn't work as written (e.g., a library version conflict, a Next.js API that's changed), use your own judgment to resolve it in the spirit of the design spec, and note what you changed and why — don't silently deviate.
