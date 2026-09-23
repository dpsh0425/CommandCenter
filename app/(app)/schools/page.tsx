import { createClient } from "@/lib/supabase/server";
import { SchoolTable } from "@/components/school-table";
import { researchGaps } from "@/lib/school-research";

export const metadata = { title: "Schools" };

const COUNTRIES = ["USA", "Canada", "Australia"];
const STATUSES = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];
const SORTS = [
  { key: "score", label: "Best fit" },
  { key: "deadline", label: "Deadline soonest" },
  { key: "researched", label: "Most researched" },
  { key: "name", label: "Name" },
];

type Params = { country?: string; status?: string; q?: string; verified?: string; sort?: string; researched?: string };

function href(current: Params, patch: Partial<Params>) {
  const next = { ...current, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/schools?${qs}` : "/schools";
}

const pill = (active: boolean) =>
  `px-3 py-1 rounded-full text-sm border ${active ? "bg-brass text-ink font-medium border-brass" : "hover:border-brass"}`;

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

  if (error) return <p className="p-4 md:p-8 text-red-600">Error loading schools: {error.message}</p>;

  const group = <T extends { school_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.school_id, [...(m.get(r.school_id) ?? []), r]);
    return m;
  };
  const profBy = group(professors);
  const deptBy = group(departments);
  const fundBy = group(fundings);

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
    };
  });

  if (researched === "1") rows = rows.filter((r) => r.hasResearch);
  if (sort === "deadline") rows.sort((a, b) => (a.deadline_date ?? "9999").localeCompare(b.deadline_date ?? "9999") || (b.composite_score ?? 0) - (a.composite_score ?? 0));
  else if (sort === "researched") rows.sort((a, b) => b.completeness - a.completeness || (b.composite_score ?? 0) - (a.composite_score ?? 0));
  else if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));

  const filtered = Boolean(country || status || q || verified || researched);
  const researchedTotal = (schools ?? []).length ? rows.filter((r) => r.hasResearch).length : 0;

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Target schools</h1>
          <p className="text-xs text-gray-500">{researchedTotal} with researched admissions info · <a href="/compare" className="underline hover:text-cream">compare deadlines and requirements</a></p>
        </div>
        <span className="text-sm text-gray-500">{rows.length} {filtered ? "matching" : "total"}</span>
      </div>

      <form action="/schools" className="flex gap-2">
        {country && <input type="hidden" name="country" value={country} />}
        {status && <input type="hidden" name="status" value={status} />}
        {verified && <input type="hidden" name="verified" value={verified} />}
        {researched && <input type="hidden" name="researched" value={researched} />}
        {sort !== "score" && <input type="hidden" name="sort" value={sort} />}
        <input name="q" defaultValue={q ?? ""} placeholder="Search school, faculty, or research area…" className="border rounded px-3 py-1.5 text-sm flex-1" />
        <button className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm">Search</button>
      </form>

      <div className="flex gap-2 flex-wrap items-center">
        <a href={href(params, { country: undefined })} className={pill(!country)}>All</a>
        {COUNTRIES.map((c) => <a key={c} href={href(params, { country: c })} className={pill(country === c)}>{c}</a>)}
        <span className="w-px h-5 bg-line mx-1" />
        <a href={href(params, { verified: verified === "1" ? undefined : "1" })} className={pill(verified === "1")}>Verified fit only</a>
        <a href={href(params, { researched: researched === "1" ? undefined : "1" })} className={pill(researched === "1")}>Researched only</a>
        <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          Sort
          {SORTS.map((s) => (
            <a key={s.key} href={href(params, { sort: s.key === "score" ? undefined : s.key })} className={`px-2 py-0.5 rounded border ${sort === s.key ? "border-brass text-cream" : "border-transparent hover:text-cream"}`}>{s.label}</a>
          ))}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <a href={href(params, { status: undefined })} className={pill(!status)}>Any status</a>
        {STATUSES.map((s) => <a key={s} href={href(params, { status: s })} className={pill(status === s)}>{s.replace("_", " ")}</a>)}
        {filtered && <a href="/schools" className="text-xs text-gray-500 underline ml-2">Clear all</a>}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed border-line rounded p-6 text-center">No schools match these filters.</p>
      ) : (
        <SchoolTable schools={rows} />
      )}
    </main>
  );
}
