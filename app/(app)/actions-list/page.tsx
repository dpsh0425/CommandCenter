import { createClient } from "@/lib/supabase/server";
import { addAction } from "./actions";
import { ActionCheckbox } from "@/components/action-checkbox";

export default async function ActionsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("actions").select("*").order("order_index");

  async function addActionForm(formData: FormData) {
    "use server";
    const text = String(formData.get("text") ?? "").trim();
    if (text) await addAction(text);
  }

  return (
    <main className="p-8 max-w-xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Next actions</h1>
      <ul className="flex flex-col gap-2">
        {(items ?? []).map((a) => (
          <li key={a.id} className="flex items-center gap-2 border rounded p-2">
            <ActionCheckbox id={a.id} done={a.done} />
            <span className={a.done ? "line-through text-gray-400" : ""}>{a.text}</span>
          </li>
        ))}
      </ul>
      <form action={addActionForm} className="flex gap-2">
        <input name="text" placeholder="Add an action…" className="border rounded px-2 py-1 flex-1" />
        <button className="bg-brass text-ink font-medium rounded px-3 py-1">Add</button>
      </form>
    </main>
  );
}
