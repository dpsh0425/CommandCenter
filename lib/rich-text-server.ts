import sanitize from "sanitize-html";
import { htmlToText, toEditorHtml } from "@/lib/rich-text";

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

// Text from a form or an editor, cleaned for storing. Null when nothing visible is left, so an empty editor never
// saves "<p></p>".
export function cleanRichBody(stored: string | null | undefined): string | null {
  if (!stored || !stored.trim()) return null;
  const clean = sanitizeHtml(toEditorHtml(stored));
  return htmlToText(clean).trim() ? clean : null;
}
