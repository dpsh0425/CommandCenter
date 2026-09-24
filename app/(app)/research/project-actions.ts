"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ENTRY_KINDS, PAPER_STATUS, PROJECT_STATUS } from "@/lib/research";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can change research projects.");
  return { supabase, userId: user.id };
}

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;
const inList = (list: ReadonlyArray<{ key: string }>, v: string, fallback: string) => (list.some((x) => x.key === v) ? v : fallback);

function refresh(projectId: string) {
  revalidatePath("/research");
  revalidatePath(`/research/projects/${projectId}`);
  revalidatePath("/");
}

export async function createProject(input: { title: string; question?: string; status?: string }) {
  const { supabase, userId } = await owner();
  const title = input.title.trim();
  if (!title) throw new Error("Give the project a title.");
  const { data, error } = await supabase.from("research_projects").insert({
    owner_id: userId, title, question: clean(input.question), status: inList(PROJECT_STATUS, input.status ?? "planning", "planning"),
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the project.");
  revalidatePath("/research");
  return data.id as string;
}

export async function updateProject(id: string, f: {
  title: string; question: string | null; description: string | null; status: string;
  startDate: string | null; targetDate: string | null; venue: string | null; venueDeadline: string | null;
}) {
  const { supabase } = await owner();
  if (!f.title.trim()) throw new Error("The title can't be empty.");
  const { error } = await supabase.from("research_projects").update({
    title: f.title.trim(), question: clean(f.question), description: clean(f.description), status: inList(PROJECT_STATUS, f.status, "active"),
    start_date: f.startDate || null, target_date: f.targetDate || null, venue: clean(f.venue), venue_deadline: f.venueDeadline || null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

export async function deleteProject(id: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/research");
  redirect("/research");
}

// Plan ------------------------------------------------------------------------------------------
export async function addProjectMilestone(projectId: string, title: string, description?: string, targetDate?: string) {
  const { supabase, userId } = await owner();
  if (!title.trim()) throw new Error("Give the milestone a title.");
  const { error } = await supabase.from("research_milestones").insert({
    owner_id: userId, project_id: projectId, title: title.trim(), description: clean(description), target_date: targetDate || null,
  });
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function addProjectTask(projectId: string, f: { title: string; milestoneId?: string | null; assigneeId?: string | null; dueDate?: string | null; priority?: string }) {
  const { supabase, userId } = await owner();
  if (!f.title.trim()) throw new Error("Give the task a title.");
  const { error } = await supabase.from("tasks").insert({
    owner_id: userId, title: f.title.trim(), project_id: projectId, research_milestone_id: f.milestoneId || null,
    assignee_id: f.assigneeId || null, due_date: f.dueDate || null, priority: ["low", "medium", "high"].includes(f.priority ?? "") ? f.priority : "medium",
  });
  if (error) throw new Error(error.message);
  refresh(projectId);
  revalidatePath("/tasks");
  revalidatePath("/today");
}

// Journal ---------------------------------------------------------------------------------------
export async function addEntry(projectId: string, f: { kind: string; title: string; body?: string; occurredOn?: string; minutes?: number | null; personId?: string | null; milestoneId?: string | null }) {
  const { supabase, userId } = await owner();
  if (!f.title.trim()) throw new Error("Write a short title for what you did.");
  const { error } = await supabase.from("research_entries").insert({
    owner_id: userId, project_id: projectId, kind: inList(ENTRY_KINDS, f.kind, "other"), title: f.title.trim(), body: clean(f.body),
    occurred_on: f.occurredOn || undefined, minutes: f.minutes && f.minutes > 0 ? Math.round(f.minutes) : null,
    person_id: f.personId || null, milestone_id: f.milestoneId || null,
  });
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function deleteEntry(id: string, projectId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

// Reading ---------------------------------------------------------------------------------------
export async function addPaper(projectId: string, f: { title: string; url?: string; authors?: string; year?: number | null }) {
  const { supabase, userId } = await owner();
  const title = f.title.trim();
  if (!title) throw new Error("Give the paper a title.");
  const { error } = await supabase.from("research_papers").insert({
    owner_id: userId, project_id: projectId, title, url: clean(f.url), authors: clean(f.authors), year: f.year || null,
  });
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function updatePaper(id: string, projectId: string, f: { status?: string; takeaway?: string | null; notes?: string | null }) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (f.status !== undefined) row.status = inList(PAPER_STATUS, f.status, "to_read");
  if (f.takeaway !== undefined) row.takeaway = clean(f.takeaway);
  if (f.notes !== undefined) row.notes = clean(f.notes);
  const { error } = await supabase.from("research_papers").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function deletePaper(id: string, projectId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_papers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

// Meetings --------------------------------------------------------------------------------------
export async function addMeeting(projectId: string, f: { title: string; heldOn?: string; attendeeIds?: string[]; agenda?: string }) {
  const { supabase, userId } = await owner();
  if (!f.title.trim()) throw new Error("Give the meeting a title.");
  const { error } = await supabase.from("research_meetings").insert({
    owner_id: userId, project_id: projectId, title: f.title.trim(), held_on: f.heldOn || undefined, attendee_ids: f.attendeeIds ?? [], agenda: clean(f.agenda),
  });
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function updateMeeting(id: string, projectId: string, f: { agenda: string | null; notes: string | null; decisions: string | null }) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_meetings").update({ agenda: clean(f.agenda), notes: clean(f.notes), decisions: clean(f.decisions) }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function deleteMeeting(id: string, projectId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_meetings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

// Team ------------------------------------------------------------------------------------------
export async function addMember(projectId: string, personId: string, role?: string) {
  const { supabase, userId } = await owner();
  const { error } = await supabase.from("research_project_members").upsert(
    { project_id: projectId, person_id: personId, owner_id: userId, role: clean(role) }, { onConflict: "project_id,person_id" }
  );
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function removeMember(projectId: string, personId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("research_project_members").delete().eq("project_id", projectId).eq("person_id", personId);
  if (error) throw new Error(error.message);
  refresh(projectId);
}
