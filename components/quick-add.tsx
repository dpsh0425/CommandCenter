"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createTask } from "@/app/(app)/tasks/actions";
import { addLink } from "@/app/(app)/links/actions";

type Mode = "task" | "link";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const offset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
};

const fieldClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600";

export function QuickAdd({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [mode, setMode] = useState<Mode>("task");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setError(null);
      setDone(null);
      setTimeout(() => firstField.current?.focus(), 30);
    }
  }, [open, mode]);

  if (!open) return null;

  const chip = (active: boolean) =>
    `h-7 rounded-full border px-2.5 text-xs font-medium capitalize transition-colors ${
      active
        ? "border-blue-600 bg-blue-600 text-white"
        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick add"
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div role="group" aria-label="What to add" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(["task", "link"] as Mode[]).map((m) => (
              <button
                key={m} type="button" onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`h-8 rounded-md px-3 text-[13px] font-semibold transition-colors ${
                  mode === m ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m === "task" ? "Task" : "Save link"}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-slate-500">Ctrl J · Esc to close</span>
        </div>

        <form
          className="flex flex-col gap-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            setError(null);
            setDone(null);
            if (mode === "task") {
              const title = String(f.get("title") ?? "").trim();
              if (!title) return;
              start(async () => {
                try {
                  await createTask({ title, dueDate: due || undefined, priority });
                  form.reset();
                  setDue("");
                  setDone(`Task added${due ? ` for ${due}` : ""}`);
                  firstField.current?.focus();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add task");
                }
              });
            } else {
              const url = String(f.get("url") ?? "").trim();
              if (!url) return;
              start(async () => {
                try {
                  await addLink({ url, notes: String(f.get("notes") ?? "").trim() || undefined });
                  form.reset();
                  setDone("Saved to your Library");
                  firstField.current?.focus();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not save link");
                }
              });
            }
          }}
        >
          {mode === "task" ? (
            <>
              <input ref={firstField} name="title" required placeholder="What needs doing?" aria-label="Task title" className={fieldClass} autoComplete="off" />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-14 text-xs font-medium text-slate-600">Due</span>
                <button type="button" className={chip(due === offset(0))} onClick={() => setDue(due === offset(0) ? "" : offset(0))}>Today</button>
                <button type="button" className={chip(due === offset(1))} onClick={() => setDue(due === offset(1) ? "" : offset(1))}>Tomorrow</button>
                <button type="button" className={chip(due === offset(7))} onClick={() => setDue(due === offset(7) ? "" : offset(7))}>Next week</button>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900" aria-label="Due date" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="mr-1 w-14 text-xs font-medium text-slate-600">Priority</span>
                {(["low", "medium", "high"] as const).map((p) => (
                  <button key={p} type="button" className={chip(priority === p)} onClick={() => setPriority(p)}>{p}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input ref={firstField} name="url" required placeholder="Paste a GitHub repo, paper, dataset or doc link" aria-label="Link" className={fieldClass} autoComplete="off" />
              <input name="notes" placeholder="Note (optional)" aria-label="Note" className={fieldClass} />
              <p className="text-xs leading-5 text-slate-500">GitHub repos and arXiv papers get their details filled in automatically. Attach it to a school or milestone from those pages.</p>
            </>
          )}
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          {done && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{done}. Add another, or press Esc.</p>}
          <button disabled={pending} className="h-10 rounded-md bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? "Saving…" : mode === "task" ? "Add task" : "Save link"}
          </button>
        </form>
      </div>
    </div>
  );
}
