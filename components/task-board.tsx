"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTaskStatus } from "@/app/(app)/tasks/actions";

const COLUMNS: Array<{ key: string; label: string; empty: string }> = [
  { key: "todo", label: "To do", empty: "Nothing queued" },
  { key: "in_progress", label: "In progress", empty: "Nothing in flight" },
  { key: "blocked", label: "Blocked", empty: "Nothing blocked" },
  { key: "done", label: "Done", empty: "Nothing finished yet" },
];

const PRIORITY_BAR: Record<string, string> = {
  high: "border-l-red-600",
  medium: "border-l-brass",
  low: "border-l-line",
};

type Task = {
  id: string; title: string; status: string; priority: string; due_date: string | null;
  school_name?: string | null; milestone_title?: string | null; assignee_name?: string | null;
  openDependencies?: { title: string; status: string }[];
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function DueChip({ date, done }: { date: string; done: boolean }) {
  const today = localToday();
  const overdue = !done && date < today;
  const label = new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <span className={`font-mono text-[11px] ${overdue ? "text-red-600" : date === today && !done ? "text-brass" : "text-gray-500"}`}>
      {overdue ? "overdue · " : ""}{label}
    </span>
  );
}

function TaskCard({ task }: { task: Task }) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "done";
  return (
    <div className={`bg-surface-raised border border-l-4 ${PRIORITY_BAR[task.priority] ?? PRIORITY_BAR.medium} rounded p-2.5 mb-2 text-sm transition-opacity ${pending ? "opacity-50" : ""}`}>
      <Link href={`/tasks/${task.id}`} className={`font-medium hover:underline ${done ? "line-through text-gray-500" : ""}`}>{task.title}</Link>
      <div className="flex flex-wrap gap-x-2 mt-1">
        {task.school_name && <span className="text-xs text-teal-700">{task.school_name}</span>}
        {task.milestone_title && <span className="text-xs text-violet-700">{task.milestone_title}</span>}
      </div>
      {task.openDependencies && task.openDependencies.length > 0 && (
        <div className="text-xs text-amber-700 mt-1">waiting on: {task.openDependencies.map((d) => d.title).join(", ")}</div>
      )}
      <div className="flex justify-between items-center mt-2 gap-2">
        <div className="flex flex-col text-xs text-gray-500 min-w-0">
          <span className="truncate">{task.assignee_name ?? "Unassigned"}</span>
          {task.due_date && <DueChip date={task.due_date} done={done} />}
        </div>
        <select
          value={task.status}
          disabled={pending}
          onChange={(e) => startTransition(() => updateTaskStatus(task.id, e.target.value as any))}
          className="border rounded text-xs px-1 py-0.5"
          aria-label={`Status of ${task.title}`}
        >
          {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  );
}

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("");

  const assignees = Array.from(new Set(tasks.map((t) => t.assignee_name).filter(Boolean))) as string[];
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;
  const visible = tasks.filter((t) => {
    if (assignee === "__none" ? t.assignee_name : assignee && t.assignee_name !== assignee) return false;
    if (query && !`${t.title} ${t.school_name ?? ""} ${t.milestone_title ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tasks…"
          className="border rounded px-2 py-1 text-sm w-56"
        />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">Everyone</option>
          <option value="__none">Unassigned</option>
          {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="ml-auto flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-red-600" />high</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-brass" />medium</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-line" />low</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
        {COLUMNS.map((col) => {
          const colTasks = visible.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="border rounded p-2 bg-gray-50 min-h-[8rem]">
              <div className="text-xs uppercase text-gray-500 mb-2 flex justify-between px-0.5">
                <span>{col.label}</span><span className="font-mono">{colTasks.length}</span>
              </div>
              {colTasks.length === 0 ? (
                <p className="text-xs text-gray-400 border border-dashed border-line rounded p-3 text-center">{col.empty}</p>
              ) : (
                colTasks.map((t) => <TaskCard key={t.id} task={t} />)
              )}
            </div>
          );
        })}
      </div>

      {cancelled > 0 && <p className="text-xs text-gray-500">{cancelled} cancelled task{cancelled === 1 ? "" : "s"} hidden from the board.</p>}
    </div>
  );
}
