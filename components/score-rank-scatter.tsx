"use client";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Point = { name: string; csranking_nlp_rank: number | null; composite_score: number | null; verified_fit: boolean };

export function ScoreRankScatter({ schools }: { schools: Point[] }) {
  const data = schools.filter((s) => s.csranking_nlp_rank != null && s.composite_score != null);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart>
        <XAxis type="number" dataKey="csranking_nlp_rank" name="CSRankings NLP rank" fontSize={11} reversed />
        <YAxis type="number" dataKey="composite_score" name="Composite score" fontSize={11} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [v, n]} labelFormatter={() => ""} />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.verified_fit ? "#2f6f5e" : "#b5651d"} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
