import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INTERNAL_CURRENCY_PATHS } from './internal/currency_endpoints';

// Node's undici Response rejects status 101; shim so /ws upgrades are testable.
const NativeResponse = globalThis.Response;
class UpgradeResponse extends NativeResponse {
  private readonly _upgradeStatus: number | null;
  override readonly webSocket: WebSocket | null;
  constructor(body: BodyInit | null, init?: ResponseInit & { webSocket?: WebSocket }) {
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
globalThis.Response = UpgradeResponse as unknown as typeof Response;

// ── Mock cloudflare:workers (shared base ctor for both DOs) ────────────────
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

import { CurrencyDO } from './currency/do';
import { MetalyceumWorld } from './durable_object';

class MockWebSocket {
  sent: any[] = [];
  closed = false;
  attachment: any = null;
  send(msg: string) {
    if (this.closed) throw new Error('WebSocket is closed');
    this.sent.push(JSON.parse(msg));
  }
  close() {
    this.closed = true;
  }
  serializeAttachment(a: any) {
    this.attachment = a;
  }
  deserializeAttachment() {
    return this.attachment;
  }
}

// ── CurrencyDO SqlStorage fake (same interpreter shape as do.test.ts) ──────
function createCurrencySqlMock() {
  const wallets = new Map<string, any>();
  const trades = new Map<string, any>();
  const audit: any[] = [];
  const idempotency = new Map<string, any>();
  let auditSeq = 0;
  const nowSeconds = 1_000_000;

  function cursor(rows: any[]) {
    return {
      toArray: () => rows,
      one: () => {
        if (rows.length !== 1) throw new Error(`one(): got ${rows.length}`);
        return rows[0];
      },
    };
  }

  const exec = vi.fn((query: string, ...args: any[]) => {
    const q = query.trim().replace(/\s+/g, ' ');
    if (q.startsWith('CREATE TABLE')) return cursor([]);
    if (q.startsWith('SELECT balance FROM wallets WHERE player_id = ?')) {
      const w = wallets.get(args[0]);
      return cursor(w ? [{ balance: w.balance }] : []);
    }
    if (q.startsWith('INSERT OR REPLACE INTO wallets')) {
      const [player_id, balance] = args;
      if (balance < 0) throw new Error('CHECK constraint failed: balance >= 0');
      wallets.set(player_id, { player_id, balance, updated_at: nowSeconds });
      return cursor([]);
    }
    if (q.startsWith('SELECT * FROM trades WHERE id = ?')) {
      const t = trades.get(args[0]);
      return cursor(t ? [{ ...t }] : []);
    }
    if (q.startsWith('INSERT INTO trades')) {
      const [id, player_a, player_b, amount_a, amount_b, status] = args;
      trades.set(id, {
        id, player_a, player_b, amount_a, amount_b,
        confirm_a: 0, confirm_b: 0, status,
        created_at: nowSeconds, completed_at: null,
      });
      return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET confirm_a = 1 WHERE id = ?')) {
      const t = trades.get(args[0]); if (t) t.confirm_a = 1; return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET confirm_b = 1 WHERE id = ?')) {
      const t = trades.get(args[0]); if (t) t.confirm_b = 1; return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET confirm_a = 0, confirm_b = 0 WHERE id = ?')) {
      const t = trades.get(args[0]); if (t) { t.confirm_a = 0; t.confirm_b = 0; } return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET amount_a = ?, confirm_a = 0, confirm_b = 0 WHERE id = ?')) {
      const [amount, id] = args; const t = trades.get(id);
      if (t) { t.amount_a = amount; t.confirm_a = 0; t.confirm_b = 0; } return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET amount_b = ?, confirm_a = 0, confirm_b = 0 WHERE id = ?')) {
      const [amount, id] = args; const t = trades.get(id);
      if (t) { t.amount_b = amount; t.confirm_a = 0; t.confirm_b = 0; } return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET status = ?, completed_at = unixepoch() WHERE id = ?')) {
      const [status, id] = args; const t = trades.get(id);
      if (t) { t.status = status; t.completed_at = nowSeconds; } return cursor([]);
    }
    if (q.startsWith("UPDATE trades SET status = 'cancelled', completed_at = unixepoch() WHERE id = ?")) {
      const t = trades.get(args[0]); if (t) { t.status = 'cancelled'; t.completed_at = nowSeconds; } return cursor([]);
    }
    if (q.startsWith('INSERT INTO currency_audit')) {
      const [player_id, delta, balance_after, reason] = args;
      auditSeq += 1;
      audit.push({ id: auditSeq, player_id, delta, balance_after, reason, created_at: nowSeconds });
      return cursor([]);
    }
    if (q.startsWith('SELECT * FROM currency_audit WHERE player_id = ?')) {
      const [player_id, limit] = args;
      const rows = audit.filter((r) => r.player_id === player_id).sort((a, b) => b.id - a.id).slice(0, limit);
      return cursor(rows);
    }
    if (q.startsWith('SELECT response FROM idempotency WHERE key = ?')) {
      const r = idempotency.get(args[0]);
      return cursor(r ? [{ response: r.response }] : []);
    }
    if (q.startsWith('INSERT INTO idempotency')) {
      const [key, response] = args;
      idempotency.set(key, { key, response, created_at: nowSeconds });
      return cursor([]);
    }
    if (q.startsWith('DELETE FROM idempotency WHERE created_at <')) {
      const cutoff = args[0];
      for (const [k, v] of idempotency) if (v.created_at < cutoff) idempotency.delete(k);
      return cursor([]);
    }
    throw new Error(`Unhandled currency SQL: ${query}`);
  });

  return { sql: { exec }, _wallets: wallets, _audit: audit };
}

// ── World DO ctx fake (minimal — only what the currency path touches) ──────
function createWorldCtx(currencyStub: { fetch: (url: any, init?: any) => Promise<Response> }) {
  const metaStore = new Map<string, string>();
  const roomEvents = new Map<number, any>();
  const chatMessages: any[] = [];
  let lastInsertId = 0;
  const websockets: any[] = [];

  const sql = {
    exec: vi.fn((query: string, ...args: any[]) => {
      const q = query.trim().replace(/\s+/g, ' ');
      const c = (rows: any[]) => ({ toArray: () => rows, one: () => rows[0] ?? null });
      if (q.startsWith('CREATE TABLE')) return c([]);
      if (q.startsWith('SELECT value FROM meta WHERE key=?')) {
        const v = metaStore.get(args[0]); return c(v !== undefined ? [{ value: v }] : []);
      }
      if (q.startsWith('INSERT OR REPLACE INTO meta')) { metaStore.set(args[0], String(args[1])); return c([]); }
      if (q.startsWith('SELECT name FROM sqlite_master')) return c([]);
      if (q.startsWith('SELECT COUNT(*) as cnt FROM room_events')) return c([{ cnt: roomEvents.size }]);
      if (q.startsWith('SELECT room_id, name, source_value')) {
        const rows = Array.from(roomEvents.values()).sort((a, b) => a.roomId - b.roomId).map((r) => ({
          room_id: r.roomId, name: r.name, source_value: r.sourceValue,
          start_time: r.startTime, duration_minutes: r.durationMinutes,
        }));
        return c(rows);
      }
      if (q.startsWith('INSERT OR REPLACE INTO room_events')) {
        const [room_id, name, source_value, start_time, duration_minutes] = args;
        roomEvents.set(room_id, { roomId: room_id, name, sourceValue: source_value, startTime: start_time, durationMinutes: duration_minutes });
        return c([]);
      }
      if (q.startsWith('DELETE FROM room_events')) { roomEvents.clear(); return c([]); }
      if (q.startsWith('SELECT id, asset_type')) return c([]);
      if (q.startsWith('DELETE FROM world_assets')) return c([]);
      if (q.startsWith('INSERT INTO world_assets')) return c([]);
      if (q.startsWith('INSERT INTO chat_messages')) { lastInsertId++; return c([]); }
      if (q.startsWith('SELECT last_insert_rowid()')) return c([{ id: lastInsertId }]);
      if (q.startsWith('SELECT id, sender_id, username')) return c([]);
      if (q.startsWith('DELETE FROM chat_messages')) return c([]);
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return c([]);
      throw new Error(`Unhandled world SQL: ${query}`);
    }),
  };

  let alarm: number | null = null;
  const ctx = {
    storage: {
      sql,
      setAlarm: vi.fn((ts: number) => { alarm = ts; return Promise.resolve(); }),
      deleteAlarm: vi.fn(() => { alarm = null; return Promise.resolve(); }),
      getAlarm: vi.fn(() => Promise.resolve(alarm)),
    },
    blockConcurrencyWhile: vi.fn(async (cb: () => Promise<any>) => { await cb(); }),
    getWebSockets: vi.fn(() => websockets),
    acceptWebSocket: vi.fn((ws: any) => { websockets.push(ws); }),
  };
  return ctx;
}

// Connect a client and send `join`; returns the live server WebSocket + id.
async function connect(world: MetalyceumWorld, ctx: any, username: string) {
  const req = new Request(`http://test/ws?username=${username}`, {
    headers: { Upgrade: 'websocket' },
  });
  await world.fetch(req);
  const ws = ctx.getWebSockets()[ctx.getWebSockets().length - 1] as MockWebSocket;
  world.webSocketMessage(ws as any, JSON.stringify({ type: 'join', x: 0, y: 0, z: 0, room: -1 }));
  const session = world.sessions.get(ws as any)!;
  // Clear the init/join chatter so test assertions only see currency messages.
  ws.sent.length = 0;
  return { ws, id: session.id };
}

// Drain microtasks so the `void this.handleX()` async chains settle.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('MetalyceumWorld ↔ CurrencyDO trade/wallet bridge', () => {
  let currencyDO: CurrencyDO;
  let world: MetalyceumWorld;
  let worldCtx: any;

  beforeEach(() => {
    const currencyCtx: any = { storage: { sql: createCurrencySqlMock().sql } };
    currencyDO = new CurrencyDO(currencyCtx, {} as any);

    const currencyStub = {
      fetch: (url: any, init?: any) =>
        currencyDO.fetch(new Request(String(url), { method: 'POST', body: init?.body })),
    };
    const currencyNamespace = {
      idFromName: () => 'currency-id',
      get: () => currencyStub,
    };

    worldCtx = createWorldCtx(currencyStub);
    const env: any = {
      ADMIN_DO: {},
      METALYCEUM_WORLD: {},
      ASSETS: {},
      CURRENCY_DO: currencyNamespace,
    };
    world = new MetalyceumWorld(worldCtx, env);
  });

  function lastOfType(ws: MockWebSocket, type: string) {
    return [...ws.sent].reverse().find((m) => m.type === type);
  }

  it('wallet_balance_request grants 100 on first touch and never double-grants', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'wallet_balance_request' }));
    await flush();
    expect(lastOfType(alice.ws, 'wallet_balance')).toEqual({ type: 'wallet_balance', balance: 100 });

    alice.ws.sent.length = 0;
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'wallet_balance_request' }));
    await flush();
    expect(lastOfType(alice.ws, 'wallet_balance')).toEqual({ type: 'wallet_balance', balance: 100 });
  });

  it('full happy trade: request → accept → offers → confirms → completed + swapped balances', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    const bob = await connect(world, worldCtx, 'Bob');
    // Grant both their welcome 100.
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'wallet_balance_request' }));
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'wallet_balance_request' }));
    await flush();
    alice.ws.sent.length = 0; bob.ws.sent.length = 0;

    // Alice requests, Bob receives.
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_request', targetId: bob.id, targetName: 'Bob' }));
    const reqMsg = lastOfType(bob.ws, 'trade_request');
    expect(reqMsg).toMatchObject({ fromId: alice.id, fromName: 'Alice' });

    // Bob accepts → both get trade_opened.
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_accept', fromId: alice.id }));
    await flush();
    const aliceOpened = lastOfType(alice.ws, 'trade_opened');
    const bobOpened = lastOfType(bob.ws, 'trade_opened');
    expect(aliceOpened).toMatchObject({ partnerId: bob.id, partnerName: 'Bob' });
    expect(bobOpened).toMatchObject({ partnerId: alice.id, partnerName: 'Alice' });
    const tradeId = aliceOpened.tradeId;
    expect(bobOpened.tradeId).toBe(tradeId);

    // Alice offers 30, Bob offers 10.
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_offer', tradeId, amount: 30 }));
    await flush();
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_offer', tradeId, amount: 10 }));
    await flush();

    // Both confirm.
    alice.ws.sent.length = 0; bob.ws.sent.length = 0;
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_confirm', tradeId }));
    await flush();
    // First confirm → trade_update confirmed:true for Alice, no completion yet.
    expect(lastOfType(alice.ws, 'trade_completed')).toBeUndefined();

    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_confirm', tradeId }));
    await flush();
    // Second confirm settles.
    expect(lastOfType(alice.ws, 'trade_completed')).toEqual({ type: 'trade_completed', tradeId });
    expect(lastOfType(bob.ws, 'trade_completed')).toEqual({ type: 'trade_completed', tradeId });

    // Alice gave 30 got 10 → 80; Bob gave 10 got 30 → 120.
    expect(lastOfType(alice.ws, 'wallet_balance')).toEqual({ type: 'wallet_balance', balance: 80 });
    expect(lastOfType(bob.ws, 'wallet_balance')).toEqual({ type: 'wallet_balance', balance: 120 });
  });

  it('decline relays trade_declined carrying the decliner world id to the requester', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    const bob = await connect(world, worldCtx, 'Bob');
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_request', targetId: bob.id, targetName: 'Bob' }));
    alice.ws.sent.length = 0;
    // Bob declines Alice's request (fromId = Alice's id, per client contract).
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_decline', fromId: alice.id }));
    expect(lastOfType(alice.ws, 'trade_declined')).toEqual({ type: 'trade_declined', fromId: bob.id });
  });

  it('trade_request to an absent target declines back to the requester', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_request', targetId: 'ghost-id', targetName: 'Ghost' }));
    expect(lastOfType(alice.ws, 'trade_declined')).toEqual({ type: 'trade_declined', fromId: 'ghost-id' });
  });

  it('cancel tears down the trade and notifies both', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    const bob = await connect(world, worldCtx, 'Bob');
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_request', targetId: bob.id, targetName: 'Bob' }));
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_accept', fromId: alice.id }));
    await flush();
    const tradeId = lastOfType(alice.ws, 'trade_opened').tradeId;
    alice.ws.sent.length = 0; bob.ws.sent.length = 0;

    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_cancel', tradeId }));
    await flush();
    expect(lastOfType(alice.ws, 'trade_cancelled')).toEqual({ type: 'trade_cancelled', tradeId });
    expect(lastOfType(bob.ws, 'trade_cancelled')).toEqual({ type: 'trade_cancelled', tradeId });
  });

  it('a disconnect cancels the disconnecting player\'s trade and notifies the partner', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    const bob = await connect(world, worldCtx, 'Bob');
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_request', targetId: bob.id, targetName: 'Bob' }));
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_accept', fromId: alice.id }));
    await flush();
    const tradeId = lastOfType(bob.ws, 'trade_opened').tradeId;
    bob.ws.sent.length = 0;

    world.webSocketClose(alice.ws as any, 1000, 'bye', true);
    await flush();
    expect(lastOfType(bob.ws, 'trade_cancelled')).toEqual({ type: 'trade_cancelled', tradeId });
  });

  it('a non-participant cannot affect someone else\'s trade via trade_offer', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    const bob = await connect(world, worldCtx, 'Bob');
    const eve = await connect(world, worldCtx, 'Eve');
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_request', targetId: bob.id, targetName: 'Bob' }));
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_accept', fromId: alice.id }));
    await flush();
    const tradeId = lastOfType(alice.ws, 'trade_opened').tradeId;
    alice.ws.sent.length = 0; bob.ws.sent.length = 0; eve.ws.sent.length = 0;

    // Eve injects an offer into Alice/Bob's trade — must be a no-op.
    world.webSocketMessage(eve.ws as any, JSON.stringify({ type: 'trade_offer', tradeId, amount: 999 }));
    await flush();
    expect(alice.ws.sent.length).toBe(0);
    expect(bob.ws.sent.length).toBe(0);
    expect(eve.ws.sent.length).toBe(0);
  });

  it('one-trade-per-participant: Carol requests trade with Alice while Alice is mid-trade with Bob', async () => {
    const alice = await connect(world, worldCtx, 'Alice');
    const bob = await connect(world, worldCtx, 'Bob');
    const carol = await connect(world, worldCtx, 'Carol');

    // Grant wallets so welcome-grant path doesn't interfere.
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'wallet_balance_request' }));
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'wallet_balance_request' }));
    world.webSocketMessage(carol.ws as any, JSON.stringify({ type: 'wallet_balance_request' }));
    await flush();
    alice.ws.sent.length = 0; bob.ws.sent.length = 0; carol.ws.sent.length = 0;

    // Alice and Bob enter a trade.
    world.webSocketMessage(alice.ws as any, JSON.stringify({ type: 'trade_request', targetId: bob.id }));
    world.webSocketMessage(bob.ws as any, JSON.stringify({ type: 'trade_accept', fromId: alice.id }));
    await flush();
    // Both should have trade_opened.
    expect(lastOfType(alice.ws, 'trade_opened')).toBeDefined();
    expect(lastOfType(bob.ws, 'trade_opened')).toBeDefined();
    alice.ws.sent.length = 0; bob.ws.sent.length = 0; carol.ws.sent.length = 0;

    // Carol sends a trade_request to Alice (who is already trading).
    world.webSocketMessage(carol.ws as any, JSON.stringify({ type: 'trade_request', targetId: alice.id }));
    await flush();

    // Carol must receive trade_declined — no trade_opened, no relay to Alice.
    expect(lastOfType(carol.ws, 'trade_declined')).toBeDefined();
    expect(lastOfType(carol.ws, 'trade_opened')).toBeUndefined();
    // Alice's UI must not be disturbed.
    expect(lastOfType(alice.ws, 'trade_request')).toBeUndefined();
    // Exactly one active trade remains.
    expect((world as any).activeTrades.size).toBe(1);
  });
});
