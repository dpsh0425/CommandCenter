import { createClient } from "@/lib/supabase/server";
import { PersonCard } from "@/components/person-card";
import { addPerson } from "./actions";
import { OWNER_USER_ID } from "@/lib/owner";

export default async function PeoplePage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: people }, { data: tasks }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("people").select("*"),
    supabase.from("tasks").select("assignee_id, status"),
  ]);
  const canInvite = user?.id === OWNER_USER_ID;

  const loadByPerson: Record<string, number> = {};
  for (const t of tasks ?? []) {
    if (t.assignee_id && t.status !== "done" && t.status !== "cancelled") {
      loadByPerson[t.assignee_id] = (loadByPerson[t.assignee_id] ?? 0) + 1;
    }
  }

  async function addPersonForm(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await addPerson({
      name,
      role: String(formData.get("role") ?? "").trim() || undefined,
      area: String(formData.get("area") ?? "").trim() || undefined,
    });
  }

  return (
    <main className="p-8 max-w-3xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">People</h1>
      {canInvite && (
        <form action={addPersonForm} className="flex gap-2 flex-wrap border rounded p-3">
          <input name="name" placeholder="Name" className="border rounded px-2 py-1 text-sm" required />
          <input name="role" placeholder="Role" className="border rounded px-2 py-1 text-sm" />
          <input name="area" placeholder="Area" className="border rounded px-2 py-1 text-sm" />
          <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm">Add person</button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-3">
        {(people ?? []).map((p) => (
          <PersonCard key={p.id} person={{ ...p, openTaskCount: loadByPerson[p.id] ?? 0, authUserId: p.auth_user_id }} canInvite={canInvite} />
        ))}
      </div>
    </main>
  );
}
