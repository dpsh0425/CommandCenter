"use client";
import { updateSchoolStatus, type SchoolStatus } from "@/app/(app)/schools/actions";

const STATUSES: SchoolStatus[] = [
  "not_started", "researching", "contacted", "replied",
  "submitted", "interview", "accepted", "rejected",
];

export function StatusSelect({ schoolId, value }: { schoolId: string; value: SchoolStatus }) {
  return (
    <select
      defaultValue={value}
      onChange={(e) => updateSchoolStatus(schoolId, e.target.value as SchoolStatus)}
      className="border rounded px-2 py-1 text-sm"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s.replace("_", " ")}</option>
      ))}
    </select>
  );
}
