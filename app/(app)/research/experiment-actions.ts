"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { EXPERIMENT_OUTCOME, EXPERIMENT_STATUS, PAPER_TEMPLATE, SECTION_STATUS, countWords, type Metric } from "@/lib/research";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can change research projects.");
  return { supabase, userId: user.id };
}

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;
const inList = (list: ReadonlyArray<{ key: string }>, v: string | null | undefined, fallback: string | null) => (v && list.some((x) => x.key === v) ? v : fallback);
const refresh = (projectId: string) => { revalidatePath(`/research/projects/${projectId}`); revalidatePath("/research"); };

// Experiments -----------------------------------------------------------------------------------
export async function addExperiment(projectId: string, f: { name: string; hypothesis?: string }) {
  const { supabase, userId } = await owner();
  if (!f.name.trim()) throw new Error("Give the experiment a name.");
  const { data, error } = await supabase.from("research_experiments").insert({ owner_id: userId, project_id: projectId, name: f.name.trim(), hypothesis: clean(f.hypothesis) }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not add the experiment.");
  refresh(projectId);
  return data.id as string;
}

export async function updateExperiment(id: string, projectId: string, f: {
  name?: string; hypothesis?: string | null; status?: string; outcome?: string | null; setup?: string | null; codeRef?: string | null; dataRef?: string | null;
  metrics?: Metric[]; result?: string | null; runOn?: string | null; personId?: string | null; milestoneId?: string | null;
}) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (f.name !== undefined) { if (!f.name.trim()) throw new Error("The name can't be empty."); row.name = f.name.trim(); }
  if (f.hypothesis !== undefined) row.hypothesis = clean(f.hypothesis);
  if (f.status !== undefined) row.status = inList(EXPERIMENT_STATUS, f.status, "planned");
  if (f.outcome !== undefined) row.outcome = inList(EXPERIMENT_OUTCOME, f.outcome, null);
  if (f.setup !== undefined) row.setup = clean(f.setup);
  if (f.codeRef !== undefined) row.code_ref = clean(f.codeRef);
  if (f.dataRef !== undefined) row.data_ref = clean(f.dataRef);
  if (f.metrics !== undefined) row.metrics = f.metrics.map((m) => ({ name: m.name.trim(), value: m.value.trim() })).filter((m) => m.name);
  if (f.result !== undefined) row.result = clean(f.result);
  if (f.runOn !== undefined) row.run_on = f.runOn || null;
  if (f.personId !== undefined) row.person_id = f.personId || null;
  if (f.milestoneId !== undefined) row.milestone_id = f.milestoneId || null;
  const { error } = await supabase.from("research_experiments").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function deleteExperiment(id: string, projectId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_experiments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

// Writing ---------------------------------------------------------------------------------------
export async function addSection(projectId: string, name: string, targetWords?: number | null) {
  const { supabase, userId } = await owner();
  if (!name.trim()) throw new Error("Give the section a name.");
  const { data: last } = await supabase.from("research_sections").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("research_sections").insert({
    owner_id: userId, project_id: projectId, name: name.trim(), target_words: targetWords && targetWords > 0 ? Math.round(targetWords) : null, position: (last?.[0]?.position ?? -1) + 1,
  });
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function addPaperTemplate(projectId: string) {
  const { supabase, userId } = await owner();
  const { data: existing } = await supabase.from("research_sections").select("name, position").eq("project_id", projectId);
  const have = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
  let pos = Math.max(-1, ...(existing ?? []).map((s) => s.position)) + 1;
  const rows = PAPER_TEMPLATE.filter((t) => !have.has(t.name.toLowerCase())).map((t) => ({ owner_id: userId, project_id: projectId, name: t.name, target_words: t.words, position: pos++ }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("research_sections").insert(rows);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function updateSection(id: string, projectId: string, f: { name?: string; status?: string; targetWords?: number | null; notes?: string | null; dueDate?: string | null; personId?: string | null }) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (f.name !== undefined) { if (!f.name.trim()) throw new Error("The name can't be empty."); row.name = f.name.trim(); }
  if (f.status !== undefined) row.status = inList(SECTION_STATUS, f.status, "not_started");
  if (f.targetWords !== undefined) row.target_words = f.targetWords && f.targetWords > 0 ? Math.round(f.targetWords) : null;
  if (f.notes !== undefined) row.notes = clean(f.notes);
  if (f.dueDate !== undefined) row.due_date = f.dueDate || null;
  if (f.personId !== undefined) row.person_id = f.personId || null;
  const { error } = await supabase.from("research_sections").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

// Called on every autosave, so it deliberately does not revalidate the page.
export async function saveSectionDraft(id: string, body: string) {
  const { supabase } = await owner();
  const words = countWords(body);
  const { error } = await supabase.from("research_sections").update({ body, words }).eq("id", id);
  if (error) throw new Error(error.message);
  return words;
}

export async function moveSection(id: string, projectId: string, dir: -1 | 1) {
  const { supabase } = await owner();
  const { data: all } = await supabase.from("research_sections").select("id, position").eq("project_id", projectId).order("position");
  const list = all ?? [];
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  // Renumber so positions stay unique even if earlier rows shared a value.
  const order = list.map((s) => s.id);
  [order[i], order[j]] = [order[j], order[i]];
  for (let k = 0; k < order.length; k++) await supabase.from("research_sections").update({ position: k }).eq("id", order[k]);
  refresh(projectId);
}

export async function deleteSection(id: string, projectId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_sections").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}
