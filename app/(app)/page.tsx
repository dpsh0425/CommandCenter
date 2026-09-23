import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { Fold, PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Dashboard" };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysFrom = (today: string, date: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
const when = (delta: number) =>
  delta === 0 ? "today" : delta === 1 ? "tomorrow" : delta < 0 ? `${-delta}d overdue` : `in ${delta}d`;

const PIPELINE: Array<{ key: string; label: string; color: string }> = [
  { key: "not_started", label: "Not started", color: "#313a4a" },
  { key: "researching", label: "Researching", color: "#6f7686" },
  { key: "contacted", label: "Contacted", color: "#c98a3e" },
  { key: "replied", label: "Replied", color: "#d99456" },
  { key: "submitted", label: "Submitted", color: "#9f93e0" },
  { key: "interview", label: "Interview", color: "#5cae97" },
  { key: "accepted", label: "Accepted", color: "#4f9d8a" },
  { key: "rejected", label: "Rejected", color: "#d97e78" },
];

type Row = { label: string; sub: string; href: string; date: string; kind: string };

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const today = localDate(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);
  const cutoff = localDate(horizon);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: schools }, { data: openTasks }, { data: dueTasks }, { data: schoolDeadlines }, { data: nextDeadlines },
    { data: milestones }, { data: letters }, { count: winsA }, { count: winsB },
  ] = await Promise.all([
    supabase.from("schools").select("id, name, status, country, csranking_nlp_rank, composite_score, verified_fit, faculty, fit_note"),
    supabase.from("tasks").select("id").not("status", "in", "(done,cancelled)"),
    supabase.from("tasks").select("id, title, due_date, priority").not("due_date", "is", null).lte("due_date", cutoff).not("status", "in", "(done,cancelled)"),
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).lte("deadline_date", cutoff),
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).gte("deadline_date", localDate(now)).order("deadline_date").limit(3),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null).lte("target_date", cutoff).neq("status", "done"),
    supabase.from("letter_requests").select("id, school_id, status, letter_deadline, people(name), schools(name)").not("letter_deadline", "is", null).lte("letter_deadline", cutoff).neq("status", "submitted"),
    supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart),
    supabase.from("task_updates").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart),
  ]);

  // Weekly momentum: last 8 weeks, weeks start Monday.
  const mondayOf = (d: Date) => {
    const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  };
  const thisMonday = mondayOf(now);
  const firstMonday = new Date(thisMonday);
  firstMonday.setDate(firstMonday.getDate() - 7 * 7);
  const [{ data: doneUpdates }, { data: winActivity }] = await Promise.all([
    supabase.from("task_updates").select("created_at").eq("type", "status_change").eq("is_win", true).gte("created_at", firstMonday.toISOString()),
    supabase.from("activity_log").select("created_at").eq("is_win", true).gte("created_at", firstMonday.toISOString()),
  ]);
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(firstMonday);
    start.setDate(start.getDate() + i * 7);
    return { start, week: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), tasks: 0, wins: 0 };
  });
  const bump = (iso: string, key: "tasks" | "wins") => {
    const idx = Math.floor((mondayOf(new Date(iso)).getTime() - firstMonday.getTime()) / (7 * 86400000));
    if (idx >= 0 && idx < 8) weekly[idx][key] += 1;
  };
  for (const u of doneUpdates ?? []) bump(u.created_at, "tasks");
  for (const a of winActivity ?? []) bump(a.created_at, "wins");

  const list = schools ?? [];
  const counts: Record<string, number> = {};
  for (const s of list) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const active = list.filter((s) => s.status !== "not_started").length;
  const wins = (winsA ?? 0) + (winsB ?? 0);

  const rows: Row[] = [
    ...(dueTasks ?? []).map((t) => ({ label: t.title, sub: `task · ${t.priority} priority`, href: `/tasks/${t.id}`, date: t.due_date as string, kind: "task" })),
    ...(schoolDeadlines ?? []).map((s) => ({ label: s.name, sub: "school deadline", href: `/schools/${s.id}`, date: s.deadline_date as string, kind: "school" })),
    ...(milestones ?? []).map((m) => ({ label: m.title, sub: "research milestone", href: `/research/${m.id}`, date: m.target_date as string, kind: "milestone" })),
    ...((letters ?? []) as any[]).map((l) => ({
      label: `${l.people?.name ?? "Recommender"} — letter for ${l.schools?.name ?? "school"}`,
      sub: `recommendation letter · ${String(l.status).replace("_", " ")}`,
      href: `/schools/${l.school_id}`, date: l.letter_deadline as string, kind: "letter",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const overdue = rows.filter((r) => r.date < today);
  const urgentCutoff = localDate(new Date(now.getTime() + 3 * 86400000));
  const attention = rows.filter((r) => r.date <= urgentCutoff);
  const upcoming = rows.filter((r) => r.date > urgentCutoff);

  const tiles: Array<{ label: string; value: number; sub: string; href: string; tone?: string }> = [
    { label: "Target schools", value: list.length, sub: `${active} in progress`, href: "/schools" },
    { label: "Open tasks", value: openTasks?.length ?? 0, sub: "across all projects", href: "/tasks" },
    { label: "Overdue", value: overdue.length, sub: overdue.length ? "needs action now" : "all clear", href: "/today", tone: overdue.length ? "text-red-600" : "text-teal-600" },
    { label: "Wins this month", value: wins, sub: "replies & results", href: "/wins" },
  ];

  const total = list.length || 1;

  const headline = overdue.length > 0
    ? `${overdue.length} thing${overdue.length === 1 ? " is" : "s are"} overdue.`
    : attention.length > 0
      ? `${attention.length} thing${attention.length === 1 ? "" : "s"} need${attention.length === 1 ? "s" : ""} you in the next 3 days.`
      : "Nothing urgent. Good time to move an application forward.";

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
      <PageHeader
        title="Home"
        subtitle={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      />

      <div>
        <p className="text-xl font-serif">{headline}</p>
        <p className="text-sm text-gray-500 mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/schools" className="hover:text-cream"><span className="font-mono text-cream">{list.length}</span> schools ({active} in progress)</Link>
          <Link href="/tasks" className="hover:text-cream"><span className="font-mono text-cream">{openTasks?.length ?? 0}</span> open tasks</Link>
          <Link href="/wins" className="hover:text-cream"><span className="font-mono text-cream">{wins}</span> wins this month</Link>
        </p>
      </div>

      {(nextDeadlines ?? []).length > 0 && (
        <Section title="Application deadlines" action={<Link href="/week" className="hover:text-cream">See the week →</Link>}>
          <ul className="flex flex-col">
            {(nextDeadlines ?? []).map((d) => {
              const n = daysFrom(today, d.deadline_date as string);
              return (
                <li key={d.id} className="border-b border-line/60 last:border-0">
                  <Link href={`/schools/${d.id}`} className="flex justify-between gap-4 py-2.5 hover:text-brass">
                    <span className="font-medium truncate">{d.name}</span>
                    <span className={`text-sm whitespace-nowrap ${n <= 14 ? "text-red-600" : n <= 30 ? "text-brass" : "text-gray-500"}`}>{n} days · {(d.deadline_date as string).slice(5)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {(attention.length > 0 || upcoming.length > 0) && (
        <Section title="Coming up" hint="next 14 days">
          <ul className="flex flex-col">
            {[...attention, ...upcoming].slice(0, 7).map((r, i) => (
              <li key={i} className="border-b border-line/60 last:border-0">
                <Link href={r.href} className="flex justify-between gap-4 py-2.5 hover:text-brass">
                  <span className="truncate">{r.label}</span>
                  <span className={`text-sm whitespace-nowrap ${r.date < today ? "text-red-600" : "text-gray-400"}`}>{when(daysFrom(today, r.date))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Your applications" action={<Link href="/schools" className="hover:text-cream">All schools →</Link>}>
        <div className="flex h-2 rounded overflow-hidden bg-surface-raised">
          {PIPELINE.filter((p) => counts[p.key]).map((p) => (
            <Link key={p.key} href={`/schools?status=${p.key}`} title={`${p.label}: ${counts[p.key]}`} style={{ width: `${(counts[p.key] / total) * 100}%`, background: p.color }} className="min-w-[3px] hover:opacity-80" />
          ))}
        </div>
        <p className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          {PIPELINE.filter((p) => counts[p.key]).map((p) => (
            <Link key={p.key} href={`/schools?status=${p.key}`} className="hover:text-cream flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-sm" style={{ background: p.color }} />{p.label} <span className="font-mono text-cream">{counts[p.key]}</span>
            </Link>
          ))}
        </p>
      </Section>

      <Fold title="Explore your schools" summary="fit map, pipeline, scores, momentum">
        <DashboardAnalytics schools={list as any} weekly={weekly.map(({ week, tasks, wins }) => ({ week, tasks, wins }))} />
        <p className="text-xs text-gray-400 mt-2">Scores are a heuristic, not a validated ranking.</p>
      </Fold>
    </main>
  );
}
