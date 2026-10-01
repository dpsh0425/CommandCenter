// Turns resume data into Markdown or LaTeX source, entirely in the browser. Nothing here is stored.
import type { ResumeData, ResumeEntry } from "@/lib/resume";

const clean = (s: string) => s.trim();
const hasEntry = (e: ResumeEntry) => !!(e.title || e.org);
const dates = (e: ResumeEntry) => [e.start, e.end].map(clean).filter(Boolean).join(" – ");
const contactBits = (d: ResumeData) =>
  [d.contact.email, d.contact.phone, d.contact.location, d.contact.website, d.contact.github, d.contact.linkedin].map(clean).filter(Boolean);

const SECTIONS: Array<{ key: "education" | "experience" | "projects"; title: string }> = [
  { key: "education", title: "Education" },
  { key: "experience", title: "Experience" },
  { key: "projects", title: "Projects and research" },
];

export function resumeToMarkdown(name: string, d: ResumeData): string {
  const out: string[] = [`# ${clean(d.contact.name) || clean(name) || "Resume"}`];
  const contact = contactBits(d);
  if (contact.length) out.push("", contact.join(" | "));
  if (clean(d.summary)) out.push("", "## Summary", "", clean(d.summary));
  for (const s of SECTIONS) {
    const list = d[s.key].filter(hasEntry);
    if (!list.length) continue;
    out.push("", `## ${s.title}`);
    for (const e of list) {
      const head = `**${clean(e.org) || clean(e.title)}**${e.org && e.title ? `, ${clean(e.title)}` : ""}${clean(e.location) ? ` — ${clean(e.location)}` : ""}`;
      out.push("", dates(e) ? `${head} · ${dates(e)}` : head);
      const bullets = e.bullets.map(clean).filter(Boolean);
      if (bullets.length) out.push("", ...bullets.map((b) => `- ${b}`));
    }
  }
  const pubs = d.publications.map(clean).filter(Boolean);
  if (pubs.length) out.push("", "## Publications", "", ...pubs.map((p) => `- ${p}`));
  const skills = d.skills.filter((s) => s.label || s.items);
  if (skills.length) out.push("", "## Skills", "", ...skills.map((s) => `- ${s.label ? `**${clean(s.label)}:** ` : ""}${clean(s.items)}`));
  const awards = d.awards.map(clean).filter(Boolean);
  if (awards.length) out.push("", "## Awards", "", ...awards.map((a) => `- ${a}`));
  return out.join("\n") + "\n";
}

// Escapes the characters LaTeX treats as commands, in one pass so an inserted escape is never escaped again.
const TEX: Record<string, string> = {
  "\\": "\\textbackslash{}", "#": "\\#", "$": "\\$", "%": "\\%", "&": "\\&", "_": "\\_", "{": "\\{", "}": "\\}",
  "~": "\\textasciitilde{}", "^": "\\textasciicircum{}", "–": "--", "—": "---",
};
const tex = (s: string) => clean(s).replace(/[\\#$%&_{}~^–—]/g, (c) => TEX[c]);

const itemize = (items: string[]) => (items.length ? ["\\begin{itemize}", ...items.map((i) => `  \\item ${tex(i)}`), "\\end{itemize}"] : []);

export function resumeToLatex(name: string, d: ResumeData): string {
  const out: string[] = [
    "\\documentclass[11pt]{article}",
    "\\usepackage[margin=0.7in]{geometry}",
    "\\usepackage[hidelinks]{hyperref}",
    "\\usepackage{enumitem}",
    "\\setlist{nosep,leftmargin=1.2em}",
    "\\pagestyle{empty}",
    "\\begin{document}",
    "\\begin{center}",
    `  {\\LARGE \\textbf{${tex(d.contact.name || name || "Resume")}}}`,
  ];
  const contact = contactBits(d);
  if (contact.length) out.push("  \\\\[2pt]", `  ${contact.map(tex).join(" $|$ ")}`);
  out.push("\\end{center}");
  if (clean(d.summary)) out.push("", "\\section*{Summary}", tex(d.summary));
  for (const s of SECTIONS) {
    const list = d[s.key].filter(hasEntry);
    if (!list.length) continue;
    out.push("", `\\section*{${s.title}}`);
    for (const e of list) {
      const head = `\\textbf{${tex(e.org || e.title)}}${e.org && e.title ? `, ${tex(e.title)}` : ""}${clean(e.location) ? ` --- ${tex(e.location)}` : ""}`;
      out.push(dates(e) ? `${head} \\hfill ${tex(dates(e))}` : head);
      out.push(...itemize(e.bullets.map(clean).filter(Boolean)));
      out.push("");
    }
  }
  const pubs = d.publications.map(clean).filter(Boolean);
  if (pubs.length) out.push("", "\\section*{Publications}", ...itemize(pubs));
  const skills = d.skills.filter((s) => s.label || s.items);
  if (skills.length) {
    out.push("", "\\section*{Skills}");
    out.push(skills.map((s) => `${s.label ? `\\textbf{${tex(s.label)}:} ` : ""}${tex(s.items)}`).join(" \\\\\n"));
  }
  const awards = d.awards.map(clean).filter(Boolean);
  if (awards.length) out.push("", "\\section*{Awards}", ...itemize(awards));
  out.push("", "\\end{document}");
  return out.join("\n") + "\n";
}

/** A file name that is safe on every system: "NLP research version.tex". */
export const resumeFileName = (name: string, ext: string) => `${(name.trim() || "resume").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80)}.${ext}`;
