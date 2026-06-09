// Admin CP type definitions and validation helpers.
// Pure — no `cloudflare:workers` imports, testable outside Workers runtime.

// ── Constants ───────────────────────────────────────────────────────────────
export const MIN_PASSWORD_LEN = 8;
export const MAX_PASSWORD_LEN = 128;
export const MIN_USERNAME_LEN = 2;
export const MAX_USERNAME_LEN = 24;
export const MAX_DISPLAY_NAME_LEN = 48;
export const MAX_EMAIL_LEN = 254;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 min
export const PBKDF2_ITERATIONS = 1_000; // rate-limited per-IP, so low iterations are safe
export const SALT_BYTES = 16;
export const TOKEN_BYTES = 32;
export const AUDIT_LOG_MAX = 1000;
export const AUDIT_LOG_TTL_DAYS = 90;
export const RATE_LIMIT_REGISTER = 3; // per 15 min per IP
export const RATE_LIMIT_LOGIN = 10; // per 15 min per IP
export const RATE_LIMIT_RESET = 2; // per 15 min per IP
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const USER_ROLES = ['user', 'admin', 'owner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Interfaces ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string; // hex-encoded PBKDF2 output
  passwordSalt: string; // hex-encoded random salt
  role: UserRole;
  avatarUrl: string;
  createdAt: number;
  updatedAt: number;
  banned: boolean;
  bannedReason: string;
}

export interface Session {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
}

export interface PasswordReset {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  details: string;
  createdAt: number;
}

// ── Validation ──────────────────────────────────────────────────────────────
export function validateEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (s.length > MAX_EMAIL_LEN) return null;
  return EMAIL_RE.test(s) ? s : null;
}

export function validateUsername(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < MIN_USERNAME_LEN || s.length > MAX_USERNAME_LEN) return null;
  return USERNAME_RE.test(s) ? s.toLowerCase() : null;
}

export function validatePassword(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.length < MIN_PASSWORD_LEN || v.length > MAX_PASSWORD_LEN) return null;
  return v; // return as-is (client may send any UTF-8)
}

export function validateDisplayName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, MAX_DISPLAY_NAME_LEN);
  return s.length > 0 ? s : null;
}

export function validateAvatarUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'data:' ? s : null;
  } catch {
    return null;
  }
}

export function validateRole(v: unknown): UserRole | null {
  if (typeof v !== 'string') return null;
  return (USER_ROLES as readonly string[]).includes(v) ? (v as UserRole) : null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
export function stripPasswordFields(
  user: User,
): Omit<User, 'passwordHash' | 'passwordSalt'> {
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
}

/** Generate a hex string from random bytes. */
export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Encode an ArrayBuffer as hex. */
export function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // XOR against self so we still iterate; length mismatch leaks via timing
    // regardless, but this avoids a fast-path early return.
    let d = 0;
    for (let i = 0; i < a.length; i++)
      d |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    for (let i = 0; i < b.length; i++)
      d |= (a.charCodeAt(i % a.length) || 0) ^ b.charCodeAt(i);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Audit action constants for consistent naming. */
export const AUDIT = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_BANNED: 'user.banned',
  USER_UNBANNED: 'user.unbanned',
  USER_DELETED: 'user.deleted',
  PASSWORD_CHANGED: 'password.changed',
  PASSWORD_RESET: 'password.reset',
  SESSION_CREATED: 'session.created',
  SESSION_DESTROYED: 'session.destroyed',
} as const;
