import { createClient } from "@/lib/supabase/server";
import { LinksPanel, type LinkRow } from "@/components/links-panel";
import { OWNER_USER_ID } from "@/lib/owner";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: links }, { data: schools }, { data: milestones }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("links").select("*").order("created_at", { ascending: false }),
    supabase.from("schools").select("id, name"),
    supabase.from("research_milestones").select("id, title"),
  ]);

  if (user?.id !== OWNER_USER_ID) {
    return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">The library is only available to the workspace owner.</main>;
  }

  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const milestoneTitle = new Map((milestones ?? []).map((m) => [m.id, m.title]));
  const rows: LinkRow[] = ((links ?? []) as any[]).map((l) => ({
    ...l,
    scopeLabel: l.school_id ? schoolName.get(l.school_id) ?? "School" : l.milestone_id ? `Milestone: ${milestoneTitle.get(l.milestone_id) ?? ""}` : "Research project",
  }));

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-gray-500">Every link you've saved, across your research project, milestones and schools. Links you add here go to the research project; add school- or milestone-specific ones from their own pages.</p>
      </div>
      <LinksPanel links={rows} scope={{}} placeholder="Paste any link: GitHub repo, arXiv paper, dataset, doc…" emptyText="Nothing saved yet. Paste your first link above." />
    </main>
  );
}
