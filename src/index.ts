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

export class MetalyceumWorld extends DurableObject {
  sessions: Map<WebSocket, { id: string; player?: Player }> = new Map();
  videos: string[] = [];

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
    this.sessions.set(socket, { id });

    // Initial state setup for the socket
    socket.addEventListener("message", async (msg) => {
      try {
        if (typeof msg.data !== "string") return;
        const data = JSON.parse(msg.data);

        switch (data.type) {
          case "join": {
            const player: Player = {
              id,
              username: data.username || "Guest",
              x: data.x || 0,
              y: data.y || 0,
              z: data.z || 0,
              ry: data.ry || 0,
              color: data.color || "#3b82f6",
              avatar: data.avatar || "adventurer",
              room: -1,
              isMoving: false
            };

            const session = this.sessions.get(socket);
            if (session) {
              session.player = player;
            }

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
            break;
          }

          case "move": {
            const session = this.sessions.get(socket);
            if (session && session.player) {
              session.player.x = data.x;
              session.player.y = data.y;
              session.player.z = data.z;
              session.player.ry = data.ry;
              session.player.isMoving = data.isMoving;

              // Broadcast player movement
              this.broadcast({
                type: "move",
                id,
                x: data.x,
                y: data.y,
                z: data.z,
                ry: data.ry,
                isMoving: data.isMoving
              }, id);
            }
            break;
          }

          case "room_change": {
            const session = this.sessions.get(socket);
            if (session && session.player) {
              session.player.room = data.room;

              this.broadcast({
                type: "room_change",
                id,
                room: data.room
              }, id);
            }
            break;
          }

          case "chat": {
            const session = this.sessions.get(socket);
            if (session && session.player) {
              this.broadcast({
                type: "chat",
                id,
                username: session.player.username,
                message: data.message
              });
            }
            break;
          }

          case "video_change": {
            const roomIdx = data.room;
            const videoId = data.videoId;
            if (roomIdx >= 0 && roomIdx < 8 && videoId) {
              this.videos[roomIdx] = videoId;
              
              // Persist change in SQLite database
              try {
                this.ctx.storage.sql.exec(
                  "INSERT OR REPLACE INTO room_videos (room_id, video_id) VALUES (?, ?)",
                  roomIdx,
                  videoId
                );
              } catch (dbErr) {
                console.error("Failed to update video in SQLite database:", dbErr);
              }

              this.broadcast({
                type: "video_change",
                room: roomIdx,
                videoId
              });
            }
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
