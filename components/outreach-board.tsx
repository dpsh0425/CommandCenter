"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { setProfessorOutreach, type OutreachStatus } from "@/app/(app)/schools/[id]/faculty-actions";

export type OutreachProf = {
  id: string; name: string; title: string | null; school_id: string; school_name: string; department: string | null;
  research_areas: string[]; accepting: "unknown" | "yes" | "no"; fit_score: number | null; outreach: OutreachStatus;
  last_contacted_on: string | null; homepage_url: string | null; email: string | null;
};

const COLUMNS: Array<{ key: OutreachStatus; label: string; hint: string }> = [
  { key: "not_contacted", label: "Not contacted", hint: "Shortlist to reach out to" },
  { key: "contacted", label: "Contacted", hint: "Waiting for a reply" },
  { key: "replied", label: "Replied", hint: "Conversation open" },
  { key: "meeting", label: "Meeting", hint: "Call scheduled or held" },
  { key: "no_response", label: "No response", hint: "Consider a polite follow-up" },
  { key: "declined", label: "Declined", hint: "Not taking students / not a fit" },
];
const ACCEPT_TONE = { unknown: "text-gray-500 border-line", yes: "text-teal-600 border-teal-600", no: "text-red-600 border-red-600" } as const;
const ACCEPT_LABEL = { unknown: "openings unknown", yes: "taking students", no: "not taking" } as const;

const daysSince = (d: string) => Math.floor((Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000);

function Card({ p }: { p: OutreachProf }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stale = p.outreach === "contacted" && p.last_contacted_on != null && daysSince(p.last_contacted_on) >= 10;
  return (
    <div className={`border border-line rounded-lg p-3 bg-surface-raised flex flex-col gap-2 ${pending ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <div className="font-medium truncate">{p.name}</div>
        <Link href={`/schools/${p.school_id}?tab=faculty`} className="text-xs text-brass hover:underline truncate block">{p.school_name}</Link>
        {(p.title || p.department) && <div className="text-xs text-gray-500 truncate">{[p.title, p.department].filter(Boolean).join(" · ")}</div>}
      </div>
      {p.research_areas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.research_areas.slice(0, 3).map((a) => <span key={a} className="text-[11px] rounded bg-brass-soft text-brass px-1.5 py-0.5">{a}</span>)}
          {p.research_areas.length > 3 && <span className="text-[11px] text-gray-400">+{p.research_areas.length - 3}</span>}
        </div>
      )}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className={`border rounded-full px-2 py-0.5 ${ACCEPT_TONE[p.accepting]}`}>{ACCEPT_LABEL[p.accepting]}</span>
        {p.fit_score != null && <span className="font-mono text-brass" aria-label={`Fit ${p.fit_score} of 5`}>{"●".repeat(p.fit_score)}<span className="text-line">{"●".repeat(5 - p.fit_score)}</span></span>}
        {p.last_contacted_on && <span className={`font-mono ${stale ? "text-brass" : "text-gray-400"}`}>{daysSince(p.last_contacted_on)}d ago{stale ? " · follow up?" : ""}</span>}
      </div>
      <div className="flex items-center gap-3 text-xs pt-1 border-t border-line">
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
          className="border rounded px-1.5 py-0.5 bg-transparent"
          aria-label={`Outreach status for ${p.name}`}
        >
          {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {p.homepage_url && <a href={p.homepage_url} target="_blank" rel="noopener noreferrer" className="text-brass underline">Homepage</a>}
        {p.email && <a href={`mailto:${p.email}`} className="text-brass underline">Email</a>}
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}

export function OutreachBoard({ professors }: { professors: OutreachProf[] }) {
  const [query, setQuery] = useState("");
  const [accepting, setAccepting] = useState<"all" | "yes" | "notno">("all");
  const [fit4, setFit4] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return professors.filter((p) => {
      if (accepting === "yes" && p.accepting !== "yes") return false;
      if (accepting === "notno" && p.accepting === "no") return false;
      if (fit4 && (p.fit_score ?? 0) < 4) return false;
      if (q && !`${p.name} ${p.school_name} ${p.research_areas.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [professors, query, accepting, fit4]);

  const chip = (active: boolean) => `px-2.5 py-1 rounded-full text-xs border ${active ? "bg-brass text-ink font-medium border-brass" : "hover:border-brass"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name, school or research area…" className="border rounded px-2 py-1.5 text-sm w-72 max-w-full" />
        <button className={chip(accepting === "all")} onClick={() => setAccepting("all")}>All</button>
        <button className={chip(accepting === "notno")} onClick={() => setAccepting("notno")}>Hide not-taking</button>
        <button className={chip(accepting === "yes")} onClick={() => setAccepting("yes")}>Taking students</button>
        <span className="w-px h-4 bg-line" />
        <button className={chip(fit4)} onClick={() => setFit4((v) => !v)}>Fit 4+</button>
        <span className="ml-auto text-xs text-gray-500 font-mono">{shown.length} of {professors.length}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
        {COLUMNS.map((col) => {
          const list = shown.filter((p) => p.outreach === col.key);
          return (
            <section key={col.key} className="border border-line bg-surface rounded-lg p-3 flex flex-col gap-2 min-h-[6rem]">
              <h2 className="flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wide text-gray-500">{col.label}</span>
                <span className="font-mono text-xs text-gray-500">{list.length}</span>
              </h2>
              {list.length === 0 ? <p className="text-xs text-gray-400 border border-dashed border-line rounded p-3 text-center">{col.hint}</p> : list.map((p) => <Card key={p.id} p={p} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
