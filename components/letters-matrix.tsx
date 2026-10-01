import Link from "next/link";
import { groupByRecommender, letterFlags, type LetterRecord } from "@/lib/letters";

const BADGE: Record<string, { label: string; cls: string }> = {
  not_asked: { label: "Not asked", cls: "bg-slate-100 text-slate-600" },
  asked: { label: "Asked", cls: "bg-blue-50 text-blue-700" },
  confirmed: { label: "Confirmed", cls: "bg-blue-100 text-blue-800" },
  submitted: { label: "Submitted", cls: "bg-emerald-50 text-emerald-700" },
};
const shortDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Recommenders down the side, schools across the top; each cell is one letter request. Built only from existing letters. */
export function LettersMatrix({ letters, today }: { letters: LetterRecord[]; today: string }) {
  if (letters.length === 0) return null;
  const groups = groupByRecommender(letters, today);
  const schoolMap = new Map<string, { id: string; name: string; due: string | null }>();
  for (const l of letters) {
    const cur = schoolMap.get(l.school_id);
    const due = cur?.due && l.letter_deadline ? (cur.due < l.letter_deadline ? cur.due : l.letter_deadline) : cur?.due ?? l.letter_deadline;
    schoolMap.set(l.school_id, { id: l.school_id, name: l.school_name, due });
  }
  const schools = Array.from(schoolMap.values()).sort((a, b) => (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31") || a.name.localeCompare(b.name));

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
        <h2 className="text-[15px] font-semibold text-slate-900">Who writes for which school</h2>
        <span className="text-xs text-slate-500">Each cell is one letter request</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" style={{ minWidth: 200 + schools.length * 130 }}>
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="sticky left-0 z-10 w-48 border-r border-slate-200 bg-slate-50 px-5 py-2.5 font-medium">Recommender</th>
              {schools.map((s) => (
                <th key={s.id} className="px-3 py-2.5 font-medium">
                  <Link href={`/schools/${s.id}?tab=application`} className="text-slate-700 hover:text-blue-700">{s.name}</Link>
                  {s.due && <span className="block font-normal text-slate-500">due {shortDate(s.due)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const bySchool = new Map(g.letters.map((l) => [l.school_id, l]));
              return (
                <tr key={g.key} className="border-t border-slate-100">
                  <th scope="row" className="sticky left-0 z-10 border-r border-slate-200 bg-white px-5 py-3 text-left font-semibold text-slate-900">
                    <a href={`#rec-${g.id ?? "none"}`} className="hover:text-blue-700">{g.name}</a>
                  </th>
                  {schools.map((s) => {
                    const l = bySchool.get(s.id);
                    if (!l) return <td key={s.id} className="px-3 py-3 text-slate-300" aria-label="No letter">—</td>;
                    const flags = letterFlags(l, today);
                    const badge = flags.includes("overdue")
                      ? { label: "Overdue", cls: "bg-red-50 text-red-700" }
                      : flags.includes("needs_reminder")
                        ? { label: `${BADGE[l.status]?.label ?? l.status} · remind`, cls: "bg-red-50 text-red-700" }
                        : BADGE[l.status] ?? { label: l.status, cls: "bg-slate-100 text-slate-600" };
                    return (
                      <td key={s.id} className="px-3 py-3">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
