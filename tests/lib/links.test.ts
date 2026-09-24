import { describe, expect, it } from "vitest";
import { hostOf, normalizeUrl, parseArxivId, parseGithubRepo } from "@/lib/links";

describe("normalizeUrl", () => {
  it("adds https to a bare address", () => expect(normalizeUrl("github.com/x/y")).toBe("https://github.com/x/y"));
  it("rejects non-http schemes, dotless hosts and blanks", () => {
    expect(normalizeUrl("ftp://x.com")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("parseGithubRepo", () => {
  it("reads owner and repo", () => expect(parseGithubRepo("https://github.com/octocat/Hello-World")).toEqual({ owner: "octocat", repo: "Hello-World" }));
  it("strips .git", () => expect(parseGithubRepo("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" }));
  it("ignores profiles and reserved paths", () => {
    expect(parseGithubRepo("https://github.com/octocat")).toBeNull();
    expect(parseGithubRepo("https://github.com/orgs/x")).toBeNull();
  });
});

describe("parseArxivId", () => {
  it("drops the version from an abstract link", () => expect(parseArxivId("https://arxiv.org/abs/1706.03762v5")).toBe("1706.03762"));
  it("reads a PDF link", () => expect(parseArxivId("https://arxiv.org/pdf/1706.03762.pdf")).toBe("1706.03762"));
  it("ignores other sites", () => expect(parseArxivId("https://example.com/abs/1")).toBeNull());
});

describe("hostOf", () => {
  it("removes www", () => expect(hostOf("https://www.example.com/x")).toBe("example.com"));
});
