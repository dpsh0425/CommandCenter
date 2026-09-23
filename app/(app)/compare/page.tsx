import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { researchGaps } from "@/lib/school-research";
import { PageHeader, SCHOOL_TABS, SubNav } from "@/components/ui";

export const metadata = { title: "Compare schools" };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysUntil = (date: string, today: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
const GRE: Record<string, string> = { required: "Required", optional: "Optional", not_accepted: "Not considered" };
const TIER_TONE: Record<string, string> = { reach: "text-red-600", target: "text-brass", safe: "text-teal-600" };
const FUND_RANK: Record<string, number> = { awarded: 0, applied: 1, eligible: 2, to_research: 3, not_eligible: 4 };

const Unknown = () => <span className="text-gray-400 text-sm">Unknown</span>;

export default async function ComparePage() {
  const supabase = await createClient();
  const [{ data: schools }, { data: professors }, { data: departments }, { data: fundings }] = await Promise.all([
    supabase.from("schools").select("*"),
    supabase.from("professors").select("school_id, accepting, outreach, fit_score"),
    supabase.from("departments").select("school_id, deadline_date"),
    supabase.from("fundings").select("school_id, name, status, amount, currency, period"),
  ]);
  const today = localDate(new Date());

  const by = <T extends { school_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.school_id, [...(m.get(r.school_id) ?? []), r]);
    return m;
  };
  const profBy = by(professors), deptBy = by(departments), fundBy = by(fundings);

  const cols = (schools ?? [])
    .filter((s: any) => s.deadline_date || s.gre_policy || s.application_fee != null || s.tier || (deptBy.get(s.id) ?? []).length)
    .map((s: any) => {
      const profs = profBy.get(s.id) ?? [], depts = deptBy.get(s.id) ?? [], funds = fundBy.get(s.id) ?? [];
      return { s, profs, funds, completeness: researchGaps(s, depts.length, profs, funds.length, depts.filter((d) => d.deadline_date).length).completeness };
    })
    .sort((a, b) => (a.s.deadline_date ?? "9999").localeCompare(b.s.deadline_date ?? "9999"));

  const rows: Array<{ label: string; cell: (c: (typeof cols)[number]) => React.ReactNode }> = [
    { label: "Fit score", cell: ({ s }) => (s.composite_score != null ? <span className="font-mono">{Number(s.composite_score).toFixed(1)} <span className="text-gray-400 text-xs">rank #{s.csranking_nlp_rank ?? "?"}</span></span> : <Unknown />) },
    { label: "Your call", cell: ({ s }) => (s.tier ? <span className={`uppercase text-xs font-medium ${TIER_TONE[s.tier]}`}>{s.tier}</span> : <Unknown />) },
    {
      label: "Deadline",
      cell: ({ s }) => {
        if (!s.deadline_date) return <Unknown />;
        const d = daysUntil(s.deadline_date, today);
        return (
          <div>
            <div className="font-serif text-xl leading-tight">{new Date(s.deadline_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
            <div className={`text-xs ${d < 0 ? "text-red-600" : d <= 45 ? "text-brass" : "text-gray-500"}`}>{d < 0 ? `${-d}d ago` : d === 0 ? "today" : `in ${d} days`}</div>
          </div>
        );
      },
    },
    { label: "Application fee", cell: ({ s }) => (s.application_fee != null ? <span className="font-mono">{s.fee_currency} {Number(s.application_fee)}</span> : <Unknown />) },
    { label: "GRE", cell: ({ s }) => (s.gre_policy ? GRE[s.gre_policy] : <Unknown />) },
    { label: "English test", cell: ({ s }) => (s.english_test ? <span className="text-xs text-gray-500 line-clamp-4" title={s.english_test}>{s.english_test}</span> : <Unknown />) },
    { label: "Letters", cell: ({ s }) => (s.letters_required != null ? s.letters_required : <Unknown />) },
    { label: "Funding", cell: ({ s, funds }) => {
        const best = [...funds].sort((a, b) => FUND_RANK[a.status] - FUND_RANK[b.status])[0];
        if (!s.funding_guarantee && !best) return <Unknown />;
        return (
          <div className="text-xs text-gray-500 flex flex-col gap-1">
            {s.funding_guarantee && <span className="line-clamp-4" title={s.funding_guarantee}>{s.funding_guarantee}</span>}
            {best && <span className="text-cream">{funds.length} tracked · {best.status.replace("_", " ")}</span>}
          </div>
        );
      } },
    { label: "Faculty", cell: ({ profs }) => profs.length === 0 ? <Unknown /> : (
        <div className="text-xs">
          <div>{profs.length} professor{profs.length === 1 ? "" : "s"}</div>
          <div className="text-gray-500">{profs.filter((p) => p.accepting === "yes").length} taking · {profs.filter((p) => p.accepting === "no").length} not taking · {profs.filter((p) => p.accepting === "unknown").length} unknown</div>
        </div>
      ) },
    { label: "Researched", cell: ({ completeness }) => (
        <span className="flex items-center gap-2">
          <span className="w-14 h-1.5 rounded bg-surface-raised overflow-hidden inline-block"><span className={`block h-full ${completeness >= 70 ? "bg-teal-600" : "bg-brass"}`} style={{ width: `${completeness}%` }} /></span>
          <span className="font-mono text-xs text-gray-500">{completeness}%</span>
        </span>
      ) },
  ];

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <PageHeader title="Compare" subtitle="Researched schools side by side, soonest deadline first. Gaps say “unknown”." />
        <SubNav items={SCHOOL_TABS} current="/compare" />
      </div>

      {cols.length === 0 ? (
        <p className="text-sm text-gray-500">No schools researched yet. Fill in a school's Admissions tab and it appears here.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-sm border-collapse min-w-[560px] md:min-w-[720px]">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 bg-ink z-10 w-20 md:w-28" />
                {cols.map(({ s }) => (
                  <th key={s.id} className="py-3 pr-5 text-left align-bottom min-w-[10rem] md:min-w-[11rem] font-normal">
                    <Link href={`/schools/${s.id}`} className="font-serif text-xl leading-tight hover:text-brass">{s.name}</Link>
                    <div className="text-xs text-gray-500">{s.city ?? s.country}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line/60 align-top">
                  <th className="sticky left-0 bg-ink z-10 py-3 pr-3 text-left text-xs md:text-sm text-gray-500 font-normal md:whitespace-nowrap align-top">{r.label}</th>
                  {cols.map((c) => <td key={c.s.id} className="py-3 pr-6">{r.cell(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
