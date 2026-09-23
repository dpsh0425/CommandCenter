"use client";
import { useState } from "react";
import { createTask } from "@/app/(app)/tasks/actions";

type Option = { id: string; label: string };

export function NewTaskForm({
  schools, milestones, people,
}: { schools: Option[]; milestones: Option[]; people: Option[] }) {
  const [open, setOpen] = useState(false);
  const [linkType, setLinkType] = useState<"none" | "school" | "milestone">("none");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const linkId = String(formData.get("link_id") ?? "") || undefined;
    await createTask({
      title,
      description: String(formData.get("description") ?? "").trim() || undefined,
      schoolId: linkType === "school" ? linkId : undefined,
      researchMilestoneId: linkType === "milestone" ? linkId : undefined,
      assigneeId: String(formData.get("assignee_id") ?? "") || undefined,
      priority: (String(formData.get("priority") ?? "medium") as "low" | "medium" | "high"),
      dueDate: String(formData.get("due_date") ?? "") || undefined,
    });
    setOpen(false);
    setLinkType("none");
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm whitespace-nowrap">
        + New task
      </button>
    );
  }

  const linkOptions = linkType === "school" ? schools : linkType === "milestone" ? milestones : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4" onClick={() => setOpen(false)}>
    <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg border border-line rounded-xl p-5 flex flex-col gap-3 bg-surface-raised shadow-xl">
      <h2 className="font-sans text-base font-semibold text-cream">New task</h2>
      <input name="title" placeholder="Task title" className="border rounded px-2 py-1 text-sm" required autoFocus />
      <textarea name="description" placeholder="Description (optional)" className="border rounded px-2 py-1 text-sm" rows={2} />
      <div className="flex gap-2 flex-wrap">
        <select
          value={linkType}
          onChange={(e) => setLinkType(e.target.value as any)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="none">No link (general task)</option>
          <option value="school">Link to a school</option>
          <option value="milestone">Link to a research milestone</option>
        </select>
        {linkType !== "none" && (
          <select name="link_id" className="border rounded px-2 py-1 text-sm" required>
            <option value="">Choose {linkType}…</option>
            {linkOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <select name="assignee_id" className="border rounded px-2 py-1 text-sm">
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select name="priority" defaultValue="medium" className="border rounded px-2 py-1 text-sm">
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
        <input type="date" name="due_date" className="border rounded px-2 py-1 text-sm" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Create task</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">Cancel</button>
      </div>
    </form>
    </div>
  );
}
