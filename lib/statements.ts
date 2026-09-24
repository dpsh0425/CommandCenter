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
