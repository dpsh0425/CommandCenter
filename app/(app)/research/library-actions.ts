"use server";
import { createClient } from "@/lib/supabase/server";
import { OWNER_USER_ID } from "@/lib/owner";
import { revalidatePath } from "next/cache";
import { hostOf, parseArxivId, parseGithubRepo } from "@/lib/links";
import { LIB_KINDS } from "@/lib/library";

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

// Refuse anything that points at this machine or a private network, since the server does the fetching.
function isPublicHost(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  if (h.includes(":") || h.startsWith("[")) return false;
  return true;
}

async function safeFetch(url: string, accept: string, maxBytes: number): Promise<{ text: string; finalUrl: string } | null> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    let u: URL;
    try { u = new URL(current); } catch { return null; }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || !isPublicHost(u.hostname)) return null;
    const res = await fetch(current, { redirect: "manual", headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; grad-command-center link preview)" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value); total += value.length;
    }
    reader.cancel().catch(() => {});
    const buf = new Uint8Array(total); let o = 0; chunks.forEach((c) => { buf.set(c, o); o += c.length; });
    return { text: new TextDecoder("utf-8", { fatal: false }).decode(buf), finalUrl: current };
  }
  return null;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const metaTag = (html: string, key: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c) : null;
};

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
    const r = await safeFetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(ax)}`, "application/atom+xml", 200000);
    const entry = r?.text.split("<entry>")[1];
    if (entry) {
      return {
        type: "arxiv",
        title: decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ax),
        authors: Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((m) => decode(m[1])).slice(0, 12),
        summary: decode(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? ""),
        published: entry.match(/<published>(.*?)<\/published>/)?.[1]?.slice(0, 10) ?? null,
        pdfUrl: `https://arxiv.org/pdf/${ax}`,
      };
    }
  }

  const yt = youtubeId(url);
  if (yt) return { type: "youtube", embed: `https://www.youtube-nocookie.com/embed/${yt}` };

  if (/\.pdf($|\?)/i.test(new URL(url).pathname + new URL(url).search)) return { type: "pdf", url };

  const page = await safeFetch(url, "text/html", 300000);
  if (!page) return { type: "none", reason: `Could not read ${hostOf(url)} from the server. Open it in a new tab.` };
  const html = page.text;
  const title = metaTag(html, "og:title") ?? metaTag(html, "twitter:title") ?? (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]) : null);
  const description = metaTag(html, "og:description") ?? metaTag(html, "twitter:description") ?? metaTag(html, "description");
  let image = metaTag(html, "og:image") ?? metaTag(html, "twitter:image");
  if (image) { try { image = new URL(image, page.finalUrl).toString(); } catch { image = null; } }
  return { type: "page", title, description, image, siteName: metaTag(html, "og:site_name") ?? hostOf(url) };
}
