"use server";
import { createClient } from "@/lib/supabase/server";

export type SearchItem = { id: string; label: string; sub?: string; href: string; external?: boolean };
export type SearchResults = {
  schools: SearchItem[]; professors: SearchItem[]; tasks: SearchItem[]; people: SearchItem[]; milestones: SearchItem[]; links: SearchItem[];
};

const EMPTY: SearchResults = { schools: [], professors: [], tasks: [], people: [], milestones: [], links: [] };

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.replace(/[%_,()]/g, " ").trim();
  if (!q) return EMPTY;
  const supabase = await createClient();
  const like = `%${q}%`;
  const [schools, professors, tasks, people, milestones, links] = await Promise.all([
    supabase.from("schools").select("id, name, country").or(`name.ilike.${like},faculty.ilike.${like},city.ilike.${like}`).limit(6),
    supabase.from("professors").select("id, name, school_id, schools(name)").or(`name.ilike.${like},research_summary.ilike.${like},lab_name.ilike.${like}`).limit(6),
    supabase.from("tasks").select("id, title").ilike("title", like).limit(6),
    supabase.from("people").select("id, name, role").ilike("name", like).limit(6),
    supabase.from("research_milestones").select("id, title").ilike("title", like).limit(6),
    supabase.from("links").select("id, title, url, kind").or(`title.ilike.${like},url.ilike.${like},notes.ilike.${like}`).limit(6),
  ]);
  return {
    schools: (schools.data ?? []).map((s) => ({ id: s.id, label: s.name, sub: s.country, href: `/schools/${s.id}` })),
    professors: ((professors.data ?? []) as any[]).map((p) => ({ id: p.id, label: p.name, sub: p.schools?.name, href: `/schools/${p.school_id}?tab=faculty` })),
    tasks: (tasks.data ?? []).map((t) => ({ id: t.id, label: t.title, href: `/tasks/${t.id}` })),
    people: (people.data ?? []).map((p) => ({ id: p.id, label: p.name, sub: p.role ?? undefined, href: `/people/${p.id}` })),
    milestones: (milestones.data ?? []).map((m) => ({ id: m.id, label: m.title, href: `/research/${m.id}` })),
    links: (links.data ?? []).map((l) => ({ id: l.id, label: l.title, sub: l.kind, href: l.url, external: true })),
  };
}
