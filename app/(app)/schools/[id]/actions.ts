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

export type SchoolProfileInput = {
  deadlineDate: string | null; deadlineNote: string | null; contactEmail: string | null; faculty: string | null; fitNote: string | null;
  city: string | null; applicationUrl: string | null; admissionsUrl: string | null;
  applicationFee: number | null; feeCurrency: string; feeWaiver: string | null;
  grePolicy: "required" | "optional" | "not_accepted" | null; englishTest: string | null; minGpa: string | null;
  lettersRequired: number | null; writingSample: string | null; programLength: string | null;
  fundingGuarantee: string | null; tuitionNote: string | null; livingCostNote: string | null;
  acceptanceNote: string | null; internationalNote: string | null;
  tier: "reach" | "target" | "safe" | null; pros: string | null; cons: string | null;
};

export async function updateSchoolProfile(schoolId: string, p: SchoolProfileInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({
    deadline_date: p.deadlineDate, deadline_note: p.deadlineNote, contact_email: p.contactEmail, faculty: p.faculty, fit_note: p.fitNote,
    city: p.city, application_url: p.applicationUrl, admissions_url: p.admissionsUrl,
    application_fee: p.applicationFee, fee_currency: (p.feeCurrency || "USD").toUpperCase(), fee_waiver: p.feeWaiver,
    gre_policy: p.grePolicy, english_test: p.englishTest, min_gpa: p.minGpa, letters_required: p.lettersRequired,
    writing_sample: p.writingSample, program_length: p.programLength, funding_guarantee: p.fundingGuarantee,
    tuition_note: p.tuitionNote, living_cost_note: p.livingCostNote, acceptance_note: p.acceptanceNote,
    international_note: p.internationalNote, tier: p.tier, pros: p.pros, cons: p.cons,
  }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath("/schools");
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/timeline");
}

export async function deleteNote(schoolId: string, activityId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("activity_log").delete().eq("id", activityId).eq("type", "note");
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}
