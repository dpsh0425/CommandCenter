import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { Fold, Section } from "@/components/ui";
import { Runway } from "@/components/runway";
import { loadReadiness } from "@/lib/readiness-data";
import { RISK_LABEL, RISK_TONE } from "@/lib/readiness";
import { WeekRhythm } from "@/components/week-rhythm";

export const metadata = { title: "Dashboard" };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysFrom = (today: string, date: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
const when = (delta: number) =>
  delta === 0 ? "today" : delta === 1 ? "tomorrow" : delta < 0 ? `${-delta}d overdue` : `in ${delta}d`;

const PIPELINE: Array<{ key: string; label: string; color: string }> = [
  { key: "not_started", label: "Not started", color: "#334155" },
  { key: "researching", label: "Researching", color: "#64748b" },
  { key: "contacted", label: "Contacted", color: "#d97706" },
  { key: "replied", label: "Replied", color: "#f59e0b" },
  { key: "submitted", label: "Submitted", color: "#818cf8" },
  { key: "interview", label: "Interview", color: "#2dd4bf" },
  { key: "accepted", label: "Accepted", color: "#10b981" },
  { key: "rejected", label: "Rejected", color: "#f43f5e" },
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
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).gte("deadline_date", localDate(now)).order("deadline_date").limit(12),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null).lte("target_date", cutoff).neq("status", "done"),
    supabase.from("letter_requests").select("id, school_id, status, letter_deadline, people(name), schools(name)").not("letter_deadline", "is", null).lte("letter_deadline", cutoff).neq("status", "submitted"),
    supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart),
    supabase.from("task_updates").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart),
  ]);

  const mondayOf = (d: Date) => {
    const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  };
  const thisMonday = mondayOf(now);
  const firstMonday = new Date(thisMonday);
  firstMonday.setDate(firstMonday.getDate() - 7 * 7);
  const weekStart = localDate(mondayOf(now));
  const readiness = await loadReadiness(supabase, today);
  const atRisk = readiness.filter((r) => r.risk === "overdue" || r.risk === "urgent" || r.risk === "watch");
  const [{ data: doneUpdates }, { data: winActivity }, { data: contactedProfs }] = await Promise.all([
    supabase.from("task_updates").select("created_at").eq("type", "status_change").eq("is_win", true).gte("created_at", firstMonday.toISOString()),
    supabase.from("activity_log").select("created_at").eq("is_win", true).gte("created_at", firstMonday.toISOString()),
    supabase.from("professors").select("last_contacted_on").gte("last_contacted_on", weekStart),
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

  const total = list.length || 1;

  const activeDates = new Set<string>([
    ...(doneUpdates ?? []).map((u) => localDate(new Date(u.created_at))),
    ...(winActivity ?? []).map((a) => localDate(new Date(a.created_at))),
    ...((contactedProfs ?? []) as any[]).map((p) => p.last_contacted_on as string),
  ]);
  const rhythmDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() + i);
    const key = localDate(d);
    return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), date: key, active: activeDates.has(key), isToday: key === today, future: key > today };
  });

  const deadlines = (nextDeadlines ?? []).map((d) => ({ id: d.id as string, name: d.name as string, date: d.deadline_date as string }));
  const first = deadlines[0];
  const firstDays = first ? daysFrom(today, first.date) : null;
  const focus = rows[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-8 relative overflow-hidden font-sans antialiased">
      {/* Background Ambient Glows */}
      <div className="fixed -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/2 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Greeting */}
      <header className="relative z-10 space-y-1">
        <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {greeting}.
        </h1>
      </header>

      {/* HERO HERO DEADLINE BANNER */}
      <section className="relative z-10 backdrop-blur-2xl bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {first ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Your first application deadline is in
                </p>
                <p className="flex items-baseline gap-2 leading-none">
                  <span className="font-extrabold text-6xl md:text-7xl text-white tracking-tighter drop-shadow-md">
                    {firstDays}
                  </span>
                  <span className="text-xl font-light text-slate-400">days</span>
                </p>
              </div>
              <div className="md:text-right space-y-1">
                <Link
                  href={`/schools/${first.id}?tab=application`}
                  className="text-xl md:text-2xl font-bold text-white hover:text-blue-400 transition-colors tracking-tight block"
                >
                  {first.name}
                </Link>
                <p className="text-xs font-mono text-slate-400">
                  {new Date(first.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <Link
                  href="/week"
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold pt-1 transition-colors"
                >
                  Plan the week →
                </Link>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800/60">
              <Runway deadlines={deadlines} today={today} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-white">No deadlines set yet.</p>
            <p className="text-xs text-slate-400">
              Open a school and add its deadline in the Admissions tab, and your runway appears here.
            </p>
            <Link href="/schools?sort=deadline" className="text-xs text-amber-400 hover:text-amber-300 font-semibold mt-2">
              Go to schools →
            </Link>
          </div>
        )}
      </section>

      {/* NEEDS ATTENTION SECTION */}
      {atRisk.length > 0 && (
        <section className="relative z-10 backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Needs attention</h2>
            <Link href="/readiness" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              All applications →
            </Link>
          </div>
          <ul className="divide-y divide-slate-800/60">
            {atRisk.slice(0, 4).map((r) => (
              <li key={r.school.id}>
                <Link
                  href={`/schools/${r.school.id}?tab=application`}
                  className="flex items-center justify-between gap-4 py-2.5 px-2 rounded-xl hover:bg-slate-800/50 transition-all"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{r.school.name}</span>
                    <span className="block text-xs text-slate-400 truncate">
                      Still to do: {r.pending.map((p) => p.label.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}
                    </span>
                  </span>
                  <span className={`text-xs font-mono font-semibold whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 ${RISK_TONE[r.risk]}`}>
                    {RISK_LABEL[r.risk]}
                    {r.days != null && (
                      <span className="text-slate-400 font-normal"> · {r.days < 0 ? `${-r.days}d ago` : `${r.days}d`}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2-COLUMN GRID SECTION */}
      <div className="relative z-10 grid gap-6 md:grid-cols-2 items-start">
        {/* LEFT COLUMN: Next up */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Next up</h2>
          {focus ? (
            <Link
              href={focus.href}
              className="group backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 hover:border-blue-500/50 rounded-2xl p-5 transition-all shadow-lg block relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md ${focus.date < today ? "bg-rose-500/15 border border-rose-500/30 text-rose-300" : "bg-amber-500/15 border border-amber-500/30 text-amber-300"}`}>
                  {when(daysFrom(today, focus.date))}
                </span>
              </div>
              <span className="text-xl font-bold text-white block tracking-tight group-hover:text-blue-300 transition-colors">
                {focus.label}
              </span>
              <span className="text-xs text-slate-400 block mt-1">{focus.sub}</span>
              <span className="inline-flex items-center gap-1 text-xs text-blue-400 font-semibold mt-4 group-hover:translate-x-1 transition-transform">
                Open →
              </span>
            </Link>
          ) : (
            <div className="backdrop-blur-xl bg-slate-900/30 border border-dashed border-slate-800/80 rounded-2xl p-5 text-xs text-slate-400">
              Nothing urgent. A good moment to{" "}
              <Link href="/outreach" className="text-blue-400 hover:text-blue-300 underline">
                email a professor
              </Link>{" "}
              or{" "}
              <Link href="/schools?sort=researched" className="text-blue-400 hover:text-blue-300 underline">
                research a school
              </Link>.
            </div>
          )}

          {attention.length > 1 && (
            <div className="backdrop-blur-xl bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 shadow-lg">
              <ul className="divide-y divide-slate-800/60">
                {attention.slice(1, 5).map((r, i) => (
                  <li key={i}>
                    <Link
                      href={r.href}
                      className="flex justify-between items-center gap-4 py-2 px-2 rounded-xl text-xs hover:bg-slate-800/40 transition-colors"
                    >
                      <span className="truncate text-slate-300 font-medium">{r.label}</span>
                      <span className={`font-mono text-[11px] whitespace-nowrap ${r.date < today ? "text-rose-400" : "text-slate-400"}`}>
                        {when(daysFrom(today, r.date))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: This week */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">This week</h2>
          <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
            <WeekRhythm days={rhythmDays} />
            <div className="pt-3 border-t border-slate-800/60 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
              <Link href="/schools" className="hover:text-white transition-colors">
                <span className="font-mono font-bold text-white">{list.length}</span> schools ({active} in progress)
              </Link>
              <Link href="/tasks" className="hover:text-white transition-colors">
                <span className="font-mono font-bold text-white">{openTasks?.length ?? 0}</span> open tasks
              </Link>
              <Link href="/wins" className="hover:text-white transition-colors">
                <span className="font-mono font-bold text-emerald-400">{wins}</span> wins this month
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* COMING UP SECTION */}
      {upcoming.length > 0 && (
        <Section
          title="Coming up"
          hint="next 14 days"
          action={<Link href="/week" className="text-xs text-slate-400 hover:text-white transition-colors">See the week →</Link>}
        >
          <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 shadow-lg">
            <ul className="divide-y divide-slate-800/60">
              {upcoming.slice(0, 6).map((r, i) => (
                <li key={i}>
                  <Link
                    href={r.href}
                    className="flex justify-between items-center gap-4 py-2.5 px-3 rounded-xl hover:bg-slate-800/40 transition-colors"
                  >
                    <span className="truncate text-xs font-medium text-slate-300">{r.label}</span>
                    <span className="text-[11px] font-mono whitespace-nowrap text-slate-400">
                      {when(daysFrom(today, r.date))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* PIPELINE OVERVIEW SECTION */}
      <Section
        title="Your applications"
        action={<Link href="/schools" className="text-xs text-slate-400 hover:text-white transition-colors">All schools →</Link>}
      >
        <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-950 border border-slate-800/60">
            {PIPELINE.filter((p) => counts[p.key]).map((p) => (
              <Link
                key={p.key}
                href={`/schools?status=${p.key}`}
                title={`${p.label}: ${counts[p.key]}`}
                style={{ width: `${(counts[p.key] / total) * 100}%`, background: p.color }}
                className="min-w-[4px] transition-opacity hover:opacity-80"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400 pt-1">
            {PIPELINE.filter((p) => counts[p.key]).map((p) => (
              <Link key={p.key} href={`/schools?status=${p.key}`} className="hover:text-white flex items-center gap-1.5 transition-colors">
                <i className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span>{p.label}</span>
                <span className="font-mono text-white font-bold">{counts[p.key]}</span>
              </Link>
            ))}
          </div>
        </div>
      </Section>

      {/* EXPLORE ANALYTICS FOLD */}
      <Fold title="Explore your schools" summary="fit map, pipeline, scores, momentum">
        <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-2 mt-2">
          <DashboardAnalytics schools={list as any} weekly={weekly.map(({ week, tasks, wins }) => ({ week, tasks, wins }))} />
          <p className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
            Scores are a heuristic, not a validated ranking.
          </p>
        </div>
      </Fold>
    </main>
  );
}