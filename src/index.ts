import { DurableObject } from "cloudflare:workers";

interface Env {
  METALYCEUM_WORLD: DurableObjectNamespace;
  ASSETS: { fetch: typeof fetch };
}

// Default video IDs/URLs for the 8 rooms
const DEFAULT_VIDEOS = [
  "jfKfPfyJRdk", // Room 0: Lofi Hip Hop Radio
  "tntOCGkgt98", // Room 1: Deep Focus Coding
  "9umH2C-Gf5U", // Room 2: RuneScape OST Orchestral
  "Fz1z7xWjGug", // Room 3: Three.js Journey Intro
  "Q1M_V502Gms", // Room 4: Medieval Ambient Tavern
  "5qap5aO4i9A", // Room 5: Chill Lofi Beats
  "hHW1oY26kxQ", // Room 6: Synthwave Coding Mix
  "2g811Ny7FBE"  // Room 7: Classic Fantasy RPG OST
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

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function sanitizeText(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  // Strip control characters, trim, and cap length
  return v.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, maxLen);
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function sanitizeColor(v: unknown, fallback = "#3b82f6"): string {
  return typeof v === "string" && COLOR_RE.test(v) ? v : fallback;
}

// Accept only a bare 11-char YouTube ID, a YouTube URL, or a meet.google.com
// URL. Returns a normalized safe value, or null to reject.
function parseVideoInput(v: unknown): string | null {
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

// Emit a single-line JSON event for Workers Logs / `wrangler tail`.
function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ts: Date.now(), ...fields }));
}

export class MetalyceumWorld extends DurableObject {
  sessions: Map<WebSocket, Session> = new Map();
  videos: string[] = [];

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

    // Retrieve saved videos or initialize with defaults using SQLite Storage API
    this.ctx.blockConcurrencyWhile(async () => {
      try {
        // Create table using SQL API (compulsory for Workers Free Plan)
        this.ctx.storage.sql.exec(
          "CREATE TABLE IF NOT EXISTS room_videos (room_id INTEGER PRIMARY KEY, video_id TEXT)"
        );

        // Check if rows already exist
        const countCursor = this.ctx.storage.sql.exec("SELECT COUNT(*) as cnt FROM room_videos");
        const results = countCursor.toArray() as { cnt: number }[];
        const count = results[0]?.cnt ?? 0;

        if (count === 0) {
          // Prepopulate default videos
          for (let i = 0; i < 8; i++) {
            this.ctx.storage.sql.exec(
              "INSERT INTO room_videos (room_id, video_id) VALUES (?, ?)",
              i,
              DEFAULT_VIDEOS[i]
            );
          }
        }

        // Load current videos into memory
        const videoCursor = this.ctx.storage.sql.exec(
          "SELECT room_id, video_id FROM room_videos ORDER BY room_id ASC"
        );
        const videoRows = videoCursor.toArray() as { room_id: number; video_id: string }[];
        
        this.videos = new Array(8);
        for (const row of videoRows) {
          if (row.room_id >= 0 && row.room_id < 8) {
            this.videos[row.room_id] = row.video_id;
          }
        }

        // Final fallback safeguard
        for (let i = 0; i < 8; i++) {
          if (!this.videos[i]) {
            this.videos[i] = DEFAULT_VIDEOS[i];
          }
        }
      } catch (err) {
        console.error("Failed to initialize SQLite storage:", err);
        // Load defaults in memory if database fails
        this.videos = [...DEFAULT_VIDEOS];
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
              videos: this.videos
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

            const nx = clampNum(data.x, -WORLD_LIMIT, WORLD_LIMIT, p.x);
            const ny = clampNum(data.y, Y_MIN, Y_MAX, p.y);
            const nz = clampNum(data.z, -WORLD_LIMIT, WORLD_LIMIT, p.z);

            // Reject single-message teleports (anti-cheat / NaN already filtered)
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

          case "video_change": {
            if (!session.player) break;
            const room = Number(data.room);
            if (!Number.isInteger(room) || room < 0 || room > 7) break;

            // Permission gate: you may only change the room you are inside
            if (session.player.room !== room) break;

            const videoId = parseVideoInput(data.videoId);
            if (!videoId) break;

            this.videos[room] = videoId;

            // Persist change in SQLite database
            try {
              this.ctx.storage.sql.exec(
                "INSERT OR REPLACE INTO room_videos (room_id, video_id) VALUES (?, ?)",
                room,
                videoId
              );
            } catch (dbErr) {
              console.error("Failed to update video in SQLite database:", dbErr);
            }

            this.broadcast({
              type: "video_change",
              room,
              videoId
            });
            logEvent("video_change", { id, room, videoId });
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
