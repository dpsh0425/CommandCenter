import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { addNote, updateContactEmail } from "./actions";
import { addLetterRequest, updateLetterStatus, createSopVersion, setSchoolSopVersion } from "./logistics-actions";
import { scheduleInterview, updateVisaStep } from "./interview-actions";
import Link from "next/link";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: school }, { data: activity }, { data: linkedTasks }, { data: letters }, { data: people }, { data: sopVersion }, { data: interviews }, { data: visaSteps }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("activity_log").select("*").eq("school_id", id).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("id, title, status").eq("school_id", id),
    supabase.from("letter_requests").select("*, people(name)").eq("school_id", id),
    supabase.from("people").select("id, name"),
    supabase.from("schools").select("sop_version_id, sop_sent_at, sop_versions(label)").eq("id", id).single(),
    supabase.from("interviews").select("*").eq("school_id", id).order("scheduled_at"),
    supabase.from("visa_steps").select("*").eq("school_id", id).order("created_at"),
  ]);

  if (!school) return <p className="p-8">Not found.</p>;

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

  return (
    <main className="p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{school.name}</h1>
        <p className="text-gray-600">{school.faculty} — {school.fit_note}</p>
      </div>

      <form action={updateEmailAction} className="flex gap-2 items-center">
        <label className="text-sm text-gray-500">Contact email</label>
        <input
          name="contact_email"
          defaultValue={school.contact_email ?? ""}
          placeholder="faculty@university.edu"
          className="border rounded px-2 py-1 text-sm flex-1"
        />
        <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Save</button>
      </form>

      <form action={addNoteAction} className="flex flex-col gap-2">
        <textarea name="content" placeholder="Add a note…" className="border rounded p-2 text-sm" rows={3} />
        <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm self-start">Add note</button>
      </form>

      <div>
        <h2 className="font-medium mb-2">Linked tasks ({(linkedTasks ?? []).length})</h2>
        <ul className="flex flex-col gap-2">
          {(linkedTasks ?? []).map((t) => (
            <li key={t.id} className="border rounded p-2 text-sm flex justify-between">
              <Link href={`/tasks/${t.id}`} className="hover:underline">{t.title}</Link>
              <span className="text-xs uppercase text-gray-500">{t.status.replace("_", " ")}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-medium mb-2">Recommendation letters</h2>
        <ul className="flex flex-col gap-2 mb-2">
          {(letters ?? []).map((l: any) => (
            <li key={l.id} className="border rounded p-2 text-sm flex justify-between items-center">
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
        <form action={addLetterAction} className="flex gap-2 items-center">
          <select name="recommender_id" className="border rounded px-2 py-1 text-sm" required>
            <option value="">Choose recommender…</option>
            {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" name="letter_deadline" className="border rounded px-2 py-1 text-sm" />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Request letter</button>
        </form>
      </div>

      <div>
        <h2 className="font-medium mb-2">SOP sent</h2>
        {sopVersion?.sop_version_id ? (
          <p className="text-sm text-gray-600 mb-2">{(sopVersion as any).sop_versions?.label} — sent {sopVersion.sop_sent_at}</p>
        ) : (
          <p className="text-sm text-gray-500 mb-2">No SOP version recorded yet.</p>
        )}
        <form action={addSopVersionAction} className="flex gap-2 flex-wrap">
          <input name="label" placeholder="Version label, e.g. v3 — AU variant" className="border rounded px-2 py-1 text-sm" required />
          <input name="external_link" placeholder="Link (optional)" className="border rounded px-2 py-1 text-sm" />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Record as sent</button>
        </form>
      </div>

      <div>
        <h2 className="font-medium mb-2">Interviews</h2>
        <ul className="flex flex-col gap-2 mb-2">
          {(interviews ?? []).map((iv) => (
            <li key={iv.id} className="border rounded p-2 text-sm">
              <div className="flex justify-between">
                <span>{new Date(iv.scheduled_at).toLocaleString()}</span>
                <span className="text-xs uppercase text-gray-500">{iv.status.replace("_", " ")}</span>
              </div>
              {iv.prep_notes && <p className="text-gray-500 mt-1">{iv.prep_notes}</p>}
            </li>
          ))}
        </ul>
        <form action={scheduleInterviewAction} className="flex gap-2 flex-wrap items-center">
          <input type="datetime-local" name="scheduled_at" className="border rounded px-2 py-1 text-sm" required />
          <input name="prep_notes" placeholder="Prep notes (optional)" className="border rounded px-2 py-1 text-sm flex-1" />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Schedule interview</button>
        </form>
      </div>

      {visaSteps && visaSteps.length > 0 && (
        <div>
          <h2 className="font-medium mb-2">Visa checklist <span className="text-xs text-gray-400 font-normal">— auto-created on acceptance</span></h2>
          <ul className="flex flex-col gap-2">
            {visaSteps.map((v) => (
              <li key={v.id} className="border rounded p-2 text-sm flex justify-between items-center">
                <span>{v.step_name}</span>
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
        </div>
      )}

      <div>
        <h2 className="font-medium mb-2">Activity</h2>
        <ActivityTimeline items={activity ?? []} />
      </div>
    </main>
  );
}
