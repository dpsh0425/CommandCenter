import { describe, expect, it } from "vitest";
import { textMetrics } from "@/lib/text-metrics";

describe("textMetrics", () => {
  it("is all zero for empty text", () => {
    expect(textMetrics("")).toEqual({ words: 0, characters: 0, charactersNoSpaces: 0, paragraphs: 0, readingMinutes: 0 });
  });
  it("counts words, characters and paragraphs of formatted text", () => {
    const m = textMetrics("<p>Hello <strong>big</strong> world</p><p>Second one</p>");
    expect(m.words).toBe(5);
    expect(m.paragraphs).toBe(2);
    // "Hello big world" (15) + one paragraph break (1) + "Second one" (10)
    expect(m.characters).toBe(26);
    expect(m.charactersNoSpaces).toBe(22);
  });
  it("counts old plain text the same way", () => {
    expect(textMetrics("Hello world.\n\nSecond para").words).toBe(4);
  });
  it("rounds reading time at 200 words a minute, with a one minute floor", () => {
    expect(textMetrics(`<p>${"word ".repeat(10)}</p>`).readingMinutes).toBe(1);
    expect(textMetrics(`<p>${"word ".repeat(450)}</p>`).readingMinutes).toBe(2);
    expect(textMetrics(`<p>${"word ".repeat(1000)}</p>`).readingMinutes).toBe(5);
  });
  it("does not count markup or entities as characters", () => {
    expect(textMetrics("<p>a &amp; b</p>").characters).toBe(5);
  });
});
