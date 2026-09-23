import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { reassignTask } from "../actions";
import { FocusMode } from "@/components/focus-mode";
import {
  DeleteTaskButton, DependencyControls, LogForm, RemoveDependencyButton, TaskEditForm, TaskStatusSelect,
} from "@/components/task-controls";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d overdue` : `in ${d}d`);
const PRIORITY_TONE: Record<string, string> = { high: "text-red-600 border-red-600", medium: "text-brass border-brass", low: "text-gray-500 border-line" };
const TASK_TONE: Record<string, string> = {
  todo: "text-gray-500", in_progress: "text-brass", blocked: "text-red-600", done: "text-teal-600", cancelled: "text-gray-400",
};
const LOG_TONE: Record<string, string> = {
  result: "border-l-teal-600", status_change: "border-l-line", reassignment: "border-l-violet-600", note: "border-l-brass",
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: { user } }, { data: task }, { data: updates }, { data: people },
    { data: waitingOn }, { data: blocking }, { data: candidates }, { data: sessions },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("tasks").select("*, schools(id, name), research_milestones(id, title), people(name)").eq("id", id).single(),
    supabase.from("task_updates").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("people").select("id, name").order("name"),
    supabase.from("task_dependencies").select("depends_on_task_id, tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)").eq("task_id", id),
    supabase.from("task_dependencies").select("task_id, tasks!task_dependencies_task_id_fkey(id, title, status)").eq("depends_on_task_id", id),
    supabase.from("tasks").select("id, title").neq("id", id).not("status", "in", "(done,cancelled)").order("title"),
    supabase.from("focus_sessions").select("duration_minutes, ended_at").eq("task_id", id),
  ]);
  if (!task) {
    return (
      <main className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-3">
        <Link href="/tasks" className="text-xs text-gray-500 hover:text-cream">← All tasks</Link>
        <p className="text-gray-500">This task doesn't exist or you don't have access to it.</p>
      </main>
    );
  }

  const isOwner = user?.id === OWNER_USER_ID;
  const today = localDate(new Date());
  const t = task as any;
  const waiting = (waitingOn ?? []) as any[];
  const blockedBy = waiting.filter((d) => d.tasks.status !== "done" && d.tasks.status !== "cancelled");
  const takenIds = new Set(waiting.map((d) => d.depends_on_task_id));
  const blockingIds = new Set(((blocking ?? []) as any[]).map((b) => b.task_id));
  // Exclude tasks already depended on, and tasks this one blocks (would create a loop).
  const options = (candidates ?? []).filter((c) => !takenIds.has(c.id) && !blockingIds.has(c.id));
  const overdue = t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled";
  const focusedSessions = (sessions ?? []).filter((s) => s.ended_at).length;
  const focusedMinutes = (sessions ?? []).filter((s) => s.ended_at).reduce((n, s) => n + (s.duration_minutes ?? 0), 0);

  async function reassignForm(formData: FormData) {
    "use server";
    const newId = String(formData.get("assignee_id") ?? "") || null;
    await reassignTask(id, newId);
  }

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/tasks" className="text-xs text-gray-500 hover:text-cream self-start">← Task board</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className={`text-3xl font-semibold ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className={`border rounded-full px-2.5 py-0.5 ${PRIORITY_TONE[t.priority]}`}>{t.priority} priority</span>
              {t.due_date ? (
                <span className={`border rounded-full px-2.5 py-0.5 font-mono ${overdue ? "text-red-600 border-red-600" : "text-gray-500 border-line"}`}>
                  due {t.due_date} · {relative(daysBetween(today, t.due_date))}
                </span>
              ) : (
                <span className="border border-line rounded-full px-2.5 py-0.5 text-gray-400">no due date</span>
              )}
              {t.schools && <Link href={`/schools/${t.schools.id}`} className="border border-teal-600 text-teal-600 rounded-full px-2.5 py-0.5 hover:bg-surface-raised">{t.schools.name}</Link>}
              {t.research_milestones && <Link href={`/research/${t.research_milestones.id}`} className="border border-violet-600 text-violet-600 rounded-full px-2.5 py-0.5 hover:bg-surface-raised">{t.research_milestones.title}</Link>}
            </div>
          </div>
          <TaskStatusSelect id={t.id} value={t.status} />
        </div>
        {t.description && <p className="text-gray-500 whitespace-pre-line">{t.description}</p>}
        {isOwner && <TaskEditForm id={t.id} title={t.title} description={t.description} priority={t.priority} dueDate={t.due_date} />}
      </div>

      {blockedBy.length > 0 && (
        <div className="border border-yellow-300 bg-yellow-50 rounded p-3 text-sm">
          <span className="font-medium">Waiting on {blockedBy.length} task{blockedBy.length === 1 ? "" : "s"}: </span>
          {blockedBy.map((d, i) => (
            <span key={d.tasks.id}>{i > 0 && ", "}<Link href={`/tasks/${d.tasks.id}`} className="underline">{d.tasks.title}</Link></span>
          ))}
        </div>
      )}

      <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Focus</div>
            <div className="text-xs text-gray-400">
              {focusedSessions > 0 ? `${focusedSessions} session${focusedSessions === 1 ? "" : "s"} · ${focusedMinutes} min focused so far` : "No focus sessions yet"}
            </div>
          </div>
          <FocusMode taskId={id} title={t.title} />
        </div>
        <div className="border-t border-line pt-3 flex items-center gap-3 flex-wrap text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500">Assignee</span>
          {isOwner ? (
            <form action={reassignForm} className="flex gap-2 items-center">
              <select name="assignee_id" defaultValue={t.assignee_id ?? ""} className="border rounded px-2 py-1 text-sm">
                <option value="">Unassigned</option>
                {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Save</button>
            </form>
          ) : (
            <span>{t.people?.name ?? "You"}</span>
          )}
        </div>
      </section>

      {(isOwner || waiting.length > 0 || (blocking ?? []).length > 0) && (
        <section className="border border-line bg-surface rounded-lg p-4">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Dependencies</h2>
          {waiting.length === 0 && (blocking ?? []).length === 0 && (
            <p className="text-xs text-gray-400 border border-dashed border-line rounded p-3 text-center">Not linked to any other task.</p>
          )}
          {waiting.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1">This task waits on</div>
              <ul className="flex flex-col gap-1.5">
                {waiting.map((d) => (
                  <li key={d.tasks.id} className="border rounded p-2 text-sm flex items-center justify-between gap-2">
                    <Link href={`/tasks/${d.tasks.id}`} className={`hover:text-brass truncate ${d.tasks.status === "done" ? "line-through text-gray-500" : ""}`}>{d.tasks.title}</Link>
                    <span className="flex items-center gap-3">
                      <span className={`text-xs uppercase ${TASK_TONE[d.tasks.status]}`}>{d.tasks.status.replace("_", " ")}</span>
                      {isOwner && <RemoveDependencyButton taskId={id} dependsOnId={d.tasks.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(blocking ?? []).length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Blocking</div>
              <ul className="flex flex-col gap-1.5">
                {(blocking as any[]).map((d) => (
                  <li key={d.tasks.id} className="border rounded p-2 text-sm flex justify-between gap-2">
                    <Link href={`/tasks/${d.tasks.id}`} className="hover:text-brass truncate">{d.tasks.title}</Link>
                    <span className={`text-xs uppercase ${TASK_TONE[d.tasks.status]}`}>{d.tasks.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {isOwner && <DependencyControls taskId={id} options={options} />}
        </section>
      )}

      <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-4">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 flex justify-between">
          <span>Log</span><span className="font-mono">{(updates ?? []).length}</span>
        </h2>
        <LogForm taskId={id} />
        {(updates ?? []).length === 0 ? (
          <p className="text-xs text-gray-400 border border-dashed border-line rounded p-3 text-center">Nothing logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(updates ?? []).map((u) => (
              <li key={u.id} className={`border border-l-4 ${LOG_TONE[u.type] ?? "border-l-line"} rounded p-2.5 text-sm`}>
                <div className="text-xs text-gray-500 flex justify-between gap-2">
                  <span className="uppercase">{u.type === "result" ? "result · win" : u.type.replace("_", " ")}</span>
                  <span>{new Date(u.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-line">{u.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && <DeleteTaskButton id={t.id} title={t.title} />}
    </main>
  );
}
