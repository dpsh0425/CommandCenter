import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { Avatar } from "@/components/avatar";
import { DeletePersonButton, EditPersonForm, InviteForm } from "@/components/person-controls";
import { Fold, Meta, Section } from "@/components/ui";

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
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link href="/people" className="text-xs text-gray-500 hover:text-cream self-start">← People</Link>
        <div className="flex items-center gap-5">
          <Avatar name={person.name} color={person.color} size={64} />
          <div className="min-w-0 flex flex-col gap-1">
            <h1 className="text-4xl leading-tight truncate">{person.name}</h1>
            <Meta
              items={[
                [person.role, person.area].filter(Boolean).join(" · ") || "No role set",
                person.email && <a href={`mailto:${person.email}`} className="text-brass hover:underline">{person.email}</a>,
                person.auth_user_id && <span className="text-teal-600">can sign in</span>,
              ]}
            />
          </div>
        </div>
        {isOwner && (
          <EditPersonForm id={person.id} name={person.name} role={person.role} area={person.area} email={person.email} color={person.color} />
        )}
        <p className="text-sm text-gray-500">
          <span className="font-mono text-cream">{open.length}</span> open
          {overdue.length > 0 && <> · <span className="text-red-600"><span className="font-mono">{overdue.length}</span> overdue</span></>}
          {" · "}<span className="font-mono text-cream">{done.length}</span> completed
        </p>
      </div>

      <Section title="Assigned tasks" hint={all.length ? `${all.length}` : undefined}>
        {all.length === 0 ? (
          <p className="text-sm text-gray-500">
            No tasks yet. Assign one from a task's page, or add one on the <Link href="/tasks" className="underline hover:text-cream">task board</Link>.
          </p>
        ) : (
          <ul className="flex flex-col">
            {all.map((t) => {
              const late = t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled";
              const context = [t.schools?.name, t.research_milestones?.title].filter(Boolean).join(" · ");
              return (
                <li key={t.id} className="border-b border-line/60 last:border-0">
                  <Link href={`/tasks/${t.id}`} className="flex items-baseline justify-between gap-4 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                    <span className="min-w-0">
                      <span className={`block truncate ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</span>
                      {context && <span className="block text-xs text-gray-500 truncate">{context}</span>}
                    </span>
                    <span className="text-sm whitespace-nowrap text-right">
                      <span className={`block text-xs ${TASK_TONE[t.status]}`}>{t.status.replace("_", " ")}</span>
                      {t.due_date && <span className={`block text-xs ${late ? "text-red-600" : "text-gray-400"}`}>due {t.due_date.slice(5)}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {letterList.length > 0 && (
        <Section title="Recommendation letters" hint={`${letterList.length}`}>
          <ul className="flex flex-col">
            {letterList.map((l) => (
              <li key={l.id} className="border-b border-line/60 last:border-0">
                <Link href={`/schools/${l.school_id}?tab=application`} className="flex justify-between gap-4 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                  <span className="truncate">{l.schools?.name ?? "School"}{l.letter_deadline && <span className="text-sm text-gray-500"> · due {l.letter_deadline}</span>}</span>
                  <span className="text-sm text-gray-400 whitespace-nowrap">{String(l.status).replace("_", " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {isOwner && (
        <Fold title="Sign-in access" summary={person.auth_user_id ? "account linked" : "no login"} defaultOpen={!person.auth_user_id}>
          {person.auth_user_id ? (
            <p className="text-sm text-gray-500">
              {person.name.split(" ")[0]} can sign in and sees only the tasks assigned to them{person.email ? ` (${person.email})` : ""}.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-500">Invite {person.name.split(" ")[0]} to sign in. They'll see only tasks assigned to them, plus the school or milestone each links to.</p>
              <InviteForm personId={person.id} defaultEmail={person.email} />
            </div>
          )}
        </Fold>
      )}

      {isOwner && (
        <div className="pt-2">
          <DeletePersonButton id={person.id} name={person.name} openTasks={open.length} />
        </div>
      )}
    </main>
  );
}
