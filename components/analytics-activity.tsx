"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeekPoint = { week: string; updates: number; wins: number };
type Tiles = {
  schools: number; applying: number; submitted: number;
  replyRate: number | null; replied: number; contacted: number;
  lettersIn: number; lettersTotal: number; avgDays: number | null;
};
type Range = "8" | "12" | "all";

const label = (ymd: string) => new Date(ymd + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const sum = (ws: WeekPoint[]) => ws.reduce((n, w) => n + w.updates + w.wins, 0);

/** The range switch, the headline tiles and the weekly activity chart; the snapshot cards come in as children. */
export function AnalyticsActivity({ weeks, tiles, children }: { weeks: WeekPoint[]; tiles: Tiles; children: React.ReactNode }) {
  const [range, setRange] = useState<Range>("12");
  const n = range === "all" ? weeks.length : Number(range);
  const shown = weeks.slice(-n);
  const before = range === "all" ? null : weeks.slice(-2 * n, -n);
  const now = sum(shown);
  const prev = before && before.length === n ? sum(before) : null;
  const diff = prev == null ? null : now - prev;
  const rangeLabel = range === "all" ? "all time" : `last ${n} weeks`;

  const tileList: Array<{ label: string; value: string; sub: string; tone?: string; subTone?: string }> = [
    { label: "Schools", value: String(tiles.schools), sub: `${tiles.applying} applying · ${tiles.submitted} submitted` },
    {
      label: `Activity, ${rangeLabel}`, value: String(now),
      sub: diff == null ? "notes, updates and wins" : diff === 0 ? "same as the period before" : `${diff > 0 ? "up" : "down"} ${Math.abs(diff)} on the period before`,
      subTone: diff == null || diff === 0 ? undefined : diff > 0 ? "text-emerald-700" : "text-slate-600",
    },
    {
      label: "Outreach reply rate", value: tiles.replyRate == null ? "—" : `${tiles.replyRate}%`,
      sub: tiles.contacted ? `${tiles.replied} of ${tiles.contacted} contacted replied` : "no one contacted yet", tone: tiles.replyRate ? "text-blue-700" : undefined,
    },
    {
      label: "Letters received", value: tiles.lettersTotal ? `${tiles.lettersIn} of ${tiles.lettersTotal}` : "—",
      sub: tiles.avgDays != null ? `about ${tiles.avgDays} days from asking` : tiles.lettersTotal ? "no turnaround recorded yet" : "none requested yet",
      tone: tiles.lettersIn ? "text-emerald-700" : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Range">
          {([["8", "8 weeks"], ["12", "12 weeks"], ["all", "All time"]] as const).map(([k, l], i) => (
            <button
              key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}
              className={`h-8 px-3 text-[13px] ${i > 0 ? "border-l border-slate-300" : ""} ${range === k ? "bg-blue-600 font-semibold text-white" : "bg-white font-medium text-slate-600 hover:text-slate-900"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tileList.map((t) => (
          <div key={t.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
            <p className={`text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
            <p className={`truncate text-xs ${t.subTone ?? "text-slate-500"}`}>{t.sub}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Weekly activity</h2>
          <span className="flex gap-3 text-[11px] text-slate-600">
            <span className="flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-blue-600" />Notes and updates</span>
            <span className="flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-emerald-600" />Wins</span>
          </span>
        </div>
        {now === 0 ? (
          <p className="px-5 py-6 text-[13px] text-slate-500">No activity in this period. Notes, status changes and outreach updates on your schools show up here.</p>
        ) : (
          <div className="h-56 px-2 py-4" role="img" aria-label={`Weekly activity, ${rangeLabel}: ${now} entries`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shown} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="week" tickFormatter={label} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "#F8FAFC" }}
                  labelFormatter={(v) => `Week of ${label(String(v))}`}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="updates" name="Notes and updates" stackId="a" fill="#2563EB" />
                <Bar dataKey="wins" name="Wins" stackId="a" fill="#059669" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </div>
  );
}
