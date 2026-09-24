# Statement Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make statements a professional writing tool: a character limit next to the word limit, a metrics line, optional writing hints, focus mode, version comparison, and exports (Word, print to PDF, plain text, portal-safe text).

**Architecture:** Four small pure modules hold the rules (`lib/text-metrics.ts`, `lib/writing-hints.ts`, `lib/word-diff.ts`, additions to `lib/statements.ts`) and are unit-tested. A server-only converter (`lib/statement-docx.ts`, built on the `docx` library and `htmlparser2`) turns the already-cleaned HTML into a real Word file, served by an owner-only route handler. The statement editor gains small components for metrics, hints, version diff and the export bar. Plan 1's editor, sanitizer and saves are unchanged.

**Tech Stack:** Next.js 14 App Router, React 18, TipTap 3 (already installed), `docx` 9, `htmlparser2`, `domhandler`, `jszip` (tests only), Vitest, Supabase, Tailwind.

## Global Constraints

- Statement text is stored as cleaned HTML (plan 1). Everything here reads it through `toEditorHtml`, `htmlToText`, `countWordsHtml` and, on the server, `sanitizeHtml`. `lib/rich-text-server.ts` and `lib/statement-docx.ts` must never be imported from a client component.
- Limit states: neutral under 90 percent of a limit, amber from 90 percent up to the limit, red above it (existing `limitState`). When both a word limit and a character limit are set, the worse state is shown.
- Character counting: visible characters including spaces, with each paragraph break counted as one character; a second figure without any whitespace.
- Writing hints are suggestions only. Nothing is changed automatically and no text is sent anywhere. No AI.
- Word export: Times New Roman 12 pt, 1 inch margins, headings and lists preserved, real hyperlinks, no images.
- The app sends no email.
- Server actions that the editor depends on for conflict handling return result objects instead of throwing (production builds hide thrown messages). New save-related code follows `saveStatementBody`.
- The TypeScript target has no iterable spread for `Set`/`Map`: use `Array.from`. Do not use regular-expression lookbehind. `params` and `searchParams` are Promises in this Next version.
- Test data is prefixed `ZZTEMP` and deleted afterwards; real rows are never left changed.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

- Create `lib/text-metrics.ts`, `lib/writing-hints.ts`, `lib/word-diff.ts` and their tests under `tests/lib/`.
- Modify `lib/statements.ts` (+ `tests/lib/statements.test.ts`): `limitParts`, `worstState`, `exportFileName`, `contentDisposition`.
- Create `supabase/migrations/0017_statement_char_limit.sql`, `supabase/tests/007_statement_char_limit.sql`.
- Modify `app/(app)/materials/statement-actions.ts`, `app/(app)/materials/statements/[id]/page.tsx`.
- Create `lib/statement-docx.ts`, `tests/lib/statement-docx.test.ts`, `app/api/statements/[id]/export/route.ts`; modify `package.json`.
- Create `components/statement-metrics.tsx`, `components/writing-hints-panel.tsx`, `components/version-diff.tsx`, `components/statement-export.tsx`; modify `components/statement-editor.tsx`, `components/rich-editor.tsx` (a `printable` prop), `app/globals.css` (print rules).

---

### Task 1: Pure rules

**Files:**
- Create: `lib/text-metrics.ts`, `lib/writing-hints.ts`, `lib/word-diff.ts`
- Modify: `lib/statements.ts`
- Test: `tests/lib/text-metrics.test.ts`, `tests/lib/writing-hints.test.ts`, `tests/lib/word-diff.test.ts`, `tests/lib/statements.test.ts`

**Interfaces:**
- Consumes: `htmlToText`, `toEditorHtml` from `@/lib/rich-text`; `countWords` from `@/lib/research`; `limitState`, `LimitState` from `@/lib/statements`.
- Produces:
  - `type TextMetrics = { words: number; characters: number; charactersNoSpaces: number; paragraphs: number; readingMinutes: number }`, `textMetrics(stored: string): TextMetrics`
  - `type Hint = { kind: "long_sentence" | "same_start" | "repeated_word"; message: string; example?: string }`, `writingHints(stored: string): Hint[]`
  - `type DiffPart = { type: "same" | "add" | "del"; text: string }`, `wordDiff(before: string, after: string): DiffPart[]`
  - in `lib/statements.ts`: `type LimitPart = { unit: "words" | "characters"; used: number; limit: number; state: LimitState; over: number }`, `limitParts(counts: { words: number; characters: number }, limits: { wordLimit: number | null; charLimit: number | null }): LimitPart[]`, `worstState(parts: Array<{ state: LimitState }>): LimitState`, `exportFileName(title: string, schoolName: string | null, ext: string): string`, `contentDisposition(filename: string): string`

- [ ] **Step 1: Write the failing tests**

`tests/lib/text-metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { textMetrics } from "@/lib/text-metrics";

describe("textMetrics", () => {
  it("is all zero for empty text", () => {
    expect(textMetrics("")).toEqual({ words: 0, characters: 0, charactersNoSpaces: 0, paragraphs: 0, readingMinutes: 0 });
  });
  it("counts words, characters and paragraphs of formatted text", () => {
    const m = textMetrics("<p>Hello <strong>big</strong> world</p><p>Second one</p>");
    expect(m.words).toBe(5);
    expect(m.paragraphs).toBe(2);
    // "Hello big world" (15) + one paragraph break (1) + "Second one" (10)
    expect(m.characters).toBe(26);
    expect(m.charactersNoSpaces).toBe(22);
  });
  it("counts old plain text the same way", () => {
    expect(textMetrics("Hello world.\n\nSecond para").words).toBe(4);
  });
  it("rounds reading time at 200 words a minute, with a one minute floor", () => {
    expect(textMetrics(`<p>${"word ".repeat(10)}</p>`).readingMinutes).toBe(1);
    expect(textMetrics(`<p>${"word ".repeat(450)}</p>`).readingMinutes).toBe(2);
    expect(textMetrics(`<p>${"word ".repeat(1000)}</p>`).readingMinutes).toBe(5);
  });
  it("does not count markup or entities as characters", () => {
    expect(textMetrics("<p>a &amp; b</p>").characters).toBe(5);
  });
});
```

`tests/lib/writing-hints.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { writingHints } from "@/lib/writing-hints";

const sentence = (n: number) => `${Array.from({ length: n }, (_, i) => `w${i}`).join(" ")}.`;

describe("writingHints", () => {
  it("has nothing to say about empty or tidy text", () => {
    expect(writingHints("")).toEqual([]);
    expect(writingHints("<p>I study graphs. My work covers routing. Networks fascinate me. We publish often.</p>")).toEqual([]);
  });
  it("flags a sentence over 40 words but not one of exactly 40", () => {
    expect(writingHints(`<p>${sentence(41)}</p>`).map((h) => h.kind)).toEqual(["long_sentence"]);
    expect(writingHints(`<p>${sentence(40)}</p>`)).toEqual([]);
  });
  it("quotes the start of a long sentence and says how long it is", () => {
    const h = writingHints(`<p>${sentence(45)}</p>`)[0];
    expect(h.message).toContain("45-word");
    expect(h.example?.startsWith("w0 w1 w2")).toBe(true);
  });
  it("flags many sentences starting with the same word", () => {
    const html = "<p>I built a tool. I tested it. I shared the results. Others reviewed them.</p>";
    const h = writingHints(html).find((x) => x.kind === "same_start");
    expect(h?.message).toBe('3 of 4 sentences start with "I".');
  });
  it("needs at least four sentences before judging sentence starts", () => {
    expect(writingHints("<p>I built a tool. I tested it. I shared it.</p>").some((h) => h.kind === "same_start")).toBe(false);
  });
  it("flags a distinctive word repeated three times within two sentences", () => {
    const h = writingHints("<p>The research shaped my research goals. Later research grew.</p>").find((x) => x.kind === "repeated_word");
    expect(h?.message).toBe('"research" is used 3 times within two sentences.');
  });
  it("ignores common and short words", () => {
    expect(writingHints("<p>The team and the group and the lab met. The team and the group and the lab left.</p>").some((h) => h.kind === "repeated_word")).toBe(false);
  });
  it("reports each repeated word once and caps the list", () => {
    const many = Array.from({ length: 20 }, () => sentence(45)).join(" ");
    expect(writingHints(`<p>${many}</p>`).length).toBeLessThanOrEqual(8);
  });
});
```

`tests/lib/word-diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { wordDiff } from "@/lib/word-diff";

describe("wordDiff", () => {
  it("returns one unchanged part for identical text", () => {
    expect(wordDiff("a b c", "a b c")).toEqual([{ type: "same", text: "a b c" }]);
  });
  it("marks removed and added words", () => {
    expect(wordDiff("a b c", "a x c")).toEqual([
      { type: "same", text: "a" }, { type: "del", text: "b" }, { type: "add", text: "x" }, { type: "same", text: "c" },
    ]);
  });
  it("handles insertions and deletions at the ends", () => {
    expect(wordDiff("b c", "a b c d")).toEqual([
      { type: "add", text: "a" }, { type: "same", text: "b c" }, { type: "add", text: "d" },
    ]);
    expect(wordDiff("a b c", "b")).toEqual([{ type: "del", text: "a" }, { type: "same", text: "b" }, { type: "del", text: "c" }]);
  });
  it("ignores differences in whitespace", () => expect(wordDiff("a  b\n\nc", "a b c")).toEqual([{ type: "same", text: "a b c" }]));
  it("handles empty sides", () => {
    expect(wordDiff("", "a b")).toEqual([{ type: "add", text: "a b" }]);
    expect(wordDiff("a b", "")).toEqual([{ type: "del", text: "a b" }]);
    expect(wordDiff("", "")).toEqual([]);
  });
  it("falls back to whole-text replacement for very long inputs instead of freezing", () => {
    const big = (p: string) => Array.from({ length: 3000 }, (_, i) => `${p}${i}`).join(" ");
    const parts = wordDiff(big("a"), big("b"));
    expect(parts.map((p) => p.type)).toEqual(["del", "add"]);
  });
});
```

Add to `tests/lib/statements.test.ts` (extend the existing import list with `contentDisposition`, `exportFileName`, `limitParts`, `worstState`):

```ts
describe("limitParts and worstState", () => {
  it("returns a part for each limit that is set", () => {
    expect(limitParts({ words: 500, characters: 3000 }, { wordLimit: null, charLimit: null })).toEqual([]);
    const parts = limitParts({ words: 460, characters: 5100 }, { wordLimit: 500, charLimit: 5000 });
    expect(parts).toEqual([
      { unit: "words", used: 460, limit: 500, state: "near", over: 0 },
      { unit: "characters", used: 5100, limit: 5000, state: "over", over: 100 },
    ]);
  });
  it("shows the worst state", () => {
    expect(worstState([])).toBe("none");
    expect(worstState([{ state: "ok" }, { state: "near" }])).toBe("near");
    expect(worstState([{ state: "near" }, { state: "over" }, { state: "ok" }])).toBe("over");
  });
});

describe("exportFileName and contentDisposition", () => {
  it("builds a safe file name from the title and school", () => {
    expect(exportFileName("Statement of purpose: MIT", "MIT", "docx")).toBe("Statement of purpose MIT.docx");
    expect(exportFileName("Personal statement", "Yale", "docx")).toBe("Personal statement - Yale.docx");
    expect(exportFileName("Personal statement", null, "docx")).toBe("Personal statement.docx");
    expect(exportFileName('a/b\\c*d?"e', null, "docx")).toBe("a b c d e.docx");
    expect(exportFileName("   ", null, "docx")).toBe("Statement.docx");
    expect(exportFileName("x".repeat(300), null, "docx").length).toBe(125);
  });
  it("gives a header that survives non-ASCII names", () => {
    expect(contentDisposition("Résumé.docx")).toBe(`attachment; filename="R_sum_.docx"; filename*=UTF-8''R%C3%A9sum%C3%A9.docx`);
    expect(contentDisposition('a"b.docx')).toBe(`attachment; filename="ab.docx"; filename*=UTF-8''a%22b.docx`);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/lib/text-metrics.test.ts tests/lib/writing-hints.test.ts tests/lib/word-diff.test.ts tests/lib/statements.test.ts`
Expected: FAIL (modules or exports missing).

- [ ] **Step 3: Write `lib/text-metrics.ts`**

```ts
import { countWords } from "@/lib/research";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";

export type TextMetrics = { words: number; characters: number; charactersNoSpaces: number; paragraphs: number; readingMinutes: number };

// Counts as a portal would: visible characters with spaces, each paragraph break as one character.
export function textMetrics(stored: string): TextMetrics {
  const text = htmlToText(toEditorHtml(stored));
  const words = countWords(text);
  return {
    words,
    characters: text.replace(/\n{2,}/g, "\n").length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    paragraphs: text.split(/\n{2,}/).filter((p) => p.trim()).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / 200)),
  };
}
```

- [ ] **Step 4: Write `lib/writing-hints.ts`**

```ts
import { countWords } from "@/lib/research";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";

export type Hint = { kind: "long_sentence" | "same_start" | "repeated_word"; message: string; example?: string };

const LONG_SENTENCE = 40;
const MAX_HINTS = 8;
const STOP = new Set([
  "about", "after", "again", "against", "before", "being", "between", "could", "every", "first", "great", "their", "there", "these",
  "those", "through", "under", "until", "where", "which", "while", "would", "other", "another", "because", "during", "should", "still",
]);

function sentencesOf(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}
const wordsOf = (s: string) => s.toLowerCase().match(/[a-z0-9'\u2019-]+/g) ?? [];
const snippet = (s: string) => (s.length > 70 ? `${s.slice(0, 70).trimEnd()}…` : s);

// Suggestions only: nothing is changed and nothing leaves the browser.
export function writingHints(stored: string): Hint[] {
  const ss = sentencesOf(htmlToText(toEditorHtml(stored)));
  if (ss.length === 0) return [];
  const hints: Hint[] = [];

  for (const s of ss) {
    const n = countWords(s);
    if (n > LONG_SENTENCE) hints.push({ kind: "long_sentence", message: `A ${n}-word sentence. Consider splitting it.`, example: snippet(s) });
  }

  if (ss.length >= 4) {
    const starts = new Map<string, number>();
    for (const s of ss) {
      const first = wordsOf(s)[0];
      if (first) starts.set(first, (starts.get(first) ?? 0) + 1);
    }
    starts.forEach((count, word) => {
      if (count >= 3 && count / ss.length >= 0.25) {
        const shown = word === "i" ? "I" : word;
        hints.push({ kind: "same_start", message: `${count} of ${ss.length} sentences start with "${shown}".` });
      }
    });
  }

  const reported = new Set<string>();
  for (let i = 0; i < ss.length; i++) {
    const counts = new Map<string, number>();
    for (const w of wordsOf(`${ss[i]} ${ss[i + 1] ?? ""}`)) {
      if (w.length >= 5 && !STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    counts.forEach((count, word) => {
      if (count >= 3 && !reported.has(word)) {
        reported.add(word);
        hints.push({ kind: "repeated_word", message: `"${word}" is used ${count} times within two sentences.` });
      }
    });
  }

  return hints.slice(0, MAX_HINTS);
}
```

- [ ] **Step 5: Write `lib/word-diff.ts`**

```ts
export type DiffPart = { type: "same" | "add" | "del"; text: string };

const MAX_CELLS = 4_000_000;

const tokens = (s: string) => s.split(/\s+/).filter(Boolean);

function push(parts: DiffPart[], type: DiffPart["type"], word: string) {
  const last = parts[parts.length - 1];
  if (last && last.type === type) last.text += ` ${word}`;
  else parts.push({ type, text: word });
}

// A word-level difference (longest common subsequence). Very long inputs are shown as one removal and one addition.
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length === 0 && b.length === 0) return [];
  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) {
    const parts: DiffPart[] = [];
    if (a.length) parts.push({ type: "del", text: a.join(" ") });
    if (b.length) parts.push({ type: "add", text: b.join(" ") });
    return parts;
  }
  const w = b.length + 1;
  const table = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * w + j] = a[i] === b[j] ? table[(i + 1) * w + j + 1] + 1 : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push(parts, "same", a[i]); i++; j++; }
    else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) { push(parts, "del", a[i]); i++; }
    else { push(parts, "add", b[j]); j++; }
  }
  while (i < a.length) push(parts, "del", a[i++]);
  while (j < b.length) push(parts, "add", b[j++]);
  return parts;
}
```

- [ ] **Step 6: Add to `lib/statements.ts`** (append; keep everything already there)

```ts
export type LimitPart = { unit: "words" | "characters"; used: number; limit: number; state: LimitState; over: number };

// One part for each limit that is set, so the editor can show words and characters side by side.
export function limitParts(counts: { words: number; characters: number }, limits: { wordLimit: number | null; charLimit: number | null }): LimitPart[] {
  const parts: LimitPart[] = [];
  if (limits.wordLimit) parts.push({ unit: "words", used: counts.words, limit: limits.wordLimit, state: limitState(counts.words, limits.wordLimit), over: Math.max(0, counts.words - limits.wordLimit) });
  if (limits.charLimit) parts.push({ unit: "characters", used: counts.characters, limit: limits.charLimit, state: limitState(counts.characters, limits.charLimit), over: Math.max(0, counts.characters - limits.charLimit) });
  return parts;
}

const STATE_RANK: Record<LimitState, number> = { none: 0, ok: 1, near: 2, over: 3 };
export const worstState = (parts: Array<{ state: LimitState }>): LimitState =>
  parts.reduce<LimitState>((worst, p) => (STATE_RANK[p.state] > STATE_RANK[worst] ? p.state : worst), "none");

// A file name that is safe on every system and reads well: "Personal statement - Yale.docx".
export function exportFileName(title: string, schoolName: string | null, ext: string): string {
  const base = schoolName && !title.toLowerCase().includes(schoolName.toLowerCase()) ? `${title} - ${schoolName}` : title;
  const clean = base.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120).trim();
  return `${clean || "Statement"}.${ext}`;
}

// A download header with an ASCII fallback and the real name for browsers that understand it.
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  const utf8 = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
```

- [ ] **Step 7: Run all tests and the type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. If an expectation fails, decide whether the code or the test has the mistake: fix the code when it breaks a Global Constraint; fix a test only for a plain arithmetic slip, and say which in the report.

- [ ] **Step 8: Commit**

```bash
git add lib/text-metrics.ts lib/writing-hints.ts lib/word-diff.ts lib/statements.ts tests/lib/text-metrics.test.ts tests/lib/writing-hints.test.ts tests/lib/word-diff.test.ts tests/lib/statements.test.ts
git commit -m "feat: statement metrics, writing hints, word diff, combined limits and export names"
```

---

### Task 2: Character limit

**Files:**
- Create: `supabase/migrations/0017_statement_char_limit.sql`, `supabase/tests/007_statement_char_limit.sql`
- Modify: `app/(app)/materials/statement-actions.ts`, `app/(app)/materials/statements/[id]/page.tsx`, `components/statement-editor.tsx` (details form only in this task)

**Interfaces:**
- Produces: `statements.char_limit integer` (null allowed, positive); `updateStatementMeta(id, f)` accepts `charLimit?: number | null`; `EditorStatement.char_limit: number | null`.

- [ ] **Step 1: Migration and its test**

`supabase/migrations/0017_statement_char_limit.sql`:

```sql
-- Many portals limit characters rather than words, so a statement can carry either limit or both.
alter table statements add column char_limit integer check (char_limit is null or char_limit > 0);
```

`supabase/tests/007_statement_char_limit.sql`:

```sql
select 'statement_char_limit_column' as name,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'statements' and column_name = 'char_limit') as ok;
```

- [ ] **Step 2: Action, page and details form**

1. In `statement-actions.ts`, extend the `updateStatementMeta` parameter type with `charLimit?: number | null` and add after the `wordLimit` line: `if (f.charLimit !== undefined) row.char_limit = f.charLimit && f.charLimit > 0 ? Math.round(f.charLimit) : null;`.
2. In `statements/[id]/page.tsx`, add `char_limit` to the statement select.
3. In `statement-editor.tsx`: `EditorStatement` gains `char_limit: number | null`; add `const [charLimit, setCharLimit] = useState<number | null>(statement.char_limit);`; in the "Details" form add a "Character limit" number input next to "Word limit" (name `charlimit`, min 1, placeholder "No limit"), change the details heading text to "Details: title, type, prompt, limits", and in the submit handler read it (`const cl = Number(v("charlimit")) || null;`), pass `charLimit: cl` to `updateStatementMeta`, and on success `setCharLimit(cl)`. (Displaying it is Task 4.)

- [ ] **Step 3: Type-check and run the tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 4: Commit the files**

```bash
git add supabase/migrations/0017_statement_char_limit.sql supabase/tests/007_statement_char_limit.sql "app/(app)/materials/statement-actions.ts" "app/(app)/materials/statements/[id]/page.tsx" components/statement-editor.tsx
git commit -m "feat: statements can carry a character limit"
```

- [ ] **Step 5: Back up and apply (done by the controller, who holds the production token and has the user's approval to apply migrations for this work)**

```bash
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:backup
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:migrate -- --production
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test
```

Expected: `applied 0017_statement_char_limit.sql` and `0 failed`.

---

### Task 3: Word export

**Files:**
- Create: `lib/statement-docx.ts`, `tests/lib/statement-docx.test.ts`, `app/api/statements/[id]/export/route.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `sanitizeHtml`, `toEditorHtml`, `exportFileName`, `contentDisposition`, `OWNER_USER_ID`, `createClient`.
- Produces: `buildDocx(html: string, opts: { title: string }): Promise<Buffer>` (server-only); route `GET /api/statements/[id]/export` returning the `.docx` (owner only; 404 otherwise).

- [ ] **Step 1: Install**

```bash
npm install docx htmlparser2 domhandler
npm install --save-dev jszip
```

Then read `node_modules/docx/build/index.d.ts` (or the package's typings entry) and confirm the names used below exist in the installed version: `Document`, `Packer`, `Paragraph`, `TextRun`, `ExternalHyperlink`, `HeadingLevel`, `AlignmentType` (with `LEFT`, `CENTER`, `RIGHT` and the justified member, which may be `JUSTIFIED` or `BOTH`), `BorderStyle`, `LevelFormat`, and the paragraph `numbering: { reference, level, instance }` option. If a name differs, use the installed one and say so in the report.

- [ ] **Step 2: Write the failing tests**

`tests/lib/statement-docx.test.ts`:

```ts
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocx } from "@/lib/statement-docx";

async function parts(html: string) {
  const zip = await JSZip.loadAsync(await buildDocx(html, { title: "T" }));
  const read = async (p: string) => (await zip.file(p)?.async("string")) ?? "";
  const doc = await read("word/document.xml");
  return {
    doc,
    styles: await read("word/styles.xml"),
    numbering: await read("word/numbering.xml"),
    rels: await read("word/_rels/document.xml.rels"),
    text: (doc.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("|"),
  };
}

describe("buildDocx", () => {
  it("writes the text of each paragraph in order", async () => {
    expect((await parts("<p>First paragraph</p><p>Second one</p>")).text).toBe("First paragraph|Second one");
  });
  it("keeps inline formatting", async () => {
    const { doc } = await parts("<p><strong>b</strong><em>i</em><u>u</u><s>s</s></p>");
    expect(doc).toMatch(/<w:b\b/);
    expect(doc).toMatch(/<w:i\b/);
    expect(doc).toMatch(/<w:u\b/);
    expect(doc).toMatch(/<w:strike\b/);
  });
  it("uses heading styles and alignment", async () => {
    const { doc } = await parts('<h2 style="text-align:center">Title</h2><p style="text-align:right">r</p>');
    expect(doc).toContain('<w:pStyle w:val="Heading2"/>');
    expect(doc).toContain('<w:jc w:val="center"/>');
    expect(doc).toContain('<w:jc w:val="right"/>');
  });
  it("turns lists into numbered paragraphs, including nested ones", async () => {
    const { doc, numbering, text } = await parts("<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul><ol><li><p>first</p></li></ol>");
    expect((doc.match(/<w:numPr>/g) ?? []).length).toBe(4);
    expect(numbering.length).toBeGreaterThan(0);
    expect(text).toBe("one|nested|two|first");
  });
  it("makes real hyperlinks", async () => {
    const { doc, rels } = await parts('<p>see <a href="https://example.com/x">the site</a></p>');
    expect(doc).toContain("<w:hyperlink");
    expect(rels).toContain("https://example.com/x");
  });
  it("keeps quotes and dividers", async () => {
    const { text, doc } = await parts("<blockquote><p>quoted</p></blockquote><hr><p>after</p>");
    expect(text).toBe("quoted|after");
    expect(doc).toContain("<w:pBdr>");
  });
  it("never writes script or style content", async () => {
    const { text } = await parts("<p>safe</p><script>alert(1)</script><style>p{}</style>");
    expect(text).toBe("safe");
  });
  it("sets Times New Roman 12 pt and one inch margins", async () => {
    const { doc, styles } = await parts("<p>x</p>");
    expect(styles).toContain("Times New Roman");
    expect(styles).toMatch(/<w:sz w:val="24"\/>/);
    expect(doc).toMatch(/<w:pgMar[^>]*w:top="1440"/);
    expect(doc).toMatch(/<w:pgMar[^>]*w:left="1440"/);
  });
  it("makes a valid file from empty text", async () => {
    const { doc } = await parts("");
    expect(doc).toContain("<w:body>");
  });
  it("starts with the zip signature", async () => {
    const buf = await buildDocx("<p>x</p>", { title: "T" });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});
```

Run: `npx vitest run tests/lib/statement-docx.test.ts` (expected: FAIL, module not found).

- [ ] **Step 3: Write `lib/statement-docx.ts`**

```ts
import { isTag, isText, type ChildNode, type Element } from "domhandler";
import { parseDocument } from "htmlparser2";
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun, type ParagraphChild,
} from "docx";

// Server-only: turns already-cleaned statement HTML into a real Word file (Times New Roman 12 pt, 1 inch margins).
// The HTML is expected to come from sanitizeHtml, so only the tags the editor can produce are handled.

const FONT = "Times New Roman";
const LEVELS = 4;

type Fmt = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean; link?: boolean };
type Desc = {
  runs: ParagraphChild[]; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; heading?: 1 | 2 | 3;
  level?: number; ordered?: boolean; listId?: number; bullet?: boolean; quote?: boolean; rule?: boolean;
};

function alignOf(el: Element) {
  const m = /text-align:\s*(left|center|right|justify)/i.exec(el.attribs.style ?? "");
  if (!m) return undefined;
  const v = m[1].toLowerCase();
  return v === "center" ? AlignmentType.CENTER : v === "right" ? AlignmentType.RIGHT : v === "justify" ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;
}

const run = (text: string, f: Fmt) =>
  new TextRun({
    text, font: FONT, bold: f.bold, italics: f.italics, strike: f.strike,
    underline: f.underline || f.link ? {} : undefined, color: f.link ? "0563C1" : undefined,
  });

function inline(nodes: ChildNode[], f: Fmt): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const n of nodes) {
    if (isText(n)) { if (n.data) out.push(run(n.data, f)); continue; }
    if (!isTag(n) || n.name === "script" || n.name === "style") continue;
    if (n.name === "strong" || n.name === "b") out.push(...inline(n.children, { ...f, bold: true }));
    else if (n.name === "em" || n.name === "i") out.push(...inline(n.children, { ...f, italics: true }));
    else if (n.name === "u") out.push(...inline(n.children, { ...f, underline: true }));
    else if (n.name === "s") out.push(...inline(n.children, { ...f, strike: true }));
    else if (n.name === "br") out.push(new TextRun({ break: 1, font: FONT }));
    else if (n.name === "a" && n.attribs.href) {
      const kids = inline(n.children, { ...f, link: true }).filter((c): c is TextRun => c instanceof TextRun);
      if (kids.length) out.push(new ExternalHyperlink({ link: n.attribs.href, children: kids }));
    } else out.push(...inline(n.children, f));
  }
  return out;
}

let listCounter = 0;

function blocks(nodes: ChildNode[], ctx: { level: number; ordered: boolean; listId: number; inList: boolean; quote: boolean }): Desc[] {
  const out: Desc[] = [];
  const base = { level: ctx.inList ? ctx.level : undefined, ordered: ctx.ordered, listId: ctx.listId, quote: ctx.quote };
  for (const n of nodes) {
    if (isText(n)) {
      if (n.data.trim()) out.push({ ...base, runs: [run(n.data, {})] });
      continue;
    }
    if (!isTag(n) || n.name === "script" || n.name === "style") continue;
    if (n.name === "p") out.push({ ...base, runs: inline(n.children, {}), align: alignOf(n) });
    else if (n.name === "h1" || n.name === "h2" || n.name === "h3") out.push({ runs: inline(n.children, {}), align: alignOf(n), heading: Number(n.name[1]) as 1 | 2 | 3 });
    else if (n.name === "ul" || n.name === "ol") {
      const listId = ++listCounter;
      const level = ctx.inList ? Math.min(ctx.level + 1, LEVELS - 1) : 0;
      for (const li of n.children.filter(isTag).filter((c) => c.name === "li")) {
        const own = blocks(li.children, { level, ordered: n.name === "ol", listId, inList: true, quote: false });
        const first = own.find((d) => d.level === level && !d.rule);
        if (first) first.bullet = true;
        out.push(...own);
      }
    } else if (n.name === "blockquote") out.push(...blocks(n.children, { ...ctx, quote: true }));
    else if (n.name === "hr") out.push({ runs: [], rule: true });
    else if (n.name === "br") continue;
    else out.push(...blocks(n.children, ctx));
  }
  return out;
}

function toParagraph(d: Desc): Paragraph {
  if (d.rule) return new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } }, spacing: { after: 160 } });
  const level = d.level ?? 0;
  return new Paragraph({
    children: d.runs,
    heading: d.heading ? [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][d.heading - 1] : undefined,
    alignment: d.align,
    numbering: d.bullet ? { reference: d.ordered ? "number" : "bullet", level, ...(d.ordered ? { instance: d.listId } : {}) } : undefined,
    indent: d.level !== undefined && !d.bullet ? { left: 720 * (level + 1) } : d.quote ? { left: 720 } : undefined,
    spacing: { after: d.level !== undefined ? 60 : 160, line: 276 },
  });
}

const levelsFor = (format: (typeof LevelFormat)[keyof typeof LevelFormat], text: (l: number) => string) =>
  Array.from({ length: LEVELS }, (_, level) => ({
    level, format, text: text(level), alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));

export async function buildDocx(html: string, opts: { title: string }): Promise<Buffer> {
  listCounter = 0;
  const descs = blocks(parseDocument(html).children, { level: 0, ordered: false, listId: 0, inList: false, quote: false });
  const paragraphs = descs.length ? descs.map(toParagraph) : [new Paragraph({ children: [] })];
  const doc = new Document({
    title: opts.title,
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
      paragraphStyles: [1, 2, 3].map((n) => ({
        id: `Heading${n}`, name: `Heading ${n}`, basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: [32, 28, 24][n - 1], bold: true, color: "000000" },
        paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
      })),
    },
    numbering: {
      config: [
        { reference: "bullet", levels: levelsFor(LevelFormat.BULLET, (l) => ["\u2022", "\u25E6", "\u25AA", "\u2022"][l]) },
        { reference: "number", levels: levelsFor(LevelFormat.DECIMAL, (l) => `%${l + 1}.`) },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: paragraphs }],
  });
  return Packer.toBuffer(doc);
}
```

If the installed `docx` typings reject any of these (for example the type of `numbering` or `LevelFormat` members), adjust to the installed API while keeping the behaviour the tests check.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/lib/statement-docx.test.ts && npx tsc --noEmit`
Expected: all pass. If a test fails because the installed library writes an equivalent but differently spelled element (for example `<w:jc w:val="right"/>` vs `<w:jc w:val="end"/>`), adjust the assertion to the real, equivalent output and say so; never drop what the test verifies (formatting present, text in order, no script content, font and margins).

- [ ] **Step 5: Route handler**

`app/api/statements/[id]/export/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { sanitizeHtml } from "@/lib/rich-text-server";
import { toEditorHtml } from "@/lib/rich-text";
import { buildDocx } from "@/lib/statement-docx";
import { contentDisposition, exportFileName } from "@/lib/statements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = () => new Response("Not found", { status: 404 });

// Owner only. Anyone else, signed in or not, gets the same 404 so the route reveals nothing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) return NOT_FOUND();
  const { data: st } = await supabase.from("statements").select("title, body, school_id").eq("id", id).single();
  if (!st) return NOT_FOUND();
  let schoolName: string | null = null;
  if (st.school_id) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", st.school_id).single();
    schoolName = school?.name ?? null;
  }
  const buf = await buildDocx(sanitizeHtml(toEditorHtml(st.body)), { title: st.title });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": contentDisposition(exportFileName(st.title, schoolName, "docx")),
      "Cache-Control": "no-store",
    },
  });
}
```

Confirm `middleware.ts` lets a signed-in session through `/api/statements/...` (it only exempts `/api/digest` and `/api/health` from the sign-in redirect, so this route is behind sign-in like every other page). Do not add it to the exemptions.

- [ ] **Step 6: Type-check, test, commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

```bash
git add package.json package-lock.json lib/statement-docx.ts tests/lib/statement-docx.test.ts "app/api/statements/[id]/export/route.ts"
git commit -m "feat: download a statement as a real Word file"
```

---

### Task 4: Editor tools

**Files:**
- Create: `components/statement-metrics.tsx`, `components/writing-hints-panel.tsx`, `components/version-diff.tsx`, `components/statement-export.tsx`
- Modify: `components/statement-editor.tsx`, `components/rich-editor.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `textMetrics`, `writingHints`, `wordDiff`, `limitParts`, `worstState`, `htmlToText`, `portalText`, `toEditorHtml`, plus the existing editor state.
- Produces: `StatementMetrics({ text, wordLimit, charLimit })`; `WritingHintsPanel({ text })`; `VersionDiff({ before, after })` (both are stored strings); `StatementExport({ statementId, text, beforeExport })` where `beforeExport(): Promise<boolean>` saves pending text and resolves true when it is safe to export; `RichEditor` gains `printable?: boolean`.

- [ ] **Step 1: `StatementMetrics`** (client component)

Shows, from `textMetrics(text)` and `limitParts`: for each limit that is set, `{used} of {limit} {unit}` in the tone of its state (neutral `text-gray-400`, near `text-brass`, over `text-red-600`), with ` · {n} over` when over and ` · close to the limit` when near (same wording as today's word line); when no limit is set, `{words} words`. Then a muted line: `{characters} characters · {charactersNoSpaces} without spaces · {paragraphs} paragraph(s) · about {readingMinutes} min read` (omit the reading time when 0 words). Use `font-mono text-xs` like the current count line. It replaces the current word-count line in the editor.

- [ ] **Step 2: `WritingHintsPanel`** (client component)

A collapsed `<details>` with summary "Writing hints" and a count badge when there are any. Inside: the list from `writingHints(text)`, each as its message with an optional quoted example in muted text; when empty: "Nothing to flag. These checks look for very long sentences, many sentences starting the same way, and repeated words." A line under the list: "Suggestions only. Nothing is changed for you." Compute with `useDeferredValue(text)` so typing stays responsive.

- [ ] **Step 3: `VersionDiff`** (client component)

Renders `wordDiff(htmlToText(toEditorHtml(before)), htmlToText(toEditorHtml(after)))` as inline text: unchanged words normal, removed words `<del>` with red strike-through, added words `<ins>` with a teal highlight (use the theme's `text-red-600` / `text-teal-600` and a subtle background). A legend: "From this version to your current text: struck-through words were removed, highlighted words were added." Counts: "{n} words removed, {m} added". When there are no changes: "This version matches your current text." Long output scrolls (`max-h-72 overflow-auto`).

- [ ] **Step 3b: `StatementExport`** (client component)

An "Export" row of buttons:
- "Download Word (.docx)": `await beforeExport()`; if it returns true, navigate to `/api/statements/${statementId}/export` by clicking a temporary anchor (so the browser downloads without leaving the page); otherwise show "Save failed, so the download was not started."
- "Print or save as PDF": `await beforeExport()`, then `window.print()`.
- "Copy as plain text": `htmlToText(toEditorHtml(text))` to the clipboard, in try/catch, label changes to "Copied" for 2 seconds; failure shows "Copy failed, select the text and copy it yourself."
- "Copy for a portal": `portalText(text, { straightQuotes })` with a checkbox "Use straight quotes" remembered in `localStorage` under `portal-straight-quotes` (every access in try/catch; the page must work without storage), same copied/failed feedback, and a muted note: "Plain text with single blank lines between paragraphs, ready to paste into an application form."

- [ ] **Step 4: Print styles and the `printable` prop**

In `components/rich-editor.tsx` add the optional prop `printable?: boolean` (in `RichEditorProps`) and add the class `statement-print` to the `paper-page` div when it is true. In `app/globals.css` append:

```css
/* Printing a statement: only the page text, in a plain document style. Other pages print normally. */
@media print {
  body:has(.statement-print) * { visibility: hidden; }
  body:has(.statement-print) .statement-print, body:has(.statement-print) .statement-print * { visibility: visible; }
  body:has(.statement-print) .statement-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
  .statement-print .paper-content { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.4; color: #000; min-height: 0 !important; }
  .statement-print .paper-content a { color: #000; text-decoration: none; }
}
```

- [ ] **Step 5: Wire everything into `statement-editor.tsx`**

1. Import the four components, `textMetrics` is used inside `StatementMetrics`. Pass `printable` to the `RichEditorLazy` (`RichEditorLazy` takes the same props as `RichEditor`, so no change beyond the new prop).
2. Replace the word-count `<span>` with `<StatementMetrics text={text} wordLimit={limit} charLimit={charLimit} />`; keep the save-state label on the right. Remove the now-unused `limitState`, `COUNT_TONE`, `words`, `state` if nothing else uses them, and keep `countWordsHtml` only if still used.
3. Prompt: change the prompt section into a `<details open>` with summary "The prompt" so it can be collapsed while writing.
4. Focus mode: a "Focus mode" button beside the save label toggles `focus` state. When on, the editor `<section>` gets the classes `fixed inset-0 z-50 bg-ink overflow-auto p-4 md:px-[12%] md:py-8` (the same element, so the editor instance and its undo history stay), a slim status line stays visible, and an "Exit focus mode" button is shown at the top right; pressing Escape inside the text area also exits. The rest of the page is simply covered. The metrics and save label remain visible.
5. `<WritingHintsPanel text={text} />` directly under the metrics line.
6. Versions: each version row gets a "Compare" button beside View/Restore that toggles an inline `<VersionDiff before={s.body} after={text} />` under the row (only one of View or Compare open at a time per row is fine; both may be open).
7. Export: `<StatementExport statementId={statement.id} text={text} beforeExport={flushSave} />` placed in its own section "Export" above "Versions". `flushSave` is a new function in the editor: if `text` equals `lastSaved.current` resolve true; if in conflict resolve false; otherwise call `saveStatementBody(statement.id, latest.current, version.current)`, apply the result exactly as the autosave does (on success update `version`, `lastSaved`, `unsaved`, `saveState`, clear the backup; on stale set conflict; on other failure set error) and resolve whether it succeeded.
8. Keep all plan 1 behaviour (autosave, conflict and backup banners, versions, restore).

- [ ] **Step 6: Type-check, test, lint**

Run: `npx tsc --noEmit && npx vitest run` and `npx next lint --file components/statement-editor.tsx --file components/statement-metrics.tsx --file components/writing-hints-panel.tsx --file components/version-diff.tsx --file components/statement-export.tsx --file components/rich-editor.tsx`
Expected: clean (fix new lint errors; warnings that were already there may stay).

- [ ] **Step 7: Commit**

```bash
git add components/statement-metrics.tsx components/writing-hints-panel.tsx components/version-diff.tsx components/statement-export.tsx components/statement-editor.tsx components/rich-editor.tsx app/globals.css
git commit -m "feat: statement metrics, hints, focus mode, version compare and export bar"
```

---

### Task 5: End-to-end check in the browser

**Files:** none (verification only). Create `ZZTEMP` data, then delete it.

- [ ] **Step 1: Build and start**

Run `npm run build` (it must succeed, including the new route), then start the dev server with the preview tool.

- [ ] **Step 2: Limits and metrics**

Create a `ZZTEMP` general statement by query (kind `other`, empty body). In the editor type about 12 words. Open "Details", set the word limit to 10 and the character limit to 200, save details. Expected: the line shows `12 of 10 words · 2 over` in red and `{n} of 200 characters`; set the word limit to 13: amber "close to the limit"; set 100 and 100 characters: neutral. The muted line shows characters, characters without spaces, paragraphs and reading time; with a second paragraph the paragraph count becomes 2.

- [ ] **Step 3: Writing hints**

Type four short sentences, three starting with "I": the "Writing hints" panel shows a count and the message `3 of 4 sentences start with "I".`; type a 45-word sentence: a long-sentence hint appears with a quoted start; repeat a distinctive word three times in two sentences: the repeated-word hint appears. Clear the text: "Nothing to flag".

- [ ] **Step 4: Focus mode**

Turn focus mode on: the editor fills the screen over the page, the toolbar and text still work, typing keeps saving, Escape and the "Exit focus mode" button return to the normal page with the same text and undo history (Ctrl+Z still undoes the last typed change).

- [ ] **Step 5: Compare**

Save a version, change some words, press "Compare" on the version: removed words appear struck through, added words highlighted, counts match; with no changes it says the version matches.

- [ ] **Step 6: Exports**

- Copy as plain text and Copy for a portal: override `navigator.clipboard.writeText` to capture the string; check paragraphs are separated by one blank line, list items start with `- `, and with "Use straight quotes" ticked curly quotes become straight.
- Print: override `window.print` to record the call and confirm the export bar's "Print or save as PDF" waits for a pending save first.
- Word: with formatted text in the statement (heading, bold, list, link), click "Download Word (.docx)" with `fetch` instead of navigation to inspect it: `GET /api/statements/<id>/export` returns status 200, `Content-Type` `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, a `Content-Disposition` attachment header with a sensible file name, and a body starting with `PK`. Encode the body as base64, return it from the page, decode it in a Node script (`ctx_execute`), open it with JSZip (`npm` package `jszip` is installed) and confirm `word/document.xml` contains the statement's text, a Heading style, bold, a list `numPr` and the hyperlink, and `word/styles.xml` names Times New Roman. Also `fetch` the same URL with the session cookie removed (a request from Node without cookies) and confirm it is refused (redirect to sign-in or 404), never a file.

- [ ] **Step 7: Phone width**

At width 375: the metrics lines wrap without horizontal scroll, the export buttons wrap, focus mode fits and can be exited, and the hints panel is readable. Take one screenshot at 375 and one at desktop width.

- [ ] **Step 8: Clean up**

Delete every `ZZTEMP` statement (and its versions), clear `draft:` and `portal-straight-quotes` keys from `localStorage`, reset the viewport, stop the server, and confirm with a query that `statements` and `statement_snapshots` contain no test rows and the user's real rows are unchanged.

- [ ] **Step 9: Final suite and commit any fixes**

Run: `npm run typecheck && npm test && SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test && npm run build`
Expected: all pass, `0 failed`. Commit any defect fixed during the browser check with a message describing it.

---

## Acceptance checklist

- [ ] Migration 0017 is applied on production and `db:test` reports `0 failed`.
- [ ] `npm run typecheck`, `npm test` and `npm run build` pass.
- [ ] A statement can carry a word limit, a character limit, or both; the worse state shows, with over and near wording.
- [ ] The metrics line shows words, characters (with and without spaces), paragraphs and reading time.
- [ ] Writing hints flag very long sentences, sentences starting the same way, and repeated words, and change nothing.
- [ ] Focus mode works without losing text or undo history.
- [ ] A saved version can be compared with the current text in a word-level view.
- [ ] Word export produces a real .docx (Times New Roman 12 pt, 1 inch margins, headings, lists, links) that only the owner can download; print, plain-text copy and portal-safe copy work, and exports wait for a pending save.
- [ ] No test data remains.

## What comes next

Plan 3 (rollout and polish): research writing sections, journal entries and school notes on the editor; the paper textarea for recommender email drafts; Letters additions (add a request from the Letters tab, one recommender for several schools); an audit of the new screens at phone and desktop widths with fixes; results-object error handling for the older statement and letter actions; and lint clean-up in touched files.
