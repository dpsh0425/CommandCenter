import { countWords } from "@/lib/research";

// Pure text rules for the editor. Safe to import from the browser: nothing here touches the DOM or the sanitizer.

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e: string) => {
    const l = e.toLowerCase();
    if (NAMED[l] !== undefined) return NAMED[l];
    const code = l.startsWith("#x") ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10);
    try { return String.fromCodePoint(code); } catch { return m; }
  });
}

// Text the editor produced starts with a block tag; anything else is old plain text.
export const isHtml = (s: string) => /^\s*<(p|h[1-6]|ul|ol|blockquote|hr|div|br)[\s>/]/i.test(s);

function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

// Old plain text (with the light markdown the notes used) becomes the same HTML the editor writes.
export function legacyToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const isBullet = (l: string) => /^\s*[-*+]\s+/.test(l);
  const isOrdered = (l: string) => /^\s*\d+[.)]\s+/.test(l);
  const isQuote = (l: string) => /^>\s?/.test(l);
  const isHeading = (l: string) => /^#{1,6}\s+/.test(l);
  const isRule = (l: string) => /^\s*([-*_])\1{2,}\s*$/.test(l);
  const startsBlock = (l: string) => l.trim() === "" || isBullet(l) || isOrdered(l) || isQuote(l) || isHeading(l) || isRule(l);
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = Math.min(h[1].length, 3); out.push(`<h${n}>${inline(escapeHtml(h[2].trim()))}</h${n}>`); i++; continue; }
    if (isRule(line)) { out.push("<hr>"); i++; continue; }
    if (isBullet(line) || isOrdered(line)) {
      const ordered = isOrdered(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? isOrdered(lines[i]) : isBullet(lines[i]))) {
        items.push(`<li><p>${inline(escapeHtml(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, "").trim()))}</p></li>`);
        i++;
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    if (isQuote(line)) {
      const buf: string[] = [];
      while (i < lines.length && isQuote(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${buf.map((b) => inline(escapeHtml(b))).join("<br>")}</p></blockquote>`);
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && !startsBlock(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${buf.map((b) => inline(escapeHtml(b.trim()))).join("<br>")}</p>`);
  }
  return out.join("");
}

// What the editor loads: stored HTML as it is, old plain text converted. Cleaning happens separately, on the server.
export const toEditorHtml = (stored: string) => (isHtml(stored) ? stored : legacyToHtml(stored));

export function htmlToText(html: string, opts: { bullets?: boolean } = {}): string {
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*li\b[^>]*>\s*<\s*p\b[^>]*>/gi, "<li>")
    .replace(/<\s*\/\s*p\s*>\s*<\s*\/\s*li\s*>/gi, "</li>")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, opts.bullets ? "- " : "")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|h[1-6]|blockquote|ul|ol|div)\s*>/gi, "\n\n")
    .replace(/<\s*hr\s*\/?\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Words in stored text, whether it is HTML or old plain text.
export const countWordsHtml = (stored: string) => countWords(htmlToText(toEditorHtml(stored)));

// Plain text for pasting into an application portal.
export function portalText(stored: string, opts: { straightQuotes?: boolean } = {}): string {
  let t = htmlToText(toEditorHtml(stored), { bullets: true });
  if (opts.straightQuotes) t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  return t;
}

// What a typed link address becomes, or null when it is empty or uses a scheme we refuse.
export function linkHref(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (/^[^\s@:]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  return `https://${v}`;
}
