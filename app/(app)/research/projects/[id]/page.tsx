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
import { Fold, Meta, Section } from "@/components/ui";
import { ENTRY_KINDS, PAPER_STATUS, daysBetween, formatMinutes, kindLabel, localDate, projectStatusLabel, relative } from "@/lib/research";

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

const TASK_TONE: Record<string, string> = { todo: "text-gray-500", in_progress: "text-brass", blocked: "text-red-600", done: "text-teal-600", cancelled: "text-gray-400" };
const longDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; kind?: string; w?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";
  const supabase = await createClient();
  const today = localDate(new Date());
  const weekAgo = localDate(new Date(Date.now() - 6 * 86400000));

  const [{ data: { user } }, { data: project }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("research_projects").select("*").eq("id", id).single(),
  ]);
  if (user?.id !== OWNER_USER_ID) return <main className="p-4 md:p-8 max-w-xl mx-auto text-sm text-gray-500">Research projects are only available to the workspace owner.</main>;
  if (!project) return <main className="p-4 md:p-8">Project not found. <Link href="/research" className="underline">Back to research</Link></main>;

  const { data: milestones } = await supabase.from("research_milestones").select("*").eq("project_id", id).order("target_date", { ascending: true, nullsFirst: false });
  const msIds = (milestones ?? []).map((m) => m.id);
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
  const expRows = (experiments ?? []) as ExperimentRow[];
  const secRows = (sections ?? []) as SectionRow[];
  const wordsTotal = secRows.reduce((n, x) => n + x.words, 0);
  const wordsTarget = secRows.reduce((n, x) => n + (x.target_words ?? 0), 0);
  const weekOffset = Math.max(-12, Math.min(4, Number(sp.w) || 0));
  const monday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7); return localDate(d); })();
  const weekEnd = addDays(monday, 6);
  const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const teamWeek = tab === "team" ? await loadTeamWeek(supabase, id, monday, today) : null;
  const pinnedItems = libItems.filter((i) => i.pinned).slice(0, 4);

  return (
    <main className={`p-4 md:p-8 ${tab === "library" ? "max-w-7xl" : "max-w-3xl"} mx-auto flex flex-col gap-8`}>
      <div className="flex flex-col gap-4">
        <Link href="/research" className="text-xs text-gray-500 hover:text-cream self-start">← All projects</Link>
        <div>
          <h1 className="text-4xl leading-tight">{project.title}</h1>
          <div className="mt-1"><Meta items={[projectStatusLabel(project.status), project.venue && `${project.venue}${project.venue_deadline ? ` · due ${relative(daysBetween(today, project.venue_deadline))}` : ""}`, (members ?? []).length ? `${(members ?? []).length} on the team` : "solo project"]} /></div>
          {project.question && <p className="text-gray-500 mt-2 max-w-2xl">{project.question}</p>}
        </div>
        <nav className="flex gap-x-5 gap-y-1 flex-wrap border-b border-line" aria-label="Project sections">
          {TABS.map((t) => (
            <Link key={t.key} href={t.key === "overview" ? base : `${base}?tab=${t.key}`} className={`pb-2 text-sm border-b-2 -mb-px ${tab === t.key ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}>{t.label}</Link>
          ))}
        </nav>
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-8">
          <p className="text-sm text-gray-500">
            <span className="font-mono text-cream">{doneMs}</span> of <span className="font-mono text-cream">{(milestones ?? []).length}</span> milestones done ·{" "}
            <span className="font-mono text-cream">{openTasks.length}</span> open tasks ·{" "}
            <span className="font-mono text-cream">{weekMinutes ? formatMinutes(weekMinutes) : "0m"}</span> logged this week ·{" "}
            <span className="font-mono text-cream">{toRead}</span> papers to read
            {expRows.length > 0 && <> · <span className="font-mono text-cream">{expRows.length}</span> experiments{expRows.filter((x) => x.status === "running").length ? ` (${expRows.filter((x) => x.status === "running").length} running)` : ""}</>}
            {secRows.length > 0 && <> · <span className="font-mono text-cream">{wordsTotal.toLocaleString()}</span>{wordsTarget ? ` of ${wordsTarget.toLocaleString()}` : ""} words written</>}
          </p>

          <Section title="Next milestones" action={<Link href={`${base}?tab=plan`} className="text-xs text-gray-500 hover:text-cream">Open plan →</Link>}>
            {nextMs.length === 0 ? <p className="text-sm text-gray-500">Nothing pending. Add milestones in the Plan tab.</p> : (
              <ul className="flex flex-col">
                {nextMs.map((m) => (
                  <li key={m.id} className="border-b border-line/60 last:border-0">
                    <Link href={`/research/${m.id}`} className="flex items-baseline justify-between gap-4 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                      <span className="truncate">{m.title}</span>
                      <span className={`text-sm whitespace-nowrap ${m.target_date && m.target_date < today ? "text-red-600" : "text-gray-500"}`}>{m.target_date ? relative(daysBetween(today, m.target_date)) : "no date"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent work" action={<Link href={`${base}?tab=journal`} className="text-xs text-gray-500 hover:text-cream">Open journal →</Link>}>
            {(entries ?? []).length === 0 ? <p className="text-sm text-gray-500">Nothing logged yet. Every experiment, reading session, meeting and decision belongs in the journal.</p> : (
              <ul className="flex flex-col">
                {(entries ?? []).slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3 py-2 border-b border-line/60 last:border-0 text-sm">
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">{kindLabel(e.kind)}</span>
                    <span className="flex-1 min-w-0 truncate">{e.title}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{e.occurred_on.slice(5)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Library" action={<Link href={`${base}?tab=library`} className="text-xs text-gray-500 hover:text-cream">Open library →</Link>}>
            {libItems.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing in the library yet. Keep the project&rsquo;s papers, data, code links and figures in one place.</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">{libItems.filter((i) => i.source === "file" && i.is_current !== false).length} files · {libItems.filter((i) => i.source === "link").length} links{pinnedItems.length ? " · pinned:" : ""}</p>
                {pinnedItems.length > 0 && (
                  <ul className="flex flex-col">
                    {pinnedItems.map((i) => <li key={i.id} className="py-1.5 border-b border-line/60 last:border-0 text-sm"><Link href={`${base}?tab=library`} className="hover:text-brass">★ {i.title}</Link></li>)}
                  </ul>
                )}
              </>
            )}
          </Section>

          <Fold title="Project details" summary="title, question, dates, venue">
            <ProjectEditForm p={project} />
          </Fold>

          <div><DeleteProjectButton id={id} title={project.title} counts={`its ${(milestones ?? []).length} milestones, ${expRows.length} experiments, ${secRows.length} writing sections, ${tasks.length} tasks, ${(entries ?? []).length} journal entries, ${(papers ?? []).length} papers and ${(meetings ?? []).length} meetings`} /></div>
        </div>
      )}

      {tab === "plan" && (
        <div className="flex flex-col gap-8">
          <Section title="Milestones" hint={(milestones ?? []).length ? `${doneMs} of ${(milestones ?? []).length} done` : undefined}>
            {(milestones ?? []).length === 0 && <p className="text-sm text-gray-500">No milestones yet. Break the project into stages you can finish one at a time.</p>}
            <ul className="flex flex-col">
              {(milestones ?? []).map((m) => {
                const mt = tasks.filter((t) => t.research_milestone_id === m.id && t.status !== "cancelled");
                const late = m.status !== "done" && m.target_date && m.target_date < today;
                return (
                  <li key={m.id} className="border-b border-line/60 last:border-0 py-3 flex items-start justify-between gap-4">
                    <Link href={`/research/${m.id}`} className="min-w-0 flex-1 hover:text-brass">
                      <span className={`block font-medium ${m.status === "done" ? "line-through text-gray-500" : ""}`}>{m.title}</span>
                      <span className="block text-sm text-gray-500 truncate">
                        {[m.target_date ? `${m.target_date.slice(5)} · ${relative(daysBetween(today, m.target_date))}` : "no date", mt.length ? `${mt.filter((t) => t.status === "done").length}/${mt.length} tasks` : null].filter(Boolean).join(" · ")}
                        {late && <span className="text-red-600"> · late</span>}
                      </span>
                    </Link>
                    <MilestoneStatusSelect id={m.id} value={m.status} />
                  </li>
                );
              })}
            </ul>
            <AddMilestoneForm projectId={id} />
          </Section>

          <Section title="Tasks" hint={tasks.length ? `${openTasks.length} open` : undefined}>
            <AddTaskForm projectId={id} milestones={msOpts} people={assignable} teamSize={memberIds.size} />
            {tasks.length === 0 ? <p className="text-sm text-gray-500">No tasks yet. Add the smallest concrete steps here and give each an owner and a date.</p> : (
              <ul className="flex flex-col">
                {[...openTasks.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")), ...tasks.filter((t) => t.status === "done")].map((t) => {
                  const late = t.due_date && t.due_date < today && t.status !== "done";
                  return (
                    <li key={t.id} className="border-b border-line/60 last:border-0">
                      <Link href={`/tasks/${t.id}`} className="flex items-baseline justify-between gap-4 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-surface-raised">
                        <span className="min-w-0">
                          <span className={`block truncate ${t.status === "done" ? "line-through text-gray-500" : ""}`}>{t.title}</span>
                          <span className="block text-xs text-gray-500 truncate">{[t.people?.name ?? "Unassigned", t.research_milestone_id ? msById.get(t.research_milestone_id)?.title : null].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="text-right whitespace-nowrap">
                          <span className={`block text-xs ${TASK_TONE[t.status]}`}>{t.status.replace("_", " ")}</span>
                          {t.due_date && <span className={`block text-xs ${late ? "text-red-600" : "text-gray-400"}`}>due {t.due_date.slice(5)}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
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
        return (
          <div className="flex flex-col gap-6">
            <EntryForm projectId={id} people={assignable} milestones={msOpts} teamSize={memberIds.size} />
            {weekMinutes > 0 && (
              <p className="text-sm text-gray-500">Last 7 days: <span className="font-mono text-cream">{formatMinutes(weekMinutes)}</span> · {Array.from(byKind.entries()).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]).map(([k, m]) => `${kindLabel(k)} ${formatMinutes(m)}`).join(" · ")}</p>
            )}
            {usedKinds.length > 1 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line text-sm -mb-2">
                <Link href={`${base}?tab=journal`} className={`pb-2 border-b-2 -mb-px ${!kind ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}>All {(entries ?? []).length}</Link>
                {usedKinds.map((k) => <Link key={k} href={`${base}?tab=journal&kind=${k}`} className={`pb-2 border-b-2 -mb-px ${kind === k ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}>{kindLabel(k)}</Link>)}
              </div>
            )}
            {groups.length === 0 ? <p className="text-sm text-gray-500">Nothing logged yet. Log the small things too: a failed run, a paper skimmed, a decision made. They add up to your methods section.</p> : groups.map((g) => (
              <section key={g.date} className="flex flex-col">
                <h3 className="font-sans text-sm font-semibold text-gray-500 border-b border-line pb-1">{longDate(g.date)} <span className="font-normal text-gray-400">{formatMinutes(g.rows.reduce((n, r) => n + (r.minutes ?? 0), 0))}</span></h3>
                <ul>{g.rows.map((e) => <EntryRow key={e.id} projectId={id} e={{ id: e.id, kind: e.kind, title: e.title, bodyHtml: e.body ? renderRich(e.body) : null, minutes: e.minutes, personName: e.person_id ? personById.get(e.person_id)?.name : undefined, milestoneTitle: e.milestone_id ? msById.get(e.milestone_id)?.title : undefined }} />)}</ul>
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
        <div className="flex flex-col gap-6">
          <PaperForm projectId={id} />
          {(papers ?? []).length === 0 ? <p className="text-sm text-gray-500">Your reading list is empty. Add the papers this project builds on, then write one line on what each one gives you.</p> : (
            [...PAPER_STATUS].sort((a, b) => ["reading", "to_read", "cite", "read"].indexOf(a.key) - ["reading", "to_read", "cite", "read"].indexOf(b.key)).map((s) => {
              const rows = (papers ?? []).filter((p) => p.status === s.key);
              if (rows.length === 0) return null;
              return (
                <section key={s.key} className="flex flex-col">
                  <h2 className="font-sans text-[15px] font-semibold border-b border-line pb-2">{s.label} <span className="font-mono text-xs text-gray-500 font-normal">{rows.length}</span></h2>
                  <ul>{rows.map((p) => <PaperRow key={p.id} projectId={id} p={p} />)}</ul>
                </section>
              );
            })
          )}
        </div>
      )}

      {tab === "meetings" && (
        <div className="flex flex-col gap-6">
          <MeetingForm projectId={id} people={peopleOpts} />
          {(meetings ?? []).length === 0 ? <p className="text-sm text-gray-500">No meetings yet. Add each meeting with its agenda before, and notes and decisions after.</p> : (
            <ul>{(meetings ?? []).map((m, i) => <MeetingCard key={m.id} projectId={id} people={assignable} teamSize={memberIds.size} defaultOpen={i === 0} m={{ id: m.id, title: m.title, held_on: m.held_on, agenda: m.agenda, notes: m.notes, decisions: m.decisions, attendees: (m.attendee_ids as string[]).map((pid) => personById.get(pid)?.name).filter(Boolean) as string[] }} />)}</ul>
          )}
        </div>
      )}

      {tab === "team" && (
        <div className="flex flex-col gap-8">
          {teamWeek && (
            <TeamWeek projectId={id} people={teamWeek.people} unattributedMinutes={teamWeek.unattributedMinutes} unattributedEntries={teamWeek.unattributedEntries}
              offset={weekOffset} label={`${shortDay(monday)} to ${shortDay(weekEnd)}`} isPast={weekEnd < today} />
          )}
          <h2 className="font-sans text-[15px] font-semibold text-cream border-b border-line pb-2 -mb-4">Members</h2>
          {(members ?? []).length === 0 ? <p className="text-sm text-gray-500">This is a solo project. Add collaborators, advisors or annotators to assign them tasks and track their work.</p> : (
            <ul className="flex flex-col">
              {(members ?? []).map((m) => {
                const p = personById.get(m.person_id);
                if (!p) return null;
                const mine = openTasks.filter((t) => t.assignee_id === p.id).length;
                const mins = (entries ?? []).filter((e) => e.person_id === p.id).reduce((n, e) => n + (e.minutes ?? 0), 0);
                return (
                  <li key={p.id} className="flex items-center gap-4 py-3 border-b border-line/60 last:border-0">
                    <Avatar name={p.name} color={p.color} size={36} />
                    <Link href={`/people/${p.id}`} className="min-w-0 flex-1 hover:text-brass">
                      <span className="block font-medium truncate">{p.name}</span>
                      <span className="block text-xs text-gray-500 truncate">{[m.role, `${mine} open task${mine === 1 ? "" : "s"}`, mins ? `${formatMinutes(mins)} logged` : null].filter(Boolean).join(" · ")}</span>
                    </Link>
                    <RemoveMemberButton projectId={id} personId={p.id} name={p.name} />
                  </li>
                );
              })}
            </ul>
          )}
          <Section title="Add someone">
            <AddMemberForm projectId={id} candidates={peopleOpts.filter((p) => !memberIds.has(p.id))} totalPeople={peopleOpts.length} />
          </Section>
        </div>
      )}
    </main>
  );
}
