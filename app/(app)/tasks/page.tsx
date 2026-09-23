import { createClient } from "@/lib/supabase/server";
import { TaskBoard } from "@/components/task-board";
import { NewTaskForm } from "@/components/new-task-form";
import { OWNER_USER_ID } from "@/lib/owner";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: tasks }, { data: schools }, { data: milestones }, { data: people }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("tasks").select("*, schools(name), research_milestones(title), people(name)").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("schools").select("id, name").order("name"),
    supabase.from("research_milestones").select("id, title").order("title"),
    supabase.from("people").select("id, name").order("name"),
  ]);
  const isOwner = user?.id === OWNER_USER_ID;

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
    <main className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Task board</h1>
      {isOwner && (
        <NewTaskForm
          schools={(schools ?? []).map((s) => ({ id: s.id, label: s.name }))}
          milestones={(milestones ?? []).map((m) => ({ id: m.id, label: m.title }))}
          people={(people ?? []).map((p) => ({ id: p.id, label: p.name }))}
        />
      )}
      <TaskBoard tasks={shaped} />
    </main>
  );
}
