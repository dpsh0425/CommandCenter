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
    <main className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-8">
      <PageHeader title="Outreach" subtitle={`${professors.length} professors across your schools. Move each one forward as you go.`} />
      {professors.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-8 text-center text-sm text-gray-500">
          No professors yet. Add them from a school's Faculty tab and they'll show up here.
        </div>
      ) : (
        <OutreachBoard professors={professors} />
      )}
    </main>
  );
}
