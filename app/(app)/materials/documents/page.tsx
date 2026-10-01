import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { DocumentsPanel, type DocRow } from "@/components/documents-panel";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: docs }, { data: schools }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("documents").select("*").is("project_id", null).order("created_at", { ascending: false }),
    supabase.from("schools").select("id, name").order("name"),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Materials are only available to the workspace owner.</main>;
  }
  const name = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const rows: DocRow[] = ((docs ?? []) as any[]).map((d) => ({ ...d, schoolName: d.school_id ? name.get(d.school_id) : undefined }));

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Materials" title="Documents" subtitle="Transcripts, score reports, CVs and writing samples, private to you." />
        <SubNav items={MATERIALS_TABS} current="/materials/documents" />
      </div>
      <DocumentsPanel docs={rows} schools={schools ?? []} userId={user.id} />
    </main>
  );
}
