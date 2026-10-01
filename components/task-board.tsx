"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTaskStatus } from "@/app/(app)/tasks/actions";
import { SearchIcon } from "@/components/icons";

const COLUMNS: Array<{ key: string; label: string; empty: string; dot: string }> = [
  { key: "todo", label: "To do", empty: "Nothing queued", dot: "bg-slate-400" },
  { key: "in_progress", label: "In progress", empty: "Nothing in flight", dot: "bg-blue-600" },
  { key: "blocked", label: "Blocked", empty: "Nothing blocked", dot: "bg-red-600" },
  { key: "done", label: "Done", empty: "Nothing finished yet", dot: "bg-emerald-600" },
];
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

type Task = {
  id: string; title: string; status: string; priority: string; due_date: string | null;
  school_name?: string | null; milestone_title?: string | null; assignee_name?: string | null;
  openDependencies?: { title: string; status: string }[];
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const initials = (name: string | null | undefined) =>
  name ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") : "–";

/** Status dropdown shared by the board and the list. Same server action as before. */
function StatusControl({ task, compact = false }: { task: Task; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <select
        value={task.status}
        disabled={pending}
        onChange={(e) => {
          setFailed(false);
          const next = e.target.value;
          startTransition(async () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await updateTaskStatus(task.id, next as any);
            } catch {
              setFailed(true);
            }
          });
        }}
        className={`cursor-pointer rounded-md border border-slate-200 bg-white text-slate-700 hover:border-slate-300 disabled:opacity-50 ${
          compact ? "h-[26px] px-1.5 text-xs" : "h-7 px-2 text-xs"
        }`}
        aria-label={`Status of ${task.title}`}
      >
        {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        <option value="cancelled">Cancelled</option>
      </select>
      {failed && <span role="alert" className="text-[11px] text-red-700">Couldn&apos;t save</span>}
    </span>
  );
}

function DueChip({ task, today }: { task: Task; today: string }) {
  if (!task.due_date) return null;
  const done = task.status === "done" || task.status === "cancelled";
  const overdue = !done && task.due_date < today;
  const label = task.due_date === today && !done ? "Due today" : overdue ? `Overdue · ${shortDate(task.due_date)}` : done ? shortDate(task.due_date) : `Due ${shortDate(task.due_date)}`;
  return (
    <span className={`rounded-full px-2 py-px text-[11px] font-medium ${overdue ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

function TaskCard({ task, today }: { task: Task; today: string }) {
  const done = task.status === "done";
  const context = task.school_name ?? task.milestone_title;
  const waiting = task.openDependencies && task.openDependencies.length > 0;
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
      <Link
        href={`/tasks/${task.id}`}
        className={`text-sm font-medium leading-snug hover:text-blue-700 ${done ? "text-slate-400 line-through" : "text-slate-900"}`}
      >
        {task.title}
      </Link>
      {context && <span className="truncate text-xs text-slate-500">{context}</span>}
      {(task.priority === "high" || task.due_date || waiting) && (
        <div className="flex flex-wrap gap-1.5">
          {task.priority === "high" && !done && <span className="rounded-full bg-red-50 px-2 py-px text-[11px] font-medium text-red-700">High</span>}
          <DueChip task={task} today={today} />
          {waiting && (
            <span
              className="rounded-full bg-violet-50 px-2 py-px text-[11px] font-medium text-violet-700"
              title={task.openDependencies!.map((d) => d.title).join(", ")}
            >
              Waiting on {task.openDependencies!.length}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
          <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-800" aria-hidden="true">
            {initials(task.assignee_name)}
          </span>
          <span className="truncate">{task.assignee_name ?? "Unassigned"}</span>
        </span>
        <StatusControl task={task} compact />
      </div>
    </article>
  );
}

type Priority = "" | "high" | "medium" | "low";

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<Priority>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const today = localToday();

  const assignees = Array.from(new Set(tasks.map((t) => t.assignee_name).filter(Boolean))) as string[];
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;
  const visible = tasks.filter((t) => {
    if (assignee === "__none" ? t.assignee_name : assignee && t.assignee_name !== assignee) return false;
    if (query && !`${t.title} ${t.school_name ?? ""} ${t.milestone_title ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (priority && t.priority !== priority) return false;
    if (overdueOnly && !(t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled")) return false;
    return true;
  });
  const listRows = visible.filter((t) => showCancelled || t.status !== "cancelled");
  const filtering = !!(query || assignee || priority || overdueOnly);

  const chip = (active: boolean) =>
    `h-[30px] rounded-full border px-3 text-xs font-medium transition-colors ${
      active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
    }`;
  const seg = (active: boolean) =>
    `h-[30px] rounded-md px-3 text-[13px] font-semibold transition-colors ${
      active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {tasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tasks"
              aria-label="Filter tasks"
              className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600"
            />
          </div>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="Assignee"
            className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900"
          >
            <option value="">Everyone</option>
            <option value="__none">Unassigned</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <div role="group" aria-label="Priority" className="flex flex-wrap gap-1.5">
            {(["", "high", "medium", "low"] as Priority[]).map((p) => (
              <button key={p || "all"} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)} className={chip(priority === p)}>
                {p ? PRIORITY_LABEL[p] : "All priorities"}
              </button>
            ))}
            <button type="button" aria-pressed={overdueOnly} onClick={() => setOverdueOnly((v) => !v)} className={chip(overdueOnly)}>
              Overdue only
            </button>
          </div>
          <div role="group" aria-label="View" className="ml-auto grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")} className={seg(view === "board")}>Board</button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={seg(view === "list")}>List</button>
          </div>
        </div>
      )}

      {view === "board" ? (
        <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const colTasks = visible.filter((t) => t.status === col.key);
            return (
              <section key={col.key} className="flex flex-col gap-2 rounded-[10px] bg-slate-100 p-2" aria-label={col.label}>
                <h2 className="flex items-center gap-2 px-1.5 py-1 text-[13px] font-semibold text-slate-900">
                  <i className={`h-2 w-2 rounded-full ${col.dot}`} aria-hidden="true" />
                  {col.label}
                  <span className="ml-auto text-xs font-normal tabular-nums text-slate-500">{colTasks.length}</span>
                </h2>
                {colTasks.length === 0 ? (
                  <p className="px-1.5 pb-2 text-[13px] text-slate-500">{filtering ? "No matches" : col.empty}</p>
                ) : (
                  colTasks.map((t) => <TaskCard key={t.id} task={t} today={today} />)
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th scope="col" className="px-4 py-2.5 font-medium">Task</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Linked to</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Assignee</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {listRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">{filtering ? "No tasks match these filters." : "No tasks yet."}</td></tr>
              )}
              {listRows.map((t) => {
                const done = t.status === "done" || t.status === "cancelled";
                const overdue = !done && t.due_date != null && t.due_date < today;
                return (
                  <tr key={t.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="max-w-[320px] px-4 py-2.5">
                      <Link href={`/tasks/${t.id}`} className={`block truncate font-medium hover:text-blue-700 ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {t.title}
                      </Link>
                      {t.openDependencies && t.openDependencies.length > 0 && (
                        <span className="text-[11px] text-violet-700">Waiting on {t.openDependencies.length}</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-500">{t.school_name ?? t.milestone_title ?? "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{t.assignee_name ?? "Unassigned"}</td>
                    <td className="px-3 py-2.5">
                      {t.priority === "high" ? (
                        <span className="rounded-full bg-red-50 px-2 py-px text-[11px] font-medium text-red-700">High</span>
                      ) : (
                        <span className="text-slate-700">{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 ${overdue ? "font-medium text-red-700" : "text-slate-600"}`}>
                      {t.due_date ? shortDate(t.due_date) : "—"}
                    </td>
                    <td className="px-4 py-2.5"><StatusControl task={t} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cancelled > 0 && (
        <p className="text-xs text-slate-500">
          {view === "list" && showCancelled
            ? `Showing ${cancelled} cancelled task${cancelled === 1 ? "" : "s"}. `
            : `${cancelled} cancelled task${cancelled === 1 ? "" : "s"} hidden. `}
          <button
            type="button"
            onClick={() => {
              setShowCancelled((v) => !v);
              setView("list");
            }}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            {view === "list" && showCancelled ? "Hide" : "Show in list"}
          </button>
        </p>
      )}
    </div>
  );
}
