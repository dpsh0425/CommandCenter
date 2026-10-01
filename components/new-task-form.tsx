"use client";
import { useEffect, useState } from "react";
import { createTask } from "@/app/(app)/tasks/actions";
import { PlusIcon } from "@/components/icons";

type Option = { id: string; label: string };

const fieldClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600";
const labelClass = "mb-1.5 block text-[13px] font-medium text-slate-700";

export function NewTaskForm({
  schools, milestones, people,
}: { schools: Option[]; milestones: Option[]; people: Option[] }) {
  const [open, setOpen] = useState(false);
  const [linkType, setLinkType] = useState<"none" | "school" | "milestone">("none");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const linkId = String(formData.get("link_id") ?? "") || undefined;
    setError(null);
    setPending(true);
    try {
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
      setPriority("medium");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task");
    } finally {
      setPending(false);
    }
  }

  const trigger = (
    <button
      type="button"
      onClick={() => { setError(null); setOpen(true); }}
      className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 pl-2.5 pr-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700"
    >
      <PlusIcon className="h-4 w-4" />
      New task
    </button>
  );

  if (!open) return trigger;

  const linkOptions = linkType === "school" ? schools : linkType === "milestone" ? milestones : [];
  const seg = (active: boolean) =>
    `h-8 rounded-md px-3 text-[13px] font-semibold transition-colors ${
      active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <>
      {trigger}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 pb-8 pt-[10vh]" onClick={() => setOpen(false)}>
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-task-title"
          className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 id="new-task-title" className="text-base font-semibold text-slate-900">New task</h2>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label htmlFor="nt-title" className={labelClass}>Title</label>
              <input id="nt-title" name="title" placeholder="What needs doing?" className={fieldClass} required autoFocus autoComplete="off" />
            </div>
            <div>
              <label htmlFor="nt-desc" className={labelClass}>Description <span className="font-normal text-slate-500">(optional)</span></label>
              <textarea id="nt-desc" name="description" rows={2} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600" />
            </div>

            <div>
              <span className={labelClass}>Link to</span>
              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Link to" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                  <button type="button" aria-pressed={linkType === "none"} onClick={() => setLinkType("none")} className={seg(linkType === "none")}>Nothing</button>
                  <button type="button" aria-pressed={linkType === "school"} onClick={() => setLinkType("school")} className={seg(linkType === "school")}>School</button>
                  <button type="button" aria-pressed={linkType === "milestone"} onClick={() => setLinkType("milestone")} className={seg(linkType === "milestone")}>Milestone</button>
                </div>
                {linkType !== "none" && (
                  <select name="link_id" aria-label={`Choose ${linkType}`} className={`${fieldClass} min-w-0 flex-1`} required>
                    <option value="">Choose {linkType}…</option>
                    {linkOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nt-assignee" className={labelClass}>Assignee</label>
                <select id="nt-assignee" name="assignee_id" className={fieldClass}>
                  <option value="">Unassigned</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nt-due" className={labelClass}>Due date</label>
                <input id="nt-due" type="date" name="due_date" className={fieldClass} />
              </div>
            </div>

            <div>
              <span className={labelClass}>Priority</span>
              <input type="hidden" name="priority" value={priority} />
              <div role="group" aria-label="Priority" className="inline-grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)} className={`${seg(priority === p)} capitalize`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 hover:border-slate-400">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="h-9 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {pending ? "Creating…" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
