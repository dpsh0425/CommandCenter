import type { SupabaseClient } from "@supabase/supabase-js";
import type { LetterRecord } from "@/lib/letters";

export async function loadLetters(supabase: SupabaseClient): Promise<LetterRecord[]> {
  const { data, error } = await supabase
    .from("letter_requests")
    .select("id, school_id, recommender_id, status, letter_deadline, asked_on, last_reminded_on, reminder_count, received_on, schools(name), people(name, email)");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, school_id: r.school_id, school_name: r.schools?.name ?? "School",
    recommender_id: r.recommender_id, recommender_name: r.people?.name ?? "Unknown recommender", recommender_email: r.people?.email ?? null,
    status: r.status, letter_deadline: r.letter_deadline, asked_on: r.asked_on, last_reminded_on: r.last_reminded_on,
    reminder_count: r.reminder_count ?? 0, received_on: r.received_on,
  }));
}
