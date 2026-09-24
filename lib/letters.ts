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
