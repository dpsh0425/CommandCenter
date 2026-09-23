import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusFunnelChart } from "@/components/status-funnel-chart";
import { ScoreRankScatter } from "@/components/score-rank-scatter";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: schools } = await supabase.from("schools").select("*");
  const list = schools ?? [];

  const counts: Record<string, number> = {};
  for (const s of list) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const today = new Date().toISOString().slice(0, 10);
  const { data: openTasks } = await supabase.from("tasks").select("id").not("status", "in", "(done,cancelled)");
  const { data: overdueTasks } = await supabase.from("tasks").select("id").lt("due_date", today).not("status", "in", "(done,cancelled)");

  const monthStart = new Date();
  monthStart.setDate(1);
  const [{ count: winCountA }, { count: winCountB }] = await Promise.all([
    supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart.toISOString()),
    supabase.from("task_updates").select("id", { count: "exact", head: true }).eq("is_win", true).gte("created_at", monthStart.toISOString()),
  ]);
  const winsThisMonth = (winCountA ?? 0) + (winCountB ?? 0);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const { data: dueSoonTasks } = await supabase
    .from("tasks")
    .select("id, title, due_date")
    .lte("due_date", cutoffStr)
    .not("status", "in", "(done,cancelled)")
    .order("due_date")
    .limit(6);

  const tiles: Array<[string, number, string]> = [
    ["Target schools", list.length, "/schools"],
    ["Open tasks", openTasks?.length ?? 0, "/tasks"],
    ["Overdue", overdueTasks?.length ?? 0, "/today"],
    ["Wins this month", winsThisMonth, "/wins"],
  ];

  return (
    <main className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-3">
        {tiles.map(([label, value, href]) => (
          <Link key={label} href={href} className="border rounded p-4 hover:border-black">
            <div className={`text-2xl font-mono font-semibold ${label === "Overdue" && value > 0 ? "text-red-600" : ""}`}>{value}</div>
            <div className="text-xs text-gray-500 uppercase">{label}</div>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-medium">Upcoming deadlines</h2>
          <Link href="/timeline" className="text-xs text-gray-500 underline">full timeline</Link>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(dueSoonTasks ?? []).map((t) => (
            <Link key={t.id} href={`/tasks/${t.id}`} className="border rounded p-2 text-xs flex-shrink-0 min-w-[140px] hover:border-black">
              <div className="font-medium">{t.title}</div>
              <div className="text-gray-500 mt-1">{t.due_date}</div>
            </Link>
          ))}
          {(dueSoonTasks ?? []).length === 0 && <p className="text-sm text-gray-500">Nothing due in the next 14 days.</p>}
        </div>
      </div>

      <div>
        <h2 className="font-medium mb-2">Pipeline</h2>
        <StatusFunnelChart counts={counts} />
      </div>

      <div>
        <h2 className="font-medium mb-2">Score vs. CSRankings NLP rank <span className="text-xs text-gray-400 font-normal">(green = verified fit; score is a heuristic, not a validated ranking)</span></h2>
        <ScoreRankScatter schools={list} />
      </div>
    </main>
  );
}
