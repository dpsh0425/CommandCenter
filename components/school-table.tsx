"use client";
import { useState } from "react";
import Link from "next/link";
import { StatusSelect } from "./status-select";
import type { SchoolStatus } from "@/app/(app)/schools/actions";

type Readiness = { risk: string; doneCount: number; total: number } | null;

type School = {
  id: string; name: string; country: string; faculty: string | null;
  fit_note: string | null; verified_fit: boolean; composite_score: number | null;
  csranking_nlp_rank: number | null; status: SchoolStatus;
  deadline_date: string | null; tier: string | null; profCount: number; takingStudents: number; completeness: number; hasResearch: boolean;
  readiness?: Readiness;
};

import { FIT_SCORE_HELP } from "@/lib/fit-score";

export { FIT_SCORE_HELP };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysUntil = (date: string, today: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
const TIER: Record<string, { label: string; cls: string }> = {
  reach: { label: "Reach", cls: "bg-red-50 text-red-700" },
  target: { label: "Target", cls: "bg-blue-50 text-blue-700" },
  safe: { label: "Safe", cls: "bg-emerald-50 text-emerald-700" },
};

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier || !TIER[tier]) return null;
  return <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${TIER[tier].cls}`}>{TIER[tier].label}</span>;
}

function Deadline({ s, today }: { s: School; today: string }) {
  if (!s.deadline_date) return <span className="text-[13px] text-slate-400">Not researched</span>;
  const d = daysUntil(s.deadline_date, today);
  const date = new Date(s.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <span className="whitespace-nowrap text-[13px]">
      <span className="block text-slate-900">{date}</span>
      <span className={`block text-xs ${d < 0 ? "text-red-700" : d <= 30 ? "font-medium text-red-700" : "text-slate-500"}`}>
        {d < 0 ? `${-d} days ago` : d === 0 ? "today" : `${d} days`}
      </span>
    </span>
  );
}

function ReadinessBadge({ r }: { r: Readiness | undefined }) {
  if (!r) return <span className="rounded-full bg-slate-100 px-2 py-px text-[11px] font-medium text-slate-500">Not applying</span>;
  if (r.risk === "submitted") return <span className="rounded-full bg-emerald-50 px-2 py-px text-[11px] font-medium text-emerald-700">Submitted</span>;
  const urgent = r.risk === "overdue" || r.risk === "urgent";
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-px text-[11px] font-medium ${urgent ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
      {r.doneCount} / {r.total} ready{urgent ? " · needs action" : ""}
    </span>
  );
}

function Researched({ pct }: { pct: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${pct >= 70 ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs tabular-nums text-slate-600">{pct}%</span>
    </span>
  );
}

// One quiet line under the name: where, who, how sure.
function detail(s: School) {
  return [
    s.country,
    s.profCount > 0 ? `${s.profCount} professor${s.profCount === 1 ? "" : "s"}` : null,
    s.verified_fit ? "verified fit" : null,
  ].filter(Boolean).join(" · ");
}

export function SchoolTable({ schools }: { schools: School[] }) {
  const [view, setView] = useState<"table" | "cards">("table");
  const today = localDate(new Date());
  const seg = (active: boolean) =>
    `h-[30px] rounded-md px-3 text-[13px] font-semibold transition-colors ${
      active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-slate-600 hover:text-slate-900"
    }`;

  const cards = (
    <ul className={`grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 ${view === "table" ? "md:hidden" : ""}`}>
      {schools.map((s) => (
        <li key={s.id} className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/schools/${s.id}`} className="block truncate text-[15px] font-semibold text-slate-900 hover:text-blue-700">{s.name}</Link>
              <span className="block truncate text-xs text-slate-500" title={s.fit_note ?? undefined}>{detail(s)}</span>
            </div>
            <TierBadge tier={s.tier} />
          </div>
          <div><ReadinessBadge r={s.readiness} /></div>
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            <div>Deadline<Deadline s={s} today={today} /></div>
            <div>
              <span title={FIT_SCORE_HELP} className="cursor-help border-b border-dashed border-slate-400">Fit score ⓘ</span>
              <span className="block font-mono text-[13px] text-slate-900">{s.composite_score?.toFixed(0) ?? "—"}</span>
            </div>
            <div>Researched<span className="block text-[13px] text-slate-900">{s.hasResearch ? `${s.completeness}%` : "—"}</span></div>
          </div>
          <StatusSelect schoolId={s.id} value={s.status} />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden justify-end md:flex">
        <div role="group" aria-label="View" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} className={seg(view === "table")}>Table</button>
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")} className={seg(view === "cards")}>Cards</button>
        </div>
      </div>

      {cards}

      {view === "table" && (
        <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th scope="col" className="px-4 py-2.5 font-medium">School</th>
                <th scope="col" className="w-28 px-3 py-2.5 font-medium">Deadline</th>
                <th scope="col" className="w-24 px-3 py-2.5 font-medium">
                  <span title={FIT_SCORE_HELP} className="cursor-help border-b border-dashed border-slate-400">Fit score ⓘ</span>
                </th>
                <th scope="col" className="w-36 px-3 py-2.5 font-medium">Researched</th>
                <th scope="col" className="w-44 px-3 py-2.5 font-medium">Readiness</th>
                <th scope="col" className="w-44 px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 align-top transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Link href={`/schools/${s.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">{s.name}</Link>
                      <TierBadge tier={s.tier} />
                    </span>
                    <span className="mt-0.5 block max-w-md truncate text-xs text-slate-500" title={s.fit_note ?? undefined}>{detail(s)}</span>
                  </td>
                  <td className="px-3 py-3"><Deadline s={s} today={today} /></td>
                  <td className="px-3 py-3 font-mono text-slate-900">{s.composite_score?.toFixed(0) ?? "—"}</td>
                  <td className="px-3 py-3">{s.hasResearch ? <Researched pct={s.completeness} /> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-3"><ReadinessBadge r={s.readiness} /></td>
                  <td className="px-4 py-3"><StatusSelect schoolId={s.id} value={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
