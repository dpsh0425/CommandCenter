"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type InterviewStatus = "not_scheduled" | "scheduled" | "completed";

export async function scheduleInterview(schoolId: string, scheduledAt: string, prepNotes?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("interviews").insert({
    owner_id: user.id, school_id: schoolId, scheduled_at: scheduledAt, prep_notes: prepNotes, status: "scheduled",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}

export async function updateInterview(id: string, schoolId: string, fields: { status?: InterviewStatus; outcomeNotes?: string | null }) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.outcomeNotes !== undefined) patch.outcome_notes = fields.outcomeNotes;
  const { error } = await supabase.from("interviews").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}

export async function deleteInterview(id: string, schoolId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}

export async function updateVisaStep(id: string, schoolId: string, status: "not_started" | "in_progress" | "done") {
  const supabase = await createClient();
  const { error } = await supabase.from("visa_steps").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}
