"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";

const ITEMS = ["portal", "resume", "transcripts", "gre", "english", "fee"];

function refresh(schoolId: string) {
  revalidatePath("/");
  revalidatePath("/readiness");
  revalidatePath(`/schools/${schoolId}`);
}

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can change application tracking.");
  return { supabase, userId: user.id };
}

export async function setApplying(schoolId: string, applying: boolean) {
  const { supabase } = await owner();
  const { error } = await supabase.from("schools").update({ applying }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function setCheck(schoolId: string, item: string, done: boolean) {
  if (!ITEMS.includes(item)) throw new Error("Unknown checklist item.");
  const { supabase, userId } = await owner();
  const { error } = await supabase.from("application_checks").upsert(
    { owner_id: userId, school_id: schoolId, item, done, done_at: done ? new Date().toISOString() : null },
    { onConflict: "school_id,item" }
  );
  if (error) throw new Error(error.message);
  refresh(schoolId);
}
