"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type MilestoneStatus = "not_started" | "in_progress" | "done" | "blocked";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, user };
}

export async function addMilestone(title: string, description?: string, targetDate?: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("research_milestones").insert({
    owner_id: user.id, title, description, target_date: targetDate,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/research");
}

export async function updateMilestoneStatus(id: string, status: MilestoneStatus) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("research_milestones").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/research");
  revalidatePath(`/research/${id}`);
}

export async function updateMilestone(id: string, fields: { title: string; description: string | null; targetDate: string | null }) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("research_milestones")
    .update({ title: fields.title, description: fields.description, target_date: fields.targetDate })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/research");
  revalidatePath(`/research/${id}`);
}

export async function deleteMilestone(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("research_milestones").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/research");
  redirect("/research");
}
