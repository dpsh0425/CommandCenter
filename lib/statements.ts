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
