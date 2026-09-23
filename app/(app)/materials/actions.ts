"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { DOC_KINDS, emptyResume, normalizeResume, type ResumeData } from "@/lib/resume";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can manage materials.");
  return { supabase, userId: user.id };
}

export async function recordDocument(input: {
  title: string; kind: string; storagePath: string; fileName: string; mimeType: string | null; sizeBytes: number; versionNote?: string; schoolId?: string | null;
}) {
  const { supabase, userId } = await owner();
  if (!input.storagePath.startsWith(userId + "/")) throw new Error("Invalid file path.");
  const kind = DOC_KINDS.some((k) => k.key === input.kind) ? input.kind : "other";
  const title = input.title.trim() || input.fileName;
  const { error } = await supabase.from("documents").insert({
    owner_id: userId, title, kind, storage_path: input.storagePath, file_name: input.fileName, mime_type: input.mimeType,
    size_bytes: input.sizeBytes, version_note: input.versionNote?.trim() || null, school_id: input.schoolId || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/materials");
}

export async function getDocumentUrl(id: string) {
  const { supabase } = await owner();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).single();
  if (!doc) throw new Error("Document not found.");
  const { data, error } = await supabase.storage.from("materials").createSignedUrl(doc.storage_path, 300);
  if (error || !data) throw new Error(error?.message ?? "Could not open the file.");
  return data.signedUrl;
}

export async function updateDocument(id: string, patch: { title?: string; kind?: string; versionNote?: string | null; schoolId?: string | null; isCurrent?: boolean }) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim() || "Untitled";
  if (patch.kind !== undefined && DOC_KINDS.some((k) => k.key === patch.kind)) row.kind = patch.kind;
  if (patch.versionNote !== undefined) row.version_note = patch.versionNote?.trim() || null;
  if (patch.schoolId !== undefined) row.school_id = patch.schoolId || null;
  if (patch.isCurrent !== undefined) row.is_current = patch.isCurrent;
  const { error } = await supabase.from("documents").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/materials");
}

export async function deleteDocument(id: string) {
  const { supabase } = await owner();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).single();
  if (doc) await supabase.storage.from("materials").remove([doc.storage_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/materials");
}

export async function createResume(name?: string, copyFromId?: string) {
  const { supabase, userId } = await owner();
  let data: ResumeData = emptyResume();
  let title = name?.trim() || "My resume";
  if (copyFromId) {
    const { data: src } = await supabase.from("resumes").select("name, data").eq("id", copyFromId).single();
    if (src) { data = normalizeResume(src.data); title = name?.trim() || `${src.name} (copy)`; }
  }
  const { data: row, error } = await supabase.from("resumes").insert({ owner_id: userId, name: title, data }).select("id").single();
  if (error || !row) throw new Error(error?.message ?? "Could not create the resume.");
  revalidatePath("/materials/resume");
  return row.id as string;
}

export async function saveResume(id: string, name: string, data: ResumeData) {
  const { supabase } = await owner();
  const { error } = await supabase.from("resumes").update({ name: name.trim() || "My resume", data: normalizeResume(data) }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/materials/resume");
}

export async function deleteResume(id: string) {
  const { supabase } = await owner();
  const { error } = await supabase.from("resumes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/materials/resume");
}
