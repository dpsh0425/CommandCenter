"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { addPaperTemplate, addSection, deleteSection, moveSection, saveSectionDraft, updateSection } from "@/app/(app)/research/experiment-actions";
import { SECTION_STATUS, countWords } from "@/lib/research";

export type SectionRow = {
  id: string; name: string; status: string; position: number; target_words: number | null; words: number; body: string; notes: string | null; due_date: string | null; person_id: string | null;
};
type Opt = { id: string; name: string };

const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const num = (n: number) => n.toLocaleString();

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => { try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

function Draft({ id, initial, onWords }: { id: string; initial: string; onWords: (n: number) => void }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setState("dirty");
    const t = setTimeout(async () => {
      setState("saving");
      try { onWords(await saveSectionDraft(id, text)); setState("saved"); } catch { setState("error"); }
    }, 1500);
    return () => clearTimeout(t);
    // onWords is stable enough for this purpose; re-running on it would restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, id]);
  return (
    <div className="flex flex-col gap-1">
      <textarea value={text} onChange={(e) => { setText(e.target.value); onWords(countWords(e.target.value)); }} rows={14} placeholder="Write here. It saves on its own." className={field + " font-serif text-base leading-relaxed"} aria-label="Draft" />
      <div className="text-xs text-gray-400 flex justify-between">
        <span>{num(countWords(text))} words</span>
        <span className={state === "error" ? "text-red-600" : ""}>{state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "dirty" ? "Unsaved changes" : "Could not save. Copy your text before leaving."}</span>
      </div>
    </div>
  );
}

function Section({ s, projectId, people, first, last }: { s: SectionRow; projectId: string; people: Opt[]; first: boolean; last: boolean }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState(s.words);
  const target = s.target_words ?? 0;
  const pct = target ? Math.min(100, Math.round((words / target) * 100)) : 0;
  const over = target > 0 && words > target;

  return (
    <li className={`border-b border-line/60 last:border-0 py-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-baseline gap-3">
        <button onClick={() => setOpen((v) => !v)} className="text-left flex-1 min-w-0" aria-expanded={open}>
          <span className={`font-medium ${s.status === "done" ? "text-gray-500 line-through" : ""}`}>{s.name}</span>
          <span className="block text-xs text-gray-400">
            {num(words)}{target ? ` of ${num(target)} words` : " words"}{over ? " · over target" : ""}{s.due_date ? ` · due ${s.due_date.slice(5)}` : ""}
          </span>
        </button>
        <select value={s.status} onChange={(e) => run(() => updateSection(s.id, projectId, { status: e.target.value }))} className="border rounded px-2 py-1 text-xs bg-transparent" aria-label={`Status of ${s.name}`}>
          {SECTION_STATUS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </div>
      {target > 0 && <div className="h-1 rounded bg-surface-raised overflow-hidden mt-2"><div className={`h-full ${over ? "bg-brass" : s.status === "done" ? "bg-teal-600" : "bg-brass/70"}`} style={{ width: `${pct}%` }} /></div>}

      {open && (
        <div className="flex flex-col gap-4 pt-4 text-sm">
          <Draft id={s.id} initial={s.body} onWords={setWords} />
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
              run(() => updateSection(s.id, projectId, { name: v("name"), targetWords: Number(v("target")) || null, dueDate: v("due") || null, personId: v("person") || null, notes: v("notes") || null }));
            }}
          >
            <label className="flex flex-col gap-1 text-gray-500">Section name<input name="name" defaultValue={s.name} required className={field + " text-cream"} /></label>
            <label className="flex flex-col gap-1 text-gray-500">Target words<input name="target" type="number" min={0} defaultValue={s.target_words ?? ""} className={field + " text-cream"} /></label>
            <label className="flex flex-col gap-1 text-gray-500">Due<input name="due" type="date" defaultValue={s.due_date ?? ""} className={field + " text-cream"} /></label>
            <label className="flex flex-col gap-1 text-gray-500">Owner
              <select name="person" defaultValue={s.person_id ?? ""} className={field + " text-cream bg-transparent"}><option value="">Not set</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Notes to self: points to cover, feedback to address<textarea name="notes" defaultValue={s.notes ?? ""} rows={3} className={field + " text-cream"} /></label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
              <button disabled={pending} className={primary}>Save details</button>
              {!first && <button type="button" onClick={() => run(() => moveSection(s.id, projectId, -1))} className="text-gray-500 hover:text-cream">Move up</button>}
              {!last && <button type="button" onClick={() => run(() => moveSection(s.id, projectId, 1))} className="text-gray-500 hover:text-cream">Move down</button>}
              <button type="button" onClick={() => { if (confirm(`Delete "${s.name}" and its draft?`)) run(() => deleteSection(s.id, projectId)); }} className="text-gray-500 hover:text-red-600">Delete</button>
            </div>
          </form>
        </div>
      )}
      {error && <p className="text-red-600 text-xs pt-2">{error}</p>}
    </li>
  );
}

export function WritingBoard({ projectId, sections, people, venue, deadlineText }: { projectId: string; sections: SectionRow[]; people: Opt[]; venue: string | null; deadlineText: string | null }) {
  const { pending, error, run } = useRun();
  const [copied, setCopied] = useState(false);
  const totalWords = sections.reduce((n, s) => n + s.words, 0);
  const totalTarget = sections.reduce((n, s) => n + (s.target_words ?? 0), 0);
  const done = sections.filter((s) => s.status === "done").length;

  return (
    <div className="flex flex-col gap-6">
      {sections.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            <span className="font-mono text-cream">{num(totalWords)}</span>{totalTarget ? <> of <span className="font-mono text-cream">{num(totalTarget)}</span></> : null} words ·{" "}
            <span className="font-mono text-cream">{done}</span> of <span className="font-mono text-cream">{sections.length}</span> sections done
            {venue && <> · {venue}{deadlineText ? `, due ${deadlineText}` : ""}</>}
          </p>
          {totalTarget > 0 && <div className="h-1.5 rounded bg-surface-raised overflow-hidden"><div className="h-full bg-brass" style={{ width: `${Math.min(100, Math.round((totalWords / totalTarget) * 100))}%` }} /></div>}
        </div>
      )}

      {sections.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">Plan the paper section by section, with a word target and an owner for each, and draft it here. Start with a standard outline and change it to fit.</p>
          <button disabled={pending} onClick={() => run(() => addPaperTemplate(projectId))} className={primary + " self-start"}>Start from a paper outline</button>
        </div>
      ) : (
        <ul>{sections.map((s, i) => <Section key={s.id} s={s} projectId={projectId} people={people} first={i === 0} last={i === sections.length - 1} />)}</ul>
      )}

      <form
        className="flex flex-wrap gap-2 items-center text-sm border-t border-line pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          run(() => addSection(projectId, String(f.get("name") ?? ""), Number(f.get("target")) || null), () => form.reset());
        }}
      >
        <input name="name" required placeholder="Add a section" className={field + " flex-1 min-w-[12rem]"} />
        <input name="target" type="number" min={0} placeholder="Target words" className={field + " max-w-[9rem]"} aria-label="Target words" />
        <button disabled={pending} className={primary}>Add</button>
        {sections.length > 0 && (
          <>
            <button type="button" onClick={() => run(() => addPaperTemplate(projectId))} className="text-gray-500 hover:text-cream">Add missing standard sections</button>
            <button
              type="button"
              onClick={async () => {
                const md = sections.map((s) => `## ${s.name}\n\n${s.body.trim()}`).join("\n\n");
                try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
              }}
              className="text-gray-500 hover:text-cream"
            >
              {copied ? "Copied" : "Copy the whole draft"}
            </button>
          </>
        )}
        {error && <span className="text-red-600 text-xs basis-full">{error}</span>}
      </form>
    </div>
  );
}
