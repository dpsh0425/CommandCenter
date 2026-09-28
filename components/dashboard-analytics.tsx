"use client";

import { useState } from "react";

// Re-export type expected by parent components to fix CI build error
export type AnalyticsSchool = {
  id: string;
  name: string;
  program: string;
  country: "US" | "UK" | "Canada" | "EU" | string;
  status: "Shortlisted" | "In Progress" | "Submitted" | "Interview" | string;
  fitScore: number;
  deadlineDays: number;
  verifiedFit: boolean;
  professor: string;
  csranking_nlp_rank?: number | null;
};

export interface DashboardAnalyticsProps {
  initialSchools?: AnalyticsSchool[];
  onSelectSchool?: (school: AnalyticsSchool) => void;
}

const DEFAULT_MOCK_SCHOOLS: AnalyticsSchool[] = [
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
  { id: "11", name: "Harvard", program: "Ph.D. CS", country: "US", status: "Shortlisted", fitScore: 83, deadlineDays: 65, verifiedFit: true, professor: "Dr. Waldo" },
  { id: "12", name: "EPFL", program: "M.Sc. CS", country: "EU", status: "In Progress", fitScore: 76, deadlineDays: 55, verifiedFit: true, professor: "Dr. Odersky" },
  { id: "13", name: "UW Seattle", program: "Ph.D. CS", country: "US", status: "Submitted", fitScore: 89, deadlineDays: 82, verifiedFit: true, professor: "Dr. Fox" },
  { id: "14", name: "NYU", program: "M.S. Data Science", country: "US", status: "Shortlisted", fitScore: 75, deadlineDays: 45, verifiedFit: false, professor: "Dr. LeCun" },
];

const STATUS_COLORS: Record<string, { fill: string; stroke: string; badge: string }> = {
  Shortlisted: { fill: "bg-blue-500", stroke: "stroke-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  "In Progress": { fill: "bg-sky-400", stroke: "stroke-sky-400", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  Submitted: { fill: "bg-emerald-500", stroke: "stroke-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Interview: { fill: "bg-amber-500", stroke: "stroke-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function DashboardAnalytics({ initialSchools = DEFAULT_MOCK_SCHOOLS, onSelectSchool }: DashboardAnalyticsProps) {
  const [selectedTab, setSelectedTab] = useState<"Fit map" | "Pipeline" | "Scores" | "Momentum">("Fit map");
  const [selectedCountry, setSelectedCountry] = useState<string>("All");
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredSchool, setHoveredSchool] = useState<AnalyticsSchool | null>(null);

  // Filter logic
  const filteredSchools = initialSchools.filter((s) => {
    if (selectedCountry !== "All" && s.country !== selectedCountry) return false;
    if (verifiedOnly && !s.verifiedFit) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.professor.toLowerCase().includes(q) ||
        s.program.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Metric Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "SHORTLISTED", value: "14", sub: "schools tracked", color: "border-blue-500" },
          { label: "IN PROGRESS", value: "8", sub: "active applications", color: "border-sky-400" },
          { label: "INTERVIEWS", value: "1", sub: "scheduled invite", color: "border-amber-500" },
          { label: "AVG SCORE", value: "77.9", sub: "composite alignment", color: "border-emerald-500" },
        ].map((m) => (
          <div key={m.label} className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm border-l-4 ${m.color}`}>
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{m.label}</span>
            <div className="font-mono text-3xl font-semibold text-slate-900 mt-2 mb-1">{m.value}</div>
            <p className="text-xs text-slate-400">{m.sub}</p>
          </div>
        ))}
      </section>

      {/* Tab Selection */}
      <div className="flex border-b border-slate-200 gap-8">
        {(["Fit map", "Pipeline", "Scores", "Momentum"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`pb-3 text-xs font-semibold transition-all border-b-2 ${
              selectedTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters & Control Bar */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All countries</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="EU">Europe</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Verified fit only
          </label>

          <input
            type="text"
            placeholder="Highlight school or professor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-60"
          />
        </div>

        <div className="font-mono text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-900">{filteredSchools.length}</span> of {initialSchools.length}
        </div>
      </section>

      {/* Interactive Fit Map Scatter Chart */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Program Fit vs. Timeline Readiness</h3>
            <p className="text-xs text-slate-500">Hover over any data point to inspect details</p>
          </div>
          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
            {Object.entries(STATUS_COLORS).map(([status, style]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${style.fill}`} />
                <span>{status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scatter Canvas */}
        <div className="relative h-80 w-full bg-slate-50/50 rounded-xl border border-slate-100 p-4 pt-6">
          {/* Gridlines */}
          <div className="absolute inset-x-12 top-6 bottom-10 flex flex-col justify-between pointer-events-none">
            {[100, 75, 50, 25, 0].map((val) => (
              <div key={val} className="w-full border-b border-slate-200/60 relative">
                <span className="absolute -left-10 -top-2.5 font-mono text-[10px] text-slate-400">{val}%</span>
              </div>
            ))}
          </div>

          {/* Scatter Plot Points */}
          <div className="absolute inset-x-12 top-6 bottom-10">
            {filteredSchools.map((school) => {
              const leftPercent = Math.min(Math.max(school.deadlineDays, 0), 100);
              const bottomPercent = Math.min(Math.max(school.fitScore, 0), 100);
              const colors = STATUS_COLORS[school.status] || STATUS_COLORS["Shortlisted"];

              return (
                <button
                  key={school.id}
                  onClick={() => onSelectSchool?.(school)}
                  onMouseEnter={() => setHoveredSchool(school)}
                  onMouseLeave={() => setHoveredSchool(null)}
                  style={{ left: `${leftPercent}%`, bottom: `${bottomPercent}%` }}
                  className="absolute -translate-x-1/2 translate-y-1/2 p-1.5 group transition-transform duration-150 hover:scale-125 focus:outline-none"
                >
                  <span className={`relative block h-4 w-4 rounded-full border-2 bg-white shadow-sm transition-all ${colors.stroke}`}>
                    <span className={`absolute inset-1 rounded-full ${colors.fill}`} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hover Tooltip */}
          {hoveredSchool && (
            <div
              style={{
                left: `${Math.min(Math.max(hoveredSchool.deadlineDays, 0), 100)}%`,
                bottom: `${Math.min(Math.max(hoveredSchool.fitScore, 0), 100)}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-12 z-20 pointer-events-none transition-all duration-150"
            >
              <div className="bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl min-w-[160px] border border-slate-700">
                <div className="font-semibold flex items-center justify-between gap-2">
                  <span>{hoveredSchool.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">{hoveredSchool.country}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">{hoveredSchool.program}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between border-t border-slate-800 pt-1">
                  <span>Prof. {hoveredSchool.professor}</span>
                  <span className="font-mono text-emerald-400">{hoveredSchool.fitScore}% Fit</span>
                </div>
              </div>
            </div>
          )}

          {/* X Axis Label */}
          <div className="absolute inset-x-12 bottom-2 flex justify-between text-[10px] font-mono text-slate-400 pointer-events-none">
            <span>0 Days Left (Urgent)</span>
            <span>Timeline Readiness / Days Remaining</span>
            <span>100+ Days Left</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardAnalytics;