import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { researchGaps } from "@/lib/school-research";
import { PageHeader, SCHOOL_TABS, SubNav } from "@/components/ui";
import { FIT_SCORE_HELP } from "@/components/school-table";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "Compare schools" };

const daysUntil = (date: string, today: string) =>
  Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
const GRE: Record<string, string> = { required: "Required", optional: "Optional", not_accepted: "Not considered" };
const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  reach: { label: "Reach", cls: "bg-red-50 text-red-700" },
  target: { label: "Target", cls: "bg-blue-50 text-blue-700" },
  safe: { label: "Safe", cls: "bg-emerald-50 text-emerald-700" },
};
const FUND_RANK: Record<string, number> = { awarded: 0, applied: 1, eligible: 2, to_research: 3, not_eligible: 4 };
const PERIOD: Record<string, string> = { year: "/yr", yearly: "/yr", annual: "/yr", month: "/mo", monthly: "/mo", total: " total", one_time: " once" };

const Unknown = () => <span className="text-[13px] text-slate-400">Unknown</span>;

export default async function ComparePage() {
  const supabase = await createClient();
  const [{ data: schools }, { data: professors }, { data: departments }, { data: fundings }] = await Promise.all([
    supabase.from("schools").select("*"),
    supabase.from("professors").select("school_id, accepting, outreach, fit_score"),
    supabase.from("departments").select("school_id, deadline_date"),
    supabase.from("fundings").select("school_id, name, status, amount, currency, period"),
  ]);
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();

  const by = <T extends { school_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.school_id, [...(m.get(r.school_id) ?? []), r]);
    return m;
  };
  const profBy = by(professors), deptBy = by(departments), fundBy = by(fundings);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const cols = (schools ?? [])
    .filter((s: any) => s.deadline_date || s.gre_policy || s.application_fee != null || s.tier || (deptBy.get(s.id) ?? []).length)
    .map((s: any) => {
      const profs = profBy.get(s.id) ?? [], depts = deptBy.get(s.id) ?? [], funds = fundBy.get(s.id) ?? [];
      return { s, profs, funds, completeness: researchGaps(s, depts.length, profs, funds.length, depts.filter((d) => d.deadline_date).length).completeness };
    })
    .sort((a, b) => (a.s.deadline_date ?? "9999").localeCompare(b.s.deadline_date ?? "9999"));

  const rows: Array<{ label: React.ReactNode; key: string; cell: (c: (typeof cols)[number]) => React.ReactNode }> = [
    {
      key: "fit",
      label: (
        <span className="inline-flex items-center gap-1">
          Fit score
          <span title={FIT_SCORE_HELP} aria-label={FIT_SCORE_HELP} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500">i</span>
        </span>
      ),
      cell: ({ s }) => (s.composite_score != null ? (
        <span className="tabular-nums">
          <span className="font-semibold text-slate-900">{Number(s.composite_score).toFixed(1)}</span>
          <span className="block text-xs text-slate-500">NLP rank #{s.csranking_nlp_rank ?? "?"}</span>
        </span>
      ) : <Unknown />),
    },
    { key: "tier", label: "Your call", cell: ({ s }) => (s.tier && TIER_BADGE[s.tier] ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_BADGE[s.tier].cls}`}>{TIER_BADGE[s.tier].label}</span> : <Unknown />) },
    {
      key: "deadline",
      label: "Deadline",
      cell: ({ s }) => {
        if (!s.deadline_date) return <Unknown />;
        const d = daysUntil(s.deadline_date, today);
        return (
          <div>
            <div className="text-[15px] font-semibold text-slate-900">{new Date(s.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            <div className={`text-xs ${d < 0 || d <= 30 ? "font-medium text-red-700" : "text-slate-500"}`}>{d < 0 ? `${-d}d ago` : d === 0 ? "today" : `in ${d} days`}</div>
          </div>
        );
      },
    },
    { key: "fee", label: "Application fee", cell: ({ s }) => (s.application_fee != null ? <span className="tabular-nums text-slate-900">{s.fee_currency} {Number(s.application_fee)}</span> : <Unknown />) },
    { key: "gre", label: "GRE", cell: ({ s }) => (s.gre_policy ? <span className="text-slate-900">{GRE[s.gre_policy]}</span> : <Unknown />) },
    { key: "english", label: "English test", cell: ({ s }) => (s.english_test ? <span className="line-clamp-4 text-xs text-slate-600" title={s.english_test}>{s.english_test}</span> : <Unknown />) },
    { key: "letters", label: "Letters", cell: ({ s }) => (s.letters_required != null ? <span className="text-slate-900">{s.letters_required}</span> : <Unknown />) },
    {
      key: "funding",
      label: "Funding",
      cell: ({ s, funds }) => {
        const best = [...funds].sort((a, b) => FUND_RANK[a.status] - FUND_RANK[b.status])[0];
        if (!s.funding_guarantee && !best) return <Unknown />;
        const amount = best?.amount != null ? `${best.currency ?? ""} ${Number(best.amount).toLocaleString()}${best.period ? PERIOD[best.period] ?? ` / ${String(best.period).replace(/_/g, " ")}` : ""}`.trim() : null;
        return (
          <div className="flex flex-col gap-1 text-xs">
            {s.funding_guarantee && <span className="line-clamp-4 text-slate-600" title={s.funding_guarantee}>{s.funding_guarantee}</span>}
            {amount && <span className="font-semibold text-slate-900">{amount}</span>}
            {best && <span className="text-slate-500">{funds.length} tracked · best is {best.status.replace(/_/g, " ")}</span>}
          </div>
        );
      },
    },
    {
      key: "faculty",
      label: "Faculty",
      cell: ({ profs }) => profs.length === 0 ? <Unknown /> : (
        <div className="text-xs">
          <div className="text-[13px] text-slate-900">{profs.length} professor{profs.length === 1 ? "" : "s"}</div>
          <div className="text-slate-500">{profs.filter((p) => p.accepting === "yes").length} taking · {profs.filter((p) => p.accepting === "no").length} not taking · {profs.filter((p) => p.accepting === "unknown").length} unknown</div>
        </div>
      ),
    },
    {
      key: "researched",
      label: "Researched",
      cell: ({ completeness }) => (
        <span className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${completeness >= 70 ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${completeness}%` }} /></span>
          <span className="text-xs tabular-nums text-slate-600">{completeness}%</span>
        </span>
      ),
    },
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Applications" title="Compare" subtitle="Researched schools side by side, soonest deadline first. Gaps say “Unknown”." />
        <SubNav items={SCHOOL_TABS} current="/compare" />
      </div>

      {cols.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No schools researched yet</p>
          <p className="mt-1 text-[13px] text-slate-500">Fill in a school&apos;s Admissions tab and it appears here.</p>
          <Link href="/schools" className="mt-3 inline-block text-[13px] font-medium text-blue-600 hover:text-blue-700">Go to schools →</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm md:min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 w-24 border-r border-slate-200 bg-slate-50 md:w-32" />
                  {cols.map(({ s }) => (
                    <th key={s.id} className="min-w-[10rem] px-4 py-3 text-left align-bottom font-normal md:min-w-[11rem]">
                      <Link href={`/schools/${s.id}`} className="text-[15px] font-semibold leading-tight text-slate-900 hover:text-blue-600">{s.name}</Link>
                      <div className="text-xs text-slate-500">{s.city ?? s.country}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-slate-100 align-top last:border-0">
                    <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left align-top text-xs font-medium text-slate-500 md:whitespace-nowrap md:text-[13px]">{r.label}</th>
                    {cols.map((c) => <td key={c.s.id} className="px-4 py-3">{r.cell(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
