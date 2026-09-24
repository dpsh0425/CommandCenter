export const PROJECT_STATUS = [
  { key: "idea", label: "Idea" },
  { key: "planning", label: "Planning" },
  { key: "active", label: "Active" },
  { key: "writing", label: "Writing" },
  { key: "submitted", label: "Submitted" },
  { key: "published", label: "Published" },
  { key: "paused", label: "Paused" },
] as const;

export const ENTRY_KINDS = [
  { key: "experiment", label: "Experiment" },
  { key: "coding", label: "Coding" },
  { key: "data", label: "Data work" },
  { key: "analysis", label: "Analysis" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
  { key: "meeting", label: "Meeting" },
  { key: "decision", label: "Decision" },
  { key: "idea", label: "Idea" },
  { key: "admin", label: "Admin" },
  { key: "other", label: "Other" },
] as const;

export const PAPER_STATUS = [
  { key: "to_read", label: "To read" },
  { key: "reading", label: "Reading" },
  { key: "read", label: "Read" },
  { key: "cite", label: "Will cite" },
] as const;

export const EXPERIMENT_STATUS = [
  { key: "planned", label: "Planned" },
  { key: "running", label: "Running" },
  { key: "done", label: "Done" },
  { key: "failed", label: "Failed" },
  { key: "abandoned", label: "Abandoned" },
] as const;
export const EXPERIMENT_OUTCOME = [
  { key: "supported", label: "Hypothesis supported" },
  { key: "refuted", label: "Hypothesis refuted" },
  { key: "inconclusive", label: "Inconclusive" },
] as const;
export type Metric = { name: string; value: string };

export const SECTION_STATUS = [
  { key: "not_started", label: "Not started" },
  { key: "outlining", label: "Outlining" },
  { key: "drafting", label: "Drafting" },
  { key: "revising", label: "Revising" },
  { key: "done", label: "Done" },
] as const;

export const PAPER_TEMPLATE: Array<{ name: string; words: number }> = [
  { name: "Abstract", words: 200 },
  { name: "Introduction", words: 800 },
  { name: "Related work", words: 700 },
  { name: "Method", words: 1200 },
  { name: "Experiments", words: 1200 },
  { name: "Results", words: 800 },
  { name: "Discussion", words: 500 },
  { name: "Limitations", words: 250 },
  { name: "Conclusion", words: 250 },
];

export const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export const kindLabel =(k: string) => ENTRY_KINDS.find((x) => x.key === k)?.label ?? k;
export const projectStatusLabel = (k: string) => PROJECT_STATUS.find((x) => x.key === k)?.label ?? k;

export const formatMinutes = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);

export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
export const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d === -1 ? "yesterday" : d < 0 ? `${-d}d overdue` : `in ${d}d`);
