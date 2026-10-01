import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { StatementsList, type StatementRow } from "@/components/statements-list";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";

export const metadata = { title: "Statements" };

export default async function StatementsPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: statements }, { data: schools }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("statements").select("id, kind, title, status, words, word_limit, school_id, updated_at").order("updated_at", { ascending: false }),
    supabase.from("schools").select("id, name, applying").order("name"),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Statements are only available to the workspace owner.</main>;
  }
  // Schools you are applying to come first in the picker.
  const ordered = [...(schools ?? [])].sort((a, b) => Number(b.applying) - Number(a.applying) || a.name.localeCompare(b.name));
  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Materials" title="Statements" subtitle="Write your statements here: a general draft, then a tailored version for each school." />
        <SubNav items={MATERIALS_TABS} current="/materials/statements" />
      </div>
      <StatementsList statements={(statements ?? []) as StatementRow[]} schools={ordered.map((s) => ({ id: s.id, name: s.name }))} />
    </main>
  );
}
