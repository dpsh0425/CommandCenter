export type LinkKind = "github" | "paper" | "dataset" | "doc" | "website" | "video" | "other";

export const LINK_KINDS: Array<{ key: LinkKind; label: string }> = [
  { key: "github", label: "GitHub" }, { key: "paper", label: "Paper" }, { key: "dataset", label: "Dataset" },
  { key: "doc", label: "Doc" }, { key: "website", label: "Website" }, { key: "video", label: "Video" }, { key: "other", label: "Other" },
];

// Accepts "github.com/x/y" or a full URL. Returns null for anything that is not http(s).
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const GITHUB_RESERVED = new Set(["orgs", "settings", "marketplace", "topics", "sponsors", "features", "about", "login", "join", "explore", "notifications", "pulls", "issues"]);

// github.com/owner/repo[/anything] -> { owner, repo }. Profile-only URLs and reserved paths return null.
export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, "") !== "github.com") return null;
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    if (!owner || !repo || GITHUB_RESERVED.has(owner.toLowerCase())) return null;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

// arxiv.org/abs/2401.01234v2 or /pdf/2401.01234.pdf or old-style /abs/cs/0112017 -> id without version.
export function parseArxivId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.replace(/^www\./, "").endsWith("arxiv.org")) return null;
    const m = u.pathname.match(/\/(?:abs|pdf)\/(.+?)(?:\.pdf)?$/);
    if (!m) return null;
    return m[1].replace(/v\d+$/, "");
  } catch {
    return null;
  }
}

const PAPER_HOSTS = ["arxiv.org", "openreview.net", "aclanthology.org", "semanticscholar.org", "doi.org", "openaccess.thecvf.com", "proceedings.mlr.press", "papers.nips.cc", "dl.acm.org", "ieeexplore.ieee.org"];
const DATASET_HOSTS = ["huggingface.co", "kaggle.com", "zenodo.org", "data.mendeley.com", "figshare.com"];
const DOC_HOSTS = ["docs.google.com", "drive.google.com", "notion.so", "notion.site", "overleaf.com", "dropbox.com", "onedrive.live.com", "hackmd.io"];
const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];

export function detectKind(url: string): LinkKind {
  const host = hostOf(url);
  const is = (list: string[]) => list.some((h) => host === h || host.endsWith(`.${h}`));
  if (parseGithubRepo(url) || host === "github.com" || host === "gist.github.com") return "github";
  if (is(PAPER_HOSTS) || /\.pdf($|\?)/i.test(url)) return "paper";
  if (is(DATASET_HOSTS)) return "dataset";
  if (is(DOC_HOSTS)) return "doc";
  if (is(VIDEO_HOSTS)) return "video";
  return "website";
}

// A readable title when none can be fetched: "owner/repo" for GitHub, otherwise host + first path segment.
export function fallbackTitle(url: string): string {
  const gh = parseGithubRepo(url);
  if (gh) return `${gh.owner}/${gh.repo}`;
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg ? `${hostOf(url)}/${seg}` : hostOf(url);
  } catch {
    return url;
  }
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
