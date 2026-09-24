import { describe, it, expect } from "vitest";
import { wrapMigration, assertSafeToApply } from "../../scripts/lib/migrations.mjs";

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
