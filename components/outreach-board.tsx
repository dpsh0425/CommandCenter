"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { setProfessorOutreach, type OutreachStatus } from "@/app/(app)/schools/[id]/faculty-actions";

export type OutreachProf = {
  id: string; name: string; title: string | null; school_id: string; school_name: string; department: string | null;
  research_areas: string[]; accepting: "unknown" | "yes" | "no"; fit_score: number | null; outreach: OutreachStatus;
  last_contacted_on: string | null; homepage_url: string | null; email: string | null;
};

const STATUS_OPTIONS: Array<{ key: OutreachStatus; label: string; tone: string }> = [
  { key: "not_contacted", label: "Not contacted", tone: "border-slate-300 bg-white text-slate-600" },
  { key: "contacted", label: "Contacted", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { key: "replied", label: "Replied", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "meeting", label: "Meeting", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { key: "no_response", label: "No response", tone: "border-slate-300 bg-slate-50 text-slate-600" },
  { key: "declined", label: "Declined", tone: "border-red-200 bg-red-50 text-red-700" },
];

// Grouped by what you need to do next, not by database status.
const GROUPS: Array<{ key: string; title: string; hint: string; statuses: OutreachStatus[]; limit?: number; folded?: boolean }> = [
  { key: "talking", title: "In conversation", hint: "They replied or a meeting is booked", statuses: ["replied", "meeting"] },
  { key: "waiting", title: "Waiting on a reply", hint: "Follow up after about 10 days", statuses: ["contacted", "no_response"] },
  { key: "todo", title: "To contact", hint: "Best fit first", statuses: ["not_contacted"], limit: 10 },
  { key: "closed", title: "Closed", hint: "Declined", statuses: ["declined"], folded: true },
];

const daysSince = (d: string) => Math.floor((Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000);
const isStale = (p: OutreachProf) => (p.outreach === "contacted" || p.outreach === "no_response") && p.last_contacted_on != null && daysSince(p.last_contacted_on) >= 10;

function Row({ p }: { p: OutreachProf }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stale = isStale(p);
  const tone = STATUS_OPTIONS.find((o) => o.key === p.outreach)?.tone ?? STATUS_OPTIONS[0].tone;

  return (
    <li className={`flex flex-col gap-1.5 border-b border-slate-100 py-3 last:border-0 md:flex-row md:items-center md:gap-5 ${pending ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-shrink-0 md:w-64">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{p.name}</span>
          {p.fit_score != null && <span className="flex-shrink-0 text-xs font-semibold text-blue-700">{p.fit_score}/5<span className="sr-only"> fit</span></span>}
        </div>
        <Link href={`/schools/${p.school_id}?tab=faculty`} className="block truncate text-xs text-slate-500 hover:text-blue-700">
          {p.school_name}{p.department ? ` · ${p.department}` : ""}
        </Link>
      </div>

      <div className="line-clamp-2 min-w-0 flex-1 text-[13px] text-slate-600 md:truncate">
        {p.research_areas.length > 0 ? p.research_areas.slice(0, 3).join(" · ") : <span className="text-slate-400">No research areas yet</span>}
        {p.accepting !== "unknown" && <span className={`ml-3 text-xs font-medium ${p.accepting === "yes" ? "text-emerald-700" : "text-red-700"}`}>{p.accepting === "yes" ? "taking students" : "not taking students"}</span>}
        {p.last_contacted_on && <span className={`ml-3 text-xs ${stale ? "font-medium text-red-700" : "text-slate-500"}`}>{daysSince(p.last_contacted_on)}d ago{stale ? " · follow up?" : ""}</span>}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3 text-xs">
        {p.homepage_url && <a href={p.homepage_url} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900">Homepage ↗</a>}
        {p.email && <a href={`mailto:${p.email}`} className="font-medium text-blue-600 hover:text-blue-700">Email</a>}
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
          className={`h-7 cursor-pointer rounded-full border px-2 text-xs font-medium disabled:opacity-60 ${tone}`}
          aria-label={`Outreach status for ${p.name}`}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-xs text-red-700 md:basis-full">{error}</p>}
    </li>
  );
}

function Group({ title, hint, list, limit, folded }: { title: string; hint: string; list: OutreachProf[]; limit?: number; folded?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(!folded);
  if (list.length === 0) return null;
  const shown = limit && !showAll ? list.slice(0, limit) : list;
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left ${open ? "border-b border-slate-200" : ""}`} aria-expanded={open}>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px] font-semibold text-slate-900">{title}</span>
          <span className="text-[13px] text-slate-500">· {list.length}</span>
          <span className="hidden text-xs text-slate-500 sm:inline">· {hint}</span>
        </span>
        <span className="text-xs font-medium text-slate-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-5">
          <ul className="flex flex-col">{shown.map((p) => <Row key={p.id} p={p} />)}</ul>
          {limit && list.length > limit && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mb-3 mt-1 text-[13px] font-medium text-blue-600 hover:text-blue-700">
              {showAll ? "Show fewer" : `Show all ${list.length}`}
            </button>
          )}
        </div>
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

  // Headline numbers over everyone, not just the filtered view.
  const talking = professors.filter((p) => p.outreach === "replied" || p.outreach === "meeting").length;
  const waiting = professors.filter((p) => p.outreach === "contacted" || p.outreach === "no_response");
  const todo = professors.filter((p) => p.outreach === "not_contacted");
  const contacted = professors.filter((p) => p.outreach !== "not_contacted").length;
  const stale = waiting.filter(isStale).length;
  const tiles: Array<{ label: string; value: string; sub: string; tone?: string; subTone?: string }> = [
    { label: "In conversation", value: String(talking), sub: "replied or meeting", tone: talking ? "text-emerald-700" : undefined },
    { label: "Waiting", value: String(waiting.length), sub: stale ? `${stale} due a follow-up` : "none due a follow-up", subTone: stale ? "font-medium text-red-700" : undefined },
    { label: "To contact", value: String(todo.length), sub: `${todo.filter((p) => (p.fit_score ?? 0) >= 4).length} with fit 4+`, tone: todo.length ? "text-blue-700" : undefined },
    { label: "Reply rate", value: contacted ? `${Math.round((talking / contacted) * 100)}%` : "—", sub: contacted ? `of ${contacted} contacted` : "no one contacted yet" },
  ];

  const chip = (on: boolean) =>
    `h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
            <p className={`text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
            <p className={`truncate text-xs ${t.subTone ?? "text-slate-500"}`}>{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 sm:w-80">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4 text-slate-500"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name, school or research area" aria-label="Filter professors" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Openings">
          <button type="button" aria-pressed={openings === "all"} onClick={() => setOpenings("all")} className={chip(openings === "all")}>All professors</button>
          <button type="button" aria-pressed={openings === "notno"} onClick={() => setOpenings("notno")} className={chip(openings === "notno")}>Hide not taking</button>
          <button type="button" aria-pressed={openings === "yes"} onClick={() => setOpenings("yes")} className={chip(openings === "yes")}>Only taking students</button>
        </div>
        <button type="button" aria-pressed={fit4} onClick={() => setFit4((v) => !v)} className={chip(fit4)}>Fit 4 or more</button>
        <span className="ml-auto text-xs tabular-nums text-slate-500">{shown.length} of {professors.length}</span>
      </div>

      {shown.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">No professors match these filters.</p>}
      {GROUPS.map((g) => (
        <Group key={g.key} title={g.title} hint={g.hint} limit={g.limit} folded={g.folded} list={sorted(shown.filter((p) => g.statuses.includes(p.outreach)))} />
      ))}
    </div>
  );
}
