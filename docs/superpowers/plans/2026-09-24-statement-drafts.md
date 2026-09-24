# Statement Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user write statements of purpose (and other statements) inside the app: a general draft plus a tailored version per school, with autosave, a live word count against each school's limit, saved snapshots, a status, and a link into the readiness checklist.

**Architecture:** Two new owner-only tables (`statements`, `statement_snapshots`). Pure rules (word-limit state, status changes, readiness rule) live in `lib/statements.ts` with Vitest tests. Server actions in `app/(app)/materials/statement-actions.ts` check the caller and write through Supabase. Screens: a Statements tab under Materials (list and editor) and a statement step on each school's Application tab.

**Tech Stack:** Next.js 14 (App Router, server actions), TypeScript, Supabase Postgres with row-level security, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-24-statements-and-recommenders-design.md` (section 3). The recommender workflow (spec section 4) is a separate plan.

## Global Constraints

- Never write an API key, token or secret into a tracked file.
- Supabase project ref for production: `yzbpaoknnzdtrvowbvum`. The Management API token is read from `.supabase-token` (git-ignored). Scripts that target production require `--production`.
- Test data uses the `ZZTEMP` prefix and is deleted afterwards. Real rows are snapshotted before being touched and restored. The user's own data (for example the resume named "My resume" and the CV document) must never be modified or deleted.
- Commit after each completed task. Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- The TypeScript target does not allow spreading a `Set`; use `Array.from`.
- Every new server action checks the caller against `OWNER_USER_ID` from `lib/owner.ts`.
- Autosaving editors must save when leaving the page and warn before the tab closes with unsaved changes, using `useUnsavedGuard` from `lib/use-unsaved-guard.ts`.
- Word counting uses `countWords` from `lib/research.ts`.
- UI copy: sentence case, plain words, no jargon. Design follows the existing calm style (plain sections with thin dividers, `Section`/`PageHeader`/`SubNav` from `components/ui.tsx`).
- Shell is Git Bash on Windows. HTTP calls via curl or inline node one-liners are blocked by a hook; use script files or the browser tools.

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0014_statements.sql` | Tables, unique index, trigger, row-level security |
| `supabase/tests/004_statements.sql` | Database checks for the new tables |
| `lib/statements.ts` | Kinds, statuses, word-limit state, status changes, readiness rule (pure) |
| `tests/lib/statements.test.ts` | Unit tests for the above |
| `app/(app)/materials/statement-actions.ts` | Create, edit, autosave, snapshot, restore, status, delete |
| `components/statements-list.tsx` | Client: create form and list rows |
| `app/(app)/materials/statements/page.tsx` | Statements tab (list) |
| `components/statement-editor.tsx` | Client: editor, counter, snapshots |
| `app/(app)/materials/statements/[id]/page.tsx` | Editor page |
| `components/statement-step.tsx` | Client: the statement step on a school's Application tab |
| `lib/readiness.ts`, `lib/readiness-data.ts` | Statement rule feeds the "Statement of purpose" checklist item |
| `app/(app)/schools/[id]/page.tsx` | Renders the statement step, passes the rule to readiness |
| `components/ui.tsx` | Adds the Statements tab |

---

### Task 1: Database tables

**Files:**
- Create: `supabase/migrations/0014_statements.sql`
- Create: `supabase/tests/004_statements.sql`

**Interfaces:**
- Produces: tables `statements` and `statement_snapshots` with the columns below, used by every later task.

`statements`: `id uuid pk`, `owner_id uuid`, `kind text` (one of `statement_of_purpose`, `research_statement`, `personal_statement`, `diversity_statement`, `other`), `title text`, `prompt text null`, `word_limit int null (>0)`, `body text default ''`, `words int default 0`, `status text` (`draft`, `final`, `sent`; default `draft`), `sent_on date null`, `school_id uuid null → schools on delete cascade`, `source_id uuid null → statements on delete set null`, `created_at`, `updated_at`.
`statement_snapshots`: `id uuid pk`, `owner_id uuid`, `statement_id uuid → statements on delete cascade`, `body text`, `words int`, `note text null`, `created_at`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0014_statements.sql`:

```sql
-- Statements written in the app: a general draft (no school) or a version tailored to one school.
create table statements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'statement_of_purpose'
    check (kind in ('statement_of_purpose', 'research_statement', 'personal_statement', 'diversity_statement', 'other')),
  title text not null,
  prompt text,
  word_limit integer check (word_limit is null or word_limit > 0),
  body text not null default '',
  words integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'final', 'sent')),
  sent_on date,
  school_id uuid references schools(id) on delete cascade,
  source_id uuid references statements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A school has at most one statement of each kind.
create unique index statements_school_kind_idx on statements(school_id, kind) where school_id is not null;
create index statements_owner_idx on statements(owner_id, updated_at desc);
create trigger statements_set_updated_at before update on statements for each row execute function set_updated_at();

create table statement_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  statement_id uuid not null references statements(id) on delete cascade,
  body text not null,
  words integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index statement_snapshots_statement_idx on statement_snapshots(statement_id, created_at desc);

alter table statements enable row level security;
alter table statement_snapshots enable row level security;
create policy "owner full access" on statements for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on statement_snapshots for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
```

- [ ] **Step 2: Write the database test**

Create `supabase/tests/004_statements.sql`:

```sql
select 'statements_owner_policy' as name,
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'statements' and policyname = 'owner full access') as ok
union all
select 'snapshots_owner_policy',
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'statement_snapshots' and policyname = 'owner full access')
union all
select 'one_statement_per_school_and_kind',
       exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'statements_school_kind_idx');
```

- [ ] **Step 3: Confirm the test fails before the migration**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`
Expected: `FAIL  004_statements.sql ...` lines (the policies and index do not exist yet), exit code 1. All other checks still pass.

- [ ] **Step 4: Back up production, then apply the migration**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:backup`
Expected: `Backed up 29 tables (...) ...`.

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:migrate -- --production`
Expected: `Target project: yzbpaoknnzdtrvowbvum`, `applied   0014_statements.sql`, `Applied 1 migration(s) on yzbpaoknnzdtrvowbvum.`

- [ ] **Step 5: Run the database tests**

Run: `SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`
Expected: `0 failed`, including PASS lines for `rls_enabled_on_statements`, `rls_enabled_on_statement_snapshots`, `has_policy_statements`, `has_policy_statement_snapshots` and the three `004_statements.sql` checks.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0014_statements.sql supabase/tests/004_statements.sql
git commit -m "feat: statements and statement snapshots tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure statement rules

**Files:**
- Create: `lib/statements.ts`
- Create: `tests/lib/statements.test.ts`

**Interfaces:**
- Produces (used by Tasks 3 to 6):
  - `STATEMENT_KINDS: ReadonlyArray<{ key: StatementKind; label: string }>`, `type StatementKind`
  - `STATEMENT_STATUS: ReadonlyArray<{ key: StatementStatus; label: string }>`, `type StatementStatus = "draft" | "final" | "sent"`
  - `isStatementKind(k: string): k is StatementKind`, `isStatementStatus(s: string): s is StatementStatus`
  - `statementKindLabel(k: string): string`
  - `type LimitState = "none" | "ok" | "near" | "over"`, `limitState(words: number, limit: number | null): LimitState`
  - `statusChange(next: StatementStatus, today: string, currentSentOn: string | null): { status: StatementStatus; sent_on: string | null }`
  - `hasFinalStatement(list: Array<{ kind: string; status: string }>): boolean`
  - `defaultTitle(kind: StatementKind, schoolName?: string): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/statements.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  defaultTitle, hasFinalStatement, isStatementKind, isStatementStatus, limitState, statementKindLabel, statusChange,
} from "@/lib/statements";

describe("limitState", () => {
  it("has no state without a limit", () => {
    expect(limitState(500, null)).toBe("none");
    expect(limitState(0, 0)).toBe("none");
  });
  it("is ok below 90 percent of the limit", () => expect(limitState(449, 500)).toBe("ok"));
  it("is near from 90 percent up to and including the limit", () => {
    expect(limitState(450, 500)).toBe("near");
    expect(limitState(500, 500)).toBe("near");
  });
  it("is over above the limit", () => expect(limitState(501, 500)).toBe("over"));
  it("rounds the 90 percent line up", () => {
    expect(limitState(9, 10)).toBe("near");
    expect(limitState(8, 10)).toBe("ok");
  });
});

describe("statusChange", () => {
  it("records today when a statement is first marked sent", () => {
    expect(statusChange("sent", "2026-10-01", null)).toEqual({ status: "sent", sent_on: "2026-10-01" });
  });
  it("keeps the original sent date when marked sent again", () => {
    expect(statusChange("sent", "2026-10-05", "2026-10-01")).toEqual({ status: "sent", sent_on: "2026-10-01" });
  });
  it("clears the sent date when moved back to final or draft", () => {
    expect(statusChange("final", "2026-10-05", "2026-10-01")).toEqual({ status: "final", sent_on: null });
    expect(statusChange("draft", "2026-10-05", "2026-10-01")).toEqual({ status: "draft", sent_on: null });
  });
});

describe("hasFinalStatement", () => {
  it("counts a final or sent statement of purpose", () => {
    expect(hasFinalStatement([{ kind: "statement_of_purpose", status: "final" }])).toBe(true);
    expect(hasFinalStatement([{ kind: "statement_of_purpose", status: "sent" }])).toBe(true);
  });
  it("ignores drafts and other kinds", () => {
    expect(hasFinalStatement([{ kind: "statement_of_purpose", status: "draft" }])).toBe(false);
    expect(hasFinalStatement([{ kind: "research_statement", status: "final" }])).toBe(false);
    expect(hasFinalStatement([])).toBe(false);
  });
});

describe("kinds, statuses and titles", () => {
  it("recognises valid values only", () => {
    expect(isStatementKind("statement_of_purpose")).toBe(true);
    expect(isStatementKind("essay")).toBe(false);
    expect(isStatementStatus("final")).toBe(true);
    expect(isStatementStatus("done")).toBe(false);
  });
  it("labels kinds and falls back to the key", () => {
    expect(statementKindLabel("research_statement")).toBe("Research statement");
    expect(statementKindLabel("mystery")).toBe("mystery");
  });
  it("builds default titles", () => {
    expect(defaultTitle("statement_of_purpose")).toBe("Statement of purpose (general draft)");
    expect(defaultTitle("statement_of_purpose", "Stanford University")).toBe("Statement of purpose: Stanford University");
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/lib/statements.test.ts`
Expected: FAIL, cannot resolve `@/lib/statements`.

- [ ] **Step 3: Implement**

Create `lib/statements.ts`:

```ts
export const STATEMENT_KINDS = [
  { key: "statement_of_purpose", label: "Statement of purpose" },
  { key: "research_statement", label: "Research statement" },
  { key: "personal_statement", label: "Personal statement" },
  { key: "diversity_statement", label: "Diversity statement" },
  { key: "other", label: "Other" },
] as const;
export type StatementKind = (typeof STATEMENT_KINDS)[number]["key"];

export const STATEMENT_STATUS = [
  { key: "draft", label: "Draft" },
  { key: "final", label: "Final" },
  { key: "sent", label: "Sent" },
] as const;
export type StatementStatus = (typeof STATEMENT_STATUS)[number]["key"];

export const isStatementKind = (k: string): k is StatementKind => STATEMENT_KINDS.some((x) => x.key === k);
export const isStatementStatus = (s: string): s is StatementStatus => STATEMENT_STATUS.some((x) => x.key === s);
export const statementKindLabel = (k: string) => STATEMENT_KINDS.find((x) => x.key === k)?.label ?? k;

export type LimitState = "none" | "ok" | "near" | "over";

// Neutral below 90% of the limit, "near" from 90% up to the limit, "over" above it.
export function limitState(words: number, limit: number | null): LimitState {
  if (!limit || limit <= 0) return "none";
  if (words > limit) return "over";
  if (words >= Math.ceil(limit * 0.9)) return "near";
  return "ok";
}

// Only "sent" carries a date. Marking it again keeps the first date; moving back clears it.
export function statusChange(next: StatementStatus, today: string, currentSentOn: string | null): { status: StatementStatus; sent_on: string | null } {
  return { status: next, sent_on: next === "sent" ? currentSentOn ?? today : null };
}

// The readiness rule: a school's statement of purpose counts once it is final or sent.
export function hasFinalStatement(list: Array<{ kind: string; status: string }>): boolean {
  return list.some((s) => s.kind === "statement_of_purpose" && (s.status === "final" || s.status === "sent"));
}

export function defaultTitle(kind: StatementKind, schoolName?: string): string {
  const label = statementKindLabel(kind);
  return schoolName ? `${label}: ${schoolName}` : `${label} (general draft)`;
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run tests/lib/statements.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add lib/statements.ts tests/lib/statements.test.ts
git commit -m "feat: pure rules for statements (word-limit state, status changes, readiness rule)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Server actions

**Files:**
- Create: `app/(app)/materials/statement-actions.ts`

**Interfaces:**
- Consumes: everything exported by `lib/statements.ts` (Task 2); `countWords` from `lib/research.ts`; `OWNER_USER_ID` from `lib/owner.ts`; `createClient` from `lib/supabase/server`.
- Produces (used by Tasks 4 to 6):
  - `createStatement(input: { kind: string; schoolId?: string | null; fromId?: string | null; title?: string }): Promise<string>` returns the new statement's id.
  - `updateStatementMeta(id: string, f: { title?: string; kind?: string; prompt?: string | null; wordLimit?: number | null }): Promise<void>`
  - `saveStatementBody(id: string, body: string): Promise<number>` returns the word count; does not revalidate (called on every autosave).
  - `setStatementStatus(id: string, next: string): Promise<void>`
  - `saveSnapshot(id: string, note?: string): Promise<void>`
  - `restoreSnapshot(snapshotId: string): Promise<{ body: string; words: number }>`
  - `deleteSnapshot(snapshotId: string, statementId: string): Promise<void>`
  - `deleteStatement(id: string): Promise<void>`

There is no unit test for this file: it is thin database plumbing over the pure rules tested in Task 2, and it is verified end to end in Task 7.

- [ ] **Step 1: Write the actions**

Create `app/(app)/materials/statement-actions.ts`:

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { countWords } from "@/lib/research";
import { defaultTitle, isStatementKind, isStatementStatus, statusChange } from "@/lib/statements";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can change statements.");
  return { supabase, userId: user.id };
}

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function refresh(id?: string, schoolId?: string | null) {
  revalidatePath("/materials/statements");
  if (id) revalidatePath(`/materials/statements/${id}`);
  if (schoolId) revalidatePath(`/schools/${schoolId}`);
  revalidatePath("/readiness");
  revalidatePath("/");
}

export async function createStatement(input: { kind: string; schoolId?: string | null; fromId?: string | null; title?: string }): Promise<string> {
  const { supabase, userId } = await owner();
  if (!isStatementKind(input.kind)) throw new Error("Unknown statement type.");

  let body = "";
  let prompt: string | null = null;
  let sourceId: string | null = null;
  if (input.fromId) {
    const { data: src } = await supabase.from("statements").select("body, prompt").eq("id", input.fromId).single();
    if (!src) throw new Error("The draft to copy from was not found.");
    body = src.body;
    prompt = src.prompt;
    sourceId = input.fromId;
  }

  let schoolName: string | undefined;
  if (input.schoolId) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", input.schoolId).single();
    schoolName = school?.name;
  }

  const { data, error } = await supabase.from("statements").insert({
    owner_id: userId, kind: input.kind, title: input.title?.trim() || defaultTitle(input.kind, schoolName), prompt, body, words: countWords(body),
    school_id: input.schoolId ?? null, source_id: sourceId,
  }).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") throw new Error("This school already has a statement of that type.");
    throw new Error(error?.message ?? "Could not create the statement.");
  }
  refresh(data.id, input.schoolId);
  return data.id as string;
}

export async function updateStatementMeta(id: string, f: { title?: string; kind?: string; prompt?: string | null; wordLimit?: number | null }) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (f.title !== undefined) {
    if (!f.title.trim()) throw new Error("The title can't be empty.");
    row.title = f.title.trim();
  }
  if (f.kind !== undefined) {
    if (!isStatementKind(f.kind)) throw new Error("Unknown statement type.");
    row.kind = f.kind;
  }
  if (f.prompt !== undefined) row.prompt = (f.prompt ?? "").trim() || null;
  if (f.wordLimit !== undefined) row.word_limit = f.wordLimit && f.wordLimit > 0 ? Math.round(f.wordLimit) : null;
  const { data, error } = await supabase.from("statements").update(row).eq("id", id).select("school_id").single();
  if (error) {
    if (error.code === "23505") throw new Error("This school already has a statement of that type.");
    throw new Error(error.message);
  }
  refresh(id, data?.school_id);
}

// Called on every autosave, so it deliberately does not revalidate the page.
export async function saveStatementBody(id: string, body: string): Promise<number> {
  const { supabase } = await owner();
  const words = countWords(body);
  const { error } = await supabase.from("statements").update({ body, words }).eq("id", id);
  if (error) throw new Error(error.message);
  return words;
}

export async function setStatementStatus(id: string, next: string) {
  const { supabase } = await owner();
  if (!isStatementStatus(next)) throw new Error("Unknown status.");
  const { data: cur } = await supabase.from("statements").select("sent_on, school_id").eq("id", id).single();
  if (!cur) throw new Error("Statement not found.");
  const change = statusChange(next, localToday(), cur.sent_on);
  const { error } = await supabase.from("statements").update(change).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id, cur.school_id);
}

export async function saveSnapshot(id: string, note?: string) {
  const { supabase, userId } = await owner();
  const { data: cur } = await supabase.from("statements").select("body, words").eq("id", id).single();
  if (!cur) throw new Error("Statement not found.");
  const { error } = await supabase.from("statement_snapshots").insert({
    owner_id: userId, statement_id: id, body: cur.body, words: cur.words, note: (note ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/materials/statements/${id}`);
}

// Restoring first saves the current text as a snapshot, so nothing is ever lost.
export async function restoreSnapshot(snapshotId: string): Promise<{ body: string; words: number }> {
  const { supabase, userId } = await owner();
  const { data: snap } = await supabase.from("statement_snapshots").select("statement_id, body").eq("id", snapshotId).single();
  if (!snap) throw new Error("Version not found.");
  const { data: cur } = await supabase.from("statements").select("body, words, school_id").eq("id", snap.statement_id).single();
  if (!cur) throw new Error("Statement not found.");
  if (cur.body !== snap.body) {
    const { error: e1 } = await supabase.from("statement_snapshots").insert({
      owner_id: userId, statement_id: snap.statement_id, body: cur.body, words: cur.words, note: "Before restoring an older version",
    });
    if (e1) throw new Error(e1.message);
  }
  const words = countWords(snap.body);
  const { error } = await supabase.from("statements").update({ body: snap.body, words }).eq("id", snap.statement_id);
  if (error) throw new Error(error.message);
  refresh(snap.statement_id, cur.school_id);
  return { body: snap.body, words };
}

export async function deleteSnapshot(snapshotId: string, statementId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("statement_snapshots").delete().eq("id", snapshotId);
  if (error) throw new Error(error.message);
  revalidatePath(`/materials/statements/${statementId}`);
}

export async function deleteStatement(id: string) {
  const { supabase } = await owner();
  const { data: cur } = await supabase.from("statements").select("school_id").eq("id", id).single();
  const { error } = await supabase.from("statements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(undefined, cur?.school_id);
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/materials/statement-actions.ts"
git commit -m "feat: server actions for statements (create, edit, autosave, snapshots, status)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Statements list page

**Files:**
- Modify: `components/ui.tsx` (add the tab)
- Create: `components/statements-list.tsx`
- Create: `app/(app)/materials/statements/page.tsx`

**Interfaces:**
- Consumes: `createStatement` (Task 3); `STATEMENT_KINDS`, `statementKindLabel`, `limitState`, `LimitState` (Task 2); `PageHeader`, `SubNav`, `MATERIALS_TABS` from `components/ui.tsx`.
- Produces: the route `/materials/statements`; `StatementRow` type `{ id: string; kind: string; title: string; status: string; words: number; word_limit: number | null; school_id: string | null; updated_at: string }` exported from `components/statements-list.tsx`.

- [ ] **Step 1: Add the tab**

In `components/ui.tsx`, change `MATERIALS_TABS` to:

```ts
export const MATERIALS_TABS = [
  { href: "/materials", label: "Documents" },
  { href: "/materials/resume", label: "Resume builder" },
  { href: "/materials/statements", label: "Statements" },
];
```

- [ ] **Step 2: Write the list component**

Create `components/statements-list.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStatement } from "@/app/(app)/materials/statement-actions";
import { STATEMENT_KINDS, limitState, statementKindLabel, type LimitState } from "@/lib/statements";

export type StatementRow = {
  id: string; kind: string; title: string; status: string; words: number; word_limit: number | null; school_id: string | null; updated_at: string;
};
type SchoolOpt = { id: string; name: string };

const field = "border rounded px-2 py-1.5 text-sm w-full";
const LIMIT_TONE: Record<LimitState, string> = { none: "text-gray-400", ok: "text-gray-400", near: "text-brass", over: "text-red-600" };
const STATUS_TONE: Record<string, string> = { draft: "text-gray-500", final: "text-teal-600", sent: "text-teal-600" };
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Row({ s, schoolName }: { s: StatementRow; schoolName?: string }) {
  const state = limitState(s.words, s.word_limit);
  return (
    <li className="border-b border-line/60 last:border-0">
      <Link href={`/materials/statements/${s.id}`} className="flex items-baseline justify-between gap-4 py-3 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
        <span className="min-w-0">
          <span className="block font-medium truncate">{s.title}</span>
          <span className="block text-xs text-gray-500 truncate">{[statementKindLabel(s.kind), schoolName, `edited ${when(s.updated_at)}`].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-right whitespace-nowrap">
          <span className={`block text-sm ${STATUS_TONE[s.status]}`}>{s.status === "sent" ? "Sent" : s.status === "final" ? "Final" : "Draft"}</span>
          <span className={`block text-xs font-mono ${LIMIT_TONE[state]}`}>{s.words.toLocaleString()}{s.word_limit ? ` / ${s.word_limit.toLocaleString()}` : ""} words</span>
        </span>
      </Link>
    </li>
  );
}

export function StatementsList({ statements, schools }: { statements: StatementRow[]; schools: SchoolOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("statement_of_purpose");
  const [schoolId, setSchoolId] = useState("");
  const [fromGeneral, setFromGeneral] = useState(true);

  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  const general = statements.filter((s) => !s.school_id);
  const tailored = statements.filter((s) => s.school_id);
  const generalOfKind = general.find((g) => g.kind === kind);
  const bySchool = new Map<string, StatementRow[]>();
  tailored.forEach((s) => bySchool.set(s.school_id!, [...(bySchool.get(s.school_id!) ?? []), s]));

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-3 text-sm border-b border-line pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            try {
              const id = await createStatement({ kind, schoolId: schoolId || null, fromId: schoolId && fromGeneral && generalOfKind ? generalOfKind.id : null });
              router.push(`/materials/statements/${id}`);
            } catch (err) { setError(err instanceof Error ? err.message : "Could not create the statement."); }
          });
        }}
      >
        <div className="flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field + " max-w-[13rem] bg-transparent"} aria-label="Statement type">
            {STATEMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={field + " max-w-[18rem] bg-transparent"} aria-label="School">
            <option value="">General draft (not for one school)</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 disabled:opacity-50">{pending ? "Creating…" : "New statement"}</button>
        </div>
        {schoolId && generalOfKind && (
          <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
            <input type="checkbox" checked={fromGeneral} onChange={(e) => setFromGeneral(e.target.checked)} /> Start from my general {statementKindLabel(kind).toLowerCase()} (copies its text and prompt)
          </label>
        )}
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </form>

      {statements.length === 0 ? (
        <p className="text-sm text-gray-500">No statements yet. Start with a general draft, then make a tailored version for each school from it, each with its own prompt and word limit.</p>
      ) : (
        <>
          <section className="flex flex-col">
            <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">General drafts</h2>
            {general.length === 0 ? <p className="text-sm text-gray-400 py-3">None yet.</p> : <ul>{general.map((s) => <Row key={s.id} s={s} />)}</ul>}
          </section>
          {Array.from(bySchool.entries()).length > 0 && (
            <section className="flex flex-col">
              <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">By school</h2>
              <ul>{tailored.map((s) => <Row key={s.id} s={s} schoolName={schoolName.get(s.school_id!)} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the page**

Create `app/(app)/materials/statements/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { StatementsList, type StatementRow } from "@/components/statements-list";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";

export const metadata = { title: "Statements" };

export default async function StatementsPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: statements }, { data: schools }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("statements").select("id, kind, title, status, words, word_limit, school_id, updated_at").order("updated_at", { ascending: false }),
    supabase.from("schools").select("id, name, applying").order("name"),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Statements are only available to the workspace owner.</main>;
  }
  // Schools you are applying to come first in the picker.
  const ordered = [...(schools ?? [])].sort((a, b) => Number(b.applying) - Number(a.applying) || a.name.localeCompare(b.name));
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Materials" subtitle="Write your statements here: a general draft, then a tailored version for each school." />
        <SubNav items={MATERIALS_TABS} current="/materials/statements" />
      </div>
      <StatementsList statements={(statements ?? []) as StatementRow[]} schools={ordered.map((s) => ({ id: s.id, name: s.name }))} />
    </main>
  );
}
```

- [ ] **Step 4: Type-check and open the page**

Run: `npm run typecheck`
Expected: no errors.
Then load `http://localhost:3000/materials/statements` in the browser pane. Expected: the Statements tab is active, the create form shows, and the empty-state sentence appears (no statements exist yet). No console errors.

- [ ] **Step 5: Commit**

```bash
git add components/ui.tsx components/statements-list.tsx "app/(app)/materials/statements/page.tsx"
git commit -m "feat: Statements tab with the list and create form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: The editor

**Files:**
- Create: `components/statement-editor.tsx`
- Create: `app/(app)/materials/statements/[id]/page.tsx`

**Interfaces:**
- Consumes: `saveStatementBody`, `updateStatementMeta`, `setStatementStatus`, `saveSnapshot`, `restoreSnapshot`, `deleteSnapshot`, `deleteStatement` (Task 3); `STATEMENT_KINDS`, `STATEMENT_STATUS`, `limitState`, `statementKindLabel` (Task 2); `countWords` from `lib/research.ts`; `useUnsavedGuard` from `lib/use-unsaved-guard.ts`.
- Produces: the route `/materials/statements/[id]`; types `EditorStatement` and `EditorSnapshot` exported from `components/statement-editor.tsx`.

- [ ] **Step 1: Write the editor component**

Create `components/statement-editor.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteSnapshot, deleteStatement, restoreSnapshot, saveSnapshot, saveStatementBody, setStatementStatus, updateStatementMeta,
} from "@/app/(app)/materials/statement-actions";
import { countWords } from "@/lib/research";
import { STATEMENT_KINDS, STATEMENT_STATUS, limitState, statementKindLabel, type LimitState } from "@/lib/statements";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

export type EditorStatement = {
  id: string; kind: string; title: string; prompt: string | null; word_limit: number | null; body: string; status: string; sent_on: string | null;
  school_id: string | null; schoolName: string | null;
};
export type EditorSnapshot = { id: string; body: string; words: number; note: string | null; created_at: string };

const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const COUNT_TONE: Record<LimitState, string> = { none: "text-gray-400", ok: "text-gray-400", near: "text-brass", over: "text-red-600" };

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => { try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

export function StatementEditor({ statement, snapshots }: { statement: EditorStatement; snapshots: EditorSnapshot[] }) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [text, setText] = useState(statement.body);
  const [limit, setLimit] = useState<number | null>(statement.word_limit);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [metaSaved, setMetaSaved] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const first = useRef(true);
  const latest = useRef(text);
  latest.current = text;
  const unsaved = useRef(false);

  // Autosave 1.5 seconds after the last keystroke; saves again on leaving the page.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveState("dirty");
    unsaved.current = true;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try { await saveStatementBody(statement.id, text); unsaved.current = false; setSaveState("saved"); } catch { setSaveState("error"); }
    }, 1500);
    return () => clearTimeout(t);
  }, [text, statement.id]);
  useEffect(() => () => { if (unsaved.current) saveStatementBody(statement.id, latest.current).catch(() => {}); }, [statement.id]);
  useUnsavedGuard(saveState !== "saved");

  const words = countWords(text);
  const state = limitState(words, limit);
  const saveLabel = saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Could not save. Copy your text before leaving.";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/materials/statements" className="text-xs text-gray-500 hover:text-cream self-start">← Statements</Link>
        <h1 className="text-3xl leading-tight break-words">{statement.title}</h1>
        <p className="text-sm text-gray-500">
          {[statementKindLabel(statement.kind), statement.schoolName ? (
            <Link key="s" href={`/schools/${statement.school_id}?tab=application`} className="text-brass hover:underline">{statement.schoolName}</Link>
          ) : "General draft"].reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, " · ", x] : [x]), [])}
        </p>
      </div>

      {statement.prompt && (
        <section className="border-l-2 border-line pl-4">
          <h2 className="font-sans text-xs font-semibold text-gray-400 mb-1">The prompt</h2>
          <p className="text-sm text-gray-500 whitespace-pre-line">{statement.prompt}</p>
        </section>
      )}

      <section className="flex flex-col gap-1">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={22}
          placeholder="Write here. It saves on its own." className={field + " font-serif text-base leading-relaxed"} aria-label="Statement text"
        />
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
          <span className={`font-mono ${COUNT_TONE[state]}`}>
            {words.toLocaleString()}{limit ? ` of ${limit.toLocaleString()}` : ""} words{state === "over" ? ` · ${(words - (limit ?? 0)).toLocaleString()} over` : state === "near" ? " · close to the limit" : ""}
          </span>
          <span className={saveState === "error" ? "text-red-600" : "text-gray-400"} aria-live="polite">{saveLabel}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Status</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {STATEMENT_STATUS.map((s) => (
            <button
              key={s.key} disabled={pending} onClick={() => run(() => setStatementStatus(statement.id, s.key), () => router.refresh())}
              className={`rounded border px-3 py-1 ${statement.status === s.key ? "border-brass text-cream font-medium" : "border-line text-gray-500 hover:text-cream"}`}
              aria-pressed={statement.status === s.key}
            >
              {s.label}
            </button>
          ))}
          {statement.sent_on && <span className="text-xs text-gray-400">Sent {statement.sent_on}</span>}
        </div>
        <p className="text-xs text-gray-400">{statement.school_id && statement.kind === "statement_of_purpose" ? "Marking this Final or Sent ticks the statement on the school's readiness checklist." : "Final means it is ready to submit."}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Versions</h2>
        <form
          className="flex flex-wrap gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const note = String(new FormData(form).get("note") ?? "");
            run(async () => {
              // Make sure the latest text is stored before it is copied into a version.
              await saveStatementBody(statement.id, latest.current);
              unsaved.current = false; setSaveState("saved");
              await saveSnapshot(statement.id, note);
            }, () => { form.reset(); router.refresh(); });
          }}
        >
          <input name="note" placeholder="Name this version, e.g. after advisor feedback" className={field + " flex-1 min-w-[14rem]"} aria-label="Version note" />
          <button disabled={pending} className={primary}>Save a version</button>
        </form>
        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-500">No saved versions yet. Save one before a big rewrite so you can go back.</p>
        ) : (
          <ul className="flex flex-col">
            {snapshots.map((s) => (
              <li key={s.id} className="border-b border-line/60 last:border-0 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{s.note ?? "Saved version"}</span>
                    <span className="block text-xs text-gray-400">{new Date(s.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {s.words.toLocaleString()} words</span>
                  </span>
                  <span className="flex gap-3 text-xs text-gray-500 whitespace-nowrap">
                    <button onClick={() => setViewing(viewing === s.id ? null : s.id)} className="hover:text-cream">{viewing === s.id ? "Hide" : "View"}</button>
                    <button
                      disabled={pending}
                      onClick={() => { if (confirm("Replace the current text with this version? Your current text is saved as a version first.")) run(async () => { const r = await restoreSnapshot(s.id); setText(r.body); unsaved.current = false; setSaveState("saved"); }, () => router.refresh()); }}
                      className="hover:text-brass"
                    >
                      Restore
                    </button>
                    <button disabled={pending} onClick={() => { if (confirm("Delete this saved version?")) run(() => deleteSnapshot(s.id, statement.id), () => router.refresh()); }} className="hover:text-red-600" aria-label="Delete version">✕</button>
                  </span>
                </div>
                {viewing === s.id && <p className="text-sm text-gray-500 whitespace-pre-line font-serif mt-2 border-l-2 border-line pl-3 max-h-72 overflow-auto">{s.body || "(empty)"}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="text-sm group">
        <summary className="cursor-pointer text-gray-500 hover:text-cream list-none border-b border-line pb-2">Details: title, type, prompt, word limit</summary>
        <form
          className="grid gap-3 sm:grid-cols-2 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
            const wl = Number(v("limit")) || null;
            setMetaSaved(false);
            run(() => updateStatementMeta(statement.id, { title: v("title"), kind: v("kind"), prompt: v("prompt") || null, wordLimit: wl }), () => { setLimit(wl); setMetaSaved(true); router.refresh(); });
          }}
        >
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Title<input name="title" defaultValue={statement.title} required className={field + " text-cream"} /></label>
          <label className="flex flex-col gap-1 text-gray-500">Type
            <select name="kind" defaultValue={statement.kind} className={field + " text-cream bg-transparent"}>{STATEMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-gray-500">Word limit<input name="limit" type="number" min={1} defaultValue={statement.word_limit ?? ""} placeholder="No limit" className={field + " text-cream"} /></label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">The school&rsquo;s prompt<textarea name="prompt" defaultValue={statement.prompt ?? ""} rows={4} placeholder="Paste the question or instructions from the application" className={field + " text-cream"} /></label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button disabled={pending} className={primary}>Save details</button>
            {metaSaved && !pending && <span className="text-teal-600 text-xs">Saved</span>}
          </div>
        </form>
      </details>

      <div className="flex items-center gap-4 text-sm">
        <button
          disabled={pending}
          onClick={() => { if (confirm(`Delete "${statement.title}" and all its saved versions? This cannot be undone.`)) run(() => deleteStatement(statement.id), () => router.push("/materials/statements")); }}
          className="text-gray-500 hover:text-red-600"
        >
          Delete this statement
        </button>
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

Create `app/(app)/materials/statements/[id]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { StatementEditor, type EditorSnapshot, type EditorStatement } from "@/components/statement-editor";

export const metadata = { title: "Statement" };

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: statement }, { data: snapshots }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("statements").select("id, kind, title, prompt, word_limit, body, status, sent_on, school_id").eq("id", id).single(),
    supabase.from("statement_snapshots").select("id, body, words, note, created_at").eq("statement_id", id).order("created_at", { ascending: false }),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Statements are only available to the workspace owner.</main>;
  }
  if (!statement) return <main className="p-4 md:p-8 max-w-3xl mx-auto text-sm text-gray-500">Statement not found.</main>;
  let schoolName: string | null = null;
  if (statement.school_id) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", statement.school_id).single();
    schoolName = school?.name ?? null;
  }
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto">
      <StatementEditor statement={{ ...(statement as Omit<EditorStatement, "schoolName">), schoolName }} snapshots={(snapshots ?? []) as EditorSnapshot[]} />
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/statement-editor.tsx "app/(app)/materials/statements/[id]/page.tsx"
git commit -m "feat: statement editor with autosave, word count, status and saved versions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Readiness and the school's Application tab

**Files:**
- Modify: `lib/readiness.ts`
- Modify: `lib/readiness-data.ts`
- Modify: `tests/lib/readiness.test.ts`
- Create: `components/statement-step.tsx`
- Modify: `app/(app)/schools/[id]/page.tsx`

**Interfaces:**
- Consumes: `hasFinalStatement` (Task 2); `createStatement` (Task 3).
- Produces: `ReadinessSchool.has_statement?: boolean`; the "Statement of purpose written" checklist item is done when `has_statement` is true or `sop_version_id` is set; `StatementStep` component with props `{ schoolId: string; statements: Array<{ id: string; kind: string; title: string; status: string; words: number; word_limit: number | null }>; generalDrafts: Array<{ id: string; title: string }> }`.

- [ ] **Step 1: Write the failing readiness tests**

Append to `tests/lib/readiness.test.ts` (inside the existing `describe("buildItems", ...)` block, before its closing `});`, or as a new block at the end of the file):

```ts
describe("buildItems statement rule", () => {
  const done = (over: Partial<ReadinessSchool>) => buildItems(school(over), [], {}).find((i) => i.key === "sop")!.done;

  it("is done when the school has a final or sent statement", () => expect(done({ has_statement: true })).toBe(true));
  it("is not done without a statement or a legacy record", () => expect(done({ has_statement: false })).toBe(false));
  it("still counts the legacy recorded statement", () => expect(done({ sop_version_id: "v1" })).toBe(true));
  it("points at the Statements tab when not done", () => {
    const item = buildItems(school(), [], {}).find((i) => i.key === "sop")!;
    expect(item.hint).toBe("Mark your statement Final in Materials, Statements");
  });
});
```

Run: `npx vitest run tests/lib/readiness.test.ts`
Expected: FAIL (`has_statement` is not a known property, and the hint text differs).

- [ ] **Step 2: Update `lib/readiness.ts`**

Change the `ReadinessSchool` type to add `has_statement?: boolean`:

```ts
export type ReadinessSchool = {
  id: string; name: string; deadline_date: string | null; status: string; gre_policy: string | null; english_test: string | null;
  letters_required: number | null; sop_version_id: string | null; has_statement?: boolean;
};
```

and replace the `sop` item with:

```ts
    { key: "sop", label: "Statement of purpose written", done: !!s.has_statement || !!s.sop_version_id, derived: true, hint: "Mark your statement Final in Materials, Statements" },
```

- [ ] **Step 3: Run the readiness tests**

Run: `npx vitest run tests/lib/readiness.test.ts`
Expected: PASS.

- [ ] **Step 4: Feed the rule from the loader**

In `lib/readiness-data.ts`, add the import and the query, and pass the flag. Replace the file's `Promise.all` block and the `map` with:

```ts
import { hasFinalStatement } from "@/lib/statements";
```

(add at the top with the other imports), then:

```ts
  const [{ data: letters }, { data: checks }, { data: statements }] = await Promise.all([
    supabase.from("letter_requests").select("school_id, status").in("school_id", ids),
    supabase.from("application_checks").select("school_id, item, done").in("school_id", ids),
    supabase.from("statements").select("school_id, kind, status").in("school_id", ids),
  ]);
  return list
    .map((s) => {
      const ls = ((letters ?? []) as any[]).filter((l) => l.school_id === s.id);
      const cs: Record<string, boolean> = {};
      ((checks ?? []) as any[]).filter((c) => c.school_id === s.id).forEach((c) => { cs[c.item] = c.done; });
      const withStatement = { ...s, has_statement: hasFinalStatement(((statements ?? []) as any[]).filter((x) => x.school_id === s.id)) };
      const items = buildItems(withStatement, ls, cs);
      return { school: withStatement, items, ...assess(withStatement, items, today) };
    })
```

(keep the existing `.sort(...)` that follows.)

- [ ] **Step 5: Write the statement step component**

Create `components/statement-step.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStatement } from "@/app/(app)/materials/statement-actions";
import { limitState, statementKindLabel, type LimitState } from "@/lib/statements";

type StepStatement = { id: string; kind: string; title: string; status: string; words: number; word_limit: number | null };
const TONE: Record<LimitState, string> = { none: "text-gray-400", ok: "text-gray-400", near: "text-brass", over: "text-red-600" };

export function StatementStep({ schoolId, statements, generalDrafts }: { schoolId: string; statements: StepStatement[]; generalDrafts: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasSop = statements.some((s) => s.kind === "statement_of_purpose");

  const create = (fromId: string | null) => {
    setError(null);
    start(async () => {
      try { router.push(`/materials/statements/${await createStatement({ kind: "statement_of_purpose", schoolId, fromId })}`); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not create the statement."); }
    });
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {statements.length > 0 && (
        <ul className="flex flex-col">
          {statements.map((s) => (
            <li key={s.id} className="border-b border-line/60 last:border-0">
              <Link href={`/materials/statements/${s.id}`} className="flex items-baseline justify-between gap-4 py-2 hover:text-brass">
                <span className="min-w-0"><span className="block truncate">{s.title}</span><span className="block text-xs text-gray-500">{statementKindLabel(s.kind)} · {s.status === "sent" ? "Sent" : s.status === "final" ? "Final" : "Draft"}</span></span>
                <span className={`text-xs font-mono whitespace-nowrap ${TONE[limitState(s.words, s.word_limit)]}`}>{s.words.toLocaleString()}{s.word_limit ? ` / ${s.word_limit.toLocaleString()}` : ""} words</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!hasSop && (
        <div className="flex flex-wrap items-center gap-4">
          {generalDrafts.map((g) => (
            <button key={g.id} disabled={pending} onClick={() => create(g.id)} className="text-brass hover:underline disabled:opacity-50">Create from &ldquo;{g.title}&rdquo;</button>
          ))}
          <button disabled={pending} onClick={() => create(null)} className="text-gray-500 hover:text-cream disabled:opacity-50">Start blank</button>
        </div>
      )}
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 6: Use it on the school page**

In `app/(app)/schools/[id]/page.tsx`:

1. Add imports next to the existing ones:

```tsx
import { StatementStep } from "@/components/statement-step";
import { hasFinalStatement } from "@/lib/statements";
```

2. After the existing `const hasSop = ...` line (near line 85), add:

```tsx
  const { data: schoolStatements } = await supabase.from("statements").select("id, kind, title, status, words, word_limit").eq("school_id", id).order("created_at");
  const { data: generalDrafts } = await supabase.from("statements").select("id, title").is("school_id", null).eq("kind", "statement_of_purpose").order("updated_at", { ascending: false });
  const statementReady = hasFinalStatement((schoolStatements ?? []) as any[]);
```

3. In both `buildItems(...)` / `assess(...)` school objects (the two objects that contain `sop_version_id: (sop as any)?.sop_version_id ?? null`), add `has_statement: statementReady` to each.

4. Replace the existing "Statement of purpose" `Step` block with:

```tsx
          <Step
            done={hasSop || statementReady}
            title="Statement of purpose"
            summary={statementReady ? "Final" : (schoolStatements ?? []).length > 0 ? "In progress" : hasSop ? "Recorded" : "Not started"}
          >
            <StatementStep schoolId={id} statements={(schoolStatements ?? []) as any[]} generalDrafts={(generalDrafts ?? []) as any[]} />
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-cream">{hasSop ? "Recorded without a draft" : "+ Just record what you sent, without a draft"}</summary>
              <div className="pt-3">
                <SopForm schoolId={id} current={hasSop ? { label: sopLabel ?? "Recorded version", sentAt: (sop as any).sop_sent_at } : null} />
              </div>
            </details>
          </Step>
```

- [ ] **Step 7: Type-check and run the whole suite**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/readiness.ts lib/readiness-data.ts tests/lib/readiness.test.ts components/statement-step.tsx "app/(app)/schools/[id]/page.tsx"
git commit -m "feat: statements feed the readiness checklist and appear on the school's Application tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end check in the browser

**Files:** none (verification only). Create `ZZTEMP` data through the app, then delete it.

- [ ] **Step 1: General draft and word count**

At `http://localhost:3000/materials/statements`: choose "Statement of purpose", school "General draft", press "New statement". Expected: the editor opens titled "Statement of purpose (general draft)". Type a paragraph; the counter shows the live word count and, after about 2 seconds, "Saved".

- [ ] **Step 2: Tailored version with a limit**

Back on the list, pick a school, keep "Start from my general statement of purpose" ticked, press "New statement". Expected: the new editor holds the copied text. Open "Details", set the word limit to a number slightly below the word count, "Save details". Expected: the counter turns red with "N over"; set it slightly above (within 10%) and it turns amber with "close to the limit"; set it far above and it is neutral.

- [ ] **Step 3: Versions**

Press "Save a version" with the note `ZZTEMP first`. Change the text, save another version. Press "Restore" on the first. Expected: the text returns to the first version and a "Before restoring an older version" entry appears. "View" shows a version's text; the ✕ deletes one.

- [ ] **Step 4: Leaving mid-edit**

Type a few characters and immediately click "← Statements". Reopen the statement. Expected: the characters were saved.

- [ ] **Step 5: Status and readiness**

On the tailored statement press "Final". Open that school (`/schools/<id>?tab=application`). Expected: the Statement of purpose step is done and lists the statement with its word count. Press "Sent" on the statement: the sent date shows; press "Draft": the date clears. If the school is marked "I'm applying here", `/readiness` shows the statement item done only while the status is Final or Sent.

- [ ] **Step 6: Duplicate protection**

Try to create a second statement of purpose for the same school. Expected: the message "This school already has a statement of that type."

- [ ] **Step 7: Clean up**

Delete every `ZZTEMP` snapshot and every statement created during this check (the app's "Delete this statement" button), restore any school setting you changed (for example unmark "I'm applying here" if you set it), and confirm with a query that `statements`, `statement_snapshots` and `application_checks` are empty of test rows.

- [ ] **Step 8: Final suite and commit any fixes**

Run: `npm run typecheck && npm test && SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`
Expected: all pass, `0 failed`. If the browser check exposed a defect and you fixed it, commit the fix with a message describing it.

---

## Acceptance checklist

- [ ] The migration is applied on production and `db:test` reports `0 failed`.
- [ ] `npm run typecheck` and `npm test` pass.
- [ ] A general draft and a tailored version can be created, edited, autosaved and word-counted against a limit.
- [ ] Versions can be saved, viewed, restored (with an automatic "before restoring" version) and deleted.
- [ ] Leaving mid-edit saves the text.
- [ ] Marking a school's statement Final or Sent completes the readiness item; Draft undoes it; the older recorded-SOP entries still count.
- [ ] No test data remains.

## What comes next

The recommender workflow (spec section 4) gets its own plan: letter dates and flags, the Letters tab, email drafts, and the weekly page and Monday email lists.
