"use client";
import { useState, useTransition } from "react";
import { setApplying, setCheck } from "@/app/(app)/readiness/actions";
import type { ReadinessItem } from "@/lib/readiness";

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    start(async () => { try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

export function ApplyingToggle({ schoolId, applying }: { schoolId: string; applying: boolean }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        onClick={() => run(() => setApplying(schoolId, !applying))} disabled={pending}
        className={applying ? "text-sm text-gray-500 hover:text-red-600" : "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50"}
      >
        {applying ? "Stop tracking this application" : "I'm applying here"}
      </button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </span>
  );
}

export function ChecklistRows({ schoolId, items }: { schoolId: string; items: ReadinessItem[] }) {
  const { pending, error, run } = useRun();
  return (
    <div className={pending ? "opacity-70" : ""}>
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={i.key} className="border-b border-line/60 last:border-0">
            {i.derived ? (
              <div className="flex items-baseline gap-3 py-2.5">
                <span aria-hidden className={`w-4 text-center ${i.done ? "text-teal-600" : "text-gray-400"}`}>{i.done ? "✓" : "○"}</span>
                <span className={i.done ? "text-gray-500" : ""}>{i.label}</span>
                {!i.done && i.hint && <span className="text-xs text-gray-400 ml-auto text-right">{i.hint}</span>}
              </div>
            ) : (
              <label className="flex items-baseline gap-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={i.done} onChange={(e) => run(() => setCheck(schoolId, i.key, e.target.checked))} className="translate-y-0.5" />
                <span className={i.done ? "text-gray-500 line-through" : ""}>{i.label}</span>
              </label>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-red-600 text-xs pt-2">{error}</p>}
    </div>
  );
}

export function StartApplyingList({ schools }: { schools: Array<{ id: string; name: string; deadline_date: string | null }> }) {
  const { pending, error, run } = useRun();
  return (
    <ul className={`flex flex-col ${pending ? "opacity-70" : ""}`}>
      {schools.map((s) => (
        <li key={s.id} className="flex items-baseline justify-between gap-4 py-2.5 border-b border-line/60 last:border-0">
          <span className="min-w-0">
            <span className="block truncate">{s.name}</span>
            {s.deadline_date && <span className="text-xs text-gray-400">Deadline {new Date(s.deadline_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
          </span>
          <button onClick={() => run(() => setApplying(s.id, true))} className="text-sm text-brass hover:underline whitespace-nowrap">Start tracking</button>
        </li>
      ))}
      {error && <li className="text-red-600 text-xs pt-2">{error}</li>}
    </ul>
  );
}
