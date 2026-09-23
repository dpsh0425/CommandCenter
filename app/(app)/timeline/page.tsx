import { createClient } from "@/lib/supabase/server";
import { JourneyTimeline } from "@/components/journey-timeline";

export default async function TimelinePage() {
  const supabase = await createClient();
  const [{ data: schools }, { data: milestones }] = await Promise.all([
    supabase.from("schools").select("name, deadline_date").not("deadline_date", "is", null),
    supabase.from("research_milestones").select("title, target_date").not("target_date", "is", null),
  ]);
  const markers = [
    ...(schools ?? []).map((s) => ({ label: s.name, date: s.deadline_date as string, kind: "school" as const })),
    ...(milestones ?? []).map((m) => ({ label: m.title, date: m.target_date as string, kind: "milestone" as const })),
  ];
  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Journey timeline</h1>
      <p className="text-sm text-gray-500">Only confirmed dates appear here — most school deadlines are still unconfirmed (see Target schools).</p>
      <JourneyTimeline markers={markers} />
    </main>
  );
}
