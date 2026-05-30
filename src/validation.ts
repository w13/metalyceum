// Pure server-side validation/sanitization helpers for the Metalyceum world.
// Kept free of any `cloudflare:workers` imports so they can be unit-tested in a
// plain Node/Vitest environment, and reused across the Durable Object handlers.

export type RoomSourceType = "none" | "youtube" | "meet";

export const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const MAX_DURATION_MINUTES = 24 * 60;

// Coerce to a string, strip control characters, trim, and cap length.
export function sanitizeText(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, maxLen);
}

// Return a finite number clamped to [min, max], or `fallback` for non-numbers/NaN.
export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

// Validate a CSS hex color (#rrggbb); anything else returns the safe fallback.
export function sanitizeColor(v: unknown, fallback = "#3b82f6"): string {
  return typeof v === "string" && COLOR_RE.test(v) ? v : fallback;
}

// Classify a stored source value into the media type the client should render.
export function deriveSourceType(sourceValue: string): RoomSourceType {
  if (!sourceValue) return "none";
  return sourceValue.includes("meet.google.com") ? "meet" : "youtube";
}

// Accept only a bare 11-char YouTube ID, a YouTube URL, or a meet.google.com
// URL. Returns a normalized safe value, or null to reject.
export function parseVideoInput(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (YT_ID_RE.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : "https://" + s);
    if (url.hostname === "meet.google.com" || url.hostname.endsWith(".meet.google.com")) {
      // Drop any query/fragment; keep only the meeting-code path
      return `https://meet.google.com${url.pathname}`;
    }
    if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
      const id = url.searchParams.get("v");
      return id && YT_ID_RE.test(id) ? id : null;
    }
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return YT_ID_RE.test(id) ? id : null;
    }
  } catch {
    // not a parseable URL
  }
  return null;
}

// Like parseVideoInput, but an explicit empty string is allowed (clears a room).
export function parseOptionalVideoInput(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!v.trim()) return "";
  return parseVideoInput(v);
}

// Validate an ISO-ish start time within a sane window; returns ISO string or null.
export function parseStartTime(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return null;
  const parsed = Date.parse(v);
  if (!Number.isFinite(parsed)) return null;
  const earliest = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const latest = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000;
  if (parsed < earliest || parsed > latest) return null;
  return new Date(parsed).toISOString();
}

// Clamp a duration in minutes to [0, MAX_DURATION_MINUTES]; non-numbers → fallback.
export function parseDurationMinutes(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(MAX_DURATION_MINUTES, Math.max(0, Math.round(v)));
}
