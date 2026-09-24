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

export const kindLabel = (k: string) => ENTRY_KINDS.find((x) => x.key === k)?.label ?? k;
export const projectStatusLabel = (k: string) => PROJECT_STATUS.find((x) => x.key === k)?.label ?? k;

export const formatMinutes = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);

export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
export const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d === -1 ? "yesterday" : d < 0 ? `${-d}d overdue` : `in ${d}d`);
