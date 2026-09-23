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

export function TaskStatusSelect({ id, value }: { id: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => start(() => updateTaskStatus(id, e.target.value as any))}
      className={`border rounded px-2 py-1 text-sm ${pending ? "opacity-50" : ""}`}
      aria-label="Task status"
    >
      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  );
}

export function TaskEditForm({
  id, title, description, priority, dueDate,
}: { id: string; title: string; description: string | null; priority: Priority; dueDate: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-xs text-gray-500 underline self-start hover:text-cream">Edit details</button>;
  }
  return (
    <form
      className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-2"
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
      <input name="title" defaultValue={title} required className="border rounded px-2 py-1.5 text-sm" />
      <textarea name="description" defaultValue={description ?? ""} rows={3} placeholder="Description" className="border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2 flex-wrap items-center">
        <select name="priority" defaultValue={priority} className="border rounded px-2 py-1.5 text-sm">
          <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option>
        </select>
        <label className="text-xs text-gray-500 flex items-center gap-2">
          Due <input type="date" name="due_date" defaultValue={dueDate ?? ""} className="border rounded px-2 py-1.5 text-sm" />
        </label>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">Cancel</button>
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
      className="flex flex-col gap-2"
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
      <div className="flex gap-1 border border-line rounded p-1 self-start text-xs">
        {(["note", "result"] as const).map((k) => (
          <button
            key={k} type="button" onClick={() => setKind(k)}
            className={`px-3 py-1 rounded ${kind === k ? "bg-surface-raised text-cream font-medium" : "text-gray-500 hover:text-cream"}`}
          >
            {k === "note" ? "Note" : "Result (counts as a win)"}
          </button>
        ))}
      </div>
      <textarea
        name="content" rows={2} required
        placeholder={kind === "note" ? "What happened? Any blockers or context…" : "What did you finish or find out?"}
        className="border rounded p-2 text-sm"
      />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm self-start disabled:opacity-50">
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
  if (options.length === 0) return <p className="text-xs text-gray-400 mt-2">No other open tasks to depend on.</p>;
  return (
    <form
      className="flex gap-2 mt-3"
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
      <select name="dep" defaultValue="" className="border rounded px-2 py-1.5 text-sm flex-1 min-w-0" aria-label="Depends on task">
        <option value="" disabled>This task waits on…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
      </select>
      <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50">Add</button>
      {error && <span className="text-red-600 text-xs self-center">{error}</span>}
    </form>
  );
}

export function RemoveDependencyButton({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => removeTaskDependency(taskId, dependsOnId))}
      className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
      aria-label="Remove dependency"
    >
      ✕
    </button>
  );
}

export function DeleteTaskButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete task "${title}"? Its log and focus sessions go with it. This cannot be undone.`)) return;
        start(() => deleteTask(id));
      }}
      className="text-xs text-red-600 border border-red-600 rounded px-2 py-1 self-start disabled:opacity-50"
    >
      Delete task
    </button>
  );
}
