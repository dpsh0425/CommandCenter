"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const ORDER = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];

export function StatusFunnelChart({ counts }: { counts: Record<string, number> }) {
  const data = ORDER.map((status) => ({ status: status.replace("_", " "), count: counts[status] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis dataKey="status" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis allowDecimals={false} fontSize={11} />
        <Tooltip />
        <Bar dataKey="count" fill="#2f6f5e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
