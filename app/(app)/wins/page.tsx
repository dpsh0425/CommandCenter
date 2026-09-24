import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";
import { PageHeader, SubNav, TODAY_TABS } from "@/components/ui";

export const metadata = { title: "Wins" };

type Win = { label: string; content: string; when: string; href: string; kind: "school" | "task" };

export default async function WinsPage() {
  const supabase = await createClient();
  const [{ data: activity }, { data: taskUpdates }] = await Promise.all([
    supabase.from("activity_log").select("*, schools(name)").eq("is_win", true).order("created_at", { ascending: false }),
    supabase.from("task_updates").select("*, tasks(title)").eq("is_win", true).order("created_at", { ascending: false }),
  ]);

  const items: Win[] = [
    ...(activity ?? []).map((a: any) => ({
      label: a.schools?.name ?? "School", content: a.type === "note" ? htmlToText(toEditorHtml(a.content ?? "")).trim() : a.content, when: a.created_at,
      href: a.school_id ? `/schools/${a.school_id}` : "/schools", kind: "school" as const,
    })),
    ...(taskUpdates ?? []).map((u: any) => ({
      label: u.tasks?.title ?? "Task", content: u.content, when: u.created_at,
      href: u.task_id ? `/tasks/${u.task_id}` : "/tasks", kind: "task" as const,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  const byMonth = new Map<string, Win[]>();
  for (const w of items) {
    const key = w.when.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), w]);
  }

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Wins" subtitle={`${items.length} so far. Replies, advances and finished results.`} />
        <SubNav items={TODAY_TABS} current="/wins" />
      </div>

      {items.length === 0 && (
        <div className="border border-dashed border-line rounded p-6 text-center text-sm text-gray-500">
          Nothing yet — it&apos;s early. A win is logged when a school moves to replied, submitted, interview or accepted, or when you mark a task result.
        </div>
      )}

      {Array.from(byMonth.entries()).map(([key, wins]) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 flex justify-between">
            <span>{new Date(key + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
            <span className="font-mono">{wins.length}</span>
          </h2>
          {wins.map((w, i) => (
            <Link key={i} href={w.href} className="border border-l-4 border-l-brass rounded p-3 text-sm hover:border-brass">
              <div className="text-xs text-gray-500 flex justify-between gap-2">
                <span>{w.label}</span>
                <span className="whitespace-nowrap">{new Date(w.when).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </div>
              <p className="mt-1">{w.content}</p>
            </Link>
          ))}
        </section>
      ))}
    </main>
  );
}
