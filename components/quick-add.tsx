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

  const chip = (active: boolean) => `px-2.5 py-1 rounded-full text-xs border ${active ? "bg-brass text-ink font-medium border-brass" : "hover:border-brass"}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 px-4 z-50" onClick={() => setOpen(false)}>
      <div className="bg-surface-raised border border-line rounded-lg shadow-lg w-full max-w-md p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 border border-line rounded p-1">
            {(["task", "link"] as Mode[]).map((m) => (
              <button
                key={m} type="button" onClick={() => setMode(m)}
                className={`px-3 py-1 text-sm rounded ${mode === m ? "bg-surface text-cream font-medium" : "text-gray-500 hover:text-cream"}`}
              >
                {m === "task" ? "Task" : "Save link"}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Ctrl J · Esc to close</span>
        </div>

        <form
          className="flex flex-col gap-3"
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
              <input ref={firstField} name="title" required placeholder="What needs doing?" className="border rounded px-3 py-2 text-sm" autoComplete="off" />
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-500 mr-1">Due</span>
                <button type="button" className={chip(due === offset(0))} onClick={() => setDue(due === offset(0) ? "" : offset(0))}>Today</button>
                <button type="button" className={chip(due === offset(1))} onClick={() => setDue(due === offset(1) ? "" : offset(1))}>Tomorrow</button>
                <button type="button" className={chip(due === offset(7))} onClick={() => setDue(due === offset(7) ? "" : offset(7))}>Next week</button>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="border rounded px-2 py-0.5 text-xs" aria-label="Due date" />
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-xs text-gray-500 mr-1">Priority</span>
                {(["low", "medium", "high"] as const).map((p) => (
                  <button key={p} type="button" className={chip(priority === p)} onClick={() => setPriority(p)}>{p}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input ref={firstField} name="url" required placeholder="Paste a GitHub repo, paper, dataset or doc link" className="border rounded px-3 py-2 text-sm" autoComplete="off" />
              <input name="notes" placeholder="Note (optional)" className="border rounded px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400">GitHub repos and arXiv papers get their details filled in automatically. Attach it to a school or milestone from those pages.</p>
            </>
          )}
          {error && <p className="text-red-600 text-xs">{error}</p>}
          {done && <p className="text-teal-600 text-xs">{done}. Add another, or press Esc.</p>}
          <button disabled={pending} className="bg-brass text-ink font-medium rounded px-3 py-2 text-sm disabled:opacity-50">
            {pending ? "Saving…" : mode === "task" ? "Add task" : "Save link"}
          </button>
        </form>
      </div>
    </div>
  );
}
