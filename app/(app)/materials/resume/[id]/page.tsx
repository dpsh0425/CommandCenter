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
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Materials are only available to the workspace owner.</main>;
  }
  if (!resume) return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Resume not found.</main>;
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4 md:p-8">
      <Link href="/materials/resume" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900 print:hidden">← Resumes</Link>
      <ResumeEditor id={resume.id} initialName={resume.name} initial={normalizeResume(resume.data)} />
    </main>
  );
}
