"use client";
import { useState } from "react";
import Link from "next/link";

export type ProjectCard = {
  id: string; title: string; question: string | null; status: string; statusLabel: string;
  done: number; total: number; open: number; weekLabel: string | null; team: number; late: number;
  next: { title: string; when: string; overdue: boolean } | null;
};

const STATUS_BADGE: Record<string, string> = {
  idea: "bg-slate-100 text-slate-600", planning: "bg-slate-100 text-slate-700", active: "bg-blue-50 text-blue-700",
  writing: "bg-emerald-50 text-emerald-700", submitted: "bg-blue-100 text-blue-800", published: "bg-emerald-100 text-emerald-800",
  paused: "bg-slate-100 text-slate-500",
};

function Badge({ p }: { p: ProjectCard }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[p.status] ?? STATUS_BADGE.planning}`}>{p.statusLabel}</span>;
}

function Next({ p }: { p: ProjectCard }) {
  if (!p.next) return <span className="text-slate-400">No dated milestone</span>;
  return <>{p.next.title} <span className={`font-medium ${p.next.overdue ? "text-red-700" : "text-blue-700"}`}>{p.next.when}</span></>;
}

export function ResearchProjects({ projects }: { projects: ProjectCard[] }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="View">
          {(["cards", "table"] as const).map((v) => (
            <button
              key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`h-8 px-3 text-[13px] font-medium capitalize ${view === v ? "bg-slate-100 text-slate-900" : "bg-white text-slate-500 hover:text-slate-900"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "cards" ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => {
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            const chips = [p.open ? `${p.open} open task${p.open === 1 ? "" : "s"}` : null, p.weekLabel ? `${p.weekLabel} this week` : null, p.team ? `${p.team} on the team` : "solo", p.late ? `${p.late} late` : null].filter(Boolean) as string[];
            return (
              <li key={p.id}>
                <Link href={`/research/projects/${p.id}`} className="flex h-full flex-col gap-2.5 rounded-lg border border-slate-200 bg-white px-[18px] py-4 transition-colors hover:border-slate-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-base font-semibold text-slate-900">{p.title}</span>
                    <Badge p={p} />
                  </div>
                  {p.question && <p className="line-clamp-2 text-[13px] leading-5 text-slate-600">{p.question}</p>}
                  <div className="flex items-center gap-2.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></span>
                    <span className="text-xs tabular-nums text-slate-600">{p.total ? `${p.done} of ${p.total} milestones` : "No milestones yet"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((c) => <span key={c} className={`rounded-md px-2 py-0.5 text-xs ${c.endsWith("late") ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{c}</span>)}
                  </div>
                  <p className="mt-auto border-t border-slate-100 pt-2 text-xs text-slate-600">Next: <span className="font-semibold text-slate-900"><Next p={p} /></span></p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Project</th>
                  <th className="px-2 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5 font-medium">Milestones</th>
                  <th className="px-2 py-2.5 font-medium">Open tasks</th>
                  <th className="px-2 py-2.5 font-medium">This week</th>
                  <th className="px-2 py-2.5 font-medium">Team</th>
                  <th className="px-5 py-2.5 font-medium">Next</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-5 py-3"><Link href={`/research/projects/${p.id}`} className="font-semibold text-slate-900 hover:text-blue-700">{p.title}</Link></td>
                    <td className="px-2 py-3"><Badge p={p} /></td>
                    <td className="px-2 py-3 tabular-nums text-slate-600">{p.done} of {p.total}{p.late ? <span className="font-medium text-red-700"> · {p.late} late</span> : null}</td>
                    <td className="px-2 py-3 tabular-nums text-slate-600">{p.open}</td>
                    <td className="px-2 py-3 text-slate-600">{p.weekLabel ?? "—"}</td>
                    <td className="px-2 py-3 text-slate-600">{p.team ? p.team : "solo"}</td>
                    <td className="px-5 py-3 text-slate-700"><Next p={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
