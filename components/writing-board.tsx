"use client";
import { useState, useTransition } from "react";
import { addPaperTemplate, addSection, deleteSection, moveSection, saveSectionDraft, updateSection } from "@/app/(app)/research/experiment-actions";
import { SECTION_STATUS } from "@/lib/research";
import { RichDraft } from "@/components/rich-draft";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";

export type SectionRow = {
  id: string; name: string; status: string; position: number; target_words: number | null; words: number; body: string; body_version: number; notes: string | null; due_date: string | null; person_id: string | null;
};
type Opt = { id: string; name: string };

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-xs font-medium text-slate-600";
const ghost = "h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60";
const num = (n: number) => n.toLocaleString("en-US");
const SECTION_TONE: Record<string, string> = {
  not_started: "border-slate-300 bg-white text-slate-600",
  outlining: "border-slate-300 bg-slate-50 text-slate-700",
  drafting: "border-blue-200 bg-blue-50 text-blue-700",
  revising: "border-violet-200 bg-violet-50 text-violet-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => { try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

function Section({ s, projectId, people, first, last }: { s: SectionRow; projectId: string; people: Opt[]; first: boolean; last: boolean }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [words, setWords] = useState(s.words);
  const target = s.target_words ?? 0;
  const pct = target ? Math.min(100, Math.round((words / target) * 100)) : 0;
  const over = target > 0 && words > target;

  return (
    <li className={`rounded-lg border border-slate-200 bg-white ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 px-5 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className={`text-[15px] font-semibold ${s.status === "done" ? "text-slate-500 line-through" : "text-slate-900"}`}>{s.name}</span>
          <span className="block text-xs text-slate-500">
            <span className="tabular-nums">{num(words)}{target ? ` of ${num(target)} words` : " words"}</span>
            {over && <span className="font-medium text-blue-700"> · over target</span>}
            {s.due_date ? ` · due ${s.due_date.slice(5)}` : ""}
          </span>
        </button>
        <select value={s.status} onChange={(e) => run(() => updateSection(s.id, projectId, { status: e.target.value }))} className={`h-7 flex-shrink-0 cursor-pointer rounded-full border px-2 text-xs font-medium ${SECTION_TONE[s.status] ?? SECTION_TONE.not_started}`} aria-label={`Status of ${s.name}`}>
          {SECTION_STATUS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
        <button type="button" onClick={() => setOpen((v) => !v)} className="h-7 flex-shrink-0 rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={open ? `Close ${s.name}` : `Open ${s.name}`}>{open ? "Close" : "Write"}</button>
      </div>
      {target > 0 && (
        <div className="px-5 pb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${s.status === "done" ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4">
          <RichDraft kind="section" id={s.id} initial={s.body} version={s.body_version} save={saveSectionDraft} onWords={setWords} label={`Draft of ${s.name}`} variant="full" minHeight="18rem" />
          <form
            className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
              run(() => updateSection(s.id, projectId, { name: v("name"), targetWords: Number(v("target")) || null, dueDate: v("due") || null, personId: v("person") || null, notes: v("notes") || null }));
            }}
          >
            <label className={labelCls}>Section name<input name="name" defaultValue={s.name} required className={field} /></label>
            <label className={labelCls}>Target words<input name="target" type="number" min={0} defaultValue={s.target_words ?? ""} className={field} /></label>
            <label className={labelCls}>Due<input name="due" type="date" defaultValue={s.due_date ?? ""} className={field} /></label>
            <label className={labelCls}>Owner
              <select name="person" defaultValue={s.person_id ?? ""} className={field}><option value="">Not set</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label className={`${labelCls} sm:col-span-2`}>Notes to self: points to cover, feedback to address<textarea name="notes" defaultValue={s.notes ?? ""} rows={3} className={field} /></label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button disabled={pending} className={primary}>{pending ? "Saving…" : "Save details"}</button>
              {!first && <button type="button" disabled={pending} onClick={() => run(() => moveSection(s.id, projectId, -1))} className={ghost}>↑ Move up</button>}
              {!last && <button type="button" disabled={pending} onClick={() => run(() => moveSection(s.id, projectId, 1))} className={ghost}>↓ Move down</button>}
              {confirming ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[13px] text-red-800" role="group" aria-label="Confirm delete">
                  Delete &ldquo;{s.name}&rdquo; and its draft?
                  <button type="button" disabled={pending} onClick={() => { setConfirming(false); run(() => deleteSection(s.id, projectId)); }} className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">Delete</button>
                  <button type="button" onClick={() => setConfirming(false)} className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white">Keep</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700">Delete</button>
              )}
            </div>
          </form>
        </div>
      )}
      {error && <p role="alert" className="px-5 pb-3 text-xs text-red-700">{error}</p>}
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
    <div className="flex flex-col gap-4">
      {sections.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Words</div>
            <div className="text-[22px] font-semibold tabular-nums text-slate-900">{num(totalWords)}{totalTarget ? <span className="text-sm font-normal text-slate-500"> of {num(totalTarget)}</span> : null}</div>
            {totalTarget > 0 && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.round((totalWords / totalTarget) * 100))}%` }} /></div>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Sections done</div>
            <div className="text-[22px] font-semibold tabular-nums text-slate-900">{done}<span className="text-sm font-normal text-slate-500"> of {sections.length}</span></div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Venue</div>
            <div className="truncate text-[15px] font-semibold text-slate-900">{venue ?? <span className="font-normal text-slate-400">Not set</span>}</div>
            {venue && deadlineText && <div className="text-xs text-slate-500">due {deadlineText}</div>}
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No sections yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Plan the paper section by section, with a word target and an owner for each, and draft it here. Start with a standard outline and change it to fit.</p>
          <button type="button" disabled={pending} onClick={() => run(() => addPaperTemplate(projectId))} className={`${primary} mt-3`}>Start from a paper outline</button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">{sections.map((s, i) => <Section key={s.id} s={s} projectId={projectId} people={people} first={i === 0} last={i === sections.length - 1} />)}</ul>
      )}

      <form
        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          run(() => addSection(projectId, String(f.get("name") ?? ""), Number(f.get("target")) || null), () => form.reset());
        }}
      >
        <input name="name" required placeholder="Add a section" aria-label="Section name" className={`${field} min-w-[12rem] flex-1`} />
        <input name="target" type="number" min={0} placeholder="Target words" className={`${field} w-36`} aria-label="Target words" />
        <button disabled={pending} className={primary}>Add</button>
        {sections.length > 0 && (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => addPaperTemplate(projectId))} className={ghost}>Add missing standard sections</button>
            <button
              type="button"
              onClick={async () => {
                const md = sections.map((s) => `## ${s.name}\n\n${htmlToText(toEditorHtml(s.body)).trim()}`).join("\n\n");
                try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
              }}
              className={ghost}
            >
              {copied ? "Copied" : "Copy the whole draft"}
            </button>
          </>
        )}
        {error && <span role="alert" className="basis-full text-xs text-red-700">{error}</span>}
      </form>
    </div>
  );
}
