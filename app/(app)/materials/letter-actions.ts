"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import { askedUpdate, isLetterStatus, letterStatusChange, planLetterRequests, remindedUpdate } from "@/lib/letters";
import { todayString } from "@/lib/digest";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new UserError("Only the workspace owner can change letter requests.");
  return { supabase, userId: user.id };
}

function refresh(schoolIds: string[]) {
  revalidatePath("/materials/letters");
  revalidatePath("/week");
  revalidatePath("/");
  revalidatePath("/today");
  for (const id of Array.from(new Set(schoolIds))) revalidatePath(`/schools/${id}`);
}

export async function markLettersAsked(ids: string[]): Promise<ActionResult> {
  return toResult(async () => {
    const { supabase } = await owner();
    if (ids.length === 0) return;
    const today = todayString();
    const { data, error } = await supabase.from("letter_requests").select("id, status, asked_on, school_id").in("id", ids);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const { error: e } = await supabase.from("letter_requests").update(askedUpdate({ status: r.status, asked_on: r.asked_on }, today)).eq("id", r.id);
      if (e) throw new Error(e.message);
    }
    refresh((data ?? []).map((r) => r.school_id));
  });
}

export async function markLettersReminded(ids: string[]): Promise<ActionResult> {
  return toResult(async () => {
    const { supabase } = await owner();
    if (ids.length === 0) return;
    const today = todayString();
    const { data, error } = await supabase.from("letter_requests").select("id, reminder_count, school_id").in("id", ids);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const { error: e } = await supabase.from("letter_requests").update(remindedUpdate({ reminder_count: r.reminder_count ?? 0 }, today)).eq("id", r.id);
      if (e) throw new Error(e.message);
    }
    refresh((data ?? []).map((r) => r.school_id));
  });
}

export async function setLetterStatus(id: string, next: string): Promise<ActionResult> {
  return toResult(async () => {
    const { supabase } = await owner();
    if (!isLetterStatus(next)) throw new UserError("Unknown letter status.");
    const { data: cur } = await supabase.from("letter_requests").select("asked_on, received_on, school_id").eq("id", id).single();
    if (!cur) throw new UserError("Letter request not found.");
    const { error } = await supabase.from("letter_requests").update(letterStatusChange(next, todayString(), cur)).eq("id", id);
    if (error) throw new Error(error.message);
    refresh([cur.school_id]);
  });
}

export async function addLetterRequests(recommenderId: string, schoolIds: string[], deadline: string | null): Promise<ActionResult<{ added: number; skipped: number }>> {
  return toResult(async () => {
    const { supabase, userId } = await owner();
    const chosen = Array.from(new Set(schoolIds)).slice(0, 50);
    if (chosen.length === 0) throw new UserError("Choose at least one school.");
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new UserError("That deadline is not a valid date.");
    const { data: person } = await supabase.from("people").select("id").eq("id", recommenderId).single();
    if (!person) throw new UserError("Recommender not found.");
    const [{ data: existing }, { data: schools }] = await Promise.all([
      supabase.from("letter_requests").select("school_id").eq("recommender_id", recommenderId),
      supabase.from("schools").select("id, deadline_date").in("id", chosen),
    ]);
    const plan = planLetterRequests((existing ?? []).map((r) => r.school_id), (schools ?? []) as Array<{ id: string; deadline_date: string | null }>, chosen, deadline || null);
    if (plan.rows.length > 0) {
      const { error } = await supabase.from("letter_requests").insert(plan.rows.map((r) => ({ ...r, owner_id: userId, recommender_id: recommenderId })));
      if (error) throw error;
    }
    refresh(plan.rows.map((r) => r.school_id));
    return { added: plan.rows.length, skipped: plan.skipped };
  });
}
