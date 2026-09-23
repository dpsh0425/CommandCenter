"use client";
import { useRouter } from "next/navigation";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type School = {
  id: string; name: string; country: string; status: string;
  csranking_nlp_rank: number | null; composite_score: number | null; verified_fit: boolean;
};

const VERIFIED = "#5cae97";
const HEURISTIC = "#c98a3e";
const LABELED_COUNT = 5;

function Dot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const inProgress = payload.status !== "not_started";
  const color = payload.verified_fit ? VERIFIED : HEURISTIC;
  return (
    <g style={{ cursor: "pointer" }} onClick={() => props.onOpen?.(payload.id)}>
      <circle cx={cx} cy={cy} r={10} fill="transparent" />
      {inProgress && <circle cx={cx} cy={cy} r={9} fill="none" stroke={color} strokeWidth={1.5} />}
      <circle cx={cx} cy={cy} r={inProgress ? 5 : 3.5} fill={color} fillOpacity={0.85} />
      {payload.labelIndex != null && (() => {
        // Labels are stacked in score order so they never overlap; a leader line ties each to its dot.
        const ty = cy + 12 * payload.labelIndex - 6;
        return (
          <>
            <line x1={cx - 14} y1={ty - 3} x2={cx - 4} y2={cy} stroke="#6f7686" strokeWidth={0.75} />
            <text x={cx - 16} y={ty} textAnchor="end" fontSize={10} fill="#e9e7de">
              {payload.name.replace(/^University of /, "U. ").replace(/ University$/, "").replace(/-.*Campus$/, "")}
            </text>
          </>
        );
      })()}
    </g>
  );
}

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const s: School = payload[0].payload;
  return (
    <div style={{ background: "#212836", border: "1px solid #313a4a", color: "#e9e7de", borderRadius: 6, padding: "8px 10px", fontSize: 12, maxWidth: 240 }}>
      <div style={{ fontWeight: 600 }}>{s.name}</div>
      <div style={{ color: "#9aa2b1", marginTop: 2 }}>
        {s.country} · {s.status.replace("_", " ")}
      </div>
      <div style={{ marginTop: 4, fontFamily: "monospace" }}>
        score {s.composite_score?.toFixed(1)} · NLP rank #{s.csranking_nlp_rank}
      </div>
      <div style={{ color: s.verified_fit ? VERIFIED : "#9aa2b1", marginTop: 2 }}>
        {s.verified_fit ? "verified fit" : "heuristic only"}
      </div>
      <div style={{ color: "#6f7686", marginTop: 4 }}>Click to open</div>
    </div>
  );
}

export function ScoreRankScatter({ schools }: { schools: School[] }) {
  const router = useRouter();
  const points = schools.filter((s) => s.csranking_nlp_rank != null && s.composite_score != null);

  if (points.length === 0) {
    return (
      <p className="text-xs text-gray-400 border border-dashed border-line rounded p-6 text-center">
        No schools have both a score and a CSRankings rank yet.
      </p>
    );
  }

  const labelIndex = new Map(
    [...points]
      .sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
      .slice(0, LABELED_COUNT)
      .map((s, i) => [s.id, i] as const)
  );
  const data = points.map((s) => ({ ...s, labelIndex: labelIndex.get(s.id) ?? null }));
  const verifiedCount = points.filter((s) => s.verified_fit).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: VERIFIED }} />verified fit ({verifiedCount})</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: HEURISTIC }} />heuristic ({points.length - verifiedCount})</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full border" style={{ borderColor: "#9aa2b1" }} />ringed = application in progress</span>
        <span className="ml-auto">top right = strongest fit and rank</span>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="#313a4a" strokeOpacity={0.4} strokeDasharray="3 3" />
          <XAxis
            type="number" dataKey="csranking_nlp_rank" name="NLP rank" reversed fontSize={11}
            tick={{ fill: "#8b93a3" }} stroke="#313a4a"
            label={{ value: "CSRankings NLP rank (lower number = stronger)", position: "insideBottom", offset: -16, fill: "#8b93a3", fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="composite_score" name="Score" domain={[0, 110]} ticks={[0, 25, 50, 75, 100]} fontSize={11}
            tick={{ fill: "#8b93a3" }} stroke="#313a4a" width={44}
            label={{ value: "Composite score", angle: -90, position: "insideLeft", fill: "#8b93a3", fontSize: 11 }}
          />
          <Tooltip content={<Tip />} cursor={{ strokeDasharray: "3 3", stroke: "#6f7686" }} />
          <Scatter data={data} shape={(p: any) => <Dot {...p} onOpen={(id: string) => router.push(`/schools/${id}`)} />} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
