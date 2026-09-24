"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { hostOf, parseArxivId, parseGithubRepo } from "@/lib/links";
import { LIB_KINDS } from "@/lib/library";
import { extractPageTitle, fetchArxivMeta, fetchPageTitle, metaTag, safeFetch } from "@/lib/web-meta";

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== OWNER_USER_ID) throw new Error("Only the workspace owner can change the library.");
  return { supabase, userId: user.id };
}

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;
const cleanTags = (t: string[] | undefined) => Array.from(new Set((t ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))).slice(0, 12);
const refresh = (projectId: string) => revalidatePath(`/research/projects/${projectId}`);

export async function recordProjectDocument(input: {
  projectId: string; title: string; kind: string; storagePath: string; fileName: string; mimeType: string | null; sizeBytes: number;
  folder?: string; tags?: string[]; notes?: string; versionNote?: string; replacesId?: string | null;
}) {
  const { supabase, userId } = await owner();
  if (!input.storagePath.startsWith(userId + "/")) throw new Error("Invalid file path.");
  const kind = LIB_KINDS.some((k) => k.key === input.kind) ? input.kind : "other";
  // A new version keeps the pin and the notes of the file it replaces.
  const prev = input.replacesId ? (await supabase.from("documents").select("pinned, notes").eq("id", input.replacesId).single()).data : null;
  const { data: row, error } = await supabase.from("documents").insert({
    owner_id: userId, project_id: input.projectId, title: input.title.trim() || input.fileName, kind, storage_path: input.storagePath,
    file_name: input.fileName, mime_type: input.mimeType, size_bytes: input.sizeBytes, folder: clean(input.folder), tags: cleanTags(input.tags),
    notes: clean(input.notes) ?? prev?.notes ?? null, pinned: prev?.pinned ?? false, version_note: clean(input.versionNote), replaces_id: input.replacesId ?? null,
  }).select("id").single();
  if (error || !row) throw new Error(error?.message ?? "Could not save the file.");
  if (input.replacesId) await supabase.from("documents").update({ is_current: false, pinned: false }).eq("id", input.replacesId);
  refresh(input.projectId);
  return row.id as string;
}

export async function updateProjectDocument(id: string, projectId: string, f: { title?: string; kind?: string; folder?: string | null; tags?: string[]; notes?: string | null; pinned?: boolean; isCurrent?: boolean }) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (f.title !== undefined) row.title = f.title.trim() || "Untitled";
  if (f.kind !== undefined && LIB_KINDS.some((k) => k.key === f.kind)) row.kind = f.kind;
  if (f.folder !== undefined) row.folder = clean(f.folder);
  if (f.tags !== undefined) row.tags = cleanTags(f.tags);
  if (f.notes !== undefined) row.notes = clean(f.notes);
  if (f.pinned !== undefined) row.pinned = f.pinned;
  if (f.isCurrent !== undefined) row.is_current = f.isCurrent;
  const { error } = await supabase.from("documents").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function deleteProjectDocument(id: string, projectId: string) {
  const { supabase } = await owner();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).single();
  if (doc) await supabase.storage.from("materials").remove([doc.storage_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function updateProjectLink(id: string, projectId: string, f: { title?: string; notes?: string | null; folder?: string | null; tags?: string[]; pinned?: boolean }) {
  const { supabase } = await owner();
  const row: Record<string, unknown> = {};
  if (f.title !== undefined) row.title = f.title.trim() || "Untitled";
  if (f.notes !== undefined) row.notes = clean(f.notes);
  if (f.folder !== undefined) row.folder = clean(f.folder);
  if (f.tags !== undefined) row.tags = cleanTags(f.tags);
  if (f.pinned !== undefined) row.pinned = f.pinned;
  const { error } = await supabase.from("links").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(projectId);
}

export async function getFileUrl(id: string, download = false) {
  const { supabase } = await owner();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", id).single();
  if (!doc) throw new Error("File not found.");
  const { data, error } = await supabase.storage.from("materials").createSignedUrl(doc.storage_path, 3600, download ? { download: doc.file_name } : undefined);
  if (error || !data) throw new Error(error?.message ?? "Could not open the file.");
  return data.signedUrl;
}

// Link previews --------------------------------------------------------------------------------
export type LinkPreview =
  | { type: "github"; readme: string | null; readmeName: string | null }
  | { type: "arxiv"; title: string; authors: string[]; summary: string; published: string | null; pdfUrl: string }
  | { type: "youtube"; embed: string }
  | { type: "pdf"; url: string }
  | { type: "page"; title: string | null; description: string | null; image: string | null; siteName: string | null }
  | { type: "none"; reason: string };

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host.endsWith("youtube.com")) return u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? null;
  } catch { /* fall through */ }
  return null;
}

export async function getLinkPreview(id: string): Promise<LinkPreview> {
  const { supabase } = await owner();
  const { data: link } = await supabase.from("links").select("url, kind").eq("id", id).single();
  if (!link) return { type: "none", reason: "Link not found." };
  const url = link.url as string;

  const gh = parseGithubRepo(url);
  if (gh) {
    try {
      const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/readme`, {
        headers: { Accept: "application/vnd.github.raw+json", "User-Agent": "grad-command-center" }, signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!res.ok) return { type: "github", readme: null, readmeName: null };
      const text = await res.text();
      return { type: "github", readme: text.slice(0, 60000), readmeName: "README" };
    } catch { return { type: "github", readme: null, readmeName: null }; }
  }

  const ax = parseArxivId(url);
  if (ax) {
    const m = await fetchArxivMeta(ax);
    if (m) return { type: "arxiv", ...m, pdfUrl: `https://arxiv.org/pdf/${ax}` };
  }

  const yt = youtubeId(url);
  if (yt) return { type: "youtube", embed: `https://www.youtube-nocookie.com/embed/${yt}` };

  if (/\.pdf($|\?)/i.test(new URL(url).pathname + new URL(url).search)) return { type: "pdf", url };

  const page = await safeFetch(url, "text/html", 300000);
  if (!page) return { type: "none", reason: `Could not read ${hostOf(url)} from the server. Open it in a new tab.` };
  const html = page.text;
  const title = extractPageTitle(html);
  const description = metaTag(html, "og:description") ?? metaTag(html, "twitter:description") ?? metaTag(html, "description");
  let image = metaTag(html, "og:image") ?? metaTag(html, "twitter:image");
  if (image) { try { image = new URL(image, page.finalUrl).toString(); } catch { image = null; } }
  return { type: "page", title, description, image, siteName: metaTag(html, "og:site_name") ?? hostOf(url) };
}

// Fills in a paper's details from its link, for the reading list form. arXiv links give title, authors and year;
// any other public page gives at least a title. Returns an empty object when nothing could be read.
export async function lookupPaper(url: string): Promise<{ title?: string; authors?: string; year?: number }> {
  await owner();
  const clean = url.trim();
  if (!clean) return {};
  const full = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  const ax = parseArxivId(full);
  if (ax) {
    const m = await fetchArxivMeta(ax);
    if (m) return { title: m.title, authors: m.authors.join(", "), year: m.published ? Number(m.published.slice(0, 4)) : undefined };
  }
  const title = await fetchPageTitle(full);
  return title ? { title } : {};
}
