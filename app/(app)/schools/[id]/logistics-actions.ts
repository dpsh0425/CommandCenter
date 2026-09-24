"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import { isLetterStatus, letterStatusChange } from "@/lib/letters";
import { todayString } from "@/lib/digest";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function refresh(schoolId: string) {
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath("/");
  revalidatePath("/today");
}

export async function addLetterRequest(schoolId: string, recommenderId: string, letterDeadline?: string): Promise<ActionResult> {
  return toResult(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new UserError("You are signed out. Sign in again and retry.");
    const { error } = await supabase.from("letter_requests").insert({
      owner_id: user.id, school_id: schoolId, recommender_id: recommenderId, letter_deadline: letterDeadline,
    });
    if (error) throw new Error(error.message);
    refresh(schoolId);
  });
}

export async function updateLetterStatus(id: string, schoolId: string, status: string): Promise<ActionResult> {
  return toResult(async () => {
    if (!isLetterStatus(status)) throw new UserError("Unknown letter status.");
    const supabase = await createClient();
    const { data: cur } = await supabase.from("letter_requests").select("asked_on, received_on").eq("id", id).single();
    if (!cur) throw new UserError("Letter request not found.");
    const { error } = await supabase.from("letter_requests").update(letterStatusChange(status, todayString(), cur)).eq("id", id);
    if (error) throw new Error(error.message);
    refresh(schoolId);
    revalidatePath("/materials/letters");
    revalidatePath("/week");
  });
}

export async function removeLetterRequest(id: string, schoolId: string): Promise<ActionResult> {
  return toResult(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("letter_requests").delete().eq("id", id);
    if (error) throw new Error(error.message);
    refresh(schoolId);
  });
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
