export type ResumeEntry = { id: string; title: string; org: string; location: string; start: string; end: string; bullets: string[] };
export type ResumeData = {
  contact: { name: string; email: string; phone: string; location: string; website: string; github: string; linkedin: string };
  summary: string;
  education: ResumeEntry[];
  experience: ResumeEntry[];
  projects: ResumeEntry[];
  publications: string[];
  skills: Array<{ id: string; label: string; items: string }>;
  awards: string[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyEntry = (): ResumeEntry => ({ id: uid(), title: "", org: "", location: "", start: "", end: "", bullets: [""] });

export const emptyResume = (): ResumeData => ({
  contact: { name: "", email: "", phone: "", location: "", website: "", github: "", linkedin: "" },
  summary: "",
  education: [],
  experience: [],
  projects: [],
  publications: [],
  skills: [],
  awards: [],
});

// Older saved rows may miss fields; fill them so the editor never crashes.
export function normalizeResume(raw: any): ResumeData {
  const base = emptyResume();
  const r = raw && typeof raw === "object" ? raw : {};
  const entries = (x: any): ResumeEntry[] =>
    Array.isArray(x) ? x.map((e) => ({ ...emptyEntry(), ...e, id: e?.id ?? uid(), bullets: Array.isArray(e?.bullets) ? e.bullets : [""] })) : [];
  return {
    contact: { ...base.contact, ...(r.contact ?? {}) },
    summary: typeof r.summary === "string" ? r.summary : "",
    education: entries(r.education),
    experience: entries(r.experience),
    projects: entries(r.projects),
    publications: Array.isArray(r.publications) ? r.publications.map(String) : [],
    skills: Array.isArray(r.skills) ? r.skills.map((s: any) => ({ id: s?.id ?? uid(), label: String(s?.label ?? ""), items: String(s?.items ?? "") })) : [],
    awards: Array.isArray(r.awards) ? r.awards.map(String) : [],
  };
}

export const DOC_KINDS = [
  { key: "resume", label: "Resume" },
  { key: "cv", label: "CV" },
  { key: "transcript", label: "Transcript" },
  { key: "statement", label: "Statement of purpose" },
  { key: "writing_sample", label: "Writing sample" },
  { key: "scores", label: "Test scores" },
  { key: "letter", label: "Recommendation letter" },
  { key: "other", label: "Other" },
] as const;
export type DocKind = (typeof DOC_KINDS)[number]["key"];

export const formatBytes = (n: number | null) => (n == null ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
