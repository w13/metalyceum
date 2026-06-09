// Admin CP Durable Object — accounts, sessions, password resets, audit log.
import { DurableObject } from 'cloudflare:workers';
import type { AdminBindings } from '../constants';
import { DEFAULT_ROOMS, ROOM_COUNT, type RoomEvent } from '../constants';
import { errorJson } from '../http/errors';
import { parseJsonObjectBody } from '../http/json';
import { getOrCreateRequestId } from '../http/request_id';
import {
  INTERNAL_ADMIN_PATHS,
  internalAdminUrl,
} from '../internal/admin_endpoints';
import { isInternalWorldResponse } from '../internal/world_response';
import { parsePaginationParams } from './pagination';
import {
  AUDIT,
  AUDIT_LOG_MAX,
  type AuditEntry,
  bufferToHex,
  constantTimeEqual,
  PASSWORD_RESET_TTL_MS,
  type PasswordReset,
  PBKDF2_ITERATIONS,
  RATE_LIMIT_LOGIN,
  RATE_LIMIT_REGISTER,
  RATE_LIMIT_RESET,
  RATE_LIMIT_WINDOW_MS,
  randomHex,
  SALT_BYTES,
  SESSION_TTL_MS,
  type Session,
  stripPasswordFields,
  TOKEN_BYTES,
  type User,
  type UserRole,
  validateAvatarUrl,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateRole,
  validateUsername,
} from './schemas';

// ── Helpers ─────────────────────────────────────────────────────────────────
type StorageListWithCursor<T> = Map<string, T> & {
  cursor?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ok(data?: unknown): Response {
  return json({ ok: true, ...(data !== undefined ? { data } : {}) });
}

function err(message: string, status = 400, requestId?: string): Response {
  return errorJson(message, status, requestId ? { requestId } : {});
}

function logAdminEvent(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  console.log(JSON.stringify({ event, ts: Date.now(), fields }));
}

function getCursor<T>(result: Map<string, T>): string | null {
  const { cursor } = result as StorageListWithCursor<T>;
  return cursor ?? null;
}

/** SHA-256 hex digest. */
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return bufferToHex(buf);
}

/** PBKDF2 password hash. */
async function pbkdf2(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return bufferToHex(bits);
}

// ── In-memory rate limiter (per-IP, resets on DO restart) ───────────────────
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastRateLimitCleanupAt = 0;

function pruneStaleRateLimitEntries(now: number): void {
  if (now - lastRateLimitCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;

  for (const [key, val] of ipBuckets) {
    if (now > val.resetAt) ipBuckets.delete(key);
  }
  lastRateLimitCleanupAt = now;
}

function checkRateLimit(ip: string, maxReq: number, windowMs: number): boolean {
  const now = Date.now();
  pruneStaleRateLimitEntries(now);
  const entry = ipBuckets.get(ip);
  if (!entry || now > entry.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxReq) return false;
  entry.count++;
  return true;
}

// ── DO Class ────────────────────────────────────────────────────────────────
export class AdminDO extends DurableObject<AdminBindings> {
  constructor(ctx: DurableObjectState, env: AdminBindings) {
    super(ctx, env);
  }

  // ── Entry Point ────────────────────────────────────────────────────────────
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const requestId = getOrCreateRequestId(request);
    // Strip /api/v1 prefix
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
    const segments = path.split('/').filter(Boolean);

    try {
      // Public routes
      if (method === 'POST' && segments[0] === 'auth') {
        switch (segments[1]) {
          case 'init':
            return this.handleInit(request);
          case 'register':
            return this.handleRegister(request, this.clientIp(request));
          case 'login':
            return this.handleLogin(request, this.clientIp(request));
          case 'password-reset':
            if (segments[2] === 'request')
              return this.handleResetRequest(request, this.clientIp(request));
            if (segments[2] === 'confirm')
              return this.handleResetConfirm(request);
            break;
        }
      }

      // Authenticated routes
      const authResult = await this.authenticate(request);
      if (!authResult)
        return err('Unauthorized — invalid or expired session', 401, requestId);
      const { user, session, tokenHash } = authResult;

      if (
        method === 'POST' &&
        segments[0] === 'auth' &&
        segments[1] === 'logout'
      ) {
        return this.handleLogout(session, tokenHash);
      }
      if (
        method === 'GET' &&
        segments[0] === 'auth' &&
        segments[1] === 'session'
      ) {
        return ok({ user: stripPasswordFields(user) });
      }
      if (
        method === 'PUT' &&
        segments[0] === 'account' &&
        segments[1] === 'profile'
      ) {
        return this.handleProfileUpdate(user, request);
      }
      if (
        method === 'PUT' &&
        segments[0] === 'account' &&
        segments[1] === 'password'
      ) {
        return this.handlePasswordChange(user, request);
      }

      // Admin-only routes
      if (user.role !== 'admin' && user.role !== 'owner') {
        return err('Forbidden — admin role required', 403, requestId);
      }
      if (segments[0] === 'admin' && segments[1] === 'health') {
        return this.handleAdminHealth();
      }

      if (segments[0] === 'admin') {
        switch (segments[1]) {
          case 'users':
            if (method === 'GET' && !segments[2])
              return this.handleAdminListUsers(request);
            if (method === 'GET' && segments[2])
              return this.handleAdminGetUser(segments[2]);
            if (method === 'PUT' && segments[2])
              return this.handleAdminUpdateUser(user, segments[2], request);
            if (method === 'DELETE' && segments[2])
              return this.handleAdminDeleteUser(user, segments[2]);
            break;
          case 'logs':
            if (method === 'GET') return this.handleAdminLogs(request);
            break;
          case 'rooms':
            if (method === 'GET') return this.handleAdminListRooms();
            if (method === 'PUT' && segments[2])
              return this.handleAdminUpdateRoom(
                segments[2],
                request,
                requestId,
              );
            if (method === 'DELETE' && segments[2] && segments[3] === 'event')
              return this.handleAdminClearRoomEvent(segments[2], requestId);
            break;
          case 'editor-token':
            if (method === 'GET') return this.handleAdminGetEditorToken();
            if (method === 'PUT')
              return this.handleAdminRotateEditorToken(request);
            break;
          case 'broadcast':
            if (method === 'POST')
              return this.handleAdminBroadcast(request, requestId);
            break;
          case 'world':
            if (method === 'GET') return this.handleAdminWorldState(requestId);
            break;
          case 'world-assets':
            if (method === 'GET') return this.handleAdminWorldAssets(requestId);
            break;
          case 'sync-rooms':
            if (method === 'POST')
              return this.handleAdminSyncAllRooms(requestId);
            break;
        }
      }

      return err('Not found', 404, requestId);
    } catch (error) {
      logAdminEvent('admin.request_failed', {
        requestId,
        method,
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      return err('Internal server error', 500, requestId);
    }
  }

  private clientIp(request: Request): string {
    return (
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      '0.0.0.0'
    );
  }

  // ── Authentication ─────────────────────────────────────────────────────────
  /** Returns (user, session, tokenHash) or null. */
  private async authenticate(
    request: Request,
  ): Promise<{ user: User; session: Session; tokenHash: string } | null> {
    const header = request.headers.get('Authorization');
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    if (!token) return null;

    const tokenHash = await sha256(token);
    const sessionKey = 'session:' + tokenHash;
    const raw = await this.ctx.storage.get<Session>(sessionKey);
    if (!raw) return null;
    const sess = raw;
    if (Date.now() > sess.expiresAt) {
      await this.ctx.storage.delete(sessionKey);
      return null;
    }

    const user = await this.getUser(sess.userId);
    if (!user || user.banned) return null;
    return { user, session: sess, tokenHash };
  }

  private async getUser(id: string): Promise<User | null> {
    const raw = await this.ctx.storage.get<User>('user:' + id);
    return raw ?? null;
  }

  // ── Init (bootstrap first owner) ──────────────────────────────────────────
  private async handleInit(request: Request): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token || token !== this.env.ADMIN_INIT_TOKEN) {
      return err('Invalid init token', 403);
    }

    // Only works when no users exist
    const existing = await this.ctx.storage.list({ prefix: 'user:', limit: 1 });
    if (existing.size > 0) {
      return err('System already initialized', 409);
    }

    const username = validateUsername(body.username);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    if (!username) return err('Invalid username');
    if (!email) return err('Invalid email');
    if (!password) return err('Invalid password (8-128 chars)');

    const id = randomHex(16);
    const salt = randomHex(SALT_BYTES);
    const passwordHash = await pbkdf2(password, salt);
    const displayName = validateDisplayName(body.displayName) || username;

    const user: User = {
      id,
      username,
      displayName,
      email,
      passwordHash,
      passwordSalt: salt,
      role: 'owner',
      avatarUrl: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      banned: false,
      bannedReason: '',
    };

    await this.ctx.storage.put({
      ['user:' + id]: user,
      ['idx:username:' + username]: id,
      ['idx:email:' + email]: id,
    });

    await this.appendAudit({
      id: randomHex(8),
      adminId: id,
      action: AUDIT.USER_CREATED,
      targetId: id,
      details: 'System initialized — first owner created',
      createdAt: Date.now(),
    });

    return json({ ok: true, data: { userId: id, role: 'owner' } }, 201);
  }

  // ── Register ───────────────────────────────────────────────────────────────
  private async handleRegister(
    request: Request,
    ip: string,
  ): Promise<Response> {
    if (!checkRateLimit(ip, RATE_LIMIT_REGISTER, RATE_LIMIT_WINDOW_MS)) {
      return err('Rate limited — try again later', 429);
    }
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;

    const username = validateUsername(body.username);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    if (!username)
      return err('Invalid username (2-24 chars, letters/digits/_-)');
    if (!email) return err('Invalid email address');
    if (!password) return err('Invalid password (8-128 chars)');

    // Check uniqueness
    const existingUsername = await this.ctx.storage.get<string>(
      'idx:username:' + username,
    );
    if (existingUsername) return err('Username already taken', 409);
    const existingEmail = await this.ctx.storage.get<string>(
      'idx:email:' + email,
    );
    if (existingEmail) return err('Email already registered', 409);

    const id = randomHex(16);
    const salt = randomHex(SALT_BYTES);
    const passwordHash = await pbkdf2(password, salt);
    const displayName = validateDisplayName(body.displayName) || username;

    const user: User = {
      id,
      username,
      displayName,
      email,
      passwordHash,
      passwordSalt: salt,
      role: 'user',
      avatarUrl: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      banned: false,
      bannedReason: '',
    };

    await this.ctx.storage.put({
      ['user:' + id]: user,
      ['idx:username:' + username]: id,
      ['idx:email:' + email]: id,
    });

    await this.appendAudit({
      id: randomHex(8),
      adminId: id,
      action: AUDIT.USER_CREATED,
      targetId: id,
      details: `Registered as ${username}`,
      createdAt: Date.now(),
    });

    return json({ ok: true, data: { userId: id } }, 201);
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  private async handleLogin(request: Request, ip: string): Promise<Response> {
    if (!checkRateLimit(ip, RATE_LIMIT_LOGIN, RATE_LIMIT_WINDOW_MS)) {
      return err('Rate limited — try again later', 429);
    }
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    if (!email || !password) return err('Invalid email or password');

    const userId = await this.ctx.storage.get<string>('idx:email:' + email);
    if (!userId) return err('Invalid email or password', 401);

    const user = await this.getUser(userId);
    if (!user || user.banned) return err('Invalid email or password', 401);

    const hash = await pbkdf2(password, user.passwordSalt);
    if (!constantTimeEqual(hash, user.passwordHash)) {
      return err('Invalid email or password', 401);
    }

    const token = randomHex(TOKEN_BYTES);
    const tokenHash = await sha256(token);
    const session: Session = {
      id: randomHex(8),
      userId: user.id,
      ipAddress: ip,
      userAgent: request.headers.get('User-Agent') || '',
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    await this.ctx.storage.put('session:' + tokenHash, session);

    await this.appendAudit({
      id: randomHex(8),
      adminId: user.id,
      action: AUDIT.SESSION_CREATED,
      targetId: user.id,
      details: `Login from ${ip}`,
      createdAt: Date.now(),
    });

    return ok({ token, user: stripPasswordFields(user) });
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  private async handleLogout(
    _session: Session,
    tokenHash: string,
  ): Promise<Response> {
    await this.ctx.storage.delete('session:' + tokenHash);
    return ok();
  }

  // ── Profile Update ─────────────────────────────────────────────────────────
  private async handleProfileUpdate(
    user: User,
    request: Request,
  ): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;

    let changed = false;
    if (body.displayName !== undefined) {
      const dn = validateDisplayName(body.displayName);
      if (!dn) return err('Invalid display name');
      user.displayName = dn;
      changed = true;
    }
    if (body.avatarUrl !== undefined) {
      const av = validateAvatarUrl(body.avatarUrl);
      if (!av) return err('Invalid avatar URL (must be https:// or data:)');
      user.avatarUrl = av;
      changed = true;
    }
    if (!changed) return err('No valid fields to update');
    user.updatedAt = Date.now();
    await this.ctx.storage.put('user:' + user.id, user);
    return ok({ user: stripPasswordFields(user) });
  }

  // ── Password Change (when logged in) ───────────────────────────────────────
  private async handlePasswordChange(
    user: User,
    request: Request,
  ): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    const current = validatePassword(body.currentPassword);
    const newPass = validatePassword(body.newPassword);
    if (!current || !newPass) return err('Invalid current or new password');

    const hash = await pbkdf2(current, user.passwordSalt);
    if (!constantTimeEqual(hash, user.passwordHash)) {
      return err('Current password is incorrect', 401);
    }

    const newSalt = randomHex(SALT_BYTES);
    user.passwordHash = await pbkdf2(newPass, newSalt);
    user.passwordSalt = newSalt;
    user.updatedAt = Date.now();
    await this.ctx.storage.put('user:' + user.id, user);

    await this.appendAudit({
      id: randomHex(8),
      adminId: user.id,
      action: AUDIT.PASSWORD_CHANGED,
      targetId: user.id,
      details: 'Password changed',
      createdAt: Date.now(),
    });

    return ok();
  }

  // ── Password Reset Request ─────────────────────────────────────────────────
  private async handleResetRequest(
    request: Request,
    ip: string,
  ): Promise<Response> {
    if (!checkRateLimit(ip, RATE_LIMIT_RESET, RATE_LIMIT_WINDOW_MS)) {
      return err('Rate limited — try again later', 429);
    }
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    const email = validateEmail(body.email);
    if (!email) return err('Invalid email');

    // Always return 200 to prevent email enumeration
    const userId = await this.ctx.storage.get<string>('idx:email:' + email);
    if (!userId) return ok();

    const token = randomHex(TOKEN_BYTES);
    const tokenHash = await sha256(token);
    const reset: PasswordReset = {
      id: randomHex(8),
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + PASSWORD_RESET_TTL_MS,
      used: false,
    };
    await this.ctx.storage.put('reset:' + tokenHash, reset);

    // In production, email the token. For now, log & return it.
    console.log(`[AdminDO] Password reset for ${email}: token=${token}`);

    return ok({ token });
  }

  // ── Password Reset Confirm ─────────────────────────────────────────────────
  private async handleResetConfirm(request: Request): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    const token = typeof body.token === 'string' ? body.token.trim() : null;
    const password = validatePassword(body.newPassword);
    if (!token || !password) return err('Invalid token or new password');

    const tokenHash = await sha256(token);
    const resetKey = 'reset:' + tokenHash;
    const reset = await this.ctx.storage.get<PasswordReset>(resetKey);
    if (!reset || reset.used || Date.now() > reset.expiresAt) {
      return err('Invalid or expired reset token', 401);
    }

    const user = await this.getUser(reset.userId);
    if (!user) return err('User not found', 404);

    const newSalt = randomHex(SALT_BYTES);
    user.passwordHash = await pbkdf2(password, newSalt);
    user.passwordSalt = newSalt;
    user.updatedAt = Date.now();
    reset.used = true;
    await this.ctx.storage.put({
      ['user:' + user.id]: user,
      [resetKey]: reset,
    });

    await this.appendAudit({
      id: randomHex(8),
      adminId: user.id,
      action: AUDIT.PASSWORD_RESET,
      targetId: user.id,
      details: 'Password reset via email token',
      createdAt: Date.now(),
    });

    return ok();
  }

  // ── Admin: List Users ──────────────────────────────────────────────────────
  private async handleAdminListUsers(request: Request): Promise<Response> {
    const { limit, cursor } = parsePaginationParams(request, 50, 100);
    const listOpts = cursor
      ? { prefix: 'user:', limit, cursor }
      : { prefix: 'user:', limit };
    const result = await this.ctx.storage.list<User>(listOpts);
    const users = Array.from(result.values()).map((u) =>
      stripPasswordFields(u),
    );
    const nextCursor = getCursor(result);
    return ok({
      users,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    });
  }

  // ── Admin: Get User ────────────────────────────────────────────────────────
  private async handleAdminGetUser(userId: string): Promise<Response> {
    const user = await this.getUser(userId);
    if (!user) return err('User not found', 404);
    return ok({ user: stripPasswordFields(user) });
  }

  // ── Admin: Update User ─────────────────────────────────────────────────────
  private async handleAdminUpdateUser(
    admin: User,
    targetId: string,
    request: Request,
  ): Promise<Response> {
    const user = await this.getUser(targetId);
    if (!user) return err('User not found', 404);
    // Prevent owner from being demoted by anyone except themselves
    if (user.role === 'owner' && admin.id !== user.id) {
      return err('Cannot modify owner account', 403);
    }

    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    let changed = false;
    const changes: string[] = [];

    if (body.role !== undefined) {
      const role = validateRole(body.role);
      if (!role) return err('Invalid role (user/admin/owner)');
      if (role === 'owner' && admin.role !== 'owner')
        return err('Only owners can grant owner role', 403);
      user.role = role;
      changed = true;
      changes.push(`role→${role}`);
    }
    if (body.banned !== undefined) {
      const banned = Boolean(body.banned);
      if (banned && user.role === 'owner') return err('Cannot ban owner', 403);
      user.banned = banned;
      user.bannedReason = banned
        ? typeof body.bannedReason === 'string'
          ? body.bannedReason.slice(0, 200)
          : 'Banned by admin'
        : '';
      changed = true;
      changes.push(banned ? 'banned' : 'unbanned');
    }
    if (body.displayName !== undefined) {
      const dn = validateDisplayName(body.displayName);
      if (!dn) return err('Invalid display name');
      user.displayName = dn;
      changed = true;
      changes.push(`displayName→${dn}`);
    }

    if (!changed) return err('No valid fields to update');
    user.updatedAt = Date.now();
    await this.ctx.storage.put('user:' + user.id, user);

    // Audit
    const action = user.banned ? AUDIT.USER_BANNED : AUDIT.USER_UPDATED;
    await this.appendAudit({
      id: randomHex(8),
      adminId: admin.id,
      action,
      targetId: user.id,
      details: changes.join('; '),
      createdAt: Date.now(),
    });

    return ok({ user: stripPasswordFields(user) });
  }

  // ── Admin: Delete (Ban) User ───────────────────────────────────────────────
  private async handleAdminDeleteUser(
    admin: User,
    targetId: string,
  ): Promise<Response> {
    const user = await this.getUser(targetId);
    if (!user) return err('User not found', 404);
    if (user.role === 'owner') return err('Cannot delete owner account', 403);

    user.banned = true;
    user.bannedReason = 'Deleted by admin';
    user.updatedAt = Date.now();
    user.email = `deleted_${user.id}@removed`;
    user.username = `deleted_${user.id}`;
    user.displayName = 'Deleted User';
    await this.ctx.storage.put('user:' + user.id, user);

    await this.appendAudit({
      id: randomHex(8),
      adminId: admin.id,
      action: AUDIT.USER_DELETED,
      targetId: user.id,
      details: 'Account soft-deleted and banned',
      createdAt: Date.now(),
    });

    return ok();
  }

  // ── Admin: Audit Log ───────────────────────────────────────────────────────
  private async handleAdminLogs(request: Request): Promise<Response> {
    const { limit, cursor } = parsePaginationParams(request, 50, 200);
    const listOpts = cursor
      ? { prefix: 'log:', limit, cursor }
      : { prefix: 'log:', limit };
    const result = await this.ctx.storage.list<AuditEntry>(listOpts);
    const logs: (AuditEntry & { key: string })[] = [];
    for (const [key, val] of result.entries()) {
      logs.push({ key, ...val });
    }
    logs.sort((a, b) => b.createdAt - a.createdAt);
    const nextCursor = getCursor(result);

    return ok({
      logs,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    });
  }

  // ── Room storage helpers ──────────────────────────────────────────────────
  private _roomsSeeded = false;

  private async seedRoomsIfNeeded(): Promise<void> {
    if (this._roomsSeeded) return;
    const existing = await this.ctx.storage.list({ prefix: 'room:', limit: 1 });
    if (existing.size > 0) {
      this._roomsSeeded = true;
      return;
    }
    for (const room of DEFAULT_ROOMS) {
      await this.ctx.storage.put('room:' + room.roomId, room);
    }
    this._roomsSeeded = true;
  }

  private async getRoomStorageKey(roomId: number): Promise<string | null> {
    const raw = await this.ctx.storage.get<RoomEvent>('room:' + roomId);
    return raw ? 'room:' + roomId : null;
  }

  private async getRoom(roomId: number): Promise<RoomEvent | null> {
    await this.seedRoomsIfNeeded();
    const raw = await this.ctx.storage.get<RoomEvent>('room:' + roomId);
    return raw || null;
  }

  // ── Admin: List Rooms ──────────────────────────────────────────────────────
  private async handleAdminListRooms(): Promise<Response> {
    await this.seedRoomsIfNeeded();
    const result = await this.ctx.storage.list<RoomEvent>({ prefix: 'room:' });
    const rooms: RoomEvent[] = [];
    for (const [, val] of result.entries()) {
      rooms.push(val);
    }
    rooms.sort((a, b) => a.roomId - b.roomId);
    return ok({ rooms });
  }

  // ── Admin: Update Room ─────────────────────────────────────────────────────
  private async handleAdminUpdateRoom(
    roomIdStr: string,
    request: Request,
    requestId: string,
  ): Promise<Response> {
    const roomId = Number(roomIdStr);
    if (!Number.isInteger(roomId) || roomId < 0 || roomId >= ROOM_COUNT) {
      return err('Invalid room ID', 400);
    }
    const room = await this.getRoom(roomId);
    if (!room) return err('Room not found', 404);

    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    let changed = false;

    if (typeof body.name === 'string') {
      const name = body.name.trim().slice(0, 48);
      if (name) {
        room.name = name;
        changed = true;
      }
    }
    if (body.sourceValue !== undefined) {
      const sv =
        typeof body.sourceValue === 'string' ? body.sourceValue.trim() : '';
      room.sourceValue = sv;
      room.sourceType = sv.includes('meet.google.com')
        ? 'meet'
        : sv
          ? 'youtube'
          : 'none';
      changed = true;
    }
    if (body.startTime !== undefined) {
      const st = typeof body.startTime === 'string' ? body.startTime : null;
      room.startTime = st;
      changed = true;
    }
    if (body.durationMinutes !== undefined) {
      const dm =
        typeof body.durationMinutes === 'number'
          ? Math.max(0, Math.min(1440, body.durationMinutes))
          : room.durationMinutes;
      room.durationMinutes = dm;
      changed = true;
    }
    if (!changed) return err('No valid fields to update');

    room.updatedAt = Date.now();
    await this.ctx.storage.put('room:' + roomId, room);

    // Auto-sync to game world
    await this.syncRoomToWorld(room, requestId);

    await this.appendAudit({
      id: randomHex(8),
      adminId: 'admin',
      action: AUDIT.USER_UPDATED,
      targetId: `room:${roomId}`,
      details: `Room ${roomId} updated`,
      createdAt: Date.now(),
    });
    return ok({ room });
  }

  // ── Admin: Clear Room Event ────────────────────────────────────────────────
  private async handleAdminClearRoomEvent(
    roomIdStr: string,
    requestId: string,
  ): Promise<Response> {
    const roomId = Number(roomIdStr);
    if (!Number.isInteger(roomId) || roomId < 0 || roomId >= ROOM_COUNT) {
      return err('Invalid room ID', 400);
    }
    const room = await this.getRoom(roomId);
    if (!room) return err('Room not found', 404);

    room.sourceValue = '';
    room.sourceType = 'none';
    room.startTime = null;
    room.durationMinutes = 0;
    room.updatedAt = Date.now();
    await this.ctx.storage.put('room:' + roomId, room);

    // Auto-sync to game world
    await this.syncRoomToWorld(room, requestId);

    await this.appendAudit({
      id: randomHex(8),
      adminId: 'admin',
      action: AUDIT.USER_UPDATED,
      targetId: `room:${roomId}`,
      details: `Room ${roomId} event cleared`,
      createdAt: Date.now(),
    });
    return ok({ room });
  }

  // ── Helper: sync room to game world DO ─────────────────────────────────────
  private async syncRoomToWorld(
    room: RoomEvent,
    requestId: string,
  ): Promise<void> {
    try {
      const stub = this.getWorldStub();
      await stub.fetch(internalAdminUrl(INTERNAL_ADMIN_PATHS.syncRoom), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
        body: JSON.stringify({
          roomId: room.roomId,
          name: room.name,
          sourceType: room.sourceType,
          sourceValue: room.sourceValue,
          startTime: room.startTime,
          durationMinutes: room.durationMinutes,
        }),
      });
    } catch (e) {
      // Game world DO may not be running yet; sync can be retried via sync-rooms.
      logAdminEvent('admin.syncRoomToWorld_failed', {
        roomId: room.roomId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ── Admin: Get Editor Token ────────────────────────────────────────────────
  private handleAdminGetEditorToken(): Response {
    const token = this.env.WORLD_EDITOR_TOKEN || '';
    if (!token) return ok({ exists: false, masked: null });
    const masked =
      token.length > 8
        ? token.slice(0, 4) + '••••' + token.slice(-4)
        : '••••' + token.slice(-4);
    return ok({ exists: true, masked, length: token.length });
  }

  // ── Admin: Rotate Editor Token ─────────────────────────────────────────────
  private async handleAdminRotateEditorToken(
    request: Request,
  ): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    const newToken = typeof body.token === 'string' ? body.token.trim() : '';
    if (!newToken || newToken.length < 8) {
      return err('New token must be at least 8 characters', 400);
    }
    // Store in DO storage (runtime override). The env var remains the default.
    await this.ctx.storage.put('config:editor_token', newToken);
    // Note: this only affects subsequent reads from this DO until next deploy.
    // The env.WORLD_EDITOR_TOKEN is fixed per-deploy; the stored value takes
    // precedence in the game world DO's editor_auth handler only when fetched
    // through this admin CP. For full rotation, update the env var + redeploy.
    await this.appendAudit({
      id: randomHex(8),
      adminId: 'admin',
      action: AUDIT.USER_UPDATED,
      targetId: 'config:editor_token',
      details: 'Editor token rotated',
      createdAt: Date.now(),
    });
    return ok({ rotated: true });
  }

  // ── Internal: MetalyceumWorld stub ─────────────────────────────────────────
  private getWorldStub(): DurableObjectStub {
    return this.env.METALYCEUM_WORLD.get(
      this.env.METALYCEUM_WORLD.idFromName('global-world'),
    );
  }

  // ── Admin: Broadcast Message ───────────────────────────────────────────────
  private async handleAdminBroadcast(
    request: Request,
    requestId: string,
  ): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) return err(parsed.error, 400);
    const body = parsed.value;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return err('Message is required', 400);

    const stub = this.getWorldStub();
    const broadcastRes = await stub.fetch(
      internalAdminUrl(INTERNAL_ADMIN_PATHS.broadcast),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
        body: JSON.stringify({
          message,
          author: typeof body.author === 'string' ? body.author : 'Admin',
        }),
      },
    );
    const rawResult = await broadcastRes.json();
    if (!isInternalWorldResponse(rawResult)) {
      return err('Broadcast failed', 500);
    }

    await this.appendAudit({
      id: randomHex(8),
      adminId: 'admin',
      action: 'broadcast.sent',
      targetId: 'all',
      details: `Broadcast: ${message.slice(0, 100)}`,
      createdAt: Date.now(),
    });
    return rawResult.ok ? ok() : err('Broadcast failed', 500);
  }

  // ── Admin: World State ─────────────────────────────────────────────────────
  private async handleAdminWorldState(requestId: string): Promise<Response> {
    const stub = this.getWorldStub();
    const res = await stub.fetch(
      internalAdminUrl(INTERNAL_ADMIN_PATHS.worldState),
      {
        headers: { 'X-Request-Id': requestId },
      },
    );
    const rawData = await res.json();
    if (!isInternalWorldResponse(rawData)) {
      return err('Failed to fetch world state', 500);
    }
    return rawData.ok
      ? ok(rawData.data)
      : err('Failed to fetch world state', 500);
  }

  // ── Admin: World Assets ────────────────────────────────────────────────────
  private async handleAdminWorldAssets(requestId: string): Promise<Response> {
    const stub = this.getWorldStub();
    const res = await stub.fetch(
      internalAdminUrl(INTERNAL_ADMIN_PATHS.worldAssets),
      {
        headers: { 'X-Request-Id': requestId },
      },
    );
    const rawData = await res.json();
    if (!isInternalWorldResponse(rawData)) {
      return err('Failed to fetch world assets', 500);
    }
    return rawData.ok
      ? ok(rawData.data)
      : err('Failed to fetch world assets', 500);
  }

  // ── Admin: Sync All Rooms ──────────────────────────────────────────────────
  private async handleAdminSyncAllRooms(requestId: string): Promise<Response> {
    await this.seedRoomsIfNeeded();
    const result = await this.ctx.storage.list<RoomEvent>({ prefix: 'room:' });
    const stub = this.getWorldStub();
    let synced = 0;
    let failed = 0;
    for (const [, val] of result.entries()) {
      const room = val;
      const syncRes = await stub.fetch(
        internalAdminUrl(INTERNAL_ADMIN_PATHS.syncRoom),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            roomId: room.roomId,
            name: room.name,
            sourceType: room.sourceType,
            sourceValue: room.sourceValue,
            startTime: room.startTime,
            durationMinutes: room.durationMinutes,
          }),
        },
      );
      if (syncRes.ok) synced++;
      else failed++;
    }
    await this.appendAudit({
      id: randomHex(8),
      adminId: 'admin',
      action: 'rooms.synced',
      targetId: 'all',
      details: `Synced ${synced} rooms to game world${failed ? ` (${failed} failed)` : ''}`,
      createdAt: Date.now(),
    });
    return ok({ synced, failed });
  }

  // ── Admin: Health ──────────────────────────────────────────────────────────
  private _startedAt = Date.now();
  private async handleAdminHealth(): Promise<Response> {
    const userList = await this.ctx.storage.list<User>({
      prefix: 'user:',
      limit: 10000,
    });
    const sessionList = await this.ctx.storage.list<Session>({
      prefix: 'session:',
    });
    const logList = await this.ctx.storage.list<AuditEntry>({ prefix: 'log:' });
    const now = Date.now();
    let activeSessions = 0;
    for (const [, val] of sessionList.entries()) {
      if (val.expiresAt > now) activeSessions++;
    }
    return ok({
      status: 'ok',
      uptime: Math.floor((now - this._startedAt) / 1000),
      users: { total: userList.size },
      sessions: { total: sessionList.size, active: activeSessions },
      auditLogs: { total: logList.size },
    });
  }

  // ── Audit Log Append ──────────────────────────────────────────────────────
  private async appendAudit(entry: AuditEntry): Promise<void> {
    const ts = String(entry.createdAt).padStart(20, '0');
    const key = 'log:' + ts + ':' + entry.id;
    await this.ctx.storage.put(key, entry);

    // Trim to max entries
    const all = await this.ctx.storage.list<AuditEntry>({ prefix: 'log:' });
    if (all.size > AUDIT_LOG_MAX) {
      const toDelete = Array.from(all.keys())
        .sort()
        .slice(0, all.size - AUDIT_LOG_MAX);
      if (toDelete.length > 0) {
        await this.ctx.storage.delete(toDelete);
      }
    }
  }
}
