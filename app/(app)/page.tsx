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
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).gte("deadline_date", localDate(now)).order("deadline_date").limit(12),
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

  const tiles: Array<{ label: string; value: number; sub: string; href: string; tone?: string }> = [
    { label: "Target schools", value: list.length, sub: `${active} in progress`, href: "/schools" },
    { label: "Open tasks", value: openTasks?.length ?? 0, sub: "across all projects", href: "/tasks" },
    { label: "Overdue", value: overdue.length, sub: overdue.length ? "needs action now" : "all clear", href: "/today", tone: overdue.length ? "text-red-600" : "text-teal-600" },
    { label: "Wins this month", value: wins, sub: "replies & results", href: "/wins" },
  ];

  const total = list.length || 1;

  // This week's rhythm: a day counts when something moved forward.
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
    <main className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-10">
      <header>
        <p className="text-sm text-gray-500">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="text-4xl md:text-5xl leading-tight mt-1">{greeting}.</h1>
      </header>

      <section className="hero-glow border border-line rounded-2xl p-6 md:p-8 flex flex-col gap-6">
        {first ? (
          <>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <p className="text-sm text-gray-500">Your first application deadline is in</p>
                <p className="flex items-baseline gap-3 leading-none mt-2">
                  <span className="font-serif italic text-7xl md:text-8xl text-cream">{firstDays}</span>
                  <span className="font-serif text-2xl text-gray-400">days</span>
                </p>
              </div>
              <div className="md:text-right">
                <Link href={`/schools/${first.id}?tab=application`} className="text-lg font-medium hover:text-brass">{first.name}</Link>
                <p className="text-sm text-gray-500">{new Date(first.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
                <Link href="/week" className="text-sm text-brass hover:underline">Plan the week →</Link>
              </div>
            </div>
            <Runway deadlines={deadlines} today={today} />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-serif text-3xl">No deadlines set yet.</p>
            <p className="text-sm text-gray-500">Open a school and add its deadline in the Admissions tab, and your runway appears here.</p>
            <Link href="/schools?sort=deadline" className="text-sm text-brass hover:underline self-start">Go to schools →</Link>
          </div>
        )}
      </section>

      {atRisk.length > 0 && (
        <section className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 className="font-sans text-[15px] font-semibold text-cream">Needs attention</h2>
            <Link href="/readiness" className="text-xs text-gray-500 hover:text-cream">All applications →</Link>
          </div>
          <ul className="flex flex-col">
            {atRisk.slice(0, 4).map((r) => (
              <li key={r.school.id} className="border-b border-line/60 last:border-0">
                <Link href={`/schools/${r.school.id}?tab=application`} className="flex items-baseline justify-between gap-4 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                  <span className="min-w-0">
                    <span className="block truncate">{r.school.name}</span>
                    <span className="block text-xs text-gray-500 truncate">Still to do: {r.pending.map((p) => p.label.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}</span>
                  </span>
                  <span className={`text-sm whitespace-nowrap ${RISK_TONE[r.risk]}`}>{RISK_LABEL[r.risk]}{r.days != null && <span className="text-gray-400"> · {r.days < 0 ? `${-r.days}d ago` : `${r.days}d`}</span>}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2 items-start">
        <section className="flex flex-col gap-3">
          <h2 className="font-sans text-[15px] font-semibold text-cream border-b border-line pb-2">Next up</h2>
          {focus ? (
            <Link href={focus.href} className="group flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brass">
              <span className={`text-xs ${focus.date < today ? "text-red-600" : "text-brass"}`}>{when(daysFrom(today, focus.date))}</span>
              <span className="font-serif text-2xl leading-snug">{focus.label}</span>
              <span className="text-sm text-gray-500">{focus.sub}</span>
              <span className="text-sm text-brass mt-2 group-hover:translate-x-1 transition-transform">Open →</span>
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-sm text-gray-500">
              Nothing urgent. A good moment to <Link href="/outreach" className="text-brass hover:underline">email a professor</Link> or <Link href="/schools?sort=researched" className="text-brass hover:underline">research a school</Link>.
            </div>
          )}
          {attention.length > 1 && (
            <ul className="flex flex-col">
              {attention.slice(1, 5).map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="flex justify-between gap-4 py-2 -mx-2 px-2 rounded text-sm transition-colors hover:bg-surface-raised">
                    <span className="truncate">{r.label}</span>
                    <span className={`whitespace-nowrap ${r.date < today ? "text-red-600" : "text-gray-400"}`}>{when(daysFrom(today, r.date))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-sans text-[15px] font-semibold text-cream border-b border-line pb-2">This week</h2>
          <WeekRhythm days={rhythmDays} />
          <p className="text-sm text-gray-500 flex flex-wrap gap-x-5 gap-y-1 pt-2">
            <Link href="/schools" className="hover:text-cream"><span className="font-mono text-cream">{list.length}</span> schools ({active} in progress)</Link>
            <Link href="/tasks" className="hover:text-cream"><span className="font-mono text-cream">{openTasks?.length ?? 0}</span> open tasks</Link>
            <Link href="/wins" className="hover:text-cream"><span className="font-mono text-cream">{wins}</span> wins this month</Link>
          </p>
        </section>
      </div>

      {upcoming.length > 0 && (
        <Section title="Coming up" hint="next 14 days" action={<Link href="/week" className="hover:text-cream">See the week →</Link>}>
          <ul className="flex flex-col">
            {upcoming.slice(0, 6).map((r, i) => (
              <li key={i}>
                <Link href={r.href} className="flex justify-between gap-4 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                  <span className="truncate">{r.label}</span>
                  <span className="text-sm whitespace-nowrap text-gray-400">{when(daysFrom(today, r.date))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Your applications" action={<Link href="/schools" className="hover:text-cream">All schools →</Link>}>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-raised">
          {PIPELINE.filter((p) => counts[p.key]).map((p) => (
            <Link key={p.key} href={`/schools?status=${p.key}`} title={`${p.label}: ${counts[p.key]}`} style={{ width: `${(counts[p.key] / total) * 100}%`, background: p.color }} className="min-w-[3px] transition-opacity hover:opacity-80" />
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
