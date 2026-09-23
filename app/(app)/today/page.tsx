import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodayTaskRow } from "@/components/today-task-row";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d late` : `in ${d}d`);
const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

type Task = { id: string; title: string; due_date: string | null; priority: string; status: string; schools: { name: string } | null; research_milestones: { title: string } | null };
type Other = { key: string; label: string; sub: string; href: string; date: string };

export default async function TodayPage() {
  const supabase = await createClient();
  const now = new Date();
  const today = localDate(now);
  const weekOut = new Date(now);
  weekOut.setDate(weekOut.getDate() + 7);
  const cutoff = localDate(weekOut);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [{ data: rawTasks }, { data: schools }, { data: milestones }, { data: letters }, { count: doneToday }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, priority, status, schools(name), research_milestones(title)").not("status", "in", "(done,cancelled)"),
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).lte("deadline_date", cutoff),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null).lte("target_date", cutoff).neq("status", "done"),
    supabase.from("letter_requests").select("id, school_id, status, letter_deadline, people(name), schools(name)").not("letter_deadline", "is", null).lte("letter_deadline", cutoff).neq("status", "submitted"),
    supabase.from("task_updates").select("id", { count: "exact", head: true }).eq("type", "status_change").eq("is_win", true).gte("created_at", startOfDay),
  ]);

  const tasks = (rawTasks ?? []) as unknown as Task[];
  const byPriority = (a: Task, b: Task) => (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9");

  const overdue = tasks.filter((t) => t.due_date && t.due_date < today).sort(byPriority);
  const dueToday = tasks.filter((t) => t.due_date === today).sort(byPriority);
  const inProgress = tasks.filter((t) => t.status === "in_progress" && (!t.due_date || t.due_date > today)).sort(byPriority);
  const thisWeek = tasks.filter((t) => t.due_date && t.due_date > today && t.due_date <= cutoff && t.status !== "in_progress").sort(byPriority);

  const others: Other[] = [
    ...(schools ?? []).map((s) => ({ key: `s${s.id}`, label: `${s.name} deadline`, sub: "school application", href: `/schools/${s.id}`, date: s.deadline_date as string })),
    ...(milestones ?? []).map((m) => ({ key: `m${m.id}`, label: m.title, sub: "research milestone", href: `/research/${m.id}`, date: m.target_date as string })),
    ...((letters ?? []) as any[]).map((l) => ({
      key: `l${l.id}`, label: `${l.people?.name ?? "Recommender"} — letter for ${l.schools?.name ?? "school"}`,
      sub: `recommendation letter · ${String(l.status).replace("_", " ")}`, href: `/schools/${l.school_id}`, date: l.letter_deadline as string,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const othersLate = others.filter((o) => o.date < today);
  const othersToday = others.filter((o) => o.date === today);
  const othersWeek = others.filter((o) => o.date > today);

  const focus = [...overdue, ...dueToday, ...inProgress][0];
  const remaining = overdue.length + dueToday.length;
  const finished = doneToday ?? 0;
  const pct = finished + remaining === 0 ? 0 : Math.round((finished / (finished + remaining)) * 100);

  const sub = (t: Task) => [t.schools?.name, t.research_milestones?.title, `${t.priority} priority`].filter(Boolean).join(" · ");
  const row = (t: Task) => (
    <TodayTaskRow
      key={t.id} id={t.id} title={t.title} sub={sub(t)} priority={t.priority}
      overdue={!!t.due_date && t.due_date < today}
      when={t.due_date ? relative(daysBetween(today, t.due_date)) : "no date"}
    />
  );
  const otherRow = (o: Other) => (
    <Link key={o.key} href={o.href} className="flex items-center gap-3 border rounded p-3 text-sm hover:border-brass">
      <i className="w-2.5 h-2.5 rounded-full bg-violet-600 flex-shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block truncate">{o.label}</span>
        <span className="block text-xs text-gray-500">{o.sub}</span>
      </span>
      <span className={`text-xs font-mono whitespace-nowrap ${o.date < today ? "text-red-600" : "text-gray-500"}`}>{relative(daysBetween(today, o.date))}</span>
    </Link>
  );

  const groups: Array<{ title: string; tone: string; nodes: React.ReactNode[] }> = [
    { title: "Overdue", tone: "text-red-600", nodes: [...overdue.map(row), ...othersLate.map(otherRow)] },
    { title: "Due today", tone: "text-brass", nodes: [...dueToday.map(row), ...othersToday.map(otherRow)] },
    { title: "In progress", tone: "text-gray-500", nodes: inProgress.map(row) },
    { title: "Next 7 days", tone: "text-gray-500", nodes: [...thisWeek.map(row), ...othersWeek.map(otherRow)] },
  ].filter((g) => g.nodes.length > 0);

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="text-sm text-gray-500">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <span className="font-mono text-cream text-lg">{finished}</span> done today
          {remaining > 0 && <span> · {remaining} to go</span>}
        </div>
      </div>

      {(finished > 0 || remaining > 0) && (
        <div className="h-1.5 rounded bg-surface-raised overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-brass transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {focus && (
        <section className="border border-brass bg-brass-soft rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-brass font-mono">Focus next</div>
            <div className="text-lg font-serif truncate mt-0.5">{focus.title}</div>
            <div className="text-xs text-gray-500 truncate">{sub(focus)}</div>
          </div>
          <Link href={`/tasks/${focus.id}`} className="bg-brass text-ink font-medium rounded px-3 py-2 text-sm whitespace-nowrap">
            Start focus →
          </Link>
        </section>
      )}

      {groups.length === 0 && (
        <div className="border border-dashed border-line rounded-lg p-8 text-center text-sm text-gray-500">
          {finished > 0 ? `All clear — ${finished} finished today. Nice work.` : "Nothing due this week. Use the time to move a school forward."}
          <div className="mt-3 flex gap-2 justify-center">
            <Link href="/schools" className="border rounded px-3 py-1.5 hover:border-brass">Review schools</Link>
            <Link href="/tasks" className="border rounded px-3 py-1.5 hover:border-brass">Plan a task</Link>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h2 className={`text-xs uppercase tracking-wide ${g.tone}`}>{g.title} · {g.nodes.length}</h2>
          {g.nodes}
        </section>
      ))}
    </main>
  );
}
