"use client";
import { useState, useTransition } from "react";
import { deleteMilestone, updateMilestone, updateMilestoneStatus, type MilestoneStatus } from "@/app/(app)/research/actions";
import { createTask } from "@/app/(app)/tasks/actions";

const STATUSES: Array<{ key: MilestoneStatus; label: string; tone: string }> = [
  { key: "not_started", label: "Not started", tone: "border-slate-300 bg-white text-slate-600" },
  { key: "in_progress", label: "In progress", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { key: "blocked", label: "Blocked", tone: "border-red-200 bg-red-50 text-red-700" },
  { key: "done", label: "Done", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";

export function MilestoneStatusSelect({ id, value }: { id: string; value: MilestoneStatus }) {
  const [pending, start] = useTransition();
  const tone = STATUSES.find((s) => s.key === value)?.tone ?? STATUSES[0].tone;
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => start(() => updateMilestoneStatus(id, e.target.value as MilestoneStatus))}
      className={`h-7 flex-shrink-0 cursor-pointer rounded-full border px-2 text-xs font-medium ${tone} ${pending ? "opacity-50" : ""}`}
      aria-label="Milestone status"
    >
      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  );
}

export function MilestoneEditForm({
  id, title, description, targetDate,
}: { id: string; title: string; description: string | null; targetDate: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-8 self-start rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50">
        Edit details
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const newTitle = String(f.get("title") ?? "").trim();
        if (!newTitle) return;
        setError(null);
        start(async () => {
          try {
            await updateMilestone(id, {
              title: newTitle,
              description: String(f.get("description") ?? "").trim() || null,
              targetDate: String(f.get("target_date") ?? "") || null,
            });
            setOpen(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          }
        });
      }}
    >
      <h2 className="text-[15px] font-semibold text-slate-900">Edit milestone</h2>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Title<input name="title" defaultValue={title} required className={input} /></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Description<textarea name="description" defaultValue={description ?? ""} rows={3} placeholder="Description" className={input} /></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Target date<input type="date" name="target_date" defaultValue={targetDate ?? ""} className={`${input} w-44`} /></label>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={primary}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
      </div>
    </form>
  );
}

export function DeleteMilestoneButton({ id, title, taskCount }: { id: string; title: string; taskCount: number }) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button" disabled={pending} onClick={() => setAsking(true)}
        className="h-8 self-start rounded-md border border-red-300 bg-white px-3 text-[13px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        Delete milestone
      </button>
    );
  }
  const extra = taskCount > 0 ? ` Its ${taskCount} linked task${taskCount === 1 ? "" : "s"} will also be deleted.` : "";
  return (
    <span role="group" aria-label={`Delete milestone ${title}?`} className="flex flex-wrap items-center gap-2 self-start rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
      Delete milestone &ldquo;{title}&rdquo;?{extra} This cannot be undone.
      <button type="button" disabled={pending} onClick={() => start(() => deleteMilestone(id))} className="h-7 rounded bg-red-600 px-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className="h-7 rounded px-2.5 font-medium text-slate-700 hover:bg-white">Keep</button>
    </span>
  );
}

export function MilestoneTaskForm({ milestoneId, people }: { milestoneId: string; people: Array<{ id: string; name: string }> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2 border-t border-slate-100 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const title = String(f.get("title") ?? "").trim();
        if (!title) return;
        setError(null);
        start(async () => {
          try {
            await createTask({
              title,
              researchMilestoneId: milestoneId,
              assigneeId: String(f.get("assignee_id") ?? "") || undefined,
              priority: String(f.get("priority") ?? "medium") as "low" | "medium" | "high",
              dueDate: String(f.get("due_date") ?? "") || undefined,
            });
            form.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add task");
          }
        });
      }}
    >
      <input name="title" placeholder="Add a task to this milestone…" aria-label="Task" required className={input} />
      <div className="flex flex-wrap gap-2">
        <select name="assignee_id" aria-label="Assign to" className={`${input} w-40`}>
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="priority" defaultValue="medium" aria-label="Priority" className={`${input} w-28`}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
        <input type="date" name="due_date" aria-label="Due date" className={`${input} w-40`} />
        <button disabled={pending} className={primary}>{pending ? "Adding…" : "Add task"}</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
