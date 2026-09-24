"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { countWordsHtml, toEditorHtml } from "@/lib/rich-text";
import { sanitizeHtml } from "@/lib/rich-text-server";
import { defaultTitle, isStatementKind, isStatementStatus, statusChange } from "@/lib/statements";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can change statements.");
  return { supabase, userId: user.id };
}

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function refresh(id?: string, schoolId?: string | null) {
  revalidatePath("/materials/statements");
  if (id) revalidatePath(`/materials/statements/${id}`);
  if (schoolId) revalidatePath(`/schools/${schoolId}`);
  revalidatePath("/readiness");
  revalidatePath("/");
}

export async function createStatement(input: { kind: string; schoolId?: string | null; fromId?: string | null; title?: string }): Promise<string> {
  const { supabase, userId } = await owner();
  if (!isStatementKind(input.kind)) throw new Error("Unknown statement type.");

  let body = "";
  let prompt: string | null = null;
  let sourceId: string | null = null;
  if (input.fromId) {
    const { data: src } = await supabase.from("statements").select("body, prompt").eq("id", input.fromId).single();
    if (!src) throw new Error("The draft to copy from was not found.");
    body = src.body;
    prompt = src.prompt;
    sourceId = input.fromId;
  }

  let schoolName: string | undefined;
  if (input.schoolId) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", input.schoolId).single();
    schoolName = school?.name;
  }

  const { data, error } = await supabase.from("statements").insert({
    owner_id: userId, kind: input.kind, title: input.title?.trim() || defaultTitle(input.kind, schoolName), prompt, body, words: countWordsHtml(body),
    school_id: input.schoolId ?? null, source_id: sourceId,
  }).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") throw new Error("This school already has a statement of that type.");
    throw new Error(error?.message ?? "Could not create the statement.");
  }
  refresh(data.id, input.schoolId);
  return data.id as string;
}

export async function updateStatementMeta(id: string, f: { title?: string; kind?: string; prompt?: string | null; wordLimit?: number | null }) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (f.title !== undefined) {
    if (!f.title.trim()) throw new Error("The title can't be empty.");
    row.title = f.title.trim();
  }
  if (f.kind !== undefined) {
    if (!isStatementKind(f.kind)) throw new Error("Unknown statement type.");
    row.kind = f.kind;
  }
  if (f.prompt !== undefined) row.prompt = (f.prompt ?? "").trim() || null;
  if (f.wordLimit !== undefined) row.word_limit = f.wordLimit && f.wordLimit > 0 ? Math.round(f.wordLimit) : null;
  const { data, error } = await supabase.from("statements").update(row).eq("id", id).select("school_id").single();
  if (error) {
    if (error.code === "23505") throw new Error("This school already has a statement of that type.");
    throw new Error(error.message);
  }
  refresh(id, data?.school_id);
}

export type SaveResult = { ok: true; words: number; version: number } | { ok: false; reason: "stale" | "error"; message: string };

// Called on every autosave, so it deliberately does not revalidate the page. It never throws: production builds hide
// thrown messages, and the editor must be able to tell "changed elsewhere" from "could not save".
export async function saveStatementBody(id: string, body: string, baseVersion: number): Promise<SaveResult> {
  const { supabase } = await owner();
  const clean = sanitizeHtml(toEditorHtml(body));
  const words = countWordsHtml(clean);
  const { data, error } = await supabase
    .from("statements")
    .update({ body: clean, words, body_version: baseVersion + 1 })
    .eq("id", id)
    .eq("body_version", baseVersion)
    .select("body_version");
  if (error) return { ok: false, reason: "error", message: error.message };
  if (!data || data.length === 0) return { ok: false, reason: "stale", message: "This was changed somewhere else." };
  return { ok: true, words, version: data[0].body_version as number };
}

export async function setStatementStatus(id: string, next: string) {
  const { supabase } = await owner();
  if (!isStatementStatus(next)) throw new Error("Unknown status.");
  const { data: cur } = await supabase.from("statements").select("sent_on, school_id").eq("id", id).single();
  if (!cur) throw new Error("Statement not found.");
  const change = statusChange(next, localToday(), cur.sent_on);
  const { error } = await supabase.from("statements").update(change).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id, cur.school_id);
}

export async function saveSnapshot(id: string, note?: string) {
  const { supabase, userId } = await owner();
  const { data: cur } = await supabase.from("statements").select("body, words").eq("id", id).single();
  if (!cur) throw new Error("Statement not found.");
  const { error } = await supabase.from("statement_snapshots").insert({
    owner_id: userId, statement_id: id, body: cur.body, words: cur.words, note: (note ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/materials/statements/${id}`);
}

// Restoring first saves the current text as a snapshot, so nothing is ever lost.
export async function restoreSnapshot(snapshotId: string): Promise<{ body: string; words: number; version: number }> {
  const { supabase, userId } = await owner();
  const { data: snap } = await supabase.from("statement_snapshots").select("statement_id, body").eq("id", snapshotId).single();
  if (!snap) throw new Error("Version not found.");
  const { data: cur } = await supabase.from("statements").select("body, words, school_id, body_version").eq("id", snap.statement_id).single();
  if (!cur) throw new Error("Statement not found.");
  if (cur.body !== snap.body) {
    const { error: e1 } = await supabase.from("statement_snapshots").insert({
      owner_id: userId, statement_id: snap.statement_id, body: cur.body, words: cur.words, note: "Before restoring an older version",
    });
    if (e1) throw new Error(e1.message);
  }
  const clean = sanitizeHtml(toEditorHtml(snap.body));
  const words = countWordsHtml(clean);
  const { data: updated, error } = await supabase
    .from("statements")
    .update({ body: clean, words, body_version: cur.body_version + 1 })
    .eq("id", snap.statement_id)
    .eq("body_version", cur.body_version)
    .select("body_version");
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) throw new Error("The statement changed while restoring. Try again.");
  refresh(snap.statement_id, cur.school_id);
  return { body: clean, words, version: updated[0].body_version as number };
}

export async function deleteSnapshot(snapshotId: string, statementId: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("statement_snapshots").delete().eq("id", snapshotId);
  if (error) throw new Error(error.message);
  revalidatePath(`/materials/statements/${statementId}`);
}

export async function deleteStatement(id: string) {
  const { supabase } = await owner();
  const { data: cur } = await supabase.from("statements").select("school_id").eq("id", id).single();
  const { error } = await supabase.from("statements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(undefined, cur?.school_id);
}
