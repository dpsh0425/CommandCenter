"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addEntry, addMeeting, addMember, addPaper, addProjectMilestone, addProjectTask, createProject, deleteEntry, deleteMeeting, deletePaper,
  deleteProject, removeMember, updateMeeting, updatePaper, updateProject,
} from "@/app/(app)/research/project-actions";
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

const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function NewProjectForm() {
  const router = useRouter();
  const { pending, error, run } = useRun();
  return (
    <details className="text-sm group">
      <summary className="cursor-pointer list-none inline-block bg-brass text-ink font-medium rounded px-3 py-1.5">New project</summary>
      <form
        className="flex flex-col gap-2 mt-4 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => router.push(`/research/projects/${await createProject({ title: val(f, "title"), question: val(f, "question"), status: val(f, "status") })}`));
        }}
      >
        <input name="title" required placeholder="Project title" className={field} />
        <textarea name="question" rows={2} placeholder="The research question, in one or two sentences (optional)" className={field} />
        <div className="flex gap-2 items-center">
          <select name="status" defaultValue="planning" className={field + " max-w-[10rem] bg-transparent"} aria-label="Status">
            {PROJECT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button disabled={pending} className={primary}>Create project</button>
          {error && <span className="text-red-600 text-xs">{error}</span>}
        </div>
      </form>
    </details>
  );
}

export function ProjectEditForm({ p }: { p: { id: string; title: string; question: string | null; description: string | null; status: string; start_date: string | null; target_date: string | null; venue: string | null; venue_deadline: string | null } }) {
  const { pending, error, run } = useRun();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 text-sm"
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
      <label className="sm:col-span-2 flex flex-col gap-1">Title<input name="title" defaultValue={p.title} required className={field} /></label>
      <label className="sm:col-span-2 flex flex-col gap-1">Research question<textarea name="question" defaultValue={p.question ?? ""} rows={2} className={field} /></label>
      <label className="sm:col-span-2 flex flex-col gap-1">Background and scope<textarea name="description" defaultValue={p.description ?? ""} rows={3} className={field} /></label>
      <label className="flex flex-col gap-1">Status
        <select name="status" defaultValue={p.status} className={field + " bg-transparent"}>{PROJECT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1">Started<input type="date" name="start" defaultValue={p.start_date ?? ""} className={field} /></label>
      <label className="flex flex-col gap-1">Target finish<input type="date" name="target" defaultValue={p.target_date ?? ""} className={field} /></label>
      <label className="flex flex-col gap-1">Target venue<input name="venue" defaultValue={p.venue ?? ""} placeholder="e.g. ACL 2027, a workshop" className={field} /></label>
      <label className="flex flex-col gap-1">Venue deadline<input type="date" name="venue_deadline" defaultValue={p.venue_deadline ?? ""} className={field} /></label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button disabled={pending} className={primary}>Save changes</button>
        {saved && !pending && <span className="text-teal-600 text-xs">Saved</span>}
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </div>
    </form>
  );
}

export function DeleteProjectButton({ id, title, counts }: { id: string; title: string; counts: string }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() => { if (confirm(`Delete "${title}"? This also deletes ${counts}. This cannot be undone.`)) run(() => deleteProject(id)); }}
        className="text-sm text-gray-500 hover:text-red-600"
      >
        Delete this project
      </button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </span>
  );
}

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const { pending, error, run } = useRun();
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-500 hover:text-cream list-none">+ Add a milestone</summary>
      <form
        className="flex flex-col gap-2 mt-3 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          run(() => addProjectMilestone(projectId, val(f, "title"), val(f, "description"), val(f, "date")), () => form.reset());
        }}
      >
        <input name="title" required placeholder="What has to be true when this is done?" className={field} />
        <textarea name="description" rows={2} placeholder="Details (optional)" className={field} />
        <div className="flex gap-2 items-center">
          <input type="date" name="date" className={field + " max-w-[11rem]"} aria-label="Target date" />
          <button disabled={pending} className={primary}>Add milestone</button>
          {error && <span className="text-red-600 text-xs">{error}</span>}
        </div>
      </form>
    </details>
  );
}

export function AddTaskForm({ projectId, milestones, people }: { projectId: string; milestones: Opt[]; people: Opt[] }) {
  const { pending, error, run } = useRun();
  return (
    <form
      className="flex flex-wrap gap-2 items-center text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addProjectTask(projectId, { title: val(f, "title"), milestoneId: val(f, "milestone") || null, assigneeId: val(f, "assignee") || null, dueDate: val(f, "due") || null, priority: val(f, "priority") }), () => form.reset());
      }}
    >
      <input name="title" required placeholder="Add a task" className={field + " flex-1 min-w-[12rem]"} />
      <select name="milestone" className={field + " max-w-[11rem] bg-transparent"} aria-label="Milestone">
        <option value="">No milestone</option>
        {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select name="assignee" className={field + " max-w-[9rem] bg-transparent"} aria-label="Assign to">
        <option value="">Unassigned</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="date" name="due" className={field + " max-w-[10rem]"} aria-label="Due date" />
      <select name="priority" defaultValue="medium" className={field + " max-w-[7rem] bg-transparent"} aria-label="Priority">
        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
      </select>
      <button disabled={pending} className={primary}>Add</button>
      {error && <span className="text-red-600 text-xs basis-full">{error}</span>}
    </form>
  );
}

export function EntryForm({ projectId, people, milestones, teamSize }: { projectId: string; people: Opt[]; milestones: Opt[]; teamSize: number }) {
  const { pending, error, run } = useRun();
  const [more, setMore] = useState(false);
  const storageKey = `research-journal-person:${projectId}`;
  // Default to whoever logged last on this project; a one-person team defaults to that person.
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
  const showPerson = people.length > 0;

  return (
    <form
      className="flex flex-col gap-2 text-sm border-b border-line pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addEntry(projectId, {
          kind: val(f, "kind"), title: val(f, "title"), body: val(f, "body"), occurredOn: val(f, "date") || undefined,
          minutes: Number(val(f, "minutes")) || null, personId: person || null, milestoneId: val(f, "milestone") || null,
        }), () => { form.reset(); setMore(false); });
      }}
    >
      <div className="flex flex-wrap gap-2">
        <select name="kind" defaultValue="experiment" className={field + " max-w-[9rem] bg-transparent"} aria-label="What kind of work">
          {ENTRY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <input name="title" required placeholder="What did you do? e.g. Ran pilot on 200 items" className={field + " flex-1 min-w-[12rem]"} />
        <input name="minutes" type="number" min={0} placeholder="Minutes" className={field + " max-w-[6rem]"} aria-label="Minutes spent" />
        {showPerson && (
          <select value={person} onChange={(e) => choose(e.target.value)} className={field + " max-w-[10rem] bg-transparent"} aria-label="Who did it">
            <option value="">Who did it?</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button disabled={pending} className={primary}>Log it</button>
      </div>
      {showPerson && !person && teamSize > 0 && (
        <p className="text-xs text-gray-400">Pick who did this so it counts in the team&rsquo;s weekly view. Your choice is remembered.</p>
      )}
      {more && (
        <div className="flex flex-col gap-2">
          <textarea name="body" rows={3} placeholder="Details, results, what you'd do next. Numbers, file names and decisions belong here." className={field} />
          <div className="flex flex-wrap gap-2">
            <input type="date" name="date" defaultValue={localDate(new Date())} className={field + " max-w-[10rem]"} aria-label="Date" />
            <select name="milestone" className={field + " max-w-[12rem] bg-transparent"} aria-label="Milestone"><option value="">No milestone</option>{milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 text-xs">
        <button type="button" onClick={() => setMore((v) => !v)} className="text-gray-500 underline hover:text-cream">{more ? "Fewer details" : "Add details, date or milestone"}</button>
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </form>
  );
}

export type EntryRowData = { id: string; kind: string; title: string; body: string | null; minutes: number | null; personName?: string; milestoneTitle?: string };

export function EntryRow({ e, projectId }: { e: EntryRowData; projectId: string }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <li className={`group py-2.5 border-b border-line/60 last:border-0 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-baseline gap-3">
        <span className="text-xs text-gray-500 w-20 flex-shrink-0">{kindLabel(e.kind)}</span>
        <button onClick={() => e.body && setOpen((v) => !v)} className={`text-left flex-1 min-w-0 ${e.body ? "hover:text-brass cursor-pointer" : "cursor-default"}`}>
          <span className="break-words">{e.title}</span>
          <span className="block text-xs text-gray-400">{[e.personName, e.milestoneTitle, e.minutes ? formatMinutes(e.minutes) : null].filter(Boolean).join(" · ")}</span>
        </button>
        <button onClick={() => { if (confirm("Delete this entry?")) run(() => deleteEntry(e.id, projectId)); }} className="text-xs text-gray-500 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100" aria-label="Delete entry">✕</button>
      </div>
      {open && e.body && <p className="text-sm text-gray-500 whitespace-pre-line pl-[5.75rem] pt-1">{e.body}</p>}
      {error && <p className="text-red-600 text-xs pl-[5.75rem]">{error}</p>}
    </li>
  );
}

export function PaperForm({ projectId }: { projectId: string }) {
  const { pending, error, run } = useRun();
  return (
    <form
      className="flex flex-col gap-2 text-sm border-b border-line pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addPaper(projectId, { title: val(f, "title"), url: val(f, "url"), authors: val(f, "authors"), year: Number(val(f, "year")) || null }), () => form.reset());
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input name="title" required placeholder="Paper title" className={field + " flex-1 min-w-[14rem]"} />
        <input name="url" placeholder="Link (arXiv, PDF, DOI)" className={field + " flex-1 min-w-[12rem]"} />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input name="authors" placeholder="Authors (optional)" className={field + " flex-1 min-w-[12rem]"} />
        <input name="year" type="number" min={1900} max={2100} placeholder="Year" className={field + " max-w-[6rem]"} />
        <button disabled={pending} className={primary}>Add to reading list</button>
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </div>
    </form>
  );
}

export type PaperData = { id: string; title: string; authors: string | null; year: number | null; url: string | null; status: string; takeaway: string | null };

export function PaperRow({ p, projectId }: { p: PaperData; projectId: string }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  return (
    <li className={`group py-3 border-b border-line/60 last:border-0 flex flex-col gap-1 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brass break-words">{p.title} <span aria-hidden className="text-gray-400">↗</span></a> : <span className="font-medium break-words">{p.title}</span>}
          <div className="text-xs text-gray-400">{[p.authors, p.year].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <select value={p.status} onChange={(e) => run(() => updatePaper(p.id, projectId, { status: e.target.value }))} className="border rounded px-2 py-1 text-xs bg-transparent" aria-label="Reading status">
            {PAPER_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button onClick={() => setEditing((v) => !v)} className="text-xs text-gray-500 hover:text-cream md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">{p.takeaway ? "Edit note" : "Add note"}</button>
          <button onClick={() => { if (confirm(`Remove "${p.title}"?`)) run(() => deletePaper(p.id, projectId)); }} className="text-xs text-gray-500 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100" aria-label="Remove paper">✕</button>
        </div>
      </div>
      {p.takeaway && !editing && <p className="text-sm text-gray-500 border-l-2 border-line pl-2 whitespace-pre-line">{p.takeaway}</p>}
      {editing && (
        <form className="flex flex-col gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => updatePaper(p.id, projectId, { takeaway: val(f, "takeaway") }), () => setEditing(false)); }}>
          <textarea name="takeaway" defaultValue={p.takeaway ?? ""} rows={3} placeholder="What does this paper say that matters for your project?" className={field} />
          <div className="flex gap-2"><button disabled={pending} className={primary}>Save</button><button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500">Cancel</button></div>
        </form>
      )}
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </li>
  );
}

export function MeetingForm({ projectId, people }: { projectId: string; people: Opt[] }) {
  const { pending, error, run } = useRun();
  return (
    <form
      className="flex flex-col gap-2 text-sm border-b border-line pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget; const f = new FormData(form);
        run(() => addMeeting(projectId, { title: val(f, "title"), heldOn: val(f, "date") || undefined, attendeeIds: f.getAll("attendees").map(String), agenda: val(f, "agenda") }), () => form.reset());
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input name="title" required placeholder="Meeting title, e.g. Weekly sync with advisor" className={field + " flex-1 min-w-[14rem]"} />
        <input type="date" name="date" defaultValue={localDate(new Date())} className={field + " max-w-[10rem]"} aria-label="Date" />
      </div>
      <textarea name="agenda" rows={2} placeholder="Agenda or what you want to get out of it (optional)" className={field} />
      {people.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500">
          <span>Who is there:</span>
          {people.map((p) => <label key={p.id} className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" name="attendees" value={p.id} /> {p.name}</label>)}
        </div>
      )}
      <div className="flex items-center gap-3"><button disabled={pending} className={primary}>Add meeting</button>{error && <span className="text-red-600 text-xs">{error}</span>}</div>
    </form>
  );
}

export type MeetingData = { id: string; title: string; held_on: string; attendees: string[]; agenda: string | null; notes: string | null; decisions: string | null };

export function MeetingCard({ m, projectId, people, defaultOpen }: { m: MeetingData; projectId: string; people: Opt[]; defaultOpen?: boolean }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(!!defaultOpen);
  const [added, setAdded] = useState<string | null>(null);
  return (
    <li className={`py-3 border-b border-line/60 last:border-0 ${pending ? "opacity-60" : ""}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-baseline justify-between gap-3 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className="font-medium block truncate">{m.title}</span>
          <span className="text-xs text-gray-400">{new Date(m.held_on + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}{m.attendees.length > 0 && ` · ${m.attendees.join(", ")}`}</span>
        </span>
        <span className="text-xs text-gray-500">{open ? "Hide" : "Open"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 pt-3 text-sm">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => updateMeeting(m.id, projectId, { agenda: val(f, "agenda") || null, notes: val(f, "notes") || null, decisions: val(f, "decisions") || null })); }}
          >
            <label className="flex flex-col gap-1 text-gray-500">Agenda<textarea name="agenda" defaultValue={m.agenda ?? ""} rows={2} className={field + " text-cream"} /></label>
            <label className="flex flex-col gap-1 text-gray-500">Notes<textarea name="notes" defaultValue={m.notes ?? ""} rows={4} className={field + " text-cream"} /></label>
            <label className="flex flex-col gap-1 text-gray-500">Decisions<textarea name="decisions" defaultValue={m.decisions ?? ""} rows={2} placeholder="What was agreed" className={field + " text-cream"} /></label>
            <div className="flex items-center gap-3"><button disabled={pending} className={primary}>Save notes</button>
              <button type="button" onClick={() => { if (confirm(`Delete "${m.title}"?`)) run(() => deleteMeeting(m.id, projectId)); }} className="text-gray-500 hover:text-red-600">Delete meeting</button></div>
          </form>
          <form
            className="flex flex-wrap gap-2 items-center border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget; const f = new FormData(form); const title = val(f, "title");
              run(() => addProjectTask(projectId, { title, assigneeId: val(f, "assignee") || null, dueDate: val(f, "due") || null }), () => { form.reset(); setAdded(title); });
            }}
          >
            <span className="text-gray-500 basis-full">Action items become tasks on your board</span>
            <input name="title" required placeholder="Who does what" className={field + " flex-1 min-w-[12rem]"} />
            <select name="assignee" className={field + " max-w-[9rem] bg-transparent"} aria-label="Assign to"><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input type="date" name="due" className={field + " max-w-[10rem]"} aria-label="Due date" />
            <button disabled={pending} className={primary}>Add task</button>
            {added && <span className="text-teal-600 text-xs basis-full">Added task: {added}</span>}
          </form>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
      )}
    </li>
  );
}

export function AddMemberForm({ projectId, candidates, totalPeople }: { projectId: string; candidates: Opt[]; totalPeople: number }) {
  const { pending, error, run } = useRun();
  if (candidates.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {totalPeople === 0 ? "You haven't added anyone yet." : "Everyone in your People list is already on this project."}{" "}
        <a href="/people" className="underline hover:text-cream">Add people on the People page</a>, then come back to put them on the team.
      </p>
    );
  }
  return (
    <form
      className="flex flex-wrap gap-2 items-center text-sm"
      onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); run(() => addMember(projectId, val(f, "person"), val(f, "role")), () => form.reset()); }}
    >
      <select name="person" required className={field + " max-w-[14rem] bg-transparent"} aria-label="Person">{candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input name="role" placeholder="Role, e.g. advisor, co-author, annotator" className={field + " flex-1 min-w-[12rem]"} />
      <button disabled={pending} className={primary}>Add to project</button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </form>
  );
}

export function RemoveMemberButton({ projectId, personId, name }: { projectId: string; personId: string; name: string }) {
  const { pending, run } = useRun();
  return (
    <button disabled={pending} onClick={() => { if (confirm(`Remove ${name} from this project? Their tasks stay.`)) run(() => removeMember(projectId, personId)); }} className="text-xs text-gray-500 hover:text-red-600">Remove</button>
  );
}
