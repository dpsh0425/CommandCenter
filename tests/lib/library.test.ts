import { describe, expect, it } from "vitest";
import { guessKind, parseTags, previewKind } from "@/lib/library";

describe("previewKind", () => {
  const cases: Array<[string, string | null, string]> = [
    ["a.pdf", null, "pdf"], ["x.PNG", null, "image"], ["clip.mp4", null, "video"], ["song.mp3", null, "audio"],
    ["README.md", null, "markdown"], ["data.csv", null, "csv"], ["cfg.json", null, "json"], ["nb.ipynb", null, "notebook"],
    ["script.py", null, "text"], ["notes", "text/plain", "text"], ["archive.zip", "application/zip", "none"], ["deck.pptx", null, "none"],
  ];
  it.each(cases)("%s (%s) previews as %s", (name, mime, expected) => expect(previewKind(name, mime)).toBe(expected));
});

describe("guessKind", () => {
  const cases: Array<[string, string]> = [
    ["paper.pdf", "paper"], ["data.csv", "data"], ["run.ipynb", "code"], ["fig.png", "figure"],
    ["talk.pptx", "slides"], ["notes.md", "notes"], ["weird.xyz", "other"],
  ];
  it.each(cases)("%s is guessed as %s", (name, expected) => expect(guessKind(name)).toBe(expected));
});

describe("parseTags", () => {
  it("lowercases, trims, drops empties and duplicates, keeping first-seen order", () => {
    expect(parseTags(" Foo, bar\nfoo ,, Baz ")).toEqual(["foo", "bar", "baz"]);
  });
  it("returns an empty list for blank input", () => expect(parseTags("  ,  ")).toEqual([]));
});
