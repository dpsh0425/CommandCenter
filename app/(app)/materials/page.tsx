import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { DocumentsPanel, type DocRow } from "@/components/documents-panel";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";

export const metadata = { title: "Materials" };

export default async function MaterialsPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: docs }, { data: schools }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("documents").select("*").order("created_at", { ascending: false }),
    supabase.from("schools").select("id, name").order("name"),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Materials are only available to the workspace owner.</main>;
  }
  const name = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const rows: DocRow[] = ((docs ?? []) as any[]).map((d) => ({ ...d, schoolName: d.school_id ? name.get(d.school_id) : undefined }));

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Materials" subtitle="Your resume, transcripts, statements and writing samples in one place." />
        <SubNav items={MATERIALS_TABS} current="/materials" />
      </div>
      <DocumentsPanel docs={rows} schools={schools ?? []} userId={user.id} />
    </main>
  );
}
