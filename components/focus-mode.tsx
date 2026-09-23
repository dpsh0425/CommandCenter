"use client";
import { useEffect, useState } from "react";
import { startFocusSession, endFocusSession } from "@/app/(app)/tasks/focus-actions";
import { addTaskUpdate } from "@/app/(app)/tasks/actions";

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

  if (!active) return <button onClick={start} className="border border-brass text-brass rounded px-3 py-1.5 text-sm hover:bg-surface-raised">▶ Start 25-min focus session</button>;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 bg-ink flex flex-col items-center justify-center gap-6 z-50">
      <p className="text-sm text-gray-500">Focused on</p>
      <h1 className="text-3xl font-semibold text-center max-w-md">{title}</h1>
      <div className="text-6xl font-mono">{mm}:{ss}</div>
      <input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="What happened during this session…"
        className="border rounded px-3 py-2 text-sm w-80"
      />
      <button onClick={finish} className="text-sm text-gray-500 underline">End session</button>
    </div>
  );
}
