# Rich Editor Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Word-style editor (TipTap) with safe HTML storage, a paper look, local crash backup and stale-edit protection, first used by the statement editor.

**Architecture:** Two pure modules (`lib/rich-text.ts` for client and server, `lib/rich-text-server.ts` for the sanitizer) hold all the text rules and are unit-tested. `components/rich-editor.tsx` (client, lazy-loaded) is the editor; `components/rich-view.tsx` renders already-cleaned HTML; `components/paper-textarea.tsx` is the plain paper box. A new `statements.body_version` counter makes saves atomic so an edit made elsewhere is never silently overwritten. The statement editor is the first consumer; plans 2 and 3 add statement tooling and the other screens.

**Tech Stack:** Next.js 14 App Router, React 18, TipTap 3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-text-align`, `@tiptap/extensions`), `sanitize-html`, Vitest, Supabase, Tailwind.

## Global Constraints

- HTML is stored in the existing `body` text columns. Old plain text is never migrated in bulk; it is converted when opened (`toEditorHtml`) and stored as HTML on the next save.
- Allowed HTML: tags `p br strong em u s h1 h2 h3 ul ol li blockquote hr a`; `a` `href` schemes `http`, `https`, `mailto` only, always `rel="noopener noreferrer nofollow"`; the only allowed style is `text-align` with `left`, `center`, `right` or `justify`. No images, no scripts, no other attributes.
- `lib/rich-text-server.ts` (imports `sanitize-html`) must never be imported from a client component. Client components receive HTML that a server component or action already cleaned.
- Word counts use the existing `countWords` (`lib/research.ts`) applied to the visible text, so word limits behave as before.
- Saves of statement text are atomic on `body_version`: `update ... where id = ? and body_version = ?` and bump by one. A refused save is reported as `{ ok: false, reason: "stale" }`, never thrown (production builds hide thrown error messages).
- The app sends no email. Recommender email drafts stay plain text.
- The TypeScript target has no iterable spread for `Set`/`Map`: use `Array.from`. `searchParams` and `params` are Promises in this Next version.
- Test data is prefixed `ZZTEMP` and deleted afterwards; real rows are never left changed.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Deviation from the spec text: the spec put the sanitizer inside `toEditorHtml`. Here `toEditorHtml` (client-safe) only converts old plain text to HTML, and cleaning is a separate server step (`sanitizeHtml`, `renderRich`), because the sanitizer library must stay out of the browser bundle.

---

## File Structure

- Create `lib/rich-text.ts`, `tests/lib/rich-text.test.ts`: pure text rules, safe for the browser.
- Create `lib/rich-text-server.ts`, `tests/lib/rich-text-server.test.ts`: sanitizer and `renderRich`.
- Create `lib/local-backup.ts`, `tests/lib/local-backup.test.ts`: pure crash-backup rules; `lib/use-draft-backup.ts`: the React hook.
- Create `supabase/migrations/0016_statement_body_version.sql`, `supabase/tests/006_statement_body_version.sql`.
- Create `components/rich-editor.tsx`, `components/rich-editor-lazy.tsx`, `components/rich-view.tsx`, `components/paper-textarea.tsx`; modify `app/globals.css`.
- Modify `app/(app)/materials/statement-actions.ts`, `app/(app)/materials/statements/[id]/page.tsx`, `components/statement-editor.tsx`.

---

### Task 1: Pure text rules and the sanitizer

**Files:**
- Create: `lib/rich-text.ts`, `lib/rich-text-server.ts`
- Test: `tests/lib/rich-text.test.ts`, `tests/lib/rich-text-server.test.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces from `lib/rich-text.ts` (client-safe): `escapeHtml(s)`, `decodeEntities(s)`, `isHtml(s)`, `legacyToHtml(s)`, `toEditorHtml(s)`, `htmlToText(html, opts?: { bullets?: boolean })`, `countWordsHtml(s)`, `portalText(s, opts?: { straightQuotes?: boolean })`, `linkHref(input): string | null`.
- Produces from `lib/rich-text-server.ts`: `sanitizeHtml(html: string): string`, `renderRich(stored: string): string` (= `sanitizeHtml(toEditorHtml(stored))`).

- [ ] **Step 1: Install the packages**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extensions sanitize-html
npm install --save-dev @types/sanitize-html
```

Expected: installs without peer-dependency errors (React 18 is supported by TipTap 3). If `npm` reports a peer conflict, stop and report it.

- [ ] **Step 2: Write the failing tests for `lib/rich-text.ts`**

`tests/lib/rich-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countWords } from "@/lib/research";
import { countWordsHtml, decodeEntities, escapeHtml, htmlToText, isHtml, legacyToHtml, linkHref, portalText, toEditorHtml } from "@/lib/rich-text";

describe("escapeHtml and decodeEntities", () => {
  it("escapes the five special characters", () => expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;"));
  it("decodes named and numeric entities once", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x41; &nbsp;f")).toBe(`a & b <c> "d" 'e' A  f`);
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });
});

describe("isHtml", () => {
  it("recognises the blocks the editor produces", () => {
    for (const s of ["<p>x</p>", "  <h1>T</h1>", "<ul><li>x</li></ul>", "<blockquote><p>q</p></blockquote>", "<hr>"]) expect(isHtml(s)).toBe(true);
  });
  it("treats everything else as plain text", () => {
    for (const s of ["", "Hello", "a < b and c > d", "<3 you", "# Heading"]) expect(isHtml(s)).toBe(false);
  });
});

describe("legacyToHtml", () => {
  it("makes paragraphs and line breaks", () => {
    expect(legacyToHtml("Hello\n\nWorld")).toBe("<p>Hello</p><p>World</p>");
    expect(legacyToHtml("a\nb")).toBe("<p>a<br>b</p>");
    expect(legacyToHtml("a\r\n\r\nb")).toBe("<p>a</p><p>b</p>");
  });
  it("returns an empty string for empty text", () => {
    expect(legacyToHtml("")).toBe("");
    expect(legacyToHtml("  \n ")).toBe("");
  });
  it("escapes markup in plain text", () => {
    expect(legacyToHtml(`<script>x</script> & "q"`)).toBe("<p>&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot;</p>");
  });
  it("converts the old light markdown", () => {
    expect(legacyToHtml("# Title\ntext")).toBe("<h1>Title</h1><p>text</p>");
    expect(legacyToHtml("###### Deep")).toBe("<h3>Deep</h3>");
    expect(legacyToHtml("- a\n- b")).toBe("<ul><li><p>a</p></li><li><p>b</p></li></ul>");
    expect(legacyToHtml("1. a\n2) b")).toBe("<ol><li><p>a</p></li><li><p>b</p></li></ol>");
    expect(legacyToHtml("> quoted")).toBe("<blockquote><p>quoted</p></blockquote>");
    expect(legacyToHtml("---")).toBe("<hr>");
    expect(legacyToHtml("**bold** and *it*")).toBe("<p><strong>bold</strong> and <em>it</em></p>");
  });
  it("only links web addresses", () => {
    expect(legacyToHtml("[site](https://x.com/a?b=1&c=2)")).toBe(`<p><a href="https://x.com/a?b=1&amp;c=2">site</a></p>`);
    expect(legacyToHtml("[x](javascript:alert(1))")).toBe("<p>[x](javascript:alert(1))</p>");
  });
  it("does not mistake arithmetic for italics", () => expect(legacyToHtml("2 * 3 * 4")).toBe("<p>2 * 3 * 4</p>"));
});

describe("toEditorHtml", () => {
  it("leaves HTML alone and converts plain text", () => {
    expect(toEditorHtml("<p>x</p>")).toBe("<p>x</p>");
    expect(toEditorHtml("x")).toBe("<p>x</p>");
  });
});

describe("htmlToText", () => {
  it("separates paragraphs with a blank line and decodes entities", () => {
    expect(htmlToText("<p>Hello <strong>big</strong> world</p><p>Second &amp; last</p>")).toBe("Hello big world\n\nSecond & last");
  });
  it("puts list items on their own lines", () => {
    expect(htmlToText("<ul><li><p>a</p></li><li><p>b</p></li></ul><p>c</p>")).toBe("a\nb\n\nc");
    expect(htmlToText("<ul><li><p>a</p></li><li><p>b</p></li></ul>", { bullets: true })).toBe("- a\n- b");
  });
  it("turns br into a line break", () => expect(htmlToText("<p>a<br>b</p>")).toBe("a\nb"));
  it("drops script content", () => expect(htmlToText("<p>a</p><script>alert(1)</script>")).toBe("a"));
});

describe("countWordsHtml", () => {
  it("counts visible words only", () => expect(countWordsHtml("<p>one <strong>two</strong></p><p>three</p>")).toBe(3));
  it("matches the old count for plain text", () => {
    for (const s of ["", "Hello world.", "Hello world.\n\nSecond para here", "a < b and c > d", "- x\n- y z"]) {
      expect(countWordsHtml(s)).toBe(countWords(s.replace(/^- /gm, "")));
    }
  });
});

describe("portalText", () => {
  it("gives clean plain text with single blank lines", () => {
    expect(portalText("<p>One  </p><p></p><p>Two</p>")).toBe("One\n\nTwo");
  });
  it("optionally straightens quotes", () => {
    expect(portalText("<p>“Hi” it’s me</p>", { straightQuotes: true })).toBe(`"Hi" it's me`);
    expect(portalText("<p>“Hi” it’s me</p>")).toBe("“Hi” it’s me");
  });
  it("keeps list bullets", () => expect(portalText("<ul><li><p>a</p></li></ul>")).toBe("- a"));
});

describe("linkHref", () => {
  it("accepts web and mail addresses and adds https when missing", () => {
    expect(linkHref("https://a.com")).toBe("https://a.com");
    expect(linkHref("example.com/x")).toBe("https://example.com/x");
    expect(linkHref("a@b.co")).toBe("mailto:a@b.co");
    expect(linkHref("mailto:a@b.co")).toBe("mailto:a@b.co");
  });
  it("refuses empty input and other schemes", () => {
    expect(linkHref("  ")).toBeNull();
    expect(linkHref("javascript:alert(1)")).toBeNull();
    expect(linkHref("data:text/html,x")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run tests/lib/rich-text.test.ts`
Expected: FAIL (module `@/lib/rich-text` not found).

- [ ] **Step 4: Write `lib/rich-text.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/lib/rich-text.test.ts`
Expected: all pass. If one fails, decide whether the code or the test has the mistake; fix the code when it breaks a Global Constraint, fix the test only for a plain slip, and say which in the report.

- [ ] **Step 6: Write the failing sanitizer tests**

`tests/lib/rich-text-server.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderRich, sanitizeHtml } from "@/lib/rich-text-server";

describe("sanitizeHtml", () => {
  it("keeps the formatting the editor produces", () => {
    const out = sanitizeHtml('<h2 style="text-align:center">T</h2><p><strong>b</strong><em>i</em><u>u</u><s>s</s></p><ul><li><p>x</p></li></ul><ol><li><p>y</p></li></ol><blockquote><p>q</p></blockquote><hr>');
    for (const piece of ["<h2", "text-align:center", "<strong>b</strong>", "<em>i</em>", "<u>u</u>", "<s>s</s>", "<ul>", "<ol>", "<blockquote>", "<hr"]) expect(out).toContain(piece);
  });
  it("removes scripts and their content", () => {
    const out = sanitizeHtml("<p>hi</p><script>window.__x=1</script>");
    expect(out).toBe("<p>hi</p>");
  });
  it("removes event attributes and images", () => {
    const out = sanitizeHtml('<p onclick="x()">a</p><img src="x" onerror="y()"><svg onload="z()"></svg><iframe src="https://e.com"></iframe>');
    expect(out).toBe("<p>a</p>");
  });
  it("keeps only web and mail links and forces a safe rel", () => {
    const ok = sanitizeHtml('<p><a href="https://x.com/a" onclick="q()">go</a></p>');
    expect(ok).toContain('href="https://x.com/a"');
    expect(ok).toContain('rel="noopener noreferrer nofollow"');
    expect(ok).not.toContain("onclick");
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "vbscript:x"]) {
      const out = sanitizeHtml(`<p><a href="${bad}">x</a></p>`);
      expect(out).not.toMatch(/javascript:|data:|vbscript:/i);
      expect(out).toContain("x");
    }
    expect(sanitizeHtml('<a href="mailto:a@b.co">m</a>')).toContain('href="mailto:a@b.co"');
  });
  it("allows only text-align in styles", () => {
    const out = sanitizeHtml('<p style="color:red;text-align:center;position:fixed">a</p>');
    expect(out).toContain("text-align:center");
    expect(out).not.toMatch(/color|position/);
    expect(sanitizeHtml('<p style="text-align:expression(alert(1))">a</p>')).toBe("<p>a</p>");
  });
  it("closes broken markup and handles upper case tags", () => {
    expect(sanitizeHtml("<P><STRONG>open")).toBe("<p><strong>open</strong></p>");
  });
  it("maps b and i to strong and em", () => expect(sanitizeHtml("<p><b>x</b><i>y</i></p>")).toBe("<p><strong>x</strong><em>y</em></p>"));
  it("keeps entities escaped and handles empty input", () => {
    expect(sanitizeHtml("<p>a &amp; b &lt;c&gt;</p>")).toBe("<p>a &amp; b &lt;c&gt;</p>");
    expect(sanitizeHtml("")).toBe("");
  });
});

describe("renderRich", () => {
  it("converts old plain text and cleans HTML", () => {
    expect(renderRich("Hello\n\nWorld")).toBe("<p>Hello</p><p>World</p>");
    expect(renderRich("<p>a</p><script>x</script>")).toBe("<p>a</p>");
    expect(renderRich("<b>not a block start</b>")).toBe("<p>&lt;b&gt;not a block start&lt;/b&gt;</p>");
  });
});
```

- [ ] **Step 7: Run and confirm failure, then write `lib/rich-text-server.ts`**

Run: `npx vitest run tests/lib/rich-text-server.test.ts` (expected: FAIL, module not found), then create:

```ts
import sanitize from "sanitize-html";
import { toEditorHtml } from "@/lib/rich-text";

// Server-side only: this pulls in the sanitizer library, so never import it from a client component.
const ALIGN = /^(left|center|right|justify)$/;

export function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "s", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "hr", "a"],
    allowedAttributes: { a: ["href", "rel", "target"], p: ["style"], h1: ["style"], h2: ["style"], h3: ["style"] },
    allowedStyles: { "*": { "text-align": [ALIGN] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      b: "strong",
      i: "em",
      strike: "s",
      del: "s",
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...(attribs.href ? { href: attribs.href } : {}), rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
    },
  });
}

// Stored text (HTML or old plain text) as cleaned HTML, ready to show.
export const renderRich = (stored: string) => sanitizeHtml(toEditorHtml(stored));
```

- [ ] **Step 8: Run all tests and the type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. Adjust only where the sanitize-html library's exact output differs in a harmless way (for example `<hr />` spelling); never loosen a security assertion.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/rich-text.ts lib/rich-text-server.ts tests/lib/rich-text.test.ts tests/lib/rich-text-server.test.ts
git commit -m "feat: rich text rules and an allow-list sanitizer with tests"
```

---

### Task 2: Save protection (migration and crash-backup rules)

**Files:**
- Create: `supabase/migrations/0016_statement_body_version.sql`, `supabase/tests/006_statement_body_version.sql`
- Create: `lib/local-backup.ts`, `tests/lib/local-backup.test.ts`, `lib/use-draft-backup.ts`

**Interfaces:**
- Produces: `statements.body_version integer not null default 0`; from `lib/local-backup.ts`: `type Backup = { html: string; savedAt: number; version: number }`, `backupKey(kind: string, id: string): string`, `parseBackup(raw: string | null): Backup | null`, `shouldOfferRestore(b: Backup | null, server: { html: string; version: number }): boolean`; from `lib/use-draft-backup.ts`: `useDraftBackup(kind, id, server: { html: string; version: number })` returning `{ offer: Backup | null; write(html: string, version: number): void; clear(): void }`.

- [ ] **Step 1: Migration and its test**

`supabase/migrations/0016_statement_body_version.sql`:

```sql
-- Counts saves of a statement's text, so two tabs or two people cannot silently overwrite each other.
alter table statements add column body_version integer not null default 0 check (body_version >= 0);
```

`supabase/tests/006_statement_body_version.sql`:

```sql
select 'statement_body_version_column' as name,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'statements' and column_name = 'body_version') as ok;
```

- [ ] **Step 2: Failing tests for the backup rules**

`tests/lib/local-backup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { backupKey, parseBackup, shouldOfferRestore } from "@/lib/local-backup";

describe("backupKey", () => {
  it("is stable per document", () => expect(backupKey("statement", "abc")).toBe("draft:statement:abc"));
});

describe("parseBackup", () => {
  it("reads a valid backup", () => {
    expect(parseBackup(JSON.stringify({ html: "<p>x</p>", savedAt: 5, version: 2 }))).toEqual({ html: "<p>x</p>", savedAt: 5, version: 2 });
  });
  it("returns null for missing or damaged data", () => {
    for (const raw of [null, "", "not json", "{}", JSON.stringify({ html: 1, savedAt: 1, version: 1 }), JSON.stringify({ html: "x", savedAt: "a", version: 1 })]) expect(parseBackup(raw)).toBeNull();
  });
});

describe("shouldOfferRestore", () => {
  const server = { html: "<p>saved</p>", version: 3 };
  it("offers a backup from the same version that differs", () => {
    expect(shouldOfferRestore({ html: "<p>newer</p>", savedAt: 1, version: 3 }, server)).toBe(true);
  });
  it("does not offer an identical backup", () => {
    expect(shouldOfferRestore({ html: "<p>saved</p>", savedAt: 1, version: 3 }, server)).toBe(false);
  });
  it("never offers a backup made against an older version, which would overwrite newer work", () => {
    expect(shouldOfferRestore({ html: "<p>old</p>", savedAt: 1, version: 2 }, server)).toBe(false);
  });
  it("offers nothing without a backup", () => expect(shouldOfferRestore(null, server)).toBe(false));
});
```

- [ ] **Step 3: Run (expect FAIL), then write `lib/local-backup.ts`**

```ts
export type Backup = { html: string; savedAt: number; version: number };

export const backupKey = (kind: string, id: string) => `draft:${kind}:${id}`;

export function parseBackup(raw: string | null): Backup | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.html === "string" && typeof v.savedAt === "number" && typeof v.version === "number") return { html: v.html, savedAt: v.savedAt, version: v.version };
  } catch { /* damaged backup: ignore it */ }
  return null;
}

// A backup is offered only when it was made against the version now on the server, so it can never overwrite newer work.
export function shouldOfferRestore(b: Backup | null, server: { html: string; version: number }): boolean {
  return !!b && b.version === server.version && b.html !== server.html;
}
```

- [ ] **Step 4: Write `lib/use-draft-backup.ts`**

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { backupKey, parseBackup, shouldOfferRestore, type Backup } from "@/lib/local-backup";

// Keeps a copy of unsaved text in this browser. Storage can be missing or full, so every access is guarded.
export function useDraftBackup(kind: string, id: string, server: { html: string; version: number }) {
  const key = backupKey(kind, id);
  const [offer, setOffer] = useState<Backup | null>(null);

  useEffect(() => {
    try {
      const b = parseBackup(localStorage.getItem(key));
      setOffer(shouldOfferRestore(b, server) ? b : null);
    } catch { /* storage unavailable */ }
    // Only on first open: later server changes must not re-offer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const write = useCallback((html: string, version: number) => {
    try { localStorage.setItem(key, JSON.stringify({ html, savedAt: Date.now(), version })); } catch { /* ignore */ }
  }, [key]);
  const clear = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    setOffer(null);
  }, [key]);

  return { offer, write, clear };
}
```

- [ ] **Step 5: Run the tests and the type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit the files**

```bash
git add supabase/migrations/0016_statement_body_version.sql supabase/tests/006_statement_body_version.sql lib/local-backup.ts tests/lib/local-backup.test.ts lib/use-draft-backup.ts
git commit -m "feat: statement save counter and crash-backup rules"
```

- [ ] **Step 7: Back up and apply (done by the controller, who holds the production token and has the user's approval to apply migrations for this work)**

```bash
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:backup
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:migrate -- --production
SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test
```

Expected: `applied 0016_statement_body_version.sql` and `0 failed`.

---

### Task 3: The editor components and the paper look

**Files:**
- Create: `components/rich-editor.tsx`, `components/rich-editor-lazy.tsx`, `components/rich-view.tsx`, `components/paper-textarea.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `toEditorHtml`, `linkHref` from `@/lib/rich-text`.
- Produces: `RichEditor` props `{ value: string; onChange: (html: string) => void; label: string; variant?: "full" | "compact"; placeholder?: string; readOnly?: boolean; minHeight?: string; resetKey?: string | number }` (`onChange` receives `""` for an empty document); `RichEditorLazy` (same props, loaded with `next/dynamic`, no server render); `RichHtml({ html: string; className?: string })` (html must come from `renderRich`); `PaperTextarea` (a `<textarea>` with the paper look; accepts normal textarea props).

- [ ] **Step 1: Verify the TipTap 3 API before writing**

Read `node_modules/@tiptap/starter-kit/dist/index.d.ts` and confirm: which extensions StarterKit includes (expect `bold`, `italic`, `strike`, `underline`, `link`, `heading`, lists, `blockquote`, `horizontalRule`, `undoRedo` or `history`, `code`, `codeBlock`, `dropcursor`, `gapcursor`), and the exact option names for disabling `code`, `codeBlock` and configuring `heading` and `link`. Confirm `Placeholder` is exported from `@tiptap/extensions`. If any name below differs from the installed version, use the installed name and say so in the report.

- [ ] **Step 2: Paper styles**

Append to `app/globals.css`:

```css
/* The writing page: paper on the dark app. */
.paper {
  background: #f6f2e7;
  color: #1d2027;
  border: 1px solid #d8d2c2;
  border-radius: 4px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.25), 0 14px 30px -18px rgba(0, 0, 0, 0.7);
}
.paper-page { padding: 1.25rem 1.25rem 2rem; }
@media (min-width: 640px) { .paper-page { padding: 2.25rem 2.75rem 3rem; } }
textarea.paper { padding: 1.25rem; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.65; }
textarea.paper::placeholder { color: #8c8674; }

.paper-content { font-family: Georgia, 'Times New Roman', serif; font-size: 17px; line-height: 1.7; color: #1d2027; overflow-wrap: anywhere; }
.paper-content:focus, .paper-content .ProseMirror:focus { outline: none; }
.paper-content p { margin: 0 0 0.9em; }
.paper-content h1, .paper-content h2, .paper-content h3 { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; line-height: 1.25; margin: 1.1em 0 0.4em; letter-spacing: 0; }
.paper-content h1 { font-size: 1.6em; }
.paper-content h2 { font-size: 1.35em; }
.paper-content h3 { font-size: 1.15em; }
.paper-content ul, .paper-content ol { margin: 0 0 0.9em; padding-left: 1.5em; }
.paper-content ul { list-style: disc; }
.paper-content ol { list-style: decimal; }
.paper-content li > p { margin: 0 0 0.3em; }
.paper-content blockquote { margin: 0 0 0.9em; padding-left: 1em; border-left: 3px solid #cbb98d; color: #4b4f5a; }
.paper-content hr { border: 0; border-top: 1px solid #cfc8b4; margin: 1.2em 0; }
.paper-content a { color: #8a5a1c; text-decoration: underline; }
.paper-content .ProseMirror-selectednode { outline: 2px solid #c98a3e; }
.paper-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; height: 0; pointer-events: none; color: #8c8674; }
```

- [ ] **Step 3: Read-only view and paper textarea**

`components/rich-view.tsx` (no directive, no sanitizer import):

```tsx
// Shows HTML that has already been cleaned on the server with renderRich() from lib/rich-text-server.
// Never pass it text that has not been through renderRich.
export function RichHtml({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`paper-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
```

`components/paper-textarea.tsx`:

```tsx
import { forwardRef, type TextareaHTMLAttributes } from "react";

// The paper look for plain text, used where the text must stay plain (for example email drafts).
export const PaperTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function PaperTextarea({ className = "", ...rest }, ref) {
  return <textarea ref={ref} className={`paper w-full ${className}`} {...rest} />;
});
```

- [ ] **Step 4: The editor**

`components/rich-editor.tsx`. Requirements, all mandatory:

```tsx
"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import { linkHref, toEditorHtml } from "@/lib/rich-text";

export type RichEditorProps = {
  value: string; onChange: (html: string) => void; label: string;
  variant?: "full" | "compact"; placeholder?: string; readOnly?: boolean; minHeight?: string; resetKey?: string | number;
};
```

1. **Extensions:** `StarterKit` configured with headings levels `[1, 2, 3]`, `code` and `codeBlock` switched off (the sanitizer does not allow them), `link` with `openOnClick: false`, `autolink: true`, protocols `["http", "https", "mailto"]` and `HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" }`; plus `TextAlign.configure({ types: ["heading", "paragraph"] })` and `Placeholder.configure({ placeholder })`. Use the option names confirmed in Step 1.
2. **Editor instance:** `useEditor({ extensions, content: toEditorHtml(value), editable: !readOnly, immediatelyRender: false, editorProps: { attributes: { class: "paper-content", role: "textbox", "aria-multiline": "true", "aria-label": label, style: `min-height:${minHeight ?? "24rem"}` } }, onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()) })`. Until the editor exists, render a paper-styled skeleton of the same minimum height (`<div className="paper paper-page" aria-busy="true">`).
3. **Outside changes:** an effect on `resetKey` (skip the first run) calls `editor.commands.setContent(toEditorHtml(value), { emitUpdate: false })`. An effect on `readOnly` calls `editor.setEditable(!readOnly)`.
4. **State for the toolbar:** `useEditorState({ editor, selector })` returning `{ bold, italic, underline, strike, bullet, ordered, quote, link, left, center, right, block: "p" | "h1" | "h2" | "h3", canUndo, canRedo }` computed from `isActive` / `can()`; the toolbar must re-render when the selection changes.
5. **Toolbar** (`role="toolbar"`, `aria-label="Formatting"`, sticky at the top of the frame, background `bg-surface-raised`, border `border-line`, horizontally scrollable with no wrapping on narrow screens): a paragraph-style `<select>` (Paragraph, Heading 1, Heading 2, Heading 3); buttons Bold `B`, Italic `I`, Underline `U`, Strike `S`, Bullet list, Numbered list, Quote, Divider, Align left, Align centre, Align right, Link, Undo, Redo, Clear formatting (`editor.chain().focus().unsetAllMarks().clearNodes().run()`). The compact variant shows only the paragraph select removed, Bold, Italic, Bullet list, Numbered list, Link. Every button has a visible short label or glyph, `title` and `aria-label` with the shortcut ("Bold (Ctrl+B)"), `aria-pressed` for toggles, `type="button"`, and `onMouseDown={(e) => e.preventDefault()}` so the editor keeps focus. Active buttons are brass; disabled ones dimmed.
6. **Keyboard:** arrow left and right move focus between toolbar controls (roving `tabIndex`: only one control is in the tab order); Escape returns focus to the editor.
7. **Link button:** `window.prompt("Link address", currentHref)`; `const href = linkHref(input)`; empty input removes the link (`unsetLink`), a refused scheme shows nothing and leaves the text unchanged, otherwise `chain().focus().extendMarkRange("link").setLink({ href }).run()`.
8. **Frame:** wrap toolbar and page in `<div className="paper focus-within:ring-1 focus-within:ring-brass">`; the toolbar sits inside the frame above a `<div className="paper-page" onClick={...}>` that focuses the editor when the empty area is clicked. In `readOnly` mode render no toolbar.
9. No `console` output, no `any` types beyond what TipTap's own types require.

`components/rich-editor-lazy.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";
import type { RichEditorProps } from "@/components/rich-editor";

// The editor is large; load it only on pages that edit.
export const RichEditorLazy = dynamic<RichEditorProps>(() => import("@/components/rich-editor").then((m) => m.RichEditor), {
  ssr: false,
  loading: () => <div className="paper paper-page" style={{ minHeight: "24rem" }} aria-busy="true" />,
});
```

- [ ] **Step 5: Type-check and run the tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean. (Behaviour is checked in the browser in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add components/rich-editor.tsx components/rich-editor-lazy.tsx components/rich-view.tsx components/paper-textarea.tsx app/globals.css
git commit -m "feat: Word-style editor, paper look, read-only view and paper textarea"
```

---

### Task 4: Use the editor for statements, with safe saves

**Files:**
- Modify: `app/(app)/materials/statement-actions.ts`
- Modify: `app/(app)/materials/statements/[id]/page.tsx`
- Modify: `components/statement-editor.tsx`

**Interfaces:**
- Consumes: `countWordsHtml` from `@/lib/rich-text`; `sanitizeHtml`, `renderRich` from `@/lib/rich-text-server`; `useDraftBackup`; `RichEditorLazy`; `RichHtml`.
- Produces: `type SaveResult = { ok: true; words: number; version: number } | { ok: false; reason: "stale" | "error"; message: string }`; `saveStatementBody(id: string, body: string, baseVersion: number): Promise<SaveResult>`; `restoreSnapshot(snapshotId: string): Promise<{ body: string; words: number; version: number }>`; `EditorStatement.body_version: number`; `EditorSnapshot.html: string` (already cleaned).

- [ ] **Step 1: Actions**

In `app/(app)/materials/statement-actions.ts`:
1. Replace the `countWords` import from `@/lib/research` with `import { countWordsHtml, toEditorHtml } from "@/lib/rich-text";` and add `import { sanitizeHtml } from "@/lib/rich-text-server";`.
2. In `createStatement`, change `words: countWords(body)` to `words: countWordsHtml(body)`.
3. Replace `saveStatementBody` with:

```ts
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
```

4. Replace `restoreSnapshot` with a version that also protects and reports the version:

```ts
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
```


- [ ] **Step 2: Page**

In `app/(app)/materials/statements/[id]/page.tsx` (read it first): add `body_version` to the statement select; import `renderRich` from `@/lib/rich-text-server`; when building the snapshots prop, add `html: renderRich(s.body)` to each; pass `body_version` inside the statement prop. Keep everything else as is.

- [ ] **Step 3: Editor component**

In `components/statement-editor.tsx`:
1. Types: `EditorStatement` gains `body_version: number`; `EditorSnapshot` gains `html: string`.
2. Imports: remove `countWords`; add `import { countWordsHtml } from "@/lib/rich-text"; import { RichEditorLazy } from "@/components/rich-editor-lazy"; import { RichHtml } from "@/components/rich-view"; import { useDraftBackup } from "@/lib/use-draft-backup"; import { toEditorHtml } from "@/lib/rich-text";`.
3. State: `text` now holds HTML (initial `statement.body`); add `const version = useRef(statement.body_version)`, `const [resetKey, setResetKey] = useState(0)`, and extend `saveState` with `"conflict"`. `const backup = useDraftBackup("statement", statement.id, { html: statement.body, version: statement.body_version })`.
4. Autosave effect: after 1.5 s call `const r = await saveStatementBody(statement.id, text, version.current)`; on `r.ok` set `version.current = r.version`, `unsaved.current = false`, `setSaveState("saved")`, `backup.clear()`; on `r.reason === "stale"` set `"conflict"` and stop (no further autosave until reload); on other failure set `"error"`. While `saveState === "conflict"` the effect must not save again. Each keystroke also calls `backup.write(text, version.current)` (before the debounce). The unmount save uses `version.current` and ignores the result.
5. Editor: replace the `<textarea>` with `<RichEditorLazy value={text} onChange={setText} label="Statement text" variant="full" placeholder="Write here. It saves on its own." resetKey={resetKey} />`. Word count: `const words = countWordsHtml(text)`. The `first` ref logic must still skip the initial mount (the editor's first `onChange` must not mark the text dirty: only call `setText` from `onChange` when the html differs from the current `text`).
6. Versions: "Save a version" first saves the latest text with `saveStatementBody(..., version.current)` and handles the result like the autosave (stale: stop and show the conflict message instead of saving a version); the view of a version becomes `<RichHtml html={s.html} className="paper paper-page max-h-72 overflow-auto mt-2" />`; `restoreSnapshot` result sets `text = r.body`, `version.current = r.version`, bumps `resetKey`, `unsaved.current = false`, `backup.clear()`.
7. Backup banner (above the editor, only when `backup.offer`): "We found changes from {time} on this device that were never saved. Restore them?" with buttons "Restore" (`setText(offer.html); setResetKey(k => k + 1); backup.clear()`) and "Discard" (`backup.clear()`).
8. Conflict banner (when `saveState === "conflict"`): "This was changed somewhere else, so your last edits were not saved. Copy your text, then reload to see the latest." with buttons "Copy my text" (copies the plain text of `text`, using `htmlToText` from `@/lib/rich-text`, in try/catch) and "Reload" (`router.refresh()` is not enough: use `window.location.reload()`). The editor content stays as typed.
9. The save label text for `"conflict"`: "Not saved: changed elsewhere".

- [ ] **Step 4: Type-check, test, lint the touched files**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean. Also run `npx next lint --file components/statement-editor.tsx --file "app/(app)/materials/statement-actions.ts"` and fix any new errors (warnings that were already there may stay).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/materials/statement-actions.ts" "app/(app)/materials/statements/[id]/page.tsx" components/statement-editor.tsx
git commit -m "feat: statements use the Word-style editor with atomic saves and crash backup"
```

---

### Task 5: End-to-end check in the browser

**Files:** none (verification only). Create `ZZTEMP` data, then delete it.

- [ ] **Step 1: Build and start**

Run `npm run build` first and confirm it succeeds (TipTap must not break server rendering); then start the dev server with the preview tool.

- [ ] **Step 2: Typing and formatting**

Create a general statement of purpose (Statements tab). Type a paragraph in the editor; use the toolbar and shortcuts: select text and press Ctrl+B, Ctrl+I, Ctrl+U; choose "Heading 2" from the style list; make a bullet list and a numbered list; add a quote; align a paragraph centre; add a link (override `window.prompt` to return `example.com`; expect `https://example.com`) and try `javascript:alert(1)` (expect no link). Expected: each applies, the toolbar buttons show pressed state, the word count updates live, and after about 2 seconds the label shows "Saved".

- [ ] **Step 3: Persistence and format**

Reload the page. Expected: the formatting is still there. Read the stored `body` with a query: it is HTML using only allowed tags, and `words` equals the visible word count.

- [ ] **Step 4: Old plain text**

Insert (query) a statement with plain body `Line one\n\n# Heading\n- a\n- b\n**bold** text` and body_version 0; open it. Expected: it shows a heading, a two-item bullet list and bold text; the word count is unchanged by opening it; after a small edit and autosave the stored body is HTML.

- [ ] **Step 5: Safety**

Set a statement's stored body (query) to `<p>hi</p><script>window.__x=1</script><img src=x onerror="window.__x=2">`, save a version from it via the app, open the statement and expand that version. Expected: `window.__x` is `undefined` after opening the editor and viewing the version, and the version shows only "hi". Paste test: dispatch a paste event carrying `<p style="color:red;font-family:Comic Sans">pasted</p><script>window.__y=1</script>` into the editor; expected: text appears as plain formatting with no colour or font, `window.__y` undefined, and after autosave the stored body has no `<script>` or `style` other than text-align.

- [ ] **Step 6: Crash backup and stale edits**

Backup: write `localStorage["draft:statement:<id>"]` with `{ html: "<p>ZZTEMP unsaved</p>", savedAt: Date.now(), version: <current body_version> }`, reload: the banner offers it; "Restore" puts it in the editor and autosaves; repeat and choose "Discard": the banner goes and the key is removed. Also set the key with an older `version`: no banner. Stale: with the editor open, bump `body_version` by a query, then type: expected the label becomes "Not saved: changed elsewhere", the conflict banner appears, the typed text is still in the editor, "Copy my text" is available, and a later reload shows the newer server text.

- [ ] **Step 7: Versions and restore**

Save a version, change the text, restore the version: the editor shows the version's formatted text, a "Before restoring an older version" entry exists, and typing afterwards saves without a false conflict.

- [ ] **Step 8: Phone width and keyboard**

At width 375 the toolbar scrolls sideways, is not cut off, and the page is readable with no horizontal page scroll. With the keyboard: Tab reaches the toolbar, arrow keys move between its controls, Escape returns to the text. Take one screenshot at 375 and one at desktop width as evidence.

- [ ] **Step 9: Clean up**

Delete every `ZZTEMP` statement (and the test statements made in Steps 4 and 5) through the app's "Delete this statement" button or a query, clear the test `localStorage` keys, and confirm with a query that `statements` and `statement_snapshots` contain no test rows and the user's real rows are unchanged.

- [ ] **Step 10: Final suite and commit any fixes**

Run: `npm run typecheck && npm test && SUPABASE_PROJECT_REF=yzbpaoknnzdtrvowbvum npm run db:test && npm run build`
Expected: all pass, `0 failed`. Commit any defect fixed during the browser check with a message describing it.

---

## Acceptance checklist

- [ ] Migration 0016 is applied on production and `db:test` reports `0 failed`.
- [ ] `npm run typecheck`, `npm test` and `npm run build` pass.
- [ ] Statements are written in a Word-style editor with the toolbar, shortcuts and paper look; formatting persists across reloads.
- [ ] Stored text is HTML using only allowed tags; scripts, event attributes, images, odd links and other styles never survive save or display.
- [ ] Old plain-text statements open correctly formatted and keep the same word count.
- [ ] Unsaved text survives a crash on the same device and is offered back; a backup made against an older version is never offered.
- [ ] An edit made elsewhere is never silently overwritten: the editor stops saving, keeps the user's text and explains.
- [ ] The toolbar works from the keyboard and at phone width.
- [ ] No test data remains.

## What comes next

Plan 2 (statement tooling): character limit, metrics, writing hints, focus mode, version compare and the Word, PDF and portal exports. Plan 3 (rollout and polish): research writing, journal and notes on the editor, the paper textarea for email drafts, Letters additions, and the audit, empty-state, mobile and lint pass. Known follow-up for plan 3: the older statement and letter actions throw errors whose messages production builds hide; they should return result objects like `saveStatementBody` does.
