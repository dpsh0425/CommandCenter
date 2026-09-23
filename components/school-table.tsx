import Link from "next/link";
import { StatusSelect } from "./status-select";
import type { SchoolStatus } from "@/app/(app)/schools/actions";

type School = {
  id: string; name: string; country: string; faculty: string | null;
  fit_note: string | null; verified_fit: boolean; composite_score: number | null;
  csranking_nlp_rank: number | null; status: SchoolStatus;
  deadline_date: string | null; tier: string | null; profCount: number; takingStudents: number; completeness: number; hasResearch: boolean;
};

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysUntil = (date: string, today: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
const TIER: Record<string, string> = { reach: "text-red-600", target: "text-brass", safe: "text-teal-600" };

function Deadline({ s, today }: { s: School; today: string }) {
  if (!s.deadline_date) return <span className="text-sm text-gray-400">Not researched</span>;
  const d = daysUntil(s.deadline_date, today);
  const date = new Date(s.deadline_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <span className="text-sm whitespace-nowrap text-right md:text-left">
      <span className="block">{date}</span>
      <span className={`block text-xs ${d < 0 ? "text-red-600" : d <= 30 ? "text-brass" : "text-gray-500"}`}>{d < 0 ? `${-d} days ago` : d === 0 ? "today" : `${d} days`}</span>
    </span>
  );
}

// One quiet line under the name: who, how much is known.
function detail(s: School) {
  return [
    s.faculty,
    s.profCount > 0 ? `${s.profCount} professor${s.profCount === 1 ? "" : "s"}` : null,
    s.hasResearch ? `${s.completeness}% researched` : null,
  ].filter(Boolean).join(" · ");
}

export function SchoolTable({ schools }: { schools: School[] }) {
  const today = localDate(new Date());
  return (
    <>
      <ul className="md:hidden flex flex-col divide-y divide-line">
        {schools.map((s) => (
          <li key={s.id} className="py-3 flex flex-col gap-2">
            <div className="flex justify-between gap-3 items-start">
              <div className="min-w-0">
                <Link href={`/schools/${s.id}`} className="font-medium">{s.name}</Link>
                <div className="text-xs text-gray-500">{detail(s) || s.country}</div>
              </div>
              <Deadline s={s} today={today} />
            </div>
            <StatusSelect schoolId={s.id} value={s.status} />
          </li>
        ))}
      </ul>

      <table className="hidden md:table w-full border-collapse">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-line">
            <th className="py-2 pr-4 font-normal">School</th>
            <th className="py-2 pr-4 font-normal w-32">Deadline</th>
            <th className="py-2 pr-4 font-normal w-20">Fit</th>
            <th className="py-2 font-normal w-40">Status</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr key={s.id} className="border-b border-line/60 align-top">
              <td className="py-3 pr-4">
                <Link href={`/schools/${s.id}`} className="font-medium hover:text-brass">{s.name}</Link>
                {s.tier && <span className={`ml-2 text-xs uppercase ${TIER[s.tier]}`}>{s.tier}</span>}
                <div className="text-xs text-gray-500 mt-0.5 truncate max-w-md" title={s.fit_note ?? undefined}>{detail(s) || s.country}</div>
              </td>
              <td className="py-3 pr-4"><Deadline s={s} today={today} /></td>
              <td className="py-3 pr-4 font-mono text-sm">{s.composite_score?.toFixed(0) ?? "—"}</td>
              <td className="py-3"><StatusSelect schoolId={s.id} value={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
