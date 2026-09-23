"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type OutreachStatus = "not_contacted" | "contacted" | "replied" | "meeting" | "no_response" | "declined";
export type AcceptingStatus = "unknown" | "yes" | "no";
export type FundingType = "assistantship" | "fellowship" | "scholarship" | "tuition_waiver" | "stipend" | "other";
export type FundingStatus = "to_research" | "eligible" | "applied" | "awarded" | "not_eligible";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, user };
}

function refresh(schoolId: string) {
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath("/schools");
  revalidatePath("/");
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

// ---- Departments ----
export type DepartmentInput = {
  name: string; program: string | null; url: string | null; admissionsUrl: string | null;
  deadlineDate: string | null; requirements: string | null; notes: string | null;
};

export async function addDepartment(schoolId: string, d: DepartmentInput) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.from("departments").insert({
    owner_id: user.id, school_id: schoolId, name: d.name.trim(), program: clean(d.program), url: clean(d.url),
    admissions_url: clean(d.admissionsUrl), deadline_date: d.deadlineDate || null, requirements: clean(d.requirements), notes: clean(d.notes),
  });
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function updateDepartment(id: string, schoolId: string, d: DepartmentInput) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("departments").update({
    name: d.name.trim(), program: clean(d.program), url: clean(d.url), admissions_url: clean(d.admissionsUrl),
    deadline_date: d.deadlineDate || null, requirements: clean(d.requirements), notes: clean(d.notes),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

// Professors and funding in this department are kept and become school-level (FK is ON DELETE SET NULL).
export async function deleteDepartment(id: string, schoolId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

// ---- Professors ----
export type ProfessorInput = {
  name: string; title: string | null; departmentId: string | null; labName: string | null;
  researchAreas: string[]; researchSummary: string | null; homepageUrl: string | null; scholarUrl: string | null;
  email: string | null; accepting: AcceptingStatus; fitScore: number | null; notes: string | null;
};

const professorRow = (p: ProfessorInput) => ({
  name: p.name.trim(), title: clean(p.title), department_id: p.departmentId || null, lab_name: clean(p.labName),
  research_areas: p.researchAreas.map((a) => a.trim()).filter(Boolean), research_summary: clean(p.researchSummary),
  homepage_url: clean(p.homepageUrl), scholar_url: clean(p.scholarUrl), email: clean(p.email),
  accepting: p.accepting, fit_score: p.fitScore, notes: clean(p.notes),
});

export async function addProfessor(schoolId: string, p: ProfessorInput) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.from("professors").insert({ owner_id: user.id, school_id: schoolId, ...professorRow(p) });
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function updateProfessor(id: string, schoolId: string, p: ProfessorInput) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("professors").update(professorRow(p)).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function setProfessorOutreach(id: string, schoolId: string, outreach: OutreachStatus) {
  const { supabase, user } = await ctx();
  const patch: Record<string, unknown> = { outreach };
  if (outreach !== "not_contacted") {
    const d = new Date();
    patch.last_contacted_on = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const { data: prof, error } = await supabase.from("professors").update(patch).eq("id", id).select("name").single();
  if (error) throw new Error(error.message);
  // Keep the school's activity feed in sync, and count replies/meetings as wins.
  await supabase.from("activity_log").insert({
    owner_id: user.id, school_id: schoolId, type: "status_change",
    content: `${prof?.name ?? "Professor"}: outreach ${outreach.replace("_", " ")}`,
    is_win: outreach === "replied" || outreach === "meeting",
  });
  refresh(schoolId);
  revalidatePath("/wins");
}

export async function deleteProfessor(id: string, schoolId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("professors").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

// ---- Funding ----
export type FundingInput = {
  name: string; type: FundingType; amount: number | null; currency: string; period: string | null; covers: string | null;
  deadlineDate: string | null; url: string | null; status: FundingStatus; notes: string | null;
  departmentId: string | null; professorId: string | null;
};

const fundingRow = (f: FundingInput) => ({
  name: f.name.trim(), type: f.type, amount: f.amount, currency: (f.currency || "USD").toUpperCase(), period: clean(f.period),
  covers: clean(f.covers), deadline_date: f.deadlineDate || null, url: clean(f.url), status: f.status, notes: clean(f.notes),
  department_id: f.departmentId || null, professor_id: f.professorId || null,
});

export async function addFunding(schoolId: string, f: FundingInput) {
  const { supabase, user } = await ctx();
  const { error } = await supabase.from("fundings").insert({ owner_id: user.id, school_id: schoolId, ...fundingRow(f) });
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function updateFunding(id: string, schoolId: string, f: FundingInput) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("fundings").update(fundingRow(f)).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function setFundingStatus(id: string, schoolId: string, status: FundingStatus) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("fundings").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}

export async function deleteFunding(id: string, schoolId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("fundings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(schoolId);
}
