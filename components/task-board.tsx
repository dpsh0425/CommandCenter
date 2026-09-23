"use client";
import Link from "next/link";
import { updateTaskStatus } from "@/app/(app)/tasks/actions";

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: "todo", label: "To do" }, { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" }, { key: "done", label: "Done" },
];

type Task = {
  id: string; title: string; status: string; priority: string; due_date: string | null;
  school_name?: string | null; milestone_title?: string | null; assignee_name?: string | null;
};

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {COLUMNS.map((col) => (
        <div key={col.key} className="border rounded p-2 bg-gray-50">
          <div className="text-xs uppercase text-gray-500 mb-2 flex justify-between">
            <span>{col.label}</span><span>{tasks.filter((t) => t.status === col.key).length}</span>
          </div>
          {tasks.filter((t) => t.status === col.key).map((t) => (
            <div key={t.id} className="bg-white border rounded p-2 mb-2 text-sm">
              <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
              {t.school_name && <div className="text-xs text-teal-700 mt-1">{t.school_name}</div>}
              {t.milestone_title && <div className="text-xs text-violet-700 mt-1">{t.milestone_title}</div>}
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>{t.assignee_name ?? "Unassigned"}</span>
                <select
                  value={t.status}
                  onChange={(e) => updateTaskStatus(t.id, e.target.value as any)}
                  className="border rounded text-xs px-1 py-0.5"
                >
                  {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
