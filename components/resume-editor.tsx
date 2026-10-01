"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveResume } from "@/app/(app)/materials/actions";
import { emptyEntry, uid, type ResumeData, type ResumeEntry } from "@/lib/resume";
import { resumeFileName, resumeToLatex, resumeToMarkdown } from "@/lib/resume-export";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

type ListKey = "education" | "experience" | "projects";

const SECTION_COPY: Record<ListKey, { title: string; titleLabel: string; orgLabel: string; add: string }> = {
  education: { title: "Education", titleLabel: "Degree", orgLabel: "School", add: "Add education" },
  experience: { title: "Experience", titleLabel: "Role", orgLabel: "Organisation", add: "Add experience" },
  projects: { title: "Projects and research", titleLabel: "Project", orgLabel: "Context (lab, course, personal)", add: "Add project" },
};

const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const secondary = "h-9 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50";
const iconBtn = "flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-slate-100";

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d={dir === "up" ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

function EntryEditor({ list, entry, onChange, onRemove, onMove, first, last }: {
  list: ListKey; entry: ResumeEntry; onChange: (e: ResumeEntry) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void; first: boolean; last: boolean;
}) {
  const c = SECTION_COPY[list];
  const set = (patch: Partial<ResumeEntry>) => onChange({ ...entry, ...patch });
  const heading = [entry.title, entry.org].filter((x) => x.trim()).join(" · ") || `New ${c.titleLabel.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-slate-900">{heading}</span>
        <span className="flex flex-shrink-0 items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={first} aria-label="Move up" className={iconBtn}><Chevron dir="up" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={last} aria-label="Move down" className={iconBtn}><Chevron dir="down" /></button>
          <button type="button" onClick={onRemove} aria-label={`Remove ${heading}`} className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700">Remove</button>
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} placeholder={c.titleLabel} aria-label={c.titleLabel} value={entry.title} onChange={(e) => set({ title: e.target.value })} />
        <input className={input} placeholder={c.orgLabel} aria-label={c.orgLabel} value={entry.org} onChange={(e) => set({ org: e.target.value })} />
        <input className={input} placeholder="Location" aria-label="Location" value={entry.location} onChange={(e) => set({ location: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Start (2023)" aria-label="Start" value={entry.start} onChange={(e) => set({ start: e.target.value })} />
          <input className={input} placeholder="End (or Present)" aria-label="End" value={entry.end} onChange={(e) => set({ end: e.target.value })} />
        </div>
      </div>
      <textarea
        className={input} rows={Math.max(3, entry.bullets.length + 1)} placeholder="One achievement per line. Start with a verb, add a number if you can." aria-label="Achievements"
        value={entry.bullets.join("\n")} onChange={(e) => set({ bullets: e.target.value.split("\n") })}
      />
    </div>
  );
}

function dates(e: ResumeEntry) {
  return [e.start, e.end].filter(Boolean).join(" – ");
}

function Preview({ name, data }: { name: string; data: ResumeData }) {
  const c = data.contact;
  const contactLine = [c.email, c.phone, c.location, c.website, c.github, c.linkedin].filter(Boolean);
  const block = (title: string, entries: ResumeEntry[]) =>
    entries.some((e) => e.title || e.org) && (
      <section className="mt-3">
        <h2>{title}</h2>
        {entries.filter((e) => e.title || e.org).map((e) => (
          <div key={e.id} className="mt-1.5">
            <div className="flex justify-between gap-3">
              <span><b>{e.org || e.title}</b>{e.org && e.title ? `, ${e.title}` : ""}{e.location ? ` — ${e.location}` : ""}</span>
              <span className="whitespace-nowrap">{dates(e)}</span>
            </div>
            <ul>{e.bullets.filter((b) => b.trim()).map((b, i) => <li key={i}>{b.trim()}</li>)}</ul>
          </div>
        ))}
      </section>
    );
  return (
    <div className="resume-paper">
      <h1>{c.name || name}</h1>
      {contactLine.length > 0 && <p className="contact">{contactLine.join("  |  ")}</p>}
      {data.summary.trim() && <section className="mt-3"><h2>Summary</h2><p>{data.summary.trim()}</p></section>}
      {block("Education", data.education)}
      {block("Experience", data.experience)}
      {block("Projects and research", data.projects)}
      {data.publications.some((p) => p.trim()) && (
        <section className="mt-3"><h2>Publications</h2><ul>{data.publications.filter((p) => p.trim()).map((p, i) => <li key={i}>{p.trim()}</li>)}</ul></section>
      )}
      {data.skills.some((s) => s.label || s.items) && (
        <section className="mt-3"><h2>Skills</h2>{data.skills.filter((s) => s.label || s.items).map((s) => <p key={s.id}><b>{s.label}{s.label ? ": " : ""}</b>{s.items}</p>)}</section>
      )}
      {data.awards.some((a) => a.trim()) && (
        <section className="mt-3"><h2>Awards</h2><ul>{data.awards.filter((a) => a.trim()).map((a, i) => <li key={i}>{a.trim()}</li>)}</ul></section>
      )}
    </div>
  );
}

function Section({ title, hint, children, defaultOpen = false, action }: { title: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <span className="text-[15px] font-semibold text-slate-900">{title}{hint && <span className="ml-1 font-normal text-slate-500">· {hint}</span>}</span>
        <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3">
        {children}
        {action}
      </div>
    </details>
  );
}

const addLink = "self-start rounded-md px-2 py-1 text-[13px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700";

export function ResumeEditor({ id, initialName, initial }: { id: string; initialName: string; initial: ResumeData }) {
  const [name, setName] = useState(initialName);
  const [data, setData] = useState<ResumeData>(initial);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const first = useRef(true);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [mode, setMode] = useState<"paper" | "markdown" | "latex">("paper");
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  // Autosave two seconds after the last change. The latest values and a "changes not yet saved" flag are kept in
  // refs so leaving the page (or closing the tab) inside that window still saves or warns.
  const latest = useRef({ name, data });
  latest.current = { name, data };
  const unsaved = useRef(false);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus("dirty");
    unsaved.current = true;
    const t = setTimeout(() => {
      setStatus("saving");
      start(async () => {
        try { await saveResume(id, name, data); unsaved.current = false; setStatus("saved"); setError(null); }
        catch (e) { setStatus("error"); setError(e instanceof Error ? e.message : "Could not save"); }
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [name, data, id]);
  useEffect(() => () => { if (unsaved.current) saveResume(id, latest.current.name, latest.current.data).catch(() => {}); }, [id]);
  useUnsavedGuard(status !== "saved");

  const patch = (p: Partial<ResumeData>) => setData((d) => ({ ...d, ...p }));
  const setContact = (k: keyof ResumeData["contact"], v: string) => setData((d) => ({ ...d, contact: { ...d.contact, [k]: v } }));
  const updateList = (k: ListKey, fn: (l: ResumeEntry[]) => ResumeEntry[]) => setData((d) => ({ ...d, [k]: fn(d[k]) }));
  const move = (k: ListKey, i: number, dir: -1 | 1) =>
    updateList(k, (l) => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const statusText = status === "saved" ? "Saved" : status === "saving" ? "Saving…" : status === "dirty" ? "Unsaved changes" : (error ?? "Could not save");

  // Generated only while their view is open, straight from what is on screen.
  const markdown = useMemo(() => (mode === "markdown" ? resumeToMarkdown(name, data) : ""), [mode, name, data]);
  const latex = useMemo(() => (mode === "latex" ? resumeToLatex(name, data) : ""), [mode, name, data]);

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(resumeToMarkdown(name, data));
      setCopied("copied");
      setTimeout(() => setCopied("idle"), 2000);
    } catch { setCopied("failed"); }
  };
  const downloadTex = () => {
    const url = URL.createObjectURL(new Blob([resumeToLatex(name, data)], { type: "application/x-tex;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = resumeFileName(name, "tex");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const contactFilled = (["name", "email", "phone", "location", "website", "github", "linkedin"] as const).filter((k) => data.contact[k].trim()).length;
  const lines = (l: string[]) => l.filter((x) => x.trim()).length;

  const editor = (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Section title="Contact" hint={`${contactFilled} of 7 filled`} defaultOpen>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["name", "email", "phone", "location", "website", "github", "linkedin"] as const).map((k) => (
            <input key={k} className={input} placeholder={k[0].toUpperCase() + k.slice(1)} aria-label={k[0].toUpperCase() + k.slice(1)} value={data.contact[k]} onChange={(e) => setContact(k, e.target.value)} />
          ))}
        </div>
      </Section>

      <Section title="Summary" hint={data.summary.trim() ? "written" : "empty"}>
        <textarea className={input} rows={3} placeholder="Two sentences on who you are and what you want to research." aria-label="Summary" value={data.summary} onChange={(e) => patch({ summary: e.target.value })} />
      </Section>

      {(Object.keys(SECTION_COPY) as ListKey[]).map((k) => (
        <Section
          key={k} title={SECTION_COPY[k].title} hint={String(data[k].length)} defaultOpen={k === "education"}
          action={<button type="button" onClick={() => updateList(k, (l) => [...l, emptyEntry()])} className={addLink}>+ {SECTION_COPY[k].add}</button>}
        >
          {data[k].length === 0 && <p className="text-[13px] text-slate-500">Nothing here yet.</p>}
          {data[k].map((e, i) => (
            <EntryEditor
              key={e.id} list={k} entry={e} first={i === 0} last={i === data[k].length - 1}
              onChange={(n) => updateList(k, (l) => l.map((x) => (x.id === e.id ? n : x)))}
              onRemove={() => updateList(k, (l) => l.filter((x) => x.id !== e.id))}
              onMove={(dir) => move(k, i, dir)}
            />
          ))}
        </Section>
      ))}

      <Section title="Publications" hint={String(lines(data.publications))}>
        <textarea className={input} rows={4} placeholder="One per line, in citation format." aria-label="Publications" value={data.publications.join("\n")} onChange={(e) => patch({ publications: e.target.value.split("\n") })} />
      </Section>

      <Section
        title="Skills" hint={`${data.skills.length} group${data.skills.length === 1 ? "" : "s"}`}
        action={<button type="button" onClick={() => patch({ skills: [...data.skills, { id: uid(), label: "", items: "" }] })} className={addLink}>+ Add skill group</button>}
      >
        {data.skills.length === 0 && <p className="text-[13px] text-slate-500">No skill groups yet.</p>}
        {data.skills.map((s) => (
          <div key={s.id} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <input className={input} placeholder="Group (Languages)" aria-label="Skill group" value={s.label} onChange={(e) => patch({ skills: data.skills.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)) })} />
            <input className={input} placeholder="Python, PyTorch, SQL" aria-label="Skills" value={s.items} onChange={(e) => patch({ skills: data.skills.map((x) => (x.id === s.id ? { ...x, items: e.target.value } : x)) })} />
            <button type="button" onClick={() => patch({ skills: data.skills.filter((x) => x.id !== s.id) })} aria-label={`Remove ${s.label || "skill group"}`} className="h-9 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700">Remove</button>
          </div>
        ))}
      </Section>

      <Section title="Awards" hint={String(lines(data.awards))}>
        <textarea className={input} rows={3} placeholder="One per line." aria-label="Awards" value={data.awards.join("\n")} onChange={(e) => patch({ awards: e.target.value.split("\n") })} />
      </Section>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 print:hidden">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 text-xs font-medium text-slate-500">
          <span className="whitespace-nowrap">Version name</span>
          <input className={`${input} max-w-sm font-semibold`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NLP research version" />
        </label>
        <span className={`text-xs ${status === "error" ? "font-medium text-red-700" : status === "saved" ? "text-slate-500" : "text-blue-700"}`} aria-live="polite">{statusText}</span>
        <button type="button" onClick={copyMarkdown} className={secondary}>{copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy as Markdown"}</button>
        <button type="button" onClick={downloadTex} className={secondary}>Download .tex</button>
        <button type="button" onClick={() => window.print()} className="h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700">Download PDF</button>
      </div>

      <div className="flex gap-6 border-b border-slate-200 lg:hidden print:hidden" role="tablist">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2.5 text-sm ${tab === t ? "border-blue-600 font-semibold text-slate-900" : "border-transparent font-medium text-slate-500"}`}
          >
            {t === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`${tab === "edit" ? "block" : "hidden"} lg:block print:hidden`}>{editor}</div>
        <div className={`${tab === "preview" ? "block" : "hidden"} lg:block`}>
          <div className="flex flex-col gap-2.5 lg:sticky lg:top-20">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Preview as">
                {([["paper", "Paper"], ["markdown", "Markdown"], ["latex", "LaTeX"]] as const).map(([m, label], i) => (
                  <button
                    key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                    className={`h-8 px-3 text-[13px] font-medium ${i > 0 ? "border-l border-slate-300" : ""} ${mode === m ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:text-slate-900"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">Live, from what you type</span>
            </div>
            {/* The paper is always rendered so printing works from any view. */}
            <div className={`resume-print rounded-lg bg-slate-200 p-4 sm:p-5 print:bg-transparent print:p-0 ${mode === "paper" ? "" : "hidden print:block"}`}>
              <Preview name={name} data={data} />
            </div>
            {mode !== "paper" && (
              <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-5 font-mono text-[12.5px] leading-relaxed text-slate-100 print:hidden">
                {mode === "markdown" ? markdown : latex}
              </pre>
            )}
            <p className="text-xs text-slate-500 print:hidden">
              {mode === "paper"
                ? <>In the print window, choose &ldquo;Save as PDF&rdquo; and turn off headers and footers.</>
                : mode === "latex"
                  ? "Compiles with pdflatex. Generated from this resume; nothing extra is saved."
                  : "Generated from this resume; nothing extra is saved."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
