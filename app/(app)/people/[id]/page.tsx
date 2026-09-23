import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { Avatar } from "@/components/avatar";
import { DeletePersonButton, EditPersonForm, InviteForm } from "@/components/person-controls";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TASK_TONE: Record<string, string> = {
  todo: "text-gray-500", in_progress: "text-brass", blocked: "text-red-600", done: "text-teal-600", cancelled: "text-gray-400",
};

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: person }, { data: tasks }, { data: letters }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("people").select("*").eq("id", id).single(),
    supabase.from("tasks").select("id, title, status, priority, due_date, schools(name), research_milestones(title)").eq("assignee_id", id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("letter_requests").select("id, status, letter_deadline, school_id, schools(name)").eq("recommender_id", id),
  ]);
  if (!person) return <p className="p-4 md:p-8">Not found.</p>;

  const isOwner = user?.id === OWNER_USER_ID;
  const today = localDate(new Date());
  const all = (tasks ?? []) as any[];
  const open = all.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = all.filter((t) => t.status === "done");
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const letterList = (letters ?? []) as any[];

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/people" className="text-xs text-gray-500 hover:text-cream self-start">← All people</Link>
        <div className="flex items-center gap-4">
          <Avatar name={person.name} color={person.color} size={56} />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold truncate">{person.name}</h1>
            <p className="text-sm text-gray-500">{[person.role, person.area].filter(Boolean).join(" · ") || "No role set"}</p>
            {person.email && <a href={`mailto:${person.email}`} className="text-xs text-brass underline">{person.email}</a>}
          </div>
        </div>
        {isOwner && (
          <EditPersonForm id={person.id} name={person.name} role={person.role} area={person.area} email={person.email} color={person.color} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Open tasks", value: open.length, tone: "" },
          { label: "Overdue", value: overdue.length, tone: overdue.length ? "text-red-600" : "text-teal-600" },
          { label: "Completed", value: done.length, tone: "" },
        ].map((s) => (
          <div key={s.label} className="border border-line bg-surface rounded-lg p-3">
            <div className={`text-2xl font-mono font-semibold ${s.tone}`}>{s.value}</div>
            <div className="text-xs text-gray-500 uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="border border-line bg-surface rounded-lg p-4">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex justify-between">
          <span>Assigned tasks</span><span className="font-mono">{all.length}</span>
        </h2>
        {all.length === 0 ? (
          <p className="text-xs text-gray-400 border border-dashed border-line rounded p-4 text-center">
            No tasks assigned yet. Assign one from the <Link href="/tasks" className="underline">task board</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {all.map((t) => {
              const late = t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled";
              const context = [t.schools?.name, t.research_milestones?.title].filter(Boolean).join(" · ");
              return (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="border rounded p-2.5 text-sm flex justify-between gap-3 items-center hover:border-brass">
                    <span className="min-w-0">
                      <span className={`block truncate ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</span>
                      <span className="block text-xs text-gray-500 truncate">
                        {context && `${context} · `}{t.priority}
                        {t.due_date && <span className={late ? "text-red-600" : ""}> · due {t.due_date}</span>}
                      </span>
                    </span>
                    <span className={`text-xs uppercase whitespace-nowrap ${TASK_TONE[t.status]}`}>{t.status.replace("_", " ")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {letterList.length > 0 && (
        <section className="border border-line bg-surface rounded-lg p-4">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex justify-between">
            <span>Recommendation letters</span><span className="font-mono">{letterList.length}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {letterList.map((l) => (
              <li key={l.id}>
                <Link href={`/schools/${l.school_id}`} className="border rounded p-2.5 text-sm flex justify-between gap-3 hover:border-brass">
                  <span className="truncate">{l.schools?.name ?? "School"}{l.letter_deadline && <span className="text-xs text-gray-500"> · due {l.letter_deadline}</span>}</span>
                  <span className="text-xs uppercase text-gray-500 whitespace-nowrap">{String(l.status).replace("_", " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && (
        <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wide text-gray-500">Sign-in access</h2>
          {person.auth_user_id ? (
            <p className="text-sm">
              <span className="text-teal-600">Account linked.</span>{" "}
              <span className="text-gray-500">They can sign in and see only the tasks assigned to them{person.email ? ` (${person.email})` : ""}.</span>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500">Invite {person.name.split(" ")[0]} to sign in. They'll only see tasks assigned to them, plus the school or milestone each links to.</p>
              <InviteForm personId={person.id} defaultEmail={person.email} />
            </>
          )}
        </section>
      )}

      {isOwner && <DeletePersonButton id={person.id} name={person.name} openTasks={open.length} />}
    </main>
  );
}
