import { createClient } from "@/lib/supabase/server";

export default async function WinsPage() {
  const supabase = await createClient();
  const [{ data: activity }, { data: taskUpdates }] = await Promise.all([
    supabase.from("activity_log").select("*, schools(name)").eq("is_win", true).order("created_at", { ascending: false }),
    supabase.from("task_updates").select("*, tasks(title)").eq("is_win", true).order("created_at", { ascending: false }),
  ]);

  const items = [
    ...(activity ?? []).map((a: any) => ({ label: a.schools?.name ?? "School", content: a.content, when: a.created_at })),
    ...(taskUpdates ?? []).map((u: any) => ({ label: u.tasks?.title ?? "Task", content: u.content, when: u.created_at })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  return (
    <main className="p-8 max-w-xl mx-auto flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Wins</h1>
      <p className="text-sm text-gray-500">Replies, advances, and results only — the good-news feed.</p>
      {items.length === 0 && <p className="text-sm text-gray-500">Nothing yet — it's early.</p>}
      {items.map((item, i) => (
        <div key={i} className="border rounded p-3 text-sm">
          <div className="text-xs text-gray-500">{item.label} · {new Date(item.when).toLocaleDateString()}</div>
          <p className="mt-1">{item.content}</p>
        </div>
      ))}
    </main>
  );
}
