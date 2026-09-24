import { describe, expect, it } from "vitest";
import { decodeEntities, extractPageTitle, isPublicHost, metaTag } from "@/lib/web-meta";

describe("isPublicHost", () => {
  it.each(["example.com", "arxiv.org", "sub.domain.co.uk", "8.8.8.8"])("allows %s", (h) => expect(isPublicHost(h)).toBe(true));

  it.each([
    "localhost", "app.localhost", "printer.local", "db.internal",
    "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0",
    "[::1]", "::1", "fe80::1",
    "2130706433", "0x7f000001", "127.1", "300.1.1.1", "1.2.3",
  ])("refuses %s", (h) => expect(isPublicHost(h)).toBe(false));

  it("allows a public address just outside the private 172 range", () => {
    expect(isPublicHost("172.15.0.1")).toBe(true);
    expect(isPublicHost("172.32.0.1")).toBe(true);
  });
});

describe("extractPageTitle", () => {
  it("prefers the Open Graph title", () => {
    const html = `<html><head><title>Fallback</title><meta property="og:title" content="Real &amp; Good"></head></html>`;
    expect(extractPageTitle(html)).toBe("Real & Good");
  });
  it("falls back to the twitter title, then the title tag", () => {
    expect(extractPageTitle(`<meta name="twitter:title" content="Tweet title"><title>T</title>`)).toBe("Tweet title");
    expect(extractPageTitle(`<html><title>  Plain
      title </title></html>`)).toBe("Plain title");
  });
  it("returns null when there is no title", () => expect(extractPageTitle("<html><body>hi</body></html>")).toBeNull());
});

describe("metaTag and decodeEntities", () => {
  it("reads a meta tag whichever way round its attributes are", () => {
    expect(metaTag(`<meta content="Hello" property="og:description">`, "og:description")).toBe("Hello");
  });
  it("decodes the common entities and collapses whitespace", () => {
    expect(decodeEntities("a &lt;b&gt;  &quot;c&quot; &#39;d&#39;")).toBe(`a <b> "c" 'd'`);
  });
});
