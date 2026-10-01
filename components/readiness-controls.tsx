"use client";
import { useState, useTransition } from "react";
import { setApplying, setCheck } from "@/app/(app)/readiness/actions";
import type { ReadinessItem } from "@/lib/readiness";

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, onError?: () => void) => {
    setError(null);
    start(async () => { try { await fn(); } catch (e) { onError?.(); setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

export function ApplyingToggle({ schoolId, applying }: { schoolId: string; applying: boolean }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={() => run(() => setApplying(schoolId, !applying))} disabled={pending}
        className={
          applying
            ? "h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            : "h-9 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        }
      >
        {pending ? "Saving…" : applying ? "Stop tracking this application" : "I'm applying here"}
      </button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

export function ChecklistRows({ schoolId, items }: { schoolId: string; items: ReadinessItem[] }) {
  const { pending, error, run } = useRun();
  // Show a tick straight away; the server value takes over again once the page refreshes.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const isDone = (i: ReadinessItem) => (i.key in optimistic ? optimistic[i.key] : i.done);

  return (
    <div>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {items.map((i) => {
          const done = isDone(i);
          return (
            <li key={i.key}>
              {i.derived ? (
                <div className="flex items-start gap-2.5 py-2">
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] ${
                      done ? "bg-blue-600 text-white" : "border-[1.5px] border-dashed border-slate-400"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className={done ? "text-slate-400 line-through" : "text-slate-900"}>{i.label}</span>
                    {!done && i.hint && <span className="block text-xs text-slate-500">{i.hint}</span>}
                  </span>
                </div>
              ) : (
                <label className={`flex cursor-pointer items-start gap-2.5 py-2 ${pending ? "cursor-wait" : ""}`}>
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={pending}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setOptimistic((o) => ({ ...o, [i.key]: next }));
                      run(() => setCheck(schoolId, i.key, next), () => setOptimistic((o) => ({ ...o, [i.key]: !next })));
                    }}
                    className="mt-0.5 h-[17px] w-[17px] flex-shrink-0 accent-blue-600"
                  />
                  <span className={`text-sm ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{i.label}</span>
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="pt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function StartApplyingList({ schools }: { schools: Array<{ id: string; name: string; deadline_date: string | null }> }) {
  const { pending, error, run } = useRun();
  return (
    <div className="flex flex-col gap-2">
      <ul className={`grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 ${pending ? "opacity-70" : ""}`}>
        {schools.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">{s.name}</span>
              {s.deadline_date && (
                <span className="text-xs text-slate-500">
                  Deadline {new Date(s.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setApplying(s.id, true))}
              className="h-8 flex-shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              Start tracking
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
