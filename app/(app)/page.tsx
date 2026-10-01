import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardAnalytics } from "@/components/dashboard-analytics";

interface DatabaseTask {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  schools?: { name: string } | null;
}

interface DatabaseSchool {
  id: string;
  name: string;
  program?: string;
  country?: string;
  status: string;
  deadline?: string | null;
  fit_score?: number;
  verified_fit?: boolean;
  target_professor?: string;
}

interface DatabaseMilestone {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  schools?: { name: string } | null;
}

interface DatabaseRecommender {
  id: string;
  name: string;
  due_date?: string | null;
  status: string;
  schools?: { name: string } | null;
}

function mondayOf(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function DashboardPage() {
  // Backend / Server fetch - Intact
  const supabase = await createClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  const [
    { data: profile },
    { data: schools },
    { data: tasks },
    { data: milestones },
    { data: letters },
    { data: weeklyLogs },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, target_term").single(),
    supabase.from("schools").select("*").order("deadline", { ascending: true }),
    supabase.from("tasks").select("*, schools(name)").order("due_date", { ascending: true }),
    supabase.from("milestones").select("*, schools(name)").order("due_date", { ascending: true }),
    supabase.from("recommenders").select("*, schools(name)"),
    supabase.from("weekly_logs").select("*").order("week_start", { ascending: false }).limit(6),
  ]);

  const allSchools: DatabaseSchool[] = schools || [];
  const allTasks: DatabaseTask[] = tasks || [];
  const allMilestones: DatabaseMilestone[] = milestones || [];
  const allLetters: DatabaseRecommender[] = letters || [];

  // 1. Next upcoming school deadline
  const upcomingSchools = allSchools
    .filter((s) => s.deadline && s.deadline >= todayStr)
    .sort((a, b) => (a.deadline! > b.deadline! ? 1 : -1));
  const nextSchool = upcomingSchools[0] || allSchools[0];

  let daysToNextSchool: number | null = null;
  if (nextSchool?.deadline) {
    const target = new Date(nextSchool.deadline);
    target.setHours(0, 0, 0, 0);
    daysToNextSchool = Math.ceil((target.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
  }

  // 2. Rows normalization & merge
  const rows: {
    id: string;
    title: string;
    due_date: string | null;
    school_name?: string;
    type: "task" | "deadline" | "milestone" | "letter";
    status?: string;
    is_done?: boolean;
  }[] = [];

  allTasks.forEach((t) => {
    rows.push({
      id: `task-${t.id}`,
      title: t.title,
      due_date: t.due_date,
      school_name: t.schools?.name,
      type: "task",
      status: t.status,
      is_done: t.status === "Done" || t.status === "Completed",
    });
  });

  allSchools.forEach((s) => {
    if (s.deadline) {
      rows.push({
        id: `school-${s.id}`,
        title: `${s.name} Application Deadline`,
        due_date: s.deadline,
        school_name: s.name,
        type: "deadline",
        status: s.status,
        is_done: s.status === "Submitted" || s.status === "Accepted",
      });
    }
  });

  allMilestones.forEach((m) => {
    rows.push({
      id: `milestone-${m.id}`,
      title: m.title,
      due_date: m.due_date,
      school_name: m.schools?.name,
      type: "milestone",
      status: m.status,
      is_done: m.status === "Completed" || m.status === "Done",
    });
  });

  allLetters.forEach((l) => {
    if (l.due_date) {
      rows.push({
        id: `letter-${l.id}`,
        title: `LOR: ${l.name} (${l.schools?.name || "General"})`,
        due_date: l.due_date,
        school_name: l.schools?.name,
        type: "letter",
        status: l.status,
        is_done: l.status === "Submitted" || l.status === "Received",
      });
    }
  });

  // Filter out completed items
  const pendingRows = rows.filter((r) => !r.is_done);

  // Overdue & At-risk filter
  const overdueItems = pendingRows.filter((r) => r.due_date && r.due_date < todayStr);
  const atRiskSchools = allSchools.filter(
    (s) => s.status === "In Progress" && s.deadline && s.deadline <= todayStr
  );

  // Sorting pending rows chronologically
  pendingRows.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date > b.due_date ? 1 : -1;
  });

  const focusItem = pendingRows[0];

  // 3. Weekly Rhythm Bucketing
  const currentMon = mondayOf(todayObj);
  const currentMonStr = currentMon.toISOString().slice(0, 10);
  const nextMon = new Date(currentMon);
  nextMon.setDate(nextMon.getDate() + 7);
  const nextMonStr = nextMon.toISOString().slice(0, 10);

  const thisWeekItems = pendingRows.filter(
    (r) => r.due_date && r.due_date >= currentMonStr && r.due_date < nextMonStr
  );

  // 4. Pipeline Counts
  const PIPELINE = {
    shortlisted: allSchools.filter((s) => s.status === "Shortlisted").length,
    inProgress: allSchools.filter((s) => s.status === "In Progress").length,
    submitted: allSchools.filter((s) => s.status === "Submitted").length,
    interview: allSchools.filter((s) => s.status === "Interview").length,
  };
  const totalSchools = allSchools.length || 1;

  // Analytics mapping
  const analyticsSchools = allSchools.map((s) => {
    let days: number | undefined = undefined;
    if (s.deadline) {
      const target = new Date(s.deadline);
      target.setHours(0, 0, 0, 0);
      days = Math.max(0, Math.ceil((target.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24)));
    }
    return {
      id: s.id,
      name: s.name,
      program: s.program || "Graduate Program",
      country: s.country || "US",
      status: s.status || "Shortlisted",
      fitScore: s.fit_score ?? 75,
      deadlineDays: days,
      verifiedFit: !!s.verified_fit,
      professor: s.target_professor || undefined,
    };
  });

  const weeklyData = (weeklyLogs || []).map((w, idx) => ({
    week: `W${idx + 1}`,
    tasks: w.tasks_completed || 0,
    wins: w.milestones_reached || 0,
  }));

  const displayName = profile?.display_name || "Researcher";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto font-sans antialiased">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-slate-900 tracking-tight">
            Good afternoon, {displayName}.
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">
            Command Center overview • Target Term:{" "}
            <span className="text-slate-900 font-semibold">{profile?.target_term || "Fall 2025"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/tasks"
            className="px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-all shadow-sm active:scale-[0.98]"
          >
            Manage Tasks
          </Link>
          <Link
            href="/schools"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-lg transition-all shadow-sm active:scale-[0.98]"
          >
            + Add School
          </Link>
        </div>
      </div>

      {/* Hero Banner: Nearest Deadline */}
      {nextSchool && (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden transition-all hover:shadow-md">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-bold rounded-md uppercase tracking-wider">
              <span>Next Target Deadline</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl text-slate-900">
              {nextSchool.name}{" "}
              <span className="font-sans text-lg font-normal text-slate-500">— {nextSchool.program || "Ph.D. Application"}</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Target professor: <span className="text-slate-800 font-semibold">{nextSchool.target_professor || "Unassigned"}</span>. Ensure all statement revisions and recommendations are finalized.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 text-center min-w-[180px] w-full md:w-auto shrink-0 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
              Days Remaining
            </span>
            <div
              className={`font-mono text-4xl font-extrabold tracking-tight ${
                daysToNextSchool !== null && daysToNextSchool <= 14 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {daysToNextSchool !== null ? `${daysToNextSchool}d` : "N/A"}
            </div>
            <span className="text-[11px] font-mono text-slate-500 mt-1 block">
              Due {nextSchool.deadline ? new Date(nextSchool.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
            </span>
          </div>
        </section>
      )}

      {/* Needs Attention Alert (Overdue & At-Risk) */}
      {(overdueItems.length > 0 || atRiskSchools.length > 0) && (
        <section className="bg-white border border-rose-200/80 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Action Required ({overdueItems.length + atRiskSchools.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdueItems.slice(0, 4).map((item) => (
              <div key={item.id} className="p-3 bg-rose-50/60 border border-rose-200/80 rounded-lg flex items-center justify-between gap-3">
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-900 block truncate">{item.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.school_name || "General"}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200 shrink-0">
                  Overdue
                </span>
              </div>
            ))}

            {atRiskSchools.slice(0, 2).map((s) => (
              <div key={s.id} className="p-3 bg-white border border-rose-200/80 rounded-lg flex items-center justify-between gap-3">
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-900 block truncate">{s.name} Deadline Reached</span>
                  <span className="text-[10px] text-slate-500 font-mono">Status: In Progress</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-300 shrink-0">
                  At Risk
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Grid: Focus Card & Weekly Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Up Focus Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Primary Focus Item
              </span>
              {focusItem?.due_date && focusItem.due_date < todayStr ? (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  Overdue
                </span>
              ) : (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  High Priority
                </span>
              )}
            </div>

            {focusItem ? (
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  {focusItem.title}
                </h3>
                <p className="text-xs text-slate-500 flex items-center gap-2 font-mono">
                  <span>Scope: {focusItem.school_name || "General Execution"}</span>
                  <span>•</span>
                  <span>Due: {focusItem.due_date || "No date"}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-4">No active pending tasks or milestones.</p>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Ready to execute?</span>
            <Link
              href="/today"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
            >
              Open Daily Plan →
            </Link>
          </div>
        </div>

        {/* Weekly Summary Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              This Week's Pace
            </h3>
            <p className="text-xs text-slate-500">
              Active workload scheduled for the current week interval.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between font-mono text-xs text-slate-500">
            <span>Scheduled this week:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              {thisWeekItems.length} items
            </span>
          </div>
        </div>
      </div>

      {/* Coming Up List & Application Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Chronological List */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Upcoming Action Items
            </h3>
            <Link href="/tasks" className="text-xs text-blue-600 font-semibold hover:underline">
              View all ({pendingRows.length})
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingRows.slice(1, 6).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/60 px-1 rounded transition-colors">
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-900 block truncate">{item.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{item.school_name || "General"}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono font-medium text-slate-600 block">
                    {item.due_date || "TBD"}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-400">
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
            {pendingRows.length <= 1 && (
              <p className="text-xs text-slate-400 italic py-4 text-center">No upcoming scheduled items.</p>
            )}
          </div>
        </div>

        {/* Pipeline Segment Bar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-1">
              Application Pipeline
            </h3>
            <p className="text-xs text-slate-500 mb-4">Stage distribution across {totalSchools} target institutions</p>

            {/* Visual Bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/80 mb-6">
              <div style={{ width: `${(PIPELINE.shortlisted / totalSchools) * 100}%` }} className="bg-blue-600" title="Shortlisted" />
              <div style={{ width: `${(PIPELINE.inProgress / totalSchools) * 100}%` }} className="bg-sky-500" title="In Progress" />
              <div style={{ width: `${(PIPELINE.submitted / totalSchools) * 100}%` }} className="bg-emerald-600" title="Submitted" />
              <div style={{ width: `${(PIPELINE.interview / totalSchools) * 100}%` }} className="bg-violet-600" title="Interview" />
            </div>

            {/* Segment Breakdown */}
            <div className="space-y-2.5 text-xs font-medium">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  <span className="text-slate-700">Shortlisted</span>
                </div>
                <span className="font-mono text-slate-900 font-bold">{PIPELINE.shortlisted}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  <span className="text-slate-700">In Progress</span>
                </div>
                <span className="font-mono text-slate-900 font-bold">{PIPELINE.inProgress}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <span className="text-slate-700">Submitted</span>
                </div>
                <span className="font-mono text-slate-900 font-bold">{PIPELINE.submitted}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                  <span className="text-slate-700">Interview</span>
                </div>
                <span className="font-mono text-slate-900 font-bold">{PIPELINE.interview}</span>
              </div>
            </div>
          </div>

          <Link
            href="/schools"
            className="block text-center w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all mt-4 active:scale-[0.98]"
          >
            Manage Pipeline →
          </Link>
        </div>
      </div>

      {/* Analytics Fold Section */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
            Institutional Telemetry & Analytics
          </h2>
          <p className="text-xs text-slate-500">
            Real-time alignment maps and execution velocity models
          </p>
        </div>

        <DashboardAnalytics schools={analyticsSchools} weekly={weeklyData} />

        <div className="text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100 text-right">
          Heuristic Model: Fit score derived from research alignment, target faculty presence, and historical acceptance benchmarks.
        </div>
      </section>
    </main>
  );
}