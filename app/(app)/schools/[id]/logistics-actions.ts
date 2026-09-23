"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type LetterStatus = "not_asked" | "asked" | "confirmed" | "submitted";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function refresh(schoolId: string) {
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath("/");
  revalidatePath("/today");
}

export async function addLetterRequest(schoolId: string, recommenderId: string, letterDeadline?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("letter_requests").insert({
    owner_id: user.id, school_id: schoolId, recommender_id: recommenderId, letter_deadline: letterDeadline,
  });
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function updateLetterStatus(id: string, schoolId: string, status: LetterStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("letter_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function removeLetterRequest(id: string, schoolId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("letter_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
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
    sop_version_id: sopVersionId, sop_sent_at: localDate(new Date()),
  }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

// Records an SOP version for this school in one call so a failure can't leave an orphan version.
export async function recordSopSent(schoolId: string, label: string, externalLink?: string) {
  const id = await createSopVersion(label, undefined, externalLink);
  await setSchoolSopVersion(schoolId, id);
}

export async function clearSchoolSop(schoolId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({ sop_version_id: null, sop_sent_at: null }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}
