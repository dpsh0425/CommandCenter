import { createClient } from "@/lib/supabase/server";
import { StatusFunnelChart } from "@/components/status-funnel-chart";
import { ScoreRankScatter } from "@/components/score-rank-scatter";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: schools } = await supabase.from("schools").select("*");
  const list = schools ?? [];

  const counts: Record<string, number> = {};
  for (const s of list) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const contacted = list.filter((s) => s.status !== "not_started" && s.status !== "researching").length;
  const submittedPlus = list.filter((s) => ["submitted", "interview", "accepted", "rejected"].includes(s.status)).length;
  const accepted = list.filter((s) => s.status === "accepted").length;

  return (
    <main className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-3">
        {[
          ["Target schools", list.length],
          ["Outreach started", contacted],
          ["Submitted+", submittedPlus],
          ["Accepted", accepted],
        ].map(([label, value]) => (
          <div key={label as string} className="border rounded p-4">
            <div className="text-2xl font-mono font-semibold">{value}</div>
            <div className="text-xs text-gray-500 uppercase">{label}</div>
          </div>
        ))}
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
