import { describe, expect, it } from "vitest";
import { OPTIONAL_ENV, REQUIRED_ENV, missingEnv } from "@/lib/env";

describe("missingEnv", () => {
  it("lists names that are unset or empty", () => {
    expect(missingEnv(["A", "B", "C"], { A: "x", B: "", C: undefined })).toEqual(["B", "C"]);
  });
  it("returns nothing when all are set", () => expect(missingEnv(["A"], { A: "x" })).toEqual([]));
});

describe("env lists", () => {
  it("never lists a name twice", () => {
    const all = [...REQUIRED_ENV, ...OPTIONAL_ENV];
    expect(new Set(all).size).toBe(all.length);
  });
  it("requires the three Supabase variables", () => {
    expect(REQUIRED_ENV).toEqual(expect.arrayContaining(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]));
  });
});
