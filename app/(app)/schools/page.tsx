import { createClient } from "@/lib/supabase/server";
import { SchoolTable } from "@/components/school-table";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("schools").select("*").order("composite_score", { ascending: false, nullsFirst: false });
  if (country) query = query.eq("country", country);
  const { data: schools, error } = await query;

  if (error) return <p className="p-8 text-red-600">Error loading schools: {error.message}</p>;

  const countries = ["USA", "Canada", "Australia"];

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Target schools</h1>
      <div className="flex gap-2 mb-4">
        <a href="/schools" className={`px-3 py-1 rounded-full text-sm border ${!country ? "bg-black text-white" : ""}`}>All</a>
        {countries.map((c) => (
          <a key={c} href={`/schools?country=${c}`} className={`px-3 py-1 rounded-full text-sm border ${country === c ? "bg-black text-white" : ""}`}>{c}</a>
        ))}
      </div>
      <SchoolTable schools={schools ?? []} />
    </main>
  );
}
