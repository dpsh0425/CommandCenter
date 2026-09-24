# Recommender Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track when each recommender was asked and reminded, flag the letters that need chasing, draft the request, reminder and thank-you emails for the owner to send, and list "Recommenders to chase" on the weekly page and in the Monday email.

**Architecture:** Four new date and count columns on `letter_requests` (migration 0015). All rules (flags, load, email text, `mailto` links, date updates) live in one pure module `lib/letters.ts` with unit tests. A loader turns rows into plain records; a Letters tab under Materials renders one card per recommender; the school Application tab, the weekly page and the digest reuse the same pure functions. The app sends no email: it drafts, and the owner sends from their own mail.

**Tech Stack:** Next.js 14 App Router, Supabase Postgres with row-level security, Vitest, Tailwind (existing theme).

## Global Constraints

- Owner-only data, using the existing rule `auth.uid() = owner_id`; server actions call an `owner()` check like `statement-actions.ts`.
- The app never sends email. `mailto:` links and Copy only.
- Needs reminder: status `asked`, and the last contact (`last_reminded_on`, else `asked_on`) is 10 or more days ago, OR the deadline is 0 to 14 days away.
- Not yet asked: status `not_asked`, deadline 0 to 45 days away.
- Overdue: deadline passed and status not `submitted`.
- Heavy load: 6 or more letters that are not `submitted`.
- `mailto:` link is used only when the whole URL is at most 1800 characters and the recommender has an email; otherwise show Copy only.
- Test data is prefixed `ZZTEMP` and deleted afterwards. Real rows are never changed except through a test that is undone.
- The TypeScript target has no iterable-spread for `Set`/`Map`: use `Array.from`.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

- Create `supabase/migrations/0015_letter_tracking.sql`, `supabase/tests/005_letter_tracking.sql`
- Create `lib/letters.ts`, `tests/lib/letters.test.ts`: all pure rules
- Create `lib/letters-data.ts`: loader returning `LetterRecord[]`
- Create `app/(app)/materials/letter-actions.ts`: server actions
- Modify `app/(app)/schools/[id]/logistics-actions.ts`: `updateLetterStatus` records dates
- Create `components/letters-board.tsx`, `app/(app)/materials/letters/page.tsx`; modify `components/ui.tsx` (`MATERIALS_TABS`)
- Modify `components/school-controls.tsx` (`LetterRow`), `app/(app)/schools/[id]/page.tsx`
- Modify `app/(app)/week/page.tsx`, `lib/digest.ts`

---

### Task 1: Database columns

**Files:**
- Create: `supabase/migrations/0015_letter_tracking.sql`
- Create: `supabase/tests/005_letter_tracking.sql`

**Interfaces:**
- Produces: `letter_requests.asked_on date`, `last_reminded_on date`, `reminder_count integer not null default 0`, `received_on date`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0015_letter_tracking.sql`:

```sql
-- Track when each recommender was asked and reminded, so the app can say who to chase.
alter table letter_requests
  add column asked_on date,
  add column last_reminded_on date,
  add column reminder_count integer not null default 0 check (reminder_count >= 0),
  add column received_on date;

-- Letters already marked as asked or later have no recorded date; use the day the request was created.
update letter_requests
   set asked_on = created_at::date
 where status <> 'not_asked' and asked_on is null;
update letter_requests
   set received_on = updated_at::date
 where status = 'submitted' and received_on is null;
```

- [ ] **Step 2: Write the database test**

`supabase/tests/005_letter_tracking.sql`:

```sql
select 'letter_tracking_columns' as name,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'letter_requests'
           and column_name in ('asked_on', 'last_reminded_on', 'reminder_count', 'received_on')) = 4 as ok;
```

- [ ] **Step 3: Commit the files**

```bash
git add supabase/migrations/0015_letter_tracking.sql supabase/tests/005_letter_tracking.sql
git commit -m "feat: track when recommenders were asked and reminded"
```

- [ ] **Step 4: Back up and apply (done by the controller, who holds the production token)**

```bash
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:backup
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:migrate -- --production
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test
```

Expected: `applied 0015_letter_tracking.sql` and `0 failed`.

---

### Task 2: Pure rules

**Files:**
- Create: `lib/letters.ts`
- Test: `tests/lib/letters.test.ts`

**Interfaces:**
- Produces (used by Tasks 3 to 6):
  - `LETTER_STATUSES`, `type LetterStatus`, `isLetterStatus(s: string): s is LetterStatus`
  - `type LetterRecord = { id; school_id; school_name; recommender_id: string | null; recommender_name; recommender_email: string | null; status: LetterStatus; letter_deadline: string | null; asked_on: string | null; last_reminded_on: string | null; reminder_count: number; received_on: string | null }`
  - `type ChaseInput = Pick<LetterRecord, "id" | "school_id" | "school_name" | "recommender_id" | "recommender_name" | "status" | "letter_deadline" | "asked_on" | "last_reminded_on">`
  - `daysBetween(from: string, to: string): number`
  - `type LetterFlag = "overdue" | "needs_reminder" | "not_asked"`, `FLAG_LABEL`, `letterFlags(l, today): LetterFlag[]`
  - `chaseReason(l: ChaseInput, flag: LetterFlag, today: string): string`
  - `lettersToChase(list: ChaseInput[], today: string): Array<{ letter: ChaseInput; flag: LetterFlag; reason: string }>`
  - `HEAVY_LOAD`, `openLetterCount(list): number`
  - `type RecommenderGroup`, `groupByRecommender(list: LetterRecord[], today: string): RecommenderGroup[]`
  - `type EmailDraft = { subject: string; body: string }`, `buildRequestEmail`, `buildReminderEmail`, `buildThankYouEmail` (each `(recommenderName: string, letters: Array<Pick<LetterRecord, "school_name" | "letter_deadline">>, sender: string) => EmailDraft`)
  - `MAILTO_MAX`, `mailtoUrl(email: string | null, d: EmailDraft): string | null`
  - `letterStatusChange(next, today, cur)`, `askedUpdate(cur, today)`, `remindedUpdate(cur, today)`

- [ ] **Step 1: Write the failing tests**

`tests/lib/letters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  askedUpdate, buildReminderEmail, buildRequestEmail, buildThankYouEmail, chaseReason, daysBetween, groupByRecommender,
  isLetterStatus, letterFlags, letterStatusChange, lettersToChase, mailtoUrl, openLetterCount, remindedUpdate,
  type LetterRecord,
} from "@/lib/letters";

const TODAY = "2026-10-20";
const base: LetterRecord = {
  id: "l1", school_id: "s1", school_name: "MIT", recommender_id: "r1", recommender_name: "Dr. Rao", recommender_email: "rao@uni.edu",
  status: "asked", letter_deadline: null, asked_on: null, last_reminded_on: null, reminder_count: 0, received_on: null,
};
const L = (o: Partial<LetterRecord>): LetterRecord => ({ ...base, ...o });

describe("daysBetween", () => {
  it("counts whole days, forwards and back", () => {
    expect(daysBetween("2026-10-20", "2026-10-30")).toBe(10);
    expect(daysBetween("2026-10-30", "2026-10-20")).toBe(-10);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });
  it("is not thrown off by clock changes", () => expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2));
});

describe("isLetterStatus", () => {
  it("accepts the four statuses only", () => {
    expect(isLetterStatus("asked")).toBe(true);
    expect(isLetterStatus("done")).toBe(false);
  });
});

describe("letterFlags", () => {
  it("has no flags once submitted", () => expect(letterFlags(L({ status: "submitted", letter_deadline: "2026-10-01" }), TODAY)).toEqual([]));
  it("flags an overdue letter", () => expect(letterFlags(L({ status: "confirmed", letter_deadline: "2026-10-19" }), TODAY)).toEqual(["overdue"]));
  it("does not flag overdue on the deadline day itself", () => expect(letterFlags(L({ status: "confirmed", letter_deadline: TODAY }), TODAY)).toEqual([]));
  it("flags a not-asked letter with a deadline within 45 days", () => {
    expect(letterFlags(L({ status: "not_asked", letter_deadline: "2026-12-04" }), TODAY)).toEqual(["not_asked"]);
    expect(letterFlags(L({ status: "not_asked", letter_deadline: "2026-12-05" }), TODAY)).toEqual([]);
  });
  it("does not flag a not-asked letter without a deadline", () => expect(letterFlags(L({ status: "not_asked" }), TODAY)).toEqual([]));
  it("flags a reminder when the last contact was 10 or more days ago", () => {
    expect(letterFlags(L({ asked_on: "2026-10-10" }), TODAY)).toEqual(["needs_reminder"]);
    expect(letterFlags(L({ asked_on: "2026-10-11" }), TODAY)).toEqual([]);
  });
  it("counts from the last reminder when there is one", () => {
    expect(letterFlags(L({ asked_on: "2026-09-01", last_reminded_on: "2026-10-15" }), TODAY)).toEqual([]);
  });
  it("flags a reminder when asked and the deadline is within 14 days", () => {
    expect(letterFlags(L({ asked_on: "2026-10-19", letter_deadline: "2026-11-03" }), TODAY)).toEqual(["needs_reminder"]);
    expect(letterFlags(L({ asked_on: "2026-10-19", letter_deadline: "2026-11-04" }), TODAY)).toEqual([]);
  });
  it("does not nag when asked with no dates at all", () => expect(letterFlags(L({}), TODAY)).toEqual([]));
  it("does not ask for a reminder once confirmed", () => {
    expect(letterFlags(L({ status: "confirmed", asked_on: "2026-09-01", letter_deadline: "2026-10-25" }), TODAY)).toEqual([]);
  });
  it("can be overdue and needing a reminder at once", () => {
    expect(letterFlags(L({ asked_on: "2026-09-01", letter_deadline: "2026-10-01" }), TODAY)).toEqual(["overdue", "needs_reminder"]);
  });
});

describe("lettersToChase", () => {
  const list = [
    L({ id: "a", status: "not_asked", letter_deadline: "2026-11-10" }),
    L({ id: "b", status: "asked", asked_on: "2026-10-01" }),
    L({ id: "c", status: "confirmed", letter_deadline: "2026-10-10" }),
    L({ id: "d", status: "submitted", letter_deadline: "2026-10-01" }),
  ];
  it("lists overdue first, then by deadline, using the most urgent flag", () => {
    const r = lettersToChase(list, TODAY);
    expect(r.map((x) => [x.letter.id, x.flag])).toEqual([["c", "overdue"], ["a", "not_asked"], ["b", "needs_reminder"]]);
  });
  it("words the reasons", () => {
    const r = lettersToChase(list, TODAY);
    expect(r[0].reason).toBe("deadline passed 10 days ago");
    expect(r[1].reason).toBe("not asked yet, due in 21 days");
    expect(r[2].reason).toBe("asked 19 days ago, no reply recorded");
  });
  it("words a reminder that is about the deadline", () => {
    expect(chaseReason(L({ asked_on: "2026-10-19", letter_deadline: "2026-10-27" }), "needs_reminder", TODAY)).toBe("asked 1 day ago, due in 7 days");
  });
});

describe("openLetterCount and groupByRecommender", () => {
  it("counts letters that are not submitted", () => {
    expect(openLetterCount([{ status: "asked" }, { status: "submitted" }, { status: "not_asked" }])).toBe(2);
  });
  it("groups by recommender, flagged first, and marks heavy load at six open letters", () => {
    const many = Array.from({ length: 6 }, (_, i) => L({ id: `m${i}`, recommender_id: "r2", recommender_name: "Prof. Busy", school_name: `S${i}` }));
    const flagged = L({ id: "f", recommender_id: "r3", recommender_name: "Zed", status: "confirmed", letter_deadline: "2026-10-01" });
    const groups = groupByRecommender([...many, flagged, L({ id: "q" })], TODAY);
    expect(groups.map((g) => g.name)).toEqual(["Zed", "Dr. Rao", "Prof. Busy"]);
    expect(groups.find((g) => g.name === "Prof. Busy")).toMatchObject({ open: 6, heavy: true });
    expect(groups.find((g) => g.name === "Dr. Rao")).toMatchObject({ open: 1, heavy: false });
  });
  it("keeps letters without a recommender together", () => {
    const g = groupByRecommender([L({ id: "x", recommender_id: null, recommender_name: "Unknown recommender", recommender_email: null })], TODAY);
    expect(g).toHaveLength(1);
    expect(g[0].id).toBeNull();
  });
});

describe("email drafts", () => {
  const two = [{ school_name: "MIT", letter_deadline: "2026-12-01" }, { school_name: "Stanford", letter_deadline: null }];
  it("drafts a request listing every school", () => {
    const d = buildRequestEmail("Dr. Rao", two, "Sam Lee");
    expect(d.subject).toBe("Recommendation letter requests (2 programs)");
    expect(d.body).toContain("Dear Dr. Rao,");
    expect(d.body).toContain("- MIT (due December 1, 2026)");
    expect(d.body).toContain("- Stanford\n");
    expect(d.body.trim().endsWith("Sam Lee")).toBe(true);
  });
  it("names the school in the subject for a single request", () => {
    expect(buildRequestEmail("Dr. Rao", [two[0]], "").subject).toBe("Recommendation letter request: MIT");
  });
  it("signs off without a name when none is given", () => {
    expect(buildRequestEmail("Dr. Rao", two, "  ").body.trim().endsWith("Thank you for considering this,")).toBe(true);
  });
  it("drafts a reminder and a thank-you", () => {
    expect(buildReminderEmail("Dr. Rao", [two[0]], "Sam").subject).toBe("Gentle reminder: recommendation letter for MIT");
    expect(buildReminderEmail("Dr. Rao", two, "Sam").subject).toBe("Gentle reminder: recommendation letters");
    const t = buildThankYouEmail("Dr. Rao", two, "Sam");
    expect(t.subject).toBe("Thank you for your recommendation");
    expect(t.body).toContain("Thank you for submitting");
  });
});

describe("mailtoUrl", () => {
  const d = { subject: "Hi & bye", body: "Line one\nLine two" };
  it("builds an encoded link", () => {
    expect(mailtoUrl("rao@uni.edu", d)).toBe("mailto:rao@uni.edu?subject=Hi%20%26%20bye&body=Line%20one%0ALine%20two");
  });
  it("returns null without a usable address", () => {
    expect(mailtoUrl(null, d)).toBeNull();
    expect(mailtoUrl("not-an-address", d)).toBeNull();
  });
  it("returns null when the link would be too long", () => {
    expect(mailtoUrl("rao@uni.edu", { subject: "s", body: "x".repeat(2000) })).toBeNull();
  });
});

describe("date updates", () => {
  it("records the asked date and receipt when the status moves forward", () => {
    expect(letterStatusChange("asked", "2026-10-20", { asked_on: null, received_on: null })).toEqual({ status: "asked", asked_on: "2026-10-20", received_on: null });
    expect(letterStatusChange("submitted", "2026-10-25", { asked_on: "2026-10-01", received_on: null })).toEqual({ status: "submitted", asked_on: "2026-10-01", received_on: "2026-10-25" });
  });
  it("keeps the first dates and clears receipt when moved back", () => {
    expect(letterStatusChange("confirmed", "2026-10-26", { asked_on: "2026-10-01", received_on: "2026-10-25" })).toEqual({ status: "confirmed", asked_on: "2026-10-01", received_on: null });
    expect(letterStatusChange("not_asked", "2026-10-26", { asked_on: "2026-10-01", received_on: null })).toEqual({ status: "not_asked", asked_on: null, received_on: null });
  });
  it("marks as asked only once and moves a not-asked letter to asked", () => {
    expect(askedUpdate({ status: "not_asked", asked_on: null }, "2026-10-20")).toEqual({ status: "asked", asked_on: "2026-10-20" });
    expect(askedUpdate({ status: "confirmed", asked_on: "2026-10-01" }, "2026-10-20")).toEqual({ status: "confirmed", asked_on: "2026-10-01" });
  });
  it("marks as reminded with a date and a running count", () => {
    expect(remindedUpdate({ reminder_count: 1 }, "2026-10-20")).toEqual({ last_reminded_on: "2026-10-20", reminder_count: 2 });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/lib/letters.test.ts`
Expected: FAIL (module `@/lib/letters` not found).

- [ ] **Step 3: Write `lib/letters.ts`**

```ts
export const LETTER_STATUSES = [
  { key: "not_asked", label: "Not asked" },
  { key: "asked", label: "Asked" },
  { key: "confirmed", label: "Confirmed" },
  { key: "submitted", label: "Submitted" },
] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number]["key"];
export const isLetterStatus = (s: string): s is LetterStatus => LETTER_STATUSES.some((x) => x.key === s);

export type LetterRecord = {
  id: string; school_id: string; school_name: string;
  recommender_id: string | null; recommender_name: string; recommender_email: string | null;
  status: LetterStatus; letter_deadline: string | null;
  asked_on: string | null; last_reminded_on: string | null; reminder_count: number; received_on: string | null;
};
export type ChaseInput = Pick<LetterRecord, "id" | "school_id" | "school_name" | "recommender_id" | "recommender_name" | "status" | "letter_deadline" | "asked_on" | "last_reminded_on">;

export const REMIND_AFTER_DAYS = 10;
export const DEADLINE_SOON_DAYS = 14;
export const NOT_ASKED_WINDOW_DAYS = 45;
export const HEAVY_LOAD = 6;

// Dates are "YYYY-MM-DD"; counting in UTC keeps clock changes from shifting the result.
const dayNumber = (s: string) => Math.round(new Date(s + "T00:00:00Z").getTime() / 86400000);
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

export type LetterFlag = "overdue" | "needs_reminder" | "not_asked";
export const FLAG_LABEL: Record<LetterFlag, string> = { overdue: "Overdue", needs_reminder: "Needs a reminder", not_asked: "Not asked yet" };

export function letterFlags(l: Pick<LetterRecord, "status" | "letter_deadline" | "asked_on" | "last_reminded_on">, today: string): LetterFlag[] {
  if (l.status === "submitted") return [];
  const flags: LetterFlag[] = [];
  const toDeadline = l.letter_deadline ? daysBetween(today, l.letter_deadline) : null;
  if (toDeadline !== null && toDeadline < 0) flags.push("overdue");
  if (l.status === "not_asked") {
    if (toDeadline !== null && toDeadline >= 0 && toDeadline <= NOT_ASKED_WINDOW_DAYS) flags.push("not_asked");
  } else if (l.status === "asked") {
    const last = l.last_reminded_on ?? l.asked_on;
    const quiet = last !== null && daysBetween(last, today) >= REMIND_AFTER_DAYS;
    const soon = toDeadline !== null && toDeadline >= 0 && toDeadline <= DEADLINE_SOON_DAYS;
    if (quiet || soon) flags.push("needs_reminder");
  }
  return flags;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function chaseReason(l: ChaseInput, flag: LetterFlag, today: string): string {
  const toDeadline = l.letter_deadline ? daysBetween(today, l.letter_deadline) : null;
  if (flag === "overdue") return `deadline passed ${plural(-(toDeadline ?? 0), "day")} ago`;
  if (flag === "not_asked") return `not asked yet, due in ${plural(toDeadline ?? 0, "day")}`;
  const last = l.last_reminded_on ?? l.asked_on;
  const quiet = last !== null && daysBetween(last, today) >= REMIND_AFTER_DAYS;
  const since = last ? `${l.last_reminded_on ? "reminded" : "asked"} ${plural(daysBetween(last, today), "day")} ago` : "asked";
  if (toDeadline !== null && toDeadline >= 0 && toDeadline <= DEADLINE_SOON_DAYS && !quiet) return `${since}, due in ${plural(toDeadline, "day")}`;
  return `${since}, no reply recorded`;
}

const FLAG_ORDER: LetterFlag[] = ["overdue", "not_asked", "needs_reminder"];

// The letters that need action, most urgent first: overdue, then by deadline (letters without one last).
export function lettersToChase(list: ChaseInput[], today: string): Array<{ letter: ChaseInput; flag: LetterFlag; reason: string }> {
  const out: Array<{ letter: ChaseInput; flag: LetterFlag; reason: string }> = [];
  for (const letter of list) {
    const flags = letterFlags(letter, today);
    const flag = FLAG_ORDER.find((f) => flags.includes(f));
    if (flag) out.push({ letter, flag, reason: chaseReason(letter, flag, today) });
  }
  const rank = (f: LetterFlag) => (f === "overdue" ? 0 : 1);
  return out.sort((a, b) =>
    rank(a.flag) - rank(b.flag) ||
    (a.letter.letter_deadline ?? "9999-12-31").localeCompare(b.letter.letter_deadline ?? "9999-12-31") ||
    a.letter.recommender_name.localeCompare(b.letter.recommender_name));
}

export const openLetterCount = (list: Array<{ status: string }>) => list.filter((l) => l.status !== "submitted").length;

export type RecommenderGroup = { key: string; id: string | null; name: string; email: string | null; letters: LetterRecord[]; open: number; heavy: boolean; flagged: number };

// One group per recommender; the people with the most to chase come first.
export function groupByRecommender(list: LetterRecord[], today: string): RecommenderGroup[] {
  const map = new Map<string, LetterRecord[]>();
  for (const l of list) {
    const key = l.recommender_id ?? "none";
    map.set(key, [...(map.get(key) ?? []), l]);
  }
  const groups = Array.from(map.entries()).map(([key, letters]) => {
    const sorted = [...letters].sort((a, b) => (a.letter_deadline ?? "9999-12-31").localeCompare(b.letter_deadline ?? "9999-12-31") || a.school_name.localeCompare(b.school_name));
    const open = openLetterCount(sorted);
    return {
      key, id: sorted[0].recommender_id, name: sorted[0].recommender_name, email: sorted[0].recommender_email,
      letters: sorted, open, heavy: open >= HEAVY_LOAD, flagged: sorted.filter((l) => letterFlags(l, today).length > 0).length,
    };
  });
  return groups.sort((a, b) => b.flagged - a.flagged || a.name.localeCompare(b.name));
}

// ---- Email drafts (the app only drafts; the owner sends from their own mail) ----

export type EmailDraft = { subject: string; body: string };
type DraftLetter = Pick<LetterRecord, "school_name" | "letter_deadline">;

const longDate = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const bullets = (ls: DraftLetter[]) =>
  [...ls].sort((a, b) => (a.letter_deadline ?? "9999-12-31").localeCompare(b.letter_deadline ?? "9999-12-31"))
    .map((l) => `- ${l.school_name}${l.letter_deadline ? ` (due ${longDate(l.letter_deadline)})` : ""}`).join("\n");
const closing = (lead: string, sender: string) => (sender.trim() ? `${lead}\n${sender.trim()}` : lead);

export function buildRequestEmail(name: string, letters: DraftLetter[], sender: string): EmailDraft {
  const subject = letters.length === 1 ? `Recommendation letter request: ${letters[0].school_name}` : `Recommendation letter requests (${letters.length} programs)`;
  const body = [
    `Dear ${name},`, "",
    `I hope you are well. I am applying to graduate programs and would be grateful if you would write a letter of recommendation for me. ${letters.length === 1 ? "The program is" : "The programs are"}:`, "",
    bullets(letters), "",
    "I am happy to send my CV, statement drafts and anything else that would help. Please let me know whether you are able to support these applications.", "",
    closing("Thank you for considering this,", sender),
  ].join("\n");
  return { subject, body };
}

export function buildReminderEmail(name: string, letters: DraftLetter[], sender: string): EmailDraft {
  const subject = letters.length === 1 ? `Gentle reminder: recommendation letter for ${letters[0].school_name}` : "Gentle reminder: recommendation letters";
  const body = [
    `Dear ${name},`, "",
    `I hope you are well. This is a gentle reminder about the recommendation ${letters.length === 1 ? "letter" : "letters"} for:`, "",
    bullets(letters), "",
    "Please let me know if you need anything else from me. Thank you for your time.", "",
    closing("Best wishes,", sender),
  ].join("\n");
  return { subject, body };
}

export function buildThankYouEmail(name: string, letters: DraftLetter[], sender: string): EmailDraft {
  const body = [
    `Dear ${name},`, "",
    `Thank you for submitting your recommendation ${letters.length === 1 ? "letter" : "letters"} for:`, "",
    bullets(letters), "",
    "I really appreciate the time and care you put into it, and I will let you know how the applications go.", "",
    closing("With thanks,", sender),
  ].join("\n");
  return { subject: "Thank you for your recommendation", body };
}

export const MAILTO_MAX = 1800;

// A mail link only when there is an address and the link is short enough for mail programs to open reliably.
export function mailtoUrl(email: string | null, d: EmailDraft): string | null {
  const to = (email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(to)) return null;
  const url = `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  return url.length <= MAILTO_MAX ? url : null;
}

// ---- Date updates ----

// Changing the status by hand keeps the dates honest: asked_on on the first move forward, received_on only while submitted.
export function letterStatusChange(next: LetterStatus, today: string, cur: { asked_on: string | null; received_on: string | null }): { status: LetterStatus; asked_on: string | null; received_on: string | null } {
  if (next === "not_asked") return { status: next, asked_on: null, received_on: null };
  const asked_on = cur.asked_on ?? today;
  return { status: next, asked_on, received_on: next === "submitted" ? cur.received_on ?? today : null };
}

export function askedUpdate(cur: { status: LetterStatus; asked_on: string | null }, today: string): { status: LetterStatus; asked_on: string } {
  return { status: cur.status === "not_asked" ? "asked" : cur.status, asked_on: cur.asked_on ?? today };
}

export function remindedUpdate(cur: { reminder_count: number }, today: string): { last_reminded_on: string; reminder_count: number } {
  return { last_reminded_on: today, reminder_count: cur.reminder_count + 1 };
}
```

- [ ] **Step 4: Run the tests and the type-check**

Run: `npx vitest run tests/lib/letters.test.ts && npx tsc --noEmit`
Expected: all tests pass, no type errors. If a test expectation is wrong because of a real defect in the code, fix the code; if the test itself has an arithmetic slip, fix the test and say so in the report.

- [ ] **Step 5: Commit**

```bash
git add lib/letters.ts tests/lib/letters.test.ts
git commit -m "feat: pure rules for recommender flags, email drafts and letter dates"
```

---

### Task 3: Server actions and the data loader

**Files:**
- Create: `lib/letters-data.ts`
- Create: `app/(app)/materials/letter-actions.ts`
- Modify: `app/(app)/schools/[id]/logistics-actions.ts` (`updateLetterStatus`)

**Interfaces:**
- Consumes: everything from `lib/letters.ts` (Task 2), `OWNER_USER_ID` from `@/lib/owner`, `createClient` from `@/lib/supabase/server`.
- Produces: `loadLetters(supabase): Promise<LetterRecord[]>`; server actions `markLettersAsked(ids: string[])`, `markLettersReminded(ids: string[])`, `setLetterStatus(id: string, next: string)`.

- [ ] **Step 1: Write the loader**

`lib/letters-data.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LetterRecord } from "@/lib/letters";

export async function loadLetters(supabase: SupabaseClient): Promise<LetterRecord[]> {
  const { data, error } = await supabase
    .from("letter_requests")
    .select("id, school_id, recommender_id, status, letter_deadline, asked_on, last_reminded_on, reminder_count, received_on, schools(name), people(name, email)");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, school_id: r.school_id, school_name: r.schools?.name ?? "School",
    recommender_id: r.recommender_id, recommender_name: r.people?.name ?? "Unknown recommender", recommender_email: r.people?.email ?? null,
    status: r.status, letter_deadline: r.letter_deadline, asked_on: r.asked_on, last_reminded_on: r.last_reminded_on,
    reminder_count: r.reminder_count ?? 0, received_on: r.received_on,
  }));
}
```

- [ ] **Step 2: Write the server actions**

`app/(app)/materials/letter-actions.ts`:

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { askedUpdate, isLetterStatus, letterStatusChange, remindedUpdate } from "@/lib/letters";
import { todayString } from "@/lib/digest";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can change letter requests.");
  return { supabase };
}

function refresh(schoolIds: string[]) {
  revalidatePath("/materials/letters");
  revalidatePath("/week");
  revalidatePath("/");
  revalidatePath("/today");
  for (const id of Array.from(new Set(schoolIds))) revalidatePath(`/schools/${id}`);
}

export async function markLettersAsked(ids: string[]) {
  const { supabase } = await owner();
  if (ids.length === 0) return;
  const today = todayString();
  const { data, error } = await supabase.from("letter_requests").select("id, status, asked_on, school_id").in("id", ids);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const { error: e } = await supabase.from("letter_requests").update(askedUpdate({ status: r.status, asked_on: r.asked_on }, today)).eq("id", r.id);
    if (e) throw new Error(e.message);
  }
  refresh((data ?? []).map((r) => r.school_id));
}

export async function markLettersReminded(ids: string[]) {
  const { supabase } = await owner();
  if (ids.length === 0) return;
  const today = todayString();
  const { data, error } = await supabase.from("letter_requests").select("id, reminder_count, school_id").in("id", ids);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const { error: e } = await supabase.from("letter_requests").update(remindedUpdate({ reminder_count: r.reminder_count ?? 0 }, today)).eq("id", r.id);
    if (e) throw new Error(e.message);
  }
  refresh((data ?? []).map((r) => r.school_id));
}

export async function setLetterStatus(id: string, next: string) {
  const { supabase } = await owner();
  if (!isLetterStatus(next)) throw new Error("Unknown letter status.");
  const { data: cur } = await supabase.from("letter_requests").select("asked_on, received_on, school_id").eq("id", id).single();
  if (!cur) throw new Error("Letter request not found.");
  const { error } = await supabase.from("letter_requests").update(letterStatusChange(next, todayString(), cur)).eq("id", id);
  if (error) throw new Error(error.message);
  refresh([cur.school_id]);
}
```

- [ ] **Step 3: Make the school page's status change record dates too**

In `app/(app)/schools/[id]/logistics-actions.ts` add `import { isLetterStatus, letterStatusChange } from "@/lib/letters";` and `import { todayString } from "@/lib/digest";`, remove the local `type LetterStatus = ...` line (keep `localDate` if it is still used elsewhere in the file), and replace `updateLetterStatus` with:

```ts
export async function updateLetterStatus(id: string, schoolId: string, status: string) {
  if (!isLetterStatus(status)) throw new Error("Unknown letter status.");
  const supabase = await createClient();
  const { data: cur } = await supabase.from("letter_requests").select("asked_on, received_on").eq("id", id).single();
  if (!cur) throw new Error("Letter request not found.");
  const { error } = await supabase.from("letter_requests").update(letterStatusChange(status, todayString(), cur)).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
  revalidatePath("/materials/letters");
  revalidatePath("/week");
}
```

`components/school-controls.tsx` calls `updateLetterStatus(id, schoolId, e.target.value as any)`, which still type-checks with a `string` parameter. If `LetterStatus` was used elsewhere in the file, keep the type import from `@/lib/letters` instead.

- [ ] **Step 4: Type-check and run the tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/letters-data.ts "app/(app)/materials/letter-actions.ts" "app/(app)/schools/[id]/logistics-actions.ts"
git commit -m "feat: letter actions that record asked, reminded and received dates"
```

---

### Task 4: The Letters tab

**Files:**
- Create: `components/letters-board.tsx`
- Create: `app/(app)/materials/letters/page.tsx`
- Modify: `components/ui.tsx` (`MATERIALS_TABS`)

**Interfaces:**
- Consumes: `loadLetters`, `groupByRecommender`, `letterFlags`, `FLAG_LABEL`, `LETTER_STATUSES`, `buildRequestEmail`, `buildReminderEmail`, `buildThankYouEmail`, `mailtoUrl`, `daysBetween`, `HEAVY_LOAD`, `markLettersAsked`, `markLettersReminded`, `setLetterStatus`, `todayString`.
- Produces: route `/materials/letters?focus=<recommenderId>`; `<LettersBoard letters={LetterRecord[]} today={string} focus?={string} />`.

- [ ] **Step 1: Add the tab**

In `components/ui.tsx`, append to `MATERIALS_TABS`: `{ href: "/materials/letters", label: "Letters" },`

- [ ] **Step 2: Write the page**

`app/(app)/materials/letters/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { LettersBoard } from "@/components/letters-board";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";
import { loadLetters } from "@/lib/letters-data";
import { todayString } from "@/lib/digest";

export const metadata = { title: "Letters" };

export default async function LettersPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Letters are only available to the workspace owner.</main>;
  }
  const letters = await loadLetters(supabase);
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Materials" subtitle="Your recommenders: who has been asked, who needs a nudge, and the emails to send." />
        <SubNav items={MATERIALS_TABS} current="/materials/letters" />
      </div>
      <LettersBoard letters={letters} today={todayString()} focus={focus} />
    </main>
  );
}
```

- [ ] **Step 3: Write the board**

`components/letters-board.tsx`. Follow the styling of `components/statements-list.tsx` (read it first: `field` input class, `Section`-style headings, `border-line`, `text-gray-500`, brass accent, `hover:text-brass`). Requirements, all mandatory:

```tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { markLettersAsked, markLettersReminded, setLetterStatus } from "@/app/(app)/materials/letter-actions";
import {
  FLAG_LABEL, HEAVY_LOAD, LETTER_STATUSES, buildReminderEmail, buildRequestEmail, buildThankYouEmail, daysBetween, groupByRecommender,
  letterFlags, mailtoUrl, type EmailDraft, type LetterRecord, type RecommenderGroup,
} from "@/lib/letters";
```

Behaviour:
1. **Sign-off name.** A text input "Sign emails as" at the top, remembered in `localStorage` under `letters-sign-as` (read in `useEffect`, write on change, every access in try/catch, the page must work without storage).
2. **Empty state.** With no letters: "No letter requests yet. Add one from a school's Application tab, under Recommendation letters."
3. **One card per group** from `groupByRecommender(letters, today)`. Give each card `id={`rec-${g.id ?? "none"}`}`, and a brass ring when `g.id === focus`.
   - Header: the name (a `Link` to `/people/${g.id}` when `g.id` is set), the email, or "No email saved" with a link "Add one" to `/people/${g.id}` when there is none; then `${g.open} open` and, when `g.heavy`, a badge "Heavy load: ${g.open} open letters (${HEAVY_LOAD} or more)".
   - One row per letter: school name (link to `/schools/${l.school_id}?tab=application`), "due {date}" when set (red when past, using `daysBetween(today, l.letter_deadline) < 0`), a `<select aria-label={`Status for ${l.school_name}`}>` of `LETTER_STATUSES` calling `setLetterStatus(l.id, value)` then `router.refresh()`, then a muted line: `asked {d}`, `reminded {n}× · last {d}` (only when `reminder_count > 0`), `received {d}`; then a chip per flag from `letterFlags(l, today)` labelled with `FLAG_LABEL` (red for overdue, brass otherwise). Format dates as e.g. "Oct 20" using `toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })` on `new Date(d + "T00:00:00Z")`.
   - Draft buttons (only when there is something to draft): "Draft request" for letters with status `not_asked`; "Draft reminder" for status `asked` or `confirmed`; "Draft thank-you" for status `submitted`.
4. **Draft panel** (opens under the card's buttons; one open at a time; closing it discards edits). It builds the email with `buildRequestEmail` / `buildReminderEmail` / `buildThankYouEmail(g.name, lettersForThatKind, signAs)`, then shows an editable subject input and a body `<textarea rows={12}>` (state seeded when opened). Buttons:
   - "Open in mail": an `<a href>` from `mailtoUrl(g.email, { subject, body })` using the current edited text. When it returns null, instead show muted text: "No email saved for this person, use Copy." if there is no email, otherwise "Too long for a mail link, use Copy."
   - "Copy": `navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)` inside try/catch; the button label changes to "Copied" for 2 seconds; on failure show "Copy failed, select the text and copy it yourself."
   - For a request draft: "Mark as asked" calls `markLettersAsked(ids)` for the drafted letters; for a reminder draft: "Mark as reminded" calls `markLettersReminded(ids)`. Both then `router.refresh()` and close the panel. A thank-you draft has no mark button.
   - A small note: "Nothing is sent from here. Send it from your own mail, then mark it."
5. Errors from any action are shown in red text inside the card, never swallowed. Use `useTransition` for pending state and disable buttons while pending.

- [ ] **Step 4: Type-check and run the tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/letters-board.tsx "app/(app)/materials/letters/page.tsx" components/ui.tsx
git commit -m "feat: Letters tab with recommender cards, flags and email drafts"
```

---

### Task 5: Dates, flags and a link on the school's Application tab

**Files:**
- Modify: `components/school-controls.tsx` (`LetterRow`)
- Modify: `app/(app)/schools/[id]/page.tsx` (where `LetterRow` is rendered, around line 365)

**Interfaces:**
- Consumes: `letterFlags`, `FLAG_LABEL`, `daysBetween` from `@/lib/letters`; `today` already defined in the page (`localDate(new Date())`).
- Produces: `LetterRow` gains optional props `recommenderId?: string | null`, `askedOn?: string | null`, `lastRemindedOn?: string | null`, `reminderCount?: number`, `receivedOn?: string | null`, `today?: string`.

- [ ] **Step 1: Extend `LetterRow`**

Add the optional props above. Under the existing name and select line, add a muted line (`text-xs text-gray-500`) that shows, when present: `asked {d}`, `reminded {n}× · last {d}` (only if `reminderCount > 0`), `received {d}`; then, when `today` is given, one chip per flag from `letterFlags({ status, letter_deadline: deadline, asked_on: askedOn ?? null, last_reminded_on: lastRemindedOn ?? null }, today)` with the `FLAG_LABEL` text; then, when `recommenderId` is set, a link `Draft email →` to `/materials/letters?focus=${recommenderId}` (this opens the recommender's card, where the drafts live). Date format: "Oct 20" as in Task 4. Keep the existing select and remove button unchanged. `status` is passed as `string`; cast to `LetterStatus` for `letterFlags`.

- [ ] **Step 2: Pass the new props from the school page**

In `app/(app)/schools/[id]/page.tsx`, where `LetterRow` is rendered, pass `recommenderId={l.recommender_id}`, `askedOn={l.asked_on}`, `lastRemindedOn={l.last_reminded_on}`, `reminderCount={l.reminder_count}`, `receivedOn={l.received_on}`, `today={today}`. The query is `select("*, people(name)")`, so the new columns are already included.

- [ ] **Step 3: Type-check and run the tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/school-controls.tsx "app/(app)/schools/[id]/page.tsx"
git commit -m "feat: show letter dates and flags on the school Application tab"
```

---

### Task 6: "Recommenders to chase" on the weekly page and in the Monday email

**Files:**
- Modify: `app/(app)/week/page.tsx`
- Modify: `lib/digest.ts`

**Interfaces:**
- Consumes: `lettersToChase`, `FLAG_LABEL`, `type ChaseInput` from `@/lib/letters`.

- [ ] **Step 1: Weekly page**

In `app/(app)/week/page.tsx`:
1. Import `{ FLAG_LABEL, lettersToChase, type ChaseInput } from "@/lib/letters"`.
2. Change the `letter_requests` select to `"id, school_id, recommender_id, status, letter_deadline, asked_on, last_reminded_on, people(name), schools(name)"`.
3. After the queries, build the chase list. `today` is already defined in this file as the local `YYYY-MM-DD` string; if not, use the variable the file uses for today:

```ts
const chase = lettersToChase(
  ((letters ?? []) as any[]).map((l): ChaseInput => ({
    id: l.id, school_id: l.school_id, school_name: l.schools?.name ?? "School", recommender_id: l.recommender_id,
    recommender_name: l.people?.name ?? "Recommender", status: l.status, letter_deadline: l.letter_deadline,
    asked_on: l.asked_on, last_reminded_on: l.last_reminded_on,
  })),
  today,
);
```
4. Render, right after the "Application deadlines" section and only when `offset === 0 && chase.length > 0`:

```tsx
{offset === 0 && chase.length > 0 && (
  <Section title="Recommenders to chase" hint={`${chase.length}`}>
    <ul className="flex flex-col">
      {chase.slice(0, 8).map(({ letter, flag, reason }) => (
        <li key={letter.id} className="border-b border-line/60 last:border-0">
          <Link href={`/materials/letters${letter.recommender_id ? `?focus=${letter.recommender_id}` : ""}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-brass">
            <span className="min-w-0">
              <span className="block font-medium truncate">{letter.recommender_name}: {letter.school_name}</span>
              <span className="block text-sm text-gray-500">{reason}</span>
            </span>
            <span className={`text-xs whitespace-nowrap ${flag === "overdue" ? "text-red-600" : "text-brass"}`}>{FLAG_LABEL[flag]}</span>
          </Link>
        </li>
      ))}
    </ul>
    {chase.length > 8 && <span className="text-xs text-gray-400">and {chase.length - 8} more on the Letters tab</span>}
  </Section>
)}
```

- [ ] **Step 2: Monday email**

In `lib/digest.ts`:
1. Import `{ FLAG_LABEL, lettersToChase, type ChaseInput } from "@/lib/letters"`.
2. Add a second query in the `Promise.all`, named `{ data: allLetters }`, appended after `milestones`: `supabase.from("letter_requests").select("id, school_id, recommender_id, status, letter_deadline, asked_on, last_reminded_on, people(name), schools(name)")` (keep the existing `letters` query for the dates section unchanged).
3. After the "Dates in the next two weeks" block, add:

```ts
  // 2b. Recommenders to chase
  const chase = lettersToChase(
    ((allLetters ?? []) as any[]).map((l): ChaseInput => ({
      id: l.id, school_id: l.school_id, school_name: l.schools?.name ?? "School", recommender_id: l.recommender_id,
      recommender_name: l.people?.name ?? "Recommender", status: l.status, letter_deadline: l.letter_deadline,
      asked_on: l.asked_on, last_reminded_on: l.last_reminded_on,
    })),
    today,
  );
  if (chase.length > 0) {
    sections.push({
      title: "Recommenders to chase",
      note: chase.length > 6 ? `${chase.length} letters need action in total.` : undefined,
      rows: chase.slice(0, 6).map(({ letter, flag, reason }) => ({
        primary: `${letter.recommender_name}: ${letter.school_name}`, secondary: reason, right: FLAG_LABEL[flag],
        href: link(`/materials/letters${letter.recommender_id ? `?focus=${letter.recommender_id}` : ""}`),
      })),
    });
  }
```
Also add `chase.length && `${chase.length} letter${chase.length === 1 ? "" : "s"} to chase`` to the `bits` array used for the subject line.

- [ ] **Step 3: Type-check and run the tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/week/page.tsx" lib/digest.ts
git commit -m "feat: recommenders to chase on the weekly page and in the Monday email"
```

---

### Task 7: End-to-end check in the browser

**Files:** none (verification only). Create `ZZTEMP` data, then delete it.

- [ ] **Step 1: Test data**

Using the production database (Management API, token in `.supabase-token`), insert one person `ZZTEMP Rao` with email `zztemp@example.com`, and three `letter_requests` for that person on three different real schools: one `not_asked` with deadline 20 days ahead, one `asked` with `asked_on` 12 days ago and no deadline, one `confirmed` with a deadline 3 days in the past. Record the ids.

- [ ] **Step 2: Letters tab**

Open `/materials/letters?focus=<person id>`. Expected: the ZZTEMP card shows, with a highlight ring; the three letters show flags "Not asked yet", "Needs a reminder", "Overdue"; "3 open". Change the confirmed letter to "Submitted": the overdue chip goes away and "received" today appears; change it back to "Confirmed": "received" disappears.

- [ ] **Step 3: Drafts and marking**

Press "Draft request": the subject is "Recommendation letter request: <school>", the body lists the school with its date, the "Open in mail" link starts with `mailto:zztemp@example.com?`. Edit the subject; the link changes. Press "Mark as asked": the letter becomes Asked with today's date and the "Not asked yet" chip goes. Press "Draft reminder", then "Mark as reminded": the row shows `reminded 1× · last <today>` and the "Needs a reminder" chip goes.

- [ ] **Step 4: Too-long fallback and no email**

Paste 2000 characters into a draft body: "Open in mail" is replaced by "Too long for a mail link, use Copy." Insert a second ZZTEMP person without an email with one letter: its draft shows "No email saved for this person, use Copy." and the header shows "No email saved".

- [ ] **Step 5: Other screens**

Open one of the schools' Application tab: the letter row shows the dates and a "Draft email →" link that opens the Letters tab focused on that person. Open `/week`: "Recommenders to chase" lists the flagged ZZTEMP letters (make one flagged again first, for example set a deadline in the past). Open `/api/digest?preview=1`: a "Recommenders to chase" section lists them.

- [ ] **Step 6: Clean up**

Delete every `ZZTEMP` letter request and person, and confirm with a query that `people` has no `ZZTEMP%` names and `letter_requests` has no rows referencing them. Real letter rows must be unchanged from before the check.

- [ ] **Step 7: Final suite and commit any fixes**

Run: `npm run typecheck && npm test && SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test`
Expected: all pass, `0 failed`. Commit any fix made during the browser check with a message describing it.

---

## Acceptance checklist

- [ ] Migration 0015 is applied on production and `db:test` reports `0 failed`.
- [ ] `npm run typecheck` and `npm test` pass.
- [ ] Each letter shows asked, reminded and received dates; changing status by hand keeps them honest.
- [ ] Flags (overdue, needs reminder, not asked yet) and the heavy-load badge follow the rules in Global Constraints.
- [ ] Request, reminder and thank-you emails are drafted, editable, copyable and open in the mail program when short enough; the app sends nothing.
- [ ] "Mark as asked" and "Mark as reminded" record the date and update the count.
- [ ] The school Application tab shows dates, flags and a link to the drafts.
- [ ] "Recommenders to chase" appears on the weekly page and in the Monday email.
- [ ] No test data remains.
