"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPerson(data: { name: string; role?: string; area?: string; color?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("people").insert({ owner_id: user.id, ...data });
  if (error) throw new Error(error.message);
  revalidatePath("/people");
}

export async function deletePerson(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/people");
  revalidatePath("/tasks");
}
