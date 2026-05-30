export const ROOM_COUNT = 8;
export const MAX_PLAYERS = 10;
export const MAX_USERNAME_LEN = 24;
export const MAX_CHAT_LEN = 280;
export const WORLD_LIMIT = 80;
export const Y_MIN = -10;
export const Y_MAX = 40;
export const MAX_MOVE_STEP = 15;
export const MOVEMENT_BATCH_INTERVAL_MS = 125;
export const LOBBY_RELEVANCE_DISTANCE = 18;
export const CHAT_MIN_INTERVAL = 400;
export const BUCKET_CAPACITY = 180;
export const BUCKET_REFILL = 90;
export const MAX_ROOM_NAME_LEN = 48;
export const MAX_WORLD_ASSETS = 200;
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

const DEFAULT_ROOM_SEEDS = [
  { roomId: 0, name: "North Hall", sourceValue: "4G4Ni53z_rk" },
  { roomId: 1, name: "East Studio", sourceValue: "lLXwXAb3vAc" },
  { roomId: 2, name: "Open Workshop", sourceValue: "nHlTJtGGOGI" },
  { roomId: 3, name: "Broadcast Room", sourceValue: "oEMfcwtW8xc" },
  { roomId: 4, name: "South Lounge", sourceValue: "Q1M_V502Gms" },
  { roomId: 5, name: "Crit Room", sourceValue: "5qap5aO4i9A" },
  { roomId: 6, name: "Screening Room", sourceValue: "hHW1oY26kxQ" },
  { roomId: 7, name: "Commons", sourceValue: "2g811Ny7FBE" }
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

export type Session = {
  id: string;
  username: string;
  color: string;
  player: Player | null;
  bucket: TokenBucket;
  lastChatAt: number;
  visiblePlayerIds: Set<string>;
};

export type Bindings = {
  METALYCEUM_WORLD: DurableObjectNamespace;
  ASSETS: {
    fetch: typeof fetch;
  };
  WORLD_EDITOR_TOKEN?: string;
};
