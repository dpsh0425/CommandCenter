"use client";
import { useState, useTransition } from "react";
import { updateSchoolStatus, type SchoolStatus } from "@/app/(app)/schools/actions";

const STATUSES: SchoolStatus[] = [
  "not_started", "researching", "contacted", "replied",
  "submitted", "interview", "accepted", "rejected",
];

export function StatusSelect({ schoolId, value }: { schoolId: string; value: SchoolStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
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
        className={`border rounded px-2 py-1 text-sm ${pending ? "opacity-50" : ""}`}
        aria-label="Application status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace("_", " ")}</option>
        ))}
      </select>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </span>
  );
}
