import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OutreachBoard, type OutreachProf } from "@/components/outreach-board";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Outreach" };

export default async function OutreachPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professors")
    .select("id, name, title, school_id, research_areas, accepting, fit_score, outreach, last_contacted_on, homepage_url, email, schools(name), departments(name)")
    .order("name");

  const professors: OutreachProf[] = ((data ?? []) as any[]).map((p) => ({
    id: p.id, name: p.name, title: p.title, school_id: p.school_id, school_name: p.schools?.name ?? "School",
    department: p.departments?.name ?? null, research_areas: p.research_areas ?? [], accepting: p.accepting,
    fit_score: p.fit_score, outreach: p.outreach, last_contacted_on: p.last_contacted_on, homepage_url: p.homepage_url, email: p.email,
  }));

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="Applications" title="Outreach"
        subtitle={`${professors.length} professor${professors.length === 1 ? "" : "s"} across your schools. Move each one forward as you go.`}
      />
      {professors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No professors yet</p>
          <p className="mt-1 text-[13px] text-slate-500">Add them from a school&apos;s Faculty tab and they&apos;ll show up here.</p>
          <Link href="/schools" className="mt-3 inline-block text-[13px] font-medium text-blue-600 hover:text-blue-700">Go to schools →</Link>
        </div>
      ) : (
        <OutreachBoard professors={professors} />
      )}
    </main>
  );
}
