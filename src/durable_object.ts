import { DurableObject } from "cloudflare:workers";
import {
  sanitizeText,
  clampNum,
  sanitizeColor,
  deriveSourceType,
  parseOptionalVideoInput,
  parseStartTime,
  parseDurationMinutes,
  parseWorldAssets,
  type WorldAssetDefinition
} from "./validation";
import {
  type Bindings,
  ROOM_COUNT,
  type RoomEvent,
  DEFAULT_ROOMS,
  type Player,
  type Session,
  MAX_PLAYERS,
  MAX_USERNAME_LEN,
  MAX_CHAT_LEN,
  WORLD_LIMIT,
  Y_MIN,
  Y_MAX,
  MAX_MOVE_STEP,
  CHAT_MIN_INTERVAL,
  BUCKET_CAPACITY,
  BUCKET_REFILL,
  MAX_ROOM_NAME_LEN,
  MAX_WORLD_ASSETS,
  MOVEMENT_BATCH_INTERVAL_MS
} from "./constants";
import { arePlayersRelevant, shouldDeliverChat } from "./realtime";

export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ts: Date.now(), ...fields }));
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

export class MetalyceumWorld extends DurableObject {
  sessions: Map<WebSocket, Session> = new Map();
  rooms: RoomEvent[] = [];
  worldAssets: WorldAssetDefinition[] = [];
  private readonly dirtyPlayerIds = new Set<string>();
  private flushTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      try {
        this.ctx.storage.sql.exec(
          `CREATE TABLE IF NOT EXISTS room_events (
            room_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            source_value TEXT NOT NULL,
            start_time TEXT,
            duration_minutes INTEGER NOT NULL DEFAULT 0
          )`
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
          )`
        );

        const countCursor = this.ctx.storage.sql.exec("SELECT COUNT(*) as cnt FROM room_events");
        const count = Number((countCursor.one() as { cnt: number } | null)?.cnt ?? 0);
        if (count === 0) {
          const migratedSources = new Map<number, string>();
          if (this.tableExists("room_videos")) {
            const oldRows = this.ctx.storage.sql.exec(
              "SELECT room_id, video_id FROM room_videos ORDER BY room_id ASC"
            ).toArray() as { room_id: number; video_id: string }[];
            for (const row of oldRows) {
              if (row.room_id >= 0 && row.room_id < ROOM_COUNT) {
                migratedSources.set(row.room_id, row.video_id);
              }
            }
          }

          for (const defaults of DEFAULT_ROOMS) {
            this.persistRoom({
              ...defaults,
              sourceValue: migratedSources.get(defaults.roomId) ?? defaults.sourceValue
            });
          }
        }

        const roomRows = this.ctx.storage.sql.exec(
          `SELECT room_id, name, source_value, start_time, duration_minutes
           FROM room_events
           ORDER BY room_id ASC`
        ).toArray() as {
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
              defaults.durationMinutes
            ),
            updatedAt: defaults.updatedAt
          });
        }

        this.rooms = DEFAULT_ROOMS.map((defaults) => roomMap.get(defaults.roomId) ?? defaults);

        const assetRows = this.ctx.storage.sql.exec(
          `SELECT id, asset_type, x, y, z, rotation_y, scale, room_id
           FROM world_assets
           ORDER BY rowid ASC`
        ).toArray() as PersistedAssetRow[];

        const parsedAssets = parseWorldAssets(
          assetRows.map((row) => ({
            id: row.id,
            type: row.asset_type,
            x: row.x,
            y: row.y,
            z: row.z,
            rotationY: row.rotation_y,
            scale: row.scale,
            roomId: row.room_id
          })),
          this.worldAssetValidation()
        );

        this.worldAssets = parsedAssets ?? [];
        if (!parsedAssets && assetRows.length > 0) {
          logEvent("world_assets_load_repaired", { originalCount: assetRows.length });
        }
      } catch (error) {
        logEvent("storage_init_error", {
          error: error instanceof Error ? error.message : String(error)
        });
        this.rooms = DEFAULT_ROOMS.map((room) => ({ ...room }));
        this.worldAssets = [];
      }
    });
  }

  tableExists(tableName: string): boolean {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      tableName
    );
    return cursor.one() !== null;
  }

  private worldAssetValidation() {
    return {
      worldLimit: WORLD_LIMIT,
      yMin: Y_MIN,
      yMax: Y_MAX,
      roomCount: ROOM_COUNT,
      maxAssets: Math.max(1, Math.min(MAX_WORLD_ASSETS, 200))
    };
  }

  private send(ws: WebSocket, msg: object): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.closeHandler(ws);
    }
  }

  broadcast(msg: object, excludeId?: string, predicate?: (session: Session) => boolean): void {
    for (const [ws, session] of this.sessions.entries()) {
      if (excludeId && session.id === excludeId) continue;
      if (predicate && !predicate(session)) continue;
      this.send(ws, msg);
    }
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
      room.durationMinutes
    );
  }

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

  private scheduleMovementFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = globalThis.setTimeout(() => {
      this.flushTimer = null;
      this.flushMovementBatch();
    }, MOVEMENT_BATCH_INTERVAL_MS);
  }

  private flushMovementBatch(): void {
    for (const [ws, session] of this.sessions.entries()) {
      const recipient = session.player;
      if (!recipient) continue;

      const nextVisiblePlayerIds = new Set<string>();
      const joiningPlayers: Player[] = [];
      const updatedPlayers: Array<Pick<Player, "id" | "x" | "y" | "z" | "ry" | "isMoving" | "room">> =
        [];

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
            room: other.room
          });
        }
      }

      for (const playerId of session.visiblePlayerIds) {
        if (!nextVisiblePlayerIds.has(playerId)) {
          this.send(ws, { type: "leave", id: playerId });
        }
      }

      for (const player of joiningPlayers) {
        this.send(ws, { type: "join", player });
      }

      if (updatedPlayers.length > 0) {
        this.send(ws, { type: "state_batch", players: updatedPlayers });
      }

      session.visiblePlayerIds = nextVisiblePlayerIds;
    }

    this.dirtyPlayerIds.clear();
  }

  fetch(request: Request): Response {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
    if (url.pathname === "/ws" && isWebSocket) {
      if (this.sessions.size >= MAX_PLAYERS) {
        return new Response("Room full", { status: 429 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.accept();

      const id = crypto.randomUUID();
      const username = sanitizeText(url.searchParams.get("username"), MAX_USERNAME_LEN) || "Guest";
      const color = sanitizeColor(url.searchParams.get("color"));
      const session: Session = {
        id,
        username,
        color,
        player: null,
        bucket: { tokens: BUCKET_CAPACITY, last: Date.now() },
        lastChatAt: 0,
        visiblePlayerIds: new Set()
      };
      this.sessions.set(server, session);

      logEvent("player_connected", { id, username });
      server.addEventListener("message", (event: Event) => {
        const messageEvent = event as MessageEvent;
        this.handleMessage(server, messageEvent.data);
      });
      server.addEventListener("close", () => this.closeHandler(server));
      server.addEventListener("error", () => this.closeHandler(server));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  handleMessage(ws: WebSocket, raw: unknown): void {
    const session = this.sessions.get(ws);
    if (!session) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      return;
    }

    if (msg.type === "heartbeat") return;

    if (msg.type === "world_assets") {
      try {
        const parsed = parseWorldAssets(msg.assets, this.worldAssetValidation());
        if (!parsed) {
          this.send(ws, { type: "error", message: "Invalid world assets." });
          return;
        }

        this.worldAssets = parsed;
        this.ctx.storage.sql.exec("DELETE FROM world_assets");
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
            asset.roomId
          );
        }

        this.broadcast({ type: "world_assets", assets: this.worldAssets });
      } catch {
        this.send(ws, { type: "error", message: "Invalid world assets." });
      }
      return;
    }

    if (msg.type === "set_room_event") {
      const roomId = clampNum(Number(msg.roomId), 0, ROOM_COUNT - 1, 0);
      const currentRoom = this.rooms[roomId] ?? DEFAULT_ROOMS[roomId];
      const rawVideoInput = String(msg.videoId ?? "").trim();
      const parsedSource = rawVideoInput ? parseOptionalVideoInput(msg.videoId) : null;
      const nextSourceValue = parsedSource !== null ? parsedSource : currentRoom.sourceValue;
      const nextRoom: RoomEvent = {
        roomId,
        name: sanitizeText(msg.name, MAX_ROOM_NAME_LEN) || currentRoom.name,
        sourceType: deriveSourceType(nextSourceValue),
        sourceValue: nextSourceValue,
        startTime: parseStartTime(msg.startTime) ?? currentRoom.startTime,
        durationMinutes: parseDurationMinutes(msg.durationMinutes, currentRoom.durationMinutes),
        updatedAt: Date.now()
      };
      this.rooms[roomId] = nextRoom;
      this.persistRoom(nextRoom);
      this.broadcast({ type: "rooms_state", rooms: this.rooms });
      return;
    }

    if (msg.type === "join") {
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
        room: -1
      };

      session.player = player;
      const visiblePlayers = this.getRelevantPlayersFor(player);
      session.visiblePlayerIds = new Set(visiblePlayers.map((visiblePlayer) => visiblePlayer.id));
      this.send(ws, {
        type: "init",
        id: session.id,
        players: visiblePlayers,
        rooms: this.rooms,
        worldAssets: this.worldAssets
      });
      this.broadcast(
        { type: "join", player },
        session.id,
        (otherSession) =>
          Boolean(otherSession.player && arePlayersRelevant(otherSession.player, player))
      );

      logEvent("player_joined", { id: session.id, username: session.username });
      return;
    }

    if (msg.type === "move" && session.player) {
      const now = Date.now();
      const bucket = session.bucket;
      bucket.tokens = Math.min(
        BUCKET_CAPACITY,
        bucket.tokens + ((now - bucket.last) / 1000) * BUCKET_REFILL
      );
      bucket.last = now;
      if (bucket.tokens < 1) return;
      bucket.tokens -= 1;

      const x = clampNum(Number(msg.x), -WORLD_LIMIT, WORLD_LIMIT, session.player.x);
      const y = clampNum(Number(msg.y), Y_MIN, Y_MAX, session.player.y);
      const z = clampNum(Number(msg.z), -WORLD_LIMIT, WORLD_LIMIT, session.player.z);
      const ry = Number(msg.ry) || 0;
      const isMoving = Boolean(msg.isMoving);
      const dx = x - session.player.x;
      const dy = y - session.player.y;
      const dz = z - session.player.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > MAX_MOVE_STEP) return;

      session.player.x = x;
      session.player.y = y;
      session.player.z = z;
      session.player.ry = ry;
      session.player.isMoving = isMoving;
      this.markPlayerDirty(session.id);
      this.scheduleMovementFlush();
      return;
    }

    if (msg.type === "room_change" && session.player) {
      const room = clampNum(Number(msg.room), -1, ROOM_COUNT - 1, session.player.room);
      session.player.room = room;
      this.markPlayerDirty(session.id);
      this.flushMovementBatch();
      return;
    }

    if (msg.type === "chat" && session.player) {
      const now = Date.now();
      if (now - session.lastChatAt < CHAT_MIN_INTERVAL) return;
      session.lastChatAt = now;
      const message = sanitizeText(msg.message, MAX_CHAT_LEN);
      if (!message) return;

      this.broadcast(
        { type: "chat", id: session.id, username: session.username, color: session.color, message },
        session.id,
        (otherSession) =>
          Boolean(otherSession.player && shouldDeliverChat(session.player!, otherSession.player))
      );
    }
  }

  closeHandler(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (!session) return;

    this.sessions.delete(ws);
    if (session.player) {
      for (const [otherWs, otherSession] of this.sessions.entries()) {
        if (!otherSession.visiblePlayerIds.has(session.id)) continue;
        otherSession.visiblePlayerIds.delete(session.id);
        this.send(otherWs, { type: "leave", id: session.id });
      }
      logEvent("player_left", { id: session.id, username: session.username });
    }

    if (this.sessions.size === 0 && this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
      this.dirtyPlayerIds.clear();
    }
  }
}
