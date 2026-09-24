// What still stands between you and a submitted application, and how worried to be about it.
export type ReadinessSchool = {
  id: string; name: string; deadline_date: string | null; status: string; gre_policy: string | null; english_test: string | null;
  letters_required: number | null; sop_version_id: string | null; has_statement?: boolean;
};
export type ReadinessItem = { key: string; label: string; done: boolean; derived: boolean; hint?: string };
export type Risk = "submitted" | "overdue" | "urgent" | "watch" | "ok" | "nodate";

const SUBMITTED = ["submitted", "interview", "accepted", "rejected"];

export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);

export function buildItems(s: ReadinessSchool, letters: Array<{ status: string }>, checks: Record<string, boolean>): ReadinessItem[] {
  const confirmed = letters.filter((l) => l.status === "confirmed" || l.status === "submitted").length;
  const need = Math.max(s.letters_required ?? letters.length, letters.length > 0 ? 1 : s.letters_required ?? 0);
  const items: ReadinessItem[] = [
    { key: "portal", label: "Application portal account created", done: !!checks.portal, derived: false },
    { key: "resume", label: "Resume or CV ready", done: !!checks.resume, derived: false },
    { key: "transcripts", label: "Transcripts ready", done: !!checks.transcripts, derived: false },
    { key: "sop", label: "Statement of purpose written", done: !!s.has_statement || !!s.sop_version_id, derived: true, hint: "Mark your statement Final in Materials, Statements" },
  ];
  if (need > 0 || letters.length > 0) {
    items.push({ key: "letters", label: `Recommendation letters (${confirmed} of ${need || letters.length} confirmed)`, done: confirmed >= (need || letters.length) && confirmed > 0, derived: true, hint: "Request letters on the Application tab" });
  }
  if (s.gre_policy === "required") items.push({ key: "gre", label: "GRE scores sent", done: !!checks.gre, derived: false });
  if (s.english_test) items.push({ key: "english", label: "English test scores sent", done: !!checks.english, derived: false });
  items.push({ key: "fee", label: "Application fee paid or waived", done: !!checks.fee, derived: false });
  items.push({ key: "submitted", label: "Submitted", done: SUBMITTED.includes(s.status), derived: true, hint: "Set the school status to Submitted" });
  return items;
}

export function assess(s: ReadinessSchool, items: ReadinessItem[], today: string) {
  const submitted = SUBMITTED.includes(s.status);
  const pending = items.filter((i) => !i.done && i.key !== "submitted");
  const days = s.deadline_date ? daysBetween(today, s.deadline_date) : null;
  let risk: Risk = "ok";
  if (submitted) risk = "submitted";
  else if (days == null) risk = "nodate";
  else if (days < 0) risk = "overdue";
  else if (pending.length > 0 && days <= 14) risk = "urgent";
  else if (pending.length >= 3 && days <= 35) risk = "watch";
  const doneCount = items.filter((i) => i.done && i.key !== "submitted").length;
  const total = items.length - 1;
  return { risk, days, pending, doneCount, total };
}

export const RISK_LABEL: Record<Risk, string> = {
  submitted: "Submitted", overdue: "Deadline passed", urgent: "Needs action now", watch: "Start soon", ok: "On track", nodate: "No deadline set",
};
export const RISK_TONE: Record<Risk, string> = {
  submitted: "text-teal-600", overdue: "text-red-600", urgent: "text-red-600", watch: "text-brass", ok: "text-gray-500", nodate: "text-gray-400",
};
export const RISK_ORDER: Record<Risk, number> = { overdue: 0, urgent: 1, watch: 2, ok: 3, nodate: 4, submitted: 5 };
