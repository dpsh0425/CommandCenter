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

const PRIORITY_DOT: Record<string, string> = { high: "bg-red-600", medium: "bg-brass", low: "bg-line" };

type Task = {
  id: string; title: string; status: string; priority: string; due_date: string | null;
  school_name?: string | null; milestone_title?: string | null; assignee_name?: string | null;
  openDependencies?: { title: string; status: string }[];
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function TaskCard({ task }: { task: Task }) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "done";
  const today = localToday();
  const overdue = !done && task.due_date != null && task.due_date < today;
  const due = task.due_date ? new Date(task.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
  const context = task.school_name ?? task.milestone_title;
  const waiting = task.openDependencies && task.openDependencies.length > 0;

  return (
    <div className={`group rounded-lg border border-line bg-surface p-3 flex flex-col gap-2 transition-colors hover:border-brass ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`} title={`${task.priority} priority`} />
        <Link href={`/tasks/${task.id}`} className={`text-sm font-medium leading-snug hover:text-brass ${done ? "line-through text-gray-500" : ""}`}>{task.title}</Link>
      </div>
      {(context || due || waiting) && (
        <p className="text-xs text-gray-500 pl-4">
          {[context, due && (overdue ? `overdue · ${due}` : `due ${due}`), waiting && `waiting on ${task.openDependencies!.length}`].filter(Boolean).join(" · ")}
        </p>
      )}
      {overdue && <span className="sr-only">Overdue</span>}
      <div className="flex items-center justify-between gap-2 pl-4 text-xs text-gray-400">
        <span className="truncate">{task.assignee_name ?? "Unassigned"}</span>
        <select
          value={task.status}
          disabled={pending}
          onChange={(e) => startTransition(() => updateTaskStatus(task.id, e.target.value as any))}
          className="bg-transparent border border-transparent rounded px-1 py-0.5 text-xs text-gray-500 hover:border-line cursor-pointer"
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
    <div className="flex flex-col gap-5">
      {tasks.length > 4 && (
        <div className="flex gap-2 flex-wrap items-center">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter tasks" className="border rounded px-3 py-1.5 text-sm w-56" />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-transparent">
            <option value="">Everyone</option>
            <option value="__none">Unassigned</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-8 items-start">
        {COLUMNS.map((col) => {
          const colTasks = visible.filter((t) => t.status === col.key);
          return (
            <section key={col.key} className="flex flex-col gap-3">
              <h2 className="font-sans text-[15px] font-semibold text-cream border-b border-line pb-2 flex justify-between items-baseline">
                <span>{col.label}</span>
                <span className="font-mono text-xs text-gray-500 font-normal">{colTasks.length}</span>
              </h2>
              {colTasks.length === 0 ? <p className="text-sm text-gray-400 py-2">{col.empty}</p> : colTasks.map((t) => <TaskCard key={t.id} task={t} />)}
            </section>
          );
        })}
      </div>

      {cancelled > 0 && <p className="text-xs text-gray-500">{cancelled} cancelled task{cancelled === 1 ? "" : "s"} hidden.</p>}
    </div>
  );
}
