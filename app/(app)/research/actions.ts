"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addMilestone(title: string, description?: string, targetDate?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("research_milestones").insert({
    owner_id: user.id, title, description, target_date: targetDate,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/research");
}
