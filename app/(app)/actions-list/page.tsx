import { createClient } from "@/lib/supabase/server";
import { addAction } from "./actions";
import { ActionCheckbox } from "@/components/action-checkbox";
import { PageHeader, SubNav, TODAY_TABS } from "@/components/ui";

export const metadata = { title: "Actions" };

export default async function ActionsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("actions").select("*").order("order_index");

  async function addActionForm(formData: FormData) {
    "use server";
    const text = String(formData.get("text") ?? "").trim();
    if (text) await addAction(text);
  }

  const list = items ?? [];
  const open = list.filter((a) => !a.done).length;

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Overview"
          title="Next actions"
          subtitle="A quick checklist for small things that don't need a full task."
        />
        <SubNav items={TODAY_TABS} current="/actions-list" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <form action={addActionForm} className="flex gap-2 border-b border-slate-200 px-4 py-3.5">
          <label htmlFor="new-action" className="sr-only">New action</label>
          <input
            id="new-action"
            name="text"
            placeholder="Add an action…"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600"
          />
          <button className="h-9 flex-shrink-0 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700">
            Add
          </button>
        </form>

        {list.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Nothing here yet. Add the next small thing you need to do.</p>
        ) : (
          <ul className="px-2 py-1.5">
            {list.map((a) => (
              <li key={a.id}>
                <ActionCheckbox id={a.id} done={a.done} text={a.text} />
              </li>
            ))}
          </ul>
        )}

        {list.length > 0 && (
          <div className="border-t border-slate-200 px-5 py-2.5 text-xs text-slate-500">
            {open} open · {list.length - open} done
          </div>
        )}
      </section>
    </main>
  );
}
