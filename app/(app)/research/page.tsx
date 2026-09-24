import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { NewProjectForm } from "@/components/research-forms";
import { PageHeader, RESEARCH_TABS, SubNav } from "@/components/ui";
import { daysBetween, formatMinutes, localDate, projectStatusLabel, relative } from "@/lib/research";

export const metadata = { title: "Research" };

export default async function ResearchPage() {
  const supabase = await createClient();
  const today = localDate(new Date());
  const weekAgo = localDate(new Date(Date.now() - 6 * 86400000));
  const [{ data: { user } }, { data: projects }, { data: milestones }, { data: entries }, { data: members }, { data: tasks }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("research_projects").select("*").order("created_at"),
    supabase.from("research_milestones").select("id, project_id, title, status, target_date"),
    supabase.from("research_entries").select("project_id, minutes").gte("occurred_on", weekAgo),
    supabase.from("research_project_members").select("project_id"),
    supabase.from("tasks").select("project_id, research_milestone_id, status").not("status", "in", "(done,cancelled)"),
  ]);
  const isOwner = user?.id === OWNER_USER_ID;
  if (!isOwner) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Research projects are only available to the workspace owner.</main>;
  }
  const list = projects ?? [];
  const msByProject = (id: string) => (milestones ?? []).filter((m) => m.project_id === id);

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <PageHeader title="Research" subtitle="Every project you run, alone or with a team: plan, journal, reading, meetings." />
        <SubNav items={RESEARCH_TABS} current="/research" />
      </div>

      <NewProjectForm />

      {list.length === 0 ? (
        <p className="text-sm text-gray-500">No projects yet. Create one to start planning and logging your work.</p>
      ) : (
        <ul className="flex flex-col">
          {list.map((p) => {
            const ms = msByProject(p.id);
            const done = ms.filter((m) => m.status === "done").length;
            const next = ms.filter((m) => m.status !== "done" && m.target_date).sort((a, b) => a.target_date.localeCompare(b.target_date))[0];
            const late = ms.filter((m) => m.status !== "done" && m.target_date && m.target_date < today).length;
            const mins = (entries ?? []).filter((e) => e.project_id === p.id).reduce((n, e) => n + (e.minutes ?? 0), 0);
            const team = (members ?? []).filter((m) => m.project_id === p.id).length;
            const msIds = new Set(ms.map((m) => m.id));
            const open = (tasks ?? []).filter((t) => t.project_id === p.id || (t.research_milestone_id && msIds.has(t.research_milestone_id))).length;
            const bits = [
              ms.length ? `${done} of ${ms.length} milestones` : "no milestones yet",
              open ? `${open} open tasks` : null,
              mins ? `${formatMinutes(mins)} this week` : null,
              team ? `${team} on the team` : "solo",
              late ? `${late} late` : null,
            ].filter(Boolean);
            return (
              <li key={p.id} className="border-b border-line/60 last:border-0">
                <Link href={`/research/projects/${p.id}`} className="flex flex-col gap-1 py-5 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-serif text-2xl leading-tight">{p.title}</span>
                    <span className="text-sm text-gray-500 whitespace-nowrap">{projectStatusLabel(p.status)}</span>
                  </div>
                  {p.question && <p className="text-sm text-gray-500 line-clamp-2">{p.question}</p>}
                  <p className="text-sm text-gray-400">{bits.join(" · ")}</p>
                  {next && <p className="text-sm text-gray-500">Next: {next.title} <span className={next.target_date < today ? "text-red-600" : "text-brass"}>{relative(daysBetween(today, next.target_date))}</span></p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
