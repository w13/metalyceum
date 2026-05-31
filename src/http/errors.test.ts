import { describe, expect, it } from "vitest";
import { errorEnvelope, errorJson } from "./errors";

describe("errorEnvelope", () => {
  it("builds the baseline error shape", () => {
    expect(errorEnvelope("Bad input")).toEqual({
      ok: false,
      error: "Bad input",
    });
  });

  it("includes request metadata when provided", () => {
    expect(errorEnvelope("Internal server error", {
      requestId: "req_123",
      details: { endpoint: "/api/v1/admin/world" },
    })).toEqual({
      ok: false,
      error: "Internal server error",
      requestId: "req_123",
      details: { endpoint: "/api/v1/admin/world" },
    });
  });
});

describe("errorJson", () => {
  it("returns an application/json response with the error envelope", async () => {
    const response = errorJson("Unauthorized", 401, { requestId: "req_456" });
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
      requestId: "req_456",
    });
  });
});
