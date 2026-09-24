import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocx } from "@/lib/statement-docx";

async function parts(html: string) {
  const zip = await JSZip.loadAsync(await buildDocx(html, { title: "T" }));
  const read = async (p: string) => (await zip.file(p)?.async("string")) ?? "";
  const doc = await read("word/document.xml");
  return {
    doc,
    styles: await read("word/styles.xml"),
    numbering: await read("word/numbering.xml"),
    rels: await read("word/_rels/document.xml.rels"),
    text: (doc.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("|"),
  };
}

describe("buildDocx", () => {
  it("writes the text of each paragraph in order", async () => {
    expect((await parts("<p>First paragraph</p><p>Second one</p>")).text).toBe("First paragraph|Second one");
  });
  it("keeps inline formatting", async () => {
    const { doc } = await parts("<p><strong>b</strong><em>i</em><u>u</u><s>s</s></p>");
    expect(doc).toMatch(/<w:b\b/);
    expect(doc).toMatch(/<w:i\b/);
    expect(doc).toMatch(/<w:u\b/);
    expect(doc).toMatch(/<w:strike\b/);
  });
  it("uses heading styles and alignment", async () => {
    const { doc } = await parts('<h2 style="text-align:center">Title</h2><p style="text-align:right">r</p>');
    expect(doc).toContain('<w:pStyle w:val="Heading2"/>');
    expect(doc).toContain('<w:jc w:val="center"/>');
    expect(doc).toContain('<w:jc w:val="right"/>');
  });
  it("turns lists into numbered paragraphs, including nested ones", async () => {
    const { doc, numbering, text } = await parts("<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul><ol><li><p>first</p></li></ol>");
    expect((doc.match(/<w:numPr>/g) ?? []).length).toBe(4);
    expect(numbering.length).toBeGreaterThan(0);
    expect(text).toBe("one|nested|two|first");
  });
  it("makes real hyperlinks", async () => {
    const { doc, rels } = await parts('<p>see <a href="https://example.com/x">the site</a></p>');
    expect(doc).toContain("<w:hyperlink");
    expect(rels).toContain("https://example.com/x");
  });
  it("keeps quotes and dividers", async () => {
    const { text, doc } = await parts("<blockquote><p>quoted</p></blockquote><hr><p>after</p>");
    expect(text).toBe("quoted|after");
    expect(doc).toContain("<w:pBdr>");
  });
  it("never writes script or style content", async () => {
    const { text } = await parts("<p>safe</p><script>alert(1)</script><style>p{}</style>");
    expect(text).toBe("safe");
  });
  it("sets Times New Roman 12 pt and one inch margins", async () => {
    const { doc, styles } = await parts("<p>x</p>");
    expect(styles).toContain("Times New Roman");
    expect(styles).toMatch(/<w:sz w:val="24"\/>/);
    expect(doc).toMatch(/<w:pgMar[^>]*w:top="1440"/);
    expect(doc).toMatch(/<w:pgMar[^>]*w:left="1440"/);
  });
  it("makes a valid file from empty text", async () => {
    const { doc } = await parts("");
    expect(doc).toContain("<w:body>");
  });
  it("starts with the zip signature", async () => {
    const buf = await buildDocx("<p>x</p>", { title: "T" });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});
