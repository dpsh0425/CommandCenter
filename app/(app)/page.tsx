import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayString } from "@/lib/digest";
import { loadReadiness } from "@/lib/readiness-data";
import { daysBetween } from "@/lib/readiness";
import {
  ActivityFeed,
  AttentionList,
  EmptyState,
  KpiCard,
  NextDeadlineCard,
  Panel,
  PipelineBar,
  QuickAccess,
  UpcomingList,
  type ActivityEntry,
  type DatedItem,
} from "@/components/home";
import { CalendarIcon, GraduationCapIcon, ListChecksIcon, TrophyIcon } from "@/components/icons";

export const metadata = { title: "Dashboard" };

// "YYYY-MM-DD" plus n days, done in UTC so it never shifts across a timezone boundary.
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Hour and long date in the owner's timezone (APP_TIMEZONE), falling back to the server's.
function localParts(now: Date) {
  const timeZone = process.env.APP_TIMEZONE || undefined;
  try {
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
    const longDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone });
    return { hour, longDate };
  } catch {
    return {
      hour: now.getHours(),
      longDate: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    };
  }
}

const IN_PROGRESS_EXCLUDED = ["not_started", "accepted", "rejected"];
const SUBMITTED = ["submitted", "interview"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const today = todayString(now);
  const cutoff = addDays(today, 14);
  const urgentCutoff = addDays(today, 3);
  const monthStart = `${today.slice(0, 8)}01`;

  // Same queries the working Home used (commit 225c102), plus read-only activity and counts.
  const [
    { data: schools },
    { data: openTasks },
    { data: dueTasks },
    { data: schoolDeadlines },
    { data: nextDeadlines },
    { data: milestones },
    { data: letters },
    { count: winsA },
    { count: winsB },
    { data: recentSchoolActivity },
    { data: recentTaskUpdates },
    { count: draftStatements },
    { count: pendingLetters },
    { count: peopleCount },
  ] = await Promise.all([
    supabase.from("schools").select("id, name, status"),
    supabase.from("tasks").select("id").not("status", "in", "(done,cancelled)"),
    supabase.from("tasks").select("id, title, due_date, priority").not("due_date", "is", null).lte("due_date", cutoff).not("status", "in", "(done,cancelled)"),
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).lte("deadline_date", cutoff),
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null).gte("deadline_date", today).order("deadline_date").limit(1),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null).lte("target_date", cutoff).neq("status", "done"),
    supabase.from("letter_requests").select("id, school_id, status, letter_deadline, people(name), schools(name)").not("letter_deadline", "is", null).lte("letter_deadline", cutoff).neq("status", "submitted"),
    supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart),
    supabase.from("task_updates").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart),
    supabase.from("activity_log").select("id, content, is_win, occurred_at, school_id, schools(name)").order("occurred_at", { ascending: false }).limit(8),
    supabase.from("task_updates").select("id, content, is_win, created_at, task_id, tasks(title)").order("created_at", { ascending: false }).limit(8),
    supabase.from("statements").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("letter_requests").select("id", { count: "exact", head: true }).neq("status", "submitted"),
    supabase.from("people").select("id", { count: "exact", head: true }),
  ]);
  const readiness = await loadReadiness(supabase, today);

  /* ── Schools and pipeline ── */
  const schoolList = schools ?? [];
  const counts: Record<string, number> = {};
  for (const s of schoolList) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const inProgress = schoolList.filter((s) => !IN_PROGRESS_EXCLUDED.includes(s.status)).length;
  const submitted = schoolList.filter((s) => SUBMITTED.includes(s.status)).length;

  /* ── Everything with a date in the next 14 days (or overdue) ── */
  const dated: Array<DatedItem & { delta: number }> = [
    ...(dueTasks ?? []).map((t) => ({
      label: t.title as string,
      sub: `Task · ${t.priority} priority`,
      href: `/tasks/${t.id}`,
      date: t.due_date as string,
      kind: "task" as const,
    })),
    ...(schoolDeadlines ?? []).map((s) => ({
      label: s.name as string,
      sub: "School deadline",
      href: `/schools/${s.id}?tab=application`,
      date: s.deadline_date as string,
      kind: "school" as const,
    })),
    ...(milestones ?? []).map((m) => ({
      label: m.title as string,
      sub: "Research milestone",
      href: `/research/${m.id}`,
      date: m.target_date as string,
      kind: "milestone" as const,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((letters ?? []) as any[]).map((l) => ({
      label: `${l.people?.name ?? "Recommender"} — letter for ${l.schools?.name ?? "school"}`,
      sub: `Letter · ${String(l.status).replace("_", " ")}`,
      href: `/schools/${l.school_id}?tab=application`,
      date: l.letter_deadline as string,
      kind: "letter" as const,
    })),
  ]
    .map((r) => ({ ...r, delta: daysBetween(today, r.date) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const urgentDated = dated.filter((r) => r.date <= urgentCutoff);
  const upcoming = dated.filter((r) => r.date >= today);

  // Applications the readiness checklist flags, unless the school's deadline is already listed above.
  const listedSchools = new Set(urgentDated.filter((r) => r.kind === "school").map((r) => r.href));
  const readinessAttention = readiness
    .filter((r) => (r.risk === "overdue" || r.risk === "urgent") && r.days != null)
    .filter((r) => !listedSchools.has(`/schools/${r.school.id}?tab=application`))
    .map((r) => ({
      label: `${r.school.name}: ${r.pending.length} checklist ${r.pending.length === 1 ? "item" : "items"} left`,
      sub: "Application",
      href: `/schools/${r.school.id}?tab=application`,
      date: r.school.deadline_date as string,
      kind: "readiness" as const,
      delta: r.days as number,
    }));
  const attention = [...urgentDated, ...readinessAttention].sort((a, b) => a.delta - b.delta).slice(0, 6);

  /* ── KPIs ── */
  const overdueTasks = (dueTasks ?? []).filter((t) => (t.due_date as string) < today).length;
  const wins = (winsA ?? 0) + (winsB ?? 0);
  const nextUp = upcoming[0];

  /* ── Next school deadline ── */
  const next = nextDeadlines?.[0];
  const nextReadiness = next ? readiness.find((r) => r.school.id === next.id) : undefined;
  const nextSchool = next
    ? {
        id: next.id as string,
        name: next.name as string,
        date: next.deadline_date as string,
        days: daysBetween(today, next.deadline_date as string),
        done: nextReadiness?.doneCount,
        total: nextReadiness?.total,
      }
    : null;

  /* ── Recent activity ── */
  const activity: ActivityEntry[] = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((recentSchoolActivity ?? []) as any[]).map((a) => ({
      id: `a-${a.id}`,
      text: a.content as string,
      context: a.schools?.name ?? "School",
      at: a.occurred_at as string,
      href: `/schools/${a.school_id}`,
      win: !!a.is_win,
      kind: "school" as const,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((recentTaskUpdates ?? []) as any[]).map((u) => ({
      id: `t-${u.id}`,
      text: u.content as string,
      context: u.tasks?.title ?? "Task",
      at: u.created_at as string,
      href: `/tasks/${u.task_id}`,
      win: !!u.is_win,
      kind: "task" as const,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  /* ── Header copy ── */
  const { hour, longDate } = localParts(now);
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const summary = [
    attention.length > 0 ? `${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} you soon.` : "Nothing urgent right now.",
    nextSchool ? `Next school deadline ${nextSchool.days === 0 ? "is today" : `in ${nextSchool.days} ${nextSchool.days === 1 ? "day" : "days"}`}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const n = (v: number | null) => v ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{longDate}</p>
          <h1 className="text-2xl font-semibold leading-8 tracking-tight text-slate-900">{greeting}</h1>
          <p className="mt-1 text-sm leading-5 text-slate-600">{summary}</p>
        </div>
        <Link
          href="/week"
          className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          Plan the week
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4" aria-label="Key numbers">
        <KpiCard
          href="/schools"
          Icon={GraduationCapIcon}
          label="Applications in progress"
          value={inProgress}
          detail={schoolList.length ? `of ${schoolList.length} target schools · ${submitted} submitted` : "No schools added yet"}
        />
        <KpiCard
          href="/week"
          Icon={CalendarIcon}
          label="Upcoming deadlines"
          value={upcoming.length}
          detail={nextUp ? `next 14 days · next: ${nextUp.label}` : "Nothing due in the next 14 days"}
        />
        <KpiCard
          href="/tasks"
          Icon={ListChecksIcon}
          label="Action items"
          value={openTasks?.length ?? 0}
          detail={overdueTasks ? `${overdueTasks} overdue` : "None overdue"}
          tone={overdueTasks ? "danger" : "neutral"}
        />
        <KpiCard
          href="/wins"
          Icon={TrophyIcon}
          label="Wins this month"
          value={wins}
          detail={wins ? "replies, results and finished tasks" : "Your first win of the month is next"}
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {attention.length > 0 && (
            <Panel title="Needs attention" action={{ href: "/readiness", label: "All applications" }}>
              <AttentionList items={attention} />
            </Panel>
          )}

          <Panel title="Coming up" hint="next 14 days" action={{ href: "/week", label: "See the week" }}>
            {upcoming.length ? (
              <UpcomingList items={upcoming.slice(0, 8)} />
            ) : (
              <EmptyState>
                Nothing due in the next 14 days. A good moment to{" "}
                <Link href="/outreach" className="font-medium text-blue-600 hover:text-blue-700">email a professor</Link> or{" "}
                <Link href="/schools" className="font-medium text-blue-600 hover:text-blue-700">research a school</Link>.
              </EmptyState>
            )}
          </Panel>

          <Panel
            title="Application pipeline"
            hint={schoolList.length ? `${schoolList.length} ${schoolList.length === 1 ? "school" : "schools"}` : undefined}
            action={{ href: "/schools", label: "All schools" }}
          >
            {schoolList.length ? (
              <PipelineBar counts={counts} total={schoolList.length} />
            ) : (
              <EmptyState>
                No schools yet.{" "}
                <Link href="/schools" className="font-medium text-blue-600 hover:text-blue-700">Add your first school</Link> to see your pipeline.
              </EmptyState>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <NextDeadlineCard school={nextSchool} />

          <Panel title="Recent activity" action={{ href: "/wins", label: "All wins" }}>
            {activity.length ? (
              <ActivityFeed entries={activity} now={now} />
            ) : (
              <EmptyState>Status changes, notes and finished tasks will show up here.</EmptyState>
            )}
          </Panel>

          <QuickAccess
            links={[
              { href: "/materials/statements", label: "Statements", detail: `${n(draftStatements)} ${n(draftStatements) === 1 ? "draft" : "drafts"}` },
              { href: "/materials/letters", label: "Letters", detail: `${n(pendingLetters)} not yet submitted` },
              { href: "/people", label: "People", detail: `${n(peopleCount)} ${n(peopleCount) === 1 ? "person" : "people"}` },
              { href: "/materials/resume", label: "Resume", detail: "Open the builder" },
              { href: "/outreach", label: "Outreach", detail: "Professors to email" },
              { href: "/compare", label: "Compare", detail: "Schools side by side" },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
