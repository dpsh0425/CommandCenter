import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { addMilestone } from "./actions";
import { OWNER_USER_ID } from "@/lib/owner";

export default async function ResearchPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: milestones }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("research_milestones").select("*").order("target_date"),
  ]);
  const isOwner = user?.id === OWNER_USER_ID;

  async function addMilestoneAction(formData: FormData) {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const description = String(formData.get("description") ?? "").trim();
    const targetDate = String(formData.get("target_date") ?? "").trim();
    await addMilestone(title, description || undefined, targetDate || undefined);
  }

  return (
    <main className="p-8 max-w-2xl mx-auto flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">The Broken Ruler</h1>
      <p className="text-sm text-gray-500">Nepali benchmark measurement-error study — Week 1 foundation milestones.</p>
      {(milestones ?? []).map((m) => (
        <Link key={m.id} href={`/research/${m.id}`} className="border rounded p-3 hover:border-brass">
          <div className="flex justify-between">
            <span className="font-medium">{m.title}</span>
            <span className="text-xs uppercase text-gray-500">{m.status.replace("_", " ")}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{m.description}</p>
        </Link>
      ))}
      {isOwner && (
        <details className="border border-dashed border-line rounded p-3">
          <summary className="text-sm text-gray-500 cursor-pointer">+ Add milestone</summary>
          <form action={addMilestoneAction} className="flex flex-col gap-2 mt-3">
            <input name="title" placeholder="Milestone title" className="border rounded px-2 py-1 text-sm" required />
            <textarea name="description" placeholder="Description (optional)" className="border rounded px-2 py-1 text-sm" rows={2} />
            <input type="date" name="target_date" className="border rounded px-2 py-1 text-sm" />
            <button className="bg-brass text-ink font-medium rounded px-3 py-1 text-sm self-start">Add milestone</button>
          </form>
        </details>
      )}
    </main>
  );
}
