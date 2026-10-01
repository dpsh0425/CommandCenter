import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { NewProjectForm } from "@/components/research-forms";
import { PageHeader, RESEARCH_TABS, SubNav } from "@/components/ui";
import { ResearchProjects, type ProjectCard } from "@/components/research-projects";
import { daysBetween, formatMinutes, projectStatusLabel, relative } from "@/lib/research";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "Research" };

// "YYYY-MM-DD" n days before another, counted in UTC so clock changes don't shift it.
const minusDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10);

export default async function ResearchPage() {
  const supabase = await createClient();
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();
  const weekAgo = minusDays(today, 6);
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
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Research projects are only available to the workspace owner.</main>;
  }
  const list = projects ?? [];
  const msByProject = (id: string) => (milestones ?? []).filter((m) => m.project_id === id);

  const cards: ProjectCard[] = list.map((p) => {
    const ms = msByProject(p.id);
    const done = ms.filter((m) => m.status === "done").length;
    const next = ms.filter((m) => m.status !== "done" && m.target_date).sort((a, b) => a.target_date.localeCompare(b.target_date))[0];
    const late = ms.filter((m) => m.status !== "done" && m.target_date && m.target_date < today).length;
    const mins = (entries ?? []).filter((e) => e.project_id === p.id).reduce((n, e) => n + (e.minutes ?? 0), 0);
    const team = (members ?? []).filter((m) => m.project_id === p.id).length;
    const msIds = new Set(ms.map((m) => m.id));
    const open = (tasks ?? []).filter((t) => t.project_id === p.id || (t.research_milestone_id && msIds.has(t.research_milestone_id))).length;
    return {
      id: p.id, title: p.title, question: p.question, status: p.status, statusLabel: projectStatusLabel(p.status),
      done, total: ms.length, open, weekLabel: mins ? formatMinutes(mins) : null, team, late,
      next: next ? { title: next.title, when: relative(daysBetween(today, next.target_date)), overdue: next.target_date < today } : null,
    };
  });

  const weekMinutes = (entries ?? []).reduce((n, e) => n + (e.minutes ?? 0), 0);
  const activeProjects = new Set((entries ?? []).filter((e) => (e.minutes ?? 0) > 0).map((e) => e.project_id)).size;
  const byStatus = Array.from(cards.reduce((m, c) => m.set(c.statusLabel, (m.get(c.statusLabel) ?? 0) + 1), new Map<string, number>()).entries());
  const openTasks = cards.reduce((n, c) => n + c.open, 0);
  const lateMs = cards.reduce((n, c) => n + c.late, 0);
  const tiles: Array<{ label: string; value: string; sub: string; tone?: string }> = [
    { label: "Projects", value: String(cards.length), sub: byStatus.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(" · ") || "none yet" },
    { label: "Logged this week", value: weekMinutes ? formatMinutes(weekMinutes) : "0m", sub: activeProjects ? `across ${activeProjects} project${activeProjects === 1 ? "" : "s"}` : "nothing logged yet", tone: weekMinutes ? "text-blue-700" : undefined },
    { label: "Open tasks", value: String(openTasks), sub: "on milestones and projects" },
    { label: "Late milestones", value: String(lateMs), sub: "past their target date", tone: lateMs ? "text-red-700" : undefined },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Work" title="Research" subtitle="Every project you run, alone or with a team: plan, journal, reading, meetings." actions={<NewProjectForm />} />
        <SubNav items={RESEARCH_TABS} current="/research" />
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No projects yet</p>
          <p className="mt-1 text-[13px] text-slate-500">Create one to start planning and logging your work.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
                <p className={`text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
                <p className="truncate text-xs text-slate-500">{t.sub}</p>
              </div>
            ))}
          </div>
          <ResearchProjects projects={cards} />
        </>
      )}
    </main>
  );
}
