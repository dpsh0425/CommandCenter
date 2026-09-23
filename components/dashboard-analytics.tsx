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
const AXIS = { fill: "#8b93a3" };
const GRID = "#313a4a";
const tipStyle = { background: "#212836", border: "1px solid #313a4a", color: "#e9e7de", borderRadius: 6, fontSize: 12 };

type Tab = "fit" | "pipeline" | "scores" | "momentum";
type ColorBy = "fit" | "status" | "country";

const colorOf = (s: AnalyticsSchool, by: ColorBy) =>
  by === "fit" ? (s.verified_fit ? "#5cae97" : "#c98a3e") : by === "status" ? STATUS_COLOR[s.status] : COUNTRY_COLOR[s.country] ?? "#8b93a3";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border ${active ? "bg-brass text-ink font-medium border-brass" : "hover:border-brass"}`}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 border border-dashed border-line rounded p-8 text-center">{children}</p>;
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
      className={`flex-1 py-1.5 text-sm rounded ${tab === t ? "bg-surface-raised text-cream font-medium" : "text-gray-500 hover:text-cream"}`}
    >
      {label}
    </button>
  );

  const momentumEmpty = weekly.every((w) => w.tasks === 0 && w.wins === 0);

  return (
    <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-4">
      <div className="flex gap-1 border border-line rounded p-1">
        {tabBtn("fit", "Fit map")}
        {tabBtn("pipeline", "Pipeline")}
        {tabBtn("scores", "Scores")}
        {tabBtn("momentum", "Momentum")}
      </div>

      {tab !== "momentum" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Chip active={country === "all"} onClick={() => setCountry("all")}>All countries</Chip>
            {COUNTRIES.map((c) => <Chip key={c} active={country === c} onClick={() => setCountry(c)}>{c}</Chip>)}
            <span className="w-px h-4 bg-line" />
            <Chip active={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)}>Verified fit only</Chip>
            <span className="ml-auto text-xs text-gray-500 font-mono">{filtered.length} of {schools.length} schools</span>
          </div>
          {tab === "fit" && (
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Highlight a school or faculty…"
                className="border rounded px-2 py-1 text-xs w-56"
              />
              <span className="text-xs text-gray-500 ml-1">Colour by</span>
              {(["fit", "status", "country"] as ColorBy[]).map((c) => (
                <Chip key={c} active={colorBy === c} onClick={() => setColorBy(c)}>{c}</Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "fit" && (
        points.length === 0 ? (
          <Empty>No schools match these filters.</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-2 min-w-0">
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 10, right: 16, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke={GRID} strokeOpacity={0.4} strokeDasharray="3 3" />
                  <XAxis
                    type="number" dataKey="csranking_nlp_rank" reversed fontSize={11} tick={AXIS} stroke={GRID}
                    label={{ value: "CSRankings NLP rank (lower = stronger)", position: "insideBottom", offset: -16, fill: "#8b93a3", fontSize: 11 }}
                  />
                  <YAxis
                    type="number" dataKey="composite_score" domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} fontSize={11}
                    tick={AXIS} stroke={GRID} width={44}
                    label={{ value: "Composite score", angle: -90, position: "insideLeft", fill: "#8b93a3", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3", stroke: "#6f7686" }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const s: AnalyticsSchool = payload[0].payload;
                      return (
                        <div style={{ ...tipStyle, padding: "8px 10px", maxWidth: 240 }}>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ color: "#9aa2b1" }}>{s.country} · {s.status.replace("_", " ")}</div>
                          <div style={{ fontFamily: "monospace", marginTop: 4 }}>score {s.composite_score?.toFixed(1)} · rank #{s.csranking_nlp_rank}</div>
                          <div style={{ color: "#6f7686", marginTop: 4 }}>Click for details</div>
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
                          <circle cx={p.cx} cy={p.cy} r={11} fill="transparent" />
                          {(started || isSel) && <circle cx={p.cx} cy={p.cy} r={9} fill="none" stroke={isSel ? "#e9e7de" : color} strokeWidth={isSel ? 2 : 1.5} />}
                          <circle cx={p.cx} cy={p.cy} r={started || isSel ? 5 : 3.5} fill={color} fillOpacity={0.9} />
                        </g>
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {colorBy === "fit" && <>
                  <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "#5cae97" }} />verified fit</span>
                  <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: "#c98a3e" }} />heuristic</span>
                </>}
                {colorBy === "status" && STATUSES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{s.replace("_", " ")}</span>
                ))}
                {colorBy === "country" && COUNTRIES.map((c) => (
                  <span key={c} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: COUNTRY_COLOR[c] }} />{c}</span>
                ))}
                <span className="ml-auto">ringed = in progress · top right = strongest</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-0">
              {selected ? (
                <div className="border border-brass rounded-lg p-3 flex flex-col gap-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{selected.name}</div>
                    <button onClick={() => setSelectedId(null)} className="text-xs text-gray-500 hover:text-cream" aria-label="Clear selection">✕</button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {selected.country} · {selected.status.replace("_", " ")} · {selected.verified_fit ? "verified fit" : "heuristic"}
                  </div>
                  <div className="font-mono text-xs">score {selected.composite_score?.toFixed(1) ?? "—"} · NLP rank #{selected.csranking_nlp_rank ?? "?"}</div>
                  {selected.faculty && <div className="text-xs"><strong>{selected.faculty}</strong></div>}
                  {selected.fit_note && <p className="text-xs text-gray-500 line-clamp-4">{selected.fit_note}</p>}
                  <Link href={`/schools/${selected.id}`} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-xs self-start">Open school →</Link>
                </div>
              ) : (
                <div className="text-xs text-gray-400 border border-dashed border-line rounded-lg p-3">Click a point or a row to see details here.</div>
              )}
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">Top matches{q ? " for your search" : ""}</div>
                {shortlist.length === 0 ? (
                  <p className="text-xs text-gray-400">Nothing matches.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-line">
                    {shortlist.map((s, i) => (
                      <li key={s.id}>
                        <button
                          onClick={() => setSelectedId(s.id)}
                          className={`w-full flex items-center gap-2 py-1.5 text-left text-xs hover:text-brass ${s.id === selectedId ? "text-brass" : ""}`}
                        >
                          <span className="font-mono text-gray-400 w-4">{i + 1}</span>
                          <i className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorOf(s, colorBy) }} />
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="font-mono text-gray-500">{s.composite_score?.toFixed(1) ?? "—"}</span>
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

      {tab === "pipeline" && (
        <div className="flex flex-col gap-3">
          {started > 0 && (
            <label className="text-xs text-gray-500 flex items-center gap-2 self-start">
              <input type="checkbox" checked={showNotStarted} onChange={(e) => setShowNotStarted(e.target.checked)} />
              Include “not started” ({filtered.length - started})
            </label>
          )}
          {started === 0 && <p className="text-xs text-gray-500">No applications started yet — showing where every school currently sits. Move a school to “researching” to see it progress.</p>}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeOpacity={0.4} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" fontSize={11} tick={AXIS} stroke={GRID} interval={0} />
              <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "#ffffff10" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {COUNTRIES.map((c) => (
                <Bar
                  key={c} dataKey={c} stackId="a" fill={COUNTRY_COLOR[c]} cursor="pointer"
                  onClick={(d: any) => router.push(`/schools?status=${d.key}&country=${c}`)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400">Click a bar segment to open that country and stage in the schools list.</p>
        </div>
      )}

      {tab === "scores" && (
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? <Empty>No schools match these filters.</Empty> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={histogram} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeOpacity={0.4} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" fontSize={11} tick={AXIS} stroke={GRID}
                  label={{ value: "Composite score range", position: "insideBottom", offset: -4, fill: "#8b93a3", fontSize: 11 }} height={40} />
                <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#ffffff10" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="verified" name="verified fit" stackId="s" fill="#5cae97" />
                <Bar dataKey="heuristic" name="heuristic" stackId="s" fill="#c98a3e" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-gray-400">How scores are distributed. A long low tail means only a few schools are strong fits — focus effort on the right-hand bars.</p>
        </div>
      )}

      {tab === "momentum" && (
        <div className="flex flex-col gap-3">
          {momentumEmpty ? (
            <Empty>Nothing completed in the last 8 weeks yet. Finish a task or move a school to “replied” and it will show up here.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weekly} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeOpacity={0.4} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" fontSize={11} tick={AXIS} stroke={GRID} />
                <YAxis allowDecimals={false} fontSize={11} tick={AXIS} stroke={GRID} width={32} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: "#ffffff10" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="tasks" name="tasks completed" fill="#c98a3e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="wins" name="application wins" fill="#5cae97" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-gray-400">Weeks start on Monday. Wins are replies, submissions, interviews and acceptances.</p>
        </div>
      )}
    </section>
  );
}
