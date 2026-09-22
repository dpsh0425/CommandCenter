import Link from "next/link";
import { StatusSelect } from "./status-select";
import type { SchoolStatus } from "@/app/(app)/schools/actions";

type School = {
  id: string; name: string; country: string; faculty: string | null;
  fit_note: string | null; verified_fit: boolean; composite_score: number | null;
  csranking_nlp_rank: number | null; status: SchoolStatus;
};

export function SchoolTable({ schools }: { schools: School[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-xs uppercase text-gray-500 border-b">
          <th className="py-2 pr-3">School</th>
          <th className="py-2 pr-3">Faculty / fit</th>
          <th className="py-2 pr-3">Score</th>
          <th className="py-2 pr-3">Status</th>
        </tr>
      </thead>
      <tbody>
        {schools.map((s) => (
          <tr key={s.id} className="border-b">
            <td className="py-2 pr-3">
              <Link href={`/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
              <div className="text-xs text-gray-500">{s.country}{s.verified_fit && " · verified fit"}</div>
            </td>
            <td className="py-2 pr-3 text-gray-600 max-w-sm">
              <strong>{s.faculty}</strong><br />{s.fit_note}
            </td>
            <td className="py-2 pr-3 font-mono">
              {s.composite_score?.toFixed(1) ?? "—"}
              <div className="text-xs text-gray-400">heuristic, not verified · rank #{s.csranking_nlp_rank ?? "?"}</div>
            </td>
            <td className="py-2 pr-3"><StatusSelect schoolId={s.id} value={s.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
