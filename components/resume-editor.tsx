"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveResume } from "@/app/(app)/materials/actions";
import { emptyEntry, uid, type ResumeData, type ResumeEntry } from "@/lib/resume";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";

type ListKey = "education" | "experience" | "projects";

const SECTION_COPY: Record<ListKey, { title: string; titleLabel: string; orgLabel: string; add: string }> = {
  education: { title: "Education", titleLabel: "Degree", orgLabel: "School", add: "Add education" },
  experience: { title: "Experience", titleLabel: "Role", orgLabel: "Organisation", add: "Add experience" },
  projects: { title: "Projects and research", titleLabel: "Project", orgLabel: "Context (lab, course, personal)", add: "Add project" },
};

const input = "border rounded px-2 py-1.5 text-sm w-full";

function EntryEditor({ list, entry, onChange, onRemove, onMove }: {
  list: ListKey; entry: ResumeEntry; onChange: (e: ResumeEntry) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const c = SECTION_COPY[list];
  const set = (patch: Partial<ResumeEntry>) => onChange({ ...entry, ...patch });
  return (
    <div className="flex flex-col gap-2 border-l-2 border-line pl-3 py-1">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} placeholder={c.titleLabel} value={entry.title} onChange={(e) => set({ title: e.target.value })} />
        <input className={input} placeholder={c.orgLabel} value={entry.org} onChange={(e) => set({ org: e.target.value })} />
        <input className={input} placeholder="Location" value={entry.location} onChange={(e) => set({ location: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Start (2023)" value={entry.start} onChange={(e) => set({ start: e.target.value })} />
          <input className={input} placeholder="End (or Present)" value={entry.end} onChange={(e) => set({ end: e.target.value })} />
        </div>
      </div>
      <textarea
        className={input} rows={Math.max(3, entry.bullets.length + 1)} placeholder="One achievement per line. Start with a verb, add a number if you can."
        value={entry.bullets.join("\n")} onChange={(e) => set({ bullets: e.target.value.split("\n") })}
      />
      <div className="flex gap-3 text-xs text-gray-500">
        <button type="button" onClick={() => onMove(-1)} className="hover:text-cream">Move up</button>
        <button type="button" onClick={() => onMove(1)} className="hover:text-cream">Move down</button>
        <button type="button" onClick={onRemove} className="hover:text-red-600">Remove</button>
      </div>
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

export function ResumeEditor({ id, initialName, initial }: { id: string; initialName: string; initial: ResumeData }) {
  const [name, setName] = useState(initialName);
  const [data, setData] = useState<ResumeData>(initial);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const first = useRef(true);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

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

  const editor = (
    <div className="flex flex-col gap-7 min-w-0">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">Version name</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NLP research version" />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Contact</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["name", "email", "phone", "location", "website", "github", "linkedin"] as const).map((k) => (
            <input key={k} className={input} placeholder={k[0].toUpperCase() + k.slice(1)} value={data.contact[k]} onChange={(e) => setContact(k, e.target.value)} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Summary</h2>
        <textarea className={input} rows={3} placeholder="Two sentences on who you are and what you want to research." value={data.summary} onChange={(e) => patch({ summary: e.target.value })} />
      </section>

      {(Object.keys(SECTION_COPY) as ListKey[]).map((k) => (
        <section key={k} className="flex flex-col gap-3">
          <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">{SECTION_COPY[k].title}</h2>
          {data[k].map((e, i) => (
            <EntryEditor
              key={e.id} list={k} entry={e}
              onChange={(n) => updateList(k, (l) => l.map((x) => (x.id === e.id ? n : x)))}
              onRemove={() => updateList(k, (l) => l.filter((x) => x.id !== e.id))}
              onMove={(dir) => move(k, i, dir)}
            />
          ))}
          <button type="button" onClick={() => updateList(k, (l) => [...l, emptyEntry()])} className="text-sm text-brass hover:underline self-start">+ {SECTION_COPY[k].add}</button>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Publications</h2>
        <textarea className={input} rows={4} placeholder="One per line, in citation format." value={data.publications.join("\n")} onChange={(e) => patch({ publications: e.target.value.split("\n") })} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Skills</h2>
        {data.skills.map((s) => (
          <div key={s.id} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <input className={input} placeholder="Group (Languages)" value={s.label} onChange={(e) => patch({ skills: data.skills.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)) })} />
            <input className={input} placeholder="Python, PyTorch, SQL" value={s.items} onChange={(e) => patch({ skills: data.skills.map((x) => (x.id === s.id ? { ...x, items: e.target.value } : x)) })} />
            <button type="button" onClick={() => patch({ skills: data.skills.filter((x) => x.id !== s.id) })} className="text-xs text-gray-500 hover:text-red-600 text-left">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => patch({ skills: [...data.skills, { id: uid(), label: "", items: "" }] })} className="text-sm text-brass hover:underline self-start">+ Add skill group</button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">Awards</h2>
        <textarea className={input} rows={3} placeholder="One per line." value={data.awards.join("\n")} onChange={(e) => patch({ awards: e.target.value.split("\n") })} />
      </section>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex gap-5 border-b border-line lg:hidden">
          {(["edit", "preview"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm border-b-2 -mb-px ${tab === t ? "border-brass text-cream font-medium" : "border-transparent text-gray-500"}`}>{t === "edit" ? "Edit" : "Preview"}</button>
          ))}
        </div>
        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className={status === "error" ? "text-red-600" : "text-gray-400"} aria-live="polite">{statusText}</span>
          <button onClick={() => window.print()} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm">Download PDF</button>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`${tab === "edit" ? "block" : "hidden"} lg:block print:hidden`}>{editor}</div>
        <div className={`${tab === "preview" ? "block" : "hidden"} lg:block`}>
          <div className="lg:sticky lg:top-6 resume-print">
            <Preview name={name} data={data} />
            <p className="text-xs text-gray-400 mt-3 print:hidden">In the print window, choose &ldquo;Save as PDF&rdquo; and turn off headers and footers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
