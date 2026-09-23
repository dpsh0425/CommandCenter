import { createClient } from "@/lib/supabase/server";
import { JourneyTimeline } from "@/components/journey-timeline";
import { PageHeader, SubNav, TODAY_TABS } from "@/components/ui";

export const metadata = { title: "Timeline" };

export default async function TimelinePage() {
  const supabase = await createClient();
  const [{ data: schools }, { data: milestones }] = await Promise.all([
    supabase.from("schools").select("id, name, deadline_date").not("deadline_date", "is", null),
    supabase.from("research_milestones").select("id, title, target_date").not("target_date", "is", null),
  ]);
  const markers = [
    ...(schools ?? []).map((s) => ({ label: s.name, date: s.deadline_date as string, kind: "school" as const, href: `/schools/${s.id}` })),
    ...(milestones ?? []).map((m) => ({ label: m.title, date: m.target_date as string, kind: "milestone" as const, href: `/research/${m.id}` })),
  ];
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Timeline" subtitle="Every confirmed deadline and milestone date, in order." />
        <SubNav items={TODAY_TABS} current="/timeline" />
      </div>
      <JourneyTimeline markers={markers} />
    </main>
  );
}
