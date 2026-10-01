"use client";
import { useState } from "react";

// Copies a plain-text progress update, ready to paste into an email or chat to an advisor or team.
export function CopyUpdate({ text, label = "Copy as a progress update" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("failed"); }
        setTimeout(() => setState("idle"), 2200);
      }}
      className={`inline-flex h-8 items-center rounded-md border px-3 text-[13px] font-medium transition-colors ${
        state === "copied"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : state === "failed"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : label}</span>
    </button>
  );
}
