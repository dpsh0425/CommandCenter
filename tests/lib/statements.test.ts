import { describe, expect, it } from "vitest";
import {
  contentDisposition, defaultTitle, exportFileName, hasFinalStatement, isStatementKind, isStatementStatus, limitParts, limitState, statementKindLabel, statusChange, worstState,
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

describe("limitParts and worstState", () => {
  it("returns a part for each limit that is set", () => {
    expect(limitParts({ words: 500, characters: 3000 }, { wordLimit: null, charLimit: null })).toEqual([]);
    const parts = limitParts({ words: 460, characters: 5100 }, { wordLimit: 500, charLimit: 5000 });
    expect(parts).toEqual([
      { unit: "words", used: 460, limit: 500, state: "near", over: 0 },
      { unit: "characters", used: 5100, limit: 5000, state: "over", over: 100 },
    ]);
  });
  it("shows the worst state", () => {
    expect(worstState([])).toBe("none");
    expect(worstState([{ state: "ok" }, { state: "near" }])).toBe("near");
    expect(worstState([{ state: "near" }, { state: "over" }, { state: "ok" }])).toBe("over");
  });
});

describe("exportFileName and contentDisposition", () => {
  it("builds a safe file name from the title and school", () => {
    expect(exportFileName("Statement of purpose: MIT", "MIT", "docx")).toBe("Statement of purpose MIT.docx");
    expect(exportFileName("Personal statement", "Yale", "docx")).toBe("Personal statement - Yale.docx");
    expect(exportFileName("Personal statement", null, "docx")).toBe("Personal statement.docx");
    expect(exportFileName('a/b\\c*d?"e', null, "docx")).toBe("a b c d e.docx");
    expect(exportFileName("   ", null, "docx")).toBe("Statement.docx");
    expect(exportFileName("x".repeat(300), null, "docx").length).toBe(125);
  });
  it("gives a header that survives non-ASCII names", () => {
    expect(contentDisposition("Résumé.docx")).toBe(`attachment; filename="R_sum_.docx"; filename*=UTF-8''R%C3%A9sum%C3%A9.docx`);
    expect(contentDisposition('a"b.docx')).toBe(`attachment; filename="ab.docx"; filename*=UTF-8''a%22b.docx`);
  });
});
