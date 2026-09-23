import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { ResumeList } from "@/components/resume-list";
import { MATERIALS_TABS, PageHeader, SubNav } from "@/components/ui";

export const metadata = { title: "Resume builder" };

export default async function ResumesPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: resumes }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("resumes").select("id, name, updated_at").order("updated_at", { ascending: false }),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Materials are only available to the workspace owner.</main>;
  }
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Materials" subtitle="Build a resume, keep a version for each kind of application, and download it as a PDF." />
        <SubNav items={MATERIALS_TABS} current="/materials/resume" />
      </div>
      <ResumeList resumes={resumes ?? []} />
    </main>
  );
}
