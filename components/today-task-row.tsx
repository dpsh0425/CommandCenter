"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTaskStatus } from "@/app/(app)/tasks/actions";

export function TodayTaskRow({
  id, title, sub, when, overdue, priority,
}: { id: string; title: string; sub: string; when: string; overdue: boolean; priority: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function complete() {
    setDone(true);
    setFailed(false);
    startTransition(async () => {
      try {
        await updateTaskStatus(id, "done");
      } catch {
        setDone(false);
        setFailed(true);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-slate-50">
      <button
        type="button"
        onClick={complete}
        disabled={done || pending}
        aria-label={`Mark "${title}" done`}
        className={`-m-2.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full disabled:cursor-default`}
      >
        <span
          className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] transition-colors ${
            done ? "border-blue-600 bg-blue-600 text-white" : "border-slate-400 bg-white text-transparent hover:border-blue-600"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </button>
      <Link href={`/tasks/${id}`} className="group min-w-0 flex-1">
        <span className={`block truncate text-sm ${done ? "text-slate-400 line-through" : "text-slate-900 group-hover:text-blue-700"}`}>{title}</span>
        {failed ? (
          <span role="alert" className="block text-xs text-red-700">Couldn&apos;t save. Try again.</span>
        ) : (
          sub && <span className="block truncate text-xs text-slate-500">{sub}</span>
        )}
      </Link>
      {priority === "high" && !done && (
        <span className="flex-shrink-0 rounded-full bg-red-50 px-2 py-px text-[11px] font-medium text-red-700">High</span>
      )}
      <span className={`flex-shrink-0 whitespace-nowrap font-mono text-xs ${overdue && !done ? "text-red-700" : "text-slate-500"}`}>{when}</span>
    </li>
  );
}
