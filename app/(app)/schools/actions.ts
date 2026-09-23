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

  const POSITIVE_STATUSES: SchoolStatus[] = ["replied", "submitted", "interview", "accepted"];
  await supabase.from("activity_log").insert({
    owner_id: user.id,
    school_id: id,
    type: "status_change",
    content: `Status changed to ${status.replace("_", " ")}`,
    is_win: POSITIVE_STATUSES.includes(status),
  });

  if (status === "replied") {
    const { data: school } = await supabase.from("schools").select("name").eq("id", id).single();
    const due = new Date();
    due.setDate(due.getDate() + 3);
    await supabase.from("tasks").insert({
      owner_id: user.id,
      title: `Follow up with ${school?.name ?? "school"}`,
      school_id: id,
      priority: "medium",
      due_date: due.toISOString().slice(0, 10),
    });
  }

  revalidatePath("/schools");
  revalidatePath(`/schools/${id}`);
  revalidatePath("/tasks");
}
