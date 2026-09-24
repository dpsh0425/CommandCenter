"use client";
import { useState } from "react";
import Link from "next/link";
import { FLAG_LABEL, letterFlags, type LetterStatus } from "@/lib/letters";
import { addNote, deleteNote, updateSchoolDetails } from "@/app/(app)/schools/[id]/actions";
import { addLetterRequest, clearSchoolSop, recordSopSent, removeLetterRequest, updateLetterStatus } from "@/app/(app)/schools/[id]/logistics-actions";
import { deleteInterview, scheduleInterview, updateInterview, updateVisaStep, type InterviewStatus } from "@/app/(app)/schools/[id]/interview-actions";
import { RichEditorLazy } from "@/components/rich-editor-lazy";
import { useAction } from "@/lib/use-action";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";
import { createTask } from "@/app/(app)/tasks/actions";

// Every control in this file runs its server action through the shared hook, which shows a failure result's message
// and turns anything thrown into a generic one.
const useRun = useAction;

const btn = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const Err = ({ message }: { message: string | null }) => (message ? <p className="text-red-600 text-xs">{message}</p> : null);

export function SchoolDetailsForm(props: {
  schoolId: string; deadlineDate: string | null; deadlineNote: string | null; contactEmail: string | null;
  faculty: string | null; fitNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useRun();
  if (!open) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-gray-500">Deadline</dt>
          <dd>{props.deadlineDate ? <span className="font-mono">{props.deadlineDate}</span> : <span className="text-gray-400">not set</span>}{props.deadlineNote && <span className="text-gray-500"> — {props.deadlineNote}</span>}</dd>
          <dt className="text-gray-500">Contact</dt>
          <dd className="min-w-0 truncate">
            {props.contactEmail ? <a className="text-brass underline" href={`mailto:${props.contactEmail}`}>{props.contactEmail}</a> : <span className="text-gray-400">not set</span>}
          </dd>
        </dl>
        <button onClick={() => setOpen(true)} className="text-xs text-gray-500 underline self-start hover:text-cream">Edit details</button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const val = (k: string) => String(f.get(k) ?? "").trim() || null;
        run(
          () => updateSchoolDetails(props.schoolId, {
            deadlineDate: val("deadline_date"), deadlineNote: val("deadline_note"), contactEmail: val("contact_email"),
            faculty: val("faculty"), fitNote: val("fit_note"),
          }),
          () => setOpen(false)
        );
      }}
    >
      <label className="text-xs text-gray-500 flex flex-col gap-1">Application deadline
        <input type="date" name="deadline_date" defaultValue={props.deadlineDate ?? ""} className="border rounded px-2 py-1.5 text-sm" />
      </label>
      <input name="deadline_note" defaultValue={props.deadlineNote ?? ""} placeholder="Deadline note (e.g. rolling, unconfirmed)" className="border rounded px-2 py-1.5 text-sm" />
      <input name="contact_email" type="email" defaultValue={props.contactEmail ?? ""} placeholder="Contact email" className="border rounded px-2 py-1.5 text-sm" />
      <input name="faculty" defaultValue={props.faculty ?? ""} placeholder="Target faculty" className="border rounded px-2 py-1.5 text-sm" />
      <textarea name="fit_note" defaultValue={props.fitNote ?? ""} rows={3} placeholder="Why this is a fit" className="border rounded px-2 py-1.5 text-sm" />
      <Err message={error} />
      <div className="flex gap-2">
        <button disabled={pending} className={btn}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export function NoteForm({ schoolId }: { schoolId: string }) {
  const { pending, error, run } = useAction();
  const [html, setHtml] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const empty = !htmlToText(toEditorHtml(html)).trim();
  return (
    <form
      className="flex flex-col gap-2 mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (empty) return;
        run(() => addNote(schoolId, html), () => { setHtml(""); setResetKey((k) => k + 1); });
      }}
    >
      <RichEditorLazy variant="compact" label="Note" placeholder="Log a note, call, or outreach…" value={html} onChange={setHtml} resetKey={resetKey} minHeight="6rem" />
      <Err message={error} />
      <button disabled={pending || empty} className={`${btn} self-start`}>{pending ? "Saving…" : "Add note"}</button>
    </form>
  );
}

export function DeleteNoteButton({ schoolId, activityId }: { schoolId: string; activityId: string }) {
  const { pending, run } = useRun();
  return (
    <button
      disabled={pending}
      onClick={() => { if (confirm("Delete this note?")) run(() => deleteNote(schoolId, activityId)); }}
      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
      aria-label="Delete note"
    >
      ✕
    </button>
  );
}

export function SchoolTaskForm({ schoolId, people }: { schoolId: string; people: Array<{ id: string; name: string }> }) {
  const { pending, error, run } = useRun();
  return (
    <form
      className="flex flex-col gap-2 mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const title = String(f.get("title") ?? "").trim();
        if (!title) return;
        run(
          () => createTask({
            title, schoolId,
            assigneeId: String(f.get("assignee_id") ?? "") || undefined,
            priority: String(f.get("priority") ?? "medium") as "low" | "medium" | "high",
            dueDate: String(f.get("due_date") ?? "") || undefined,
          }),
          () => form.reset()
        );
      }}
    >
      <input name="title" required placeholder="Add a task for this school…" className="border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2 flex-wrap">
        <select name="assignee_id" className="border rounded px-2 py-1.5 text-sm">
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="priority" defaultValue="medium" className="border rounded px-2 py-1.5 text-sm">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
        <input type="date" name="due_date" className="border rounded px-2 py-1.5 text-sm" />
        <button disabled={pending} className={btn}>{pending ? "Adding…" : "Add task"}</button>
      </div>
      <Err message={error} />
    </form>
  );
}

const LETTER_STATUSES = [
  { key: "not_asked", label: "Not asked" }, { key: "asked", label: "Asked" },
  { key: "confirmed", label: "Confirmed" }, { key: "submitted", label: "Submitted" },
] as const;

const letterDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function LetterRow({
  id, schoolId, name, deadline, status, recommenderId, askedOn, lastRemindedOn, reminderCount, receivedOn, today,
}: {
  id: string; schoolId: string; name: string; deadline: string | null; status: string;
  recommenderId?: string | null; askedOn?: string | null; lastRemindedOn?: string | null;
  reminderCount?: number; receivedOn?: string | null; today?: string;
}) {
  const { pending, error, run } = useRun();
  const facts = [
    askedOn ? `asked ${letterDate(askedOn)}` : null,
    reminderCount && reminderCount > 0 ? `reminded ${reminderCount}×${lastRemindedOn ? ` · last ${letterDate(lastRemindedOn)}` : ""}` : null,
    receivedOn ? `received ${letterDate(receivedOn)}` : null,
  ].filter(Boolean);
  const flags = today
    ? letterFlags({ status: status as LetterStatus, letter_deadline: deadline, asked_on: askedOn ?? null, last_reminded_on: lastRemindedOn ?? null }, today)
    : [];
  return (
    <li className={`border rounded p-2 text-sm flex flex-col gap-1 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span>{name}{deadline && <span className="text-xs text-gray-500"> · due {deadline}</span>}</span>
        <span className="flex items-center gap-2">
          <select
            value={status}
            disabled={pending}
            onChange={(e) => run(() => updateLetterStatus(id, schoolId, e.target.value))}
            className="border rounded text-xs px-1 py-0.5"
            aria-label={`Letter status for ${name}`}
          >
            {LETTER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button
            disabled={pending}
            onClick={() => { if (confirm(`Remove ${name}'s letter request?`)) run(() => removeLetterRequest(id, schoolId)); }}
            className="text-xs text-gray-400 hover:text-red-600"
            aria-label="Remove letter request"
          >
            ✕
          </button>
        </span>
      </div>
      {(facts.length > 0 || flags.length > 0 || recommenderId) && (
        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
          {facts.length > 0 && <span>{facts.join(" · ")}</span>}
          {flags.map((f) => <span key={f} className="border rounded px-1.5 py-0.5">{FLAG_LABEL[f]}</span>)}
          {recommenderId && <Link href={`/materials/letters?focus=${recommenderId}`} className="underline">Draft email →</Link>}
        </div>
      )}
      <Err message={error} />
    </li>
  );
}

export function AddLetterForm({ schoolId, people }: { schoolId: string; people: Array<{ id: string; name: string }> }) {
  const { pending, error, run } = useRun();
  if (people.length === 0) {
    return <p className="text-xs text-gray-400">Add a recommender on the People page first.</p>;
  }
  return (
    <form
      className="flex gap-2 items-center flex-wrap"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const rec = String(f.get("recommender_id") ?? "");
        if (rec) run(() => addLetterRequest(schoolId, rec, String(f.get("letter_deadline") ?? "") || undefined), () => form.reset());
      }}
    >
      <select name="recommender_id" required defaultValue="" className="border rounded px-2 py-1.5 text-sm">
        <option value="" disabled>Choose recommender…</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="date" name="letter_deadline" className="border rounded px-2 py-1.5 text-sm" aria-label="Letter deadline" />
      <button disabled={pending} className={btn}>{pending ? "Adding…" : "Request letter"}</button>
      <Err message={error} />
    </form>
  );
}

export function SopForm({ schoolId, current }: { schoolId: string; current: { label: string; sentAt: string | null } | null }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(!current);
  return (
    <div className="flex flex-col gap-2">
      {current && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span><span className="text-cream">{current.label}</span><span className="text-gray-500"> — sent {current.sentAt ?? "date unknown"}</span></span>
          <span className="flex gap-3 text-xs">
            <button onClick={() => setEditing((v) => !v)} className="text-gray-500 underline hover:text-cream">{editing ? "Cancel" : "Change"}</button>
            <button
              disabled={pending}
              onClick={() => { if (confirm("Clear the recorded SOP for this school?")) run(() => clearSchoolSop(schoolId)); }}
              className="text-gray-500 hover:text-red-600"
            >
              Clear
            </button>
          </span>
        </div>
      )}
      {editing && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const label = String(f.get("label") ?? "").trim();
            if (!label) return;
            run(() => recordSopSent(schoolId, label, String(f.get("external_link") ?? "").trim() || undefined), () => setEditing(false));
          }}
        >
          <input name="label" required placeholder="Version label, e.g. v3 — AU variant" className="border rounded px-2 py-1.5 text-sm" />
          <input name="external_link" type="url" placeholder="Link to the document (optional)" className="border rounded px-2 py-1.5 text-sm" />
          <button disabled={pending} className={`${btn} self-start`}>{pending ? "Saving…" : "Record as sent today"}</button>
        </form>
      )}
      <Err message={error} />
    </div>
  );
}

const INTERVIEW_STATUSES: Array<{ key: InterviewStatus; label: string }> = [
  { key: "not_scheduled", label: "Not scheduled" }, { key: "scheduled", label: "Scheduled" }, { key: "completed", label: "Completed" },
];

export function InterviewRow({
  id, schoolId, when, prep, outcome, status,
}: { id: string; schoolId: string; when: string | null; prep: string | null; outcome: string | null; status: string }) {
  const { pending, error, run } = useRun();
  const [showOutcome, setShowOutcome] = useState(false);
  return (
    <li className={`border rounded p-2.5 text-sm flex flex-col gap-1.5 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span>{when ? new Date(when).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time TBD"}</span>
        <span className="flex items-center gap-2">
          <select
            value={status}
            disabled={pending}
            onChange={(e) => run(() => updateInterview(id, schoolId, { status: e.target.value as InterviewStatus }))}
            className="border rounded text-xs px-1 py-0.5"
            aria-label="Interview status"
          >
            {INTERVIEW_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button
            disabled={pending}
            onClick={() => { if (confirm("Delete this interview?")) run(() => deleteInterview(id, schoolId)); }}
            className="text-xs text-gray-400 hover:text-red-600"
            aria-label="Delete interview"
          >
            ✕
          </button>
        </span>
      </div>
      {prep && <p className="text-xs text-gray-500"><span className="text-gray-400">Prep:</span> {prep}</p>}
      {outcome && !showOutcome && <p className="text-xs text-gray-500"><span className="text-gray-400">Outcome:</span> {outcome}</p>}
      {showOutcome ? (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get("outcome") ?? "").trim() || null;
            run(() => updateInterview(id, schoolId, { outcomeNotes: v }), () => setShowOutcome(false));
          }}
        >
          <textarea name="outcome" defaultValue={outcome ?? ""} rows={2} placeholder="How did it go? Questions asked, follow-ups…" className="border rounded px-2 py-1 text-xs" />
          <div className="flex gap-2">
            <button disabled={pending} className="bg-brass text-ink font-medium rounded px-2 py-1 text-xs">Save</button>
            <button type="button" onClick={() => setShowOutcome(false)} className="text-xs text-gray-500">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowOutcome(true)} className="text-xs text-gray-500 underline self-start hover:text-cream">{outcome ? "Edit outcome notes" : "Add outcome notes"}</button>
      )}
      <Err message={error} />
    </li>
  );
}

export function ScheduleInterviewForm({ schoolId }: { schoolId: string }) {
  const { pending, error, run } = useRun();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const at = String(f.get("scheduled_at") ?? "");
        if (at) run(() => scheduleInterview(schoolId, new Date(at).toISOString(), String(f.get("prep_notes") ?? "").trim() || undefined), () => form.reset());
      }}
    >
      <input type="datetime-local" name="scheduled_at" required className="border rounded px-2 py-1.5 text-sm" />
      <input name="prep_notes" placeholder="Prep notes (optional)" className="border rounded px-2 py-1.5 text-sm" />
      <Err message={error} />
      <button disabled={pending} className={`${btn} self-start`}>{pending ? "Scheduling…" : "Schedule interview"}</button>
    </form>
  );
}

export function VisaStepRow({ id, schoolId, name, status }: { id: string; schoolId: string; name: string; status: string }) {
  const { pending, error, run } = useRun();
  return (
    <li className={`border rounded p-2 text-sm flex flex-col gap-1 ${pending ? "opacity-60" : ""}`}>
      <div className="flex justify-between items-center gap-2">
        <span className={status === "done" ? "line-through text-gray-500" : ""}>{name}</span>
        <select
          value={status}
          disabled={pending}
          onChange={(e) => run(() => updateVisaStep(id, schoolId, e.target.value as any))}
          className="border rounded text-xs px-1 py-0.5"
          aria-label={`Status of ${name}`}
        >
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <Err message={error} />
    </li>
  );
}
