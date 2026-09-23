import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addMilestone } from "./actions";
import { OWNER_USER_ID } from "@/lib/owner";
import { MilestoneStatusSelect } from "@/components/milestone-controls";
import { LinksPanel } from "@/components/links-panel";
import { PageHeader, RESEARCH_TABS, Section, SubNav } from "@/components/ui";

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
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="The Broken Ruler"
          subtitle={list.length === 0 ? "Nepali benchmark measurement-error study." : `${doneCount} of ${list.length} milestones done${next ? ` · next: ${next.title} ${relative(daysBetween(today, next.target_date as string))}` : ""}${overdue > 0 ? ` · ${overdue} overdue` : ""}${blocked > 0 ? ` · ${blocked} blocked` : ""}`}
        />
        <SubNav items={RESEARCH_TABS} current="/research" />
      </div>

      {isOwner && (
        <Section title="Project links" hint="repo, papers, datasets, docs">
          <LinksPanel
            links={(projectLinks ?? []) as any}
            scope={{}}
            placeholder="Paste your GitHub repo, arXiv paper, dataset or doc link…"
            emptyText="No links yet. Paste your project's GitHub repository to start."
          />
        </Section>
      )}

      <Section title="Milestones" hint={list.length ? `${pct}% complete` : undefined}>
        {list.length === 0 && <p className="text-sm text-gray-500">No milestones yet. Add the first one below.</p>}
        <ul className="flex flex-col">
          {list.map((m) => {
            const p = progress.get(m.id) ?? { done: 0, total: 0 };
            const late = m.status !== "done" && m.target_date && m.target_date < today;
            return (
              <li key={m.id} className="border-b border-line/60 last:border-0 py-3 flex items-start justify-between gap-4">
                <Link href={`/research/${m.id}`} className="min-w-0 flex-1 hover:text-brass">
                  <span className={`block font-medium ${m.status === "done" ? "line-through text-gray-500" : ""}`}>{m.title}</span>
                  <span className="block text-sm text-gray-500 truncate">
                    {[m.target_date ? `${m.target_date.slice(5)} · ${relative(daysBetween(today, m.target_date))}` : "no date", p.total > 0 ? `${p.done}/${p.total} tasks` : null].filter(Boolean).join(" · ")}
                    {late && <span className="text-red-600"> · late</span>}
                  </span>
                </Link>
                {isOwner ? (
                  <MilestoneStatusSelect id={m.id} value={m.status} />
                ) : (
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_TONE[m.status]}`}>{m.status.replace("_", " ")}</span>
                )}
              </li>
            );
          })}
        </ul>
        {isOwner && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500 hover:text-cream list-none">+ Add a milestone</summary>
            <form action={addMilestoneAction} className="flex flex-col gap-2 mt-3">
              <input name="title" placeholder="Milestone title" className="border rounded px-2 py-1.5 text-sm" required />
              <textarea name="description" placeholder="Description (optional)" className="border rounded px-2 py-1.5 text-sm" rows={2} />
              <input type="date" name="target_date" className="border rounded px-2 py-1.5 text-sm" />
              <button className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm self-start">Add milestone</button>
            </form>
          </details>
        )}
      </Section>
    </main>
  );
}
