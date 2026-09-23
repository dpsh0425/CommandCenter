import { createClient } from "@/lib/supabase/server";

export default async function MilestoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: milestone }, { data: tasks }] = await Promise.all([
    supabase.from("research_milestones").select("*").eq("id", id).single(),
    supabase.from("tasks").select("*").eq("research_milestone_id", id),
  ]);
  if (!milestone) return <p className="p-8">Not found.</p>;
  return (
    <main className="p-8 max-w-2xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{milestone.title}</h1>
      <p className="text-gray-600">{milestone.description}</p>
      <div>
        <h2 className="font-medium mb-2">Linked tasks ({(tasks ?? []).length})</h2>
        <ul className="flex flex-col gap-2">
          {(tasks ?? []).map((t) => (
            <li key={t.id} className="border rounded p-2 text-sm flex justify-between">
              <span>{t.title}</span><span className="text-xs uppercase text-gray-500">{t.status.replace("_", " ")}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
