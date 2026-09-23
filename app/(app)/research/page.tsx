import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addMilestone } from "./actions";
import { OWNER_USER_ID } from "@/lib/owner";
import { MilestoneStatusSelect } from "@/components/milestone-controls";
import { LinksPanel } from "@/components/links-panel";

export const metadata = { title: "Research" };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d overdue` : `in ${d}d`);

const STATUS_TONE: Record<string, string> = {
  not_started: "text-gray-500 border-line",
  in_progress: "text-brass border-brass",
  blocked: "text-red-600 border-red-600",
  done: "text-teal-600 border-teal-600",
};

export default async function ResearchPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: milestones }, { data: tasks }, { data: projectLinks }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("research_milestones").select("*").order("target_date", { ascending: true, nullsFirst: false }),
    supabase.from("tasks").select("research_milestone_id, status").not("research_milestone_id", "is", null),
    supabase.from("links").select("*").is("school_id", null).is("milestone_id", null).is("professor_id", null),
  ]);
  const isOwner = user?.id === OWNER_USER_ID;
  const today = localDate(new Date());

  const progress = new Map<string, { done: number; total: number }>();
  for (const t of tasks ?? []) {
    const p = progress.get(t.research_milestone_id as string) ?? { done: 0, total: 0 };
    if (t.status !== "cancelled") {
      p.total += 1;
      if (t.status === "done") p.done += 1;
    }
    progress.set(t.research_milestone_id as string, p);
  }

  const list = milestones ?? [];
  const doneCount = list.filter((m) => m.status === "done").length;
  const blocked = list.filter((m) => m.status === "blocked").length;
  const overdue = list.filter((m) => m.status !== "done" && m.target_date && m.target_date < today).length;
  const next = list.find((m) => m.status !== "done" && m.target_date && m.target_date >= today);
  const pct = list.length ? Math.round((doneCount / list.length) * 100) : 0;

  async function addMilestoneAction(formData: FormData) {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const description = String(formData.get("description") ?? "").trim();
    const targetDate = String(formData.get("target_date") ?? "").trim();
    await addMilestone(title, description || undefined, targetDate || undefined);
  }

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">The Broken Ruler</h1>
        <p className="text-sm text-gray-500">Nepali benchmark measurement-error study — milestones and the work behind them.</p>
      </div>

      <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-500">Overall progress</span>
          <span className="font-mono text-sm">{doneCount}/{list.length} milestones · {pct}%</span>
        </div>
        <div className="h-2 rounded bg-surface-raised overflow-hidden">
          <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
          <span>{list.filter((m) => m.status === "in_progress").length} in progress</span>
          {blocked > 0 && <span className="text-red-600">{blocked} blocked</span>}
          {overdue > 0 && <span className="text-red-600">{overdue} overdue</span>}
          {next && <span className="ml-auto">next: <span className="text-cream">{next.title}</span> · {relative(daysBetween(today, next.target_date as string))}</span>}
        </div>
      </section>

      {isOwner && (
        <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-xs uppercase tracking-wide text-gray-500">Project links</h2>
            <p className="text-xs text-gray-400">Your GitHub repo, papers, datasets and docs for this study, in one place.</p>
          </div>
          <LinksPanel
            links={(projectLinks ?? []) as any}
            scope={{}}
            placeholder="Paste your GitHub repo, arXiv paper, dataset or doc link…"
            emptyText="No links yet. Paste your project's GitHub repository to start."
          />
        </section>
      )}

      {list.length === 0 && (
        <p className="text-sm text-gray-500 border border-dashed border-line rounded p-6 text-center">No milestones yet. Add the first one below.</p>
      )}

      <ol className="flex flex-col gap-3">
        {list.map((m, i) => {
          const p = progress.get(m.id) ?? { done: 0, total: 0 };
          const late = m.status !== "done" && m.target_date && m.target_date < today;
          return (
            <li key={m.id} className={`border bg-surface rounded-lg p-4 flex flex-col gap-2 ${late ? "border-red-600" : "border-line"} hover:border-brass`}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/research/${m.id}`} className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-gray-400">MILESTONE {String(i + 1).padStart(2, "0")}</div>
                  <div className={`font-medium ${m.status === "done" ? "line-through text-gray-500" : ""}`}>{m.title}</div>
                </Link>
                {isOwner ? (
                  <MilestoneStatusSelect id={m.id} value={m.status} />
                ) : (
                  <span className={`text-xs uppercase border rounded-full px-2 py-0.5 ${STATUS_TONE[m.status]}`}>{m.status.replace("_", " ")}</span>
                )}
              </div>
              {m.description && <p className="text-sm text-gray-500">{m.description}</p>}
              <div className="flex items-center gap-3 text-xs">
                {m.target_date ? (
                  <span className={`font-mono ${late ? "text-red-600" : "text-gray-500"}`}>
                    {m.target_date} · {relative(daysBetween(today, m.target_date))}
                  </span>
                ) : (
                  <span className="text-gray-400">no target date</span>
                )}
                {p.total > 0 ? (
                  <span className="ml-auto flex items-center gap-2 text-gray-500">
                    <span className="w-24 h-1.5 rounded bg-surface-raised overflow-hidden inline-block">
                      <span className="block h-full bg-brass" style={{ width: `${(p.done / p.total) * 100}%` }} />
                    </span>
                    <span className="font-mono">{p.done}/{p.total} tasks</span>
                  </span>
                ) : (
                  <span className="ml-auto text-gray-400">no tasks yet</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isOwner && (
        <details className="border border-dashed border-line rounded p-3">
          <summary className="text-sm text-gray-500 cursor-pointer">+ Add milestone</summary>
          <form action={addMilestoneAction} className="flex flex-col gap-2 mt-3">
            <input name="title" placeholder="Milestone title" className="border rounded px-2 py-1 text-sm" required />
            <textarea name="description" placeholder="Description (optional)" className="border rounded px-2 py-1 text-sm" rows={2} />
            <input type="date" name="target_date" className="border rounded px-2 py-1 text-sm" />
            <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm self-start">Add milestone</button>
          </form>
        </details>
      )}
    </main>
  );
}
