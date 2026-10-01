import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LinksPanel, type LinkRow } from "@/components/links-panel";
import { OWNER_USER_ID } from "@/lib/owner";
import { PageHeader, RESEARCH_TABS, SubNav } from "@/components/ui";

export const metadata = { title: "Library" };

const quickLink = "inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700";

export default async function LibraryPage() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: links }, { data: schools }, { data: milestones }, { data: projects }, { data: departments }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("links").select("*").order("created_at", { ascending: false }),
    supabase.from("schools").select("id, name"),
    supabase.from("research_milestones").select("id, title"),
    supabase.from("research_projects").select("id, title"),
    supabase.from("departments").select("id, name, program, url, admissions_url, school_id").order("name"),
  ]);

  if (user?.id !== OWNER_USER_ID) {
    return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">The library is only available to the workspace owner.</main>;
  }

  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const projectTitle = new Map((projects ?? []).map((p) => [p.id, p.title]));
  const milestoneTitle = new Map((milestones ?? []).map((m) => [m.id, m.title]));
  const rows: LinkRow[] = ((links ?? []) as any[]).map((l) => ({
    ...l,
    scopeLabel: l.school_id ? schoolName.get(l.school_id) ?? "School" : l.milestone_id ? `Milestone: ${milestoneTitle.get(l.milestone_id) ?? ""}` : l.project_id ? projectTitle.get(l.project_id) ?? "Research project" : "Research project",
  }));

  // School quick links: the department and admissions pages you saved on each school. Read only; edit them on the school.
  const quick = (departments ?? []).filter((d) => d.url || d.admissions_url);
  const bySchool = new Map<string, typeof quick>();
  quick.forEach((d) => bySchool.set(d.school_id, [...(bySchool.get(d.school_id) ?? []), d]));
  const schoolGroups = Array.from(bySchool.entries())
    .map(([id, depts]) => ({ id, name: schoolName.get(id) ?? "School", depts }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const pinned = rows.filter((r) => r.pinned).length;

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Work" title="Library" subtitle="Everything you've saved: repos, papers, datasets and docs." />
        <SubNav items={RESEARCH_TABS} current="/links" />
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Saved links", rows.length],
            ["Pinned", pinned],
            ["Repos", rows.filter((r) => r.kind === "github").length],
            ["Papers", rows.filter((r) => r.kind === "paper").length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{label}</div>
              <div className="text-[22px] font-semibold tabular-nums text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <h2 className="text-[15px] font-semibold text-slate-900">School quick links</h2>
          <span className="text-xs text-slate-500">From the departments on each school. Edit them on the school page.</span>
        </div>
        {schoolGroups.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-slate-500">
            No department or admissions links yet. Add them to a department on a school&apos;s page and they show up here.{" "}
            <Link href="/schools" className="font-medium text-blue-600 hover:text-blue-700">Go to schools →</Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schoolGroups.map((g) => (
              <li key={g.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:gap-4">
                <Link href={`/schools/${g.id}`} className="w-full flex-shrink-0 truncate text-[13px] font-semibold text-slate-900 hover:text-blue-700 sm:w-44 sm:pt-1">{g.name}</Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {g.depts.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 min-w-0 truncate text-[13px] text-slate-600">{[d.name, d.program].filter(Boolean).join(" · ")}</span>
                      {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className={quickLink}>Department ↗</a>}
                      {d.admissions_url && <a href={d.admissions_url} target="_blank" rel="noopener noreferrer" className={quickLink}>Admissions ↗</a>}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold text-slate-900">Saved links</h2>
        <LinksPanel links={rows} scope={{}} placeholder="Paste any link: GitHub repo, arXiv paper, dataset, doc…" emptyText="Nothing saved yet. Paste your first link above." browse />
      </section>
    </main>
  );
}
