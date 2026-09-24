import { describe, expect, it } from "vitest";
import {
  askedUpdate, buildReminderEmail, buildRequestEmail, buildThankYouEmail, chaseReason, daysBetween, groupByRecommender,
  isLetterStatus, letterFlags, letterStatusChange, lettersToChase, mailtoUrl, openLetterCount, remindedUpdate,
  type LetterRecord,
} from "@/lib/letters";

const TODAY = "2026-10-20";
const base: LetterRecord = {
  id: "l1", school_id: "s1", school_name: "MIT", recommender_id: "r1", recommender_name: "Dr. Rao", recommender_email: "rao@uni.edu",
  status: "asked", letter_deadline: null, asked_on: null, last_reminded_on: null, reminder_count: 0, received_on: null,
};
const L = (o: Partial<LetterRecord>): LetterRecord => ({ ...base, ...o });

describe("daysBetween", () => {
  it("counts whole days, forwards and back", () => {
    expect(daysBetween("2026-10-20", "2026-10-30")).toBe(10);
    expect(daysBetween("2026-10-30", "2026-10-20")).toBe(-10);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });
  it("is not thrown off by clock changes", () => expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2));
});

describe("isLetterStatus", () => {
  it("accepts the four statuses only", () => {
    expect(isLetterStatus("asked")).toBe(true);
    expect(isLetterStatus("done")).toBe(false);
  });
});

describe("letterFlags", () => {
  it("has no flags once submitted", () => expect(letterFlags(L({ status: "submitted", letter_deadline: "2026-10-01" }), TODAY)).toEqual([]));
  it("flags an overdue letter", () => expect(letterFlags(L({ status: "confirmed", letter_deadline: "2026-10-19" }), TODAY)).toEqual(["overdue"]));
  it("does not flag overdue on the deadline day itself", () => expect(letterFlags(L({ status: "confirmed", letter_deadline: TODAY }), TODAY)).toEqual([]));
  it("flags a not-asked letter with a deadline within 45 days", () => {
    expect(letterFlags(L({ status: "not_asked", letter_deadline: "2026-12-04" }), TODAY)).toEqual(["not_asked"]);
    expect(letterFlags(L({ status: "not_asked", letter_deadline: "2026-12-05" }), TODAY)).toEqual([]);
  });
  it("does not flag a not-asked letter without a deadline", () => expect(letterFlags(L({ status: "not_asked" }), TODAY)).toEqual([]));
  it("flags a reminder when the last contact was 10 or more days ago", () => {
    expect(letterFlags(L({ asked_on: "2026-10-10" }), TODAY)).toEqual(["needs_reminder"]);
    expect(letterFlags(L({ asked_on: "2026-10-11" }), TODAY)).toEqual([]);
  });
  it("counts from the last reminder when there is one", () => {
    expect(letterFlags(L({ asked_on: "2026-09-01", last_reminded_on: "2026-10-15" }), TODAY)).toEqual([]);
  });
  it("flags a reminder when asked and the deadline is within 14 days", () => {
    expect(letterFlags(L({ asked_on: "2026-10-19", letter_deadline: "2026-11-03" }), TODAY)).toEqual(["needs_reminder"]);
    expect(letterFlags(L({ asked_on: "2026-10-19", letter_deadline: "2026-11-04" }), TODAY)).toEqual([]);
  });
  it("does not nag when asked with no dates at all", () => expect(letterFlags(L({}), TODAY)).toEqual([]));
  it("does not ask for a reminder once confirmed", () => {
    expect(letterFlags(L({ status: "confirmed", asked_on: "2026-09-01", letter_deadline: "2026-10-25" }), TODAY)).toEqual([]);
  });
  it("can be overdue and needing a reminder at once", () => {
    expect(letterFlags(L({ asked_on: "2026-09-01", letter_deadline: "2026-10-01" }), TODAY)).toEqual(["overdue", "needs_reminder"]);
  });
});

describe("lettersToChase", () => {
  const list = [
    L({ id: "a", status: "not_asked", letter_deadline: "2026-11-10" }),
    L({ id: "b", status: "asked", asked_on: "2026-10-01" }),
    L({ id: "c", status: "confirmed", letter_deadline: "2026-10-10" }),
    L({ id: "d", status: "submitted", letter_deadline: "2026-10-01" }),
  ];
  it("lists overdue first, then by deadline, using the most urgent flag", () => {
    const r = lettersToChase(list, TODAY);
    expect(r.map((x) => [x.letter.id, x.flag])).toEqual([["c", "overdue"], ["a", "not_asked"], ["b", "needs_reminder"]]);
  });
  it("words the reasons", () => {
    const r = lettersToChase(list, TODAY);
    expect(r[0].reason).toBe("deadline passed 10 days ago");
    expect(r[1].reason).toBe("not asked yet, due in 21 days");
    expect(r[2].reason).toBe("asked 19 days ago, no reply recorded");
  });
  it("words a reminder that is about the deadline", () => {
    expect(chaseReason(L({ asked_on: "2026-10-19", letter_deadline: "2026-10-27" }), "needs_reminder", TODAY)).toBe("asked 1 day ago, due in 7 days");
  });
});

describe("openLetterCount and groupByRecommender", () => {
  it("counts letters that are not submitted", () => {
    expect(openLetterCount([{ status: "asked" }, { status: "submitted" }, { status: "not_asked" }])).toBe(2);
  });
  it("groups by recommender, flagged first, and marks heavy load at six open letters", () => {
    const many = Array.from({ length: 6 }, (_, i) => L({ id: `m${i}`, recommender_id: "r2", recommender_name: "Prof. Busy", school_name: `S${i}` }));
    const flagged = L({ id: "f", recommender_id: "r3", recommender_name: "Zed", status: "confirmed", letter_deadline: "2026-10-01" });
    const groups = groupByRecommender([...many, flagged, L({ id: "q" })], TODAY);
    expect(groups.map((g) => g.name)).toEqual(["Zed", "Dr. Rao", "Prof. Busy"]);
    expect(groups.find((g) => g.name === "Prof. Busy")).toMatchObject({ open: 6, heavy: true });
    expect(groups.find((g) => g.name === "Dr. Rao")).toMatchObject({ open: 1, heavy: false });
  });
  it("keeps letters without a recommender together", () => {
    const g = groupByRecommender([L({ id: "x", recommender_id: null, recommender_name: "Unknown recommender", recommender_email: null })], TODAY);
    expect(g).toHaveLength(1);
    expect(g[0].id).toBeNull();
  });
});

describe("email drafts", () => {
  const two = [{ school_name: "MIT", letter_deadline: "2026-12-01" }, { school_name: "Stanford", letter_deadline: null }];
  it("drafts a request listing every school", () => {
    const d = buildRequestEmail("Dr. Rao", two, "Sam Lee");
    expect(d.subject).toBe("Recommendation letter requests (2 programs)");
    expect(d.body).toContain("Dear Dr. Rao,");
    expect(d.body).toContain("- MIT (due December 1, 2026)");
    expect(d.body).toContain("- Stanford\n");
    expect(d.body.trim().endsWith("Sam Lee")).toBe(true);
  });
  it("names the school in the subject for a single request", () => {
    expect(buildRequestEmail("Dr. Rao", [two[0]], "").subject).toBe("Recommendation letter request: MIT");
  });
  it("signs off without a name when none is given", () => {
    expect(buildRequestEmail("Dr. Rao", two, "  ").body.trim().endsWith("Thank you for considering this,")).toBe(true);
  });
  it("drafts a reminder and a thank-you", () => {
    expect(buildReminderEmail("Dr. Rao", [two[0]], "Sam").subject).toBe("Gentle reminder: recommendation letter for MIT");
    expect(buildReminderEmail("Dr. Rao", two, "Sam").subject).toBe("Gentle reminder: recommendation letters");
    const t = buildThankYouEmail("Dr. Rao", two, "Sam");
    expect(t.subject).toBe("Thank you for your recommendation");
    expect(t.body).toContain("Thank you for submitting");
  });
});

describe("mailtoUrl", () => {
  const d = { subject: "Hi & bye", body: "Line one\nLine two" };
  it("builds an encoded link", () => {
    expect(mailtoUrl("rao@uni.edu", d)).toBe("mailto:rao@uni.edu?subject=Hi%20%26%20bye&body=Line%20one%0ALine%20two");
  });
  it("returns null without a usable address", () => {
    expect(mailtoUrl(null, d)).toBeNull();
    expect(mailtoUrl("not-an-address", d)).toBeNull();
  });
  it("returns null when the link would be too long", () => {
    expect(mailtoUrl("rao@uni.edu", { subject: "s", body: "x".repeat(2000) })).toBeNull();
  });
});

describe("date updates", () => {
  it("records the asked date and receipt when the status moves forward", () => {
    expect(letterStatusChange("asked", "2026-10-20", { asked_on: null, received_on: null })).toEqual({ status: "asked", asked_on: "2026-10-20", received_on: null });
    expect(letterStatusChange("submitted", "2026-10-25", { asked_on: "2026-10-01", received_on: null })).toEqual({ status: "submitted", asked_on: "2026-10-01", received_on: "2026-10-25" });
  });
  it("keeps the first dates and clears receipt when moved back", () => {
    expect(letterStatusChange("confirmed", "2026-10-26", { asked_on: "2026-10-01", received_on: "2026-10-25" })).toEqual({ status: "confirmed", asked_on: "2026-10-01", received_on: null });
    expect(letterStatusChange("not_asked", "2026-10-26", { asked_on: "2026-10-01", received_on: null })).toEqual({ status: "not_asked", asked_on: null, received_on: null });
  });
  it("marks as asked only once and moves a not-asked letter to asked", () => {
    expect(askedUpdate({ status: "not_asked", asked_on: null }, "2026-10-20")).toEqual({ status: "asked", asked_on: "2026-10-20" });
    expect(askedUpdate({ status: "confirmed", asked_on: "2026-10-01" }, "2026-10-20")).toEqual({ status: "confirmed", asked_on: "2026-10-01" });
  });
  it("marks as reminded with a date and a running count", () => {
    expect(remindedUpdate({ reminder_count: 1 }, "2026-10-20")).toEqual({ last_reminded_on: "2026-10-20", reminder_count: 2 });
  });
});
