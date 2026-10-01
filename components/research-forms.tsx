"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addEntry, addMeeting, addMember, addPaper, addProjectMilestone, addProjectTask, createProject, deleteEntry, deleteMeeting, deletePaper,
  deleteProject, removeMember, updateMeeting, updatePaper, updateProject,
} from "@/app/(app)/research/project-actions";
import { RichEditorLazy } from "@/components/rich-editor-lazy";
import { RichHtml } from "@/components/rich-view";
import { lookupPaper } from "@/app/(app)/research/library-actions";
import { ENTRY_KINDS, PAPER_STATUS, PROJECT_STATUS, formatMinutes, kindLabel, localDate } from "@/lib/research";

type Opt = { id: string; name: string };

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => {
      try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  };
  return { pending, error, run };
}

// Remembers the last person picked for a given purpose on a project (in this browser).
// A team of exactly one defaults to that person.
function useRememberedPerson(storageKey: string, people: Opt[], teamSize: number) {
  const [person, setPerson] = useState<string>(people.length === 1 && teamSize === 1 ? people[0].id : "");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && people.some((p) => p.id === saved)) setPerson(saved);
    } catch { /* storage unavailable: keep the computed default */ }
  }, [storageKey, people]);
  const choose = (id: string) => {
    setPerson(id);
    try { if (id) localStorage.setItem(storageKey, id); else localStorage.removeItem(storageKey); } catch { /* ignore */ }
  };
  return [person, choose] as const;
}

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-xs font-medium text-slate-600";
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const Err = ({ message }: { message: string | null }) => (message ? <span role="alert" className="text-xs text-red-700">{message}</span> : null);

/** A button that asks in place: "question [confirmLabel] [Keep]". */
function ConfirmButton({ label, question, confirmLabel = "Delete", onConfirm, disabled, className }: {
  label: string; question: string; confirmLabel?: string; onConfirm: () => void; disabled?: boolean; className: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={className}>{label}</button>;
  return (
    <span role="group" aria-label={question} className="inline-flex flex-wrap items-center gap-1.5 rounded-md bg-red-50 py-1 pl-2.5 pr-1 text-xs text-red-800">
      {question}
      <button type="button" disabled={disabled} onClick={() => { setAsking(false); onConfirm(); }} className="h-6 rounded bg-red-600 px-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{confirmLabel}</button>
      <button type="button" onClick={() => setAsking(false)} className="h-6 rounded px-2 font-medium text-slate-700 hover:bg-white">Keep</button>
    </span>
  );
}

export function NewProjectForm() {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={primary}>+ New project</button>;
  return (
    <form
      className="flex w-full flex-col gap-3 rounded-lg border border-blue-200 bg-white p-5 sm:w-[520px]"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(async () => router.push(`/research/projects/${await createProject({ title: val(f, "title"), question: val(f, "question"), status: val(f, "status") })}`));
      }}
    >
      <h2 className="text-[15px] font-semibold text-slate-900">New project</h2>
      <input name="title" required autoFocus placeholder="Project title" aria-label="Project title" className={field} />
      <textarea name="question" rows={2} placeholder="The research question, in one or two sentences (optional)" aria-label="Research question" className={field} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="status" defaultValue="planning" className={`${field} w-40`} aria-label="Status">
          {PROJECT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button disabled={pending} className={primary}>{pending ? "Creating…" : "Create project"}</button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
        <Err message={error} />
      </div>
    </form>
  );
}

export function ProjectEditForm({ p }: { p: { id: string; title: string; question: string | null; description: string | null; status: string; start_date: string | null; target_date: string | null; venue: string | null; venue_deadline: string | null } }) {
  const { pending, error, run } = useRun();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSaved(false);
        run(() => updateProject(p.id, {
          title: val(f, "title"), question: val(f, "question") || null, description: val(f, "description") || null, status: val(f, "status"),
          startDate: val(f, "start") || null, targetDate: val(f, "target") || null, venue: val(f, "venue") || null, venueDeadline: val(f, "venue_deadline") || null,
        }), () => setSaved(true));
      }}
    >
      <label className={`${labelCls} sm:col-span-2`}>Title<input name="title" defaultValue={p.title} required className={field} /></label>
      <label className={`${labelCls} sm:col-span-2`}>Research question<textarea name="question" defaultValue={p.question ?? ""} rows={2} className={field} /></label>
      <label className={`${labelCls} sm:col-span-2`}>Background and scope<textarea name="description" defaultValue={p.description ?? ""} rows={3} className={field} /></label>
      <label className={labelCls}>Status
        <select name="status" defaultValue={p.status} className={field}>{PROJECT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
      </label>
      <label className={labelCls}>Started<input type="date" name="start" defaultValue={p.start_date ?? ""} className={field} /></label>
      <label className={labelCls}>Target finish<input type="date" name="target" defaultValue={p.target_date ?? ""} className={field} /></label>
      <label className={labelCls}>Target venue<input name="venue" defaultValue={p.venue ?? ""} placeholder="e.g. ACL 2027, a workshop" className={field} /></label>
      <label className={labelCls}>Venue deadline<input type="date" name="venue_deadline" defaultValue={p.venue_deadline ?? ""} className={field} /></label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className={primary}>{pending ? "Saving…" : "Save changes"}</button>
        {saved && !pending && <span role="status" className="text-xs text-emerald-700">Saved</span>}
        <Err message={error} />
      </div>
    </form>
  );
}

export function DeleteProjectButton({ id, title, counts }: { id: string; title: string; counts: string }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <ConfirmButton
        label="Delete this project" question={`Delete "${title}"? This also deletes ${counts}. This cannot be undone.`}
        disabled={pending} onConfirm={() => run(() => deleteProject(id))}
        className="h-8 rounded-md border border-red-300 bg-white px-3 text-[13px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      />
      <Err message={error} />
    </span>
  );
}

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const { pending, error, run } = useRun();
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none rounded-md px-2 py-1 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 [&::-webkit-details-marker]:hidden">+ Add a milestone</summary>
      <form
        className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          run(() => addProjectMilestone(projectId, val(f, "title"), val(f, "description"), val(f, "date")), () => form.reset());
        }}
      >
        <input name="title" required placeholder="What has to be true when this is done?" aria-label="Milestone" className={field} />
        <textarea name="description" rows={2} placeholder="Details (optional)" aria-label="Details" className={field} />
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" name="date" className={`${field} w-44`} aria-label="Target date" />
          <button disabled={pending} className={primary}>Add milestone</button>
          <Err message={error} />
        </div>
      </form>
    </details>
  );
}

export function AddTaskForm({ projectId, milestones, people, teamSize }: { projectId: string; milestones: Opt[]; people: Opt[]; teamSize: number }) {
  const { pending, error, run } = useRun();
  const [assignee, choose] = useRememberedPerson(`research-task-assignee:${projectId}`, people, teamSize);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addProjectTask(projectId, { title: val(f, "title"), milestoneId: val(f, "milestone") || null, assigneeId: assignee || null, dueDate: val(f, "due") || null, priority: val(f, "priority") }), () => form.reset());
      }}
    >
      <input name="title" required placeholder="Add a task" aria-label="Task" className={`${field} min-w-[12rem] flex-1`} />
      <select name="milestone" className={`${field} w-44`} aria-label="Milestone">
        <option value="">No milestone</option>
        {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select value={assignee} onChange={(e) => choose(e.target.value)} className={`${field} w-36`} aria-label="Assign to">
        <option value="">Unassigned</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="date" name="due" className={`${field} w-40`} aria-label="Due date" />
      <select name="priority" defaultValue="medium" className={`${field} w-28`} aria-label="Priority">
        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
      </select>
      <button disabled={pending} className={primary}>Add</button>
      {teamSize > 0 && !assignee && <span className="basis-full text-xs text-slate-500">Assign the task to someone so it shows on their page and in the team view. Your choice is remembered.</span>}
      {error && <span role="alert" className="basis-full text-xs text-red-700">{error}</span>}
    </form>
  );
}

export function EntryForm({ projectId, people, milestones, teamSize }: { projectId: string; people: Opt[]; milestones: Opt[]; teamSize: number }) {
  const { pending, error, run } = useRun();
  const [more, setMore] = useState(false);
  const [bodyHtml, setBodyHtml] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [person, choose] = useRememberedPerson(`research-journal-person:${projectId}`, people, teamSize);
  const showPerson = people.length > 0;

  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addEntry(projectId, {
          kind: val(f, "kind"), title: val(f, "title"), body: bodyHtml, occurredOn: val(f, "date") || undefined,
          minutes: Number(val(f, "minutes")) || null, personId: person || null, milestoneId: val(f, "milestone") || null,
        }), () => { form.reset(); setMore(false); setBodyHtml(""); setResetKey((k) => k + 1); });
      }}
    >
      <h2 className="text-[15px] font-semibold text-slate-900">Log work</h2>
      <div className="flex flex-wrap gap-2">
        <select name="kind" defaultValue="experiment" className={`${field} w-36`} aria-label="What kind of work">
          {ENTRY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <input name="title" required placeholder="What did you do? e.g. Ran pilot on 200 items" aria-label="What did you do" className={`${field} min-w-[12rem] flex-1`} />
        <input name="minutes" type="number" min={0} placeholder="Minutes" className={`${field} w-24`} aria-label="Minutes spent" />
        {showPerson && (
          <select value={person} onChange={(e) => choose(e.target.value)} className={`${field} w-40`} aria-label="Who did it">
            <option value="">Who did it?</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button disabled={pending} className={primary}>{pending ? "Logging…" : "Log it"}</button>
      </div>
      {showPerson && !person && teamSize > 0 && (
        <p className="text-xs text-slate-500">Pick who did this so it counts in the team&rsquo;s weekly view. Your choice is remembered.</p>
      )}
      {more && (
        <div className="flex flex-col gap-2">
          <RichEditorLazy variant="compact" label="Details" placeholder="Details, results, what you'd do next…" value={bodyHtml} onChange={setBodyHtml} resetKey={resetKey} minHeight="8rem" />
          <div className="flex flex-wrap gap-2">
            <input type="date" name="date" defaultValue={localDate(new Date())} className={`${field} w-40`} aria-label="Date" />
            <select name="milestone" className={`${field} w-48`} aria-label="Milestone"><option value="">No milestone</option>{milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 text-xs">
        <button type="button" onClick={() => setMore((v) => !v)} className="font-medium text-blue-600 hover:text-blue-700">{more ? "Fewer details" : "Add details, date or milestone"}</button>
        <Err message={error} />
      </div>
    </form>
  );
}

export type EntryRowData = { id: string; kind: string; title: string; bodyHtml: string | null; minutes: number | null; personName?: string; milestoneTitle?: string };

export function EntryRow({ e, projectId }: { e: EntryRowData; projectId: string }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <li className={`group flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-24 flex-shrink-0"><span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{kindLabel(e.kind)}</span></span>
        <button
          type="button" onClick={() => e.bodyHtml && setOpen((v) => !v)} aria-expanded={e.bodyHtml ? open : undefined}
          className={`min-w-0 flex-1 text-left ${e.bodyHtml ? "cursor-pointer hover:text-blue-700" : "cursor-default"}`}
        >
          <span className="break-words text-sm text-slate-900">{e.title}{e.bodyHtml && <span aria-hidden className="ml-1 text-xs text-slate-400">{open ? "▾" : "▸"}</span>}</span>
          <span className="block text-xs text-slate-500">{[e.personName, e.milestoneTitle, e.minutes ? formatMinutes(e.minutes) : null].filter(Boolean).join(" · ")}</span>
        </button>
        <ConfirmButton
          label="Delete" question="Delete this entry?" disabled={pending} onConfirm={() => run(() => deleteEntry(e.id, projectId))}
          className="h-7 rounded-md px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100"
        />
      </div>
      {open && e.bodyHtml && <RichHtml html={e.bodyHtml} className="pl-[6.75rem] pt-1 text-sm" onDark />}
      {error && <p role="alert" className="pl-[6.75rem] text-xs text-red-700">{error}</p>}
    </li>
  );
}

export function PaperForm({ projectId }: { projectId: string }) {
  const { pending, error, run } = useRun();
  const [looking, setLooking] = useState(false);

  // Paste a link and the title, authors and year fill in on their own (arXiv gives all three; other pages give a title).
  // Anything already typed is left alone, and a failed lookup just leaves the fields as they are.
  const lookup = async (form: HTMLFormElement) => {
    const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
    const url = field("url").value.trim();
    if (!url || (field("title").value.trim() && field("authors").value.trim() && field("year").value)) return;
    setLooking(true);
    try {
      const m = await lookupPaper(url);
      if (m.title && !field("title").value.trim()) field("title").value = m.title;
      if (m.authors && !field("authors").value.trim()) field("authors").value = m.authors;
      if (m.year && !field("year").value) field("year").value = String(m.year);
    } catch { /* optional convenience */ } finally { setLooking(false); }
  };

  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addPaper(projectId, { title: val(f, "title"), url: val(f, "url"), authors: val(f, "authors"), year: Number(val(f, "year")) || null }), () => form.reset());
      }}
    >
      <h2 className="text-[15px] font-semibold text-slate-900">Add a paper</h2>
      <input name="url" placeholder="Paste a link (arXiv, PDF, DOI) and the details fill in" onBlur={(e) => e.currentTarget.form && lookup(e.currentTarget.form)} className={field} aria-label="Paper link" />
      <input name="title" required placeholder="Paper title" aria-label="Paper title" className={field} />
      <div className="flex flex-wrap items-center gap-2">
        <input name="authors" placeholder="Authors (optional)" aria-label="Authors" className={`${field} min-w-[12rem] flex-1`} />
        <input name="year" type="number" min={1900} max={2100} placeholder="Year" aria-label="Year" className={`${field} w-24`} />
        <button disabled={pending || looking} className={primary}>{looking ? "Looking up…" : "Add to reading list"}</button>
        <Err message={error} />
      </div>
    </form>
  );
}

export type PaperData = { id: string; title: string; authors: string | null; year: number | null; url: string | null; status: string; takeaway: string | null };

const PAPER_TONE: Record<string, string> = {
  to_read: "border-slate-300 bg-white text-slate-600",
  reading: "border-blue-200 bg-blue-50 text-blue-700",
  read: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cite: "border-violet-200 bg-violet-50 text-violet-700",
};
const smallAction = "h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";

export function PaperRow({ p, projectId }: { p: PaperData; projectId: string }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  return (
    <li className={`group flex flex-col gap-1.5 border-b border-slate-100 py-3 last:border-0 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-semibold text-slate-900 hover:text-blue-700">{p.title} <span aria-hidden className="text-xs text-slate-400">↗</span></a> : <span className="break-words text-sm font-semibold text-slate-900">{p.title}</span>}
          <div className="text-xs text-slate-500">{[p.authors, p.year].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
          <select value={p.status} onChange={(e) => run(() => updatePaper(p.id, projectId, { status: e.target.value }))} className={`h-7 cursor-pointer rounded-full border px-2 text-xs font-medium ${PAPER_TONE[p.status] ?? PAPER_TONE.to_read}`} aria-label="Reading status">
            {PAPER_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button type="button" onClick={() => setEditing((v) => !v)} className={smallAction}>{p.takeaway ? "Edit note" : "Add note"}</button>
          <ConfirmButton
            label="Remove" question={`Remove "${p.title}"?`} confirmLabel="Remove" disabled={pending}
            onConfirm={() => run(() => deletePaper(p.id, projectId))}
            className={`${smallAction} hover:bg-red-50 hover:text-red-700`}
          />
        </div>
      </div>
      {p.takeaway && !editing && <p className="whitespace-pre-line rounded-md bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700">{p.takeaway}</p>}
      {editing && (
        <form className="flex flex-col gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => updatePaper(p.id, projectId, { takeaway: val(f, "takeaway") }), () => setEditing(false)); }}>
          <textarea name="takeaway" defaultValue={p.takeaway ?? ""} rows={3} placeholder="What does this paper say that matters for your project?" aria-label="Takeaway" className={field} />
          <div className="flex gap-2"><button disabled={pending} className={primary}>Save</button><button type="button" onClick={() => setEditing(false)} className="h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Cancel</button></div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </li>
  );
}

export function MeetingForm({ projectId, people }: { projectId: string; people: Opt[] }) {
  const { pending, error, run } = useRun();
  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addMeeting(projectId, { title: val(f, "title"), heldOn: val(f, "date") || undefined, attendeeIds: f.getAll("attendees").map(String), agenda: val(f, "agenda") }), () => form.reset());
      }}
    >
      <h2 className="text-[15px] font-semibold text-slate-900">Add a meeting</h2>
      <div className="flex flex-wrap gap-2">
        <input name="title" required placeholder="Meeting title, e.g. Weekly sync with advisor" aria-label="Meeting title" className={`${field} min-w-[14rem] flex-1`} />
        <input type="date" name="date" defaultValue={localDate(new Date())} className={`${field} w-40`} aria-label="Date" />
      </div>
      <textarea name="agenda" rows={2} placeholder="Agenda or what you want to get out of it (optional)" aria-label="Agenda" className={field} />
      {people.length > 0 && (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-700">
          <legend className="mb-1 text-xs font-medium text-slate-600">Who is there</legend>
          {people.map((p) => <label key={p.id} className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" name="attendees" value={p.id} className="h-4 w-4 accent-blue-600" /> {p.name}</label>)}
        </fieldset>
      )}
      <div className="flex items-center gap-3"><button disabled={pending} className={primary}>Add meeting</button><Err message={error} /></div>
    </form>
  );
}

export type MeetingData = { id: string; title: string; held_on: string; attendees: string[]; agenda: string | null; notes: string | null; decisions: string | null };

export function MeetingCard({ m, projectId, people, defaultOpen, teamSize }: { m: MeetingData; projectId: string; people: Opt[]; defaultOpen?: boolean; teamSize: number }) {
  const { pending, error, run } = useRun();
  const [assignee, choose] = useRememberedPerson(`research-task-assignee:${projectId}`, people, teamSize);
  const [open, setOpen] = useState(!!defaultOpen);
  const [added, setAdded] = useState<string | null>(null);
  return (
    <li className={`rounded-lg border border-slate-200 bg-white ${pending ? "opacity-60" : ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left ${open ? "border-b border-slate-200" : ""}`} aria-expanded={open}>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-slate-900">{m.title}</span>
          <span className="text-xs text-slate-500">{new Date(m.held_on + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{m.attendees.length > 0 && ` · ${m.attendees.join(", ")}`}</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2 text-xs">
          {m.decisions && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Decisions noted</span>}
          <span className="font-medium text-slate-500">{open ? "Hide" : "Open"}</span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 px-5 py-4">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => updateMeeting(m.id, projectId, { agenda: val(f, "agenda") || null, notes: val(f, "notes") || null, decisions: val(f, "decisions") || null })); }}
          >
            <label className={labelCls}>Agenda<textarea name="agenda" defaultValue={m.agenda ?? ""} rows={2} className={field} /></label>
            <label className={labelCls}>Notes<textarea name="notes" defaultValue={m.notes ?? ""} rows={4} className={field} /></label>
            <label className={labelCls}>Decisions<textarea name="decisions" defaultValue={m.decisions ?? ""} rows={2} placeholder="What was agreed" className={field} /></label>
            <div className="flex flex-wrap items-center gap-3"><button disabled={pending} className={primary}>{pending ? "Saving…" : "Save notes"}</button>
              <ConfirmButton
                label="Delete meeting" question={`Delete "${m.title}"?`} disabled={pending}
                onConfirm={() => run(() => deleteMeeting(m.id, projectId))}
                className="h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
              />
            </div>
          </form>
          <form
            className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget; const f = new FormData(form); const title = val(f, "title");
              run(() => addProjectTask(projectId, { title, assigneeId: assignee || null, dueDate: val(f, "due") || null }), () => { form.reset(); setAdded(title); });
            }}
          >
            <span className="basis-full text-xs font-medium text-slate-600">Action items become tasks on your board</span>
            <input name="title" required placeholder="Who does what" aria-label="Action item" className={`${field} min-w-[12rem] flex-1`} />
            <select value={assignee} onChange={(e) => choose(e.target.value)} className={`${field} w-36`} aria-label="Assign to"><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input type="date" name="due" className={`${field} w-40`} aria-label="Due date" />
            <button disabled={pending} className={primary}>Add task</button>
            {added && <span role="status" className="basis-full text-xs text-emerald-700">Added task: {added}</span>}
          </form>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        </div>
      )}
    </li>
  );
}

export function AddMemberForm({ projectId, candidates, totalPeople }: { projectId: string; candidates: Opt[]; totalPeople: number }) {
  const { pending, error, run } = useRun();
  if (candidates.length === 0) {
    return (
      <p className="text-[13px] text-slate-600">
        {totalPeople === 0 ? "You haven't added anyone yet." : "Everyone in your People list is already on this project."}{" "}
        <a href="/people" className="font-medium text-blue-600 hover:text-blue-700">Add people on the People page</a>, then come back to put them on the team.
      </p>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); run(() => addMember(projectId, val(f, "person"), val(f, "role")), () => form.reset()); }}
    >
      <select name="person" required className={`${field} w-56`} aria-label="Person">{candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input name="role" placeholder="Role, e.g. advisor, co-author, annotator" aria-label="Role" className={`${field} min-w-[12rem] flex-1`} />
      <button disabled={pending} className={primary}>Add to project</button>
      <Err message={error} />
    </form>
  );
}

export function RemoveMemberButton({ projectId, personId, name }: { projectId: string; personId: string; name: string }) {
  const { pending, run } = useRun();
  return (
    <ConfirmButton
      label="Remove" question={`Remove ${name} from this project? Their tasks stay.`} confirmLabel="Remove"
      disabled={pending} onConfirm={() => run(() => removeMember(projectId, personId))}
      className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
    />
  );
}
