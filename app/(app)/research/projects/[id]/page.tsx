import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { Avatar } from "@/components/avatar";
import { ProjectLibrary, type LibItem } from "@/components/project-library";
import { ExperimentsBoard, type ExperimentRow } from "@/components/experiments-board";
import { WritingBoard, type SectionRow } from "@/components/writing-board";
import { TeamWeek } from "@/components/team-week";
import { addDays, loadTeamWeek } from "@/lib/team-week";
import { MilestoneStatusSelect } from "@/components/milestone-controls";
import {
  AddMemberForm, AddMilestoneForm, AddTaskForm, DeleteProjectButton, EntryForm, EntryRow, MeetingCard, MeetingForm, PaperForm, PaperRow,
  ProjectEditForm, RemoveMemberButton,
} from "@/components/research-forms";
import { renderRich } from "@/lib/rich-text-server";
import { ENTRY_KINDS, PAPER_STATUS, daysBetween, formatMinutes, kindLabel, projectStatusLabel, relative } from "@/lib/research";
import { todayString } from "@/lib/app-date";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "plan", label: "Plan" },
  { key: "journal", label: "Journal" },
  { key: "experiments", label: "Experiments" },
  { key: "library", label: "Library" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
  { key: "meetings", label: "Meetings" },
  { key: "team", label: "Team" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const TASK_BADGE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-600", in_progress: "bg-blue-50 text-blue-700", blocked: "bg-red-50 text-red-700",
  done: "bg-emerald-50 text-emerald-700", cancelled: "bg-slate-100 text-slate-400",
};
const STATUS_BADGE: Record<string, string> = {
  idea: "bg-slate-100 text-slate-600", planning: "bg-slate-100 text-slate-700", active: "bg-blue-50 text-blue-700",
  writing: "bg-emerald-50 text-emerald-700", submitted: "bg-blue-100 text-blue-800", published: "bg-emerald-100 text-emerald-800",
  paused: "bg-slate-100 text-slate-500",
};
const longDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
// "YYYY-MM-DD" arithmetic in UTC, so clock changes don't shift the result.
const shift = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

const card = "rounded-lg border border-slate-200 bg-white";
const cardHead = "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3";
const cardTitle = "text-[15px] font-semibold text-slate-900";
const headLink = "text-[13px] font-medium text-blue-600 hover:text-blue-700";
const emptyText = "px-5 py-4 text-[13px] text-slate-500";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; kind?: string; w?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";
  const supabase = await createClient();
  // "Today" in APP_TIMEZONE, not the server clock.
  const today = todayString();
  const weekAgo = shift(today, -6);

  const [{ data: { user } }, { data: project }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("research_projects").select("*").eq("id", id).single(),
  ]);
  if (user?.id !== OWNER_USER_ID) return <main className="mx-auto max-w-xl p-4 text-sm text-slate-500 md:p-8">Research projects are only available to the workspace owner.</main>;
  if (!project) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 p-4 md:p-8">
        <Link href="/research" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← All projects</Link>
        <p className="text-sm text-slate-600">This project doesn&apos;t exist or you don&apos;t have access to it.</p>
      </main>
    );
  }

  const { data: milestones } = await supabase.from("research_milestones").select("*").eq("project_id", id).order("target_date", { ascending: true, nullsFirst: false });
  const msIds = (milestones ?? []).map((m) => m.id);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [{ data: tasksA }, { data: tasksB }, { data: entries }, { data: papers }, { data: meetings }, { data: members }, { data: people }, { data: links }, { data: docs }, { data: experiments }, { data: sections }] = await Promise.all([
    supabase.from("tasks").select("id, title, status, priority, due_date, assignee_id, research_milestone_id, people(name)").eq("project_id", id),
    msIds.length ? supabase.from("tasks").select("id, title, status, priority, due_date, assignee_id, research_milestone_id, people(name)").in("research_milestone_id", msIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from("research_entries").select("*").eq("project_id", id).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("research_papers").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("research_meetings").select("*").eq("project_id", id).order("held_on", { ascending: false }),
    supabase.from("research_project_members").select("person_id, role").eq("project_id", id),
    supabase.from("people").select("id, name, color, role").order("name"),
    supabase.from("links").select("*").eq("project_id", id),
    supabase.from("documents").select("*").eq("project_id", id),
    supabase.from("research_experiments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("research_sections").select("*").eq("project_id", id).order("position"),
  ]);

  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const msById = new Map((milestones ?? []).map((m) => [m.id, m]));
  const tasks = Array.from(new Map([...((tasksA ?? []) as any[]), ...((tasksB ?? []) as any[])].map((t) => [t.id, t])).values());
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneMs = (milestones ?? []).filter((m) => m.status === "done").length;
  const weekEntries = (entries ?? []).filter((e) => e.occurred_on >= weekAgo);
  const weekMinutes = weekEntries.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const nextMs = (milestones ?? []).filter((m) => m.status !== "done").slice(0, 3);
  const toRead = (papers ?? []).filter((p) => p.status === "to_read" || p.status === "reading").length;
  const memberIds = new Set((members ?? []).map((m) => m.person_id));
  const peopleOpts = (people ?? []).map((p) => ({ id: p.id, name: p.name }));
  // Team members first-class: with a team, only members are offered; otherwise everyone in People.
  const assignable = peopleOpts.some((p) => memberIds.has(p.id)) ? peopleOpts.filter((p) => memberIds.has(p.id)) : peopleOpts;
  const msOpts = (milestones ?? []).map((m) => ({ id: m.id, name: m.title }));
  const base = `/research/projects/${id}`;
  const libItems: LibItem[] = [
    ...((docs ?? []) as any[]).map((d): LibItem => ({
      id: d.id, source: "file", title: d.title, kind: d.kind, folder: d.folder, tags: d.tags ?? [], notes: d.notes, pinned: d.pinned, created_at: d.created_at,
      file_name: d.file_name, mime_type: d.mime_type, size_bytes: d.size_bytes, is_current: d.is_current, replaces_id: d.replaces_id, version_note: d.version_note,
    })),
    ...((links ?? []) as any[]).map((l): LibItem => ({
      id: l.id, source: "link", title: l.title, kind: l.kind, folder: l.folder, tags: l.tags ?? [], notes: l.notes, pinned: l.pinned, created_at: l.created_at, url: l.url, meta: l.meta ?? {},
    })),
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const expRows = (experiments ?? []) as ExperimentRow[];
  const secRows = (sections ?? []) as SectionRow[];
  const wordsTotal = secRows.reduce((n, x) => n + x.words, 0);
  const wordsTarget = secRows.reduce((n, x) => n + (x.target_words ?? 0), 0);
  const weekOffset = Math.max(-12, Math.min(4, Number(sp.w) || 0));
  // Monday of the chosen week, counted from today in APP_TIMEZONE.
  const monday = shift(today, -((new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7) + weekOffset * 7);
  const weekEnd = addDays(monday, 6);
  const teamWeek = tab === "team" ? await loadTeamWeek(supabase, id, monday, today) : null;
  const pinnedItems = libItems.filter((i) => i.pinned).slice(0, 4);
  const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < today).length;
  const running = expRows.filter((x) => x.status === "running").length;
  const memberCount = (members ?? []).length;
  const tabCount: Partial<Record<Tab, number>> = { reading: toRead, experiments: running, team: memberCount };

  const tiles: Array<{ label: string; value: string; sub?: string; subTone?: string; bar?: number; tone?: string }> = [
    { label: "Milestones", value: `${doneMs} of ${(milestones ?? []).length}`, bar: (milestones ?? []).length ? Math.round((doneMs / (milestones ?? []).length) * 100) : 0 },
    { label: "This week", value: weekMinutes ? formatMinutes(weekMinutes) : "0m", sub: `${weekEntries.length} journal entr${weekEntries.length === 1 ? "y" : "ies"}`, tone: weekMinutes ? "text-blue-700" : undefined },
    { label: "Open tasks", value: String(openTasks.length), sub: overdueTasks ? `${overdueTasks} overdue` : "none overdue", subTone: overdueTasks ? "font-medium text-red-700" : undefined },
    {
      label: secRows.length ? "Words written" : "To read",
      value: secRows.length ? wordsTotal.toLocaleString() : String(toRead),
      sub: secRows.length ? (wordsTarget ? `of ${wordsTarget.toLocaleString()} target` : `${secRows.length} sections`) : "papers to read or reading",
    },
  ];

  return (
    <main className={`mx-auto flex w-full flex-col gap-4 p-4 md:p-8 ${tab === "library" ? "max-w-7xl" : "max-w-[1040px]"}`}>
      <Link href="/research" className="self-start text-[13px] font-medium text-slate-600 hover:text-slate-900">← All projects</Link>

      <section className={`${card} flex flex-wrap items-start justify-between gap-4 px-5 py-5 md:px-6`}>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">Research project</p>
          <h1 className="text-[26px] font-semibold leading-[34px] tracking-tight text-slate-900">{project.title}</h1>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className={`rounded-full px-2.5 py-0.5 font-medium ${STATUS_BADGE[project.status] ?? STATUS_BADGE.planning}`}>{projectStatusLabel(project.status)}</span>
            {project.venue && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                {project.venue}{project.venue_deadline ? ` · due ${relative(daysBetween(today, project.venue_deadline))}` : ""}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">{memberCount ? `${memberCount} on the team` : "Solo project"}</span>
          </div>
          {project.question && <p className="max-w-2xl text-sm text-slate-600">{project.question}</p>}
        </div>
        <Link href={`${base}?tab=journal`} className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700">+ Log work</Link>
      </section>

      <nav className="flex gap-5 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Project sections">
        {TABS.map((t) => {
          const active = tab === t.key;
          const n = tabCount[t.key];
          return (
            <Link
              key={t.key} href={t.key === "overview" ? base : `${base}?tab=${t.key}`} scroll={false} aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors ${active ? "border-blue-600 font-semibold text-slate-900" : "border-transparent font-medium text-slate-500 hover:text-slate-900"}`}
            >
              {t.label}
              {!!n && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600">{n}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className={`${card} px-4 py-3`}>
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">{t.label}</p>
                <p className={`text-[22px] font-semibold tabular-nums ${t.tone ?? "text-slate-900"}`}>{t.value}</p>
                {t.bar != null ? (
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${t.bar}%` }} /></span>
                ) : (
                  <p className={`truncate text-xs ${t.subTone ?? "text-slate-500"}`}>{t.sub}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <section className={card}>
              <div className={cardHead}><h2 className={cardTitle}>Coming up</h2><Link href={`${base}?tab=plan`} className={headLink}>Plan</Link></div>
              {nextMs.length === 0 ? <p className={emptyText}>Nothing pending. Add milestones in the Plan tab.</p> : (
                <ul className="px-3 py-1.5">
                  {nextMs.map((m) => {
                    const mt = tasks.filter((t) => t.research_milestone_id === m.id && t.status !== "done" && t.status !== "cancelled").length;
                    return (
                      <li key={m.id}>
                        <Link href={`/research/${m.id}`} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-slate-50">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">{m.title}</span>
                            <span className="block text-xs text-slate-500">{mt ? `${mt} open task${mt === 1 ? "" : "s"}` : "no open tasks"}</span>
                          </span>
                          <span className={`whitespace-nowrap text-xs font-medium ${m.target_date && m.target_date < today ? "text-red-700" : m.target_date ? "text-blue-700" : "text-slate-400"}`}>
                            {m.target_date ? relative(daysBetween(today, m.target_date)) : "no date"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className={card}>
              <div className={cardHead}><h2 className={cardTitle}>Recent journal</h2><Link href={`${base}?tab=journal`} className={headLink}>Journal</Link></div>
              {(entries ?? []).length === 0 ? <p className={emptyText}>Nothing logged yet. Every experiment, reading session, meeting and decision belongs in the journal.</p> : (
                <ul className="px-5 py-1">
                  {(entries ?? []).slice(0, 5).map((e) => (
                    <li key={e.id} className="flex items-start gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0">
                      <span className="mt-0.5 w-24 flex-shrink-0"><span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{kindLabel(e.kind)}</span></span>
                      <span className="min-w-0 flex-1 truncate text-slate-900">{e.title}</span>
                      <span className="whitespace-nowrap text-xs text-slate-500">{shortDate(e.occurred_on)}{e.minutes ? ` · ${formatMinutes(e.minutes)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={card}>
              <div className={cardHead}><h2 className={cardTitle}>Library</h2><Link href={`${base}?tab=library`} className={headLink}>Library</Link></div>
              {libItems.length === 0 ? (
                <p className={emptyText}>Nothing in the library yet. Keep the project&rsquo;s papers, data, code links and figures in one place.</p>
              ) : (
                <div className="px-5 py-3">
                  <p className="text-xs text-slate-500">{libItems.filter((i) => i.source === "file" && i.is_current !== false).length} files · {libItems.filter((i) => i.source === "link").length} links{pinnedItems.length ? " · pinned:" : ""}</p>
                  {pinnedItems.length > 0 && (
                    <ul className="mt-1">
                      {pinnedItems.map((i) => (
                        <li key={i.id} className="border-b border-slate-100 py-2 last:border-0">
                          <Link href={`${base}?tab=library`} className="flex items-center gap-2 text-sm text-slate-900 hover:text-blue-700"><span aria-hidden className="text-blue-600">★</span><span className="truncate">{i.title}</span></Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className={card}>
              <div className={cardHead}><h2 className={cardTitle}>Team</h2><Link href={`${base}?tab=team`} className={headLink}>This week</Link></div>
              {memberCount === 0 ? <p className={emptyText}>Solo project. Add collaborators on the Team tab to assign them work.</p> : (
                <ul className="flex flex-wrap gap-3 px-5 py-3">
                  {(members ?? []).map((m) => {
                    const p = personById.get(m.person_id);
                    if (!p) return null;
                    return (
                      <li key={p.id}>
                        <Link href={`/people/${p.id}`} className="flex items-center gap-2 rounded-md py-1 pr-2 text-sm text-slate-900 hover:bg-slate-50">
                          <Avatar name={p.name} color={p.color} size={28} />
                          <span><span className="block font-medium leading-tight">{p.name}</span>{m.role && <span className="block text-xs text-slate-500">{m.role}</span>}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <details className={`${card} group`}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 [&::-webkit-details-marker]:hidden">
              <span className={cardTitle}>Project details<span className="ml-1 text-[13px] font-normal text-slate-500">· title, question, dates, venue</span></span>
              <span aria-hidden className="text-slate-400 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="border-t border-slate-100 px-5 py-4"><ProjectEditForm p={project} /></div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-white px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Delete this project</p>
              <p className="text-xs text-slate-500">Removes everything in it. This cannot be undone.</p>
            </div>
            <DeleteProjectButton id={id} title={project.title} counts={`its ${(milestones ?? []).length} milestones, ${expRows.length} experiments, ${secRows.length} writing sections, ${tasks.length} tasks, ${(entries ?? []).length} journal entries, ${(papers ?? []).length} papers and ${(meetings ?? []).length} meetings`} />
          </div>
        </div>
      )}

      {tab === "plan" && (
        <div className="flex flex-col gap-4">
          <section className={card}>
            <div className={cardHead}>
              <h2 className={cardTitle}>Milestones{(milestones ?? []).length > 0 && <span className="ml-1 font-normal text-slate-500">· {doneMs} of {(milestones ?? []).length} done</span>}</h2>
            </div>
            <div className="flex flex-col gap-2 px-5 py-3">
              {(milestones ?? []).length === 0 && <p className="text-[13px] text-slate-500">No milestones yet. Break the project into stages you can finish one at a time.</p>}
              <ol className="flex flex-col">
                {(milestones ?? []).map((m, i) => {
                  const mt = tasks.filter((t) => t.research_milestone_id === m.id && t.status !== "cancelled");
                  const mtDone = mt.filter((t) => t.status === "done").length;
                  const late = m.status !== "done" && m.target_date && m.target_date < today;
                  return (
                    <li key={m.id} className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
                      <span aria-hidden className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${m.status === "done" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"}`}>{m.status === "done" ? "✓" : i + 1}</span>
                      <Link href={`/research/${m.id}`} className="min-w-0 flex-1 hover:text-blue-700">
                        <span className={`block font-semibold ${m.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{m.title}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {m.target_date ? `${shortDate(m.target_date)} · ${relative(daysBetween(today, m.target_date))}` : "No date"}
                          {mt.length ? ` · ${mtDone}/${mt.length} tasks` : ""}
                          {late && <span className="font-medium text-red-700"> · late</span>}
                        </span>
                        {mt.length > 0 && (
                          <span className="mt-1.5 block h-1 w-40 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.round((mtDone / mt.length) * 100)}%` }} /></span>
                        )}
                      </Link>
                      <MilestoneStatusSelect id={m.id} value={m.status} />
                    </li>
                  );
                })}
              </ol>
              <AddMilestoneForm projectId={id} />
            </div>
          </section>

          <section className={card}>
            <div className={cardHead}>
              <h2 className={cardTitle}>Tasks{tasks.length > 0 && <span className="ml-1 font-normal text-slate-500">· {openTasks.length} open</span>}</h2>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              <AddTaskForm projectId={id} milestones={msOpts} people={assignable} teamSize={memberIds.size} />
              {tasks.length === 0 ? <p className="text-[13px] text-slate-500">No tasks yet. Add the smallest concrete steps here and give each an owner and a date.</p> : (
                <ul className="-mx-2 flex flex-col">
                  {[...openTasks.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")), ...tasks.filter((t) => t.status === "done")].map((t) => {
                    const late = t.due_date && t.due_date < today && t.status !== "done";
                    return (
                      <li key={t.id}>
                        <Link href={`/tasks/${t.id}`} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-slate-50">
                          <span className="min-w-0">
                            <span className={`block truncate text-sm ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</span>
                            <span className="block truncate text-xs text-slate-500">{[t.people?.name ?? "Unassigned", t.research_milestone_id ? msById.get(t.research_milestone_id)?.title : null].filter(Boolean).join(" · ")}</span>
                          </span>
                          <span className="flex flex-shrink-0 flex-col items-end gap-0.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${TASK_BADGE[t.status] ?? TASK_BADGE.todo}`}>{t.status.replace(/_/g, " ")}</span>
                            {t.due_date && <span className={`text-xs ${late ? "font-medium text-red-700" : "text-slate-500"}`}>due {shortDate(t.due_date)}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "journal" && (() => {
        const kind = ENTRY_KINDS.some((k) => k.key === sp.kind) ? sp.kind : null;
        const shown = (entries ?? []).filter((e) => !kind || e.kind === kind);
        const byKind = new Map<string, number>();
        weekEntries.forEach((e) => byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + (e.minutes ?? 0)));
        const groups: Array<{ date: string; rows: typeof shown }> = [];
        shown.forEach((e) => { const g = groups[groups.length - 1]; if (g && g.date === e.occurred_on) g.rows.push(e); else groups.push({ date: e.occurred_on, rows: [e] }); });
        const usedKinds = Array.from(new Set((entries ?? []).map((e) => e.kind)));
        const chip = (on: boolean) => `h-8 inline-flex items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`;
        return (
          <div className="flex flex-col gap-4">
            <EntryForm projectId={id} people={assignable} milestones={msOpts} teamSize={memberIds.size} />
            {weekMinutes > 0 && (
              <p className="text-[13px] text-slate-600">
                Last 7 days: <span className="font-semibold text-slate-900">{formatMinutes(weekMinutes)}</span> · {Array.from(byKind.entries()).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]).map(([k, m]) => `${kindLabel(k)} ${formatMinutes(m)}`).join(" · ")}
              </p>
            )}
            {usedKinds.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by kind">
                <Link href={`${base}?tab=journal`} scroll={false} aria-current={!kind ? "page" : undefined} className={chip(!kind)}>All {(entries ?? []).length}</Link>
                {usedKinds.map((k) => <Link key={k} href={`${base}?tab=journal&kind=${k}`} scroll={false} aria-current={kind === k ? "page" : undefined} className={chip(kind === k)}>{kindLabel(k)}</Link>)}
              </div>
            )}
            {groups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-[13px] text-slate-500">Nothing logged yet. Log the small things too: a failed run, a paper skimmed, a decision made. They add up to your methods section.</div>
            ) : groups.map((g) => (
              <section key={g.date} className={card}>
                <h3 className="flex items-center justify-between border-b border-slate-200 px-5 py-2.5 text-[13px] font-semibold text-slate-900">
                  {longDate(g.date)}
                  <span className="text-xs font-normal text-slate-500">{formatMinutes(g.rows.reduce((n, r) => n + (r.minutes ?? 0), 0))}</span>
                </h3>
                <ul className="px-5">{g.rows.map((e) => <EntryRow key={e.id} projectId={id} e={{ id: e.id, kind: e.kind, title: e.title, bodyHtml: e.body ? renderRich(e.body) : null, minutes: e.minutes, personName: e.person_id ? personById.get(e.person_id)?.name : undefined, milestoneTitle: e.milestone_id ? msById.get(e.milestone_id)?.title : undefined }} />)}</ul>
              </section>
            ))}
          </div>
        );
      })()}

      {tab === "experiments" && <ExperimentsBoard projectId={id} experiments={expRows} people={peopleOpts} milestones={msOpts} />}

      {tab === "writing" && (
        <WritingBoard projectId={id} sections={secRows} people={peopleOpts} venue={project.venue} deadlineText={project.venue_deadline ? `${project.venue_deadline} (${relative(daysBetween(today, project.venue_deadline))})` : null} />
      )}

      {tab === "library" && <ProjectLibrary projectId={id} userId={user.id} items={libItems} />}

      {tab === "reading" && (
        <div className="flex flex-col gap-4">
          <PaperForm projectId={id} />
          {(papers ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">Your reading list is empty</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Add the papers this project builds on, then write one line on what each one gives you.</p>
            </div>
          ) : (
            <>
              {[...PAPER_STATUS].sort((a, b) => ["reading", "to_read", "cite", "read"].indexOf(a.key) - ["reading", "to_read", "cite", "read"].indexOf(b.key)).map((s) => {
                const rows = (papers ?? []).filter((p) => p.status === s.key);
                if (rows.length === 0) return null;
                return (
                  <section key={s.key} className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
                      <h2 className="text-[15px] font-semibold text-slate-900">{s.label}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">{rows.length}</span>
                    </div>
                    <ul className="px-5">{rows.map((p) => <PaperRow key={p.id} projectId={id} p={p} />)}</ul>
                  </section>
                );
              })}
              <p className="text-xs text-slate-500">
                Citation keys and BibTeX for every project are on the <Link href="/research/reading" className="font-medium text-blue-600 hover:text-blue-700">reading list</Link>.
              </p>
            </>
          )}
        </div>
      )}

      {tab === "meetings" && (
        <div className="flex flex-col gap-4">
          <MeetingForm projectId={id} people={peopleOpts} />
          {(meetings ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No meetings yet</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Add each meeting with its agenda before, and notes and decisions after.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">{(meetings ?? []).map((m, i) => <MeetingCard key={m.id} projectId={id} people={assignable} teamSize={memberIds.size} defaultOpen={i === 0} m={{ id: m.id, title: m.title, held_on: m.held_on, agenda: m.agenda, notes: m.notes, decisions: m.decisions, attendees: (m.attendee_ids as string[]).map((pid) => personById.get(pid)?.name).filter(Boolean) as string[] }} />)}</ul>
          )}
        </div>
      )}

      {tab === "team" && (
        <div className="flex flex-col gap-4">
          {teamWeek && (
            <TeamWeek projectId={id} people={teamWeek.people} unattributedMinutes={teamWeek.unattributedMinutes} unattributedEntries={teamWeek.unattributedEntries}
              offset={weekOffset} label={`${shortDate(monday)} – ${shortDate(weekEnd)}`} isPast={weekEnd < today} />
          )}
          <section className={card}>
            <div className={cardHead}><h2 className={cardTitle}>Members{memberCount > 0 && <span className="ml-1 font-normal text-slate-500">· {memberCount}</span>}</h2></div>
            <div className="flex flex-col gap-3 px-5 py-3">
              {memberCount === 0 ? <p className="text-[13px] text-slate-500">This is a solo project. Add collaborators, advisors or annotators to assign them tasks and track their work.</p> : (
                <ul className="flex flex-col">
                  {(members ?? []).map((m) => {
                    const p = personById.get(m.person_id);
                    if (!p) return null;
                    const mine = openTasks.filter((t) => t.assignee_id === p.id).length;
                    const mins = (entries ?? []).filter((e) => e.person_id === p.id).reduce((n, e) => n + (e.minutes ?? 0), 0);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
                        <Avatar name={p.name} color={p.color} size={32} />
                        <Link href={`/people/${p.id}`} className="min-w-0 flex-1 hover:text-blue-700">
                          <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                          <span className="block truncate text-xs text-slate-500">{[m.role, `${mine} open task${mine === 1 ? "" : "s"}`, mins ? `${formatMinutes(mins)} logged` : null].filter(Boolean).join(" · ")}</span>
                        </Link>
                        <RemoveMemberButton projectId={id} personId={p.id} name={p.name} />
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-medium text-slate-600">Add someone</p>
                <AddMemberForm projectId={id} candidates={peopleOpts.filter((p) => !memberIds.has(p.id))} totalPeople={peopleOpts.length} />
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
