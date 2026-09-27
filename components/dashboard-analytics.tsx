"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export type AnalyticsSchool = {
  id: string;
  name: string;
  country: string;
  status: string;
  csranking_nlp_rank: number | null;
  composite_score: number | null;
  verified_fit: boolean;
  faculty: string | null;
  fit_note: string | null;
};

export type WeekPoint = { week: string; tasks: number; wins: number };

const STATUSES = [
  "not_started",
  "researching",
  "contacted",
  "replied",
  "submitted",
  "interview",
  "accepted",
  "rejected",
];

const STATUS_COLOR: Record<string, string> = {
  not_started: "#94a3b8",
  researching: "#38bdf8",
  contacted: "#2563eb",
  replied: "#1d4ed8",
  submitted: "#1e3a8a",
  interview: "#d97706",
  accepted: "#059669",
  rejected: "#dc2626",
};

const COUNTRY_COLOR: Record<string, string> = {
  USA: "#2563eb",
  Canada: "#0284c7",
  Australia: "#4f46e5",
};

const COUNTRIES = ["USA", "Canada", "Australia"];
const AXIS_COLOR = "#64748b";
const GRID_COLOR = "#f1f5f9";

const tipStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  color: "#0f172a",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  padding: "10px 12px",
};

type Tab = "fit" | "pipeline" | "scores" | "momentum";
type ColorBy = "fit" | "status" | "country";

interface CustomScatterPointProps {
  cx?: number;
  cy?: number;
  payload?: AnalyticsSchool;
  query?: string;
  selectedId?: string | null;
  colorBy?: ColorBy;
  onSelect?: (id: string) => void;
  [key: string]: any;
}

const colorOf = (s: AnalyticsSchool, by: ColorBy) => {
  if (by === "fit") {
    return s.verified_fit ? "#2563eb" : "#d97706";
  }
  if (by === "status") {
    return STATUS_COLOR[s.status] ?? "#64748b";
  }
  return COUNTRY_COLOR[s.country] ?? "#64748b";
};

const CustomScatterPoint: React.FC<CustomScatterPointProps> = ({
  cx = 0,
  cy = 0,
  payload: s,
  query = "",
  selectedId = null,
  colorBy = "fit",
  onSelect,
}) => {
  if (!s) return <g />;

  const dim = Boolean(query) && !`${s.name} ${s.faculty ?? ""}`.toLowerCase().includes(query);
  const isSel = s.id === selectedId;
  const color = colorOf(s, colorBy);
  const isStarted = s.status !== "not_started";

  return (
    <g
      style={{ cursor: "pointer" }}
      onClick={() => onSelect?.(s.id)}
      opacity={dim ? 0.2 : 1}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelect?.(s.id);
        }
      }}
    >
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      {(isStarted || isSel) && (
        <circle
          cx={cx}
          cy={cy}
          r={9}
          fill="none"
          stroke={isSel ? "#1d4ed8" : color}
          strokeWidth={isSel ? 2 : 1.5}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={isStarted || isSel ? 5 : 3.5}
        fill={color}
        fillOpacity={0.9}
      />
    </g>
  );
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
      <p className="text-xs text-slate-500 font-sans font-medium">{children}</p>
    </div>
  );
}

export function DashboardAnalytics({
  schools,
  weekly,
}: {
  schools: AnalyticsSchool[];
  weekly: WeekPoint[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("fit");
  const [country, setCountry] = useState<string>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [colorBy, setColorBy] = useState<ColorBy>("fit");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNotStarted, setShowNotStarted] = useState(false);

  const filtered = useMemo(
    () =>
      schools.filter(
        (s) =>
          (country === "all" || s.country === country) &&
          (!verifiedOnly || s.verified_fit)
      ),
    [schools, country, verifiedOnly]
  );

  const q = query.trim().toLowerCase();

  const selected = useMemo(
    () => filtered.find((s) => s.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const points = useMemo(
    () =>
      filtered.filter(
        (s) => s.csranking_nlp_rank != null && s.composite_score != null
      ),
    [filtered]
  );

  const shortlist = useMemo(
    () =>
      filtered
        .filter((s) => !q || `${s.name} ${s.faculty ?? ""}`.toLowerCase().includes(q))
        .sort((a, b) => (b.composite_score ?? -1) - (a.composite_score ?? -1))
        .slice(0, 8),
    [filtered, q]
  );

  const started = useMemo(
    () => filtered.filter((s) => s.status !== "not_started").length,
    [filtered]
  );

  const pipelineData = useMemo(() => {
    const stages = showNotStarted || started === 0 ? STATUSES : STATUSES.slice(1);
    return stages.map((st) => {
      const row: Record<string, unknown> = { status: st.replace("_", " "), key: st };
      for (const c of COUNTRIES) {
        row[c] = filtered.filter(
          (s) => s.status === st && s.country === c
        ).length;
      }
      return row;
    });
  }, [filtered, showNotStarted, started]);

  const histogram = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const lo = i * 10;
      const inBucket = filtered.filter(
        (s) =>
          s.composite_score != null &&
          s.composite_score >= lo &&
          (i === 9 ? s.composite_score <= 100 : s.composite_score < lo + 10)
      );
      return {
        bucket: `${lo}-${lo + 10}`,
        verified: inBucket.filter((s) => s.verified_fit).length,
        heuristic: inBucket.filter((s) => !s.verified_fit).length,
      };
    });
  }, [filtered]);

  const momentumEmpty = useMemo(
    () => weekly.every((w) => w.tasks === 0 && w.wins === 0),
    [weekly]
  );

  const renderTabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className={`relative pb-3 text-xs font-semibold transition-colors ${
        tab === t ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
      {tab === t && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
      )}
    </button>
  );

  const renderScatterPoint = useCallback(
    (props: any) => (
      <CustomScatterPoint
        {...props}
        query={q}
        selectedId={selectedId}
        colorBy={colorBy}
        onSelect={setSelectedId}
      />
    ),
    [q, selectedId, colorBy]
  );

  return (
    <section className="flex flex-col gap-4 font-sans text-slate-900">
      {/* Navigation Tabs Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 pt-4 rounded-2xl border shadow-sm">
        <div className="flex gap-8">
          {renderTabBtn("fit", "Fit map")}
          {renderTabBtn("pipeline", "Pipeline")}
          {renderTabBtn("scores", "Scores")}
          {renderTabBtn("momentum", "Momentum")}
        </div>
      </div>

      {/* Filter Toolbar */}
      {tab !== "momentum" && (
        <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 text-xs shadow-sm">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-xl px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer font-medium"
            aria-label="Country"
          >
            <option value="all">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 font-medium text-slate-700 hover:text-slate-900 cursor-pointer select-none px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
            />
            Verified fit only
          </label>

          {tab === "fit" && (
            <>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Highlight school or professor..."
                className="rounded-xl px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 w-56"
              />
              <select
                value={colorBy}
                onChange={(e) => setColorBy(e.target.value as ColorBy)}
                className="rounded-xl px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 cursor-pointer font-medium"
                aria-label="Colour by"
              >
                <option value="fit">Colour by fit</option>
                <option value="status">Colour by status</option>
                <option value="country">Colour by country</option>
              </select>
            </>
          )}

          <span className="ml-auto text-slate-500 font-mono text-xs font-medium">
            {filtered.length} of {schools.length}
          </span>
        </div>
      )}

      {/* Tab: Fit Map */}
      {tab === "fit" && (
        points.length === 0 ? (
          <Empty>No schools match these filters.</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
            <div className="flex flex-col gap-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="csranking_nlp_rank"
                    reversed
                    fontSize={11}
                    tick={{ fill: AXIS_COLOR }}
                    stroke={GRID_COLOR}
                    label={{
                      value: "CSRankings NLP rank (lower = stronger)",
                      position: "insideBottom",
                      offset: -18,
                      fill: AXIS_COLOR,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="composite_score"
                    domain={[0, 105]}
                    ticks={[0, 25, 50, 75, 100]}
                    fontSize={11}
                    tick={{ fill: AXIS_COLOR }}
                    stroke={GRID_COLOR}
                    width={40}
                    label={{
                      value: "Composite score",
                      angle: -90,
                      position: "insideLeft",
                      fill: AXIS_COLOR,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3", stroke: "#cbd5e1" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const s = payload[0]?.payload as AnalyticsSchool | undefined;
                      if (!s) return null;
                      return (
                        <div style={tipStyle}>
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5 capitalize">
                            {s.country} · {s.status.replace("_", " ")}
                          </div>
                          <div className="font-mono text-blue-600 font-bold text-[11px] mt-1.5">
                            score {s.composite_score?.toFixed(1)} · rank #{s.csranking_nlp_rank}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={points} shape={renderScatterPoint} />
                </ScatterChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                {colorBy === "fit" && (
                  <>
                    <span className="flex items-center gap-1.5 font-medium">
                      <i className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      verified fit
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <i className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                      heuristic
                    </span>
                  </>
                )}
                {colorBy === "status" &&
                  STATUSES.map((s) => (
                    <span key={s} className="flex items-center gap-1.5 font-medium">
                      <i className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                      {s.replace("_", " ")}
                    </span>
                  ))}
                {colorBy === "country" &&
                  COUNTRIES.map((c) => (
                    <span key={c} className="flex items-center gap-1.5 font-medium">
                      <i className="w-2.5 h-2.5 rounded-full" style={{ background: COUNTRY_COLOR[c] }} />
                      {c}
                    </span>
                  ))}
                <span className="ml-auto text-slate-400 font-normal">ringed = in progress</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 min-w-0">
              {selected ? (
                <div className="flex flex-col gap-3 p-6 rounded-2xl bg-white border-l-4 border-l-blue-600 border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">{selected.name}</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-[10px]">
                      {selected.country}
                    </span>
                    <span>·</span>
                    <span className="capitalize font-medium">{selected.status.replace("_", " ")}</span>
                    <span>·</span>
                    <span className={`font-semibold ${selected.verified_fit ? "text-blue-600" : "text-amber-600"}`}>
                      {selected.verified_fit ? "Verified Fit" : "Heuristic"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-semibold">
                    score {selected.composite_score?.toFixed(1) ?? "—"} · NLP rank #{selected.csranking_nlp_rank ?? "?"}
                  </p>
                  {selected.faculty && (
                    <p className="text-xs font-medium text-slate-800">{selected.faculty}</p>
                  )}
                  {selected.fit_note && (
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {selected.fit_note}
                    </p>
                  )}
                  <Link
                    href={`/schools/${selected.id}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Open school →
                  </Link>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-white text-center text-xs text-slate-500 font-medium">
                  Click a point on the map to inspect details.
                </div>
              )}

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 pb-2 border-b border-slate-100">
                  Top matches{q ? " for search" : ""}
                </h3>
                {shortlist.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Nothing matches.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-slate-100">
                    {shortlist.map((s, i) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          className={`w-full flex items-center gap-2.5 py-2.5 px-2 rounded-xl text-left text-xs transition-colors hover:bg-slate-50 ${
                            s.id === selectedId
                              ? "bg-blue-50 text-blue-900 font-bold"
                              : "text-slate-700"
                          }`}
                        >
                          <span className="font-mono text-slate-400 font-medium w-4">{i + 1}</span>
                          <i
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: colorOf(s, colorBy) }}
                          />
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="font-mono text-slate-500 font-medium">
                            {s.composite_score?.toFixed(1) ?? "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Tab: Pipeline */}
      {tab === "pipeline" && (
        <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          {started > 0 && (
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showNotStarted}
                onChange={(e) => setShowNotStarted(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
              />
              Include "not started" ({filtered.length - started})
            </label>
          )}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pipelineData} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" fontSize={11} tick={{ fill: AXIS_COLOR }} stroke={GRID_COLOR} interval={0} />
              <YAxis allowDecimals={false} fontSize={11} tick={{ fill: AXIS_COLOR }} stroke={GRID_COLOR} width={32} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "#f8fafc" }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
              {COUNTRIES.map((c) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="a"
                  fill={COUNTRY_COLOR[c]}
                  cursor="pointer"
                  onClick={(entry: any) => {
                    const statusKey = entry?.key ?? entry?.payload?.key;
                    if (statusKey) {
                      router.push(`/schools?status=${statusKey}&country=${c}`);
                    }
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tab: Scores */}
      {tab === "scores" && (
        <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          {filtered.length === 0 ? (
            <Empty>No schools match these filters.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={histogram} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  fontSize={11}
                  tick={{ fill: AXIS_COLOR }}
                  stroke={GRID_COLOR}
                  label={{
                    value: "Composite score range",
                    position: "insideBottom",
                    offset: -4,
                    fill: AXIS_COLOR,
                    fontSize: 11,
                  }}
                  height={40}
                />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: AXIS_COLOR }} stroke={GRID_COLOR} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#f8fafc" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
                <Bar dataKey="verified" name="verified fit" stackId="s" fill="#2563eb" />
                <Bar dataKey="heuristic" name="heuristic" stackId="s" fill="#d97706" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Tab: Momentum */}
      {tab === "momentum" && (
        <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          {momentumEmpty ? (
            <Empty>Nothing completed in the last 8 weeks yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weekly} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" fontSize={11} tick={{ fill: AXIS_COLOR }} stroke={GRID_COLOR} />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: AXIS_COLOR }} stroke={GRID_COLOR} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#f8fafc" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
                <Bar dataKey="tasks" name="tasks completed" fill="#d97706" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wins" name="application wins" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </section>
  );
}