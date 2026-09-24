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
