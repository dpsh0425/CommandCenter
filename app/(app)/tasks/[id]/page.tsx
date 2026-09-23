import { createClient } from "@/lib/supabase/server";
import { reassignTask, addTaskUpdate } from "../actions";
import { FocusMode } from "@/components/focus-mode";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: task }, { data: updates }, { data: people }, { data: deps }] = await Promise.all([
    supabase.from("tasks").select("*, schools(name), research_milestones(title)").eq("id", id).single(),
    supabase.from("task_updates").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("people").select("id, name"),
    supabase.from("task_dependencies").select("depends_on_task_id, tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)").eq("task_id", id),
  ]);
  if (!task) return <p className="p-8">Not found.</p>;

  async function reassignForm(formData: FormData) {
    "use server";
    const newId = String(formData.get("assignee_id") ?? "") || null;
    await reassignTask(id, newId);
  }
  async function noteForm(formData: FormData) {
    "use server";
    const content = String(formData.get("content") ?? "").trim();
    if (content) await addTaskUpdate(id, "note", content);
  }

  return (
    <main className="p-8 max-w-2xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{task.title}</h1>
      <p className="text-gray-600">{task.description}</p>
      {(task as any).schools && <p className="text-sm text-teal-700">Linked to {(task as any).schools.name}</p>}
      {(task as any).research_milestones && <p className="text-sm text-violet-700">Linked to {(task as any).research_milestones.title}</p>}

      <FocusMode taskId={id} title={task.title} />

      {deps && deps.length > 0 && (
        <div className="text-sm bg-yellow-50 border border-yellow-300 rounded p-2">
          Depends on: {deps.map((d: any) => `${d.tasks.title} (${d.tasks.status})`).join(", ")}
          {deps.some((d: any) => d.tasks.status !== "done") && " — not all dependencies are done yet."}
        </div>
      )}

      <form action={reassignForm} className="flex gap-2 items-center">
        <label className="text-sm text-gray-500">Assignee</label>
        <select name="assignee_id" defaultValue={task.assignee_id ?? ""} className="border rounded px-2 py-1 text-sm">
          <option value="">Unassigned</option>
          {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="bg-black text-white rounded px-3 py-1 text-sm">Reassign</button>
      </form>

      <form action={noteForm} className="flex flex-col gap-2">
        <textarea name="content" placeholder="Add a note or result…" className="border rounded p-2 text-sm" rows={2} />
        <button className="bg-black text-white rounded px-3 py-1 text-sm self-start">Add to log</button>
      </form>

      <div>
        <h2 className="font-medium mb-2">Log</h2>
        <ul className="flex flex-col gap-2">
          {(updates ?? []).map((u) => (
            <li key={u.id} className="border rounded p-2 text-sm">
              <div className="text-xs text-gray-500 flex justify-between">
                <span>{u.type.replace("_", " ")}</span><span>{new Date(u.created_at).toLocaleString()}</span>
              </div>
              <p>{u.content}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
