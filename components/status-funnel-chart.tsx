"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const ORDER = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];

export function StatusFunnelChart({ counts }: { counts: Record<string, number> }) {
  const data = ORDER.map((status) => ({ status: status.replace("_", " "), count: counts[status] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis dataKey="status" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} tick={{ fill: "#8b93a3" }} stroke="#313a4a" />
        <YAxis allowDecimals={false} fontSize={11} tick={{ fill: "#8b93a3" }} stroke="#313a4a" />
        <Tooltip contentStyle={{ background: "#212836", border: "1px solid #313a4a", color: "#e9e7de" }} />
        <Bar dataKey="count" fill="#c98a3e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
