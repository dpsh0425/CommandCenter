import { createClient } from "@/lib/supabase/server";
import { TaskBoard } from "@/components/task-board";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, schools(name), research_milestones(title), people(name)")
    .order("due_date", { ascending: true, nullsFirst: false });

  const { data: deps } = await supabase
    .from("task_dependencies")
    .select("task_id, tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)");

  const depsByTask = new Map<string, { title: string; status: string }[]>();
  for (const d of deps ?? []) {
    const dep = (d as any).tasks;
    if (dep.status === "done") continue;
    const list = depsByTask.get(d.task_id) ?? [];
    list.push({ title: dep.title, status: dep.status });
    depsByTask.set(d.task_id, list);
  }

  const shaped = (tasks ?? []).map((t: any) => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date,
    school_name: t.schools?.name ?? null, milestone_title: t.research_milestones?.title ?? null,
    assignee_name: t.people?.name ?? null,
    openDependencies: depsByTask.get(t.id) ?? [],
  }));

  return (
    <main className="p-8 max-w-6xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Task board</h1>
      <TaskBoard tasks={shaped} />
    </main>
  );
}
