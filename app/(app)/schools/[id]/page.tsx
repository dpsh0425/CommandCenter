import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { StatusSelect } from "@/components/status-select";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  AddLetterForm, InterviewRow, LetterRow, NoteForm, ScheduleInterviewForm, SchoolDetailsForm, SchoolTaskForm, SopForm, VisaStepRow,
} from "@/components/school-controls";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);
const relative = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d < 0 ? `${-d}d ago` : `in ${d}d`);
const TASK_TONE: Record<string, string> = {
  todo: "text-gray-500", in_progress: "text-brass", blocked: "text-red-600", done: "text-teal-600", cancelled: "text-gray-400",
};

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: { user } }, { data: school }, { data: activity }, { data: linkedTasks }, { data: letters },
    { data: people }, { data: sop }, { data: interviews }, { data: visaSteps },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("activity_log").select("*").eq("school_id", id).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("id, title, status, due_date, priority").eq("school_id", id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("letter_requests").select("*, people(name)").eq("school_id", id).order("created_at"),
    supabase.from("people").select("id, name").order("name"),
    supabase.from("schools").select("sop_version_id, sop_sent_at, sop_versions(label)").eq("id", id).single(),
    supabase.from("interviews").select("*").eq("school_id", id).order("scheduled_at"),
    supabase.from("visa_steps").select("*").eq("school_id", id).order("created_at"),
  ]);

  if (!school) {
    return (
      <main className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-3">
        <Link href="/schools" className="text-xs text-gray-500 hover:text-cream">← All schools</Link>
        <p className="text-gray-500">This school doesn't exist or you don't have access to it.</p>
      </main>
    );
  }

  const isOwner = user?.id === OWNER_USER_ID;
  const today = localDate(new Date());
  const meta = school as any;
  const letterList = (letters ?? []) as any[];
  const sopLabel = (sop as any)?.sop_versions?.label as string | undefined;
  const openTasks = (linkedTasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled").length;

  const lettersReady = letterList.length > 0 && letterList.every((l) => l.status === "confirmed" || l.status === "submitted");
  const lettersConfirmed = letterList.filter((l) => l.status === "confirmed" || l.status === "submitted").length;
  const checklist = [
    { label: "Contact email", done: !!meta.contact_email, hint: "Add a faculty contact" },
    { label: "Deadline set", done: !!meta.deadline_date, hint: "Confirm the application deadline" },
    { label: "Outreach started", done: meta.status !== "not_started", hint: "Move past “not started”" },
    { label: letterList.length ? `Letters ${lettersConfirmed}/${letterList.length}` : "Letters", done: lettersReady, hint: "Request and confirm letters" },
    { label: "SOP recorded", done: !!(sop as any)?.sop_version_id, hint: "Record which SOP you sent" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/schools" className="text-xs text-gray-500 hover:text-cream self-start">← All schools</Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">{school.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <Chip>{school.country}</Chip>
              {meta.verified_fit && <Chip tone="text-teal-600 border-teal-600">verified fit</Chip>}
              {meta.csranking_nlp_rank != null && <Chip>NLP rank #{meta.csranking_nlp_rank}</Chip>}
              {meta.composite_score != null && <Chip>score {Number(meta.composite_score).toFixed(1)}</Chip>}
              {meta.deadline_date && (
                <Chip tone={meta.deadline_date < today ? "text-red-600 border-red-600" : "text-brass border-brass"}>
                  deadline {meta.deadline_date} · {relative(daysBetween(today, meta.deadline_date))}
                </Chip>
              )}
            </div>
          </div>
          {isOwner && <StatusSelect schoolId={school.id} value={meta.status} />}
        </div>
        {(school.faculty || school.fit_note) && (
          <div className="border border-line bg-surface rounded p-4 text-sm">
            {school.faculty && <div className="font-medium text-cream">{school.faculty}</div>}
            {school.fit_note && <p className="text-gray-500 mt-1">{school.fit_note}</p>}
          </div>
        )}
      </div>

      {isOwner && (
        <section className="border border-line bg-surface rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs uppercase tracking-wide text-gray-500">Application readiness</h2>
            <span className="font-mono text-sm">{doneCount}/{checklist.length}</span>
          </div>
          <div className="h-1.5 rounded bg-surface-raised overflow-hidden">
            <div className="h-full bg-teal-600" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
          </div>
          <ul className="flex flex-wrap gap-2 text-xs">
            {checklist.map((c) => (
              <li
                key={c.label}
                title={c.done ? "Done" : c.hint}
                className={`border rounded-full px-2.5 py-1 flex items-center gap-1.5 ${c.done ? "text-teal-600 border-teal-600" : "text-gray-500 border-line"}`}
              >
                <span aria-hidden>{c.done ? "✓" : "○"}</span>{c.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <Section title="Tasks" count={`${openTasks} open · ${(linkedTasks ?? []).length} total`}>
            {(linkedTasks ?? []).length === 0 ? <Empty>No tasks for this school yet.</Empty> : (
              <ul className="flex flex-col gap-2">
                {(linkedTasks ?? []).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="border rounded p-2.5 text-sm flex justify-between gap-3 items-center hover:border-brass">
                      <span className="min-w-0">
                        <span className={`block truncate ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</span>
                        {t.due_date && (
                          <span className={`block text-xs ${t.due_date < today && t.status !== "done" ? "text-red-600" : "text-gray-500"}`}>due {t.due_date}</span>
                        )}
                      </span>
                      <span className={`text-xs uppercase whitespace-nowrap ${TASK_TONE[t.status]}`}>{t.status.replace("_", " ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {isOwner && <SchoolTaskForm schoolId={id} people={people ?? []} />}
          </Section>

          {isOwner && (
            <Section title="Activity" count={(activity ?? []).length}>
              <NoteForm schoolId={id} />
              {(activity ?? []).length === 0 ? <Empty>No activity yet. Notes and status changes appear here.</Empty> : <ActivityTimeline items={(activity ?? []) as any} schoolId={id} />}
            </Section>
          )}
        </div>

        {isOwner && (
          <div className="flex flex-col gap-6 min-w-0">
            <Section title="Details">
              <SchoolDetailsForm
                schoolId={id} deadlineDate={meta.deadline_date} deadlineNote={meta.deadline_note}
                contactEmail={school.contact_email} faculty={school.faculty} fitNote={school.fit_note}
              />
            </Section>

            <Section title="Recommendation letters" count={letterList.length}>
              {letterList.length === 0 && <div className="mb-3"><Empty>No letters requested yet.</Empty></div>}
              <ul className="flex flex-col gap-2 mb-3">
                {letterList.map((l) => (
                  <LetterRow key={l.id} id={l.id} schoolId={id} name={l.people?.name ?? "Unknown recommender"} deadline={l.letter_deadline} status={l.status} />
                ))}
              </ul>
              <AddLetterForm schoolId={id} people={people ?? []} />
            </Section>

            <Section title="SOP sent">
              <SopForm schoolId={id} current={(sop as any)?.sop_version_id ? { label: sopLabel ?? "Recorded version", sentAt: (sop as any).sop_sent_at } : null} />
            </Section>

            <Section title="Interviews" count={(interviews ?? []).length}>
              {(interviews ?? []).length === 0 && <div className="mb-3"><Empty>No interviews yet.</Empty></div>}
              <ul className="flex flex-col gap-2 mb-3">
                {(interviews ?? []).map((iv) => (
                  <InterviewRow key={iv.id} id={iv.id} schoolId={id} when={iv.scheduled_at} prep={iv.prep_notes} outcome={iv.outcome_notes} status={iv.status} />
                ))}
              </ul>
              <ScheduleInterviewForm schoolId={id} />
            </Section>

            {visaSteps && visaSteps.length > 0 && (
              <Section title="Visa checklist" count={`${visaSteps.filter((v) => v.status === "done").length}/${visaSteps.length}`}>
                <ul className="flex flex-col gap-2">
                  {visaSteps.map((v) => <VisaStepRow key={v.id} id={v.id} schoolId={id} name={v.step_name} status={v.status} />)}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Section({ title, count, children }: { title: string; count?: number | string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface rounded-lg p-4">
      <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex justify-between">
        <span>{title}</span>
        {count !== undefined && <span className="font-mono normal-case">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 border border-dashed border-line rounded p-3 text-center">{children}</p>;
}

function Chip({ children, tone = "text-gray-500 border-line" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`border rounded-full px-2.5 py-0.5 ${tone}`}>{children}</span>;
}
