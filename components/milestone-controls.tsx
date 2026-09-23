"use client";
import { useState, useTransition } from "react";
import { deleteMilestone, updateMilestone, updateMilestoneStatus, type MilestoneStatus } from "@/app/(app)/research/actions";
import { createTask } from "@/app/(app)/tasks/actions";

const STATUSES: Array<{ key: MilestoneStatus; label: string }> = [
  { key: "not_started", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export function MilestoneStatusSelect({ id, value }: { id: string; value: MilestoneStatus }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => start(() => updateMilestoneStatus(id, e.target.value as MilestoneStatus))}
      className={`border rounded px-2 py-1 text-xs ${pending ? "opacity-50" : ""}`}
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
      <input name="title" defaultValue={title} required className="border rounded px-2 py-1 text-sm" />
      <textarea name="description" defaultValue={description ?? ""} rows={3} placeholder="Description" className="border rounded px-2 py-1 text-sm" />
      <label className="text-xs text-gray-500 flex items-center gap-2">
        Target date <input type="date" name="target_date" defaultValue={targetDate ?? ""} className="border rounded px-2 py-1 text-sm" />
      </label>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
  );
}

export function DeleteMilestoneButton({ id, title, taskCount }: { id: string; title: string; taskCount: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        const extra = taskCount > 0 ? ` Its ${taskCount} linked task${taskCount === 1 ? "" : "s"} will also be deleted.` : "";
        if (!confirm(`Delete milestone "${title}"?${extra} This cannot be undone.`)) return;
        start(() => deleteMilestone(id));
      }}
      className="text-xs text-red-600 border border-red-600 rounded px-2 py-1 self-start disabled:opacity-50"
    >
      Delete milestone
    </button>
  );
}

export function MilestoneTaskForm({ milestoneId, people }: { milestoneId: string; people: Array<{ id: string; name: string }> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2 mt-3"
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
      <input name="title" placeholder="Add a task to this milestone…" required className="border rounded px-2 py-1 text-sm" />
      <div className="flex gap-2 flex-wrap">
        <select name="assignee_id" className="border rounded px-2 py-1 text-sm">
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="priority" defaultValue="medium" className="border rounded px-2 py-1 text-sm">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
        <input type="date" name="due_date" className="border rounded px-2 py-1 text-sm" />
        <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm disabled:opacity-50">{pending ? "Adding…" : "Add task"}</button>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </form>
  );
}
