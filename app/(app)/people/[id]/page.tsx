import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { Avatar } from "@/components/avatar";
import { DeletePersonButton, EditPersonForm, InviteForm } from "@/components/person-controls";
import { todayString } from "@/lib/app-date";

const TASK_BADGE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-600", in_progress: "bg-blue-50 text-blue-700", blocked: "bg-red-50 text-red-700",
  done: "bg-emerald-50 text-emerald-700", cancelled: "bg-slate-100 text-slate-400",
};
const LETTER_BADGE: Record<string, { label: string; cls: string }> = {
  not_asked: { label: "Not asked", cls: "bg-slate-100 text-slate-600" },
  asked: { label: "Asked", cls: "bg-blue-50 text-blue-700" },
  confirmed: { label: "Confirmed", cls: "bg-blue-100 text-blue-800" },
  submitted: { label: "Submitted", cls: "bg-emerald-50 text-emerald-700" },
};
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: person }, { data: tasks }, { data: letters }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("people").select("*").eq("id", id).single(),
    supabase.from("tasks").select("id, title, status, priority, due_date, schools(name), research_milestones(title)").eq("assignee_id", id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("letter_requests").select("id, status, letter_deadline, school_id, schools(name), asked_on, last_reminded_on, reminder_count, received_on").eq("recommender_id", id),
  ]);
  if (!person) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:p-8">
        <Link href="/people" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← People</Link>
        <p className="text-sm text-slate-600">This person doesn&apos;t exist or you don&apos;t have access to them.</p>
      </main>
    );
  }

  const isOwner = user?.id === OWNER_USER_ID;
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const all = (tasks ?? []) as any[];
  const open = all.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = all.filter((t) => t.status === "done");
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const letterList = ((letters ?? []) as any[]).sort((a, b) => (a.letter_deadline ?? "9999").localeCompare(b.letter_deadline ?? "9999"));
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const openLetters = letterList.filter((l) => l.status !== "submitted").length;
  const reminders = letterList.reduce((n, l) => n + (l.reminder_count ?? 0), 0);
  const lastReminder = letterList.map((l) => l.last_reminded_on as string | null).filter(Boolean).sort().pop() ?? null;
  const firstName = person.name.split(" ")[0];

  const tiles: Array<{ label: string; value: number; sub: string; subTone?: string }> = [
    { label: "Letters", value: letterList.length, sub: letterList.length ? `${openLetters} still open` : "none requested" },
    { label: "Reminders sent", value: reminders, sub: lastReminder ? `last ${shortDate(lastReminder)}` : "none yet" },
    { label: "Open tasks", value: open.length, sub: overdue.length ? `${overdue.length} overdue` : "none overdue", subTone: overdue.length ? "font-medium text-red-700" : undefined },
    { label: "Completed", value: done.length, sub: "tasks" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 p-4 md:p-8">
      <Link href="/people" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← People</Link>

      <section className={`${card} flex flex-wrap items-center gap-5 px-5 py-5 md:px-6`}>
        <Avatar name={person.name} color={person.color} size={64} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-[26px] font-semibold leading-[34px] tracking-tight text-slate-900">{person.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600">
            <span>{[person.role, person.area].filter(Boolean).join(" · ") || "No role set"}</span>
            {person.email && <a href={`mailto:${person.email}`} className="text-blue-600 hover:text-blue-700">{person.email}</a>}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${person.auth_user_id ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {person.auth_user_id ? "Can sign in" : "No login"}
            </span>
          </div>
        </div>
        {isOwner && letterList.length > 0 && (
          <Link href={`/materials/letters?focus=${person.id}#rec-${person.id}`} className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700">
            Draft an email
          </Link>
        )}
      </section>

      {isOwner && (
        <EditPersonForm id={person.id} name={person.name} role={person.role} area={person.area} email={person.email} color={person.color} />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
            <p className="text-[22px] font-semibold tabular-nums text-slate-900">{t.value}</p>
            <p className={`text-xs ${t.subTone ?? "text-slate-500"}`}>{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className={card}>
          <div className={cardHead}>
            <h2 className="text-[15px] font-semibold text-slate-900">Recommendation letters<span className="ml-1 font-normal text-slate-500">· {letterList.length}</span></h2>
            {isOwner && letterList.length > 0 && <Link href={`/materials/letters?focus=${person.id}#rec-${person.id}`} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">Open in Letters</Link>}
          </div>
          {letterList.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-slate-500">No letters requested from {firstName}. Request one from the Letters page or a school&apos;s Application tab.</p>
          ) : (
            <ul className="px-5 py-1">
              {letterList.map((l) => {
                const badge = LETTER_BADGE[l.status] ?? { label: String(l.status).replace(/_/g, " "), cls: "bg-slate-100 text-slate-600" };
                const d = l.letter_deadline ? daysBetween(today, l.letter_deadline) : null;
                const steps: Array<{ text: string; tone: "done" | "win" | "todo" }> = [];
                steps.push(l.asked_on ? { text: `Asked ${shortDate(l.asked_on)}`, tone: "done" } : { text: "Not asked yet", tone: "todo" });
                if (l.reminder_count > 0) steps.push({ text: `Reminded ${l.reminder_count}×${l.last_reminded_on ? ` · last ${shortDate(l.last_reminded_on)}` : ""}`, tone: "done" });
                if (l.received_on) steps.push({ text: `Received ${shortDate(l.received_on)}`, tone: "win" });
                else if (l.status !== "not_asked") steps.push({ text: "Not received", tone: "todo" });
                return (
                  <li key={l.id} className="flex flex-col gap-2 border-b border-slate-100 py-3 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/schools/${l.school_id}?tab=application`} className="truncate text-sm font-semibold text-slate-900 hover:text-blue-700">{l.schools?.name ?? "School"}</Link>
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <ol className="flex flex-wrap items-center gap-y-1 text-xs text-slate-600" aria-label="Reminder log">
                      {steps.map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          {i > 0 && <span aria-hidden className="mx-1.5 h-px w-4 bg-slate-300" />}
                          <span aria-hidden className={`h-2 w-2 rounded-full ${s.tone === "done" ? "bg-blue-600" : s.tone === "win" ? "bg-emerald-600" : "border-[1.5px] border-dashed border-slate-400"}`} />
                          {s.text}
                        </li>
                      ))}
                    </ol>
                    {l.letter_deadline && l.status !== "submitted" && (
                      <span className={`text-xs ${d! < 0 || d! <= 14 ? "font-medium text-red-700" : "text-slate-500"}`}>
                        Due {shortDate(l.letter_deadline)} · {d === 0 ? "today" : d! < 0 ? `${-d!}d ago` : `in ${d} days`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className={card}>
            <div className={cardHead}>
              <h2 className="text-[15px] font-semibold text-slate-900">Assigned tasks{all.length > 0 && <span className="ml-1 font-normal text-slate-500">· {all.length}</span>}</h2>
            </div>
            {all.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-slate-500">
                No tasks yet. Assign one from a task&apos;s page, or add one on the <Link href="/tasks" className="font-medium text-blue-600 hover:text-blue-700">task board</Link>.
              </p>
            ) : (
              <ul className="px-3 py-2">
                {all.map((t) => {
                  const late = t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled";
                  const context = [t.schools?.name, t.research_milestones?.title].filter(Boolean).join(" · ");
                  return (
                    <li key={t.id}>
                      <Link href={`/tasks/${t.id}`} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className={`block truncate text-sm ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</span>
                          {context && <span className="block truncate text-xs text-slate-500">{context}</span>}
                        </span>
                        <span className="flex flex-shrink-0 flex-col items-end gap-0.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${TASK_BADGE[t.status] ?? TASK_BADGE.todo}`}>{t.status.replace(/_/g, " ")}</span>
                          {t.due_date && <span className={`text-xs ${late ? "font-medium text-red-700" : "text-slate-500"}`}>due {shortDate(t.due_date)}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {isOwner && (
            <section className={card}>
              <div className={cardHead}>
                <h2 className="text-[15px] font-semibold text-slate-900">Sign-in access</h2>
                <span className="text-xs text-slate-500">{person.auth_user_id ? "Account linked" : "No login"}</span>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4">
                {person.auth_user_id ? (
                  <p className="text-[13px] text-slate-600">
                    {firstName} can sign in and sees only the tasks assigned to them{person.email ? ` (${person.email})` : ""}.
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] text-slate-600">Invite {firstName} to sign in. They&apos;ll see only tasks assigned to them, plus the school or milestone each links to.</p>
                    <InviteForm personId={person.id} defaultEmail={person.email} />
                  </>
                )}
              </div>
            </section>
          )}

          {isOwner && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-white px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Remove this person</p>
                <p className="text-xs text-slate-500">{open.length ? `Their ${open.length} open task${open.length === 1 ? "" : "s"} will become unassigned.` : "This cannot be undone."}</p>
              </div>
              <DeletePersonButton id={person.id} name={person.name} openTasks={open.length} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
