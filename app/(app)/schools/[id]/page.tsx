import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { addNote, updateContactEmail } from "./actions";
import { addLetterRequest, updateLetterStatus, createSopVersion, setSchoolSopVersion } from "./logistics-actions";
import Link from "next/link";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: school }, { data: activity }, { data: linkedTasks }, { data: letters }, { data: people }, { data: sopVersion }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("activity_log").select("*").eq("school_id", id).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("id, title, status").eq("school_id", id),
    supabase.from("letter_requests").select("*, people(name)").eq("school_id", id),
    supabase.from("people").select("id, name"),
    supabase.from("schools").select("sop_version_id, sop_sent_at, sop_versions(label)").eq("id", id).single(),
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
        <button className="bg-black text-white rounded px-3 py-1 text-sm">Save</button>
      </form>

      <form action={addNoteAction} className="flex flex-col gap-2">
        <textarea name="content" placeholder="Add a note…" className="border rounded p-2 text-sm" rows={3} />
        <button className="bg-black text-white rounded px-3 py-1 text-sm self-start">Add note</button>
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
          <button className="bg-black text-white rounded px-3 py-1 text-sm">Request letter</button>
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
          <button className="bg-black text-white rounded px-3 py-1 text-sm">Record as sent</button>
        </form>
      </div>

      <div>
        <h2 className="font-medium mb-2">Activity</h2>
        <ActivityTimeline items={activity ?? []} />
      </div>
    </main>
  );
}
