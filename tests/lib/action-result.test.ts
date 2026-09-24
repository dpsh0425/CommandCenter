import { afterEach, describe, expect, it, vi } from "vitest";
import { UserError, fail, isFailure, ok, toResult } from "@/lib/action-result";

afterEach(() => vi.restoreAllMocks());

describe("toResult", () => {
  it("wraps a value", async () => expect(await toResult(async () => 5)).toEqual({ ok: true, data: 5 }));
  it("passes the message of an expected problem through", async () => {
    expect(await toResult(async () => { throw new UserError("This school already has one."); })).toEqual({ ok: false, message: "This school already has one." });
  });
  it("hides the message of an unexpected error and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await toResult(async () => { throw new Error("relation \"secret\" does not exist"); });
    expect(r).toEqual({ ok: false, message: "Something went wrong. Please try again." });
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("helpers", () => {
  it("builds results", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    expect(fail("no")).toEqual({ ok: false, message: "no" });
  });
  it("recognises a failure result and nothing else", () => {
    expect(isFailure({ ok: false, message: "x" })).toBe(true);
    for (const v of [null, undefined, 0, "x", { ok: true, data: 1 }, { ok: false }, { message: "x" }]) expect(isFailure(v)).toBe(false);
  });
});
