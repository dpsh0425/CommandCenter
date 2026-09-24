import { describe, expect, it } from "vitest";
import { backupKey, parseBackup, shouldOfferRestore } from "@/lib/local-backup";

describe("backupKey", () => {
  it("is stable per document", () => expect(backupKey("statement", "abc")).toBe("draft:statement:abc"));
});

describe("parseBackup", () => {
  it("reads a valid backup", () => {
    expect(parseBackup(JSON.stringify({ html: "<p>x</p>", savedAt: 5, version: 2 }))).toEqual({ html: "<p>x</p>", savedAt: 5, version: 2 });
  });
  it("returns null for missing or damaged data", () => {
    for (const raw of [null, "", "not json", "{}", JSON.stringify({ html: 1, savedAt: 1, version: 1 }), JSON.stringify({ html: "x", savedAt: "a", version: 1 })]) expect(parseBackup(raw)).toBeNull();
  });
});

describe("shouldOfferRestore", () => {
  const server = { html: "<p>saved</p>", version: 3 };
  it("offers a backup from the same version that differs", () => {
    expect(shouldOfferRestore({ html: "<p>newer</p>", savedAt: 1, version: 3 }, server)).toBe(true);
  });
  it("does not offer an identical backup", () => {
    expect(shouldOfferRestore({ html: "<p>saved</p>", savedAt: 1, version: 3 }, server)).toBe(false);
  });
  it("never offers a backup made against an older version, which would overwrite newer work", () => {
    expect(shouldOfferRestore({ html: "<p>old</p>", savedAt: 1, version: 2 }, server)).toBe(false);
  });
  it("offers nothing without a backup", () => expect(shouldOfferRestore(null, server)).toBe(false));
});
