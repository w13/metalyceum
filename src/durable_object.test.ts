import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Node's undici Response rejects status 101; the Workers runtime allows it
// for WebSocket upgrades (durable_object.ts returns `new Response(null,
// { status: 101, webSocket })`). Shim the constructor so upgrade paths are
// testable outside the Workers runtime.
const NativeResponse = globalThis.Response;

class UpgradeResponse extends NativeResponse {
  private readonly _upgradeStatus: number | null;
  readonly webSocket: unknown;

  constructor(
    body: BodyInit | null,
    init?: ResponseInit & { webSocket?: unknown },
  ) {
    if (init && init.status === 101) {
      super(body, { ...init, status: 200 });
      this._upgradeStatus = 101;
    } else {
      super(body, init);
      this._upgradeStatus = null;
    }
    this.webSocket = init?.webSocket ?? null;
  }

  override get status(): number {
    return this._upgradeStatus ?? super.status;
  }
}

beforeAll(() => {
  globalThis.Response = UpgradeResponse as unknown as typeof Response;
});
afterAll(() => {
  globalThis.Response = NativeResponse;
});
import {
  DEFAULT_ROOMS,
  ROOM_COUNT,
  ROOMS_CONFIG_VERSION,
  type Session,
} from './constants';

// ── 1. Mock cloudflare:workers ──────────────────────────────────────────
vi.mock('cloudflare:workers', () => {
  return {
    DurableObject: class DurableObject {
      ctx: any;
      env: any;
      constructor(ctx: any, env: any) {
        this.ctx = ctx;
        this.env = env;
      }
    },
  };
});

(globalThis as any).WebSocketPair = class WebSocketPair {
  0: MockWebSocket;
  1: MockWebSocket;
  constructor() {
    this[0] = new MockWebSocket() as any;
    this[1] = new MockWebSocket() as any;
  }
};

import { MetalyceumWorld } from './durable_object';

// ── 2. Mock WebSocket class ──────────────────────────────────────────────
class MockWebSocket {
  sent: any[] = [];
  closed = false;
  closeCode: number | null = null;
  closeReason: string | null = null;
  attachment: any = null;

  send(msg: string) {
    if (this.closed) throw new Error('WebSocket is closed');
    this.sent.push(JSON.parse(msg));
  }

  close(code?: number, reason?: string) {
    this.closed = true;
    this.closeCode = code ?? null;
    this.closeReason = reason ?? null;
  }

  serializeAttachment(attachment: any) {
    this.attachment = attachment;
  }

  deserializeAttachment() {
    return this.attachment;
  }
}

// ── 3. Helper to create mock DurableObjectState (ctx) ───────────────────
function createMockCtx() {
  const metaStore = new Map<string, string>();
  const roomEvents = new Map<number, any>();
  const worldAssets = new Map<string, any>();
  const chatMessages: any[] = [];
  let lastInsertId = 0;
  let alarmTimestamp: number | null = null;
  const websockets: any[] = [];

  const sqlMock = {
    exec: vi.fn((query: string, ...args: any[]) => {
      const trimmed = query.trim().replace(/\s+/g, ' ');

      // CREATE TABLE
      if (trimmed.startsWith('CREATE TABLE')) {
        return { toArray: () => [], one: () => null };
      }

      // meta
      if (trimmed.startsWith('SELECT value FROM meta WHERE key=?')) {
        const key = args[0];
        const value = metaStore.get(key);
        return {
          toArray: () => (value !== undefined ? [{ value }] : []),
          one: () => (value !== undefined ? { value } : null),
        };
      }
      if (trimmed.startsWith('INSERT OR REPLACE INTO meta')) {
        const [key, value] = args;
        metaStore.set(key, String(value));
        return { toArray: () => [], one: () => null };
      }

      // sqlite_master
      if (trimmed.startsWith('SELECT name FROM sqlite_master')) {
        return { toArray: () => [], one: () => null };
      }

      // room_events count
      if (trimmed.startsWith('SELECT COUNT(*) as cnt FROM room_events')) {
        return {
          toArray: () => [{ cnt: roomEvents.size }],
          one: () => ({ cnt: roomEvents.size }),
        };
      }

      // room_events select
      if (trimmed.startsWith('SELECT room_id, name, source_value')) {
        const rows = Array.from(roomEvents.values())
          .sort((a, b) => a.roomId - b.roomId)
          .map((r) => ({
            room_id: r.roomId,
            name: r.name,
            source_value: r.sourceValue,
            start_time: r.startTime,
            duration_minutes: r.durationMinutes,
          }));
        return { toArray: () => rows, one: () => rows[0] || null };
      }

      // room_events insert
      if (trimmed.startsWith('INSERT OR REPLACE INTO room_events')) {
        const [room_id, name, source_value, start_time, duration_minutes] =
          args;
        roomEvents.set(room_id, {
          roomId: room_id,
          name,
          sourceValue: source_value,
          startTime: start_time,
          durationMinutes: duration_minutes,
        });
        return { toArray: () => [], one: () => null };
      }

      // room_events delete
      if (trimmed.startsWith('DELETE FROM room_events')) {
        roomEvents.clear();
        return { toArray: () => [], one: () => null };
      }

      // world_assets select
      if (trimmed.startsWith('SELECT id, asset_type')) {
        const rows = Array.from(worldAssets.values()).map((a) => ({
          id: a.id,
          asset_type: a.type,
          x: a.x,
          y: a.y,
          z: a.z,
          rotation_y: a.rotationY,
          scale: a.scale,
          room_id: a.roomId,
        }));
        return { toArray: () => rows, one: () => rows[0] || null };
      }

      // world_assets delete
      if (trimmed.startsWith('DELETE FROM world_assets')) {
        worldAssets.clear();
        return { toArray: () => [], one: () => null };
      }

      // world_assets insert
      if (trimmed.startsWith('INSERT INTO world_assets')) {
        const [id, asset_type, x, y, z, rotation_y, scale, room_id] = args;
        worldAssets.set(id, {
          id,
          type: asset_type,
          x,
          y,
          z,
          rotationY: rotation_y,
          scale,
          roomId: room_id,
        });
        return { toArray: () => [], one: () => null };
      }

      // chat_messages insert
      if (trimmed.startsWith('INSERT INTO chat_messages')) {
        const [
          sender_id,
          username,
          color,
          message,
          scope,
          room_id,
          created_at,
        ] = args;
        lastInsertId++;
        chatMessages.push({
          id: lastInsertId,
          sender_id,
          username,
          color,
          message,
          scope,
          room_id,
          created_at,
        });
        return { toArray: () => [], one: () => null };
      }

      // chat_messages last insert rowid
      if (trimmed.startsWith('SELECT last_insert_rowid()')) {
        return {
          toArray: () => [{ id: lastInsertId }],
          one: () => ({ id: lastInsertId }),
        };
      }

      // chat_messages select
      if (
        trimmed.startsWith(
          'SELECT id, sender_id, username, color, message, scope, room_id, created_at FROM chat_messages',
        )
      ) {
        const limit = args[0] || 100;
        const rows = chatMessages.slice(-limit).reverse();
        return { toArray: () => rows, one: () => rows[0] || null };
      }

      // chat_messages delete/prune
      if (trimmed.startsWith('DELETE FROM chat_messages')) {
        return { toArray: () => [], one: () => null };
      }

      // transactions & metadata
      if (
        trimmed === 'BEGIN' ||
        trimmed === 'COMMIT' ||
        trimmed === 'ROLLBACK'
      ) {
        return { toArray: () => [], one: () => null };
      }

      throw new Error(`Unhandled SQL query in mock: ${query}`);
    }),
  };

  const storageMock = {
    sql: sqlMock,
    setAlarm: vi.fn((ts: number) => {
      alarmTimestamp = ts;
      return Promise.resolve();
    }),
    deleteAlarm: vi.fn(() => {
      alarmTimestamp = null;
      return Promise.resolve();
    }),
    getAlarm: vi.fn(() => Promise.resolve(alarmTimestamp)),
  };

  return {
    storage: storageMock,
    blockConcurrencyWhile: vi.fn(async (cb: () => Promise<any>) => {
      await cb();
    }),
    getWebSockets: vi.fn(() => websockets),
    acceptWebSocket: vi.fn((ws: any) => {
      websockets.push(ws);
    }),
    // Helper state
    metaStore,
    roomEvents,
    worldAssets,
    chatMessages,
    getAlarmTimestamp: () => alarmTimestamp,
  };
}

describe('MetalyceumWorld Durable Object', () => {
  let ctx: ReturnType<typeof createMockCtx>;
  const env: any = {
    ADMIN_DO: {} as any,
    METALYCEUM_WORLD: {} as any,
    ASSETS: {} as any,
  };

  beforeEach(() => {
    ctx = createMockCtx();
  });

  // Helper to construct world and wait for blockConcurrencyWhile tasks to complete
  async function createWorld(): Promise<MetalyceumWorld> {
    const world = new MetalyceumWorld(ctx as any, env);
    // Wait for constructor's blockConcurrencyWhile promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    return world;
  }

  describe('Initialization and Database Seeding', () => {
    it('seeds default rooms on first launch', async () => {
      await createWorld();
      expect(ctx.roomEvents.size).toBe(ROOM_COUNT);
      expect(ctx.roomEvents.get(0).name).toBe(DEFAULT_ROOMS[0].name);
    });

    it('loads existing rooms from storage on subsequent launches', async () => {
      // Pre-seed some database rooms
      ctx.metaStore.set('rooms_version', String(ROOMS_CONFIG_VERSION));
      ctx.roomEvents.set(1, {
        roomId: 1,
        name: 'Custom Room 1',
        sourceValue: 'custom-val',
        startTime: '10:00',
        durationMinutes: 60,
      });

      const world = await createWorld();
      expect(world.rooms[1].name).toBe('Custom Room 1');
      expect(world.rooms[1].sourceValue).toBe('custom-val');
    });

    it('migrates room configurations when config version increases', async () => {
      ctx.metaStore.set('rooms_version', '0'); // Legacy version
      ctx.roomEvents.set(0, {
        roomId: 0,
        name: 'Old North Hall',
        sourceValue: 'old-video',
        startTime: null,
        durationMinutes: 0,
      });

      const world = await createWorld();
      // Should re-seed and reset version to config version
      expect(ctx.metaStore.get('rooms_version')).not.toBe('0');
      expect(world.rooms[0].name).toBe(DEFAULT_ROOMS[0].name);
    });
  });

  describe('WebSocket Client Lifecycles', () => {
    it('handles first-time normal websocket upgrades', async () => {
      const world = await createWorld();
      const ws = new MockWebSocket();

      const req = new Request(
        'http://metalyceum.test/ws?username=Alice&color=%23ff0000',
        {
          headers: { Upgrade: 'websocket' },
        },
      );
      const response = await world.fetch(req);

      expect(response.status).toBe(101);
      expect(world.sessions.has(ws as any)).toBe(true);
      const session = world.sessions.get(ws as any);
      expect(session?.username).toBe('Alice');
      expect(session?.color).toBe('#ff0000');
    });

    it('denies connections when the player limit is reached', async () => {
      const world = await createWorld();
      // Pre-populate sessions to maximum players
      for (let i = 0; i < 100; i++) {
        world.sessions.set(`ws-${i}` as any, {} as any);
      }

      const req = new Request('http://metalyceum.test/ws?username=Bob', {
        headers: { Upgrade: 'websocket' },
      });
      const response = await world.fetch(req);
      expect(response.status).toBe(429);
      await expect(response.text()).resolves.toBe('Room full');
    });

    it('processes client join message and initializes data payload', async () => {
      const world = await createWorld();
      const ws = new MockWebSocket();

      // Set up connection session
      const req = new Request('http://metalyceum.test/ws?username=Alice', {
        headers: { Upgrade: 'websocket' },
      });
      await world.fetch(req);

      // Send join command
      const clientWs = ctx.getWebSockets()[0] as any;
      world.webSocketMessage(
        clientWs,
        JSON.stringify({
          type: 'join',
          x: 10,
          y: 0,
          z: -20,
          ry: 1.5,
          room: -1,
        }),
      );

      const lastSent = clientWs.sent[0];
      expect(lastSent.type).toBe('init');
      expect(lastSent.id).toBeDefined();
      expect(lastSent.rooms.length).toBe(ROOM_COUNT);
    });

    it('handles grace period disconnects and client reconnections', async () => {
      const world = await createWorld();

      // Connect client
      const req = new Request('http://metalyceum.test/ws?username=Alice', {
        headers: { Upgrade: 'websocket' },
      });
      await world.fetch(req);

      const serverWs = ctx.getWebSockets()[0] as any;
      // Send join
      world.webSocketMessage(
        serverWs,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: -1 }),
      );

      // Trigger disconnect close handler
      world.closeHandler(serverWs);

      const session = world.sessions.get(serverWs);
      expect(session?.disconnectedAt).toBeGreaterThan(0);

      // Reconnect with same username within grace period
      const reconnectReq = new Request(
        'http://metalyceum.test/ws?username=Alice',
        {
          headers: { Upgrade: 'websocket' },
        },
      );
      const reconnectResponse = await world.fetch(reconnectReq);
      expect(reconnectResponse.status).toBe(101);

      // Previous session should be reused for the new websocket
      const newServerWs = ctx.getWebSockets()[1] as any;
      expect(world.sessions.has(newServerWs)).toBe(true);
      expect(world.sessions.get(newServerWs)?.disconnectedAt).toBeNull();
    });
  });

  describe('Core Message Handlers', () => {
    let world: MetalyceumWorld;
    let ws1: MockWebSocket;
    let ws2: MockWebSocket;

    beforeEach(async () => {
      world = await createWorld();
      ws1 = new MockWebSocket();
      ws2 = new MockWebSocket();

      // Establish session 1
      world.sessions.set(ws1 as any, {
        id: 'user-1',
        username: 'Alice',
        color: '#ff0000',
        player: null,
        bucket: { tokens: 10, last: Date.now() },
        lastChatAt: 0,
        lastSeenAt: Date.now(),
        visiblePlayerIds: new Set(),
        source: {
          clientType: 'site-browser',
          originHost: '',
          refererHost: '',
          userAgent: '',
        },
        disconnectedAt: null,
      });

      // Establish session 2
      world.sessions.set(ws2 as any, {
        id: 'user-2',
        username: 'Bob',
        color: '#0000ff',
        player: null,
        bucket: { tokens: 10, last: Date.now() },
        lastChatAt: 0,
        lastSeenAt: Date.now(),
        visiblePlayerIds: new Set(),
        source: {
          clientType: 'site-browser',
          originHost: '',
          refererHost: '',
          userAgent: '',
        },
        disconnectedAt: null,
      });
    });

    it('dispatches moves and propagates state batches to nearby players', async () => {
      // Both join lobby near origin
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: -1 }),
      );
      world.webSocketMessage(
        ws2 as any,
        JSON.stringify({ type: 'join', x: 2, y: 0, z: 2, room: -1 }),
      );

      // Clear previous sends
      ws2.sent.length = 0;

      // Alice moves
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({
          type: 'move',
          x: 1,
          y: 0,
          z: 1,
          ry: 0.5,
          isMoving: true,
        }),
      );

      // Bob should receive a state batch update with Alice's new coordinate
      const moveBatch = ws2.sent.find((m) => m.type === 'state_batch');
      expect(moveBatch).toBeDefined();
      expect(moveBatch.players[0].id).toBe('user-1');
      expect(moveBatch.players[0].x).toBe(1);
    });

    it('isolates movement logs/batches between far-apart players', async () => {
      // Alice joins at origin, Bob joins very far away
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: -1 }),
      );
      world.webSocketMessage(
        ws2 as any,
        JSON.stringify({ type: 'join', x: 200, y: 0, z: 200, room: -1 }),
      );

      ws2.sent.length = 0;

      // Alice moves a tiny bit
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({ type: 'move', x: 1, y: 0, z: 1 }),
      );

      // Bob should not receive any movement notifications since Alice is too far away
      const moveBatch = ws2.sent.find((m) => m.type === 'state_batch');
      expect(moveBatch).toBeUndefined();
    });

    it('restricts chat scope (room chat remains inside the room)', async () => {
      // Join Alice and Bob to different rooms
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: 1 }),
      );
      world.webSocketMessage(
        ws2 as any,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: 2 }),
      );

      ws2.sent.length = 0;

      // Alice sends room chat
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({
          type: 'chat',
          scope: 'room',
          message: 'Hello Room 1!',
        }),
      );

      // Bob should NOT receive this message
      const chatMsg = ws2.sent.find((m) => m.type === 'chat');
      expect(chatMsg).toBeUndefined();
    });

    it('propagates global chat to everyone regardless of room location', async () => {
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: 1 }),
      );
      world.webSocketMessage(
        ws2 as any,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: 2 }),
      );

      ws2.sent.length = 0;

      // Alice sends global chat
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({
          type: 'chat',
          scope: 'global',
          message: 'Hello World!',
        }),
      );

      // Bob should receive the global message
      const chatMsg = ws2.sent.find((m) => m.type === 'chat');
      expect(chatMsg).toBeDefined();
      expect(chatMsg.message).toBe('Hello World!');
    });

    it('allows updating world assets and broadcasts details to all clients', async () => {
      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: -1 }),
      );
      ws1.sent.length = 0;

      const newAssets = [
        {
          id: 'asset-1-test',
          type: 'tree',
          x: 10,
          y: 0,
          z: 15,
          rotationY: 0,
          scale: 1,
          roomId: -1,
        },
      ];

      world.webSocketMessage(
        ws1 as any,
        JSON.stringify({
          type: 'world_assets',
          assets: newAssets,
        }),
      );

      // Verify asset broadcast is sent
      const assetBroad = ws1.sent.find((m) => m.type === 'world_assets');
      expect(assetBroad).toBeDefined();
      expect(assetBroad.assets[0].id).toBe('asset-1-test');

      // Verify db check has persisted assets
      expect(ctx.worldAssets.size).toBe(1);
      expect(ctx.worldAssets.get('asset-1-test').type).toBe('tree');
    });
  });

  describe('Internal Admin API Handlers', () => {
    let world: MetalyceumWorld;

    beforeEach(async () => {
      world = await createWorld();
    });

    it('allows admin room syncing', async () => {
      const syncReq = new Request(
        'http://metalyceum.test/internal/admin/sync-room',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: 2,
            name: 'New Studio B',
            sourceType: 'youtube',
            sourceValue: 'video-abc',
            startTime: '14:00',
            durationMinutes: 120,
          }),
        },
      );

      const response = await world.fetch(syncReq);
      expect(response.status).toBe(200);
      const body = await response.json<any>();
      expect(body.ok).toBe(true);
      expect(body.room.name).toBe('New Studio B');

      // Verify state was saved
      expect(world.rooms[2].name).toBe('New Studio B');
      expect(world.rooms[2].sourceValue).toBe('video-abc');
    });

    it('allows admin broadcast chat events', async () => {
      const ws = new MockWebSocket();
      world.sessions.set(ws as any, {
        id: 'user-1',
        username: 'Alice',
        color: '#ff0000',
        player: {
          id: 'user-1',
          username: 'Alice',
          color: '#ff0000',
          x: 0,
          y: 0,
          z: 0,
          ry: 0,
          isMoving: false,
          room: -1,
        },
        bucket: { tokens: 10, last: Date.now() },
        lastChatAt: 0,
        lastSeenAt: Date.now(),
        visiblePlayerIds: new Set(),
        source: {
          clientType: 'site-browser',
          originHost: '',
          refererHost: '',
          userAgent: '',
        },
        disconnectedAt: null,
      });

      const bcastReq = new Request(
        'http://metalyceum.test/internal/admin/broadcast',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'System Admin',
            message: 'Server maintenance in 10 minutes.',
          }),
        },
      );

      const response = await world.fetch(bcastReq);
      expect(response.status).toBe(200);

      // Verify Alice received the system broadcast message
      const sysMsg = ws.sent.find((m) => m.type === 'chat');
      expect(sysMsg).toBeDefined();
      expect(sysMsg.username).toBe('System Admin');
      expect(sysMsg.message).toBe('Server maintenance in 10 minutes.');
    });
  });

  describe('Alarms and Session Pruning', () => {
    it('sets a cleanup alarm when a player joins', async () => {
      const world = await createWorld();
      const req = new Request('http://metalyceum.test/ws?username=Alice', {
        headers: { Upgrade: 'websocket' },
      });
      await world.fetch(req);
      const serverWs = ctx.getWebSockets()[0] as any;
      world.webSocketMessage(
        serverWs,
        JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: -1 }),
      );

      expect(ctx.getAlarmTimestamp()).toBeGreaterThan(Date.now());
    });

    it('closes WebSockets for stale sessions on alarm triggers', async () => {
      const world = await createWorld();
      const ws = new MockWebSocket();
      world.sessions.set(ws as any, {
        id: 'stale-user',
        username: 'StalePlayer',
        color: '#ffffff',
        player: {
          id: 'stale-user',
          username: 'StalePlayer',
          x: 0,
          y: 0,
          z: 0,
          ry: 0,
          isMoving: false,
          room: -1,
        } as any,
        bucket: { tokens: 10, last: Date.now() },
        lastChatAt: 0,
        // Set last seen to 2 hours ago
        lastSeenAt: Date.now() - 2 * 60 * 60 * 1000,
        visiblePlayerIds: new Set(),
        source: {
          clientType: 'site-browser',
          originHost: '',
          refererHost: '',
          userAgent: '',
        },
        disconnectedAt: null,
      });

      // Trigger alarm
      await world.alarm();

      // Stale WebSocket should be closed with code 1001 (Session timed out)
      expect(ws.closed).toBe(true);
      expect(ws.closeCode).toBe(1001);
    });
  });
});
