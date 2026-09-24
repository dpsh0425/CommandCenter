import { describe, expect, it } from "vitest";
import {
  defaultTitle, hasFinalStatement, isStatementKind, isStatementStatus, limitState, statementKindLabel, statusChange,
} from "@/lib/statements";

describe("limitState", () => {
  it("has no state without a limit", () => {
    expect(limitState(500, null)).toBe("none");
    expect(limitState(0, 0)).toBe("none");
  });
  it("is ok below 90 percent of the limit", () => expect(limitState(449, 500)).toBe("ok"));
  it("is near from 90 percent up to and including the limit", () => {
    expect(limitState(450, 500)).toBe("near");
    expect(limitState(500, 500)).toBe("near");
  });
  it("is over above the limit", () => expect(limitState(501, 500)).toBe("over"));
  it("rounds the 90 percent line up", () => {
    expect(limitState(9, 10)).toBe("near");
    expect(limitState(8, 10)).toBe("ok");
  });
});

describe("statusChange", () => {
  it("records today when a statement is first marked sent", () => {
    expect(statusChange("sent", "2026-10-01", null)).toEqual({ status: "sent", sent_on: "2026-10-01" });
  });
  it("keeps the original sent date when marked sent again", () => {
    expect(statusChange("sent", "2026-10-05", "2026-10-01")).toEqual({ status: "sent", sent_on: "2026-10-01" });
  });
  it("clears the sent date when moved back to final or draft", () => {
    expect(statusChange("final", "2026-10-05", "2026-10-01")).toEqual({ status: "final", sent_on: null });
    expect(statusChange("draft", "2026-10-05", "2026-10-01")).toEqual({ status: "draft", sent_on: null });
  });
});

describe("hasFinalStatement", () => {
  it("counts a final or sent statement of purpose", () => {
    expect(hasFinalStatement([{ kind: "statement_of_purpose", status: "final" }])).toBe(true);
    expect(hasFinalStatement([{ kind: "statement_of_purpose", status: "sent" }])).toBe(true);
  });
  it("ignores drafts and other kinds", () => {
    expect(hasFinalStatement([{ kind: "statement_of_purpose", status: "draft" }])).toBe(false);
    expect(hasFinalStatement([{ kind: "research_statement", status: "final" }])).toBe(false);
    expect(hasFinalStatement([])).toBe(false);
  });
});

describe("kinds, statuses and titles", () => {
  it("recognises valid values only", () => {
    expect(isStatementKind("statement_of_purpose")).toBe(true);
    expect(isStatementKind("essay")).toBe(false);
    expect(isStatementStatus("final")).toBe(true);
    expect(isStatementStatus("done")).toBe(false);
  });
  it("labels kinds and falls back to the key", () => {
    expect(statementKindLabel("research_statement")).toBe("Research statement");
    expect(statementKindLabel("mystery")).toBe("mystery");
  });
  it("builds default titles", () => {
    expect(defaultTitle("statement_of_purpose")).toBe("Statement of purpose (general draft)");
    expect(defaultTitle("statement_of_purpose", "Stanford University")).toBe("Statement of purpose: Stanford University");
  });
});
