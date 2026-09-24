# Phase 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a safety net before the risky work starts: automated tests, a database access-test harness, data backups, a repeatable migration runner, an environment and health check, CI, a Vercel deployment config, and an invite-only sign-up check.

**Architecture:** Pure functions in `lib/` get Vitest unit tests. Database behaviour is tested by SQL files that return `{name, ok}` rows, run by a small Node script through the Supabase Management API. Operational scripts (`backup`, `apply-migrations`, `check-auth-config`) are dependency-free Node ES modules in `scripts/`. CI runs type-check, unit tests and a build.

**Tech Stack:** Next.js 14, TypeScript, Vitest, Node 22+ ES modules, Supabase Management API, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-24-workspaces-teams-github-design.md` (section 12, phase 0). This plan covers phase 0 only. Each later phase gets its own plan once this one is finished.

## Global Constraints

- Never write an API key, token or secret into a tracked file. Secrets live in `.env.local` (git-ignored) locally and in Vercel's environment settings in production.
- Supabase project ref for production: `yzbpaoknnzdtrvowbvum`. The Management API token is read from `.supabase-token` (git-ignored) or `SUPABASE_ACCESS_TOKEN`.
- Test data uses the `ZZTEMP` prefix and is deleted afterwards. Real rows are snapshotted before being touched and restored.
- Commit after each completed task. Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- The TypeScript target does not allow spreading a `Set`; use `Array.from`.
- Scripts must not change production data or settings on their own. Anything that changes a live setting requires an explicit flag and is run by the user.

## File Structure

| File | Responsibility |
| --- | --- |
| `vitest.config.ts` | Test runner config, `@` path alias |
| `tests/lib/*.test.ts` | Unit tests for pure `lib/` functions |
| `lib/env.ts` | Environment variable checks (pure, testable) |
| `app/api/health/route.ts` | Unauthenticated liveness and database check |
| `supabase/tests/*.sql` | Database checks returning `{name, ok}` rows |
| `scripts/db-test.mjs` | Runs `supabase/tests/*.sql` against a project |
| `scripts/backup.mjs` | Dumps every public table and the storage listing to JSON |
| `scripts/apply-migrations.mjs` | Applies `supabase/migrations/*.sql` in order, recording each |
| `scripts/check-auth-config.mjs` | Verifies (and optionally sets) invite-only sign-up |
| `.github/workflows/ci.yml` | Type-check, tests, build on every push |
| `vercel.json` | Weekly digest cron |
| `docs/deployment.md` | Runbook for Vercel, staging, key rotation |

---

### Task 1: Vitest and unit tests for existing pure logic

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/lib/readiness.test.ts`
- Create: `tests/lib/library.test.ts`
- Create: `tests/lib/research.test.ts`
- Create: `tests/lib/links.test.ts`
- Modify: `package.json` (scripts, devDependency)

**Interfaces:**
- Consumes: `assess`, `buildItems`, `daysBetween`, `ReadinessSchool` from `lib/readiness.ts`; `previewKind`, `guessKind`, `parseTags` from `lib/library.ts`; `countWords`, `formatMinutes`, `relative`, `daysBetween`, `kindLabel` from `lib/research.ts`; `summarizeProjectWeek`, `ProjectWeek` from `lib/research-week.ts`; `normalizeUrl`, `parseGithubRepo`, `parseArxivId`, `hostOf` from `lib/links.ts`.
- Produces: npm scripts `test` and `typecheck`, used by every later task and by CI.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Expected: `added ... packages`, `package.json` lists `vitest` under `devDependencies`.

- [ ] **Step 2: Add the config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 3: Add npm scripts**

In `package.json`, extend `"scripts"` to:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "db:test": "node scripts/db-test.mjs",
  "db:backup": "node scripts/backup.mjs",
  "db:migrate": "node scripts/apply-migrations.mjs",
  "check:auth": "node scripts/check-auth-config.mjs"
}
```

- [ ] **Step 4: Write the readiness tests**

Create `tests/lib/readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assess, buildItems, daysBetween, type ReadinessSchool } from "@/lib/readiness";

const TODAY = "2026-10-01";
const school = (over: Partial<ReadinessSchool> = {}): ReadinessSchool => ({
  id: "s1", name: "Test U", deadline_date: "2026-10-10", status: "researching",
  gre_policy: null, english_test: null, letters_required: null, sop_version_id: null, ...over,
});

describe("daysBetween", () => {
  it("counts whole days", () => expect(daysBetween("2026-10-01", "2026-10-10")).toBe(9));
  it("is negative for past dates", () => expect(daysBetween("2026-10-10", "2026-10-01")).toBe(-9));
});

describe("buildItems", () => {
  it("lists only the items that apply to the school", () => {
    const keys = buildItems(school(), [], {}).map((i) => i.key);
    expect(keys).toEqual(["portal", "resume", "transcripts", "sop", "fee", "submitted"]);
  });

  it("adds letters, GRE and English test when the school requires them", () => {
    const keys = buildItems(school({ gre_policy: "required", english_test: "TOEFL", letters_required: 3 }), [], {}).map((i) => i.key);
    expect(keys).toEqual(["portal", "resume", "transcripts", "sop", "letters", "gre", "english", "fee", "submitted"]);
  });

  it("counts confirmed and submitted letters only", () => {
    const items = buildItems(
      school({ letters_required: 3 }),
      [{ status: "confirmed" }, { status: "submitted" }, { status: "asked" }],
      {}
    );
    const letters = items.find((i) => i.key === "letters")!;
    expect(letters.label).toBe("Recommendation letters (2 of 3 confirmed)");
    expect(letters.done).toBe(false);
  });

  it("marks letters done when all required letters are confirmed", () => {
    const items = buildItems(school({ letters_required: 2 }), [{ status: "confirmed" }, { status: "confirmed" }], {});
    expect(items.find((i) => i.key === "letters")!.done).toBe(true);
  });

  it("derives statement and submitted from school state, and manual items from checks", () => {
    const items = buildItems(school({ sop_version_id: "v1", status: "submitted" }), [], { portal: true });
    const done = (k: string) => items.find((i) => i.key === k)!.done;
    expect(done("sop")).toBe(true);
    expect(done("submitted")).toBe(true);
    expect(done("portal")).toBe(true);
    expect(done("resume")).toBe(false);
  });
});

describe("assess", () => {
  const run = (over: Partial<ReadinessSchool>, checks: Record<string, boolean> = {}) => {
    const s = school(over);
    return assess(s, buildItems(s, [], checks), TODAY);
  };

  it("is urgent within 14 days with anything pending", () => expect(run({ deadline_date: "2026-10-10" }).risk).toBe("urgent"));
  it("says watch within 35 days with three or more items pending", () => expect(run({ deadline_date: "2026-10-30" }).risk).toBe("watch"));
  it("is ok when the deadline is far away", () => expect(run({ deadline_date: "2026-12-01" }).risk).toBe("ok"));
  it("is overdue after the deadline", () => expect(run({ deadline_date: "2026-09-20" }).risk).toBe("overdue"));
  it("has no date risk without a deadline", () => expect(run({ deadline_date: null }).risk).toBe("nodate"));
  it("is submitted regardless of pending items", () => expect(run({ status: "submitted" }).risk).toBe("submitted"));

  it("counts done items out of the total, excluding the submitted step", () => {
    const r = run({}, { portal: true, resume: true });
    expect(r.total).toBe(5);
    expect(r.doneCount).toBe(2);
    expect(r.pending.map((p) => p.key)).toEqual(["transcripts", "sop", "fee"]);
  });
});
```

- [ ] **Step 5: Write the library tests**

Create `tests/lib/library.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { guessKind, parseTags, previewKind } from "@/lib/library";

describe("previewKind", () => {
  const cases: Array<[string, string | null, string]> = [
    ["a.pdf", null, "pdf"], ["x.PNG", null, "image"], ["clip.mp4", null, "video"], ["song.mp3", null, "audio"],
    ["README.md", null, "markdown"], ["data.csv", null, "csv"], ["cfg.json", null, "json"], ["nb.ipynb", null, "notebook"],
    ["script.py", null, "text"], ["notes", "text/plain", "text"], ["archive.zip", "application/zip", "none"], ["deck.pptx", null, "none"],
  ];
  it.each(cases)("%s (%s) previews as %s", (name, mime, expected) => expect(previewKind(name, mime)).toBe(expected));
});

describe("guessKind", () => {
  const cases: Array<[string, string]> = [
    ["paper.pdf", "paper"], ["data.csv", "data"], ["run.ipynb", "code"], ["fig.png", "figure"],
    ["talk.pptx", "slides"], ["notes.md", "notes"], ["weird.xyz", "other"],
  ];
  it.each(cases)("%s is guessed as %s", (name, expected) => expect(guessKind(name)).toBe(expected));
});

describe("parseTags", () => {
  it("lowercases, trims, drops empties and duplicates, keeping first-seen order", () => {
    expect(parseTags(" Foo, bar\nfoo ,, Baz ")).toEqual(["foo", "bar", "baz"]);
  });
  it("returns an empty list for blank input", () => expect(parseTags("  ,  ")).toEqual([]));
});
```

- [ ] **Step 6: Write the research tests**

Create `tests/lib/research.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countWords, daysBetween, formatMinutes, kindLabel, relative } from "@/lib/research";
import { summarizeProjectWeek, type ProjectWeek } from "@/lib/research-week";

describe("countWords", () => {
  it("is zero for blank text", () => { expect(countWords("")).toBe(0); expect(countWords("   ")).toBe(0); });
  it("splits on any whitespace", () => expect(countWords("one two  three\nfour")).toBe(4));
});

describe("formatMinutes", () => {
  it.each([[45, "45m"], [60, "1h"], [90, "1h 30m"], [125, "2h 5m"]])("%i -> %s", (m, s) => expect(formatMinutes(m)).toBe(s));
});

describe("relative and daysBetween", () => {
  it.each([[0, "today"], [1, "tomorrow"], [-1, "yesterday"], [-3, "3d overdue"], [5, "in 5d"]])("%i -> %s", (d, s) => expect(relative(d)).toBe(s));
  it("counts days", () => expect(daysBetween("2026-09-24", "2026-10-01")).toBe(7));
});

describe("kindLabel", () => {
  it("labels known kinds and falls back to the key", () => {
    expect(kindLabel("coding")).toBe("Coding");
    expect(kindLabel("mystery")).toBe("mystery");
  });
});

const week = (over: Partial<ProjectWeek> = {}): ProjectWeek => ({
  id: "p1", title: "Project", status: "active", minutes: 0, prevMinutes: 0, entryCount: 0, byKind: [], byPerson: [],
  finished: [], started: [], running: 0, meetings: [], tasksDone: 0, papersAdded: 0, filesAdded: 0, linksAdded: 0,
  sectionsEdited: 0, words: 0, targetWords: 0, upcoming: [], ...over,
});

describe("summarizeProjectWeek", () => {
  it("describes time with the change against the week before", () => {
    const lines = summarizeProjectWeek(
      week({ minutes: 510, prevMinutes: 120, entryCount: 3, byKind: [{ kind: "experiment", minutes: 240 }, { kind: "coding", minutes: 180 }, { kind: "reading", minutes: 90 }] }),
      true
    );
    expect(lines[0]).toEqual({ k: "Time", v: "8h 30m across 3 entries (+6h 30m vs the week before). Experiment 4h, Coding 3h, Reading 1h 30m" });
  });

  it("hides current-state lines for a past week", () => {
    const r = week({ running: 2, words: 500, targetWords: 1000, upcoming: [{ label: "X", date: "2026-10-05", days: 4, href: "/" }] });
    expect(summarizeProjectWeek(r, true)).toEqual([]);
  });

  it("shows current-state lines for the current week", () => {
    const r = week({ running: 2, words: 500, targetWords: 1000, upcoming: [{ label: "X", date: "2026-10-05", days: 4, href: "/" }] });
    const keys = summarizeProjectWeek(r, false).map((l) => l.k);
    expect(keys).toEqual(["Still running", "Writing", "Next"]);
  });
});
```

- [ ] **Step 7: Write the links tests**

Create `tests/lib/links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hostOf, normalizeUrl, parseArxivId, parseGithubRepo } from "@/lib/links";

describe("normalizeUrl", () => {
  it("adds https to a bare address", () => expect(normalizeUrl("github.com/x/y")).toBe("https://github.com/x/y"));
  it("rejects non-http schemes, dotless hosts and blanks", () => {
    expect(normalizeUrl("ftp://x.com")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("parseGithubRepo", () => {
  it("reads owner and repo", () => expect(parseGithubRepo("https://github.com/octocat/Hello-World")).toEqual({ owner: "octocat", repo: "Hello-World" }));
  it("strips .git", () => expect(parseGithubRepo("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" }));
  it("ignores profiles and reserved paths", () => {
    expect(parseGithubRepo("https://github.com/octocat")).toBeNull();
    expect(parseGithubRepo("https://github.com/orgs/x")).toBeNull();
  });
});

describe("parseArxivId", () => {
  it("drops the version from an abstract link", () => expect(parseArxivId("https://arxiv.org/abs/1706.03762v5")).toBe("1706.03762"));
  it("reads a PDF link", () => expect(parseArxivId("https://arxiv.org/pdf/1706.03762.pdf")).toBe("1706.03762"));
  it("ignores other sites", () => expect(parseArxivId("https://example.com/abs/1")).toBeNull());
});

describe("hostOf", () => {
  it("removes www", () => expect(hostOf("https://www.example.com/x")).toBe("example.com"));
});
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: all test files pass. If any assertion fails, fix the test only if the code's real behaviour is correct and the expectation was wrong; if the code is wrong, fix the code and say so in the commit message.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests
git commit -m "test: add Vitest and unit tests for readiness, library, research and link helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Environment check and health endpoint

**Files:**
- Create: `lib/env.ts`
- Create: `tests/lib/env.test.ts`
- Create: `app/api/health/route.ts`
- Modify: `middleware.ts` (exempt `/api/health`)

**Interfaces:**
- Produces: `missingEnv(names: string[], env?: Record<string, string | undefined>): string[]`, `REQUIRED_ENV: string[]`, `OPTIONAL_ENV: string[]`. `GET /api/health` returns `{ ok: boolean, db: boolean }` with status 200 when the database answers and 503 otherwise, without leaking variable names or errors.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { OPTIONAL_ENV, REQUIRED_ENV, missingEnv } from "@/lib/env";

describe("missingEnv", () => {
  it("lists names that are unset or empty", () => {
    expect(missingEnv(["A", "B", "C"], { A: "x", B: "", C: undefined })).toEqual(["B", "C"]);
  });
  it("returns nothing when all are set", () => expect(missingEnv(["A"], { A: "x" })).toEqual([]));
});

describe("env lists", () => {
  it("never lists a name twice", () => {
    const all = [...REQUIRED_ENV, ...OPTIONAL_ENV];
    expect(new Set(all).size).toBe(all.length);
  });
  it("requires the three Supabase variables", () => {
    expect(REQUIRED_ENV).toEqual(expect.arrayContaining(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: FAIL, cannot resolve `@/lib/env`.

- [ ] **Step 3: Implement `lib/env.ts`**

```ts
// Which environment variables the app needs, so a bad deployment fails loudly instead of half working.
export const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

// Features that switch off quietly without these.
export const OPTIONAL_ENV = ["RESEND_API_KEY", "DIGEST_FROM", "CRON_SECRET", "APP_URL", "APP_TIMEZONE"];

export function missingEnv(names: string[], env: Record<string, string | undefined> = process.env): string[] {
  return names.filter((n) => !env[n]);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the health route**

Create `app/api/health/route.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { REQUIRED_ENV, missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

// Liveness for the host and monitors. Reveals only two booleans, never names, keys or error text.
export async function GET() {
  if (missingEnv(REQUIRED_ENV).length > 0) return Response.json({ ok: false, db: false }, { status: 503 });
  try {
    const { error } = await createAdminClient().from("schools").select("id").limit(1);
    const db = !error;
    return Response.json({ ok: db, db }, { status: db ? 200 : 503 });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
```

- [ ] **Step 6: Exempt it from the login redirect**

In `middleware.ts`, change the exemption block to:

```ts
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth") ||
    // These routes check their own credentials (or need none).
    request.nextUrl.pathname === "/api/digest" ||
    request.nextUrl.pathname === "/api/health";
```

- [ ] **Step 7: Verify against the running dev server**

Run (with `npm run dev` already running): `node -e "fetch('http://localhost:3000/api/health').then(async r=>console.log(r.status, await r.text()))"`
Expected: `200 {"ok":true,"db":true}`

- [ ] **Step 8: Typecheck and commit**

Run: `npm run typecheck && npm test`
Expected: no type errors, all tests pass.

```bash
git add lib/env.ts tests/lib/env.test.ts app/api/health/route.ts middleware.ts
git commit -m "feat: environment check and health endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Database access-test harness with baseline tests

**Files:**
- Create: `scripts/db-test.mjs`
- Create: `supabase/tests/001_rls_enabled.sql`
- Create: `supabase/tests/002_tables_have_policies.sql`
- Create: `supabase/tests/003_storage_bucket_private.sql`

**Interfaces:**
- Produces: the convention that a file in `supabase/tests/` is one SQL statement returning rows shaped `{ name text, ok boolean }`. `npm run db:test` runs every file in filename order and exits 1 if any row is not `ok`, any file errors, or any file returns no rows. Phase 2 adds its access-matrix tests in this same folder.

- [ ] **Step 1: Write the runner**

Create `scripts/db-test.mjs`:

```js
// Runs supabase/tests/*.sql against one Supabase project through the Management API.
// Each file must return rows shaped { name, ok }.
// Usage: SUPABASE_PROJECT_REF=<ref> node scripts/db-test.mjs
import fs from "fs";
import path from "path";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) {
  console.error("Set SUPABASE_PROJECT_REF to the project to test.");
  process.exit(2);
}
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) {
  console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file.");
  process.exit(2);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

const dir = "supabase/tests";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let total = 0;
let failed = 0;

for (const f of files) {
  let rows;
  try {
    rows = await query(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    total++; failed++;
    console.log(`ERROR ${f}: ${e.message}`);
    continue;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    total++; failed++;
    console.log(`FAIL  ${f}: returned no rows (a test must return at least one { name, ok } row)`);
    continue;
  }
  for (const r of rows) {
    total++;
    if (r.ok === true) console.log(`PASS  ${f} ${r.name}`);
    else { failed++; console.log(`FAIL  ${f} ${r.name}`); }
  }
}

console.log(`\n${total - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Baseline test: row-level security on every table**

Create `supabase/tests/001_rls_enabled.sql`:

```sql
select 'rls_enabled_on_' || tablename as name, rowsecurity as ok
from pg_tables
where schemaname = 'public'
order by tablename;
```

- [ ] **Step 3: Baseline test: every table has at least one policy**

Create `supabase/tests/002_tables_have_policies.sql`:

```sql
-- A table with row-level security on and no policy is unreachable, which is almost always a mistake.
select 'has_policy_' || t.tablename as name,
       exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename) as ok
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;
```

- [ ] **Step 4: Baseline test: the storage bucket is private**

Create `supabase/tests/003_storage_bucket_private.sql`:

```sql
select 'materials_bucket_exists_and_is_private' as name,
       exists (select 1 from storage.buckets where id = 'materials' and public = false) as ok;
```

- [ ] **Step 5: Run the harness against production (read-only checks)**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`
Expected: one PASS line per table for files 001 and 002 (28 each), one PASS for 003, and the final line `57 passed, 0 failed`. If a count differs because tables were added since this plan was written, the requirement is `0 failed`.

- [ ] **Step 6: Prove the harness can fail**

Temporarily change `supabase/tests/003_storage_bucket_private.sql` to look for `id = 'nope'`, run `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`.
Expected: a `FAIL` line for that test, final line `... 1 failed`, exit code 1. Then revert the change and re-run to confirm `0 failed`.

- [ ] **Step 7: Commit**

```bash
git add scripts/db-test.mjs supabase/tests package.json
git commit -m "test: database test harness with baseline row-level security checks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Data backup script

**Files:**
- Create: `scripts/backup.mjs`
- Modify: `.gitignore` (add `/backups/`)

**Interfaces:**
- Produces: `npm run db:backup` writes `backups/<ref>/<UTC timestamp>/` containing one `<table>.json` per public table, `auth-users.json` (id, email, created_at only), `storage-objects.json`, and `manifest.json` (row counts). Later phases run this before every production migration.

- [ ] **Step 1: Ignore the output folder**

Append to `.gitignore`:

```
# database backups (contain personal data)
/backups/
```

- [ ] **Step 2: Write the script**

Create `scripts/backup.mjs`:

```js
// Dumps every public table, the auth user list (id and email only) and the storage listing to JSON files.
// Usage: SUPABASE_PROJECT_REF=<ref> node scripts/backup.mjs
import fs from "fs";
import path from "path";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) { console.error("Set SUPABASE_PROJECT_REF."); process.exit(2); }
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) { console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file."); process.exit(2); }

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join("backups", ref, stamp);
fs.mkdirSync(out, { recursive: true });

const manifest = { project: ref, createdAt: new Date().toISOString(), tables: {} };
const tables = (await query("select tablename from pg_tables where schemaname = 'public' order by tablename")).map((r) => r.tablename);

for (const t of tables) {
  const rows = await query(`select * from public."${t.replace(/"/g, '""')}"`);
  fs.writeFileSync(path.join(out, `${t}.json`), JSON.stringify(rows, null, 1));
  manifest.tables[t] = rows.length;
}

const users = await query("select id, email, created_at from auth.users order by created_at");
fs.writeFileSync(path.join(out, "auth-users.json"), JSON.stringify(users, null, 1));
manifest.authUsers = users.length;

const objects = await query("select bucket_id, name, metadata->>'size' as size, created_at from storage.objects order by bucket_id, name");
fs.writeFileSync(path.join(out, "storage-objects.json"), JSON.stringify(objects, null, 1));
manifest.storageObjects = objects.length;

fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
const rowTotal = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
console.log(`Backed up ${tables.length} tables (${rowTotal} rows), ${users.length} users, ${objects.length} stored files to ${out}`);
```

- [ ] **Step 3: Run it against production**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:backup`
Expected: a line like `Backed up 28 tables (NNNN rows), 1 users, 1 stored files to backups/yzbpaoknnzdtrvowbvum/<timestamp>`.

- [ ] **Step 4: Verify the output matches the database**

Run:

```bash
node -e "const fs=require('fs');const d='backups/yzbpaoknnzdtrvowbvum';const s=fs.readdirSync(d).sort().pop();const m=JSON.parse(fs.readFileSync(d+'/'+s+'/manifest.json'));const n=JSON.parse(fs.readFileSync(d+'/'+s+'/schools.json')).length;console.log('schools in manifest',m.tables.schools,'in file',n);process.exit(m.tables.schools===n?0:1)"
```

Expected: both numbers equal (147 at the time of writing) and exit code 0.

- [ ] **Step 5: Confirm nothing is tracked**

Run: `git status --short`
Expected: `backups/` does not appear (it is ignored).

- [ ] **Step 6: Commit**

```bash
git add scripts/backup.mjs .gitignore
git commit -m "feat: data backup script for every table, users and storage listing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Repeatable migration runner

**Files:**
- Create: `scripts/apply-migrations.mjs`

**Interfaces:**
- Produces: `node scripts/apply-migrations.mjs [--baseline]`. It keeps a `public._applied_migrations(name text primary key, applied_at timestamptz)` table. Without `--baseline` it applies every not-yet-recorded file in `supabase/migrations/` in name order, each file and its record inserted in one request so a failure leaves nothing half-applied. With `--baseline` it records all files as applied without running them (for production, where they already ran by hand).

- [ ] **Step 1: Write the script**

Create `scripts/apply-migrations.mjs`:

```js
// Applies supabase/migrations/*.sql to one project, once each, in order.
// Usage:
//   SUPABASE_PROJECT_REF=<staging-ref> node scripts/apply-migrations.mjs
//   SUPABASE_PROJECT_REF=<prod-ref>    node scripts/apply-migrations.mjs --baseline   (record only)
import fs from "fs";
import path from "path";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) { console.error("Set SUPABASE_PROJECT_REF."); process.exit(2); }
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) { console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file."); process.exit(2); }
const baseline = process.argv.includes("--baseline");

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

await query("create table if not exists public._applied_migrations (name text primary key, applied_at timestamptz not null default now())");
const done = new Set((await query("select name from public._applied_migrations")).map((r) => r.name));

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let applied = 0;

for (const f of files) {
  if (done.has(f)) continue;
  const record = `insert into public._applied_migrations (name) values ('${f.replace(/'/g, "''")}');`;
  if (baseline) {
    await query(record);
    console.log(`recorded  ${f}`);
  } else {
    // One request: the migration and its record succeed or fail together.
    await query(`${fs.readFileSync(path.join(dir, f), "utf8")}\n;\n${record}`);
    console.log(`applied   ${f}`);
  }
  applied++;
}

console.log(applied === 0 ? "Nothing to do: all migrations already recorded." : `${baseline ? "Recorded" : "Applied"} ${applied} migration(s) on ${ref}.`);
```

- [ ] **Step 2: Baseline production (record only, changes no schema)**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum node scripts/apply-migrations.mjs --baseline`
Expected: 13 lines `recorded  0001_init.sql` … `recorded  0013_experiments_writing.sql`, then `Recorded 13 migration(s) on yzbpaoknnzdtrvowbvum.`

- [ ] **Step 3: Confirm it is idempotent**

Run the same command again.
Expected: `Nothing to do: all migrations already recorded.`

- [ ] **Step 4: Confirm the record table is covered by the baseline tests**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`
Expected: `FAIL 001_rls_enabled.sql rls_enabled_on__applied_migrations` and the same for file 002, because the new bookkeeping table has no row-level security. Fix it in the next step; the tests are doing their job.

- [ ] **Step 5: Lock the bookkeeping table down**

Add to the script, immediately after the `create table if not exists` line:

```js
// Bookkeeping only: no policies, so the app's anon and authenticated roles can never read or write it.
await query("alter table public._applied_migrations enable row level security");
```

and change `supabase/tests/002_tables_have_policies.sql` to skip that table, since it is intentionally policy-free:

```sql
select 'has_policy_' || t.tablename as name,
       exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename) as ok
from pg_tables t
where t.schemaname = 'public' and t.tablename <> '_applied_migrations'
order by t.tablename;
```

- [ ] **Step 6: Re-run**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum node scripts/apply-migrations.mjs && SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`
Expected: `Nothing to do...`, then `0 failed`.

- [ ] **Step 7: Commit**

```bash
git add scripts/apply-migrations.mjs supabase/tests/002_tables_have_policies.sql
git commit -m "feat: repeatable migration runner with baseline mode

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Invite-only sign-up check

**Files:**
- Create: `scripts/check-auth-config.mjs`

**Interfaces:**
- Produces: `npm run check:auth`. Reads the project's Supabase Auth config and prints PASS/FAIL for: public sign-up disabled, custom SMTP configured, and (with `--production`) a non-localhost site URL. `--fix` sets `disable_signup` to true and nothing else. Exit code 1 if any check fails after any fix.

Finding that motivates this task: on 2026-09-24 the production project reported `disable_signup: false`, so anyone could create an account. The design requires invite-only.

- [ ] **Step 1: Write the script**

Create `scripts/check-auth-config.mjs`:

```js
// Checks (and with --fix, repairs) the Supabase Auth settings that keep the app invite-only.
// Usage:
//   SUPABASE_PROJECT_REF=<ref> node scripts/check-auth-config.mjs
//   SUPABASE_PROJECT_REF=<ref> node scripts/check-auth-config.mjs --fix
//   SUPABASE_PROJECT_REF=<ref> node scripts/check-auth-config.mjs --production
import fs from "fs";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) { console.error("Set SUPABASE_PROJECT_REF."); process.exit(2); }
const token = process.env.SUPABASE_ACCESS_TOKEN ?? (fs.existsSync(".supabase-token") ? fs.readFileSync(".supabase-token", "utf8").trim() : null);
if (!token) { console.error("Provide SUPABASE_ACCESS_TOKEN or a .supabase-token file."); process.exit(2); }
const fix = process.argv.includes("--fix");
const production = process.argv.includes("--production");

const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const get = async () => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

let cfg = await get();

if (fix && cfg.disable_signup !== true) {
  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ disable_signup: true }) });
  if (!res.ok) { console.error(`Could not update: ${res.status} ${await res.text()}`); process.exit(1); }
  console.log("Set disable_signup to true.");
  cfg = await get();
}

const checks = [
  { name: "public sign-up is disabled (invite-only)", ok: cfg.disable_signup === true },
  { name: "custom SMTP is configured", ok: !!cfg.smtp_host },
  ...(production ? [{ name: "site URL is not localhost", ok: !!cfg.site_url && !/localhost|127\.0\.0\.1/.test(cfg.site_url) }] : []),
];

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
console.log(`site_url: ${cfg.site_url}`);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
```

- [ ] **Step 2: Run it read-only against production**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run check:auth`
Expected today: `FAIL  public sign-up is disabled (invite-only)`, `PASS  custom SMTP is configured`, exit code 1.

- [ ] **Step 3: Confirm owner login still works with sign-up disabled (user action, on staging first)**

Before changing production, the user confirms on the staging project created per `docs/deployment.md` that with sign-up disabled: (a) an existing user can sign in by email link and by password, and (b) an invite sent from the People page still arrives and works. The agent does not change production auth settings on its own.

- [ ] **Step 4: Apply the fix on production (user runs it, after step 3)**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run check:auth -- --fix`
Expected: `Set disable_signup to true.` then all PASS, exit code 0.

- [ ] **Step 5: Verify a stranger cannot sign up**

Run:

```bash
node -e "const env=Object.fromEntries(require('fs').readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1).trim()]));fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/otp',{method:'POST',headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:'zztemp-stranger@example.com',create_user:true})}).then(async r=>console.log(r.status,await r.text()))"
```

Expected: HTTP 4xx with a message saying sign-ups are not allowed, and no `zztemp-stranger@example.com` row in `auth.users`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-auth-config.mjs
git commit -m "feat: check that public sign-up is disabled so the app stays invite-only

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: npm scripts `typecheck`, `test`, `build` from Task 1.
- Produces: a GitHub Actions check named `check` that must pass on every push and pull request. The database tests are deliberately not run in CI yet, since they need a token and a staging project; they join CI in phase 2.

- [ ] **Step 1: Prove the build works with placeholder environment values**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy npm run build`
Expected: `Compiled successfully` and a route table, exit code 0. If a page tries to fetch data at build time and fails, mark that route `export const dynamic = "force-dynamic"` and re-run before continuing.

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
          SUPABASE_SERVICE_ROLE_KEY: dummy
```

- [ ] **Step 3: Run the same three commands locally as the workflow does**

Run: `npm run typecheck && npm test`
Expected: no type errors and all tests pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: type-check, unit tests and build on every push

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Confirm it runs (user action)**

After the repository is pushed to GitHub (see Task 8, step 2), open the repository's Actions tab.
Expected: the `CI` run for the latest commit is green.

---

### Task 8: Vercel configuration and deployment runbook

**Files:**
- Create: `vercel.json`
- Create: `docs/deployment.md`

**Interfaces:**
- Produces: a weekly cron that calls `/api/digest` (Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set), and one runbook a person can follow to deploy, create staging, and rotate keys.

- [ ] **Step 1: Add the cron config**

Create `vercel.json`:

```json
{
  "crons": [{ "path": "/api/digest", "schedule": "15 1 * * 1" }]
}
```

`15 1 * * 1` is Monday 01:15 UTC, which is 07:00 in Nepal. Change the schedule if your time zone differs.

- [ ] **Step 2: Write the runbook**

Create `docs/deployment.md`:

````markdown
# Deployment runbook

## Environment variables

Set these in Vercel (Project, Settings, Environment Variables) for Production, and locally in `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only, bypasses row-level security. Never expose. |
| `RESEND_API_KEY` | for email | Resend key for the Monday digest |
| `CRON_SECRET` | for email | Random string; Vercel Cron sends it as a bearer token |
| `APP_URL` | for email | Public address, e.g. `https://your-app.vercel.app`, used for links in emails |
| `APP_TIMEZONE` | recommended | e.g. `Asia/Kathmandu`, so "today" and "Monday" are right |
| `DIGEST_FROM` | optional | Defaults to `Command Center <kcc@kacof.tech>` |

Generate a `CRON_SECRET` with: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

## First deployment

1. Create a private GitHub repository, then: `git remote add origin <url>` and `git push -u origin master`. Check the Actions tab shows a green `CI` run.
2. In Vercel: Add New Project, import the repository, framework Next.js, add the variables above, deploy.
3. Open `<your-url>/api/health`. Expected: `{"ok":true,"db":true}`.
4. In Supabase (Authentication, URL Configuration): set **Site URL** to the production address and add it plus `http://localhost:3000` to **Redirect URLs**. Until this is done, email links point at localhost.
5. Sign in on the production site with an email link, then set your password on the Account page.
6. Account page, "Monday email": press "Send me one now". Expected: the email arrives.
7. Run `SUPABASE_PROJECT_REF=<prod-ref> npm run check:auth -- --production` and make sure every line is PASS (this includes invite-only sign-up).

Vercel's free tier allows scheduled jobs only once per day and is intended for personal, non-commercial use. If KACOF uses the app as an organization, use the paid tier.

## Staging project

Migrations are tested on staging before production.

1. In the Supabase dashboard create a second project named `command-center-staging`. Note its project ref.
2. Apply every migration: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:migrate`.
3. Check it: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:test`. Expected: `0 failed`.
4. Optional: load a copy of production data for realistic checks by restoring from a backup file set (`npm run db:backup` on production first).

Production is baselined once (`--baseline`) so the runner knows what already ran there. From then on, apply new migrations to staging first, run the tests, take a backup of production, then apply to production.

## Before every production migration

1. `SUPABASE_PROJECT_REF=<prod-ref> npm run db:backup`
2. Apply and test on staging.
3. Apply to production: `SUPABASE_PROJECT_REF=<prod-ref> npm run db:migrate`
4. `SUPABASE_PROJECT_REF=<prod-ref> npm run db:test`

## Rotating keys

Do this whenever a key has appeared in chat, a screenshot or a log.

- **Resend:** create a new key in the Resend dashboard, update `RESEND_API_KEY` in Vercel and `.env.local`, redeploy, send a test digest, then delete the old key. Sign-in emails use a separate copy of the key inside Supabase (Authentication, SMTP): update that too.
- **Supabase access token (`.supabase-token`):** create a new personal access token in Supabase account settings, replace the file's content, revoke the old token.
- **`CRON_SECRET`:** generate a new value, update Vercel and `.env.local`, redeploy.
- **Service role key:** rotate in Supabase project settings only if it may have leaked, then update Vercel and `.env.local`.
````

- [ ] **Step 3: Validate the JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json is valid')"`
Expected: `vercel.json is valid`

- [ ] **Step 4: Commit**

```bash
git add vercel.json docs/deployment.md
git commit -m "docs: Vercel cron config and deployment, staging and key-rotation runbook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 0 acceptance checklist

Phase 0 is done when all of these are true:

- [ ] `npm run typecheck` and `npm test` pass locally, and the `CI` run on GitHub is green.
- [ ] `SUPABASE_PROJECT_REF=<prod-ref> npm run db:test` reports `0 failed`.
- [ ] A backup of production exists under `backups/` and is not tracked by git.
- [ ] Production migrations are baselined; a staging project exists with all migrations applied and `db:test` passing on it.
- [ ] `npm run check:auth -- --production` passes on production (invite-only confirmed, site URL is the real address).
- [ ] The app is deployed on Vercel, `/api/health` returns `{"ok":true,"db":true}`, and "Send me one now" delivers an email.
- [ ] The Resend key that was pasted into chat has been rotated.

## What comes next

Separate plans, written when this one is finished:

1. **Phase 1:** GitHub stage 1 (token connection, repo linking, cached commits and pull requests, Code tab, weekly summary).
2. **Phase 2:** workspaces and roles, including the access-test matrix in `supabase/tests/`.
3. **Phases 3 to 5:** templates, the team layer, and GitHub stages 2 and 3.
