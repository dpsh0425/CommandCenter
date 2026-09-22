"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SchoolStatus =
  | "not_started" | "researching" | "contacted" | "replied"
  | "submitted" | "interview" | "accepted" | "rejected";

export async function updateSchoolStatus(id: string, status: SchoolStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("schools").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    owner_id: user.id,
    school_id: id,
    type: "status_change",
    content: `Status changed to ${status.replace("_", " ")}`,
  });

  revalidatePath("/schools");
  revalidatePath(`/schools/${id}`);
}
