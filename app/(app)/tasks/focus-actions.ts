"use server";
import { createClient } from "@/lib/supabase/server";

export async function startFocusSession(taskId: string, durationMinutes: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data, error } = await supabase.from("focus_sessions").insert({
    owner_id: user.id, task_id: taskId, duration_minutes: durationMinutes,
  }).select().single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function endFocusSession(sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("focus_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
  if (error) throw new Error(error.message);
}
