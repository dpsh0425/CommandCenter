"use client";

import React, { useState, useMemo } from "react";

export type AnalyticsSchool = {
  id: string;
  name: string;
  program?: string;
  country?: "US" | "UK" | "Canada" | "EU" | string;
  status?: "Shortlisted" | "In Progress" | "Submitted" | "Interview" | string;
  fitScore?: number;
  deadlineDays?: number;
  verifiedFit?: boolean;
  professor?: string;
  csranking_nlp_rank?: number | null;
  [key: string]: any;
};

export interface DashboardAnalyticsProps {
  schools?: AnalyticsSchool[];
  initialSchools?: AnalyticsSchool[];
  weekly?: { week: string; tasks: number; wins: number }[];
  onSelectSchool?: (school: AnalyticsSchool) => void;
  [key: string]: any;
}

const DEFAULT_SCHOOLS: AnalyticsSchool[] = [
  { id: "1", name: "MIT", program: "Ph.D. CS", country: "US", status: "In Progress", fitScore: 92, deadlineDays: 85, verifiedFit: true, professor: "Dr. Leiserson" },
  { id: "2", name: "Stanford", program: "Ph.D. AI", country: "US", status: "Shortlisted", fitScore: 88, deadlineDays: 70, verifiedFit: true, professor: "Dr. Ng" },
  { id: "3", name: "CMU", program: "M.S. Robotics", country: "US", status: "Submitted", fitScore: 84, deadlineDays: 90, verifiedFit: false, professor: "Dr. Hebert" },
  { id: "4", name: "Oxford", program: "DPhil CS", country: "UK", status: "Interview", fitScore: 95, deadlineDays: 95, verifiedFit: true, professor: "Dr. Wooldridge" },
  { id: "5", name: "Cambridge", program: "MPhil ACS", country: "UK", status: "Shortlisted", fitScore: 78, deadlineDays: 40, verifiedFit: false, professor: "Dr. Jamnik" },
  { id: "6", name: "ETH Zurich", program: "M.Sc. CS", country: "EU", status: "In Progress", fitScore: 81, deadlineDays: 60, verifiedFit: true, professor: "Dr. Vechev" },
  { id: "7", name: "UToronto", program: "Ph.D. ML", country: "Canada", status: "Submitted", fitScore: 86, deadlineDays: 75, verifiedFit: true, professor: "Dr. Hinton" },
  { id: "8", name: "UC Berkeley", program: "Ph.D. EECS", country: "US", status: "Shortlisted", fitScore: 90, deadlineDays: 80, verifiedFit: true, professor: "Dr. Jordan" },
  { id: "9", name: "Imperial", program: "MSc AI", country: "UK", status: "In Progress", fitScore: 72, deadlineDays: 50, verifiedFit: false, professor: "Dr. Shanahan" },
  { id: "10", name: "UBC", program: "M.Sc. CS", country: "Canada", status: "Shortlisted", fitScore: 68, deadlineDays: 35, verifiedFit: false, professor: "Dr. Carenini" },
];

const DEFAULT_WEEKLY = [
  { week: "W1", tasks: 12, wins: 4 },
  { week: "W2", tasks: 18, wins: 7 },
  { week: "W3", tasks: 15, wins: 5 },
  { week: "W4", tasks: 22, wins: 9 },
  { week: "W5", tasks: 28, wins: 12 },
];

const STATUS_COLORS: Record<string, { fill: string; stroke: string; badge: string }> = {
  Shortlisted: { fill: "bg-blue-600", stroke: "stroke-blue-600 border-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  "In Progress": { fill: "bg-sky-500", stroke: "stroke-sky-500 border-sky-500", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  Submitted: { fill: "bg-emerald-600", stroke: "stroke-emerald-600 border-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Interview: { fill: "bg-amber-500", stroke: "stroke-amber-500 border-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

const DEFAULT_COLOR = { fill: "bg-slate-600", stroke: "stroke-slate-600 border-slate-600", badge: "bg-slate-100 text-slate-700 border-slate-200" };

export function DashboardAnalytics({
  schools,
  initialSchools,
  weekly = DEFAULT_WEEKLY,
  onSelectSchool,
}: DashboardAnalyticsProps) {
  const activeSchools = schools || initialSchools || DEFAULT_SCHOOLS;

  const [selectedTab, setSelectedTab] = useState<"Fit map" | "Pipeline" | "Scores" | "Momentum">("Fit map");
  const [selectedCountry, setSelectedCountry] = useState<string>("All");
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredSchool, setHoveredSchool] = useState<AnalyticsSchool | null>(null);

  // Filter logic
  const filteredSchools = useMemo(() => {
    return activeSchools.filter((s) => {
      if (selectedCountry !== "All" && s.country !== selectedCountry) return false;
      if (verifiedOnly && !s.verifiedFit) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        return (
          s.name?.toLowerCase().includes(q) ||
          s.professor?.toLowerCase().includes(q) ||
          s.program?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeSchools, selectedCountry, verifiedOnly, searchQuery]);

  // Metric counts
  const shortlistedCount = activeSchools.filter((s) => s.status === "Shortlisted").length;
  const inProgressCount = activeSchools.filter((s) => s.status === "In Progress").length;
  const interviewCount = activeSchools.filter((s) => s.status === "Interview").length;
  const avgFit = useMemo(() => {
    if (!activeSchools.length) return "0.0";
    const sum = activeSchools.reduce((acc, curr) => acc + (curr.fitScore || 0), 0);
    return (sum / activeSchools.length).toFixed(1);
  }, [activeSchools]);

  return (
    <div className="space-y-6 font-sans antialiased text-slate-900 bg-white p-2">
      {/* Metrics Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "SHORTLISTED", value: shortlistedCount, sub: "schools tracked", accent: "border-blue-600 text-blue-600" },
          { label: "IN PROGRESS", value: inProgressCount, sub: "active applications", accent: "border-sky-500 text-sky-600" },
          { label: "INTERVIEWS", value: interviewCount, sub: "scheduled invites", accent: "border-amber-500 text-amber-600" },
          { label: "AVG SCORE", value: `${avgFit}%`, sub: "composite alignment", accent: "border-emerald-600 text-emerald-600" },
        ].map((m) => (
          <div key={m.label} className={`bg-white rounded-xl p-5 border border-slate-200 shadow-sm border-l-4 ${m.accent}`}>
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{m.label}</span>
            <div className="font-mono text-3xl font-extrabold text-slate-900 mt-2 mb-1 tracking-tight">{m.value}</div>
            <p className="text-xs text-slate-400">{m.sub}</p>
          </div>
        ))}
      </section>

      {/* Mode Segmented Tab Selector */}
      <div className="flex p-1 bg-slate-100/80 rounded-lg border border-slate-200 max-w-md">
        {(["Fit map", "Pipeline", "Scores", "Momentum"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-200 ${
              selectedTab === tab
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Control Search Bar */}
      <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all shadow-sm"
          >
            <option value="All">All countries</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="EU">Europe</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg hover:border-slate-400 transition-all shadow-sm">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            Verified fit only
          </label>

          <input
            type="text"
            placeholder="Highlight school or professor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all shadow-sm w-full sm:w-64"
          />
        </div>

        <div className="font-mono text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-900">{filteredSchools.length}</span> of {activeSchools.length}
        </div>
      </section>

      {/* FIT MAP TAB */}
      {selectedTab === "Fit map" && (
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Program Fit vs. Timeline Readiness</h3>
              <p className="text-xs text-slate-500">Hover over any point to inspect school telemetry</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
              {Object.entries(STATUS_COLORS).map(([status, style]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${style.fill}`} />
                  <span>{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative h-80 w-full bg-slate-50/80 rounded-lg border border-slate-200 p-4 pt-6 overflow-hidden">
            <div className="absolute inset-x-12 top-6 bottom-10 flex flex-col justify-between pointer-events-none">
              {[100, 75, 50, 25, 0].map((val) => (
                <div key={val} className="w-full border-b border-slate-200 relative">
                  <span className="absolute -left-10 -top-2.5 font-mono text-[10px] text-slate-400">{val}%</span>
                </div>
              ))}
            </div>

            <div className="absolute inset-x-12 top-6 bottom-10">
              {filteredSchools.map((school) => {
                const leftPercent = Math.min(Math.max(school.deadlineDays ?? 50, 0), 100);
                const bottomPercent = Math.min(Math.max(school.fitScore ?? 50, 0), 100);
                const colors = STATUS_COLORS[school.status || ""] || DEFAULT_COLOR;

                return (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => onSelectSchool?.(school)}
                    onMouseEnter={() => setHoveredSchool(school)}
                    onMouseLeave={() => setHoveredSchool(null)}
                    style={{ left: `${leftPercent}%`, bottom: `${bottomPercent}%` }}
                    className="absolute -translate-x-1/2 translate-y-1/2 p-1.5 group transition-transform duration-150 hover:scale-125 focus:outline-none z-10"
                  >
                    <span className={`relative block h-4 w-4 rounded-full border-2 bg-white shadow-sm transition-all ${colors.stroke}`}>
                      <span className={`absolute inset-0.5 rounded-full ${colors.fill}`} />
                    </span>
                  </button>
                );
              })}
            </div>

            {hoveredSchool && (
              <div
                style={{
                  left: `${Math.min(Math.max(hoveredSchool.deadlineDays ?? 50, 0), 100)}%`,
                  bottom: `${Math.min(Math.max(hoveredSchool.fitScore ?? 50, 0), 100)}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-14 z-20 pointer-events-none transition-all duration-150"
              >
                <div className="bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-xs shadow-xl min-w-[160px] border border-slate-800">
                  <div className="font-bold flex items-center justify-between gap-2">
                    <span>{hoveredSchool.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{hoveredSchool.country}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">{hoveredSchool.program}</div>
                  <div className="text-[10px] text-slate-400 mt-1 flex justify-between border-t border-slate-800 pt-1 font-mono">
                    <span>Prof. {hoveredSchool.professor || "N/A"}</span>
                    <span className="text-emerald-400 font-bold">{hoveredSchool.fitScore}% Fit</span>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute inset-x-12 bottom-2 flex justify-between text-[10px] font-mono text-slate-400 pointer-events-none">
              <span>0 Days Left (Urgent)</span>
              <span>Timeline Readiness / Days Remaining</span>
              <span>100+ Days Left</span>
            </div>
          </div>
        </section>
      )}

      {/* PIPELINE TAB */}
      {selectedTab === "Pipeline" && (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {(["Shortlisted", "In Progress", "Submitted", "Interview"] as const).map((stage) => {
            const stageSchools = filteredSchools.filter((s) => s.status === stage);
            const style = STATUS_COLORS[stage] || DEFAULT_COLOR;
            return (
              <div key={stage} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${style.fill}`} />
                      <span className="text-xs font-extrabold text-slate-900 tracking-tight">{stage}</span>
                    </div>
                    <span className="text-[11px] font-mono bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                      {stageSchools.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {stageSchools.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => onSelectSchool?.(s)}
                        className="p-3 bg-slate-50 hover:bg-blue-50/50 rounded-lg border border-slate-200 cursor-pointer transition-all shadow-sm"
                      >
                        <div className="font-bold text-xs text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{s.program}</div>
                        <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-400">
                          <span>{s.country}</span>
                          <span className="text-emerald-600 font-bold">{s.fitScore}% Fit</span>
                        </div>
                      </div>
                    ))}
                    {stageSchools.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-400 italic">No schools in stage</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* SCORES TAB */}
      {selectedTab === "Scores" && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 min-w-[600px]">
            <thead className="bg-slate-50/80 border-b border-slate-200 font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">School</th>
                <th className="p-4">Program</th>
                <th className="p-4">Country</th>
                <th className="p-4">Status</th>
                <th className="p-4">Professor</th>
                <th className="p-4 text-right">Fit Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map((s) => {
                const badge = STATUS_COLORS[s.status || ""]?.badge || DEFAULT_COLOR.badge;
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelectSchool?.(s)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="p-4 font-bold text-slate-900">{s.name}</td>
                    <td className="p-4 text-slate-600">{s.program || "N/A"}</td>
                    <td className="p-4 font-mono text-slate-500">{s.country || "N/A"}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border ${badge}`}>
                        {s.status || "Unknown"}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{s.professor || "N/A"}</td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-600">{s.fitScore ?? 0}%</td>
                  </tr>
                );
              })}
              {filteredSchools.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs text-slate-400 italic">
                    No schools match the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* MOMENTUM TAB */}
      {selectedTab === "Momentum" && (
        <section className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-1">Weekly Execution Velocity</h3>
          <p className="text-xs text-slate-500 mb-6">Completed tasks and key application milestones over time</p>
          <div className="grid grid-cols-5 gap-3 h-48 items-end border-b border-slate-200 pb-2">
            {weekly.map((item) => (
              <div key={item.week} className="flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1.5 h-full">
                  <div
                    style={{ height: `${Math.min(100, (item.tasks / 30) * 100)}%` }}
                    className="w-1/3 bg-blue-600 rounded-t-sm transition-all hover:bg-blue-700"
                    title={`Tasks: ${item.tasks}`}
                  />
                  <div
                    style={{ height: `${Math.min(100, (item.wins / 30) * 100)}%` }}
                    className="w-1/3 bg-emerald-600 rounded-t-sm transition-all hover:bg-emerald-700"
                    title={`Wins: ${item.wins}`}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-500 font-medium">{item.week}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-600 font-semibold">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 bg-blue-600 rounded-sm" />
              <span>Completed Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 bg-emerald-600 rounded-sm" />
              <span>Milestone Wins</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default DashboardAnalytics;