"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTaskStatus } from "@/app/(app)/tasks/actions";

const PRIORITY_BAR: Record<string, string> = { high: "border-l-red-600", medium: "border-l-brass", low: "border-l-line" };

export function TodayTaskRow({
  id, title, sub, when, overdue, priority,
}: { id: string; title: string; sub: string; when: string; overdue: boolean; priority: string }) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function complete() {
    setDone(true);
    startTransition(async () => {
      try {
        await updateTaskStatus(id, "done");
      } catch {
        setDone(false);
      }
    });
  }

  return (
    <div className={`flex items-center gap-3 border border-l-4 ${PRIORITY_BAR[priority] ?? PRIORITY_BAR.medium} rounded p-3 text-sm transition-opacity ${done ? "opacity-40" : ""}`}>
      <button
        onClick={complete}
        disabled={done || pending}
        aria-label={`Mark "${title}" done`}
        className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[11px] ${done ? "bg-teal-600 border-teal-600 text-ink" : "border-gray-400 hover:border-brass"}`}
      >
        {done ? "✓" : ""}
      </button>
      <Link href={`/tasks/${id}`} className="flex-1 min-w-0 hover:text-brass">
        <span className={`block truncate ${done ? "line-through" : ""}`}>{title}</span>
        <span className="block text-xs text-gray-500 truncate">{sub}</span>
      </Link>
      <span className={`text-xs font-mono whitespace-nowrap ${overdue ? "text-red-600" : "text-gray-500"}`}>{when}</span>
    </div>
  );
}
