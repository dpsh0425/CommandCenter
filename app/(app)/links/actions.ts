"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { fetchPageTitle } from "@/lib/web-meta";
import { detectKind, fallbackTitle, normalizeUrl, parseArxivId, parseGithubRepo, type LinkKind } from "@/lib/links";

export type LinkScope = { schoolId?: string; milestoneId?: string; professorId?: string; projectId?: string };

type Meta = Record<string, unknown>;

async function githubMeta(owner: string, repo: string): Promise<{ title?: string; meta: Meta }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "grad-command-center" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { meta: { unavailable: "Not found, or the repository is private" } };
    if (!res.ok) return { meta: { unavailable: `GitHub returned ${res.status}` } };
    const r = await res.json();
    return {
      title: r.full_name,
      meta: {
        description: r.description ?? null, language: r.language ?? null, stars: r.stargazers_count ?? 0, forks: r.forks_count ?? 0,
        openIssues: r.open_issues_count ?? 0, pushedAt: r.pushed_at ?? null, archived: !!r.archived, license: r.license?.spdx_id ?? null,
        topics: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [], fetchedAt: new Date().toISOString(),
      },
    };
  } catch {
    return { meta: { unavailable: "Could not reach GitHub" } };
  }
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

async function arxivMeta(id: string): Promise<{ title?: string; meta: Meta }> {
  try {
    const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { meta: {} };
    const xml = await res.text();
    const entry = xml.split("<entry>")[1];
    if (!entry) return { meta: {} };
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const authors = Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((m) => decode(m[1]));
    const published = entry.match(/<published>(.*?)<\/published>/)?.[1];
    return { title: title ? decode(title) : undefined, meta: { authors: authors.slice(0, 6), moreAuthors: Math.max(0, authors.length - 6), published: published ?? null, arxivId: id } };
  } catch {
    return { meta: {} };
  }
}

async function resolve(url: string, kind: LinkKind): Promise<{ title?: string; meta: Meta }> {
  const gh = parseGithubRepo(url);
  if (kind === "github" && gh) return githubMeta(gh.owner, gh.repo);
  const ax = parseArxivId(url);
  if (kind === "paper" && ax) return arxivMeta(ax);
  // Anything else: use the page's own title instead of showing the bare address.
  const title = await fetchPageTitle(url);
  return { title: title ?? undefined, meta: {} };
}

function refresh(scope: LinkScope) {
  revalidatePath("/research", "layout");
  revalidatePath("/links");
  if (scope.schoolId) revalidatePath(`/schools/${scope.schoolId}`);
  if (scope.projectId) revalidatePath(`/research/projects/${scope.projectId}`);
}

export async function addLink(input: { url: string; title?: string; notes?: string; kind?: LinkKind; folder?: string; tags?: string[] } & LinkScope) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const url = normalizeUrl(input.url);
  if (!url) throw new Error("That doesn't look like a web link. Paste a full URL like https://github.com/owner/repo");

  const kind = input.kind ?? detectKind(url);
  const { title: fetched, meta } = await resolve(url, kind);
  const title = input.title?.trim() || fetched || fallbackTitle(url);

  const { error } = await supabase.from("links").insert({
    owner_id: user.id, url, title, kind, notes: input.notes?.trim() || null, meta,
    school_id: input.schoolId ?? null, milestone_id: input.milestoneId ?? null, professor_id: input.professorId ?? null, project_id: input.projectId ?? null,
    folder: input.folder?.trim() || null, tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
  });
  if (error) throw new Error(error.message);
  refresh(input);
}

export async function refreshLink(id: string, scope: LinkScope) {
  const supabase = await createClient();
  const { data: link } = await supabase.from("links").select("url, kind, title").eq("id", id).single();
  if (!link) throw new Error("link not found");
  const { meta } = await resolve(link.url, link.kind as LinkKind);
  const { error } = await supabase.from("links").update({ meta }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(scope);
}

export async function updateLink(id: string, scope: LinkScope, fields: { title: string; notes: string | null }) {
  const supabase = await createClient();
  const { error } = await supabase.from("links").update({ title: fields.title.trim(), notes: fields.notes?.trim() || null }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(scope);
}

export async function togglePinLink(id: string, pinned: boolean, scope: LinkScope) {
  const supabase = await createClient();
  const { error } = await supabase.from("links").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(scope);
}

export async function deleteLink(id: string, scope: LinkScope) {
  const supabase = await createClient();
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh(scope);
}
