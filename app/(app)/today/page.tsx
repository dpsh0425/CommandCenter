import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Item = { label: string; date: string; kind: "task" | "school" | "milestone"; href: string };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function daysBetween(from: string, to: string) {
  return Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
}

export default async function TodayPage() {
  const supabase = await createClient();
  const now = new Date();
  const today = localDate(now);
  const weekOut = new Date(now);
  weekOut.setDate(weekOut.getDate() + 7);
  const cutoff = localDate(weekOut);

  const [{ data: tasks }, { data: schools }, { data: milestones }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date").lte("due_date", cutoff).not("due_date", "is", null).not("status", "in", "(done,cancelled)"),
    supabase.from("schools").select("id, name, deadline_date").lte("deadline_date", cutoff).not("deadline_date", "is", null),
    supabase.from("research_milestones").select("id, title, target_date").lte("target_date", cutoff).not("target_date", "is", null).neq("status", "done"),
  ]);

  const items: Item[] = [
    ...(tasks ?? []).map((t) => ({ label: t.title, date: t.due_date as string, kind: "task" as const, href: `/tasks/${t.id}` })),
    ...(schools ?? []).map((s) => ({ label: `${s.name} deadline`, date: s.deadline_date as string, kind: "school" as const, href: `/schools/${s.id}` })),
    ...(milestones ?? []).map((m) => ({ label: m.title, date: m.target_date as string, kind: "milestone" as const, href: `/research/${m.id}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const groups = [
    { title: "Overdue", tone: "text-red-600", items: items.filter((i) => i.date < today) },
    { title: "Today", tone: "text-brass", items: items.filter((i) => i.date === today) },
    { title: "Next 7 days", tone: "text-gray-500", items: items.filter((i) => i.date > today) },
  ];

  return (
    <main className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-gray-500">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-gray-500 border border-dashed border-line rounded p-6 text-center">
          Nothing due in the next 7 days. Use the time to move a school forward.
        </p>
      )}

      {groups.filter((g) => g.items.length > 0).map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h2 className={`text-xs uppercase tracking-wide ${g.tone}`}>
            {g.title} · {g.items.length}
          </h2>
          {g.items.map((item) => {
            const delta = daysBetween(today, item.date);
            const when = delta === 0 ? "today" : delta < 0 ? `${-delta}d late` : delta === 1 ? "tomorrow" : `in ${delta}d`;
            return (
              <Link key={`${item.kind}-${item.href}`} href={item.href} className="border rounded p-3 text-sm flex justify-between gap-3 hover:border-brass">
                <span>{item.label}</span>
                <span className="text-xs uppercase text-gray-500 whitespace-nowrap">{item.kind} · {when}</span>
              </Link>
            );
          })}
        </section>
      ))}
    </main>
  );
}
