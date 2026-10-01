import { createClient } from "@/lib/supabase/server";
import { SchoolTable } from "@/components/school-table";
import { researchGaps } from "@/lib/school-research";
import { SchoolFilters } from "@/components/school-filters";
import { PageHeader, SCHOOL_TABS, SubNav } from "@/components/ui";
import { PipelineBar } from "@/components/home";
import { loadReadiness } from "@/lib/readiness-data";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "Schools" };


type Params = { country?: string; status?: string; q?: string; verified?: string; sort?: string; researched?: string };

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { country, status, q, verified, sort = "score", researched } = params;
  const supabase = await createClient();

  let query = supabase.from("schools").select("*").order("composite_score", { ascending: false, nullsFirst: false });
  if (country) query = query.eq("country", country);
  if (status) query = query.eq("status", status);
  if (verified === "1") query = query.eq("verified_fit", true);
  if (q) {
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`name.ilike.%${term}%,faculty.ilike.%${term}%,fit_note.ilike.%${term}%`);
  }
  const [{ data: schools, error }, { data: professors }, { data: departments }, { data: fundings }] = await Promise.all([
    query,
    supabase.from("professors").select("school_id, accepting, outreach"),
    supabase.from("departments").select("school_id, deadline_date"),
    supabase.from("fundings").select("school_id"),
  ]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-4 md:p-8">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error loading schools: {error.message}</p>
      </main>
    );
  }

  // Readiness for the schools you're applying to (same loader Home uses), keyed by school.
  const readiness = await loadReadiness(supabase, todayString());
  const readinessBy = new Map(readiness.map((r) => [r.school.id, { risk: r.risk as string, doneCount: r.doneCount, total: r.total }]));

  const group = <T extends { school_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.school_id, [...(m.get(r.school_id) ?? []), r]);
    return m;
  };
  const profBy = group(professors);
  const deptBy = group(departments);
  const fundBy = group(fundings);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (schools ?? []).map((s: any) => {
    const profs = profBy.get(s.id) ?? [];
    const depts = deptBy.get(s.id) ?? [];
    const { completeness } = researchGaps(s, depts.length, profs, (fundBy.get(s.id) ?? []).length, depts.filter((d) => d.deadline_date).length);
    return {
      ...s,
      profCount: profs.length,
      takingStudents: profs.filter((p) => p.accepting === "yes").length,
      completeness,
      hasResearch: !!(s.deadline_date || s.gre_policy || s.application_fee != null || depts.length),
      readiness: readinessBy.get(s.id) ?? null,
    };
  });

  if (researched === "1") rows = rows.filter((r) => r.hasResearch);
  if (sort === "deadline") rows.sort((a, b) => (a.deadline_date ?? "9999").localeCompare(b.deadline_date ?? "9999") || (b.composite_score ?? 0) - (a.composite_score ?? 0));
  else if (sort === "researched") rows.sort((a, b) => b.completeness - a.completeness || (b.composite_score ?? 0) - (a.composite_score ?? 0));
  else if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));

  const filtered = Boolean(country || status || q || verified || researched);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const applyingCount = readiness.length;

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Applications"
          title="Schools"
          subtitle={`${rows.length} ${filtered ? "matching" : "in your list"}${applyingCount ? ` · ${applyingCount} applying` : ""}`}
        />
        <SubNav items={SCHOOL_TABS} current="/schools" />
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <PipelineBar counts={counts} total={rows.length} />
        </div>
      )}

      <SchoolFilters initial={{ country, status, q, verified, sort: sort === "score" ? undefined : sort, researched }} />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {filtered ? "No schools match these filters." : "No schools in your list yet."}
        </p>
      ) : (
        <SchoolTable schools={rows} />
      )}
    </main>
  );
}
