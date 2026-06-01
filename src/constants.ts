export const ROOM_COUNT = 10;
export const MAX_PLAYERS = 10;
export const MAX_USERNAME_LEN = 24;
export const MAX_CHAT_LEN = 280;
export const MAX_CHAT_HISTORY = 100;
export const WORLD_LIMIT = 80;
export const Y_MIN = -10;
export const Y_MAX = 40;
export const MAX_MOVE_STEP = 15;
export const MAX_MOVE_STEP_SQ = MAX_MOVE_STEP * MAX_MOVE_STEP;
export const MOVEMENT_BATCH_INTERVAL_MS = 125;
/** How long to keep a disconnected session before broadcasting "leave" and cleaning up.
 *  During this grace window, a reconnecting player (matched by username) reuses their old
 *  session ID — other clients never see a leave/join cycle, avoiding "entered" spam. */
export const DISCONNECT_GRACE_MS = 15_000;
/** How long a session can be silent before being considered stale and evicted. */
export const STALE_SESSION_MS = 45_000;
export const LOBBY_RELEVANCE_DISTANCE = 18;
export const CHAT_MIN_INTERVAL = 400;
export const BUCKET_CAPACITY = 180;
export const BUCKET_REFILL = 90;
export const MAX_ROOM_NAME_LEN = 48;
export const MAX_WORLD_ASSETS = 200;
export const ROOMS_CONFIG_VERSION = 2; // bump to force room re-seed on deploy
export const DEFAULT_ROOM_DURATION_MINUTES = 60;
export const DEFAULT_ROOM_START_TIME = "2026-01-01T18:00:00.000Z";

export type RoomSourceType = "youtube" | "meet" | "none";

export type RoomEvent = {
  roomId: number;
  name: string;
  sourceType: RoomSourceType;
  sourceValue: string;
  startTime: string | null;
  durationMinutes: number;
  updatedAt: number;
};

export type PersistedChatMessage = {
  id: number;
  senderId: string;
  username: string;
  color: string;
  message: string;
  scope: "global" | "room";
  roomId: number | null;
  timestamp: number;
};

const DEFAULT_ROOM_SEEDS = [
  { roomId: 0, name: "North Hall", sourceValue: "V0UzCBrWeTI" },
  { roomId: 1, name: "East Studio", sourceValue: "V_plEMQhOb8" },
  { roomId: 2, name: "Open Workshop", sourceValue: "nHlTJtGGOGI" },
  { roomId: 3, name: "Broadcast Room", sourceValue: "NrNR2MdZN7k" },
  { roomId: 4, name: "South Lounge", sourceValue: "jbD-r7M4U_8" },
  { roomId: 5, name: "Crit Room", sourceValue: "hL_HGTRMPqI" },
  { roomId: 6, name: "Screening Room", sourceValue: "UxSzlY506MM" },
  { roomId: 7, name: "Commons", sourceValue: "ogyX9nIK0kM" },
  { roomId: 8, name: "Amphitheater", sourceValue: "DyccRj-TBkU" },
  { roomId: 9, name: "Concert Venue", sourceValue: "V0UzCBrWeTI" }
] as const;

export const DEFAULT_ROOMS: RoomEvent[] = DEFAULT_ROOM_SEEDS.map((room) => ({
  ...room,
  sourceType: "youtube",
  startTime: DEFAULT_ROOM_START_TIME,
  durationMinutes: DEFAULT_ROOM_DURATION_MINUTES,
  updatedAt: 0
}));

export type Player = {
  id: string;
  username: string;
  color: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  isMoving: boolean;
  room: number;
};

export type TokenBucket = {
  tokens: number;
  last: number;
};

export type SessionSource = {
  clientType: "site-browser" | "external-browser" | "script" | "unknown";
  originHost: string | null;
  refererHost: string | null;
  userAgent: string;
};

export type Session = {
  id: string;
  username: string;
  color: string;
  player: Player | null;
  bucket: TokenBucket;
  lastChatAt: number;
  lastSeenAt: number;
  visiblePlayerIds: Set<string>;
  source: SessionSource;
  /** Set when the WebSocket closes; non-null = in grace period before cleanup. */
  disconnectedAt: number | null;
};

export type Bindings = {
  METALYCEUM_WORLD: DurableObjectNamespace;
  ADMIN_DO: DurableObjectNamespace;
  ASSETS: {
    fetch: typeof fetch;
  };
  WORLD_EDITOR_TOKEN?: string;
  ADMIN_INIT_TOKEN?: string;   // bootstrap: POST /api/v1/auth/init with this token creates first owner
};

// For AdminDO — same shape but clearer intent
export type AdminBindings = Bindings;
