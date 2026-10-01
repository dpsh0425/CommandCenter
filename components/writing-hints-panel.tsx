"use client";
import { useDeferredValue } from "react";
import { writingHints } from "@/lib/writing-hints";

export function WritingHintsPanel({ text }: { text: string }) {
  const deferred = useDeferredValue(text);
  const hints = writingHints(deferred);
  return (
    <details className="text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-900">
        Writing hints
        {hints.length > 0 && <span className="rounded-full bg-blue-50 px-2 text-xs font-medium text-blue-700">{hints.length}</span>}
      </summary>
      <div className="pt-2 flex flex-col gap-2">
        {hints.length === 0 ? (
          <p className="text-xs text-slate-500">Nothing to flag. These checks look for very long sentences, many sentences starting the same way, and repeated words.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 list-disc pl-5 text-sm">
            {hints.map((h, i) => (
              <li key={i}>
                {h.message}
                {h.example && <span className="block text-xs text-slate-500">&ldquo;{h.example}&rdquo;</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Suggestions only. Nothing is changed for you.</p>
      </div>
    </details>
  );
}
