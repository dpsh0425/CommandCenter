"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";

export type AnalyticsSchool = {
  id: string; name: string; country: string; status: string;
  csranking_nlp_rank: number | null; composite_score: number | null; verified_fit: boolean;
  faculty: string | null; fit_note: string | null;
};
export type WeekPoint = { week: string; tasks: number; wins: number };

const STATUSES = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];
const STATUS_COLOR: Record<string, string> = {
  not_started: "#64748B",
  researching: "#0EA5E9",
  contacted: "#2563EB",
  replied: "#0284C7",
  submitted: "#1E3A8A",
  interview: "#D97706",
  accepted: "#059669",
  rejected: "#DC2626",
};
const COUNTRY_COLOR: Record<string, string> = {
  USA: "#2563EB",
  Canada: "#0EA5E9",
  Australia: "#1E3A8A",
};
const COUNTRIES = ["USA", "Canada", "Australia"];
const AXIS = { fill: "#64748B" };
const GRID = "#E2E8F0";
const tipStyle = {
  background: "#FFFFFF",
  border: "1px solid #CBD5E1",
  color: "#0F172A",
  borderRadius: "6px",
  fontSize: "12px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
};

type Tab = "fit" | "pipeline" | "scores" | "momentum";
type ColorBy = "fit" | "status" | "country";

const colorOf = (s: AnalyticsSchool, by: ColorBy) =>
  by === "fit" ? (s.verified_fit ? "#2563EB" : "#D97706") : by === "status" ? STATUS_COLOR[s.status] : COUNTRY_COLOR[s.country] ?? "#64748B";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 rounded-lg border border-slate-200 bg-white text-center shadow-sm">
      <p className="text-sm text-slate-500 font-sans">{children}</p>
    </div>
  );
}

export function DashboardAnalytics({ schools, weekly }: { schools: AnalyticsSchool[]; weekly: WeekPoint[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("fit");
  const [country, setCountry] = useState<string>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [colorBy, setColorBy] = useState<ColorBy>("fit");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNotStarted, setShowNotStarted] = useState(false);

  const filtered = useMemo(
    () => schools.filter((s) => (country === "all" || s.country === country) && (!verifiedOnly || s.verified_fit)),
    [schools, country, verifiedOnly]
  );
  const q = query.trim().toLowerCase();
  const matches = (s: AnalyticsSchool) => !q || `${s.name} ${s.faculty ?? ""}`.toLowerCase().includes(q);
  const selected = filtered.find((s) => s.id === selectedId) ?? null;

  const points = useMemo(
    () => filtered.filter((s) => s.csranking_nlp_rank != null && s.composite_score != null),
    [filtered]
  );
  const shortlist = useMemo(
    () => [...filtered].filter(matches).sort((a, b) => (b.composite_score ?? -1) - (a.composite_score ?? -1)).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, q]
  );

  const started = filtered.filter((s) => s.status !== "not_started").length;
  const pipelineData = useMemo(() => {
    const stages = showNotStarted || started === 0 ? STATUSES : STATUSES.slice(1);
    return stages.map((st) => {
      const row: Record<string, any> = { status: st.replace("_", " "), key: st };
      for (const c of COUNTRIES) row[c] = filtered.filter((s) => s.status === st && s.country === c).length;
      return row;
    });
  }, [filtered, showNotStarted, started]);

  const histogram = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const lo = i * 10;
      const inBucket = filtered.filter((s) => s.composite_score != null && s.composite_score >= lo && (i === 9 ? s.composite_score <= 100 : s.composite_score < lo + 10));
      return {
        bucket: `${lo}-${lo + 10}`,
        verified: inBucket.filter((s) => s.verified_fit).length,
        heuristic: inBucket.filter((s) => !s.verified_fit).length,
      };
    });
  }, [filtered]);

  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className={`relative pb-3 text-sm font-semibold tracking-tight transition-colors ${
        tab === t ? "text-blue-700" : "text-slate-600 hover:text-blue-600"
      }`}
    >
      {label}
      {tab === t && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
      )}
    </button>
  );

  const momentumEmpty = weekly.every((w) => w.tasks === 0 && w.wins === 0);

  return (
    <section className="flex flex-col gap-6 font-sans text-slate-900">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-0 bg-white px-4 pt-3 rounded-t-lg shadow-sm">
        <div className="flex gap-8">
          {tabBtn("fit", "Fit map")}
          {tabBtn("pipeline", "Pipeline")}
          {tabBtn("scores", "Scores")}
          {tabBtn("momentum", "Momentum")}
        </div>
      </div>

      {/* Unified Toolbar */}
      {tab !== "momentum" && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-slate-100/80 border border-slate-200 text-sm shadow-sm">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-md px-3 py-1.5 bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 cursor-pointer text-xs font-medium shadow-sm"
            aria-label="Country"
          >
            <option value="all">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer select-none px-2.5 py-1.5 rounded-md hover:bg-slate-200/60 transition-colors">
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
              <div className="h-4 w-px bg-slate-300 hidden sm:block" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Highlight a school or professor..."
                className="rounded-md px-3 py-1.5 bg-white border border-slate-200 text-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 w-56 max-w-full shadow-sm"
              />
              <select
                value={colorBy}
                onChange={(e) => setColorBy(e.target.value as ColorBy)}
                className="rounded-md px-3 py-1.5 bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 cursor-pointer text-xs font-medium shadow-sm"
                aria-label="Colour by"
              >
                <option value="fit">Colour by fit</option>
                <option value="status">Colour by status</option>
                <option value="country">Colour by country</option>
              </select>
            </>
          )}

          <span className="ml-auto text-xs text-slate-500 font-mono font-medium">
            {filtered.length} of {schools.length}
          </span>
        </div>
      )}

      {/* Tab: Fit Map */}
      {tab === "fit" && (
        points.length === 0 ? (
          <Empty>No schools match these filters.</Empty>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
            {/* Scatter Plot Side */}
            <div className="flex flex-col gap-3 min-w-0 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="csranking_nlp_rank"
                    reversed
                    fontSize={11}
                    tick={AXIS}
                    stroke={GRID}
                    label={{ value: "CSRankings NLP rank (lower = stronger)", position: "insideBottom", offset: -18, fill: "#475569", fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="composite_score"
                    domain={[0, 105]}
                    ticks={[0, 25, 50, 75, 100]}
                    fontSize={11}
                    tick={AXIS}
                    stroke={GRID}
                    width={44}
                    label={{ value: "Composite score", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3", stroke: "#94A3B8" }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const s: AnalyticsSchool = payload[0].payload;
                      return (
                        <div style={{ ...tipStyle, padding: "10px 12px", maxWidth: 250 }}>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "#0F172A" }}>{s.name}</div>
                          <div style={{ color: "#475569", marginTop: 2 }}>{s.country} · {s.status.replace("_", " ")}</div>
                          <div style={{ fontFamily: "monospace", marginTop: 6, fontSize: "11px", color: "#1E3A8A", fontWeight: 600 }}>
                            score {s.composite_score?.toFixed(1)} · rank #{s.csranking_nlp_rank}
                          </div>
                          <div style={{ color: "#64748B", marginTop: 6, fontSize: "10px" }}>Click point to select</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={points}
                    shape={(p: any) => {
                      const s: AnalyticsSchool = p.payload;
                      const dim = !matches(s);
                      const isSel = s.id === selectedId;
                      const color = colorOf(s, colorBy);
                      const started = s.status !== "not_started";
                      return (
                        <g style={{ cursor: "pointer" }} onClick={() => setSelectedId(s.id)} opacity={dim ? 0.2 : 1}>
                          <circle cx={p.cx} cy={p.cy} r={12} fill="transparent" />
                          {(started || isSel) && (
                            <circle cx={p.cx} cy={p.cy} r={9} fill="none" stroke={isSel ? "#0F172A" : color} strokeWidth={isSel ? 2 : 1.5} />
                          )}
                          <circle cx={p.cx} cy={p.cy} r={started || isSel ? 5 : 3.5} fill={color} fillOpacity={0.9} />
                        </g>
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-200">
                {colorBy === "fit" && (
                  <>
                    <span className="flex items-center gap-1.5 font-medium"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "#2563EB" }} />verified fit</span>
                    <span className="flex items-center gap-1.5 font-medium"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "#D97706" }} />heuristic</span>
                  </>
                )}
                {colorBy === "status" && STATUSES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5 font-medium"><i className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{s.replace("_", " ")}</span>
                ))}
                {colorBy === "country" && COUNTRIES.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 font-medium"><i className="w-2.5 h-2.5 rounded-full" style={{ background: COUNTRY_COLOR[c] }} />{c}</span>
                ))}
                <span className="ml-auto text-slate-500 font-normal">ringed = in progress · top right = strongest</span>
              </div>
            </div>

            {/* Sidebar Details & Matches */}
            <div className="flex flex-col gap-5 min-w-0">
              {/* Selected Card */}
              {selected ? (
                <div className="flex flex-col gap-3 p-4 rounded-lg bg-white border-l-4 border-l-blue-600 border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg text-slate-900 leading-tight">{selected.name}</h3>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
                      aria-label="Clear selection"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">{selected.country}</span>
                    <span>·</span>
                    <span className="capitalize font-medium">{selected.status.replace("_", " ")}</span>
                    <span>·</span>
                    <span className={`font-semibold ${selected.verified_fit ? "text-blue-700" : "text-amber-700"}`}>
                      {selected.verified_fit ? "Verified Fit" : "Heuristic"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 font-medium">
                    score {selected.composite_score?.toFixed(1) ?? "—"} · NLP rank #{selected.csranking_nlp_rank ?? "?"}
                  </p>
                  {selected.faculty && <p className="text-xs font-medium text-slate-800 font-sans">{selected.faculty}</p>}
                  {selected.fit_note && <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{selected.fit_note}</p>}
                  <Link
                    href={`/schools/${selected.id}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline transition-colors"
                  >
                    Open school →
                  </Link>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-center text-xs text-slate-500 font-medium">
                  Click a point on the scatter map or a school below to see details here.
                </div>
              )}

              {/* Top Matches Shortlist */}
              <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
                <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 border-b border-slate-200 pb-2">
                  Top matches{q ? " for your search" : ""}
                </h3>
                {shortlist.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Nothing matches.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-slate-100">
                    {shortlist.map((s, i) => (
                      <li key={s.id}>
                        <button
                          onClick={() => setSelectedId(s.id)}
                          className={`w-full flex items-center gap-3 py-2 px-2 rounded-md text-left text-xs transition-colors hover:bg-slate-50 ${
                            s.id === selectedId ? "bg-blue-50/80 text-blue-900 font-semibold" : "text-slate-700"
                          }`}
                        >
                          <span className="font-mono text-slate-400 font-medium w-4">{i + 1}</span>
                          <i className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorOf(s, colorBy) }} />
                          <span className="flex-1 truncate font-sans">{s.name}</span>
                          <span className="font-mono text-slate-500 font-medium">{s.composite_score?.toFixed(1) ?? "—"}</span>
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
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
          {started > 0 && (
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showNotStarted}
                onChange={(e) => setShowNotStarted(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
              />
              Include “not started” ({filtered.length - started})
            </label>
          )}
          {started === 0 && (
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
              No applications started yet — showing where every school currently sits. Move a school to “researching” to see it progress.
            </p>
          )}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pipelineData} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" fontSize={11} tick={AXIS} stroke={GRID} interval={0} />
              <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "#F1F5F9" }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
              {COUNTRIES.map((c) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="a"
                  fill={COUNTRY_COLOR[c]}
                  cursor="pointer"
                  onClick={(d: any) => router.push(`/schools?status=${d.key}&country=${c}`)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
            Click a bar segment to open that country and stage in the schools list.
          </p>
        </div>
      )}

      {/* Tab: Scores */}
      {tab === "scores" && (
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
          {filtered.length === 0 ? (
            <Empty>No schools match these filters.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={histogram} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  fontSize={11}
                  tick={AXIS}
                  stroke={GRID}
                  label={{ value: "Composite score range", position: "insideBottom", offset: -4, fill: "#475569", fontSize: 11 }}
                  height={40}
                />
                <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#F1F5F9" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
                <Bar dataKey="verified" name="verified fit" stackId="s" fill="#2563EB" />
                <Bar dataKey="heuristic" name="heuristic" stackId="s" fill="#D97706" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
            How scores are distributed. A long low tail means only a few schools are strong fits — focus effort on the right-hand bars.
          </p>
        </div>
      )}

      {/* Tab: Momentum */}
      {tab === "momentum" && (
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
          {momentumEmpty ? (
            <Empty>Nothing completed in the last 8 weeks yet. Finish a task or move a school to “replied” and it will show up here.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weekly} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" fontSize={11} tick={AXIS} stroke={GRID} />
                <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#F1F5F9" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
                <Bar dataKey="tasks" name="tasks completed" fill="#D97706" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wins" name="application wins" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
            Weeks start on Monday. Wins are replies, submissions, interviews and acceptances.
          </p>
        </div>
      )}
    </section>
  );
}