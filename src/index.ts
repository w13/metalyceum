import { DurableObject } from "cloudflare:workers";
import {
  sanitizeText,
  clampNum,
  sanitizeColor,
  deriveSourceType,
  parseVideoInput,
  parseOptionalVideoInput,
  parseStartTime,
  parseDurationMinutes
} from "./validation";

interface Env {
  METALYCEUM_WORLD: DurableObjectNamespace;
  ASSETS: { fetch: typeof fetch };
}

const ROOM_COUNT = 8;

interface RoomEvent {
  roomId: number;
  name: string;
  sourceValue: string;
  startTime: string | null;
  durationMinutes: number;
  updatedAt: number;
}

const DEFAULT_ROOMS: RoomEvent[] = [
  { roomId: 0, name: "North Hall", sourceValue: "jfKfPfyJRdk", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { roomId: 1, name: "East Studio", sourceValue: "tntOCGkgt98", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { roomId: 2, name: "Open Workshop", sourceValue: "9umH2C-Gf5U", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { roomId: 3, name: "Broadcast Room", sourceValue: "Fz1z7xWjGug", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { roomId: 4, name: "South Lounge", sourceValue: "Q1M_V502Gms", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { roomId: 5, name: "Crit Room", sourceValue: "5qap5aO4i9A", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { roomId: 6, name: "Screening Room", sourceValue: "hHW1oY26kxQ", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { roomId: 7, name: "Commons", sourceValue: "2g811Ny7FBE", startTime: null, durationMinutes: 0, updatedAt: 0 }
];

interface Player {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
  ry: number; // Y rotation (facing direction)
  color: string;
  avatar: string;
  room: number; // -1 for outdoor, 0-7 for rooms
  isMoving: boolean;
}

interface Session {
  id: string;
  player?: Player;
  tokens: number;     // token-bucket allowance for flood protection
  lastRefill: number; // ms timestamp of last bucket refill
  lastChat: number;   // ms timestamp of last accepted chat message
}

// --- Validation constants & helpers (server-side trust boundary) ---
const MAX_PLAYERS = 10;        // matches the "10 Players" UI capacity
const MAX_USERNAME_LEN = 24;
const MAX_CHAT_LEN = 280;
const WORLD_LIMIT = 80;        // |x|,|z| bound (client map is 150 wide → ±75)
const Y_MIN = -10;
const Y_MAX = 40;
const MAX_MOVE_STEP = 15;      // reject single-message teleports larger than this
const CHAT_MIN_INTERVAL = 400; // ms between accepted chat messages
const BUCKET_CAPACITY = 180;   // burst allowance per connection
const BUCKET_REFILL = 90;      // tokens/sec (legit movement peaks ~60/s)
const MAX_ROOM_NAME_LEN = 48;

// Pure validation/sanitization helpers live in ./validation (unit-tested).

// Emit a single-line JSON event for Workers Logs / `wrangler tail`.
function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ts: Date.now(), ...fields }));
}

export class MetalyceumWorld extends DurableObject {
  sessions: Map<WebSocket, Session> = new Map();
  rooms: RoomEvent[] = [];

  private tableExists(tableName: string): boolean {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
      tableName
    );
    return cursor.toArray().length > 0;
  }

  private persistRoom(room: RoomEvent): void {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO room_events
        (room_id, name, source_value, start_time, duration_minutes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      room.roomId,
      room.name,
      room.sourceValue,
      room.startTime,
      room.durationMinutes,
      room.updatedAt
    );
  }

  private serializeRoom(room: RoomEvent) {
    return {
      ...room,
      sourceType: deriveSourceType(room.sourceValue)
    };
  }

  // Token-bucket flood protection: refills over time, each message costs 1.
  // Sized so legitimate movement (~60 msgs/s) passes while abuse is capped.
  private allow(session: Session, cost = 1): boolean {
    const now = Date.now();
    const elapsed = (now - session.lastRefill) / 1000;
    session.tokens = Math.min(BUCKET_CAPACITY, session.tokens + elapsed * BUCKET_REFILL);
    session.lastRefill = now;
    if (session.tokens < cost) return false;
    session.tokens -= cost;
    return true;
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Retrieve saved room metadata or initialize/migrate using SQLite Storage API.
    this.ctx.blockConcurrencyWhile(async () => {
      try {
        this.ctx.storage.sql.exec(
          `CREATE TABLE IF NOT EXISTS room_events (
            room_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            source_value TEXT NOT NULL,
            start_time TEXT,
            duration_minutes INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
          )`
        );

        const countCursor = this.ctx.storage.sql.exec("SELECT COUNT(*) as cnt FROM room_events");
        const count = (countCursor.toArray() as { cnt: number }[])[0]?.cnt ?? 0;

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

          const seedTime = Date.now();
          for (const defaults of DEFAULT_ROOMS) {
            this.persistRoom({
              ...defaults,
              sourceValue: migratedSources.get(defaults.roomId) ?? defaults.sourceValue,
              updatedAt: seedTime
            });
          }
        }

        const roomRows = this.ctx.storage.sql.exec(
          `SELECT room_id, name, source_value, start_time, duration_minutes, updated_at
           FROM room_events
           ORDER BY room_id ASC`
        ).toArray() as {
          room_id: number;
          name: string;
          source_value: string;
          start_time: string | null;
          duration_minutes: number;
          updated_at: number;
        }[];

        const roomMap = new Map<number, RoomEvent>();
        for (const row of roomRows) {
          if (row.room_id < 0 || row.room_id >= ROOM_COUNT) continue;
          const defaults = DEFAULT_ROOMS[row.room_id];
          roomMap.set(row.room_id, {
            roomId: row.room_id,
            name: sanitizeText(row.name, MAX_ROOM_NAME_LEN) || defaults.name,
            sourceValue: parseOptionalVideoInput(row.source_value) ?? defaults.sourceValue,
            startTime: parseStartTime(row.start_time),
            durationMinutes: parseDurationMinutes(row.duration_minutes, defaults.durationMinutes),
            updatedAt: typeof row.updated_at === "number" && Number.isFinite(row.updated_at) ? row.updated_at : 0
          });
        }

        const repairedRooms: RoomEvent[] = [];
        const now = Date.now();
        for (const defaults of DEFAULT_ROOMS) {
          const room = roomMap.get(defaults.roomId) ?? { ...defaults, updatedAt: now };
          repairedRooms.push(room);
          if (!roomMap.has(defaults.roomId)) {
            this.persistRoom(room);
          }
        }
        this.rooms = repairedRooms;
      } catch (err) {
        console.error("Failed to initialize SQLite storage:", err);
        this.rooms = DEFAULT_ROOMS.map((room) => ({ ...room }));
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      // Expect WebSocket upgrade
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [clientSocket, serverSocket] = Object.values(pair);

      await this.handleSession(serverSocket);

      return new Response(null, {
        status: 101,
        webSocket: clientSocket,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  async handleSession(socket: WebSocket) {
    // Accept connection
    socket.accept();

    const id = crypto.randomUUID();
    this.sessions.set(socket, {
      id,
      tokens: BUCKET_CAPACITY,
      lastRefill: Date.now(),
      lastChat: 0
    });

    // Initial state setup for the socket
    socket.addEventListener("message", async (msg) => {
      try {
        if (typeof msg.data !== "string") return;
        if (msg.data.length > 4096) return; // reject oversized frames outright

        const session = this.sessions.get(socket);
        if (!session) return;

        // Per-connection flood protection (covers every message type)
        if (!this.allow(session)) return;

        const data = JSON.parse(msg.data);
        if (!data || typeof data !== "object" || typeof data.type !== "string") return;

        switch (data.type) {
          case "join": {
            // Enforce world capacity (ignore re-joins from an existing session)
            if (!session.player) {
              const joined = Array.from(this.sessions.values()).filter((s) => s.player).length;
              if (joined >= MAX_PLAYERS) {
                logEvent("join_rejected", { id, reason: "world_full", players: joined });
                socket.send(JSON.stringify({
                  type: "error",
                  reason: `World is full (max ${MAX_PLAYERS} players).`
                }));
                socket.close(1013, "World full");
                return;
              }
            }

            const player: Player = {
              id,
              username: sanitizeText(data.username, MAX_USERNAME_LEN) || "Guest",
              x: clampNum(data.x, -WORLD_LIMIT, WORLD_LIMIT, 0),
              y: clampNum(data.y, Y_MIN, Y_MAX, 0),
              z: clampNum(data.z, -WORLD_LIMIT, WORLD_LIMIT, 0),
              ry: clampNum(data.ry, -1000, 1000, 0),
              color: sanitizeColor(data.color),
              avatar: sanitizeText(data.avatar, 20) || "explorer",
              room: -1,
              isMoving: false
            };

            session.player = player;

            // Send full initial state to this new client
            const playersList = Array.from(this.sessions.values())
              .filter((s) => s.player && s.id !== id)
              .map((s) => s.player!);

            socket.send(JSON.stringify({
              type: "init",
              playerId: id,
              players: playersList,
              rooms: this.rooms.map((room) => this.serializeRoom(room)),
              videos: this.rooms.map((room) => room.sourceValue)
            }));

            // Broadcast join to all other players
            this.broadcast({
              type: "join",
              player
            }, id);
            logEvent("join", {
              id,
              username: player.username,
              players: Array.from(this.sessions.values()).filter((s) => s.player).length
            });
            break;
          }

          case "move": {
            if (!session.player) break;
            const p = session.player;

            // Drop malformed moves outright: a real move carries finite x/y/z/ry.
            // (Without this, non-finite inputs clamp to the current position and
            // broadcast a redundant no-op instead of being rejected.)
            if (![data.x, data.y, data.z, data.ry].every(
              (n) => typeof n === "number" && Number.isFinite(n)
            )) break;

            const nx = clampNum(data.x, -WORLD_LIMIT, WORLD_LIMIT, p.x);
            const ny = clampNum(data.y, Y_MIN, Y_MAX, p.y);
            const nz = clampNum(data.z, -WORLD_LIMIT, WORLD_LIMIT, p.z);

            // Reject single-message teleports (anti-cheat)
            const dx = nx - p.x;
            const dz = nz - p.z;
            if (Math.sqrt(dx * dx + dz * dz) > MAX_MOVE_STEP) break;

            p.x = nx;
            p.y = ny;
            p.z = nz;
            p.ry = clampNum(data.ry, -1000, 1000, p.ry);
            p.isMoving = Boolean(data.isMoving);

            this.broadcast({
              type: "move",
              id,
              x: p.x,
              y: p.y,
              z: p.z,
              ry: p.ry,
              isMoving: p.isMoving
            }, id);
            break;
          }

          case "room_change": {
            if (!session.player) break;
            const room = Number(data.room);
            if (!Number.isInteger(room) || room < -1 || room > 7) break;

            session.player.room = room;
            this.broadcast({
              type: "room_change",
              id,
              room
            }, id);
            break;
          }

          case "chat": {
            if (!session.player) break;

            const now = Date.now();
            if (now - session.lastChat < CHAT_MIN_INTERVAL) break; // anti-spam
            const message = sanitizeText(data.message, MAX_CHAT_LEN);
            if (!message) break;
            session.lastChat = now;

            this.broadcast({
              type: "chat",
              id,
              username: session.player.username,
              message
            });
            break;
          }

          case "room_update": {
            if (!session.player) break;
            const room = Number(data.room);
            if (!Number.isInteger(room) || room < 0 || room >= ROOM_COUNT) break;

            // Permission gate: you may only change the room you are inside
            if (session.player.room !== room) break;

            const current = this.rooms[room] ?? { ...DEFAULT_ROOMS[room] };
            const name = sanitizeText(data.name, MAX_ROOM_NAME_LEN) || current.name;
            const sourceValue = parseOptionalVideoInput(data.sourceValue);
            if (sourceValue === null) break;

            const nextStartTime = parseStartTime(data.startTime);
            if (data.startTime !== undefined && data.startTime !== null && data.startTime !== "" && !nextStartTime) {
              break;
            }

            const updatedRoom: RoomEvent = {
              roomId: room,
              name,
              sourceValue,
              startTime: data.startTime === undefined ? current.startTime : nextStartTime,
              durationMinutes: parseDurationMinutes(data.durationMinutes, current.durationMinutes),
              updatedAt: Date.now()
            };
            this.rooms[room] = updatedRoom;

            try {
              this.persistRoom(updatedRoom);
            } catch (dbErr) {
              console.error("Failed to update room event in SQLite database:", dbErr);
            }

            this.broadcast({
              type: "room_update",
              room: this.serializeRoom(updatedRoom)
            });
            logEvent("room_update", {
              id,
              room,
              sourceType: deriveSourceType(updatedRoom.sourceValue),
              startTime: updatedRoom.startTime,
              durationMinutes: updatedRoom.durationMinutes
            });
            break;
          }

          case "video_change": {
            if (!session.player) break;
            const room = Number(data.room);
            if (!Number.isInteger(room) || room < 0 || room >= ROOM_COUNT) break;
            if (session.player.room !== room) break;

            const sourceValue = parseVideoInput(data.videoId);
            if (!sourceValue) break;
            const current = this.rooms[room] ?? { ...DEFAULT_ROOMS[room] };
            const updatedRoom: RoomEvent = {
              ...current,
              sourceValue,
              updatedAt: Date.now()
            };
            this.rooms[room] = updatedRoom;

            try {
              this.persistRoom(updatedRoom);
            } catch (dbErr) {
              console.error("Failed to update room source in SQLite database:", dbErr);
            }

            this.broadcast({
              type: "room_update",
              room: this.serializeRoom(updatedRoom)
            });
            logEvent("room_update", { id, room, sourceType: deriveSourceType(sourceValue) });
            break;
          }
        }
      } catch (err) {
        console.error("Error processing websocket message", err);
      }
    });

    const closeHandler = () => {
      const session = this.sessions.get(socket);
      if (session) {
        this.sessions.delete(socket);
        logEvent("disconnect", {
          id: session.id,
          players: Array.from(this.sessions.values()).filter((s) => s.player).length
        });
        this.broadcast({
          type: "leave",
          id: session.id
        });
      }
    };

    socket.addEventListener("close", closeHandler);
    socket.addEventListener("error", closeHandler);
  }

  broadcast(message: any, excludeId?: string) {
    const rawMsg = JSON.stringify(message);
    for (const [socket, session] of this.sessions.entries()) {
      if (excludeId && session.id === excludeId) continue;
      try {
        socket.send(rawMsg);
      } catch (err) {
        // Socket is dead, clean up
        this.sessions.delete(socket);
        this.broadcast({
          type: "leave",
          id: session.id
        });
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route websocket handshake
    if (url.pathname === "/ws") {
      const id = env.METALYCEUM_WORLD.idFromName("global-world");
      const stub = env.METALYCEUM_WORLD.get(id);
      return stub.fetch(request);
    }

    // Default static assets handler
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
