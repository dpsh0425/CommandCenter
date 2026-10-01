import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodayTaskRow } from "@/components/today-task-row";
import { PageHeader, SubNav, TODAY_TABS } from "@/components/ui";
import { FlaskIcon, GraduationCapIcon, SendIcon } from "@/components/icons";
import { todayString, zonedMidnightISO } from "@/lib/app-date";

export const metadata = { title: "Today" };

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);

const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d late` : `in ${d}d`);

// "YYYY-MM-DD" plus n days, in UTC so the date never shifts.
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

type Task = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  status: string;
  schools: { name: string } | null;
  research_milestones: { title: string } | null;
};

type Other = { key: string; label: string; sub: string; href: string; date: string; kind: "school" | "milestone" | "letter" };

const OTHER_ICON = { school: GraduationCapIcon, milestone: FlaskIcon, letter: SendIcon } as const;

export default async function TodayPage() {
  const supabase = await createClient();
  const now = new Date();
  // Dates follow APP_TIMEZONE, not the server clock.
  const today = todayString(now);
  const cutoff = addDays(today, 7);
  const startOfDay = zonedMidnightISO(today);

  const [{ data: rawTasks }, { data: schools }, { data: milestones }, { data: letters }, { count: doneToday }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, due_date, priority, status, schools(name), research_milestones(title)")
        .not("status", "in", "(done,cancelled)"),
      supabase
        .from("schools")
        .select("id, name, deadline_date")
        .not("deadline_date", "is", null)
        .lte("deadline_date", cutoff),
      supabase
        .from("research_milestones")
        .select("id, title, target_date")
        .not("target_date", "is", null)
        .lte("target_date", cutoff)
        .neq("status", "done"),
      supabase
        .from("letter_requests")
        .select("id, school_id, status, letter_deadline, people(name), schools(name)")
        .not("letter_deadline", "is", null)
        .lte("letter_deadline", cutoff)
        .neq("status", "submitted"),
      supabase
        .from("task_updates")
        .select("id", { count: "exact", head: true })
        .eq("type", "status_change")
        .eq("is_win", true)
        .gte("created_at", startOfDay),
    ]);

  const tasks = (rawTasks ?? []) as unknown as Task[];
  const byPriority = (a: Task, b: Task) =>
    (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9");

  const overdue = tasks.filter((t) => t.due_date && t.due_date < today).sort(byPriority);
  const dueToday = tasks.filter((t) => t.due_date === today).sort(byPriority);
  const inProgress = tasks
    .filter((t) => t.status === "in_progress" && (!t.due_date || t.due_date > today))
    .sort(byPriority);
  const thisWeek = tasks
    .filter((t) => t.due_date && t.due_date > today && t.due_date <= cutoff && t.status !== "in_progress")
    .sort(byPriority);

  const others: Other[] = [
    ...(schools ?? []).map((s) => ({
      key: `s${s.id}`,
      label: `${s.name} deadline`,
      sub: "School application",
      href: `/schools/${s.id}`,
      date: s.deadline_date as string,
      kind: "school" as const,
    })),
    ...(milestones ?? []).map((m) => ({
      key: `m${m.id}`,
      label: m.title,
      sub: "Research milestone",
      href: `/research/${m.id}`,
      date: m.target_date as string,
      kind: "milestone" as const,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((letters ?? []) as any[]).map((l) => ({
      key: `l${l.id}`,
      label: `${l.people?.name ?? "Recommender"} — letter for ${l.schools?.name ?? "school"}`,
      sub: `Recommendation letter · ${String(l.status).replace("_", " ")}`,
      href: `/schools/${l.school_id}`,
      date: l.letter_deadline as string,
      kind: "letter" as const,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const othersLate = others.filter((o) => o.date < today);
  const othersToday = others.filter((o) => o.date === today);
  const othersWeek = others.filter((o) => o.date > today);

  const focus = [...overdue, ...dueToday, ...inProgress][0];
  const remaining = overdue.length + dueToday.length;
  const finished = doneToday ?? 0;
  const pct = finished + remaining === 0 ? 0 : Math.round((finished / (finished + remaining)) * 100);

  const sub = (t: Task) =>
    [t.schools?.name, t.research_milestones?.title, `${t.priority} priority`].filter(Boolean).join(" · ");

  const row = (t: Task) => (
    <TodayTaskRow
      key={t.id}
      id={t.id}
      title={t.title}
      sub={sub(t)}
      priority={t.priority}
      overdue={!!t.due_date && t.due_date < today}
      when={t.due_date ? relative(daysBetween(today, t.due_date)) : "no date"}
    />
  );

  const otherRow = (o: Other) => {
    const Icon = OTHER_ICON[o.kind];
    return (
      <li key={o.key}>
        <Link href={o.href} className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-slate-50">
          <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-900 group-hover:text-blue-700">{o.label}</span>
            <span className="block truncate text-xs text-slate-500">{o.sub}</span>
          </span>
          <span className={`flex-shrink-0 whitespace-nowrap font-mono text-xs ${o.date < today ? "text-red-700" : "text-slate-500"}`}>
            {relative(daysBetween(today, o.date))}
          </span>
        </Link>
      </li>
    );
  };

  const groups: Array<{ title: string; tone: string; nodes: React.ReactNode[] }> = [
    { title: "Overdue", tone: "text-red-700", nodes: [...overdue.map(row), ...othersLate.map(otherRow)] },
    { title: "Due today", tone: "text-blue-700", nodes: [...dueToday.map(row), ...othersToday.map(otherRow)] },
    { title: "In progress", tone: "text-slate-900", nodes: inProgress.map(row) },
    { title: "Next 7 days", tone: "text-slate-600", nodes: [...thisWeek.map(row), ...othersWeek.map(otherRow)] },
  ].filter((g) => g.nodes.length > 0);

  const longDate = (() => {
    try {
      return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: process.env.APP_TIMEZONE || undefined });
    } catch {
      return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    }
  })();

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Overview"
          title="Today"
          subtitle={longDate}
          actions={
            (finished > 0 || remaining > 0) && (
              <div className="w-48 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
                <div className="mb-1.5 flex justify-between text-xs text-slate-600">
                  <span><span className="font-semibold text-slate-900 tabular-nums">{finished}</span> done</span>
                  <span><span className="font-semibold text-slate-900 tabular-nums">{remaining}</span> to go</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label="Today's progress"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          }
        />
        <SubNav items={TODAY_TABS} current="/today" />
      </div>

      {focus && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-blue-700">Focus next</div>
            <div className="mt-0.5 truncate text-[17px] font-semibold text-slate-900">{focus.title}</div>
            <div className="truncate text-[13px] text-slate-600">{sub(focus)}</div>
          </div>
          <Link
            href={`/tasks/${focus.id}`}
            className="inline-flex h-9 flex-shrink-0 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Start focus
          </Link>
        </section>
      )}

      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-600">
            {finished > 0 ? `All clear: ${finished} finished today. Nice work!` : "Nothing due this week. Use the time to move a school application forward."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/schools" className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50">
              Review schools
            </Link>
            <Link href="/tasks" className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50">
              Plan a task
            </Link>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.title} className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <h2 className={`text-sm font-semibold ${g.tone}`}>{g.title}</h2>
            <span className="rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-600 tabular-nums">{g.nodes.length}</span>
          </div>
          <ul className="px-2 py-1.5">{g.nodes}</ul>
        </section>
      ))}
    </main>
  );
}
