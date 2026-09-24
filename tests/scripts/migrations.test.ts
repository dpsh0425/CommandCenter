import { describe, it, expect } from "vitest";
import { wrapMigration, assertSafeToApply, parseArgs, assertTargetAllowed, assertBaselineAllowed } from "../../scripts/lib/migrations.mjs";

describe("wrapMigration", () => {
  it("wraps in begin/commit with the sql before the record insert", () => {
    const out = wrapMigration("create table t (a int);", "0001_x.sql");
    expect(out.startsWith("begin;")).toBe(true);
    expect(out.endsWith("commit;")).toBe(true);
    expect(out.indexOf("create table t (a int);")).toBeLessThan(out.indexOf("insert into public._applied_migrations"));
    expect(out).toBe("begin;\ncreate table t (a int);\n;\ninsert into public._applied_migrations (name) values ('0001_x.sql');\ncommit;");
  });
  it("doubles single quotes in the file name", () => {
    expect(wrapMigration("select 1;", "a'b.sql")).toContain("values ('a''b.sql')");
  });
});

describe("assertSafeToApply", () => {
  const msg = "This project already has tables but no migration records. If its migrations were applied by hand, run with --baseline first.";
  it("throws when tables exist but nothing is recorded", () => {
    expect(() => assertSafeToApply({ baseline: false, recordedCount: 0, existingTableCount: 5 })).toThrow(msg);
  });
  it("passes in baseline mode", () => {
    expect(assertSafeToApply({ baseline: true, recordedCount: 0, existingTableCount: 5 })).toBeUndefined();
  });
  it("passes when migrations are recorded", () => {
    expect(assertSafeToApply({ baseline: false, recordedCount: 3, existingTableCount: 5 })).toBeUndefined();
  });
  it("passes on an empty project", () => {
    expect(assertSafeToApply({ baseline: false, recordedCount: 0, existingTableCount: 0 })).toBeUndefined();
  });
});

describe("parseArgs", () => {
  it("returns all false with no arguments", () => {
    expect(parseArgs([])).toEqual({ baseline: false, production: false, force: false });
  });
  it("reads each flag", () => {
    expect(parseArgs(["--baseline", "--production", "--force"])).toEqual({ baseline: true, production: true, force: true });
    expect(parseArgs(["--production"])).toEqual({ baseline: false, production: true, force: false });
  });
  it("rejects an unknown option such as a typo", () => {
    expect(() => parseArgs(["--basline"])).toThrow("Unknown option: --basline");
  });
});

describe("assertTargetAllowed", () => {
  const msg = "Refusing to run against the production project (prod) without --production.";
  it("refuses production without the flag", () => {
    expect(() => assertTargetAllowed({ ref: "prod", productionRef: "prod", production: false })).toThrow(msg);
  });
  it("allows production with the flag", () => {
    expect(assertTargetAllowed({ ref: "prod", productionRef: "prod", production: true })).toBeUndefined();
  });
  it("allows another project without the flag", () => {
    expect(assertTargetAllowed({ ref: "stg", productionRef: "prod", production: false })).toBeUndefined();
  });
});

describe("assertBaselineAllowed", () => {
  const msg = "Some migrations are already recorded on this project. --baseline would also mark any newer, unapplied migrations as applied. Add --force only if you are sure every unrecorded file was applied by hand.";
  it("refuses baseline when some are recorded and no force", () => {
    expect(() => assertBaselineAllowed({ baseline: true, recordedCount: 2, force: false })).toThrow(msg);
  });
  it("allows baseline with force", () => {
    expect(assertBaselineAllowed({ baseline: true, recordedCount: 2, force: true })).toBeUndefined();
  });
  it("allows baseline when nothing is recorded", () => {
    expect(assertBaselineAllowed({ baseline: true, recordedCount: 0, force: false })).toBeUndefined();
  });
  it("ignores plain mode", () => {
    expect(assertBaselineAllowed({ baseline: false, recordedCount: 2, force: false })).toBeUndefined();
  });
});
