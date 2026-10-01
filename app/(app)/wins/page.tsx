import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";
import { PageHeader, SubNav, TODAY_TABS } from "@/components/ui";
import { TrophyIcon } from "@/components/icons";
import { todayString, zonedDay } from "@/lib/app-date";

export const metadata = { title: "Wins" };

type Win = { label: string; content: string; when: string; href: string; kind: "school" | "task" };

export default async function WinsPage() {
  const supabase = await createClient();
  const [{ data: activity }, { data: taskUpdates }] = await Promise.all([
    supabase.from("activity_log").select("*, schools(name)").eq("is_win", true).order("created_at", { ascending: false }),
    supabase.from("task_updates").select("*, tasks(title)").eq("is_win", true).order("created_at", { ascending: false }),
  ]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
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
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Group by month in APP_TIMEZONE, so a win just after midnight lands in the right month.
  const monthOf = (iso: string) => zonedDay(iso).slice(0, 7);
  const byMonth = new Map<string, Win[]>();
  for (const w of items) {
    const key = monthOf(w.when);
    byMonth.set(key, [...(byMonth.get(key) ?? []), w]);
  }

  const thisMonth = todayString().slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const lastMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const stats = [
    { label: "This month", value: byMonth.get(thisMonth)?.length ?? 0 },
    { label: "Last month", value: byMonth.get(lastMonth)?.length ?? 0 },
    { label: "From schools", value: items.filter((w) => w.kind === "school").length },
    { label: "From tasks", value: items.filter((w) => w.kind === "task").length },
  ];
  const tz = process.env.APP_TIMEZONE || undefined;
  const shortDay = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
    } catch {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Overview" title="Wins" subtitle={`${items.length} so far. Replies, advances and finished results.`} />
        <SubNav items={TODAY_TABS} current="/wins" />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          Nothing yet. It&apos;s early. A win is logged when a school moves to replied, submitted, interview or accepted, or when you mark a task result.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="text-2xl font-semibold tabular-nums text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {Array.from(byMonth.entries()).map(([key, wins]) => (
            <section key={key} className="rounded-lg border border-slate-200 bg-white">
              <h2 className="flex justify-between border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-slate-600">
                <span>{new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                <span className="font-normal normal-case tracking-normal tabular-nums text-slate-500">{wins.length} {wins.length === 1 ? "win" : "wins"}</span>
              </h2>
              <ul className="px-2 py-1.5">
                {wins.map((w, i) => (
                  <li key={i}>
                    <Link href={w.href} className="group flex gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <TrophyIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm text-slate-900 group-hover:text-blue-700">{w.content}</span>
                        <span className="truncate text-xs text-slate-500">{w.label} · {shortDay(w.when)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
