"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type LetterStatus = "not_asked" | "asked" | "confirmed" | "submitted";

export async function addLetterRequest(schoolId: string, recommenderId: string, letterDeadline?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("letter_requests").insert({
    owner_id: user.id, school_id: schoolId, recommender_id: recommenderId, letter_deadline: letterDeadline,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}

export async function updateLetterStatus(id: string, schoolId: string, status: LetterStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("letter_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}

export async function createSopVersion(label: string, description?: string, externalLink?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data, error } = await supabase.from("sop_versions").insert({
    owner_id: user.id, label, description, external_link: externalLink,
  }).select().single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setSchoolSopVersion(schoolId: string, sopVersionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({
    sop_version_id: sopVersionId, sop_sent_at: new Date().toISOString().slice(0, 10),
  }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}
