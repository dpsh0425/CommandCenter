import type { SupabaseClient } from "@supabase/supabase-js";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };

export type PersonWeek = {
  id: string | null; name: string; color: string; role: string | null; onTeam: boolean;
  minutes: number; entryCount: number; byKind: Array<{ kind: string; minutes: number }>; recent: string[];
  experiments: Array<{ name: string; note: string }>;
  tasksDone: string[]; tasksOpen: number; tasksOverdue: number; tasksDueThisWeek: number;
  sectionsEdited: string[]; sectionsOwned: number; meetings: string[];
};

// What each person did on one project during the week starting `start` (a Monday, YYYY-MM-DD).
export async function loadTeamWeek(supabase: SupabaseClient, projectId: string, start: string, today: string): Promise<{ people: PersonWeek[]; unattributedMinutes: number; unattributedEntries: number }> {
  const end = addDays(start, 6);
  const startIso = new Date(start + "T00:00:00").toISOString();
  const endIso = new Date(addDays(end, 1) + "T00:00:00").toISOString();
  const inWeekTs = (iso: string) => iso >= startIso && iso < endIso;

  const { data: ms } = await supabase.from("research_milestones").select("id").eq("project_id", projectId);
  const msIds = (ms ?? []).map((m: any) => m.id);

  const [{ data: members }, { data: people }, { data: entries }, { data: experiments }, { data: tasksA }, { data: tasksB }, { data: sections }, { data: meetings }] = await Promise.all([
    supabase.from("research_project_members").select("person_id, role").eq("project_id", projectId),
    supabase.from("people").select("id, name, color, role"),
    supabase.from("research_entries").select("kind, title, minutes, person_id").eq("project_id", projectId).gte("occurred_on", start).lte("occurred_on", end),
    supabase.from("research_experiments").select("name, status, outcome, person_id, run_on, updated_at").eq("project_id", projectId),
    supabase.from("tasks").select("title, status, due_date, assignee_id, updated_at").eq("project_id", projectId),
    msIds.length ? supabase.from("tasks").select("title, status, due_date, assignee_id, updated_at").in("research_milestone_id", msIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from("research_sections").select("name, status, person_id, updated_at").eq("project_id", projectId),
    supabase.from("research_meetings").select("title, attendee_ids").eq("project_id", projectId).gte("held_on", start).lte("held_on", end),
  ]);

  const tasks = [...((tasksA ?? []) as any[]), ...((tasksB ?? []) as any[])];
  const memberIds = new Set((members ?? []).map((m: any) => m.person_id));
  const roleOf = new Map((members ?? []).map((m: any) => [m.person_id, m.role as string | null]));
  const active = new Set<string>();
  [...((entries ?? []) as any[]), ...((experiments ?? []) as any[]), ...tasks, ...((sections ?? []) as any[])].forEach((r) => { const pid = r.person_id ?? r.assignee_id; if (pid) active.add(pid); });

  const ids = Array.from(new Set(Array.from(memberIds).concat(Array.from(active))));
  const info = new Map((people ?? []).map((p: any) => [p.id, p]));

  const result: PersonWeek[] = ids.filter((id) => info.has(id)).map((id) => {
    const p: any = info.get(id);
    const es = ((entries ?? []) as any[]).filter((e) => e.person_id === id);
    const kinds = new Map<string, number>();
    es.forEach((e) => kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + (e.minutes ?? 0)));
    const mine = tasks.filter((t) => t.assignee_id === id);
    const open = mine.filter((t) => t.status !== "done" && t.status !== "cancelled");
    return {
      id, name: p.name, color: p.color, role: roleOf.get(id) ?? p.role ?? null, onTeam: memberIds.has(id),
      minutes: es.reduce((n, e) => n + (e.minutes ?? 0), 0), entryCount: es.length,
      byKind: Array.from(kinds.entries()).map(([kind, minutes]) => ({ kind, minutes })).filter((k) => k.minutes > 0).sort((a, b) => b.minutes - a.minutes),
      recent: es.slice(0, 3).map((e) => e.title),
      experiments: ((experiments ?? []) as any[]).filter((x) => x.person_id === id && (((x.status === "done" || x.status === "failed") && inWeekTs(x.updated_at)) || (x.run_on && x.run_on >= start && x.run_on <= end)))
        .map((x) => ({ name: x.name, note: x.status === "failed" ? "failed" : x.status === "done" ? (x.outcome ?? "done") : x.status })),
      tasksDone: mine.filter((t) => t.status === "done" && inWeekTs(t.updated_at)).map((t) => t.title),
      tasksOpen: open.length, tasksOverdue: open.filter((t) => t.due_date && t.due_date < today).length,
      tasksDueThisWeek: open.filter((t) => t.due_date && t.due_date >= start && t.due_date <= end).length,
      sectionsEdited: ((sections ?? []) as any[]).filter((s) => s.person_id === id && inWeekTs(s.updated_at)).map((s) => s.name),
      sectionsOwned: ((sections ?? []) as any[]).filter((s) => s.person_id === id && s.status !== "done").length,
      meetings: ((meetings ?? []) as any[]).filter((m) => (m.attendee_ids ?? []).includes(id)).map((m) => m.title),
    };
  }).sort((a, b) => Number(b.onTeam) - Number(a.onTeam) || b.minutes - a.minutes || a.name.localeCompare(b.name));

  const un = ((entries ?? []) as any[]).filter((e) => !e.person_id);
  return { people: result, unattributedMinutes: un.reduce((n, e) => n + (e.minutes ?? 0), 0), unattributedEntries: un.length };
}
