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
  not_started: "#4a5468", researching: "#8b93a3", contacted: "#c98a3e", replied: "#d99456",
  submitted: "#9f93e0", interview: "#5cae97", accepted: "#4f9d8a", rejected: "#d97e78",
};
const COUNTRY_COLOR: Record<string, string> = { USA: "#c98a3e", Canada: "#5cae97", Australia: "#9f93e0" };
const COUNTRIES = ["USA", "Canada", "Australia"];
const AXIS = { fill: "#71717a" };
const GRID = "#27272a";
const tipStyle = {
  background: "#18181b",
  border: "1px solid #27272a",
  color: "#f4f4f5",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
};

type Tab = "fit" | "pipeline" | "scores" | "momentum";
type ColorBy = "fit" | "status" | "country";

const colorOf = (s: AnalyticsSchool, by: ColorBy) =>
  by === "fit" ? (s.verified_fit ? "#5cae97" : "#c98a3e") : by === "status" ? STATUS_COLOR[s.status] : COUNTRY_COLOR[s.country] ?? "#8b93a3";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-center">
      <p className="text-sm text-zinc-400 font-sans">{children}</p>
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
      className={`relative pb-3 text-sm font-medium transition-colors ${
        tab === t ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
      {tab === t && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
      )}
    </button>
  );

  const momentumEmpty = weekly.every((w) => w.tasks === 0 && w.wins === 0);

  return (
    <section className="flex flex-col gap-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-0">
        <div className="flex gap-6">
          {tabBtn("fit", "Fit map")}
          {tabBtn("pipeline", "Pipeline")}
          {tabBtn("scores", "Scores")}
          {tabBtn("momentum", "Momentum")}
        </div>
      </div>

      {/* Unified Toolbar */}
      {tab !== "momentum" && (
        <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-sm">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer text-xs font-medium"
            aria-label="Country"
          >
            <option value="all">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer select-none px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 focus:ring-offset-0"
            />
            Verified fit only
          </label>

          {tab === "fit" && (
            <>
              <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Highlight a school or professor..."
                className="rounded-lg px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 w-56 max-w-full"
              />
              <select
                value={colorBy}
                onChange={(e) => setColorBy(e.target.value as ColorBy)}
                className="rounded-lg px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer text-xs font-medium"
                aria-label="Colour by"
              >
                <option value="fit">Colour by fit</option>
                <option value="status">Colour by status</option>
                <option value="country">Colour by country</option>
              </select>
            </>
          )}

          <span className="ml-auto text-xs text-zinc-500 font-mono">
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
            <div className="flex flex-col gap-3 min-w-0 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/80">
              <ResponsiveContainer width="100%" height={360}>
                <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke={GRID} strokeOpacity={0.6} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="csranking_nlp_rank"
                    reversed
                    fontSize={11}
                    tick={AXIS}
                    stroke={GRID}
                    label={{ value: "CSRankings NLP rank (lower = stronger)", position: "insideBottom", offset: -18, fill: "#a1a1aa", fontSize: 11 }}
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
                    label={{ value: "Composite score", angle: -90, position: "insideLeft", fill: "#a1a1aa", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3", stroke: "#52525b" }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const s: AnalyticsSchool = payload[0].payload;
                      return (
                        <div style={{ ...tipStyle, padding: "10px 12px", maxWidth: 250 }}>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "#f4f4f5" }}>{s.name}</div>
                          <div style={{ color: "#a1a1aa", marginTop: 2 }}>{s.country} · {s.status.replace("_", " ")}</div>
                          <div style={{ fontFamily: "monospace", marginTop: 6, fontSize: "11px", color: "#e4e4e7" }}>
                            score {s.composite_score?.toFixed(1)} · rank #{s.csranking_nlp_rank}
                          </div>
                          <div style={{ color: "#71717a", marginTop: 6, fontSize: "10px" }}>Click point to select</div>
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
                        <g style={{ cursor: "pointer" }} onClick={() => setSelectedId(s.id)} opacity={dim ? 0.15 : 1}>
                          <circle cx={p.cx} cy={p.cy} r={12} fill="transparent" />
                          {(started || isSel) && (
                            <circle cx={p.cx} cy={p.cy} r={9} fill="none" stroke={isSel ? "#f4f4f5" : color} strokeWidth={isSel ? 2 : 1.5} />
                          )}
                          <circle cx={p.cx} cy={p.cy} r={started || isSel ? 5 : 3.5} fill={color} fillOpacity={0.9} />
                        </g>
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-400 pt-2 border-t border-zinc-800/60">
                {colorBy === "fit" && (
                  <>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "#5cae97" }} />verified fit</span>
                    <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "#c98a3e" }} />heuristic</span>
                  </>
                )}
                {colorBy === "status" && STATUSES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{s.replace("_", " ")}</span>
                ))}
                {colorBy === "country" && COUNTRIES.map((c) => (
                  <span key={c} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: COUNTRY_COLOR[c] }} />{c}</span>
                ))}
                <span className="ml-auto text-zinc-500">ringed = in progress · top right = strongest</span>
              </div>
            </div>

            {/* Sidebar Details & Matches */}
            <div className="flex flex-col gap-5 min-w-0">
              {/* Selected Card */}
              {selected ? (
                <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900/80 border-l-4 border-l-amber-500 border border-zinc-800/80 shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-2xl text-zinc-100 leading-tight">{selected.name}</h3>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-800 transition-colors"
                      aria-label="Clear selection"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">{selected.country}</span>
                    <span>·</span>
                    <span className="capitalize">{selected.status.replace("_", " ")}</span>
                    <span>·</span>
                    <span className={selected.verified_fit ? "text-emerald-400" : "text-amber-400"}>
                      {selected.verified_fit ? "Verified Fit" : "Heuristic"}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-zinc-300 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/60">
                    score {selected.composite_score?.toFixed(1) ?? "—"} · NLP rank #{selected.csranking_nlp_rank ?? "?"}
                  </p>
                  {selected.faculty && <p className="text-sm text-zinc-200 font-sans">{selected.faculty}</p>}
                  {selected.fit_note && <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">{selected.fit_note}</p>}
                  <Link
                    href={`/schools/${selected.id}`}
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Open school →
                  </Link>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                  Click a point on the scatter map or a school below to see details here.
                </div>
              )}

              {/* Top Matches Shortlist */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
                <h3 className="font-sans text-sm font-semibold text-zinc-200 mb-3 border-b border-zinc-800 pb-2">
                  Top matches{q ? " for your search" : ""}
                </h3>
                {shortlist.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2">Nothing matches.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-zinc-800/50">
                    {shortlist.map((s, i) => (
                      <li key={s.id}>
                        <button
                          onClick={() => setSelectedId(s.id)}
                          className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left text-sm transition-colors hover:bg-zinc-800/60 ${
                            s.id === selectedId ? "bg-zinc-800/80 text-amber-400 font-medium" : "text-zinc-300"
                          }`}
                        >
                          <span className="font-mono text-xs text-zinc-500 w-4">{i + 1}</span>
                          <i className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorOf(s, colorBy) }} />
                          <span className="flex-1 truncate font-sans">{s.name}</span>
                          <span className="font-mono text-xs text-zinc-400">{s.composite_score?.toFixed(1) ?? "—"}</span>
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
        <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          {started > 0 && (
            <label className="text-xs text-zinc-400 flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showNotStarted}
                onChange={(e) => setShowNotStarted(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-0 focus:ring-offset-0"
              />
              Include “not started” ({filtered.length - started})
            </label>
          )}
          {started === 0 && (
            <p className="text-xs text-zinc-400 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
              No applications started yet — showing where every school currently sits. Move a school to “researching” to see it progress.
            </p>
          )}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pipelineData} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeOpacity={0.6} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" fontSize={11} tick={AXIS} stroke={GRID} interval={0} />
              <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "#ffffff0a" }} />
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
          <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
            Click a bar segment to open that country and stage in the schools list.
          </p>
        </div>
      )}

      {/* Tab: Scores */}
      {tab === "scores" && (
        <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          {filtered.length === 0 ? (
            <Empty>No schools match these filters.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={histogram} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeOpacity={0.6} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  fontSize={11}
                  tick={AXIS}
                  stroke={GRID}
                  label={{ value: "Composite score range", position: "insideBottom", offset: -4, fill: "#a1a1aa", fontSize: 11 }}
                  height={40}
                />
                <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#ffffff0a" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
                <Bar dataKey="verified" name="verified fit" stackId="s" fill="#5cae97" />
                <Bar dataKey="heuristic" name="heuristic" stackId="s" fill="#c98a3e" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
            How scores are distributed. A long low tail means only a few schools are strong fits — focus effort on the right-hand bars.
          </p>
        </div>
      )}

      {/* Tab: Momentum */}
      {tab === "momentum" && (
        <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          {momentumEmpty ? (
            <Empty>Nothing completed in the last 8 weeks yet. Finish a task or move a school to “replied” and it will show up here.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weekly} margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeOpacity={0.6} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" fontSize={11} tick={AXIS} stroke={GRID} />
                <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#ffffff0a" }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: "8px" }} />
                <Bar dataKey="tasks" name="tasks completed" fill="#c98a3e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wins" name="application wins" fill="#5cae97" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-800/60">
            Weeks start on Monday. Wins are replies, submissions, interviews and acceptances.
          </p>
        </div>
      )}
    </section>
  );
}