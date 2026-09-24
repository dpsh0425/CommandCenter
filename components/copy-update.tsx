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
      className="text-xs text-gray-500 hover:text-cream"
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : label}
    </button>
  );
}
