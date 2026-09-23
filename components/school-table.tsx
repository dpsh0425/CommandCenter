import Link from "next/link";
import { StatusSelect } from "./status-select";
import type { SchoolStatus } from "@/app/(app)/schools/actions";

type School = {
  id: string; name: string; country: string; faculty: string | null;
  fit_note: string | null; verified_fit: boolean; composite_score: number | null;
  csranking_nlp_rank: number | null; status: SchoolStatus;
  deadline_date: string | null; gre_policy: string | null; application_fee: number | null; fee_currency: string | null;
  tier: string | null; profCount: number; takingStudents: number; completeness: number; hasResearch: boolean;
};

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysUntil = (date: string, today: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
const TIER: Record<string, string> = { reach: "text-red-600 border-red-600", target: "text-brass border-brass", safe: "text-teal-600 border-teal-600" };
const GRE: Record<string, string> = { required: "GRE required", optional: "GRE optional", not_accepted: "No GRE" };

function Facts({ s, today }: { s: School; today: string }) {
  const d = s.deadline_date ? daysUntil(s.deadline_date, today) : null;
  return (
    <div className="flex flex-col gap-1 text-xs">
      {s.deadline_date ? (
        <span className={`font-mono ${d! < 0 ? "text-red-600" : d! <= 30 ? "text-brass" : "text-gray-500"}`}>
          due {s.deadline_date} · {d! < 0 ? `${-d!}d ago` : d === 0 ? "today" : `in ${d}d`}
        </span>
      ) : (
        <span className="text-gray-400 italic">deadline unknown</span>
      )}
      <span className="text-gray-500">
        {[s.gre_policy ? GRE[s.gre_policy] : null, s.application_fee != null ? `${s.fee_currency ?? "USD"} ${s.application_fee} fee` : null].filter(Boolean).join(" · ") || <span className="text-gray-400 italic">requirements unknown</span>}
      </span>
    </div>
  );
}

function Research({ s }: { s: School }) {
  return (
    <div className="flex flex-col gap-1 text-xs min-w-[7rem]">
      <div className="flex items-center gap-2">
        <span className="w-16 h-1.5 rounded bg-surface-raised overflow-hidden inline-block">
          <span className={`block h-full ${s.completeness >= 70 ? "bg-teal-600" : "bg-brass"}`} style={{ width: `${s.completeness}%` }} />
        </span>
        <span className="font-mono text-gray-500">{s.completeness}%</span>
      </div>
      <span className="text-gray-500">
        {s.profCount > 0 ? `${s.profCount} prof${s.profCount === 1 ? "" : "s"}${s.takingStudents ? ` · ${s.takingStudents} taking` : ""}` : <span className="text-gray-400 italic">no faculty yet</span>}
      </span>
    </div>
  );
}

export function SchoolTable({ schools }: { schools: School[] }) {
  const today = localDate(new Date());
  return (
    <>
      <ul className="md:hidden flex flex-col gap-3">
        {schools.map((s) => (
          <li key={s.id} className="border border-line bg-surface rounded-lg p-3 flex flex-col gap-2">
            <div className="flex justify-between gap-3 items-start">
              <div className="min-w-0">
                <Link href={`/schools/${s.id}`} className="font-medium">{s.name}</Link>
                <div className="text-xs text-gray-500 flex gap-2 items-center flex-wrap">
                  {s.country}{s.verified_fit && " · verified fit"}
                  {s.tier && <span className={`border rounded-full px-1.5 uppercase text-[10px] ${TIER[s.tier]}`}>{s.tier}</span>}
                </div>
              </div>
              <div className="font-mono text-right flex-shrink-0">
                {s.composite_score?.toFixed(1) ?? "—"}
                <div className="text-[10px] text-gray-400">rank #{s.csranking_nlp_rank ?? "?"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-2">
              <Facts s={s} today={today} />
              <Research s={s} />
            </div>
            <StatusSelect schoolId={s.id} value={s.status} />
          </li>
        ))}
      </ul>

      <table className="hidden md:table w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 border-b">
            <th className="py-2 pr-3">School</th>
            <th className="py-2 pr-3">Application</th>
            <th className="py-2 pr-3">Research</th>
            <th className="py-2 pr-3">Fit</th>
            <th className="py-2 pr-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr key={s.id} className="border-b align-top">
              <td className="py-3 pr-3 max-w-xs">
                <Link href={`/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                <div className="text-xs text-gray-500 flex gap-2 items-center flex-wrap">
                  {s.country}{s.verified_fit && " · verified fit"}
                  {s.tier && <span className={`border rounded-full px-1.5 uppercase text-[10px] ${TIER[s.tier]}`}>{s.tier}</span>}
                </div>
                {s.faculty && <div className="text-xs text-gray-500 mt-1 truncate" title={s.fit_note ?? undefined}>{s.faculty}</div>}
              </td>
              <td className="py-3 pr-3"><Facts s={s} today={today} /></td>
              <td className="py-3 pr-3"><Research s={s} /></td>
              <td className="py-3 pr-3 font-mono">
                {s.composite_score?.toFixed(1) ?? "—"}
                <div className="text-xs text-gray-400">rank #{s.csranking_nlp_rank ?? "?"}</div>
              </td>
              <td className="py-3 pr-3"><StatusSelect schoolId={s.id} value={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
