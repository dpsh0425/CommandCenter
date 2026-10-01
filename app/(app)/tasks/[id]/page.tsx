import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { reassignTask } from "../actions";
import { FocusMode } from "@/components/focus-mode";
import {
  DeleteTaskButton, DependencyControls, LogForm, RemoveDependencyButton, TaskEditForm, TaskStatusSelect,
} from "@/components/task-controls";
import { ChevronRightIcon, FileTextIcon, TrophyIcon, UsersIcon } from "@/components/icons";
import { todayString } from "@/lib/app-date";

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d overdue` : `in ${d}d`);
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "bg-slate-100 text-slate-700" },
  in_progress: { label: "In progress", cls: "bg-blue-50 text-blue-700" },
  blocked: { label: "Blocked", cls: "bg-red-50 text-red-700" },
  done: { label: "Done", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500" },
};
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? STATUS_BADGE.todo;
  return <span className={`flex-shrink-0 rounded-full px-2 py-px text-[11px] font-medium ${b.cls}`}>{b.label}</span>;
}

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
      <main className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:p-8">
        <Link href="/tasks" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← Tasks</Link>
        <p className="text-sm text-slate-600">This task doesn&apos;t exist or you don&apos;t have access to it.</p>
      </main>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const isOwner = user?.id === OWNER_USER_ID;
  const today = todayString();
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
  /* eslint-enable @typescript-eslint/no-explicit-any */

  async function reassignForm(formData: FormData) {
    "use server";
    const newId = String(formData.get("assignee_id") ?? "") || null;
    await reassignTask(id, newId);
  }

  const dueLabel = t.due_date ? new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const assigneeName = t.people?.name ?? null;
  const blockingList = (blocking ?? []) as unknown as Array<{ tasks: { id: string; title: string; status: string } }>;
  const logEntries = updates ?? [];
  const tz = process.env.APP_TIMEZONE || undefined;
  const when = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
    } catch {
      return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
  };

  const card = "rounded-lg border border-slate-200 bg-white";
  const row = "flex items-center justify-between gap-3 text-[13px]";

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 p-4 md:p-8">
      <Link href="/tasks" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← Tasks</Link>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Task</p>
            <h1 className={`text-[26px] font-semibold leading-[34px] tracking-tight ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
              {t.title}
            </h1>
            {t.description && <p className="max-w-2xl whitespace-pre-line text-sm leading-[22px] text-slate-600">{t.description}</p>}
            {isOwner && <TaskEditForm id={t.id} title={t.title} description={t.description} priority={t.priority} dueDate={t.due_date} />}
          </div>

          {blockedBy.length > 0 && (
            <p className="flex items-start gap-2.5 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-[13px] text-violet-800">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
              <span>
                Waiting on{" "}
                {blockedBy.map((d, i) => (
                  <span key={d.tasks.id}>{i > 0 && ", "}<Link href={`/tasks/${d.tasks.id}`} className="font-medium underline">{d.tasks.title}</Link></span>
                ))}
                . You can still finish this task.
              </span>
            </p>
          )}

          <section className={card}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-[15px] font-semibold text-slate-900">
                Log{logEntries.length > 0 && <span className="ml-1 text-[13px] font-normal text-slate-500">· {logEntries.length} {logEntries.length === 1 ? "entry" : "entries"}</span>}
              </h2>
            </div>
            <div className="border-b border-slate-200 px-5 py-4">
              <LogForm taskId={id} />
            </div>
            {logEntries.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-500">Nothing logged yet. Notes and results you add appear here.</p>
            ) : (
              <ol className="px-5 py-2">
                {logEntries.map((u) => {
                  const system = u.type === "status_change" || u.type === "reassignment";
                  const Icon = u.type === "result" ? TrophyIcon : u.type === "reassignment" ? UsersIcon : system ? ChevronRightIcon : FileTextIcon;
                  return (
                    <li key={u.id} className="flex gap-3 border-b border-slate-100 py-2.5 last:border-0">
                      <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${u.type === "result" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className={`whitespace-pre-line text-sm ${system ? "text-slate-600" : "text-slate-900"}`}>{u.content}</p>
                        <span className={`text-xs ${u.type === "result" ? "text-blue-700" : "text-slate-500"}`}>
                          {u.type === "result" ? "Result · counted as a win · " : u.type === "note" ? "Note · " : ""}
                          {when(u.created_at)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* ── Side column ── */}
        <aside className="flex min-w-0 flex-col gap-4">
          <section className={`${card} flex flex-col gap-3.5 px-5 py-4`}>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-slate-500">Status</span>
              <TaskStatusSelect id={t.id} value={t.status} />
            </div>
            <div className={row}>
              <span className="text-slate-500">Priority</span>
              {t.priority === "high" ? (
                <span className="rounded-full bg-red-50 px-2 py-px text-xs font-medium text-red-700">High</span>
              ) : (
                <span className="text-slate-900">{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
              )}
            </div>
            <div className={row}>
              <span className="text-slate-500">Due</span>
              {dueLabel ? (
                <span className={overdue ? "font-medium text-red-700" : "text-slate-900"}>{dueLabel} · {relative(daysBetween(today, t.due_date))}</span>
              ) : (
                <span className="text-slate-500">No due date</span>
              )}
            </div>
            {(t.schools || t.research_milestones) && (
              <div className={row}>
                <span className="text-slate-500">Linked to</span>
                {t.schools ? (
                  <Link href={`/schools/${t.schools.id}`} className="truncate font-medium text-blue-600 hover:text-blue-700">{t.schools.name}</Link>
                ) : (
                  <Link href={`/research/${t.research_milestones.id}`} className="truncate font-medium text-blue-600 hover:text-blue-700">{t.research_milestones.title}</Link>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3.5 text-[13px]">
              <span className="text-slate-500">Assigned to</span>
              {isOwner ? (
                <form action={reassignForm} className="flex gap-2">
                  <select name="assignee_id" defaultValue={t.assignee_id ?? ""} aria-label="Assignee" className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900">
                    <option value="">Nobody yet</option>
                    {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button className="h-9 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50">Save</button>
                </form>
              ) : (
                <span className="text-slate-900">{assigneeName ?? "You"}</span>
              )}
            </div>
          </section>

          <section className={`${card} flex flex-col gap-2.5 px-5 py-4`}>
            <h2 className="text-[15px] font-semibold text-slate-900">Focus</h2>
            <p className="text-[13px] text-slate-600">
              {focusedSessions > 0 ? `${focusedMinutes} min focused · ${focusedSessions} session${focusedSessions === 1 ? "" : "s"}` : "No focus sessions yet"}
            </p>
            <FocusMode taskId={id} title={t.title} />
          </section>

          {(isOwner || waiting.length > 0 || blockingList.length > 0) && (
            <section className={`${card} flex flex-col gap-3 px-5 py-4 text-[13px]`}>
              <h2 className="text-[15px] font-semibold text-slate-900">Dependencies</h2>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500">This task waits on</span>
                {waiting.length === 0 ? (
                  <span className="text-slate-400">Nothing</span>
                ) : (
                  waiting.map((d) => (
                    <div key={d.tasks.id} className="flex items-center gap-2">
                      <Link href={`/tasks/${d.tasks.id}`} className={`min-w-0 flex-1 truncate hover:text-blue-700 ${d.tasks.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {d.tasks.title}
                      </Link>
                      <StatusBadge status={d.tasks.status} />
                      {isOwner && <RemoveDependencyButton taskId={id} dependsOnId={d.tasks.id} />}
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500">This task is blocking</span>
                {blockingList.length === 0 ? (
                  <span className="text-slate-400">Nothing</span>
                ) : (
                  blockingList.map((d) => (
                    <div key={d.tasks.id} className="flex items-center gap-2">
                      <Link href={`/tasks/${d.tasks.id}`} className="min-w-0 flex-1 truncate text-slate-900 hover:text-blue-700">{d.tasks.title}</Link>
                      <StatusBadge status={d.tasks.status} />
                    </div>
                  ))
                )}
              </div>
              {isOwner && (
                <div className="border-t border-slate-100 pt-3">
                  <DependencyControls taskId={id} options={options} />
                </div>
              )}
            </section>
          )}

          {isOwner && <DeleteTaskButton id={t.id} title={t.title} />}
        </aside>
      </div>
    </main>
  );
}
