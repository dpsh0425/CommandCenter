import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { Avatar } from "@/components/avatar";
import { AddPersonForm } from "@/components/person-controls";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function PeoplePage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: people }, { data: tasks }, { data: letters }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("people").select("*").order("name"),
    supabase.from("tasks").select("assignee_id, status, due_date").not("assignee_id", "is", null),
    supabase.from("letter_requests").select("recommender_id, status").not("recommender_id", "is", null),
  ]);
  const isOwner = user?.id === OWNER_USER_ID;
  const today = localDate(new Date());

  const stats = new Map<string, { open: number; overdue: number; done: number; lettersPending: number }>();
  const get = (id: string) => stats.get(id) ?? { open: 0, overdue: 0, done: 0, lettersPending: 0 };
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
    if (l.status !== "submitted") s.lettersPending += 1;
    stats.set(l.recommender_id as string, s);
  }

  const list = people ?? [];
  const maxOpen = Math.max(1, ...list.map((p) => get(p.id).open));

  return (
    <main className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">People</h1>
          <p className="text-sm text-gray-500">Collaborators, recommenders and anyone you assign work to.</p>
        </div>
        <span className="text-sm text-gray-500 font-mono">{list.length} {list.length === 1 ? "person" : "people"}</span>
      </div>

      {isOwner && <AddPersonForm />}

      {list.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-8 text-center text-sm text-gray-500 flex flex-col gap-2 items-center">
          <p>No one here yet.</p>
          <p className="text-xs text-gray-400 max-w-sm">
            Add a co-annotator to assign them tasks, or a recommender to track their letters. You can invite anyone to sign in and see only what's assigned to them.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => {
            const s = get(p.id);
            return (
              <Link key={p.id} href={`/people/${p.id}`} className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3 hover:border-brass">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} color={p.color} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 truncate">{[p.role, p.area].filter(Boolean).join(" · ") || "No role set"}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 whitespace-nowrap ${p.auth_user_id ? "text-teal-600 border-teal-600" : "text-gray-400 border-line"}`}>
                    {p.auth_user_id ? "can sign in" : "no login"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{s.open} open task{s.open === 1 ? "" : "s"}{s.overdue > 0 && <span className="text-red-600"> · {s.overdue} overdue</span>}</span>
                    <span className="font-mono">{s.done} done</span>
                  </div>
                  <div className="h-1.5 rounded bg-surface-raised overflow-hidden">
                    <div className={`h-full ${s.overdue > 0 ? "bg-red-600" : "bg-brass"}`} style={{ width: `${(s.open / maxOpen) * 100}%` }} />
                  </div>
                </div>
                {s.lettersPending > 0 && (
                  <div className="text-xs text-violet-700">{s.lettersPending} recommendation letter{s.lettersPending === 1 ? "" : "s"} pending</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
