import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { PageHeader, RESEARCH_TABS, SubNav } from "@/components/ui";
import { ReadingList, type ReadingPaper } from "@/components/reading-list";

export const metadata = { title: "Reading list" };

export default async function ReadingListPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: papers }, { data: projects }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("research_papers").select("id, project_id, title, authors, year, url, status, takeaway, created_at").order("created_at", { ascending: false }),
    supabase.from("research_projects").select("id, title").order("created_at"),
  ]);
  if (user?.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">The reading list is only available to the workspace owner.</main>;
  }
  const title = new Map((projects ?? []).map((p) => [p.id, p.title]));
  const rows: ReadingPaper[] = (papers ?? []).map((p) => ({
    id: p.id, project_id: p.project_id, projectTitle: title.get(p.project_id) ?? "Project", title: p.title, authors: p.authors,
    year: p.year, url: p.url, status: p.status, takeaway: p.takeaway,
  }));

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Work" title="Reading list" subtitle="Every paper across your projects. Add papers on a project's Reading tab." />
        <SubNav items={RESEARCH_TABS} current="/research/reading" />
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No papers yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Add the papers each project builds on from its Reading tab, then write one line on what each gives you.</p>
          <Link href="/research" className="mt-3 inline-block text-[13px] font-medium text-blue-600 hover:text-blue-700">Go to projects →</Link>
        </div>
      ) : (
        <ReadingList papers={rows} projects={projects ?? []} />
      )}
    </main>
  );
}
