import type { SupabaseClient } from "@supabase/supabase-js";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (from: string, to: string) => Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);

export type ProjectWeek = {
  id: string; title: string; status: string;
  minutes: number; prevMinutes: number; entryCount: number; byKind: Array<{ kind: string; minutes: number }>; byPerson: Array<{ name: string; minutes: number }>;
  finished: Array<{ id: string; name: string; status: string; outcome: string | null }>; started: Array<{ id: string; name: string }>; running: number;
  meetings: Array<{ id: string; title: string; held_on: string }>;
  tasksDone: number; papersAdded: number; filesAdded: number; linksAdded: number;
  sectionsEdited: number; words: number; targetWords: number;
  upcoming: Array<{ label: string; date: string; days: number; href: string }>;
};

// One summary per project for the week starting `start` (a Monday, YYYY-MM-DD).
export async function loadResearchWeek(supabase: SupabaseClient, start: string, today: string): Promise<ProjectWeek[]> {
  const end = addDays(start, 6);
  const prevStart = addDays(start, -7);
  const startIso = new Date(start + "T00:00:00").toISOString();
  const endIso = new Date(addDays(end, 1) + "T00:00:00").toISOString();
  const inWeekTs = (iso: string) => iso >= startIso && iso < endIso;
  const inWeekDate = (d: string | null) => !!d && d >= start && d <= end;

  const { data: projects } = await supabase.from("research_projects").select("id, title, status, venue, venue_deadline").order("created_at");
  if (!projects || projects.length === 0) return [];

  const [{ data: entries }, { data: experiments }, { data: meetings }, { data: papers }, { data: docs }, { data: links }, { data: sections }, { data: milestones }, { data: tasks }, { data: people }] = await Promise.all([
    supabase.from("research_entries").select("project_id, kind, minutes, occurred_on, person_id").gte("occurred_on", prevStart).lte("occurred_on", end),
    supabase.from("research_experiments").select("id, project_id, name, status, outcome, run_on, updated_at"),
    supabase.from("research_meetings").select("id, project_id, title, held_on").gte("held_on", start).lte("held_on", end),
    supabase.from("research_papers").select("project_id, created_at").gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("documents").select("project_id, created_at").not("project_id", "is", null).gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("links").select("project_id, created_at").not("project_id", "is", null).gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("research_sections").select("project_id, words, target_words, updated_at"),
    supabase.from("research_milestones").select("id, project_id, title, target_date, status").not("project_id", "is", null).neq("status", "done").not("target_date", "is", null),
    supabase.from("tasks").select("id, project_id, title, status, due_date, updated_at, research_milestone_id, research_milestones(project_id)").or("project_id.not.is.null,research_milestone_id.not.is.null"),
    supabase.from("people").select("id, name"),
  ]);
  const person = new Map((people ?? []).map((p: any) => [p.id, p.name as string]));
  const taskProject = (t: any) => t.project_id ?? t.research_milestones?.project_id ?? null;

  return (projects as any[]).map((p) => {
    const es = ((entries ?? []) as any[]).filter((e) => e.project_id === p.id);
    const cur = es.filter((e) => e.occurred_on >= start && e.occurred_on <= end);
    const prev = es.filter((e) => e.occurred_on < start);
    const sum = (l: any[]) => l.reduce((n, e) => n + (e.minutes ?? 0), 0);
    const kinds = new Map<string, number>(); const people2 = new Map<string, number>();
    cur.forEach((e) => {
      kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + (e.minutes ?? 0));
      if (e.person_id && person.get(e.person_id)) people2.set(person.get(e.person_id)!, (people2.get(person.get(e.person_id)!) ?? 0) + (e.minutes ?? 0));
    });

    const exps = ((experiments ?? []) as any[]).filter((x) => x.project_id === p.id);
    const secs = ((sections ?? []) as any[]).filter((x) => x.project_id === p.id);
    const myTasks = ((tasks ?? []) as any[]).filter((t) => taskProject(t) === p.id);

    const upcoming: ProjectWeek["upcoming"] = [
      ...((milestones ?? []) as any[]).filter((m) => m.project_id === p.id && m.target_date <= addDays(end, 14)).map((m) => ({ label: m.title, date: m.target_date as string, href: `/research/${m.id}` })),
      ...myTasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.due_date && t.due_date <= addDays(end, 7)).map((t) => ({ label: t.title, date: t.due_date as string, href: `/tasks/${t.id}` })),
      ...(p.venue_deadline && p.venue_deadline >= today && daysBetween(today, p.venue_deadline) <= 60 ? [{ label: `${p.venue ?? "Venue"} deadline`, date: p.venue_deadline as string, href: `/research/projects/${p.id}` }] : []),
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map((u) => ({ ...u, days: daysBetween(today, u.date) }));

    return {
      id: p.id, title: p.title, status: p.status,
      minutes: sum(cur), prevMinutes: sum(prev), entryCount: cur.length,
      byKind: Array.from(kinds.entries()).map(([kind, minutes]) => ({ kind, minutes })).filter((k) => k.minutes > 0).sort((a, b) => b.minutes - a.minutes),
      byPerson: Array.from(people2.entries()).map(([name, minutes]) => ({ name, minutes })).filter((k) => k.minutes > 0).sort((a, b) => b.minutes - a.minutes),
      finished: exps.filter((x) => (x.status === "done" || x.status === "failed") && inWeekTs(x.updated_at)).map((x) => ({ id: x.id, name: x.name, status: x.status, outcome: x.outcome })),
      started: exps.filter((x) => inWeekDate(x.run_on) && !((x.status === "done" || x.status === "failed") && inWeekTs(x.updated_at))).map((x) => ({ id: x.id, name: x.name })),
      running: exps.filter((x) => x.status === "running").length,
      meetings: ((meetings ?? []) as any[]).filter((m) => m.project_id === p.id),
      tasksDone: myTasks.filter((t) => t.status === "done" && inWeekTs(t.updated_at)).length,
      papersAdded: ((papers ?? []) as any[]).filter((x) => x.project_id === p.id).length,
      filesAdded: ((docs ?? []) as any[]).filter((x) => x.project_id === p.id).length,
      linksAdded: ((links ?? []) as any[]).filter((x) => x.project_id === p.id).length,
      sectionsEdited: secs.filter((x) => inWeekTs(x.updated_at)).length,
      words: secs.reduce((n, x) => n + x.words, 0), targetWords: secs.reduce((n, x) => n + (x.target_words ?? 0), 0),
      upcoming,
    };
  });
}
