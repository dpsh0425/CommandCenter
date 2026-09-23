import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { addNote, updateContactEmail } from "./actions";
import { addLetterRequest, updateLetterStatus, createSopVersion, setSchoolSopVersion } from "./logistics-actions";
import { scheduleInterview, updateVisaStep } from "./interview-actions";
import { StatusSelect } from "@/components/status-select";
import { OWNER_USER_ID } from "@/lib/owner";
import Link from "next/link";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: school }, { data: activity }, { data: linkedTasks }, { data: letters }, { data: people }, { data: sopVersion }, { data: interviews }, { data: visaSteps }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("activity_log").select("*").eq("school_id", id).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("id, title, status").eq("school_id", id),
    supabase.from("letter_requests").select("*, people(name)").eq("school_id", id),
    supabase.from("people").select("id, name"),
    supabase.from("schools").select("sop_version_id, sop_sent_at, sop_versions(label)").eq("id", id).single(),
    supabase.from("interviews").select("*").eq("school_id", id).order("scheduled_at"),
    supabase.from("visa_steps").select("*").eq("school_id", id).order("created_at"),
  ]);

  if (!school) return <p className="p-4 md:p-8">Not found.</p>;
  const isOwner = user?.id === OWNER_USER_ID;

  async function addNoteAction(formData: FormData) {
    "use server";
    const content = String(formData.get("content") ?? "").trim();
    if (content) await addNote(id, content);
  }

  async function updateEmailAction(formData: FormData) {
    "use server";
    const email = String(formData.get("contact_email") ?? "").trim();
    if (email) await updateContactEmail(id, email);
  }

  async function addLetterAction(formData: FormData) {
    "use server";
    const recommenderId = String(formData.get("recommender_id") ?? "");
    const deadline = String(formData.get("letter_deadline") ?? "").trim();
    if (recommenderId) await addLetterRequest(id, recommenderId, deadline || undefined);
  }

  async function updateLetterStatusAction(formData: FormData) {
    "use server";
    const letterId = String(formData.get("letter_id") ?? "");
    const status = String(formData.get("status") ?? "not_asked") as any;
    if (letterId) await updateLetterStatus(letterId, id, status);
  }

  async function addSopVersionAction(formData: FormData) {
    "use server";
    const label = String(formData.get("label") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const link = String(formData.get("external_link") ?? "").trim();
    if (!label) return;
    const sopId = await createSopVersion(label, description || undefined, link || undefined);
    await setSchoolSopVersion(id, sopId);
  }

  async function scheduleInterviewAction(formData: FormData) {
    "use server";
    const scheduledAt = String(formData.get("scheduled_at") ?? "").trim();
    const prepNotes = String(formData.get("prep_notes") ?? "").trim();
    if (scheduledAt) await scheduleInterview(id, scheduledAt, prepNotes || undefined);
  }

  async function updateVisaStepAction(formData: FormData) {
    "use server";
    const stepId = String(formData.get("step_id") ?? "");
    const status = String(formData.get("status") ?? "not_started") as any;
    if (stepId) await updateVisaStep(stepId, id, status);
  }

  const meta = school as any;

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
              {meta.deadline_date && <Chip tone="text-brass border-brass">deadline {meta.deadline_date}</Chip>}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <div className="flex flex-col gap-6 min-w-0">
      <Section title="Linked tasks" count={(linkedTasks ?? []).length}>
        {(linkedTasks ?? []).length === 0 ? <Empty>No tasks linked to this school yet.</Empty> : (
          <ul className="flex flex-col gap-2">
            {(linkedTasks ?? []).map((t) => (
              <li key={t.id} className="border rounded p-2 text-sm flex justify-between gap-2">
                <Link href={`/tasks/${t.id}`} className="hover:underline">{t.title}</Link>
                <span className="text-xs uppercase text-gray-500 whitespace-nowrap">{t.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isOwner && (
      <Section title="Activity" count={(activity ?? []).length}>
        <form action={addNoteAction} className="flex flex-col gap-2 mb-4">
          <textarea name="content" placeholder="Log a note, call, or outreach…" className="border rounded p-2 text-sm" rows={3} />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm self-start">Add note</button>
        </form>
        {(activity ?? []).length === 0 ? <Empty>No activity yet.</Empty> : <ActivityTimeline items={activity ?? []} />}
      </Section>
      )}
      </div>

      {isOwner && (
      <div className="flex flex-col gap-6 min-w-0">
      <Section title="Contact">
        <form action={updateEmailAction} className="flex gap-2 items-center">
          <input
            name="contact_email"
            type="email"
            defaultValue={school.contact_email ?? ""}
            placeholder="faculty@university.edu"
            className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
          />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Save</button>
        </form>
        {school.contact_email && (
          <a href={`mailto:${school.contact_email}`} className="text-xs text-brass underline mt-2 inline-block">Compose email</a>
        )}
      </Section>

      <Section title="Recommendation letters" count={(letters ?? []).length}>
        {(letters ?? []).length === 0 && <div className="mb-3"><Empty>No letters requested.</Empty></div>}
        <ul className="flex flex-col gap-2 mb-2">
          {(letters ?? []).map((l: any) => (
            <li key={l.id} className="border rounded p-2 text-sm flex justify-between items-center gap-2 flex-wrap">
              <span>{l.people?.name ?? "Unknown"}{l.letter_deadline && ` — due ${l.letter_deadline}`}</span>
              <form action={updateLetterStatusAction} className="flex items-center gap-1">
                <input type="hidden" name="letter_id" value={l.id} />
                <select name="status" defaultValue={l.status} className="border rounded text-xs px-1 py-0.5">
                  <option value="not_asked">not asked</option>
                  <option value="asked">asked</option>
                  <option value="confirmed">confirmed</option>
                  <option value="submitted">submitted</option>
                </select>
                <button className="text-xs border rounded px-2 py-0.5">Update</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addLetterAction} className="flex gap-2 items-center flex-wrap">
          <select name="recommender_id" className="border rounded px-2 py-1 text-sm" required>
            <option value="">Choose recommender…</option>
            {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" name="letter_deadline" className="border rounded px-2 py-1 text-sm" />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Request letter</button>
        </form>
      </Section>

      <Section title="SOP sent">
        {sopVersion?.sop_version_id ? (
          <p className="text-sm text-gray-500 mb-3">
            <span className="text-cream">{(sopVersion as any).sop_versions?.label}</span> — sent {sopVersion.sop_sent_at}
          </p>
        ) : (
          <div className="mb-3"><Empty>No SOP version recorded yet.</Empty></div>
        )}
        <form action={addSopVersionAction} className="flex flex-col gap-2">
          <input name="label" placeholder="Version label, e.g. v3 — AU variant" className="border rounded px-2 py-1 text-sm" required />
          <input name="external_link" placeholder="Link (optional)" className="border rounded px-2 py-1 text-sm" />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm self-start">Record as sent</button>
        </form>
      </Section>

      <Section title="Interviews" count={(interviews ?? []).length}>
        {(interviews ?? []).length === 0 && <div className="mb-3"><Empty>No interviews scheduled.</Empty></div>}
        <ul className="flex flex-col gap-2 mb-3">
          {(interviews ?? []).map((iv) => (
            <li key={iv.id} className="border rounded p-2 text-sm">
              <div className="flex justify-between gap-2">
                <span>{new Date(iv.scheduled_at).toLocaleString()}</span>
                <span className="text-xs uppercase text-gray-500">{iv.status.replace("_", " ")}</span>
              </div>
              {iv.prep_notes && <p className="text-gray-500 mt-1">{iv.prep_notes}</p>}
            </li>
          ))}
        </ul>
        <form action={scheduleInterviewAction} className="flex flex-col gap-2">
          <input type="datetime-local" name="scheduled_at" className="border rounded px-2 py-1 text-sm" required />
          <input name="prep_notes" placeholder="Prep notes (optional)" className="border rounded px-2 py-1 text-sm" />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm self-start">Schedule interview</button>
        </form>
      </Section>

      {visaSteps && visaSteps.length > 0 && (
        <Section
          title="Visa checklist"
          count={`${visaSteps.filter((v) => v.status === "done").length}/${visaSteps.length}`}
        >
          <ul className="flex flex-col gap-2">
            {visaSteps.map((v) => (
              <li key={v.id} className="border rounded p-2 text-sm flex justify-between items-center gap-2">
                <span className={v.status === "done" ? "line-through text-gray-500" : ""}>{v.step_name}</span>
                <form action={updateVisaStepAction} className="flex items-center gap-1">
                  <input type="hidden" name="step_id" value={v.id} />
                  <select name="status" defaultValue={v.status} className="border rounded text-xs px-1 py-0.5">
                    <option value="not_started">not started</option>
                    <option value="in_progress">in progress</option>
                    <option value="done">done</option>
                  </select>
                  <button className="text-xs border rounded px-2 py-0.5">Update</button>
                </form>
              </li>
            ))}
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
        {count !== undefined && <span className="font-mono">{count}</span>}
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
