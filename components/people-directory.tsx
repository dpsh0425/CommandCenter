"use client";
import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";

export type DirectoryPerson = {
  id: string; name: string; role: string | null; area: string | null; color: string; canSignIn: boolean;
  open: number; overdue: number; done: number;
  letters: Record<string, number>; // letter status -> count
};

const LETTER_CHIP: Array<{ key: string; label: string; cls: string }> = [
  { key: "not_asked", label: "not asked", cls: "bg-slate-100 text-slate-600" },
  { key: "asked", label: "asked", cls: "bg-blue-50 text-blue-700" },
  { key: "confirmed", label: "confirmed", cls: "bg-blue-100 text-blue-800" },
  { key: "submitted", label: "submitted", cls: "bg-emerald-50 text-emerald-700" },
];

function LetterChips({ letters }: { letters: Record<string, number> }) {
  const chips = LETTER_CHIP.filter((c) => (letters[c.key] ?? 0) > 0);
  if (chips.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c.key} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}>
          {letters[c.key]} {c.label}
        </span>
      ))}
    </span>
  );
}

function LoginBadge({ on }: { on: boolean }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      {on ? "Can sign in" : "No login"}
    </span>
  );
}

const roleLine = (p: DirectoryPerson) => [p.role, p.area].filter(Boolean).join(" · ") || "No role set";
const taskLine = (p: DirectoryPerson) => `${p.open} open task${p.open === 1 ? "" : "s"}`;

export function PeopleDirectory({ people }: { people: DirectoryPerson[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => !q || [p.name, p.role, p.area].some((v) => v?.toLowerCase().includes(q)));
  const maxOpen = Math.max(1, ...people.map((p) => p.open));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex h-9 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 sm:w-72">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4 text-slate-500"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search people"
            placeholder="Search by name or role" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
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

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">No one matches &ldquo;{query}&rdquo;.</p>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} color={p.color} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-slate-900">{p.name}</div>
                  <div className="truncate text-xs text-slate-500">{roleLine(p)}</div>
                </div>
                <LoginBadge on={p.canSignIn} />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{taskLine(p)}{p.overdue > 0 && <span className="font-medium text-red-700"> · {p.overdue} overdue</span>}</span>
                  <span className="tabular-nums">{p.done} done</span>
                </div>
                <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span className={`block h-full rounded-full ${p.overdue > 0 ? "bg-red-600" : "bg-blue-600"}`} style={{ width: `${(p.open / maxOpen) * 100}%` }} />
                </span>
              </div>
              <LetterChips letters={p.letters} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Person</th>
                  <th className="px-2 py-2.5 font-medium">Tasks</th>
                  <th className="px-2 py-2.5 font-medium">Letters</th>
                  <th className="px-5 py-2.5 font-medium">Sign-in</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <Link href={`/people/${p.id}`} className="flex items-center gap-2.5 hover:text-blue-700">
                        <Avatar name={p.name} color={p.color} size={30} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900">{p.name}</span>
                          <span className="block text-xs text-slate-500">{roleLine(p)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      {taskLine(p)}{p.overdue > 0 && <span className="font-medium text-red-700"> · {p.overdue} overdue</span>}
                      <span className="block text-xs text-slate-500">{p.done} done</span>
                    </td>
                    <td className="px-2 py-3">{Object.keys(p.letters).length ? <LetterChips letters={p.letters} /> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-5 py-3"><LoginBadge on={p.canSignIn} /></td>
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
