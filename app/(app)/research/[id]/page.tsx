import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { LinksPanel } from "@/components/links-panel";
import { DeleteMilestoneButton, MilestoneEditForm, MilestoneStatusSelect, MilestoneTaskForm } from "@/components/milestone-controls";
import { todayString } from "@/lib/app-date";

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d overdue` : `in ${d}d`);
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const TASK_BADGE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-600", in_progress: "bg-blue-50 text-blue-700", blocked: "bg-red-50 text-red-700",
  done: "bg-emerald-50 text-emerald-700", cancelled: "bg-slate-100 text-slate-400",
};
const card = "rounded-lg border border-slate-200 bg-white";

export default async function MilestoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: milestone }, { data: tasks }, { data: people }, { data: siblings }, { data: milestoneLinks }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("research_milestones").select("*").eq("id", id).single(),
    supabase.from("tasks").select("id, title, status, priority, due_date, people(name)").eq("research_milestone_id", id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("people").select("id, name").order("name"),
    supabase.from("research_milestones").select("id, title, project_id").order("target_date", { ascending: true, nullsFirst: false }),
    supabase.from("links").select("*").eq("milestone_id", id),
  ]);
  if (!milestone) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:p-8">
        <Link href="/research" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← Research</Link>
        <p className="text-sm text-slate-600">This milestone doesn&apos;t exist or you don&apos;t have access to it.</p>
      </main>
    );
  }

  const isOwner = user?.id === OWNER_USER_ID;
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const list = (tasks ?? []) as any[];
  const active = list.filter((t) => t.status !== "cancelled");
  const done = active.filter((t) => t.status === "done").length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;
  const late = milestone.status !== "done" && milestone.target_date && milestone.target_date < today;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const order = (siblings ?? []).filter((s: any) => s.project_id === milestone.project_id);
  const idx = order.findIndex((s) => s.id === id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const nextM = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-4 p-4 md:p-8">
      <Link href={milestone.project_id ? `/research/projects/${milestone.project_id}?tab=plan` : "/research"} className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← Project plan</Link>

      <section className={`${card} flex flex-col gap-3 px-5 py-5 md:px-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Milestone{idx >= 0 ? ` ${idx + 1} of ${order.length}` : ""}</p>
            <h1 className="text-[26px] font-semibold leading-[34px] tracking-tight text-slate-900">{milestone.title}</h1>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {milestone.target_date ? (
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${late ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                  {shortDate(milestone.target_date)} · {relative(daysBetween(today, milestone.target_date))}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-500">No target date</span>
              )}
            </div>
          </div>
          {isOwner && <MilestoneStatusSelect id={milestone.id} value={milestone.status} />}
        </div>
        {milestone.description && <p className="whitespace-pre-line text-sm text-slate-600">{milestone.description}</p>}
      </section>

      {isOwner && (
        <MilestoneEditForm id={milestone.id} title={milestone.title} description={milestone.description} targetDate={milestone.target_date} />
      )}

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Tasks</h2>
          <span className="text-xs tabular-nums text-slate-500">{done} of {active.length} done{active.length > 0 && ` · ${pct}%`}</span>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          {active.length > 0 && (
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span className={`block h-full rounded-full ${pct === 100 ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
            </span>
          )}
          {list.length === 0 ? (
            <p className="text-[13px] text-slate-500">No tasks linked yet. Add the steps this milestone needs below.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {list.map((t) => {
                const overdue = t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled";
                return (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className={`block truncate ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</span>
                        <span className="block text-xs text-slate-500">
                          {t.people?.name ?? "Unassigned"} · <span className="capitalize">{t.priority}</span>
                          {t.due_date && <span className={overdue ? "font-medium text-red-700" : ""}> · due {shortDate(t.due_date)}</span>}
                        </span>
                      </span>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${TASK_BADGE[t.status] ?? TASK_BADGE.todo}`}>{t.status.replace(/_/g, " ")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {isOwner && <MilestoneTaskForm milestoneId={id} people={people ?? []} />}
        </div>
      </section>

      {isOwner && (
        <section className={card}>
          <div className="border-b border-slate-200 px-5 py-3"><h2 className="text-[15px] font-semibold text-slate-900">Links for this milestone</h2></div>
          <div className="px-5 py-4">
            <LinksPanel
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              links={(milestoneLinks ?? []) as any}
              scope={{ milestoneId: id }}
              placeholder="Paste a commit, pull request, paper, dataset or doc link…"
              emptyText="No links yet. Attach the repo, PR or paper this milestone depends on."
            />
          </div>
        </section>
      )}

      {(prev || nextM) && (
        <nav aria-label="Other milestones" className="grid gap-2 sm:grid-cols-2">
          {prev ? (
            <Link href={`/research/${prev.id}`} className={`${card} px-4 py-3 text-sm transition-colors hover:border-slate-300`}>
              <span className="block text-xs text-slate-500">← Previous</span><span className="block truncate font-medium text-slate-900">{prev.title}</span>
            </Link>
          ) : <span />}
          {nextM ? (
            <Link href={`/research/${nextM.id}`} className={`${card} px-4 py-3 text-right text-sm transition-colors hover:border-slate-300`}>
              <span className="block text-xs text-slate-500">Next →</span><span className="block truncate font-medium text-slate-900">{nextM.title}</span>
            </Link>
          ) : <span />}
        </nav>
      )}

      {isOwner && <DeleteMilestoneButton id={milestone.id} title={milestone.title} taskCount={list.length} />}
    </main>
  );
}
