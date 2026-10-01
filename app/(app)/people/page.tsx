import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { AddPersonForm } from "@/components/person-controls";
import { PageHeader } from "@/components/ui";
import { PeopleDirectory, type DirectoryPerson } from "@/components/people-directory";
import { todayString } from "@/lib/app-date";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: people }, { data: tasks }, { data: letters }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("people").select("*").order("name"),
    supabase.from("tasks").select("assignee_id, status, due_date").not("assignee_id", "is", null),
    supabase.from("letter_requests").select("recommender_id, status").not("recommender_id", "is", null),
  ]);
  const isOwner = user?.id === OWNER_USER_ID;
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();

  const stats = new Map<string, { open: number; overdue: number; done: number; letters: Record<string, number> }>();
  const get = (id: string) => stats.get(id) ?? { open: 0, overdue: 0, done: 0, letters: {} };
  for (const t of tasks ?? []) {
    const s = get(t.assignee_id as string);
    if (t.status === "done") s.done += 1;
    else if (t.status !== "cancelled") {
      s.open += 1;
      if (t.due_date && t.due_date < today) s.overdue += 1;
    }
    stats.set(t.assignee_id as string, s);
  }
  for (const l of letters ?? []) {
    const s = get(l.recommender_id as string);
    s.letters[l.status as string] = (s.letters[l.status as string] ?? 0) + 1;
    stats.set(l.recommender_id as string, s);
  }

  const list = people ?? [];
  const rows: DirectoryPerson[] = list.map((p) => {
    const s = get(p.id);
    return {
      id: p.id, name: p.name, role: p.role, area: p.area, color: p.color, canSignIn: !!p.auth_user_id,
      open: s.open, overdue: s.overdue, done: s.done, letters: s.letters,
    };
  });
  const openTasks = rows.reduce((n, r) => n + r.open, 0);
  const overdueTasks = rows.reduce((n, r) => n + r.overdue, 0);
  const recommenders = rows.filter((r) => Object.keys(r.letters).length > 0).length;
  const pendingLetters = (letters ?? []).filter((l) => l.status !== "submitted").length;
  const tiles: Array<{ label: string; value: number; sub: string; tone?: string; subTone?: string }> = [
    { label: "People", value: rows.length, sub: `${rows.filter((r) => r.canSignIn).length} can sign in` },
    { label: "Open tasks", value: openTasks, sub: overdueTasks ? `${overdueTasks} overdue` : "none overdue", subTone: overdueTasks ? "font-medium text-red-700" : undefined },
    { label: "Recommenders", value: recommenders, sub: "with at least one letter" },
    { label: "Letters pending", value: pendingLetters, sub: "not yet submitted", tone: pendingLetters ? "text-blue-700" : undefined },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow="Team" title="People" subtitle="Collaborators, recommenders and anyone you assign work to." actions={isOwner ? <AddPersonForm /> : undefined} />

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No one here yet</p>
          <p className="max-w-sm text-[13px] text-slate-500">
            Add a co-annotator to assign them tasks, or a recommender to track their letters. You can invite anyone to sign in and see only what&apos;s assigned to them.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
                <p className={`text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
                <p className={`text-xs ${t.subTone ?? "text-slate-500"}`}>{t.sub}</p>
              </div>
            ))}
          </div>
          <PeopleDirectory people={rows} />
        </>
      )}
    </main>
  );
}
