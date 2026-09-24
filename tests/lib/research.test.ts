import { describe, expect, it } from "vitest";
import { countWords, daysBetween, formatMinutes, kindLabel, relative } from "@/lib/research";
import { summarizeProjectWeek, type ProjectWeek } from "@/lib/research-week";

describe("countWords", () => {
  it("is zero for blank text", () => { expect(countWords("")).toBe(0); expect(countWords("   ")).toBe(0); });
  it("splits on any whitespace", () => expect(countWords("one two  three\nfour")).toBe(4));
});

describe("formatMinutes", () => {
  it.each([[45, "45m"], [60, "1h"], [90, "1h 30m"], [125, "2h 5m"]])("%i -> %s", (m, s) => expect(formatMinutes(m)).toBe(s));
});

describe("relative and daysBetween", () => {
  it.each([[0, "today"], [1, "tomorrow"], [-1, "yesterday"], [-3, "3d overdue"], [5, "in 5d"]])("%i -> %s", (d, s) => expect(relative(d)).toBe(s));
  it("counts days", () => expect(daysBetween("2026-09-24", "2026-10-01")).toBe(7));
});

describe("kindLabel", () => {
  it("labels known kinds and falls back to the key", () => {
    expect(kindLabel("coding")).toBe("Coding");
    expect(kindLabel("mystery")).toBe("mystery");
  });
});

const week = (over: Partial<ProjectWeek> = {}): ProjectWeek => ({
  id: "p1", title: "Project", status: "active", minutes: 0, prevMinutes: 0, entryCount: 0, byKind: [], byPerson: [],
  finished: [], started: [], running: 0, meetings: [], tasksDone: 0, papersAdded: 0, filesAdded: 0, linksAdded: 0,
  sectionsEdited: 0, words: 0, targetWords: 0, upcoming: [], ...over,
});

describe("summarizeProjectWeek", () => {
  it("describes time with the change against the week before", () => {
    const lines = summarizeProjectWeek(
      week({ minutes: 510, prevMinutes: 120, entryCount: 3, byKind: [{ kind: "experiment", minutes: 240 }, { kind: "coding", minutes: 180 }, { kind: "reading", minutes: 90 }] }),
      true
    );
    expect(lines[0]).toEqual({ k: "Time", v: "8h 30m across 3 entries (+6h 30m vs the week before). Experiment 4h, Coding 3h, Reading 1h 30m" });
  });

  it("hides current-state lines for a past week", () => {
    const r = week({ running: 2, words: 500, targetWords: 1000, upcoming: [{ label: "X", date: "2026-10-05", days: 4, href: "/" }] });
    expect(summarizeProjectWeek(r, true)).toEqual([]);
  });

  it("shows current-state lines for the current week", () => {
    const r = week({ running: 2, words: 500, targetWords: 1000, upcoming: [{ label: "X", date: "2026-10-05", days: 4, href: "/" }] });
    const keys = summarizeProjectWeek(r, false).map((l) => l.k);
    expect(keys).toEqual(["Still running", "Writing", "Next"]);
  });
});
