import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { addNote, updateContactEmail } from "./actions";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: school }, { data: activity }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("activity_log").select("*").eq("school_id", id).order("occurred_at", { ascending: false }),
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
        <h2 className="font-medium mb-2">Activity</h2>
        <ActivityTimeline items={activity ?? []} />
      </div>
    </main>
  );
}
