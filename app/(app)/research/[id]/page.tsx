import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { LinksPanel } from "@/components/links-panel";
import { DeleteMilestoneButton, MilestoneEditForm, MilestoneStatusSelect, MilestoneTaskForm } from "@/components/milestone-controls";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d overdue` : `in ${d}d`);

const TASK_TONE: Record<string, string> = {
  todo: "text-gray-500", in_progress: "text-brass", blocked: "text-red-600", done: "text-teal-600", cancelled: "text-gray-400",
};

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
  if (!milestone) return <p className="p-4 md:p-8">Not found.</p>;

  const isOwner = user?.id === OWNER_USER_ID;
  const today = localDate(new Date());
  const list = (tasks ?? []) as any[];
  const active = list.filter((t) => t.status !== "cancelled");
  const done = active.filter((t) => t.status === "done").length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;
  const late = milestone.status !== "done" && milestone.target_date && milestone.target_date < today;

  const order = (siblings ?? []).filter((s: any) => s.project_id === milestone.project_id);
  const idx = order.findIndex((s) => s.id === id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const nextM = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href={milestone.project_id ? `/research/projects/${milestone.project_id}?tab=plan` : "/research"} className="text-xs text-gray-500 hover:text-cream self-start">← Project plan</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-gray-400">MILESTONE {idx >= 0 ? String(idx + 1).padStart(2, "0") : ""}</div>
            <h1 className="text-3xl font-semibold">{milestone.title}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {milestone.target_date ? (
                <span className={`border rounded-full px-2.5 py-0.5 font-mono ${late ? "text-red-600 border-red-600" : "text-gray-500 border-line"}`}>
                  {milestone.target_date} · {relative(daysBetween(today, milestone.target_date))}
                </span>
              ) : (
                <span className="border border-line rounded-full px-2.5 py-0.5 text-gray-400">no target date</span>
              )}
            </div>
          </div>
          {isOwner && <MilestoneStatusSelect id={milestone.id} value={milestone.status} />}
        </div>
        {milestone.description && <p className="text-gray-500">{milestone.description}</p>}
        {isOwner && (
          <MilestoneEditForm id={milestone.id} title={milestone.title} description={milestone.description} targetDate={milestone.target_date} />
        )}
      </div>

      <section className="border border-line bg-surface rounded-lg p-4">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex justify-between">
          <span>Tasks</span>
          <span className="font-mono">{done}/{active.length} done{active.length > 0 && ` · ${pct}%`}</span>
        </h2>
        {active.length > 0 && (
          <div className="h-1.5 rounded bg-surface-raised overflow-hidden mb-3">
            <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
          </div>
        )}
        {list.length === 0 ? (
          <p className="text-xs text-gray-400 border border-dashed border-line rounded p-4 text-center">No tasks linked yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((t) => {
              const overdue = t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled";
              return (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="border rounded p-2.5 text-sm flex justify-between gap-3 items-center hover:border-brass">
                    <span className="min-w-0">
                      <span className={`block truncate ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</span>
                      <span className="block text-xs text-gray-500">
                        {t.people?.name ?? "Unassigned"} · {t.priority}
                        {t.due_date && <span className={overdue ? "text-red-600" : ""}> · due {t.due_date}</span>}
                      </span>
                    </span>
                    <span className={`text-xs uppercase whitespace-nowrap ${TASK_TONE[t.status]}`}>{t.status.replace("_", " ")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {isOwner && <MilestoneTaskForm milestoneId={id} people={people ?? []} />}
      </section>

      {isOwner && (
        <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wide text-gray-500">Links for this milestone</h2>
          <LinksPanel
            links={(milestoneLinks ?? []) as any}
            scope={{ milestoneId: id }}
            placeholder="Paste a commit, pull request, paper, dataset or doc link…"
            emptyText="No links yet. Attach the repo, PR or paper this milestone depends on."
          />
        </section>
      )}

      <div className="flex justify-between gap-3 text-xs">
        {prev ? <Link href={`/research/${prev.id}`} className="text-gray-500 hover:text-cream">← {prev.title}</Link> : <span />}
        {nextM ? <Link href={`/research/${nextM.id}`} className="text-gray-500 hover:text-cream text-right">{nextM.title} →</Link> : <span />}
      </div>

      {isOwner && <DeleteMilestoneButton id={milestone.id} title={milestone.title} taskCount={list.length} />}
    </main>
  );
}
