import { describe, expect, it } from "vitest";
import { assess, buildItems, daysBetween, type ReadinessSchool } from "@/lib/readiness";

const TODAY = "2026-10-01";
const school = (over: Partial<ReadinessSchool> = {}): ReadinessSchool => ({
  id: "s1", name: "Test U", deadline_date: "2026-10-10", status: "researching",
  gre_policy: null, english_test: null, letters_required: null, sop_version_id: null, ...over,
});

describe("daysBetween", () => {
  it("counts whole days", () => expect(daysBetween("2026-10-01", "2026-10-10")).toBe(9));
  it("is negative for past dates", () => expect(daysBetween("2026-10-10", "2026-10-01")).toBe(-9));
});

describe("buildItems", () => {
  it("lists only the items that apply to the school", () => {
    const keys = buildItems(school(), [], {}).map((i) => i.key);
    expect(keys).toEqual(["portal", "resume", "transcripts", "sop", "fee", "submitted"]);
  });

  it("adds letters, GRE and English test when the school requires them", () => {
    const keys = buildItems(school({ gre_policy: "required", english_test: "TOEFL", letters_required: 3 }), [], {}).map((i) => i.key);
    expect(keys).toEqual(["portal", "resume", "transcripts", "sop", "letters", "gre", "english", "fee", "submitted"]);
  });

  it("counts confirmed and submitted letters only", () => {
    const items = buildItems(
      school({ letters_required: 3 }),
      [{ status: "confirmed" }, { status: "submitted" }, { status: "asked" }],
      {}
    );
    const letters = items.find((i) => i.key === "letters")!;
    expect(letters.label).toBe("Recommendation letters (2 of 3 confirmed)");
    expect(letters.done).toBe(false);
  });

  it("marks letters done when all required letters are confirmed", () => {
    const items = buildItems(school({ letters_required: 2 }), [{ status: "confirmed" }, { status: "confirmed" }], {});
    expect(items.find((i) => i.key === "letters")!.done).toBe(true);
  });

  it("derives statement and submitted from school state, and manual items from checks", () => {
    const items = buildItems(school({ sop_version_id: "v1", status: "submitted" }), [], { portal: true });
    const done = (k: string) => items.find((i) => i.key === k)!.done;
    expect(done("sop")).toBe(true);
    expect(done("submitted")).toBe(true);
    expect(done("portal")).toBe(true);
    expect(done("resume")).toBe(false);
  });
});

describe("assess", () => {
  const run = (over: Partial<ReadinessSchool>, checks: Record<string, boolean> = {}) => {
    const s = school(over);
    return assess(s, buildItems(s, [], checks), TODAY);
  };

  it("is urgent within 14 days with anything pending", () => expect(run({ deadline_date: "2026-10-10" }).risk).toBe("urgent"));
  it("says watch within 35 days with three or more items pending", () => expect(run({ deadline_date: "2026-10-30" }).risk).toBe("watch"));
  it("is ok when the deadline is far away", () => expect(run({ deadline_date: "2026-12-01" }).risk).toBe("ok"));
  it("is overdue after the deadline", () => expect(run({ deadline_date: "2026-09-20" }).risk).toBe("overdue"));
  it("has no date risk without a deadline", () => expect(run({ deadline_date: null }).risk).toBe("nodate"));
  it("is submitted regardless of pending items", () => expect(run({ status: "submitted" }).risk).toBe("submitted"));

  it("counts done items out of the total, excluding the submitted step", () => {
    const r = run({}, { portal: true, resume: true });
    expect(r.total).toBe(5);
    expect(r.doneCount).toBe(2);
    expect(r.pending.map((p) => p.key)).toEqual(["transcripts", "sop", "fee"]);
  });
});

describe("buildItems statement rule", () => {
  const done = (over: Partial<ReadinessSchool>) => buildItems(school(over), [], {}).find((i) => i.key === "sop")!.done;

  it("is done when the school has a final or sent statement", () => expect(done({ has_statement: true })).toBe(true));
  it("is not done without a statement or a legacy record", () => expect(done({ has_statement: false })).toBe(false));
  it("still counts the legacy recorded statement", () => expect(done({ sop_version_id: "v1" })).toBe(true));
  it("points at the Statements tab when not done", () => {
    const item = buildItems(school(), [], {}).find((i) => i.key === "sop")!;
    expect(item.hint).toBe("Mark your statement Final in Materials, Statements");
  });
});
