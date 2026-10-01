"use client";
import { useState, useTransition } from "react";
import { updateSchoolStatus, type SchoolStatus } from "@/app/(app)/schools/actions";

const STATUSES: SchoolStatus[] = [
  "not_started", "researching", "contacted", "replied",
  "submitted", "interview", "accepted", "rejected",
];
const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function StatusSelect({ schoolId, value }: { schoolId: string; value: SchoolStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex w-full max-w-[180px] flex-col gap-1">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          start(async () => {
            try {
              await updateSchoolStatus(schoolId, e.target.value as SchoolStatus);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update");
            }
          });
        }}
        className={`h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-900 hover:border-slate-400 ${pending ? "opacity-50" : ""}`}
        aria-label="Application status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{label(s)}</option>
        ))}
      </select>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
