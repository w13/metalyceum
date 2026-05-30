import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  clampNum,
  sanitizeColor,
  deriveSourceType,
  parseVideoInput,
  parseOptionalVideoInput,
  parseStartTime,
  parseDurationMinutes,
  parseWorldAssets,
  parseWorldAssetDefinition,
  MAX_DURATION_MINUTES
} from "./validation";

describe("sanitizeText", () => {
  it("strips control characters but keeps printable content", () => {
    expect(sanitizeText("ab\x00\x07\x1Fcd\x7F", 50)).toBe("abcd");
  });
  it("trims surrounding whitespace", () => {
    expect(sanitizeText("   hi   ", 50)).toBe("hi");
  });
  it("caps to maxLen", () => {
    expect(sanitizeText("abcdefghij", 4)).toBe("abcd");
  });
  it("returns empty string for non-strings", () => {
    expect(sanitizeText(123, 50)).toBe("");
    expect(sanitizeText(null, 50)).toBe("");
    expect(sanitizeText(undefined, 50)).toBe("");
    expect(sanitizeText({}, 50)).toBe("");
  });
  it("does not interpret HTML — payload survives only as literal text", () => {
    const payload = '<img src=x onerror=alert(1)>';
    expect(sanitizeText(payload, 280)).toBe(payload); // sanitization is the renderer's job; server only caps/strips control chars
  });
});

describe("clampNum", () => {
  it("passes in-range finite numbers through", () => {
    expect(clampNum(5, 0, 10, -1)).toBe(5);
  });
  it("clamps to bounds", () => {
    expect(clampNum(-50, -10, 10, 0)).toBe(-10);
    expect(clampNum(999, -10, 10, 0)).toBe(10);
  });
  it("rejects NaN/Infinity with the fallback", () => {
    expect(clampNum(NaN, -10, 10, 3)).toBe(3);
    expect(clampNum(Infinity, -10, 10, 3)).toBe(3);
    expect(clampNum(-Infinity, -10, 10, 3)).toBe(3);
  });
  it("rejects non-numbers (e.g. numeric strings) with the fallback", () => {
    expect(clampNum("5", -10, 10, 7)).toBe(7);
    expect(clampNum(null, -10, 10, 7)).toBe(7);
    expect(clampNum(undefined, -10, 10, 7)).toBe(7);
  });
});

describe("sanitizeColor", () => {
  it("accepts a valid #rrggbb color", () => {
    expect(sanitizeColor("#aabbcc")).toBe("#aabbcc");
    expect(sanitizeColor("#AABBCC")).toBe("#AABBCC");
  });
  it("rejects CSS/JS injection attempts with the fallback", () => {
    expect(sanitizeColor("red;background:url(x)")).toBe("#3b82f6");
    expect(sanitizeColor('"><script>')).toBe("#3b82f6");
    expect(sanitizeColor("#fff")).toBe("#3b82f6");        // shorthand not allowed
    expect(sanitizeColor("#gggggg")).toBe("#3b82f6");      // non-hex
  });
  it("rejects non-strings and honors a custom fallback", () => {
    expect(sanitizeColor(123)).toBe("#3b82f6");
    expect(sanitizeColor(null, "#000000")).toBe("#000000");
  });
});

describe("deriveSourceType", () => {
  it("classifies empty / youtube / meet", () => {
    expect(deriveSourceType("")).toBe("none");
    expect(deriveSourceType("dQw4w9WgXcQ")).toBe("youtube");
    expect(deriveSourceType("https://meet.google.com/abc-defg-hij")).toBe("meet");
  });
});

describe("parseVideoInput", () => {
  it("accepts a bare 11-char YouTube ID", () => {
    expect(parseVideoInput("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts the id from youtube.com/watch and youtu.be URLs", () => {
    expect(parseVideoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
  });
  it("normalizes meet URLs and drops query/fragment", () => {
    expect(parseVideoInput("https://meet.google.com/abc-defg-hij?authuser=0#x")).toBe("https://meet.google.com/abc-defg-hij");
    expect(parseVideoInput("meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
  });
  it("rejects XSS, javascript:, spoofed hosts, and malformed ids", () => {
    expect(parseVideoInput('"><img src=x onerror=alert(1)>')).toBeNull();
    expect(parseVideoInput("javascript:alert(1)")).toBeNull();
    expect(parseVideoInput("https://evil.com/meet.google.com")).toBeNull();
    expect(parseVideoInput("https://meet.google.com.evil.com/x")).toBeNull(); // spoofed subdomain
    expect(parseVideoInput("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseVideoInput("tooLongVideoId12345")).toBeNull();
    expect(parseVideoInput("")).toBeNull();
    expect(parseVideoInput(null)).toBeNull();
    expect(parseVideoInput(42)).toBeNull();
  });
});

describe("parseOptionalVideoInput", () => {
  it("treats empty/whitespace as an explicit clear", () => {
    expect(parseOptionalVideoInput("")).toBe("");
    expect(parseOptionalVideoInput("   ")).toBe("");
  });
  it("validates non-empty input like parseVideoInput", () => {
    expect(parseOptionalVideoInput("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseOptionalVideoInput("not a video")).toBeNull();
  });
  it("rejects non-strings", () => {
    expect(parseOptionalVideoInput(null)).toBeNull();
    expect(parseOptionalVideoInput(5)).toBeNull();
  });
});

describe("parseStartTime", () => {
  it("accepts a valid time within the allowed window (ISO normalized)", () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(parseStartTime(soon)).toBe(soon);
  });
  it("treats null/empty/undefined as 'no start time'", () => {
    expect(parseStartTime(null)).toBeNull();
    expect(parseStartTime("")).toBeNull();
    expect(parseStartTime(undefined)).toBeNull();
  });
  it("rejects unparseable strings and non-strings", () => {
    expect(parseStartTime("not a date")).toBeNull();
    expect(parseStartTime(123456)).toBeNull();
  });
  it("rejects times outside the sane window", () => {
    const tooOld = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const tooFar = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(parseStartTime(tooOld)).toBeNull();
    expect(parseStartTime(tooFar)).toBeNull();
  });
});

describe("parseDurationMinutes", () => {
  it("rounds and passes valid durations", () => {
    expect(parseDurationMinutes(90, 0)).toBe(90);
    expect(parseDurationMinutes(90.4, 0)).toBe(90);
  });
  it("clamps to [0, MAX_DURATION_MINUTES]", () => {
    expect(parseDurationMinutes(-30, 0)).toBe(0);
    expect(parseDurationMinutes(99999, 0)).toBe(MAX_DURATION_MINUTES);
  });
  it("falls back for non-numbers / NaN", () => {
    expect(parseDurationMinutes("60", 15)).toBe(15);
    expect(parseDurationMinutes(NaN, 15)).toBe(15);
    expect(parseDurationMinutes(null, 15)).toBe(15);
  });
});

const assetLimits = {
  worldLimit: 80,
  yMin: -10,
  yMax: 40,
  roomCount: 8,
  maxAssets: 3
};

describe("parseWorldAssetDefinition", () => {
  const validAsset = {
    id: "asset_123456",
    type: "tree",
    x: 12.34567,
    y: 0,
    z: -5.4321,
    rotationY: Math.PI,
    scale: 1.25,
    roomId: -1
  };

  it("accepts and rounds a valid placed asset", () => {
    expect(parseWorldAssetDefinition(validAsset, assetLimits)).toEqual({
      id: "asset_123456",
      type: "tree",
      x: 12.346,
      y: 0,
      z: -5.432,
      rotationY: 3.14159,
      scale: 1.25,
      roomId: -1
    });
  });

  it("rejects unknown asset types and invalid ids", () => {
    expect(parseWorldAssetDefinition({ ...validAsset, type: "dragon" }, assetLimits)).toBeNull();
    expect(parseWorldAssetDefinition({ ...validAsset, id: "<script>" }, assetLimits)).toBeNull();
    expect(parseWorldAssetDefinition({ ...validAsset, id: "short" }, assetLimits)).toBeNull();
  });

  it("rejects invalid transforms and scope", () => {
    expect(parseWorldAssetDefinition({ ...validAsset, x: Infinity }, assetLimits)).toBeNull();
    expect(parseWorldAssetDefinition({ ...validAsset, z: 81 }, assetLimits)).toBeNull();
    expect(parseWorldAssetDefinition({ ...validAsset, y: 41 }, assetLimits)).toBeNull();
    expect(parseWorldAssetDefinition({ ...validAsset, scale: 0.1 }, assetLimits)).toBeNull();
    expect(parseWorldAssetDefinition({ ...validAsset, scale: 4 }, assetLimits)).toBeNull();
    expect(parseWorldAssetDefinition({ ...validAsset, roomId: 8 }, assetLimits)).toBeNull();
  });
});

describe("parseWorldAssets", () => {
  const makeAsset = (id: string) => ({
    id,
    type: "bench",
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
    scale: 1,
    roomId: 0
  });

  it("accepts an array of valid assets", () => {
    expect(parseWorldAssets([makeAsset("asset_1111"), makeAsset("asset_2222")], assetLimits)).toHaveLength(2);
  });

  it("rejects duplicate ids, non-arrays, and oversized arrays", () => {
    expect(parseWorldAssets("nope", assetLimits)).toBeNull();
    expect(parseWorldAssets([makeAsset("asset_1111"), makeAsset("asset_1111")], assetLimits)).toBeNull();
    expect(parseWorldAssets([
      makeAsset("asset_1111"),
      makeAsset("asset_2222"),
      makeAsset("asset_3333"),
      makeAsset("asset_4444")
    ], assetLimits)).toBeNull();
  });
});
