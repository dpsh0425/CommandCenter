# Editor Rollout and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Word-style editor where the spec says (research writing sections, journal entries, school notes), give recommender email drafts the paper look in plain text, make action errors reliable in production, add letter requests to the Letters tab (including one recommender for several schools), and finish with a real audit of the new screens.

**Architecture:** A reusable autosave hook (`lib/use-rich-autosave.ts`) and a `RichDraft` component bring plan 1's safeguards (atomic saves, stale-edit protection, crash backup) to any long-form text. A shared `ActionResult` type and `useAction` hook replace thrown errors, whose messages production builds hide. Journal entries and school notes use the compact editor and are shown from server-cleaned HTML. A pure planner in `lib/letters.ts` decides which letter requests to create. The last task is an audit of the new screens with fixes.

**Tech Stack:** Next.js 14 App Router, React 18, TipTap 3, `sanitize-html`, Vitest, Supabase, Tailwind.

## Global Constraints

- Rich text is stored as cleaned HTML in the existing text columns (plan 1). Cleaning happens on the server (`sanitizeHtml`, `renderRich`, and the new `cleanRichBody`); client components receive HTML that a server component or action already cleaned. `lib/rich-text-server.ts` is never imported from a client component.
- Old plain text keeps working everywhere: it is converted with `toEditorHtml` when opened and shown through `renderRich`.
- Saves of long-form text are atomic on a `body_version` counter and return a result object: `{ ok: true, words, version } | { ok: false, reason: "stale" | "error", message }` (the `SaveResult` type). A refused save never overwrites; the editor keeps the user's text.
- Server actions return `ActionResult` (`{ ok: true, data } | { ok: false, message }`) and never throw to the browser for expected problems. Expected problems throw `UserError` inside the action; anything else becomes a generic message and is logged on the server. Production builds hide thrown messages, so throwing across the boundary is not allowed for new or converted actions.
- Recommender email drafts stay plain text. The app sends no email.
- Row-level rules are unchanged: owner only, `auth.uid() = owner_id`, plus the existing `owner()` check in server actions.
- The TypeScript target has no iterable spread for `Set`/`Map`: use `Array.from`. Do not use regular-expression lookbehind. `params` and `searchParams` are Promises in this Next version.
- Every `localStorage` and clipboard access is in try/catch; pages work without them.
- Fix lint warnings in every file you touch (run `npx next lint --file <file>`); do not add new ones.
- Test data is prefixed `ZZTEMP` and deleted afterwards; real rows are never left changed.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

- Create `lib/action-result.ts`, `tests/lib/action-result.test.ts`, `lib/use-action.ts`, `lib/save-result.ts`.
- Modify `lib/rich-text-server.ts` (+ `tests/lib/rich-text-server.test.ts`): `cleanRichBody`.
- Create `lib/use-rich-autosave.ts`, `components/rich-draft.tsx`.
- Create `supabase/migrations/0018_section_body_version.sql`, `supabase/tests/008_section_body_version.sql`.
- Modify `app/(app)/research/experiment-actions.ts`, `components/writing-board.tsx`, `app/(app)/research/projects/[id]/page.tsx`.
- Modify `app/(app)/research/project-actions.ts`, `components/research-forms.tsx` (journal), `app/(app)/schools/[id]/actions.ts`, `components/school-controls.tsx` (notes), `components/activity-timeline.tsx`, `app/(app)/schools/[id]/page.tsx`, `app/(app)/wins/page.tsx`.
- Modify `app/(app)/materials/statement-actions.ts`, `app/(app)/materials/letter-actions.ts`, `app/(app)/schools/[id]/logistics-actions.ts`, `components/statement-editor.tsx`, `components/statements-list.tsx`, `components/letters-board.tsx`, `components/school-controls.tsx` (letters).
- Modify `lib/letters.ts` (+ tests): `planLetterRequests`; create `components/letter-request-form.tsx`; modify `app/(app)/materials/letters/page.tsx`.
- Create `docs/audits/2026-09-24-new-screens-audit.md`.

---

### Task 1: Shared foundations

**Files:**
- Create: `lib/action-result.ts`, `lib/use-action.ts`, `lib/save-result.ts`, `lib/use-rich-autosave.ts`, `components/rich-draft.tsx`
- Modify: `lib/rich-text-server.ts`
- Test: `tests/lib/action-result.test.ts`, `tests/lib/rich-text-server.test.ts`

**Interfaces:**
- Produces:
  - `lib/action-result.ts`: `type ActionResult<T = void> = { ok: true; data: T } | { ok: false; message: string }`, `class UserError extends Error {}`, `ok<T>(data: T): ActionResult<T>`, `fail(message: string): { ok: false; message: string }`, `toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>>`, `isFailure(r: unknown): r is { ok: false; message: string }`
  - `lib/use-action.ts`: `useAction(): { pending: boolean; error: string | null; run: (fn: () => Promise<unknown>, after?: () => void) => void; setError: (m: string | null) => void }`
  - `lib/save-result.ts`: `type SaveResult = { ok: true; words: number; version: number } | { ok: false; reason: "stale" | "error"; message: string }`
  - `lib/rich-text-server.ts`: `cleanRichBody(stored: string | null | undefined): string | null` (cleaned HTML, or `null` when there is no visible text)
  - `lib/use-rich-autosave.ts`: `useRichAutosave(opts)` (below)
  - `components/rich-draft.tsx`: `RichDraft(props)` (below)

- [ ] **Step 1: Failing tests**

`tests/lib/action-result.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserError, fail, isFailure, ok, toResult } from "@/lib/action-result";

afterEach(() => vi.restoreAllMocks());

describe("toResult", () => {
  it("wraps a value", async () => expect(await toResult(async () => 5)).toEqual({ ok: true, data: 5 }));
  it("passes the message of an expected problem through", async () => {
    expect(await toResult(async () => { throw new UserError("This school already has one."); })).toEqual({ ok: false, message: "This school already has one." });
  });
  it("hides the message of an unexpected error and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await toResult(async () => { throw new Error("relation \"secret\" does not exist"); });
    expect(r).toEqual({ ok: false, message: "Something went wrong. Please try again." });
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("helpers", () => {
  it("builds results", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    expect(fail("no")).toEqual({ ok: false, message: "no" });
  });
  it("recognises a failure result and nothing else", () => {
    expect(isFailure({ ok: false, message: "x" })).toBe(true);
    for (const v of [null, undefined, 0, "x", { ok: true, data: 1 }, { ok: false }, { message: "x" }]) expect(isFailure(v)).toBe(false);
  });
});
```

Add to `tests/lib/rich-text-server.test.ts` (extend the import with `cleanRichBody`):

```ts
describe("cleanRichBody", () => {
  it("returns cleaned HTML for real text", () => expect(cleanRichBody("<p>hi</p><script>x</script>")).toBe("<p>hi</p>"));
  it("converts old plain text", () => expect(cleanRichBody("Hello\n\nWorld")).toBe("<p>Hello</p><p>World</p>"));
  it("returns null when there is nothing to keep", () => {
    for (const v of [null, undefined, "", "   ", "<p></p>", "<p> </p><p><br></p>"]) expect(cleanRichBody(v)).toBeNull();
  });
});
```

Run `npx vitest run tests/lib/action-result.test.ts tests/lib/rich-text-server.test.ts` (expected: FAIL, exports missing).

- [ ] **Step 2: `lib/action-result.ts`**

```ts
// The result every server action returns to the browser. Production builds hide the message of a thrown error, so
// expected problems travel as a result instead. Inside an action, throw UserError for a problem the user can act on.
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; message: string };

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export function isFailure(r: unknown): r is { ok: false; message: string } {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === false && typeof (r as { message?: unknown }).message === "string";
}
```

- [ ] **Step 3: `lib/save-result.ts` and `lib/use-action.ts`**

`lib/save-result.ts`:

```ts
export type SaveResult = { ok: true; words: number; version: number } | { ok: false; reason: "stale" | "error"; message: string };
```

`lib/use-action.ts`:

```ts
"use client";
import { useState, useTransition } from "react";
import { isFailure } from "@/lib/action-result";

// Runs a server action and shows its problem, whether the action returned a failure result or something went wrong
// on the way. Works with actions that return a result and with older ones that return nothing.
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (isFailure(r)) { setError(r.message); return; }
        after?.();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };
  return { pending, error, run, setError };
}
```

- [ ] **Step 4: `cleanRichBody`** (append to `lib/rich-text-server.ts`, importing `htmlToText` from `@/lib/rich-text` alongside `toEditorHtml`)

```ts
// Text from a form or an editor, cleaned for storing. Null when nothing visible is left, so an empty editor never
// saves "<p></p>".
export function cleanRichBody(stored: string | null | undefined): string | null {
  if (!stored || !stored.trim()) return null;
  const clean = sanitizeHtml(toEditorHtml(stored));
  return htmlToText(clean).trim() ? clean : null;
}
```

- [ ] **Step 5: `lib/use-rich-autosave.ts`**

The hook carries the whole plan 1 behaviour, so any long-form text can reuse it. Copy the logic from `components/statement-editor.tsx` (autosave effect with `lastSaved`, `conflict`, `unsaved`, `wroteBackup` refs, the unmount save, `useUnsavedGuard`, the backup restore) into:

```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveResult } from "@/lib/save-result";
import { useDraftBackup } from "@/lib/use-draft-backup";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

export type AutosaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

export function useRichAutosave(opts: {
  kind: string; id: string; initial: string; version: number;
  save: (id: string, html: string, baseVersion: number) => Promise<SaveResult>; delayMs?: number;
}) { /* returns the object described below */ }
```

Required behaviour (all of it, matching the statement editor):
1. State: `text` (starts as `initial`), `setText`, `state: AutosaveState`, `resetKey` (a number the editor uses to accept text set from outside), `words: number | null` (the last saved word count reported by the server).
2. Autosave `delayMs` (default 1500) after the last change. Nothing saves while `text === lastSaved.current`; in that case set `"saved"` and, only if this session wrote a backup (`wroteBackup`), clear it (never touch a backup from an earlier session).
3. Each change writes a crash backup (`useDraftBackup(kind, id, { html: initial, version })`) before the debounce and sets `wroteBackup`.
4. A successful save updates `version`, `lastSaved`, `words`, clears the backup and sets `"saved"` only if the text did not change while saving (otherwise `"dirty"`). A `stale` result sets the conflict state and stops all further saving until reload. Any other failure sets `"error"` and keeps trying on the next change. A thrown/rejected save counts as `"error"`.
5. On unmount, if unsaved and not in conflict, fire one last save with the latest text (ignore the result).
6. `useUnsavedGuard(state !== "saved")`.
7. Returns `{ text, setText, state, resetKey, words, offer, restoreBackup, discardBackup, flush, replace }` where `offer` is the backup offer (or null); `restoreBackup()` puts the backup text in (`setText`, bump `resetKey`) and clears it; `discardBackup()` clears it; `flush(): Promise<boolean>` saves pending text now with the same result handling and resolves whether it is safe (true when already saved); `replace(html, newVersion?)` sets text from outside (bumps `resetKey`; when `newVersion` is given also set `version`, `lastSaved` and `"saved"`, clear conflict and backup).
8. Effects keep stable dependencies; use refs for `save` and the latest text so re-renders do not restart the timer.

- [ ] **Step 6: `components/rich-draft.tsx`**

```tsx
"use client";
import { RichEditorLazy } from "@/components/rich-editor-lazy";
import { htmlToText } from "@/lib/rich-text";
import { countWordsHtml } from "@/lib/rich-text";
import { useRichAutosave } from "@/lib/use-rich-autosave";
import type { SaveResult } from "@/lib/save-result";

export type RichDraftProps = {
  kind: string; id: string; initial: string; version: number; label: string;
  save: (id: string, html: string, baseVersion: number) => Promise<SaveResult>;
  onWords?: (words: number) => void; placeholder?: string; minHeight?: string; variant?: "full" | "compact";
};
```

`RichDraft` uses `useRichAutosave`, renders: the crash-backup banner (`role="status"`, same wording and buttons as the statement editor: "We found changes from {time} on this device that were never saved. Restore them?" with Restore and Discard), the conflict banner (`role="alert"`, same wording, "Copy my text" using `htmlToText`, "Reload" using `window.location.reload()`), the `RichEditorLazy` (`value={text}`, `onChange={(h) => { if (h !== text) setText(h); }}`, `resetKey`, `label`, `variant`, `placeholder`, `minHeight`), and a status row with the word count (`countWordsHtml(text)`) on the left and the save label on the right (`aria-live="polite"`; labels: Saved, Saving…, Unsaved changes, "Not saved: changed elsewhere", "Could not save. Copy your text before leaving."). It calls `onWords?.(countWordsHtml(text))` whenever the text changes (in an effect).

- [ ] **Step 7: Run tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. Lint the new files (`npx next lint --file lib/use-rich-autosave.ts --file components/rich-draft.tsx --file lib/use-action.ts --file lib/action-result.ts`).

- [ ] **Step 8: Commit**

```bash
git add lib/action-result.ts lib/use-action.ts lib/save-result.ts lib/use-rich-autosave.ts lib/rich-text-server.ts components/rich-draft.tsx tests/lib/action-result.test.ts tests/lib/rich-text-server.test.ts
git commit -m "feat: action results, a shared autosave hook and a reusable rich draft"
```

---

### Task 2: Research writing sections on the editor

**Files:**
- Create: `supabase/migrations/0018_section_body_version.sql`, `supabase/tests/008_section_body_version.sql`
- Modify: `app/(app)/research/experiment-actions.ts`, `components/writing-board.tsx`, `app/(app)/research/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `RichDraft`, `SaveResult`, `sanitizeHtml`, `countWordsHtml`, `toEditorHtml`.
- Produces: `research_sections.body_version integer not null default 0`; `saveSectionDraft(id: string, body: string, baseVersion: number): Promise<SaveResult>`; `SectionRow.body_version: number`.

- [ ] **Step 1: Migration and test**

`supabase/migrations/0018_section_body_version.sql`:

```sql
-- Counts saves of a section's text, so two tabs or two people cannot silently overwrite each other.
alter table research_sections add column body_version integer not null default 0 check (body_version >= 0);
```

`supabase/tests/008_section_body_version.sql`:

```sql
select 'section_body_version_column' as name,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'research_sections' and column_name = 'body_version') as ok;
```

- [ ] **Step 2: Action**

In `experiment-actions.ts` replace `saveSectionDraft` (read the file first; keep its existing owner or membership check exactly as it is) with a version that mirrors `saveStatementBody`: clean with `sanitizeHtml(toEditorHtml(body))`, `words = countWordsHtml(clean)`, `update({ body: clean, words, body_version: baseVersion + 1 }).eq("id", id).eq("body_version", baseVersion).select("body_version")`, return a `SaveResult` (never throw: `stale` when no row matched, `error` on a database error). Import `SaveResult` from `@/lib/save-result`. Where the action previously revalidated paths, keep that only if it did so before (autosave must stay cheap).

- [ ] **Step 3: Board and page**

`SectionRow` gains `body_version: number`. In `writing-board.tsx` replace the local `Draft` component (the textarea with its own autosave) with `RichDraft` (`kind="section"`, `id={s.id}`, `initial={s.body}`, `version={s.body_version}`, `save={saveSectionDraft}`, `onWords={setWords}`, `label={`Draft of ${s.name}`}`, `variant="full"`, `minHeight="18rem"`). Remove the now-unused imports and the `useUnsavedGuard`/`countWords` usage if nothing else needs them. The section page query already selects `*`, so `body_version` arrives; make sure the page maps it into the `SectionRow`. Keep the "Notes to self" textarea, status, target, ordering and everything else unchanged.

- [ ] **Step 4: Type-check, test, lint, commit the files**

Run: `npx tsc --noEmit && npx vitest run` and lint the touched files.

```bash
git add supabase/migrations/0018_section_body_version.sql supabase/tests/008_section_body_version.sql "app/(app)/research/experiment-actions.ts" components/writing-board.tsx "app/(app)/research/projects/[id]/page.tsx"
git commit -m "feat: research writing sections use the Word-style editor with safe saves"
```

- [ ] **Step 5: Back up and apply (done by the controller, who holds the production token and has the user's approval to apply migrations for this work)**

```bash
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:backup
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:migrate -- --production
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test
```

Expected: `applied 0018_section_body_version.sql` and `0 failed`.

---

### Task 3: Journal entries and school notes on the editor

**Files:**
- Modify: `app/(app)/research/project-actions.ts`, `components/research-forms.tsx`, `app/(app)/research/projects/[id]/page.tsx`
- Modify: `app/(app)/schools/[id]/actions.ts`, `components/school-controls.tsx`, `components/activity-timeline.tsx`, `app/(app)/schools/[id]/page.tsx`, `app/(app)/wins/page.tsx`

**Interfaces:**
- Consumes: `cleanRichBody`, `renderRich`, `RichEditorLazy` (variant `compact`), `RichHtml`, `htmlToText`, `toEditorHtml`.
- Produces: `EntryRowData.bodyHtml: string | null`; `ActivityTimeline` items may carry `html?: string` for notes.

- [ ] **Step 1: Journal actions and display**

1. In `project-actions.ts`, the entry body (`body: clean(f.body)` in the add and, if present, update paths) must be stored as `cleanRichBody(f.body)` (null when empty) instead of the old plain-text trim. Import from `@/lib/rich-text-server`.
2. In `research-forms.tsx`, the journal form's details area replaces `<textarea name="body">` with `<RichEditorLazy variant="compact" label="Details" placeholder="Details, results, what you'd do next…" value={bodyHtml} onChange={setBodyHtml} resetKey={resetKey} minHeight="8rem" />`; keep the body in component state (`bodyHtml`), pass it as `f.body` when calling the action, and on success reset the state to `""` and bump `resetKey` along with the form reset. The "Log it" button still works without details.
3. `EntryRowData` gains `bodyHtml: string | null`. In `EntryRow`, the expanded text becomes `<RichHtml html={e.bodyHtml} className="text-sm pl-[5.75rem] pt-1" />` (import from `@/components/rich-view`), shown when `e.bodyHtml` is set; the open/close behaviour and the check that decides whether a row can expand use `e.bodyHtml` instead of `e.body`. Keep the `body` field for callers that still pass it or remove it if nothing else uses it.
4. In `research/projects/[id]/page.tsx`, where `EntryRow` data is built, add `bodyHtml: e.body ? renderRich(e.body) : null` (import `renderRich` from `@/lib/rich-text-server`).
5. Anywhere else the journal `body` is displayed as text (search the repo for `.body` on research entries, including copy-update and weekly summary code) must show plain text through `htmlToText(toEditorHtml(body))` instead of the raw string.

- [ ] **Step 2: School notes**

1. `addNote(schoolId, content)` in `schools/[id]/actions.ts`: store `cleanRichBody(content)`; if it is null return a failure (`{ ok: false, message: "Write something first." }`, using `fail` from `@/lib/action-result`); keep the current activity type and revalidation. Type the return as `Promise<ActionResult>`.
2. `NoteForm` in `school-controls.tsx`: replace the textarea with the compact `RichEditorLazy` held in state (`html`, `resetKey`); submit is disabled while `htmlToText(toEditorHtml(html)).trim()` is empty; on success clear the state and bump `resetKey`; show the returned failure message through the shared `useAction` error.
3. `ActivityTimeline` items get an optional `html?: string`; for `type === "note"` with `html`, render `<RichHtml html={a.html} className="text-sm" />` instead of the `whitespace-pre-line` paragraph; all other activity rows stay plain text. In `schools/[id]/page.tsx` map the activity list: `activity.map((a) => (a.type === "note" ? { ...a, html: renderRich(a.content) } : a))`. Check every place `ActivityTimeline` is used (search the repo); if any use is inside a client component, pass pre-rendered `html` from a server parent instead of importing the server-only module there.
4. `wins/page.tsx` shows activity `content` as plain text: wrap it with `htmlToText(toEditorHtml(a.content))` so a note that is a win never shows tags. Do the same anywhere else activity content is shown as text (search for `activity_log` consumers; the home page and weekly page only count rows).

- [ ] **Step 3: Type-check, test, lint**

Run: `npx tsc --noEmit && npx vitest run` and lint every touched file.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/research/project-actions.ts" components/research-forms.tsx "app/(app)/research/projects/[id]/page.tsx" "app/(app)/schools/[id]/actions.ts" components/school-controls.tsx components/activity-timeline.tsx "app/(app)/schools/[id]/page.tsx" "app/(app)/wins/page.tsx"
git commit -m "feat: journal entries and school notes use the compact editor"
```

---

### Task 4: Reliable action errors, and paper email drafts

**Files:**
- Modify: `app/(app)/materials/statement-actions.ts`, `app/(app)/materials/letter-actions.ts`, `app/(app)/schools/[id]/logistics-actions.ts` (letter functions), `components/statement-editor.tsx`, `components/statements-list.tsx`, `components/letters-board.tsx`, `components/school-controls.tsx` (letter parts)

**Interfaces:**
- Consumes: `ActionResult`, `UserError`, `toResult`, `ok`, `fail`, `useAction`, `PaperTextarea`.
- Produces: converted actions returning `ActionResult`: `createStatement(...) => ActionResult<string>`, `updateStatementMeta`, `setStatementStatus`, `saveSnapshot`, `deleteSnapshot`, `deleteStatement` (`ActionResult`), `restoreSnapshot(snapshotId) => ActionResult<{ body: string; words: number; version: number }>`; letter actions `markLettersAsked`, `markLettersReminded`, `setLetterStatus`, `addLetterRequest`, `updateLetterStatus`, `removeLetterRequest` (`ActionResult`). `saveStatementBody` keeps its `SaveResult`.

- [ ] **Step 1: Convert the actions**

For each listed action: keep its body, but wrap it as `return toResult(async () => { ... })`, and inside replace every `throw new Error("<message a person can act on>")` with `throw new UserError("<same message>")`; database errors and anything unexpected are rethrown as they are (they become the generic message and are logged). The unique-violation case in `createStatement` and `updateStatementMeta` (code `23505`) stays a `UserError("This school already has a statement of that type.")`. The `owner()` helpers throw `UserError("Only the workspace owner can change ...")`. `createStatement` returns the new id as data. `restoreSnapshot` returns the object as data. Read each file fully first; do not change behaviour beyond error handling. `saveStatementBody` is already result-based: leave it, but make its own `owner()` failure a `SaveResult` failure (`reason: "error"`) rather than a throw.

- [ ] **Step 2: Convert the callers**

Replace each component's local `useRun` (the copies that catch thrown errors) with the shared `useAction` in: `statement-editor.tsx`, `statements-list.tsx`, `letters-board.tsx`, and the letter-related components in `school-controls.tsx` (`LetterRow`, `AddLetterForm`; if the file's own `useRun` is used by many unrelated components, replace its body with `useAction` so all of them gain the behaviour). Update call sites that use returned data: `statements-list.tsx` reads the `ActionResult<string>` from `createStatement` and navigates only when `ok`, otherwise shows the message; `statement-editor.tsx` uses `restoreSnapshot`'s `ActionResult` (on `ok` apply `data.body`, `data.version` exactly as before; on failure show the message and change nothing). Any `try/catch` around these calls that existed only to show a thrown message can go.

- [ ] **Step 3: Paper email drafts**

In `letters-board.tsx` replace the draft body `<textarea>` with `<PaperTextarea>` (`value`, `onChange`, `rows={12}`, `aria-label="Email body"`), keeping the plain-text behaviour, the subject input, "Open in mail", Copy and the mark buttons unchanged.

- [ ] **Step 4: Type-check, test, lint, commit**

Run: `npx tsc --noEmit && npx vitest run` and lint every touched file.

```bash
git add "app/(app)/materials/statement-actions.ts" "app/(app)/materials/letter-actions.ts" "app/(app)/schools/[id]/logistics-actions.ts" components/statement-editor.tsx components/statements-list.tsx components/letters-board.tsx components/school-controls.tsx
git commit -m "fix: statement and letter actions return results, so their messages survive production; paper email drafts"
```

---

### Task 5: Letter requests from the Letters tab

**Files:**
- Modify: `lib/letters.ts`, `tests/lib/letters.test.ts`, `app/(app)/materials/letter-actions.ts`, `app/(app)/materials/letters/page.tsx`, `components/letters-board.tsx`
- Create: `components/letter-request-form.tsx`

**Interfaces:**
- Consumes: `ActionResult`, `UserError`, `toResult`, `useAction`.
- Produces: `planLetterRequests(existingSchoolIds: string[], schools: Array<{ id: string; deadline_date: string | null }>, chosen: string[], override: string | null): { rows: Array<{ school_id: string; letter_deadline: string | null }>; skipped: number }`; `addLetterRequests(recommenderId: string, schoolIds: string[], deadline: string | null): Promise<ActionResult<{ added: number; skipped: number }>>`; `<LetterRequestForm people schools />`.

- [ ] **Step 1: Failing tests** (add to `tests/lib/letters.test.ts`; extend the import with `planLetterRequests`)

```ts
describe("planLetterRequests", () => {
  const schools = [
    { id: "a", deadline_date: "2026-12-01" },
    { id: "b", deadline_date: null },
    { id: "c", deadline_date: "2026-12-15" },
  ];
  it("uses each school's own deadline unless one is given", () => {
    expect(planLetterRequests([], schools, ["a", "b"], null)).toEqual({
      rows: [{ school_id: "a", letter_deadline: "2026-12-01" }, { school_id: "b", letter_deadline: null }], skipped: 0,
    });
    expect(planLetterRequests([], schools, ["a", "b"], "2026-11-20").rows.map((r) => r.letter_deadline)).toEqual(["2026-11-20", "2026-11-20"]);
  });
  it("skips schools that already have a request from this recommender, and repeats", () => {
    expect(planLetterRequests(["a"], schools, ["a", "c", "c"], null)).toEqual({ rows: [{ school_id: "c", letter_deadline: "2026-12-15" }], skipped: 2 });
  });
  it("ignores unknown school ids", () => {
    expect(planLetterRequests([], schools, ["zzz"], null)).toEqual({ rows: [], skipped: 1 });
  });
});
```

Run (expected FAIL), then add to `lib/letters.ts`:

```ts
// Which letter requests to create for one recommender: one per chosen school, none that already exist, each due on the
// override date or the school's own deadline.
export function planLetterRequests(
  existingSchoolIds: string[],
  schools: Array<{ id: string; deadline_date: string | null }>,
  chosen: string[],
  override: string | null,
): { rows: Array<{ school_id: string; letter_deadline: string | null }>; skipped: number } {
  const have = new Set(existingSchoolIds);
  const byId = new Map(schools.map((s) => [s.id, s]));
  const rows: Array<{ school_id: string; letter_deadline: string | null }> = [];
  let skipped = 0;
  for (const id of chosen) {
    const school = byId.get(id);
    if (!school || have.has(id)) { skipped++; continue; }
    have.add(id);
    rows.push({ school_id: id, letter_deadline: override ?? school.deadline_date });
  }
  return { rows, skipped };
}
```

- [ ] **Step 2: Action**

In `letter-actions.ts` (uses the `owner()` helper and `toResult` from Task 4):

```ts
export async function addLetterRequests(recommenderId: string, schoolIds: string[], deadline: string | null): Promise<ActionResult<{ added: number; skipped: number }>> {
  return toResult(async () => {
    const { supabase, userId } = await owner();
    const chosen = Array.from(new Set(schoolIds)).slice(0, 50);
    if (chosen.length === 0) throw new UserError("Choose at least one school.");
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new UserError("That deadline is not a valid date.");
    const { data: person } = await supabase.from("people").select("id").eq("id", recommenderId).single();
    if (!person) throw new UserError("Recommender not found.");
    const [{ data: existing }, { data: schools }] = await Promise.all([
      supabase.from("letter_requests").select("school_id").eq("recommender_id", recommenderId),
      supabase.from("schools").select("id, deadline_date").in("id", chosen),
    ]);
    const plan = planLetterRequests((existing ?? []).map((r) => r.school_id), (schools ?? []) as Array<{ id: string; deadline_date: string | null }>, chosen, deadline || null);
    if (plan.rows.length > 0) {
      const { error } = await supabase.from("letter_requests").insert(plan.rows.map((r) => ({ ...r, owner_id: userId, recommender_id: recommenderId })));
      if (error) throw error;
    }
    refresh(plan.rows.map((r) => r.school_id));
    return { added: plan.rows.length, skipped: plan.skipped };
  });
}
```

(Import `planLetterRequests` from `@/lib/letters`. Use the file's existing `refresh` helper.)

- [ ] **Step 3: Page and form**

`materials/letters/page.tsx` also loads `people` (`id, name, email`, ordered by name) and `schools` (`id, name, deadline_date, applying`, ordered by name) and passes them to `LettersBoard`, which renders `<LetterRequestForm people={people} schools={schools} />` above the recommender cards (also when there are no letters yet: the empty-state text stays, the form shows). `components/letter-request-form.tsx` (client), a collapsed `<details>` with summary "Request letters":
- a recommender `<select>` (label "Recommender"; if there are no people: the text "Add a recommender on the People page first." with a link to `/people`);
- a school search input (label "Find a school") and a scrollable list (`max-h-56 overflow-auto`) of checkboxes, schools you are applying to first with a small "applying" tag, filtered by the search text (case-insensitive); each school shows its deadline when it has one; schools that this recommender already has a request for (from the letters passed in) are disabled and labelled "already requested" once a recommender is chosen;
- an optional date input (label "Letter deadline for all") with the hint "Leave blank to use each school's own deadline.";
- a submit button "Request letters ({n})" disabled until a recommender and at least one school are chosen; on success show "Added {added} letter request(s){skipped ? `, {skipped} already existed` : ""}.", clear the choices and `router.refresh()`; failures show the message from the shared `useAction` error.

Pass the existing letters into the form (`letters` prop) so it can mark already-requested schools.

- [ ] **Step 4: Type-check, test, lint, commit**

Run: `npx tsc --noEmit && npx vitest run` and lint every touched file.

```bash
git add lib/letters.ts tests/lib/letters.test.ts "app/(app)/materials/letter-actions.ts" "app/(app)/materials/letters/page.tsx" components/letters-board.tsx components/letter-request-form.tsx
git commit -m "feat: request letters from the Letters tab, for one or several schools"
```

---

### Task 6: Audit, polish and full check (run by the controller in the browser)

**Files:** `docs/audits/2026-09-24-new-screens-audit.md` (findings); fixes as needed.

- [ ] **Step 1: Build and start**

Run `npm run build` (must succeed), then start the dev server with the preview tool.

- [ ] **Step 2: Feature checks with `ZZTEMP` data**

- **Writing section:** add a section to a research project, type formatted text, reload (persists), bump `body_version` by query while open then type (conflict banner, text kept), and a backup restore as in plan 1.
- **Journal:** log an entry with formatted details; expand it: formatted text shows; a stored `<script>` in an entry body never runs.
- **Note:** add a school note with a list and bold; the timeline shows it formatted; the wins page shows plain text for a win-flagged note; an old plain-text note still displays.
- **Errors:** try to create a second statement of purpose for a school that has one and confirm the readable message shows in the production build (`npm run build && npm start` on another port, or by calling the action and checking the result object); attempt an action as a signed-out request and confirm no crash.
- **Letters:** request letters for one recommender across three schools (one already requested): the summary reads "Added 2 letter requests, 1 already existed"; each new row uses the school's deadline or the override; the email draft box has the paper look and stays plain text.

- [ ] **Step 3: The audit**

Walk these screens at desktop width and at 375 wide, recording findings in `docs/audits/2026-09-24-new-screens-audit.md` (one line each: screen, what, severity, fixed or deferred): Statements list, Statement editor (all panels), Letters tab, School Application tab, `/week` "Recommenders to chase", writing section, journal form, note form. For each screen check: empty state wording and next action; loading state; error state (force a failure); keyboard order and visible focus; every control has an accessible name; colour contrast of muted text on the dark surface and on paper; touch target size (at least 40 px tall on phone); text wraps with no horizontal page scroll; long names (a 120-character school or recommender name) do not break layout; the unsaved-changes prompt appears only when there are unsaved changes. Fix every defect found (small fixes directly; larger ones by a fix subagent), recording each as fixed.

- [ ] **Step 4: Clean up**

Delete every `ZZTEMP` row (research project, sections, entries, notes, people, letter requests, statements), clear test `localStorage` keys, reset the viewport, stop servers, and confirm with queries that no test rows remain and real rows are unchanged.

- [ ] **Step 5: Final suite and commit**

Run: `npm run typecheck && npm test && SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test && npm run build`
Expected: all pass, `0 failed`. Commit the audit document and every fix with messages describing them.

---

## Acceptance checklist

- [ ] Migration 0018 is applied on production and `db:test` reports `0 failed`.
- [ ] `npm run typecheck`, `npm test` and `npm run build` pass.
- [ ] Research writing sections, journal entries and school notes use the editor; formatting persists; old plain text still displays; nothing unsafe ever runs.
- [ ] Section text has atomic saves, stale-edit protection and crash backup like statements.
- [ ] Statement and letter action problems show readable messages in a production build.
- [ ] Recommender email drafts have the paper look and remain plain text.
- [ ] Letter requests can be added from the Letters tab for one recommender and several schools, without duplicates.
- [ ] The audit document exists and every defect it lists is fixed or explicitly deferred with a reason.
- [ ] No test data remains.

## What comes next

Bring the statement editor onto `useRichAutosave` to remove the duplicated autosave logic; convert the remaining older server actions (schools, tasks, outreach, people) to `ActionResult`; then the roadmap items from the workspaces and teams design (workspaces and roles, project templates, the KACOF team layer, GitHub integration), and the user-owned items (sign-up off, Resend key, deployment).
