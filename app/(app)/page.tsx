import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardAnalytics } from "@/components/dashboard-analytics";

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
    { data: schools }, { data: openTasks }, { data: dueTasks }, { data: schoolDeadlines },
    { data: milestones }, { data: letters }, { count: winsA }, { count: winsB },
  ] = await Promise.all([
    supabase.from("schools").select("id, name, status, country, csranking_nlp_rank, composite_score, verified_fit, faculty, fit_note"),
    supabase.from("tasks").select("id").not("status", "in", "(done,cancelled)"),
    supabase.from("tasks").select("id, title, due_date, priority").not("due_date", "is", null).lte("due_date", cutoff).not("status", "in", "(done,cancelled)"),
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).lte("deadline_date", cutoff),
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

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="border border-line bg-surface rounded-lg p-4 hover:border-brass">
            <div className={`text-3xl font-mono font-semibold ${t.tone ?? ""}`}>{t.value}</div>
            <div className="text-xs text-gray-500 uppercase mt-1">{t.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{t.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section className="border border-line bg-surface rounded-lg p-4">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex justify-between">
            <span>Needs attention</span><span className="font-mono">{attention.length}</span>
          </h2>
          {attention.length === 0 ? (
            <p className="text-xs text-gray-400 border border-dashed border-line rounded p-4 text-center">Nothing urgent in the next 3 days.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {attention.slice(0, 6).map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className={`border border-l-4 ${r.date < today ? "border-l-red-600" : "border-l-brass"} rounded p-2.5 text-sm flex justify-between gap-3 hover:border-brass`}>
                    <span className="min-w-0">
                      <span className="block truncate">{r.label}</span>
                      <span className="block text-xs text-gray-500">{r.sub}</span>
                    </span>
                    <span className={`text-xs whitespace-nowrap font-mono ${r.date < today ? "text-red-600" : "text-gray-500"}`}>{when(daysFrom(today, r.date))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-line bg-surface rounded-lg p-4">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex justify-between">
            <span>Coming up · to {cutoff.slice(5)}</span>
            <Link href="/timeline" className="normal-case underline">full timeline</Link>
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-400 border border-dashed border-line rounded p-4 text-center">Nothing else due in the next 14 days.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {upcoming.slice(0, 7).map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="flex justify-between gap-3 py-2 text-sm hover:text-brass">
                    <span className="truncate">{r.label}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap font-mono">{r.date.slice(5)} · {when(daysFrom(today, r.date))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wide text-gray-500">Application pipeline</h2>
        <div className="flex h-3 rounded overflow-hidden bg-surface-raised">
          {PIPELINE.filter((p) => counts[p.key]).map((p) => (
            <Link
              key={p.key}
              href={`/schools?status=${p.key}`}
              title={`${p.label}: ${counts[p.key]}`}
              style={{ width: `${(counts[p.key] / total) * 100}%`, background: p.color }}
              className="min-w-[3px] hover:opacity-80"
            />
          ))}
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
          {PIPELINE.map((p) => (
            <li key={p.key}>
              <Link href={`/schools?status=${p.key}`} className="flex items-center gap-2 text-sm hover:text-brass">
                <i className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.color }} />
                <span className="text-gray-500 flex-1">{p.label}</span>
                <span className="font-mono">{counts[p.key] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wide text-gray-500">Explore your schools</h2>
        <DashboardAnalytics schools={list as any} weekly={weekly.map(({ week, tasks, wins }) => ({ week, tasks, wins }))} />
        <p className="text-xs text-gray-400">Scores are a heuristic, not a validated ranking.</p>
      </div>
    </main>
  );
}
