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

export async function updateContactEmail(schoolId: string, email: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({ contact_email: email }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}
