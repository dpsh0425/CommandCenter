import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { reassignTask } from "../actions";
import { FocusMode } from "@/components/focus-mode";
import {
  DeleteTaskButton, DependencyControls, LogForm, RemoveDependencyButton, TaskEditForm, TaskStatusSelect,
} from "@/components/task-controls";
import { Fold, Meta, Section } from "@/components/ui";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d overdue` : `in ${d}d`);
const TASK_TONE: Record<string, string> = {
  todo: "text-gray-500", in_progress: "text-brass", blocked: "text-red-600", done: "text-teal-600", cancelled: "text-gray-400",
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

  const dueLabel = t.due_date ? new Date(t.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
  const assigneeName = t.people?.name ?? null;

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/tasks" className="text-xs text-gray-500 hover:text-cream self-start">← Tasks</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex flex-col gap-2">
            <h1 className={`text-4xl leading-tight ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</h1>
            <Meta
              items={[
                `${t.priority} priority`,
                dueLabel ? <span className={overdue ? "text-red-600" : ""}>due {dueLabel} ({relative(daysBetween(today, t.due_date))})</span> : "no due date",
                t.schools && <Link href={`/schools/${t.schools.id}`} className="text-brass hover:underline">{t.schools.name}</Link>,
                t.research_milestones && <Link href={`/research/${t.research_milestones.id}`} className="text-brass hover:underline">{t.research_milestones.title}</Link>,
              ]}
            />
          </div>
          <TaskStatusSelect id={t.id} value={t.status} />
        </div>
        {t.description && <p className="text-gray-500 whitespace-pre-line max-w-2xl">{t.description}</p>}
        {isOwner && <TaskEditForm id={t.id} title={t.title} description={t.description} priority={t.priority} dueDate={t.due_date} />}
      </div>

      {blockedBy.length > 0 && (
        <p className="text-sm text-brass">
          Waiting on{" "}
          {blockedBy.map((d, i) => (
            <span key={d.tasks.id}>{i > 0 && ", "}<Link href={`/tasks/${d.tasks.id}`} className="underline">{d.tasks.title}</Link></span>
          ))}
          .
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-line py-4">
        <div className="text-sm flex items-center gap-3 flex-wrap">
          <span className="text-gray-500">Assigned to</span>
          {isOwner ? (
            <form action={reassignForm} className="flex gap-2 items-center">
              <select name="assignee_id" defaultValue={t.assignee_id ?? ""} className="border rounded px-2 py-1 text-sm bg-transparent">
                <option value="">Nobody yet</option>
                {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="text-sm text-gray-500 hover:text-cream">Save</button>
            </form>
          ) : (
            <span>{assigneeName ?? "You"}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            {focusedSessions > 0 ? `${focusedMinutes} min focused · ${focusedSessions} session${focusedSessions === 1 ? "" : "s"}` : "No focus sessions yet"}
          </span>
          <FocusMode taskId={id} title={t.title} />
        </div>
      </div>

      {(isOwner || waiting.length > 0 || (blocking ?? []).length > 0) && (
        <Fold
          title="Dependencies"
          summary={waiting.length + (blocking ?? []).length === 0 ? "none" : `${waiting.length} waiting on · ${(blocking ?? []).length} blocking`}
          defaultOpen={waiting.length + (blocking ?? []).length > 0}
        >
          <div className="flex flex-col gap-4">
            {waiting.length > 0 && (
              <div className="flex flex-col">
                <h3 className="font-sans text-sm text-gray-500 mb-1">This task waits on</h3>
                {waiting.map((d) => (
                  <div key={d.tasks.id} className="flex items-center justify-between gap-3 py-2 border-b border-line/60 last:border-0 text-sm">
                    <Link href={`/tasks/${d.tasks.id}`} className={`hover:text-brass truncate ${d.tasks.status === "done" ? "line-through text-gray-500" : ""}`}>{d.tasks.title}</Link>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs ${TASK_TONE[d.tasks.status]}`}>{d.tasks.status.replace("_", " ")}</span>
                      {isOwner && <RemoveDependencyButton taskId={id} dependsOnId={d.tasks.id} />}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(blocking ?? []).length > 0 && (
              <div className="flex flex-col">
                <h3 className="font-sans text-sm text-gray-500 mb-1">This task is blocking</h3>
                {(blocking as any[]).map((d) => (
                  <div key={d.tasks.id} className="flex items-center justify-between gap-3 py-2 border-b border-line/60 last:border-0 text-sm">
                    <Link href={`/tasks/${d.tasks.id}`} className="hover:text-brass truncate">{d.tasks.title}</Link>
                    <span className={`text-xs ${TASK_TONE[d.tasks.status]}`}>{d.tasks.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
            {isOwner && <DependencyControls taskId={id} options={options} />}
          </div>
        </Fold>
      )}

      <Section title="Log" hint={(updates ?? []).length ? `${(updates ?? []).length} entries` : undefined}>
        <LogForm taskId={id} />
        {(updates ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Nothing logged yet. Notes and results you add appear here.</p>
        ) : (
          <ul className="flex flex-col">
            {(updates ?? []).map((u) => (
              <li key={u.id} className="flex gap-4 py-3 border-b border-line/60 last:border-0">
                <span className="w-24 flex-shrink-0 text-xs text-gray-400 pt-0.5">
                  {new Date(u.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm whitespace-pre-line ${u.type === "status_change" || u.type === "reassignment" ? "text-gray-500" : ""}`}>{u.content}</p>
                  {u.type === "result" && <span className="text-xs text-teal-600">Result, counted as a win</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isOwner && (
        <div className="pt-2">
          <DeleteTaskButton id={t.id} title={t.title} />
        </div>
      )}
    </main>
  );
}
