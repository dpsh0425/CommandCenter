"use client";
import { useEffect, useState } from "react";
import { startFocusSession, endFocusSession } from "@/app/(app)/tasks/focus-actions";
import { addTaskUpdate } from "@/app/(app)/tasks/actions";

const TOTAL = 25 * 60;

export function FocusMode({ taskId, title }: { taskId: string; title: string }) {
  const [active, setActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!active) return;
    if (secondsLeft <= 0) { finish(); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [active, secondsLeft]);

  async function start() {
    const id = await startFocusSession(taskId, 25);
    setSessionId(id);
    setSecondsLeft(25 * 60);
    setActive(true);
  }

  async function finish() {
    setActive(false);
    if (sessionId) await endFocusSession(sessionId);
    if (note.trim()) await addTaskUpdate(taskId, "note", `Focus session: ${note.trim()}`);
    setNote("");
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={start}
        className="flex h-[38px] w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        Start 25-min focus session
      </button>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const pct = Math.round(((TOTAL - secondsLeft) / TOTAL) * 100);

  return (
    <div role="dialog" aria-modal="true" aria-label="Focus session" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-50 px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">Focused on</p>
      <h1 className="max-w-xl text-center text-2xl font-semibold leading-8 text-slate-900 md:text-3xl">{title}</h1>
      <div className="font-mono text-6xl font-medium tabular-nums text-slate-900 md:text-7xl" aria-live="off">{mm}:{ss}</div>
      <div className="h-1.5 w-72 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Session progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-blue-600 transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="What happened during this session…"
        aria-label="Session note"
        className="h-10 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600"
      />
      <button
        type="button"
        onClick={finish}
        className="h-9 rounded-md border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100"
      >
        End session
      </button>
    </div>
  );
}
