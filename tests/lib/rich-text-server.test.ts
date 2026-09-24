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
