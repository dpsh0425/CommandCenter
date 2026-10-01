// Plain helpers, safe to use in server and client components alike.
const TYPE_LABEL: Record<string, string> = {
  assistantship: "Assistantship (RA/TA)", fellowship: "Fellowship", scholarship: "Scholarship",
  tuition_waiver: "Tuition waiver", stipend: "Stipend", other: "Other",
};
const STATUS_LABEL: Record<string, string> = {
  to_research: "To research", eligible: "Eligible", applied: "Applied", awarded: "Awarded", not_eligible: "Not eligible",
};

export const fundingTypeLabel = (t: string) => TYPE_LABEL[t] ?? t;
export const fundingStatusLabel = (s: string) => STATUS_LABEL[s] ?? s;
