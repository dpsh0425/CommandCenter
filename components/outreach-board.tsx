"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { setProfessorOutreach, type OutreachStatus } from "@/app/(app)/schools/[id]/faculty-actions";

export type OutreachProf = {
  id: string; name: string; title: string | null; school_id: string; school_name: string; department: string | null;
  research_areas: string[]; accepting: "unknown" | "yes" | "no"; fit_score: number | null; outreach: OutreachStatus;
  last_contacted_on: string | null; homepage_url: string | null; email: string | null;
};

const STATUS_OPTIONS: Array<{ key: OutreachStatus; label: string }> = [
  { key: "not_contacted", label: "Not contacted" }, { key: "contacted", label: "Contacted" }, { key: "replied", label: "Replied" },
  { key: "meeting", label: "Meeting" }, { key: "no_response", label: "No response" }, { key: "declined", label: "Declined" },
];

// Grouped by what you need to do next, not by database status.
const GROUPS: Array<{ key: string; title: string; hint: string; statuses: OutreachStatus[]; limit?: number; folded?: boolean }> = [
  { key: "talking", title: "In conversation", hint: "They replied or a meeting is booked", statuses: ["replied", "meeting"] },
  { key: "waiting", title: "Waiting on a reply", hint: "Follow up after about 10 days", statuses: ["contacted", "no_response"] },
  { key: "todo", title: "To contact", hint: "Best fit first", statuses: ["not_contacted"], limit: 10 },
  { key: "closed", title: "Closed", hint: "Declined", statuses: ["declined"], folded: true },
];

const daysSince = (d: string) => Math.floor((Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000);

function Row({ p }: { p: OutreachProf }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stale = (p.outreach === "contacted" || p.outreach === "no_response") && p.last_contacted_on != null && daysSince(p.last_contacted_on) >= 10;

  return (
    <li className={`py-3 border-b border-line/60 last:border-0 flex flex-col gap-1 md:flex-row md:items-center md:gap-6 ${pending ? "opacity-50" : ""}`}>
      <div className="md:w-72 min-w-0 flex-shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium truncate">{p.name}</span>
          {p.fit_score != null && <span className="text-brass text-xs font-mono flex-shrink-0" aria-label={`Fit ${p.fit_score} of 5`}>{"●".repeat(p.fit_score)}</span>}
        </div>
        <Link href={`/schools/${p.school_id}?tab=faculty`} className="text-xs text-gray-500 hover:text-brass truncate block">{p.school_name}</Link>
      </div>

      <div className="flex-1 min-w-0 text-sm text-gray-500 line-clamp-2 md:truncate">
        {p.research_areas.length > 0 ? p.research_areas.slice(0, 3).join(" · ") : <span className="text-gray-400">No research areas yet</span>}
        {p.accepting !== "unknown" && <span className={`ml-3 text-xs ${p.accepting === "yes" ? "text-teal-600" : "text-red-600"}`}>{p.accepting === "yes" ? "taking students" : "not taking students"}</span>}
        {p.last_contacted_on && <span className={`ml-3 text-xs ${stale ? "text-brass" : "text-gray-400"}`}>{daysSince(p.last_contacted_on)}d ago{stale ? " · follow up?" : ""}</span>}
      </div>

      <div className="flex items-center gap-4 text-xs flex-shrink-0">
        {p.homepage_url && <a href={p.homepage_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-brass">Homepage</a>}
        {p.email && <a href={`mailto:${p.email}`} className="text-gray-500 hover:text-brass">Email</a>}
        <select
          value={p.outreach}
          disabled={pending}
          onChange={(e) => {
            setError(null);
            start(async () => {
              try {
                await setProfessorOutreach(p.id, p.school_id, e.target.value as OutreachStatus);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not update");
              }
            });
          }}
          className="border rounded px-2 py-1 bg-transparent cursor-pointer text-sm"
          aria-label={`Outreach status for ${p.name}`}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      {error && <p className="text-red-600 text-xs md:basis-full">{error}</p>}
    </li>
  );
}

function Group({ title, hint, list, limit, folded }: { title: string; hint: string; list: OutreachProf[]; limit?: number; folded?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(!folded);
  if (list.length === 0) return null;
  const shown = limit && !showAll ? list.slice(0, limit) : list;
  return (
    <section className="flex flex-col gap-1">
      <button onClick={() => setOpen((v) => !v)} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 text-left" aria-expanded={open}>
        <span className="flex items-baseline gap-3">
          <span className="font-sans text-[15px] font-semibold text-cream">{title}</span>
          <span className="font-mono text-xs text-gray-500">{list.length}</span>
          <span className="text-xs text-gray-400 hidden sm:inline">{hint}</span>
        </span>
        <span className="text-xs text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <>
          <ul className="flex flex-col">{shown.map((p) => <Row key={p.id} p={p} />)}</ul>
          {limit && list.length > limit && (
            <button onClick={() => setShowAll((v) => !v)} className="text-sm text-gray-500 hover:text-cream self-start pt-2">
              {showAll ? "Show fewer" : `Show all ${list.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function OutreachBoard({ professors }: { professors: OutreachProf[] }) {
  const [query, setQuery] = useState("");
  const [openings, setOpenings] = useState<"all" | "notno" | "yes">("all");
  const [fit4, setFit4] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return professors.filter((p) => {
      if (openings === "yes" && p.accepting !== "yes") return false;
      if (openings === "notno" && p.accepting === "no") return false;
      if (fit4 && (p.fit_score ?? 0) < 4) return false;
      if (q && !`${p.name} ${p.school_name} ${p.research_areas.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [professors, query, openings, fit4]);

  const rank = (p: OutreachProf) => (p.accepting === "yes" ? 0 : 1);
  const sorted = (list: OutreachProf[]) =>
    [...list].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0) || rank(a) - rank(b) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-3 items-center">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name, school or research area" className="border rounded px-3 py-1.5 text-sm w-80 max-w-full" />
        <select value={openings} onChange={(e) => setOpenings(e.target.value as any)} className="border rounded px-2 py-1.5 text-sm bg-transparent" aria-label="Openings">
          <option value="all">All professors</option>
          <option value="notno">Hide not taking students</option>
          <option value="yes">Only taking students</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
          <input type="checkbox" checked={fit4} onChange={(e) => setFit4(e.target.checked)} /> Fit 4 or more
        </label>
        <span className="ml-auto text-xs text-gray-400 font-mono">{shown.length} of {professors.length}</span>
      </div>

      {shown.length === 0 && <p className="text-sm text-gray-500">No professors match these filters.</p>}
      {GROUPS.map((g) => (
        <Group key={g.key} title={g.title} hint={g.hint} limit={g.limit} folded={g.folded} list={sorted(shown.filter((p) => g.statuses.includes(p.outreach)))} />
      ))}
    </div>
  );
}
