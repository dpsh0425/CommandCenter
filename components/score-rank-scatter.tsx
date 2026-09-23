"use client";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Point = { name: string; csranking_nlp_rank: number | null; composite_score: number | null; verified_fit: boolean };

export function ScoreRankScatter({ schools }: { schools: Point[] }) {
  const data = schools.filter((s) => s.csranking_nlp_rank != null && s.composite_score != null);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart>
        <XAxis type="number" dataKey="csranking_nlp_rank" name="CSRankings NLP rank" fontSize={11} reversed tick={{ fill: "#8b93a3" }} stroke="#313a4a" />
        <YAxis type="number" dataKey="composite_score" name="Composite score" fontSize={11} tick={{ fill: "#8b93a3" }} stroke="#313a4a" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [v, n]} labelFormatter={() => ""} contentStyle={{ background: "#212836", border: "1px solid #313a4a", color: "#e9e7de" }} />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.verified_fit ? "#4f9d8a" : "#c98a3e"} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
