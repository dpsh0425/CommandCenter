import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { ResumeEditor } from "@/components/resume-editor";
import { normalizeResume } from "@/lib/resume";

export const metadata = { title: "Edit resume" };

export default async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, { data: resume }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("resumes").select("id, name, data").eq("id", id).single(),
  ]);
  if (!user || user.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Materials are only available to the workspace owner.</main>;
  }
  if (!resume) return <main className="p-4 md:p-8">Not found.</main>;
  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-4">
      <Link href="/materials/resume" className="text-xs text-gray-500 hover:text-cream self-start print:hidden">← Resumes</Link>
      <ResumeEditor id={resume.id} initialName={resume.name} initial={normalizeResume(resume.data)} />
    </main>
  );
}
