"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addNote(schoolId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("activity_log").insert({
    owner_id: user.id, school_id: schoolId, type: "note", content,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}

export async function updateSchoolDetails(schoolId: string, fields: {
  deadlineDate: string | null; deadlineNote: string | null; contactEmail: string | null;
  faculty: string | null; fitNote: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({
    deadline_date: fields.deadlineDate, deadline_note: fields.deadlineNote, contact_email: fields.contactEmail,
    faculty: fields.faculty, fit_note: fields.fitNote,
  }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath("/schools");
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/timeline");
}

export async function deleteNote(schoolId: string, activityId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("activity_log").delete().eq("id", activityId).eq("type", "note");
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}
