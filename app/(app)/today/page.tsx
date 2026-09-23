import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();
  const weekOut = new Date();
  weekOut.setDate(weekOut.getDate() + 7);
  const cutoff = weekOut.toISOString().slice(0, 10);

  const [{ data: tasks }, { data: schools }, { data: milestones }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, status").lte("due_date", cutoff).neq("status", "done"),
    supabase.from("schools").select("id, name, deadline_date").lte("deadline_date", cutoff).not("deadline_date", "is", null),
    supabase.from("research_milestones").select("id, title, target_date").lte("target_date", cutoff).neq("status", "done"),
  ]);

  const items = [
    ...(tasks ?? []).map((t) => ({ label: t.title, date: t.due_date, kind: "task" })),
    ...(schools ?? []).map((s) => ({ label: `${s.name} deadline`, date: s.deadline_date, kind: "school" })),
    ...(milestones ?? []).map((m) => ({ label: m.title, date: m.target_date, kind: "milestone" })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  return (
    <main className="p-8 max-w-xl mx-auto flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">This week</h1>
      {items.length === 0 && <p className="text-sm text-gray-500">Nothing due in the next 7 days.</p>}
      {items.map((item, i) => (
        <div key={i} className="border rounded p-2 text-sm flex justify-between">
          <span>{item.label}</span>
          <span className="text-xs uppercase text-gray-500">{item.kind} · {item.date}</span>
        </div>
      ))}
    </main>
  );
}
