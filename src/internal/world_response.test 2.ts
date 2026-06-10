import { describe, expect, it } from "vitest";
import { isInternalWorldResponse } from "./world_response";

describe("isInternalWorldResponse", () => {
  it("accepts objects with boolean ok", () => {
    expect(isInternalWorldResponse({ ok: true })).toBe(true);
    expect(isInternalWorldResponse({ ok: false, data: { count: 1 } })).toBe(true);
  });

  it("rejects values without a boolean ok field", () => {
    expect(isInternalWorldResponse(null)).toBe(false);
    expect(isInternalWorldResponse("x")).toBe(false);
    expect(isInternalWorldResponse({})).toBe(false);
    expect(isInternalWorldResponse({ ok: "true" })).toBe(false);
  });
});
