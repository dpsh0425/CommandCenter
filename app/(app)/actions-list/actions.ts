"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addAction(text: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("actions").insert({ owner_id: user.id, text });
  if (error) throw new Error(error.message);
  revalidatePath("/actions-list");
}

export async function toggleAction(id: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("actions").update({ done }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/actions-list");
}
