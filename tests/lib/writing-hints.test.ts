import { describe, expect, it } from "vitest";
import { writingHints } from "@/lib/writing-hints";

const sentence = (n: number) => `${Array.from({ length: n }, (_, i) => `w${i}`).join(" ")}.`;

describe("writingHints", () => {
  it("has nothing to say about empty or tidy text", () => {
    expect(writingHints("")).toEqual([]);
    expect(writingHints("<p>I study graphs. My work covers routing. Networks fascinate me. We publish often.</p>")).toEqual([]);
  });
  it("flags a sentence over 40 words but not one of exactly 40", () => {
    expect(writingHints(`<p>${sentence(41)}</p>`).map((h) => h.kind)).toEqual(["long_sentence"]);
    expect(writingHints(`<p>${sentence(40)}</p>`)).toEqual([]);
  });
  it("quotes the start of a long sentence and says how long it is", () => {
    const h = writingHints(`<p>${sentence(45)}</p>`)[0];
    expect(h.message).toContain("45-word");
    expect(h.example?.startsWith("w0 w1 w2")).toBe(true);
  });
  it("flags many sentences starting with the same word", () => {
    const html = "<p>I built a tool. I tested it. I shared the results. Others reviewed them.</p>";
    const h = writingHints(html).find((x) => x.kind === "same_start");
    expect(h?.message).toBe('3 of 4 sentences start with "I".');
  });
  it("needs at least four sentences before judging sentence starts", () => {
    expect(writingHints("<p>I built a tool. I tested it. I shared it.</p>").some((h) => h.kind === "same_start")).toBe(false);
  });
  it("flags a distinctive word repeated three times within two sentences", () => {
    const h = writingHints("<p>The research shaped my research goals. Later research grew.</p>").find((x) => x.kind === "repeated_word");
    expect(h?.message).toBe('"research" is used 3 times within two sentences.');
  });
  it("ignores common and short words", () => {
    expect(writingHints("<p>The team and the group and the lab met. The team and the group and the lab left.</p>").some((h) => h.kind === "repeated_word")).toBe(false);
  });
  it("reports each repeated word once and caps the list", () => {
    const many = Array.from({ length: 20 }, () => sentence(45)).join(" ");
    expect(writingHints(`<p>${many}</p>`).length).toBeLessThanOrEqual(8);
  });
});
