import { isTag, isText, type ChildNode, type Element } from "domhandler";
import { parseDocument } from "htmlparser2";
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun, type ParagraphChild,
} from "docx";

// Server-only: turns already-cleaned statement HTML into a real Word file (Times New Roman 12 pt, 1 inch margins).
// The HTML is expected to come from sanitizeHtml, so only the tags the editor can produce are handled.

const FONT = "Times New Roman";
const LEVELS = 4;

type Fmt = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean; link?: boolean };
type Desc = {
  runs: ParagraphChild[]; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; heading?: 1 | 2 | 3;
  level?: number; ordered?: boolean; listId?: number; bullet?: boolean; quote?: boolean; rule?: boolean;
};

function alignOf(el: Element) {
  const m = /text-align:\s*(left|center|right|justify)/i.exec(el.attribs.style ?? "");
  if (!m) return undefined;
  const v = m[1].toLowerCase();
  return v === "center" ? AlignmentType.CENTER : v === "right" ? AlignmentType.RIGHT : v === "justify" ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;
}

const run = (text: string, f: Fmt) =>
  new TextRun({
    text, font: FONT, bold: f.bold, italics: f.italics, strike: f.strike,
    underline: f.underline || f.link ? {} : undefined, color: f.link ? "0563C1" : undefined,
  });

function inline(nodes: ChildNode[], f: Fmt): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const n of nodes) {
    if (isText(n)) { if (n.data) out.push(run(n.data, f)); continue; }
    if (!isTag(n) || n.name === "script" || n.name === "style") continue;
    if (n.name === "strong" || n.name === "b") out.push(...inline(n.children, { ...f, bold: true }));
    else if (n.name === "em" || n.name === "i") out.push(...inline(n.children, { ...f, italics: true }));
    else if (n.name === "u") out.push(...inline(n.children, { ...f, underline: true }));
    else if (n.name === "s") out.push(...inline(n.children, { ...f, strike: true }));
    else if (n.name === "br") out.push(new TextRun({ break: 1, font: FONT }));
    else if (n.name === "a" && n.attribs.href) {
      const kids = inline(n.children, { ...f, link: true }).filter((c): c is TextRun => c instanceof TextRun);
      if (kids.length) out.push(new ExternalHyperlink({ link: n.attribs.href, children: kids }));
    } else out.push(...inline(n.children, f));
  }
  return out;
}

let listCounter = 0;

function blocks(nodes: ChildNode[], ctx: { level: number; ordered: boolean; listId: number; inList: boolean; quote: boolean }): Desc[] {
  const out: Desc[] = [];
  const base = { level: ctx.inList ? ctx.level : undefined, ordered: ctx.ordered, listId: ctx.listId, quote: ctx.quote };
  for (const n of nodes) {
    if (isText(n)) {
      if (n.data.trim()) out.push({ ...base, runs: [run(n.data, {})] });
      continue;
    }
    if (!isTag(n) || n.name === "script" || n.name === "style") continue;
    if (n.name === "p") out.push({ ...base, runs: inline(n.children, {}), align: alignOf(n) });
    else if (n.name === "h1" || n.name === "h2" || n.name === "h3") out.push({ runs: inline(n.children, {}), align: alignOf(n), heading: Number(n.name[1]) as 1 | 2 | 3 });
    else if (n.name === "ul" || n.name === "ol") {
      const listId = ++listCounter;
      const level = ctx.inList ? Math.min(ctx.level + 1, LEVELS - 1) : 0;
      for (const li of n.children.filter(isTag).filter((c) => c.name === "li")) {
        const own = blocks(li.children, { level, ordered: n.name === "ol", listId, inList: true, quote: false });
        const first = own.find((d) => d.level === level && !d.rule);
        if (first) first.bullet = true;
        out.push(...own);
      }
    } else if (n.name === "blockquote") out.push(...blocks(n.children, { ...ctx, quote: true }));
    else if (n.name === "hr") out.push({ runs: [], rule: true });
    else if (n.name === "br") continue;
    else out.push(...blocks(n.children, ctx));
  }
  return out;
}

function toParagraph(d: Desc): Paragraph {
  if (d.rule) return new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } }, spacing: { after: 160 } });
  const level = d.level ?? 0;
  return new Paragraph({
    children: d.runs,
    heading: d.heading ? [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][d.heading - 1] : undefined,
    alignment: d.align,
    numbering: d.bullet ? { reference: d.ordered ? "number" : "bullet", level, ...(d.ordered ? { instance: d.listId } : {}) } : undefined,
    indent: d.level !== undefined && !d.bullet ? { left: 720 * (level + 1) } : d.quote ? { left: 720 } : undefined,
    spacing: { after: d.level !== undefined ? 60 : 160, line: 276 },
  });
}

const levelsFor = (format: (typeof LevelFormat)[keyof typeof LevelFormat], text: (l: number) => string) =>
  Array.from({ length: LEVELS }, (_, level) => ({
    level, format, text: text(level), alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));

export async function buildDocx(html: string, opts: { title: string }): Promise<Buffer> {
  listCounter = 0;
  const descs = blocks(parseDocument(html).children, { level: 0, ordered: false, listId: 0, inList: false, quote: false });
  const paragraphs = descs.length ? descs.map(toParagraph) : [new Paragraph({ children: [] })];
  const doc = new Document({
    title: opts.title,
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
      paragraphStyles: [1, 2, 3].map((n) => ({
        id: `Heading${n}`, name: `Heading ${n}`, basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: [32, 28, 24][n - 1], bold: true, color: "000000" },
        paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
      })),
    },
    numbering: {
      config: [
        { reference: "bullet", levels: levelsFor(LevelFormat.BULLET, (l) => ["•", "◦", "▪", "•"][l]) },
        { reference: "number", levels: levelsFor(LevelFormat.DECIMAL, (l) => `%${l + 1}.`) },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: paragraphs }],
  });
  return Packer.toBuffer(doc);
}
