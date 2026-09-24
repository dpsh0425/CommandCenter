// Server-side helpers that read public web pages for titles and previews.
// The server does the fetching, so anything that could point at this machine or a private network is refused.

export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return false;
  // IPv6 literals and bare numbers or hex ("2130706433", "0x7f000001") are private-network tricks.
  if (h.includes(":") || h.startsWith("[")) return false;
  if (/^(0x[0-9a-f]+|\d+)$/i.test(h)) return false;
  // Dotted numbers: only a full four-part address is understood, and it must not be a private range.
  if (/^[\d.]+$/.test(h)) {
    const parts = h.split(".");
    if (parts.length !== 4 || parts.some((p) => p === "" || Number(p) > 255)) return false;
    const [a, b] = parts.map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  return true;
}

export async function safeFetch(url: string, accept: string, maxBytes: number, timeoutMs = 8000): Promise<{ text: string; finalUrl: string } | null> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    let u: URL;
    try { u = new URL(current); } catch { return null; }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || !isPublicHost(u.hostname)) return null;
    let res: Response;
    try {
      res = await fetch(current, { redirect: "manual", headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; grad-command-center link preview)" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    } catch { return null; }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    const buf = new Uint8Array(total);
    let o = 0;
    chunks.forEach((c) => { buf.set(c, o); o += c.length; });
    return { text: new TextDecoder("utf-8", { fatal: false }).decode(buf), finalUrl: current };
  }
  return null;
}

export const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();

export function metaTag(html: string, key: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"))?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : null;
}

export function extractPageTitle(html: string): string | null {
  const og = metaTag(html, "og:title") ?? metaTag(html, "twitter:title");
  if (og) return og;
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = t ? decodeEntities(t) : "";
  return title || null;
}

// A short title for a saved link; never throws and never waits long.
export async function fetchPageTitle(url: string): Promise<string | null> {
  const page = await safeFetch(url, "text/html", 200000, 5000);
  return page ? extractPageTitle(page.text) : null;
}

export type ArxivMeta = { title: string; authors: string[]; summary: string; published: string | null };

export async function fetchArxivMeta(id: string): Promise<ArxivMeta | null> {
  const r = await safeFetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`, "application/atom+xml", 200000);
  const entry = r?.text.split("<entry>")[1];
  if (!entry) return null;
  return {
    title: decodeEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? id),
    authors: Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((m) => decodeEntities(m[1])).slice(0, 12),
    summary: decodeEntities(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? ""),
    published: entry.match(/<published>(.*?)<\/published>/)?.[1]?.slice(0, 10) ?? null,
  };
}
