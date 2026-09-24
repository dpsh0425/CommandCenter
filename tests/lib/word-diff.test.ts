import { describe, expect, it } from "vitest";
import { wordDiff } from "@/lib/word-diff";

describe("wordDiff", () => {
  it("returns one unchanged part for identical text", () => {
    expect(wordDiff("a b c", "a b c")).toEqual([{ type: "same", text: "a b c" }]);
  });
  it("marks removed and added words", () => {
    expect(wordDiff("a b c", "a x c")).toEqual([
      { type: "same", text: "a" }, { type: "del", text: "b" }, { type: "add", text: "x" }, { type: "same", text: "c" },
    ]);
  });
  it("handles insertions and deletions at the ends", () => {
    expect(wordDiff("b c", "a b c d")).toEqual([
      { type: "add", text: "a" }, { type: "same", text: "b c" }, { type: "add", text: "d" },
    ]);
    expect(wordDiff("a b c", "b")).toEqual([{ type: "del", text: "a" }, { type: "same", text: "b" }, { type: "del", text: "c" }]);
  });
  it("ignores differences in whitespace", () => expect(wordDiff("a  b\n\nc", "a b c")).toEqual([{ type: "same", text: "a b c" }]));
  it("handles empty sides", () => {
    expect(wordDiff("", "a b")).toEqual([{ type: "add", text: "a b" }]);
    expect(wordDiff("a b", "")).toEqual([{ type: "del", text: "a b" }]);
    expect(wordDiff("", "")).toEqual([]);
  });
  it("falls back to whole-text replacement for very long inputs instead of freezing", () => {
    const big = (p: string) => Array.from({ length: 3000 }, (_, i) => `${p}${i}`).join(" ");
    const parts = wordDiff(big("a"), big("b"));
    expect(parts.map((p) => p.type)).toEqual(["del", "add"]);
  });
});
