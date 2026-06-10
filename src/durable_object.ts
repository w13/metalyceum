import { DurableObject } from 'cloudflare:workers';
import {
  type Bindings,
  BUCKET_CAPACITY,
  BUCKET_REFILL,
  CHAT_MIN_INTERVAL,
  DEFAULT_ROOMS,
  DISCONNECT_GRACE_MS,
  MAX_CHAT_HISTORY,
  MAX_CHAT_LEN,
  MAX_MOVE_STEP,
  MAX_MOVE_STEP_SQ,
  MAX_PLAYERS,
  MAX_ROOM_NAME_LEN,
  MAX_USERNAME_LEN,
  MAX_WORLD_ASSETS,
  type PersistedChatMessage,
  type Player,
  ROOM_COUNT,
  ROOMS_CONFIG_VERSION,
  type RoomEvent,
  type Session,
  STALE_SESSION_MS,
  WORLD_LIMIT,
  Y_MAX,
  Y_MIN,
} from './constants';
import { parseJsonObjectBody, parseJsonObjectText } from './http/json';
import { INTERNAL_ADMIN_PATHS } from './internal/admin_endpoints';
import {
  arePlayersRelevant,
  getVisibleChatHistory,
  normalizeChatScope,
  shouldDeliverChat,
} from './realtime';
import { getSessionSource } from './session_source';
import {
  clampNum,
  deriveSourceType,
  parseDurationMinutes,
  parseOptionalVideoInput,
  parseStartTime,
  parseWorldAssets,
  sanitizeColor,
  sanitizeText,
  type WorldAssetDefinition,
} from './validation';

// Ring buffer of recent server-side events (shared across this isolate)
const MAX_SERVER_EVENTS = 100;
const serverEventLog: Array<{
  event: string;
  ts: number;
  fields: Record<string, unknown>;
}> = [];

export function logEvent(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const entry = { event, ts: Date.now(), fields };
  serverEventLog.push(entry);
  if (serverEventLog.length > MAX_SERVER_EVENTS) serverEventLog.shift();
  console.log(JSON.stringify(entry));
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getRecentEvents(count = 30): typeof serverEventLog {
  return serverEventLog.slice(-count);
}

type PersistedAssetRow = {
  id: string;
  asset_type: string;
  x: number;
  y: number;
  z: number;
  rotation_y: number;
  scale: number;
  room_id: number;
};

type PersistedChatRow = {
  id: number;
  sender_id: string;
  username: string;
  color: string;
  message: string;
  scope: 'global' | 'room';
  room_id: number | null;
  created_at: number;
};

function firstCursorRow<T>(cursor: { toArray(): unknown[] }): T | null {
  const [row] = cursor.toArray();
  return (row as T | undefined) ?? null;
}

export class MetalyceumWorld extends DurableObject {
  sessions: Map<WebSocket, Session> = new Map();
  rooms: RoomEvent[] = [];
  worldAssets: WorldAssetDefinition[] = [];
  chatHistory: PersistedChatMessage[] = [];
  storageInitError: string | null = null;
  private readonly dirtyPlayerIds = new Set<string>();
  /** Tracks grace-period cleanup timers keyed by username. */
  private readonly disconnectedGraceTimers = new Map<
    string,
    ReturnType<typeof globalThis.setTimeout>
  >();
  /** Timestamp of the last stale-session scan; avoids O(N) scan on every message. */
  private lastPruneAt = 0;
  /** True while a movement-flush alarm is pending — avoids re-arming per message. */
  private moveFlushScheduled = false;
  private static readonly PRUNE_INTERVAL_MS = 15_000;
  // Movement flush runs at ~12 Hz to match the default network profile.
  // The alarm is only armed while dirty players exist, so idle worlds
  // keep hibernating instead of waking 12×/sec.
  private static readonly MOVE_FLUSH_INTERVAL_MS = 83;

  // --- WebSocket hibernation helpers ---

  /**
   * Persist a session to its WebSocket attachment so it survives DO hibernation.
   * Called whenever session state changes meaningfully (join, room change, disconnect).
   */
  private serializeSession(ws: WebSocket, session: Session): void {
    ws.serializeAttachment({
      ...session,
      visiblePlayerIds: Array.from(session.visiblePlayerIds),
    });
  }

  /**
   * Rebuild the in-memory sessions map from WebSocket attachments.
   * Called at the start of every hibernation wake-up handler.
   */
  private rebuildSessionsIfNeeded(): void {
    if (this.sessions.size > 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const raw = ws.deserializeAttachment() as
        | (Omit<Session, 'visiblePlayerIds'> & { visiblePlayerIds: string[] })
        | null;
      if (!raw) continue;
      this.sessions.set(ws, {
        ...raw,
        visiblePlayerIds: new Set(raw.visiblePlayerIds),
      });
    }
  }

  // --- DO hibernation WebSocket lifecycle methods ---

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.rebuildSessionsIfNeeded();
    this.handleMessage(ws, message);
  }

  webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {
    this.rebuildSessionsIfNeeded();
    this.closeHandler(ws);
  }

  webSocketError(ws: WebSocket, _error: unknown): void {
    this.rebuildSessionsIfNeeded();
    this.closeHandler(ws);
  }

  private pruneStaleSessions(now = Date.now()): void {
    if (now - this.lastPruneAt < MetalyceumWorld.PRUNE_INTERVAL_MS) return;
    this.lastPruneAt = now;
    for (const [ws, session] of this.sessions.entries()) {
      // Expire sessions that didn't reconnect within the grace period
      if (
        session.disconnectedAt !== null &&
        now - session.disconnectedAt > DISCONNECT_GRACE_MS
      ) {
        this.sessions.delete(ws);
        this.expireDisconnectedSession(ws);
        logEvent('player_grace_expired', {
          id: session.id,
          username: session.username,
        });
        continue;
      }
      if (now - session.lastSeenAt <= STALE_SESSION_MS) continue;
      try {
        ws.close(1001, 'Session timed out');
      } catch (error) {
        logEvent('stale_session_close_failed', {
          id: session.id,
          username: session.username,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.closeHandler(ws);
      logEvent('player_timed_out', {
        id: session.id,
        username: session.username,
      });
    }
  }

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      try {
        this.initTables();
        await this.loadRooms();
        await this.loadWorldAssets();
        await this.loadChatHistory();
        this.storageInitError = null;
      } catch (error) {
        this.storageInitError =
          error instanceof Error ? error.message : String(error);
        logEvent('storage_init_error', {
          error: this.storageInitError,
        });
        this.rooms = DEFAULT_ROOMS.map((room) => ({ ...room }));
        this.worldAssets = [];
        this.chatHistory = [];
      }
    });
  }

  // --- Database initialization & loading ---

  private initTables(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS room_events (
        room_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        source_value TEXT NOT NULL,
        start_time TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 0
      )`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS world_assets (
        id TEXT PRIMARY KEY,
        asset_type TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        rotation_y REAL NOT NULL,
        scale REAL NOT NULL,
        room_id INTEGER NOT NULL
      )`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        username TEXT NOT NULL,
        color TEXT NOT NULL,
        message TEXT NOT NULL,
        scope TEXT NOT NULL,
        room_id INTEGER,
        created_at INTEGER NOT NULL
      )`,
    );
  }

  private getMeta(key: string): string | null {
    const cursor = this.ctx.storage.sql.exec(
      'SELECT value FROM meta WHERE key=?',
      key,
    );
    const row = firstCursorRow<{ value: string }>(cursor);
    return row?.value ?? null;
  }

  private setMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      key,
      value,
    );
  }

  private tableExists(tableName: string): boolean {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      tableName,
    );
    return firstCursorRow(cursor) !== null;
  }

  private migrateLegacyRooms(): Map<number, string> {
    const migratedSources = new Map<number, string>();
    if (this.tableExists('room_videos')) {
      const oldRows = this.ctx.storage.sql
        .exec('SELECT room_id, video_id FROM room_videos ORDER BY room_id ASC')
        .toArray() as { room_id: number; video_id: string }[];
      for (const row of oldRows) {
        if (row.room_id >= 0 && row.room_id < ROOM_COUNT) {
          migratedSources.set(row.room_id, row.video_id);
        }
      }
    }
    return migratedSources;
  }

  private seedDefaultRooms(migratedSources: Map<number, string>): void {
    for (const defaults of DEFAULT_ROOMS) {
      this.persistRoom({
        ...defaults,
        sourceValue:
          migratedSources.get(defaults.roomId) ?? defaults.sourceValue,
      });
    }
  }

  private async loadRooms(): Promise<void> {
    const storedVersion = Number(this.getMeta('rooms_version') || '0');
    const needsReseed = storedVersion < ROOMS_CONFIG_VERSION;

    const countCursor = this.ctx.storage.sql.exec(
      'SELECT COUNT(*) as cnt FROM room_events',
    );
    const count = Number(
      (countCursor.one() as { cnt: number } | null)?.cnt ?? 0,
    );

    if (count === 0 || needsReseed) {
      if (needsReseed && count > 0) {
        // Migration: wipe old room data and re-seed with new defaults
        this.ctx.storage.sql.exec('DELETE FROM room_events');
        logEvent('rooms_migrated', {
          fromVersion: storedVersion,
          toVersion: ROOMS_CONFIG_VERSION,
        });
      }
      const migratedSources = this.migrateLegacyRooms();
      this.seedDefaultRooms(migratedSources);
      this.setMeta('rooms_version', String(ROOMS_CONFIG_VERSION));
    }

    const roomRows = this.ctx.storage.sql
      .exec(
        `SELECT room_id, name, source_value, start_time, duration_minutes
       FROM room_events ORDER BY room_id ASC`,
      )
      .toArray() as {
      room_id: number;
      name: string;
      source_value: string;
      start_time: string | null;
      duration_minutes: number;
    }[];

    const roomMap = new Map<number, RoomEvent>();
    for (const row of roomRows) {
      if (row.room_id < 0 || row.room_id >= ROOM_COUNT) continue;
      const defaults = DEFAULT_ROOMS[row.room_id];
      roomMap.set(row.room_id, {
        roomId: row.room_id,
        name: row.name,
        sourceType: deriveSourceType(row.source_value),
        sourceValue: row.source_value,
        startTime: row.start_time ?? defaults.startTime,
        durationMinutes: clampNum(
          Number(row.duration_minutes) || defaults.durationMinutes,
          1,
          24 * 60,
          defaults.durationMinutes,
        ),
        updatedAt: defaults.updatedAt,
      });
    }

    this.rooms = DEFAULT_ROOMS.map(
      (defaults) => roomMap.get(defaults.roomId) ?? defaults,
    );
  }

  private async loadWorldAssets(): Promise<void> {
    const assetRows = this.ctx.storage.sql
      .exec(
        `SELECT id, asset_type, x, y, z, rotation_y, scale, room_id
       FROM world_assets ORDER BY rowid ASC`,
      )
      .toArray() as PersistedAssetRow[];

    const parsedAssets = parseWorldAssets(
      assetRows.map((row) => ({
        id: row.id,
        type: row.asset_type,
        x: row.x,
        y: row.y,
        z: row.z,
        rotationY: row.rotation_y,
        scale: row.scale,
        roomId: row.room_id,
      })),
      this.worldAssetValidation(),
    );

    this.worldAssets = parsedAssets ?? [];
    if (!parsedAssets && assetRows.length > 0) {
      logEvent('world_assets_load_repaired', {
        originalCount: assetRows.length,
      });
    }
  }

  private prunePersistedChatMessages(): void {
    this.ctx.storage.sql.exec(
      `DELETE FROM chat_messages
       WHERE id NOT IN (
         SELECT id FROM chat_messages ORDER BY id DESC LIMIT ?
       )`,
      MAX_CHAT_HISTORY,
    );
  }

  private async loadChatHistory(): Promise<void> {
    const chatRows = this.ctx.storage.sql
      .exec(
        `SELECT id, sender_id, username, color, message, scope, room_id, created_at
       FROM chat_messages
       ORDER BY id DESC
       LIMIT ?`,
        MAX_CHAT_HISTORY,
      )
      .toArray() as PersistedChatRow[];

    this.chatHistory = chatRows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        username: row.username,
        color: row.color,
        message: row.message,
        scope: row.scope === 'room' ? 'room' : 'global',
        roomId: Number.isInteger(row.room_id) ? row.room_id : null,
        timestamp: row.created_at,
      }));

    this.prunePersistedChatMessages();
  }

  private worldAssetValidation() {
    return {
      worldLimit: WORLD_LIMIT,
      yMin: Y_MIN,
      yMax: Y_MAX,
      roomCount: ROOM_COUNT,
      maxAssets: Math.max(1, Math.min(MAX_WORLD_ASSETS, 200)),
    };
  }

  // --- Message dispatch ---

  private send(ws: WebSocket, msg: object): void {
    const payload = JSON.stringify(msg);
    try {
      ws.send(payload);
    } catch (err) {
      const session = this.sessions.get(ws);
      logEvent('ws_send_failed', {
        id: session?.id ?? 'unknown',
        username: session?.username ?? 'unknown',
        error: err instanceof Error ? err.message : String(err),
      });
      this.closeHandler(ws);
    }
  }

  broadcast(
    msg: object,
    excludeId?: string,
    predicate?: (session: Session) => boolean,
  ): void {
    for (const [ws, session] of this.sessions.entries()) {
      if (excludeId && session.id === excludeId) continue;
      if (predicate && !predicate(session)) continue;
      this.send(ws, msg);
    }
  }

  // --- Admin proxy handlers (called from AdminDO via internal routes) ---

  private async handleAdminBroadcast(request: Request): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: 'Invalid request' }, 400);
    }
    const body = parsed.value;
    const message = body.message;
    if (!message || typeof message !== 'string') {
      return jsonResponse({ ok: false, error: 'Missing message' }, 400);
    }
    const author =
      sanitizeText(String(body.author || 'System'), MAX_USERNAME_LEN) ||
      'System';
    const persistedMessage = this.persistChatMessage({
      senderId: 'admin',
      username: author,
      message: message.slice(0, 500),
      color: '#f43f5e',
      scope: 'global',
      roomId: null,
      timestamp: Date.now(),
    });
    this.broadcastChatMessage(persistedMessage);
    return jsonResponse({ ok: true });
  }

  private async handleAdminSyncRoom(request: Request): Promise<Response> {
    const parsed = await parseJsonObjectBody(request);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: 'Invalid request' }, 400);
    }
    const body = parsed.value;
    const roomId = typeof body.roomId === 'number' ? body.roomId : -1;
    if (roomId < 0 || roomId >= ROOM_COUNT) {
      return jsonResponse({ ok: false, error: 'Invalid room ID' }, 400);
    }
    const current = this.rooms[roomId] ?? DEFAULT_ROOMS[roomId];
    const nextRoom: RoomEvent = {
      roomId,
      name:
        typeof body.name === 'string'
          ? body.name.trim().slice(0, 48)
          : current.name,
      sourceType:
        body.sourceType === 'meet'
          ? 'meet'
          : body.sourceType === 'youtube'
            ? 'youtube'
            : current.sourceType,
      sourceValue:
        typeof body.sourceValue === 'string'
          ? body.sourceValue
          : current.sourceValue,
      startTime:
        typeof body.startTime === 'string' ? body.startTime : current.startTime,
      durationMinutes:
        typeof body.durationMinutes === 'number'
          ? Math.max(0, Math.min(1440, body.durationMinutes))
          : current.durationMinutes,
      updatedAt: Date.now(),
    };
    this.rooms[roomId] = nextRoom;
    this.persistRoom(nextRoom);
    this.broadcast({
      type: 'room_update',
      roomId: nextRoom.roomId,
      room: nextRoom,
    });
    return jsonResponse({ ok: true, room: nextRoom });
  }

  private handleAdminWorldAssets(): Response {
    const assets = this.worldAssets.map((a) => ({
      id: a.id,
      type: a.type,
      x: Number(a.x.toFixed(1)),
      z: Number(a.z.toFixed(1)),
      room: a.roomId,
    }));
    return jsonResponse({ ok: true, data: { count: assets.length, assets } });
  }

  private handleAdminWorldState(): Response {
    const players: Array<{
      id: string;
      username: string;
      color: string;
      x: number;
      y: number;
      z: number;
      room: number;
      isMoving: boolean;
      source: Session['source'];
    }> = [];
    for (const session of this.sessions.values()) {
      if (!session.player) continue;
      players.push({
        id: session.id,
        username: session.username,
        color: session.color,
        x: session.player.x,
        y: session.player.y,
        z: session.player.z,
        room: session.player.room,
        isMoving: session.player.isMoving,
        source: session.source,
      });
    }
    const worldState = {
      ok: true,
      data: {
        connectedSessions: this.sessions.size,
        activePlayers: players.length,
        players,
        rooms: this.rooms.map((r) => ({
          id: r.roomId,
          name: r.name,
          sourceType: r.sourceType,
          sourceValue: r.sourceValue
            ? r.sourceValue.slice(0, 30) +
              (r.sourceValue.length > 30 ? '...' : '')
            : null,
          hasEvent: !!r.sourceValue,
        })),
        worldAssetCount: this.worldAssets.length,
      },
    };
    return jsonResponse(worldState);
  }

  persistRoom(room: RoomEvent): void {
    const storedStartTime = parseStartTime(room.startTime);
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO room_events (room_id, name, source_value, start_time, duration_minutes)
       VALUES (?, ?, ?, ?, ?)`,
      room.roomId,
      room.name,
      room.sourceValue,
      storedStartTime,
      room.durationMinutes,
    );
  }

  private persistChatMessage(
    message: Omit<PersistedChatMessage, 'id'>,
  ): PersistedChatMessage {
    this.ctx.storage.sql.exec(
      `INSERT INTO chat_messages (sender_id, username, color, message, scope, room_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      message.senderId,
      message.username,
      message.color,
      message.message,
      message.scope,
      message.roomId,
      message.timestamp,
    );

    const insertedRow = this.ctx.storage.sql
      .exec('SELECT last_insert_rowid() AS id')
      .one() as { id: number | bigint } | null;
    const persistedMessage: PersistedChatMessage = {
      id: Number(insertedRow?.id ?? 0),
      ...message,
    };

    this.chatHistory.push(persistedMessage);
    if (this.chatHistory.length > MAX_CHAT_HISTORY) {
      this.chatHistory = this.chatHistory.slice(-MAX_CHAT_HISTORY);
      this.prunePersistedChatMessages();
    }

    return persistedMessage;
  }

  private getVisibleHistoryFor(
    player: Pick<Player, 'room'>,
  ): PersistedChatMessage[] {
    return getVisibleChatHistory(this.chatHistory, player, MAX_CHAT_HISTORY);
  }

  private toChatPayload(message: PersistedChatMessage) {
    return {
      type: 'chat' as const,
      messageId: message.id,
      id: message.senderId,
      username: message.username,
      color: message.color,
      message: message.message,
      scope: message.scope,
      roomId: message.roomId,
      timestamp: message.timestamp,
    };
  }

  private sendStorageInitWarning(ws: WebSocket): void {
    if (!this.storageInitError) return;
    this.send(ws, {
      type: 'error',
      message: `Server storage failed to initialize; using fallback room data. Details: ${this.storageInitError}`,
    });
  }

  private broadcastChatMessage(
    message: PersistedChatMessage,
    sender?: Pick<Player, 'room'> | null,
  ): void {
    this.broadcast(this.toChatPayload(message), undefined, (otherSession) =>
      Boolean(
        otherSession.disconnectedAt === null &&
          otherSession.player &&
          (!sender ||
            shouldDeliverChat(sender, otherSession.player, message.scope)),
      ),
    );
  }

  // --- Player relevance & movement batching ---

  private getRelevantPlayersFor(recipient: Player): Player[] {
    const players: Player[] = [];
    for (const session of this.sessions.values()) {
      if (!session.player || session.player.id === recipient.id) continue;
      if (arePlayersRelevant(recipient, session.player)) {
        players.push({ ...session.player });
      }
    }
    return players;
  }

  private markPlayerDirty(playerId: string): void {
    this.dirtyPlayerIds.add(playerId);
  }

  private scheduleMoveFlush(): void {
    if (this.moveFlushScheduled) return;
    this.moveFlushScheduled = true;
    void this.ctx.storage.setAlarm(
      Date.now() + MetalyceumWorld.MOVE_FLUSH_INTERVAL_MS,
    );
  }

  private flushMovementBatch(): void {
    for (const [ws, session] of this.sessions.entries()) {
      const recipient = session.player;
      if (!recipient) continue;
      // Skip sessions in disconnect grace period — don't send updates to closed WebSockets
      if (session.disconnectedAt !== null) continue;

      const nextVisiblePlayerIds = new Set<string>();
      const joiningPlayers: Player[] = [];
      const updatedPlayers: Array<
        Pick<Player, 'id' | 'x' | 'y' | 'z' | 'ry' | 'isMoving' | 'room'>
      > = [];

      for (const otherSession of this.sessions.values()) {
        const other = otherSession.player;
        if (!other || other.id === recipient.id) continue;
        if (!arePlayersRelevant(recipient, other)) continue;

        nextVisiblePlayerIds.add(other.id);
        if (!session.visiblePlayerIds.has(other.id)) {
          joiningPlayers.push({ ...other });
          continue;
        }
        if (this.dirtyPlayerIds.has(other.id)) {
          updatedPlayers.push({
            id: other.id,
            x: other.x,
            y: other.y,
            z: other.z,
            ry: other.ry,
            isMoving: other.isMoving,
            room: other.room,
          });
        }
      }

      for (const playerId of session.visiblePlayerIds) {
        if (!nextVisiblePlayerIds.has(playerId)) {
          this.send(ws, { type: 'leave', id: playerId });
        }
      }
      for (const player of joiningPlayers)
        this.send(ws, { type: 'join', player });
      if (updatedPlayers.length > 0) {
        this.send(ws, { type: 'state_batch', players: updatedPlayers });
      }
      session.visiblePlayerIds = nextVisiblePlayerIds;
    }
    this.dirtyPlayerIds.clear();
  }

  // --- WebSocket handler ---

  async fetch(request: Request): Promise<Response> {
    this.rebuildSessionsIfNeeded(); // restore sessions after hibernation
    const url = new URL(request.url);
    this.pruneStaleSessions();

    // --- Internal admin proxy endpoints (called from AdminDO) ---
    if (
      url.pathname === INTERNAL_ADMIN_PATHS.broadcast &&
      request.method === 'POST'
    ) {
      return this.handleAdminBroadcast(request);
    }
    if (
      url.pathname === INTERNAL_ADMIN_PATHS.worldState &&
      request.method === 'GET'
    ) {
      return this.handleAdminWorldState();
    }
    if (
      url.pathname === INTERNAL_ADMIN_PATHS.syncRoom &&
      request.method === 'POST'
    ) {
      return this.handleAdminSyncRoom(request);
    }
    if (
      url.pathname === INTERNAL_ADMIN_PATHS.worldAssets &&
      request.method === 'GET'
    ) {
      return this.handleAdminWorldAssets();
    }

    // --- Debug / health-check endpoint ---
    if (url.pathname === '/debug') {
      const players = Array.from(this.sessions.values()).map((s) => ({
        id: s.id,
        username: s.username,
        color: s.color,
        hasPlayer: !!s.player,
        position: s.player
          ? { x: s.player.x, y: s.player.y, z: s.player.z, room: s.player.room }
          : null,
        bucket: s.bucket
          ? { tokens: s.bucket.tokens, last: s.bucket.last }
          : null,
        visibleCount: s.visiblePlayerIds.size,
        source: s.source,
      }));

      const rooms = this.rooms.map((r) => ({
        id: r.roomId,
        name: r.name,
        sourceType: r.sourceType,
        sourceValue:
          r.sourceValue?.substring(0, 20) +
          (r.sourceValue?.length > 20 ? '...' : ''),
        startTime: r.startTime,
        durationMinutes: r.durationMinutes,
      }));

      const recentEvents = getRecentEvents(20);
      const body = JSON.stringify(
        {
          ok: true,
          version: 1,
          ts: Date.now(),
          diagnostics: {
            sessionCount: this.sessions.size,
            playerCount: players.filter((p) => p.hasPlayer).length,
            worldAssetCount: this.worldAssets.length,
            activeWebSockets: this.ctx.getWebSockets().length,
            dirtyPlayerCount: this.dirtyPlayerIds.size,
            storageInitError: this.storageInitError,
          },
          rooms,
          players,
          recentEvents,
        },
        null,
        2,
      );

      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isWebSocket =
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    if (url.pathname === '/ws' && isWebSocket) {
      if (this.sessions.size >= MAX_PLAYERS) {
        return new Response('Room full', { status: 429 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server); // hibernation API — DO sleeps between messages

      const username =
        sanitizeText(url.searchParams.get('username'), MAX_USERNAME_LEN) ||
        'Guest';
      const color = sanitizeColor(url.searchParams.get('color'));
      const source = getSessionSource(request);

      // Check for a disconnected session to revive (grace-period reconnect)
      const graceTimer = this.disconnectedGraceTimers.get(username);
      if (graceTimer !== undefined) {
        clearTimeout(graceTimer);
        this.disconnectedGraceTimers.delete(username);

        for (const [oldWs, oldSession] of this.sessions.entries()) {
          if (
            oldSession.username === username &&
            oldSession.disconnectedAt !== null
          ) {
            // Revive this session — swap WebSocket, clear disconnected state
            oldSession.disconnectedAt = null;
            oldSession.lastSeenAt = Date.now();
            oldSession.source = source;

            this.sessions.delete(oldWs);
            this.sessions.set(server, oldSession);
            this.ctx.acceptWebSocket(server); // hibernation API
            this.serializeSession(server, oldSession);

            // Re-init with existing player data — no broadcast of "join"
            if (oldSession.player) {
              const visiblePlayers = this.getRelevantPlayersFor(
                oldSession.player,
              );
              oldSession.visiblePlayerIds = new Set(
                visiblePlayers.map((p) => p.id),
              );
              this.send(server, {
                type: 'init',
                id: oldSession.id,
                players: visiblePlayers,
                rooms: this.rooms,
                worldAssets: this.worldAssets,
                chatHistory: this.getVisibleHistoryFor(oldSession.player).map(
                  (entry) => this.toChatPayload(entry),
                ),
              });
              this.sendStorageInitWarning(server);
            }

            logEvent('player_reconnected', { id: oldSession.id, username });
            return new Response(null, { status: 101, webSocket: client });
          }
        }
        // Grace timer existed but session was already cleaned up — fall through to normal connect
      }

      // Normal first-time connection — no prior session to revive
      const id = crypto.randomUUID();
      const session: Session = {
        id,
        username,
        color,
        player: null,
        bucket: { tokens: BUCKET_CAPACITY, last: Date.now() },
        lastChatAt: 0,
        lastSeenAt: Date.now(),
        visiblePlayerIds: new Set(),
        source,
        disconnectedAt: null,
      };
      this.sessions.set(server, session);
      this.serializeSession(server, session); // persist for hibernation

      logEvent('player_connected', {
        id,
        username,
        clientType: source.clientType,
        originHost: source.originHost,
        refererHost: source.refererHost,
        userAgent: source.userAgent,
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  // --- Message dispatch table ---

  private readonly messageHandlers: Record<
    string,
    (ws: WebSocket, msg: Record<string, unknown>, session: Session) => void
  > = {
    heartbeat: (ws) => {
      this.send(ws, { type: 'heartbeat_ack' });
    },

    world_assets: (ws, msg, session) => {
      try {
        const parsed = parseWorldAssets(
          msg.assets,
          this.worldAssetValidation(),
        );
        if (!parsed) {
          this.send(ws, { type: 'error', message: 'Invalid world assets.' });
          return;
        }
        this.worldAssets = parsed;
        this.ctx.storage.sql.exec('BEGIN');
        try {
          this.ctx.storage.sql.exec('DELETE FROM world_assets');
          for (const asset of parsed) {
            this.ctx.storage.sql.exec(
              `INSERT INTO world_assets (id, asset_type, x, y, z, rotation_y, scale, room_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              asset.id,
              asset.type,
              asset.x,
              asset.y,
              asset.z,
              asset.rotationY,
              asset.scale,
              asset.roomId,
            );
          }
          this.ctx.storage.sql.exec('COMMIT');
        } catch (e) {
          this.ctx.storage.sql.exec('ROLLBACK');
          throw e;
        }
        this.broadcast({ type: 'world_assets', assets: this.worldAssets });
      } catch (error) {
        logEvent('set_world_assets_rejected', {
          id: session.id,
          username: session.username,
          error: error instanceof Error ? error.message : String(error),
        });
        this.send(ws, { type: 'error', message: 'Invalid world assets.' });
      }
    },

    set_room_event: (ws, msg) => {
      const roomId = clampNum(Number(msg.roomId), 0, ROOM_COUNT - 1, 0);
      const currentRoom = this.rooms[roomId] ?? DEFAULT_ROOMS[roomId];
      const rawVideoInput = String(msg.videoId ?? '').trim();
      const parsedSource = rawVideoInput
        ? parseOptionalVideoInput(msg.videoId)
        : null;
      const nextSourceValue =
        parsedSource !== null ? parsedSource : currentRoom.sourceValue;
      const nextRoom: RoomEvent = {
        roomId,
        name: sanitizeText(msg.name, MAX_ROOM_NAME_LEN) || currentRoom.name,
        sourceType: deriveSourceType(nextSourceValue),
        sourceValue: nextSourceValue,
        startTime: parseStartTime(msg.startTime) ?? currentRoom.startTime,
        durationMinutes: parseDurationMinutes(
          msg.durationMinutes,
          currentRoom.durationMinutes,
        ),
        updatedAt: Date.now(),
      };
      this.rooms[roomId] = nextRoom;
      this.persistRoom(nextRoom);
      this.broadcast({
        type: 'room_update',
        roomId: nextRoom.roomId,
        room: nextRoom,
      });
    },

    join: (ws, msg, session) => {
      const x = clampNum(Number(msg.x), -WORLD_LIMIT, WORLD_LIMIT, 0);
      const y = clampNum(Number(msg.y), Y_MIN, Y_MAX, 0);
      const z = clampNum(Number(msg.z), -WORLD_LIMIT, WORLD_LIMIT, 0);
      const player: Player = {
        id: session.id,
        username: session.username,
        color: session.color,
        x,
        y,
        z,
        ry: Number(msg.ry) || 0,
        isMoving: false,
        room: clampNum(Number(msg.room), -1, ROOM_COUNT - 1, -1),
      };

      session.player = player;
      const visiblePlayers = this.getRelevantPlayersFor(player);
      session.visiblePlayerIds = new Set(visiblePlayers.map((p) => p.id));
      this.send(ws, {
        type: 'init',
        id: session.id,
        players: visiblePlayers,
        rooms: this.rooms,
        worldAssets: this.worldAssets,
        chatHistory: this.getVisibleHistoryFor(player).map((entry) =>
          this.toChatPayload(entry),
        ),
      });
      this.sendStorageInitWarning(ws);
      this.broadcast({ type: 'join', player }, session.id, (otherSession) =>
        Boolean(
          otherSession.player &&
            arePlayersRelevant(otherSession.player, player),
        ),
      );
      logEvent('player_joined', { id: session.id, username: session.username });
      this.serializeSession(ws, session); // persist so it survives hibernation
      // Ensure the prune alarm is scheduled while sessions exist — but never
      // clobber a pending movement-flush alarm (a DO has only one alarm slot;
      // alarm() re-arms the prune schedule itself after each flush).
      if (!this.moveFlushScheduled) {
        void this.ctx.storage.setAlarm(Date.now() + STALE_SESSION_MS);
      }
    },

    move: (ws, msg, session) => {
      if (!session.player) return;
      const now = Date.now();
      const bucket = session.bucket;
      bucket.tokens = Math.min(
        BUCKET_CAPACITY,
        bucket.tokens + ((now - bucket.last) / 1000) * BUCKET_REFILL,
      );
      bucket.last = now;
      if (bucket.tokens < 1) return;
      bucket.tokens -= 1;

      const x = clampNum(
        Number(msg.x),
        -WORLD_LIMIT,
        WORLD_LIMIT,
        session.player.x,
      );
      const y = clampNum(Number(msg.y), Y_MIN, Y_MAX, session.player.y);
      const z = clampNum(
        Number(msg.z),
        -WORLD_LIMIT,
        WORLD_LIMIT,
        session.player.z,
      );
      const ry = Number(msg.ry) || 0;
      const isMoving = Boolean(msg.isMoving);
      const dx = x - session.player.x;
      const dy = y - session.player.y;
      const dz = z - session.player.z;
      if (dx * dx + dy * dy + dz * dz > MAX_MOVE_STEP_SQ) return;

      session.player.x = x;
      session.player.y = y;
      session.player.z = z;
      session.player.ry = ry;
      session.player.isMoving = isMoving;
      this.markPlayerDirty(session.id);
      this.scheduleMoveFlush();
    },

    room_change: (ws, msg, session) => {
      if (!session.player) return;
      const room = clampNum(
        Number(msg.room),
        -1,
        ROOM_COUNT - 1,
        session.player.room,
      );
      session.player.room = room;
      this.markPlayerDirty(session.id);
      this.scheduleMoveFlush();
      this.serializeSession(ws, session); // room affects relevance — persist it
    },

    chat: (ws, msg, session) => {
      if (!session.player) return;
      const scope = normalizeChatScope(msg.scope, session.player);
      const now = Date.now();
      if (now - session.lastChatAt < CHAT_MIN_INTERVAL) return;
      session.lastChatAt = now;
      const message = sanitizeText(msg.message, MAX_CHAT_LEN);
      if (!message) return;

      const persistedMessage = this.persistChatMessage({
        senderId: session.id,
        username: session.username,
        color: session.color,
        message,
        scope,
        roomId: scope === 'room' ? session.player.room : null,
        timestamp: now,
      });

      this.broadcastChatMessage(persistedMessage, session.player);
    },
  };

  handleMessage(ws: WebSocket, raw: unknown): void {
    this.pruneStaleSessions();
    const session = this.sessions.get(ws);
    if (!session) return;
    session.lastSeenAt = Date.now();

    const parsed = parseJsonObjectText(String(raw));
    if (!parsed.ok) {
      logEvent('invalid_ws_payload', {
        id: session.id,
        username: session.username,
        error: parsed.error,
      });
      return;
    }
    const msg = parsed.value;

    const handler = this.messageHandlers[msg.type as string];
    if (handler) {
      handler.call(this, ws, msg, session);
    }
  }

  closeHandler(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (!session) return;

    // Already in grace period — ignore duplicate close/error events
    if (session.disconnectedAt !== null) return;

    // Enter grace period: keep the session/player so other clients don't
    // see a leave/join cycle for brief disconnects.
    session.disconnectedAt = Date.now();
    session.lastSeenAt = session.disconnectedAt;
    this.serializeSession(ws, session); // persist disconnectedAt so it survives hibernation

    const username = session.username;
    const timer = globalThis.setTimeout(() => {
      this.disconnectedGraceTimers.delete(username);
      this.expireDisconnectedSession(ws);
    }, DISCONNECT_GRACE_MS);
    this.disconnectedGraceTimers.set(username, timer);

    logEvent('player_disconnected_grace', {
      id: session.id,
      username: session.username,
    });
  }

  /** Full cleanup after the grace period expires without a reconnect. */
  private expireDisconnectedSession(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (!session || session.disconnectedAt === null) return;

    this.sessions.delete(ws);
    if (session.player) {
      for (const [otherWs, otherSession] of this.sessions.entries()) {
        if (!otherSession.visiblePlayerIds.has(session.id)) continue;
        otherSession.visiblePlayerIds.delete(session.id);
        this.send(otherWs, { type: 'leave', id: session.id });
      }
      logEvent('player_left', { id: session.id, username: session.username });
    }

    if (this.ctx.getWebSockets().length === 0) {
      this.dirtyPlayerIds.clear();
      // No connections remain — cancel the prune alarm so the DO can go idle.
      try {
        void this.ctx.storage.deleteAlarm();
      } catch (error) {
        logEvent('delete_alarm_failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Alarm handler: periodically prune stale sessions even when players are
   * idle and no WebSocket messages are arriving.  Reschedules itself as long
   * as at least one session is open.
   */
  async alarm(): Promise<void> {
    this.rebuildSessionsIfNeeded(); // sessions may be empty after hibernation
    const now = Date.now();
    this.moveFlushScheduled = false;

    if (this.dirtyPlayerIds.size > 0) this.flushMovementBatch();

    if (now - this.lastPruneAt >= MetalyceumWorld.PRUNE_INTERVAL_MS) {
      this.lastPruneAt = 0; // bypass the debounce so the scan always runs
      this.pruneStaleSessions(now);
      this.lastPruneAt = now;
    }

    // Reschedule while WebSocket connections remain open. Movement re-arms
    // its own fast alarm via scheduleMoveFlush(); idle worlds get the slow
    // prune alarm only, so the DO can hibernate between ticks.
    if (this.ctx.getWebSockets().length > 0) {
      await this.ctx.storage.setAlarm(now + STALE_SESSION_MS);
    }
  }
}
