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

const btn = "h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const btnSm = "h-8 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const ghost = "h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";
const field = "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600";
const select = "h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 hover:border-slate-300 disabled:opacity-50";
const Err = ({ message }: { message: string | null }) => (message ? <p role="alert" className="text-xs text-red-700">{message}</p> : null);

// Asks in place before running onConfirm: the question with a red confirm button and "Keep".
function ConfirmInline({ question, confirmLabel, onConfirm, onCancel, disabled }: { question: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[13px] text-red-800" role="group" aria-label={question}>
      {question}
      <button type="button" disabled={disabled} onClick={onConfirm} className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">{confirmLabel}</button>
      <button type="button" onClick={onCancel} className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white">Keep</button>
    </span>
  );
}

function RemoveButton({ label, question, confirmLabel = "Remove", onConfirm, disabled }: { label: string; question: string; confirmLabel?: string; onConfirm: () => void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (asking) return <ConfirmInline question={question} confirmLabel={confirmLabel} disabled={disabled} onConfirm={() => { setAsking(false); onConfirm(); }} onCancel={() => setAsking(false)} />;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setAsking(true)}
      aria-label={label}
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
      </svg>
    </button>
  );
}

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
          <dt className="text-slate-500">Deadline</dt>
          <dd>{props.deadlineDate ? <span className="font-mono">{props.deadlineDate}</span> : <span className="text-slate-400">not set</span>}{props.deadlineNote && <span className="text-slate-500"> — {props.deadlineNote}</span>}</dd>
          <dt className="text-slate-500">Contact</dt>
          <dd className="min-w-0 truncate">
            {props.contactEmail ? <a className="text-blue-600 underline" href={`mailto:${props.contactEmail}`}>{props.contactEmail}</a> : <span className="text-slate-400">not set</span>}
          </dd>
        </dl>
        <button type="button" onClick={() => setOpen(true)} className={`${ghost} self-start`}>Edit details</button>
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
      <label className="flex flex-col gap-1 text-[13px] font-medium text-slate-700">Application deadline
        <input type="date" name="deadline_date" defaultValue={props.deadlineDate ?? ""} className={field} />
      </label>
      <input name="deadline_note" defaultValue={props.deadlineNote ?? ""} placeholder="Deadline note (e.g. rolling, unconfirmed)" aria-label="Deadline note" className={field} />
      <input name="contact_email" type="email" defaultValue={props.contactEmail ?? ""} placeholder="Contact email" aria-label="Contact email" className={field} />
      <input name="faculty" defaultValue={props.faculty ?? ""} placeholder="Target faculty" aria-label="Target faculty" className={field} />
      <textarea name="fit_note" defaultValue={props.fitNote ?? ""} rows={3} placeholder="Why this is a fit" aria-label="Why this is a fit" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <Err message={error} />
      <div className="flex gap-2">
        <button disabled={pending} className={btn}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className={ghost}>Cancel</button>
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
      className="flex flex-col gap-2"
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
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex items-center gap-1">
      <RemoveButton
        label="Delete note"
        disabled={pending}
        question="Delete this note?"
        confirmLabel="Delete"
        onConfirm={() => run(() => deleteNote(schoolId, activityId))}
      />
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

export function SchoolTaskForm({ schoolId, people }: { schoolId: string; people: Array<{ id: string; name: string }> }) {
  const { pending, error, run } = useRun();
  return (
    <form
      className="mt-3 flex flex-col gap-2"
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
      <input name="title" required placeholder="Add a task for this school…" aria-label="Task title" className={field} />
      <div className="flex flex-wrap gap-2">
        <select name="assignee_id" aria-label="Assignee" className={field}>
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="priority" defaultValue="medium" aria-label="Priority" className={field}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
        <input type="date" name="due_date" aria-label="Due date" className={field} />
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
    <li className={`flex flex-col gap-1 rounded-md px-3 py-2 transition-colors hover:bg-slate-50 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-slate-900">
          {name}
          {deadline && <span className="font-normal text-slate-500"> · due {letterDate(deadline)}</span>}
        </span>
        <span className="flex items-center gap-2">
          {flags.map((f) => <span key={f} className="rounded-full bg-blue-50 px-2 py-px text-[11px] font-medium text-blue-700">{FLAG_LABEL[f]}</span>)}
          {recommenderId && <Link href={`/materials/letters?focus=${recommenderId}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">Draft email</Link>}
          <select
            value={status}
            disabled={pending}
            onChange={(e) => run(() => updateLetterStatus(id, schoolId, e.target.value))}
            className={select}
            aria-label={`Letter status for ${name}`}
          >
            {LETTER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <RemoveButton
            label="Remove letter request"
            disabled={pending}
            question={`Remove ${name}'s letter request?`}
            onConfirm={() => run(() => removeLetterRequest(id, schoolId))}
          />
        </span>
      </div>
      {facts.length > 0 && <span className="text-xs text-slate-500">{facts.join(" · ")}</span>}
      <Err message={error} />
    </li>
  );
}

export function AddLetterForm({ schoolId, people }: { schoolId: string; people: Array<{ id: string; name: string }> }) {
  const { pending, error, run } = useRun();
  if (people.length === 0) {
    return <p className="text-xs text-slate-500">Add a recommender on the <Link href="/people" className="font-medium text-blue-600">People page</Link> first.</p>;
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const rec = String(f.get("recommender_id") ?? "");
        if (rec) run(() => addLetterRequest(schoolId, rec, String(f.get("letter_deadline") ?? "") || undefined), () => form.reset());
      }}
    >
      <select name="recommender_id" required defaultValue="" aria-label="Recommender" className={field}>
        <option value="" disabled>Choose recommender…</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="date" name="letter_deadline" className={field} aria-label="Letter deadline" />
      <button disabled={pending} className={btn}>{pending ? "Adding…" : "Request letter"}</button>
      <Err message={error} />
    </form>
  );
}

export function SopForm({ schoolId, current }: { schoolId: string; current: { label: string; sentAt: string | null } | null }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(!current);
  const [clearing, setClearing] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {current && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span><span className="font-medium text-slate-900">{current.label}</span><span className="text-slate-500"> · sent {current.sentAt ?? "date unknown"}</span></span>
          <span className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setEditing((v) => !v)} className={ghost}>{editing ? "Cancel" : "Change"}</button>
            {clearing ? (
              <ConfirmInline
                question="Clear the recorded SOP for this school?"
                confirmLabel="Clear"
                disabled={pending}
                onConfirm={() => { setClearing(false); run(() => clearSchoolSop(schoolId)); }}
                onCancel={() => setClearing(false)}
              />
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setClearing(true)}
                className="h-8 rounded-md px-2.5 text-[13px] font-medium text-red-700 hover:bg-red-50"
              >
                Clear
              </button>
            )}
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
          <input name="label" required placeholder="Version label, e.g. v3 — AU variant" aria-label="Version label" className={field} />
          <input name="external_link" type="url" placeholder="Link to the document (optional)" aria-label="Link to the document" className={field} />
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
    <li className={`flex flex-col gap-1.5 rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">{when ? new Date(when).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time TBD"}</span>
        <span className="flex items-center gap-2">
          <select
            value={status}
            disabled={pending}
            onChange={(e) => run(() => updateInterview(id, schoolId, { status: e.target.value as InterviewStatus }))}
            className={select}
            aria-label="Interview status"
          >
            {INTERVIEW_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <RemoveButton
            label="Delete interview"
            disabled={pending}
            question="Delete this interview?"
            confirmLabel="Delete"
            onConfirm={() => run(() => deleteInterview(id, schoolId))}
          />
        </span>
      </div>
      {prep && <p className="text-xs text-slate-600"><span className="text-slate-500">Prep:</span> {prep}</p>}
      {outcome && !showOutcome && <p className="text-xs text-slate-600"><span className="text-slate-500">Outcome:</span> {outcome}</p>}
      {showOutcome ? (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get("outcome") ?? "").trim() || null;
            run(() => updateInterview(id, schoolId, { outcomeNotes: v }), () => setShowOutcome(false));
          }}
        >
          <textarea name="outcome" defaultValue={outcome ?? ""} rows={2} placeholder="How did it go? Questions asked, follow-ups…" aria-label="Outcome notes" className="rounded-md border border-slate-300 px-3 py-2 text-xs" />
          <div className="flex gap-2">
            <button disabled={pending} className={btnSm}>Save</button>
            <button type="button" onClick={() => setShowOutcome(false)} className={ghost}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setShowOutcome(true)} className="self-start text-xs font-medium text-blue-600 hover:text-blue-700">{outcome ? "Edit outcome notes" : "Add outcome notes"}</button>
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
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" name="scheduled_at" required aria-label="Interview date and time" className={field} />
        <input name="prep_notes" placeholder="Prep notes (optional)" aria-label="Prep notes" className={`${field} min-w-0 flex-1`} />
      </div>
      <Err message={error} />
      <button disabled={pending} className={`${btn} self-start`}>{pending ? "Scheduling…" : "Schedule interview"}</button>
    </form>
  );
}

export function VisaStepRow({ id, schoolId, name, status }: { id: string; schoolId: string; name: string; status: string }) {
  const { pending, error, run } = useRun();
  return (
    <li className={`flex flex-col gap-1 rounded-md px-3 py-2 transition-colors hover:bg-slate-50 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm ${status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{name}</span>
        <select
          value={status}
          disabled={pending}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={(e) => run(() => updateVisaStep(id, schoolId, e.target.value as any))}
          className={select}
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
