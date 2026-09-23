import { createClient } from "@/lib/supabase/server";
import { SchoolTable } from "@/components/school-table";

const COUNTRIES = ["USA", "Canada", "Australia"];
const STATUSES = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];

type Params = { country?: string; status?: string; q?: string; verified?: string };

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
  const { country, status, q, verified } = params;
  const supabase = await createClient();

  let query = supabase.from("schools").select("*").order("composite_score", { ascending: false, nullsFirst: false });
  if (country) query = query.eq("country", country);
  if (status) query = query.eq("status", status);
  if (verified === "1") query = query.eq("verified_fit", true);
  if (q) {
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`name.ilike.%${term}%,faculty.ilike.%${term}%,fit_note.ilike.%${term}%`);
  }
  const { data: schools, error } = await query;

  if (error) return <p className="p-4 md:p-8 text-red-600">Error loading schools: {error.message}</p>;

  const filtered = Boolean(country || status || q || verified);

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Target schools</h1>
        <span className="text-sm text-gray-500">
          {schools?.length ?? 0} {filtered ? "matching" : "total"}
        </span>
      </div>

      <form action="/schools" className="flex gap-2">
        {country && <input type="hidden" name="country" value={country} />}
        {status && <input type="hidden" name="status" value={status} />}
        {verified && <input type="hidden" name="verified" value={verified} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search school, faculty, or research area…"
          className="border rounded px-3 py-1.5 text-sm flex-1"
        />
        <button className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm">Search</button>
      </form>

      <div className="flex gap-2 flex-wrap items-center">
        <a href={href(params, { country: undefined })} className={pill(!country)}>All</a>
        {COUNTRIES.map((c) => (
          <a key={c} href={href(params, { country: c })} className={pill(country === c)}>{c}</a>
        ))}
        <span className="w-px h-5 bg-line mx-1" />
        <a href={href(params, { verified: verified === "1" ? undefined : "1" })} className={pill(verified === "1")}>
          Verified fit only
        </a>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <a href={href(params, { status: undefined })} className={pill(!status)}>Any status</a>
        {STATUSES.map((s) => (
          <a key={s} href={href(params, { status: s })} className={pill(status === s)}>{s.replace("_", " ")}</a>
        ))}
        {filtered && (
          <a href="/schools" className="text-xs text-gray-500 underline ml-2">Clear all</a>
        )}
      </div>

      {(schools ?? []).length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed border-line rounded p-6 text-center">
          No schools match these filters.
        </p>
      ) : (
        <SchoolTable schools={schools ?? []} />
      )}
    </main>
  );
}
