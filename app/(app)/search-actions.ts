"use server";
import { createClient } from "@/lib/supabase/server";

export async function globalSearch(query: string) {
  if (!query.trim()) return { schools: [], tasks: [], people: [], milestones: [] };
  const supabase = await createClient();
  const like = `%${query}%`;
  const [schools, tasks, people, milestones] = await Promise.all([
    supabase.from("schools").select("id, name").ilike("name", like).limit(6),
    supabase.from("tasks").select("id, title").ilike("title", like).limit(6),
    supabase.from("people").select("id, name").ilike("name", like).limit(6),
    supabase.from("research_milestones").select("id, title").ilike("title", like).limit(6),
  ]);
  return {
    schools: (schools.data ?? []).map((s) => ({ id: s.id, label: s.name, href: `/schools/${s.id}` })),
    tasks: (tasks.data ?? []).map((t) => ({ id: t.id, label: t.title, href: `/tasks/${t.id}` })),
    people: (people.data ?? []).map((p) => ({ id: p.id, label: p.name, href: `/people` })),
    milestones: (milestones.data ?? []).map((m) => ({ id: m.id, label: m.title, href: `/research/${m.id}` })),
  };
}
