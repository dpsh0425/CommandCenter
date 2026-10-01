"use client";
import { useState, useTransition } from "react";
import {
  addTaskDependency, addTaskUpdate, deleteTask, removeTaskDependency, updateTask, updateTaskStatus,
} from "@/app/(app)/tasks/actions";

const STATUSES = [
  { key: "todo", label: "To do" }, { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" }, { key: "done", label: "Done" }, { key: "cancelled", label: "Cancelled" },
];
type Priority = "low" | "medium" | "high";
const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const fieldClass = "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600";
const primaryBtn = "h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryBtn = "h-9 rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60";
const errorText = "text-xs text-red-700";

export function TaskStatusSelect({ id, value }: { id: string; value: string }) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex flex-col gap-1">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          setFailed(false);
          const next = e.target.value;
          start(async () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await updateTaskStatus(id, next as any);
            } catch {
              setFailed(true);
            }
          });
        }}
        className={`${fieldClass} w-full ${pending ? "opacity-50" : ""}`}
        aria-label="Task status"
      >
        {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      {failed && <span role="alert" className={errorText}>Couldn&apos;t save. Try again.</span>}
    </span>
  );
}

export function TaskEditForm({
  id, title, description, priority, dueDate,
}: { id: string; title: string; description: string | null; priority: Priority; dueDate: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={`${secondaryBtn} h-8 self-start px-3`}>Edit details</button>;
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const newTitle = String(f.get("title") ?? "").trim();
        if (!newTitle) return;
        setError(null);
        start(async () => {
          try {
            await updateTask(id, {
              title: newTitle,
              description: String(f.get("description") ?? "").trim() || null,
              priority: String(f.get("priority")) as Priority,
              dueDate: String(f.get("due_date") ?? "") || null,
            });
            setOpen(false);
          } catch (err) {
            setError(messageOf(err, "Could not save"));
          }
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-slate-700">
        Title
        <input name="title" defaultValue={title} required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-slate-700">
        Description
        <textarea name="description" defaultValue={description ?? ""} rows={3} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-blue-600" />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-slate-700">
          Priority
          <select name="priority" defaultValue={priority} className={fieldClass}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-slate-700">
          Due date
          <input type="date" name="due_date" defaultValue={dueDate ?? ""} className={fieldClass} />
        </label>
      </div>
      {error && <p role="alert" className={errorText}>{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={primaryBtn}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>Cancel</button>
      </div>
    </form>
  );
}

export function LogForm({ taskId }: { taskId: string }) {
  const [kind, setKind] = useState<"note" | "result">("note");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const content = String(new FormData(form).get("content") ?? "").trim();
        if (!content) return;
        setError(null);
        start(async () => {
          try {
            await addTaskUpdate(taskId, kind, content);
            form.reset();
          } catch (err) {
            setError(messageOf(err, "Could not add to log"));
          }
        });
      }}
    >
      <div role="group" aria-label="Entry type" className="grid grid-cols-2 gap-1 self-start rounded-lg bg-slate-100 p-1">
        {(["note", "result"] as const).map((k) => (
          <button
            key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
            className={`h-7 rounded-md px-3 text-xs font-semibold transition-colors ${
              kind === k ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {k === "note" ? "Note" : "Result (counts as a win)"}
          </button>
        ))}
      </div>
      <textarea
        name="content" rows={2} required
        aria-label={kind === "note" ? "Note" : "Result"}
        placeholder={kind === "note" ? "What happened? Any blockers or context…" : "What did you finish or find out?"}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600"
      />
      {error && <p role="alert" className={errorText}>{error}</p>}
      <button disabled={pending} className={`${primaryBtn} self-start`}>
        {pending ? "Saving…" : kind === "note" ? "Add note" : "Log result"}
      </button>
    </form>
  );
}

export function DependencyControls({
  taskId, options,
}: { taskId: string; options: Array<{ id: string; title: string }> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (options.length === 0) return <p className="text-xs text-slate-500">No other open tasks to depend on.</p>;
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const depId = String(new FormData(e.currentTarget).get("dep") ?? "");
        if (!depId) return;
        setError(null);
        start(async () => {
          try {
            await addTaskDependency(taskId, depId);
          } catch (err) {
            setError(messageOf(err, "Could not add dependency"));
          }
        });
      }}
    >
      <div className="flex gap-2">
        <select name="dep" defaultValue="" className={`${fieldClass} min-w-0 flex-1 text-[13px]`} aria-label="Depends on task">
          <option value="" disabled>This task waits on…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        <button disabled={pending} className={secondaryBtn}>Add</button>
      </div>
      {error && <span role="alert" className={errorText}>{error}</span>}
    </form>
  );
}

export function RemoveDependencyButton({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => removeTaskDependency(taskId, dependsOnId))}
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      aria-label="Remove dependency"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
      </svg>
    </button>
  );
}

export function DeleteTaskButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete task "${title}"? Its log and focus sessions go with it. This cannot be undone.`)) return;
        start(() => deleteTask(id));
      }}
      className="h-8 self-start rounded-md border border-red-300 bg-white px-3 text-[13px] font-medium text-red-700 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete task"}
    </button>
  );
}
