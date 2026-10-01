"use client";
import { useState } from "react";
import { toggleAction } from "@/app/(app)/actions-list/actions";

// One checklist row: the checkbox and its text share a label, so the whole row is clickable.
export function ActionCheckbox({ id, done, text }: { id: string; done: boolean; text?: string }) {
  const [checked, setChecked] = useState(done);
  const [failed, setFailed] = useState(false);

  async function onChange(next: boolean) {
    setChecked(next);
    setFailed(false);
    try {
      await toggleAction(id, next);
    } catch {
      setChecked(!next);
      setFailed(true);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] flex-shrink-0 cursor-pointer rounded border-slate-400 accent-blue-600"
      />
      <span className="min-w-0 flex-1">
        {text !== undefined && (
          <span className={`block text-sm ${checked ? "text-slate-400 line-through" : "text-slate-900"}`}>{text}</span>
        )}
        {failed && <span role="alert" className="block text-xs text-red-700">Couldn&apos;t save. Try again.</span>}
      </span>
    </label>
  );
}
