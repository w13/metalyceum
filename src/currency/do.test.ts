import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INTERNAL_CURRENCY_PATHS } from '../internal/currency_endpoints';

// ── Mock cloudflare:workers ──────────────────────────────────────────────
// CurrencyDO extends DurableObject; we only need the base ctor wiring.
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

import { CurrencyDO } from './do';

// ── In-memory, table-backed SqlStorage fake ──────────────────────────────
// Models the four tables CurrencyDO uses (wallets, trades, currency_audit,
// idempotency) with a tiny interpreter over the exact statements the DO
// issues. Faithfully reproduces workerd's `.one()` semantics: it THROWS when
// the result set does not contain exactly one row.
interface WalletRow { player_id: string; balance: number; updated_at: number }
interface TradeRow {
  id: string; player_a: string; player_b: string;
  amount_a: number; amount_b: number;
  confirm_a: number; confirm_b: number;
  status: string; created_at: number; completed_at: number | null;
}
interface AuditRow {
  id: number; player_id: string; delta: number;
  balance_after: number; reason: string; created_at: number;
}
interface IdemRow { key: string; response: string; created_at: number }

function createSqlMock() {
  const wallets = new Map<string, WalletRow>();
  const trades = new Map<string, TradeRow>();
  const audit: AuditRow[] = [];
  const idempotency = new Map<string, IdemRow>();
  let auditSeq = 0;
  let nowSeconds = 1_000_000;

  function cursor(rows: any[]) {
    return {
      toArray: () => rows,
      one: () => {
        if (rows.length !== 1) {
          throw new Error(
            `cursor.one(): expected exactly one row, got ${rows.length}`,
          );
        }
        return rows[0];
      },
    };
  }

  const exec = vi.fn((query: string, ...args: any[]) => {
    const q = query.trim().replace(/\s+/g, ' ');

    if (q.startsWith('CREATE TABLE')) return cursor([]);

    // ── wallets ───────────────────────────────────────────────────────
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

    // ── trades ────────────────────────────────────────────────────────
    if (q.startsWith('SELECT * FROM trades WHERE id = ?')) {
      const t = trades.get(args[0]);
      return cursor(t ? [{ ...t }] : []);
    }
    if (q.startsWith('INSERT INTO trades')) {
      const [id, player_a, player_b, amount_a, amount_b, status] = args;
      trades.set(id, {
        id, player_a, player_b,
        amount_a, amount_b,
        confirm_a: 0, confirm_b: 0,
        status, created_at: nowSeconds, completed_at: null,
      });
      return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET confirm_a = 1 WHERE id = ?')) {
      const t = trades.get(args[0]);
      if (t) t.confirm_a = 1;
      return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET confirm_b = 1 WHERE id = ?')) {
      const t = trades.get(args[0]);
      if (t) t.confirm_b = 1;
      return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET confirm_a = 0, confirm_b = 0 WHERE id = ?')) {
      const t = trades.get(args[0]);
      if (t) { t.confirm_a = 0; t.confirm_b = 0; }
      return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET amount_a = ?, confirm_a = 0, confirm_b = 0 WHERE id = ?')) {
      const [amount, id] = args;
      const t = trades.get(id);
      if (t) { t.amount_a = amount; t.confirm_a = 0; t.confirm_b = 0; }
      return cursor([]);
    }
    if (q.startsWith('UPDATE trades SET amount_b = ?, confirm_a = 0, confirm_b = 0 WHERE id = ?')) {
      const [amount, id] = args;
      const t = trades.get(id);
      if (t) { t.amount_b = amount; t.confirm_a = 0; t.confirm_b = 0; }
      return cursor([]);
    }
    if (q.startsWith("UPDATE trades SET status = ?, completed_at = unixepoch() WHERE id = ?")) {
      const [status, id] = args;
      const t = trades.get(id);
      if (t) { t.status = status; t.completed_at = nowSeconds; }
      return cursor([]);
    }
    if (q.startsWith("UPDATE trades SET status = 'cancelled', completed_at = unixepoch() WHERE id = ?")) {
      const t = trades.get(args[0]);
      if (t) { t.status = 'cancelled'; t.completed_at = nowSeconds; }
      return cursor([]);
    }

    // ── currency_audit ────────────────────────────────────────────────
    if (q.startsWith('INSERT INTO currency_audit')) {
      const [player_id, delta, balance_after, reason] = args;
      auditSeq += 1;
      audit.push({
        id: auditSeq, player_id, delta, balance_after, reason,
        created_at: nowSeconds,
      });
      return cursor([]);
    }
    if (q.startsWith('SELECT * FROM currency_audit WHERE player_id = ?')) {
      const [player_id, limit] = args;
      const rows = audit
        .filter((r) => r.player_id === player_id)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
      return cursor(rows);
    }

    // ── idempotency ───────────────────────────────────────────────────
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
      for (const [k, v] of idempotency) {
        if (v.created_at < cutoff) idempotency.delete(k);
      }
      return cursor([]);
    }

    throw new Error(`Unhandled SQL query in mock: ${query}`);
  });

  return {
    sql: { exec },
    // test helpers
    _wallets: wallets,
    _trades: trades,
    _audit: audit,
    _idempotency: idempotency,
    _setNow: (s: number) => { nowSeconds = s; },
  };
}

function createMockCtx() {
  const sqlMock = createSqlMock();
  return {
    storage: { sql: sqlMock.sql },
    _sql: sqlMock,
  };
}

const env: any = { CURRENCY_DO: {} as any };

// ── Request helpers ───────────────────────────────────────────────────────
function post(path: string, body: unknown): Request {
  return new Request(`http://currency.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('CurrencyDO', () => {
  let ctx: ReturnType<typeof createMockCtx>;
  let donut: CurrencyDO;

  beforeEach(() => {
    ctx = createMockCtx();
    donut = new CurrencyDO(ctx as any, env);
  });

  async function call(path: string, body: unknown) {
    const res = await donut.fetch(post(path, body));
    const json = await res.json<any>();
    return { status: res.status, json };
  }

  async function balance(playerId: string): Promise<number> {
    const { json } = await call(INTERNAL_CURRENCY_PATHS.balance, { playerId });
    return json.balance;
  }

  // Sum of all wallet balances — the conserved quantity.
  function totalSupply(): number {
    let sum = 0;
    for (const w of ctx._sql._wallets.values()) sum += w.balance;
    return sum;
  }

  // ── Balance / credit / debit ────────────────────────────────────────────
  describe('balance, credit, debit', () => {
    it('balance of unknown player is 0', async () => {
      const r = await call(INTERNAL_CURRENCY_PATHS.balance, { playerId: 'ghost' });
      expect(r.status).toBe(200);
      expect(r.json.balance).toBe(0);
    });

    it('credit then balance reflects the credit', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      expect(await balance('a')).toBe(100);
    });

    it('debit on insufficient funds returns 402 and leaves balance unchanged', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 50, reason: 'grant' });
      const r = await call(INTERNAL_CURRENCY_PATHS.debit, { playerId: 'a', amount: 80, reason: 'shop' });
      expect(r.status).toBe(402);
      expect(await balance('a')).toBe(50);
    });

    it('debit reduces balance on sufficient funds', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 50, reason: 'grant' });
      const r = await call(INTERNAL_CURRENCY_PATHS.debit, { playerId: 'a', amount: 30, reason: 'shop' });
      expect(r.status).toBe(200);
      expect(await balance('a')).toBe(20);
    });
  });

  // ── Conservation invariant ──────────────────────────────────────────────
  describe('conservation', () => {
    it('transfer conserves total supply', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 40, reason: 'grant' });
      const before = totalSupply();
      await call(INTERNAL_CURRENCY_PATHS.transfer, { fromId: 'a', toId: 'b', amount: 25 });
      expect(totalSupply()).toBe(before);
      expect(await balance('a')).toBe(75);
      expect(await balance('b')).toBe(65);
    });

    it('a completed trade conserves total supply', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 100, reason: 'grant' });
      const before = totalSupply();
      const { json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 30, bAmount: 10,
      });
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId: created.tradeId, playerId: 'a' });
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId: created.tradeId, playerId: 'b' });
      expect(totalSupply()).toBe(before);
    });

    it('a cancelled trade conserves total supply (no escrow ever held)', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 100, reason: 'grant' });
      const before = totalSupply();
      const { json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 30, bAmount: 10,
      });
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId: created.tradeId, playerId: 'a' });
      await call(INTERNAL_CURRENCY_PATHS.cancelTrade, { tradeId: created.tradeId });
      expect(totalSupply()).toBe(before);
    });
  });

  // ── Trade lifecycle ─────────────────────────────────────────────────────
  describe('trade lifecycle', () => {
    it('create → update offers → confirm A (no money moves) → confirm B → completed net swap + audit', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 100, reason: 'grant' });

      const { status, json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 0, bAmount: 0,
      });
      expect(status).toBe(200);
      const tradeId = created.tradeId;

      // No escrow taken at create.
      expect(await balance('a')).toBe(100);
      expect(await balance('b')).toBe(100);

      // Set offers via updateTrade.
      await call(INTERNAL_CURRENCY_PATHS.updateTrade, { tradeId, playerId: 'a', amount: 30 });
      await call(INTERNAL_CURRENCY_PATHS.updateTrade, { tradeId, playerId: 'b', amount: 10 });

      // Confirm A — still pending, no money moves.
      const confA = await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'a' });
      expect(confA.json.status).toBe('confirmed');
      expect(await balance('a')).toBe(100);
      expect(await balance('b')).toBe(100);

      // Confirm B — completes, atomic net swap.
      const confB = await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'b' });
      expect(confB.json.status).toBe('completed');

      // A: -30 +10 = 80; B: -10 +30 = 120
      expect(await balance('a')).toBe(80);
      expect(await balance('b')).toBe(120);

      // Trade marked completed.
      expect(ctx._sql._trades.get(tradeId)!.status).toBe('completed');

      // Audit rows written for both participants for the trade settlement.
      const aTradeAudits = ctx._sql._audit.filter(
        (r) => r.player_id === 'a' && r.reason.includes('trade'),
      );
      const bTradeAudits = ctx._sql._audit.filter(
        (r) => r.player_id === 'b' && r.reason.includes('trade'),
      );
      expect(aTradeAudits.length).toBe(1);
      expect(bTradeAudits.length).toBe(1);
    });

    it('self-trade is rejected with 400', async () => {
      const r = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'a', aAmount: 0, bAmount: 0,
      });
      expect(r.status).toBe(400);
    });
  });

  // ── Cancel ──────────────────────────────────────────────────────────────
  describe('cancel', () => {
    it('cancel after create+offers+one confirm leaves balances unchanged and blocks further confirms', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 100, reason: 'grant' });
      const { json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 30, bAmount: 10,
      });
      const tradeId = created.tradeId;
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'a' });

      const cancel = await call(INTERNAL_CURRENCY_PATHS.cancelTrade, { tradeId });
      expect(cancel.json.status).toBe('cancelled');
      expect(await balance('a')).toBe(100);
      expect(await balance('b')).toBe(100);
      expect(ctx._sql._trades.get(tradeId)!.status).toBe('cancelled');

      // Further confirm → 409
      const confAfter = await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'b' });
      expect(confAfter.status).toBe(409);
    });
  });

  // ── Offer-update resets confirms ────────────────────────────────────────
  describe('offer-update resets confirmations', () => {
    it('B updating an offer invalidates A prior confirm; B confirming alone must NOT complete', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 100, reason: 'grant' });
      const { json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 30, bAmount: 10,
      });
      const tradeId = created.tradeId;

      // A confirms.
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'a' });
      // B changes its offer → both confirms reset.
      await call(INTERNAL_CURRENCY_PATHS.updateTrade, { tradeId, playerId: 'b', amount: 20 });

      // B confirms alone → must NOT complete (A must re-confirm).
      const confB = await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'b' });
      expect(confB.json.status).toBe('confirmed');
      expect(ctx._sql._trades.get(tradeId)!.status).toBe('pending');
      expect(await balance('a')).toBe(100);
      expect(await balance('b')).toBe(100);

      // Now A re-confirms → completes with the updated offer (A:-30+20=90, B:-20+30=110).
      const confA = await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'a' });
      expect(confA.json.status).toBe('completed');
      expect(await balance('a')).toBe(90);
      expect(await balance('b')).toBe(110);
    });

    it('updateTrade by a non-participant is 403; on non-pending trade is 409', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 100, reason: 'grant' });
      const { json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 0, bAmount: 0,
      });
      const tradeId = created.tradeId;

      const stranger = await call(INTERNAL_CURRENCY_PATHS.updateTrade, {
        tradeId, playerId: 'c', amount: 5,
      });
      expect(stranger.status).toBe(403);

      // Complete the trade, then updating must 409.
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'a' });
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'b' });
      const afterDone = await call(INTERNAL_CURRENCY_PATHS.updateTrade, {
        tradeId, playerId: 'a', amount: 5,
      });
      expect(afterDone.status).toBe(409);
    });

    it('updateTrade rejects invalid amounts with 400 but allows 0', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 100, reason: 'grant' });
      const { json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 0, bAmount: 0,
      });
      const tradeId = created.tradeId;

      expect((await call(INTERNAL_CURRENCY_PATHS.updateTrade, { tradeId, playerId: 'a', amount: -1 })).status).toBe(400);
      expect((await call(INTERNAL_CURRENCY_PATHS.updateTrade, { tradeId, playerId: 'a', amount: 1.5 })).status).toBe(400);
      expect((await call(INTERNAL_CURRENCY_PATHS.updateTrade, { tradeId, playerId: 'a', amount: Number.NaN })).status).toBe(400);
      expect((await call(INTERNAL_CURRENCY_PATHS.updateTrade, { tradeId, playerId: 'a', amount: 0 })).status).toBe(200);
    });
  });

  // ── Settle-time insufficient funds ──────────────────────────────────────
  describe('settle-time insufficient funds', () => {
    it('A drained between confirms → 402, trade stays pending, confirms reset, no money moves', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 50, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 50, reason: 'grant' });
      const { json: created } = await call(INTERNAL_CURRENCY_PATHS.createTrade, {
        aId: 'a', bId: 'b', aAmount: 40, bAmount: 10,
      });
      const tradeId = created.tradeId;

      // A confirms.
      await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'a' });
      // Drain A so A can no longer cover the 40 offer.
      await call(INTERNAL_CURRENCY_PATHS.debit, { playerId: 'a', amount: 30, reason: 'drain' });
      expect(await balance('a')).toBe(20);

      const before = totalSupply();
      // B confirms → settlement re-check fails → 402.
      const confB = await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId, playerId: 'b' });
      expect(confB.status).toBe(402);

      // Trade still pending, confirms reset, balances untouched.
      const t = ctx._sql._trades.get(tradeId)!;
      expect(t.status).toBe('pending');
      expect(t.confirm_a).toBe(0);
      expect(t.confirm_b).toBe(0);
      expect(await balance('a')).toBe(20);
      expect(await balance('b')).toBe(50);
      expect(totalSupply()).toBe(before);
    });
  });

  // ── Idempotency ─────────────────────────────────────────────────────────
  describe('idempotency', () => {
    it('replaying a credit with same key applies once; second response equals first', async () => {
      const first = await call(INTERNAL_CURRENCY_PATHS.credit, {
        playerId: 'a', amount: 100, reason: 'grant', idempotencyKey: 'k1',
      });
      const second = await call(INTERNAL_CURRENCY_PATHS.credit, {
        playerId: 'a', amount: 100, reason: 'grant', idempotencyKey: 'k1',
      });
      expect(await balance('a')).toBe(100); // credited once
      expect(second.json).toEqual(first.json);
    });

    it('different keys apply the credit twice', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant', idempotencyKey: 'k1' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant', idempotencyKey: 'k2' });
      expect(await balance('a')).toBe(200);
    });

    it('absent key executes normally each time', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 10, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 10, reason: 'grant' });
      expect(await balance('a')).toBe(20);
    });

    it('transfer is idempotent under a repeated key', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 100, reason: 'grant' });
      const first = await call(INTERNAL_CURRENCY_PATHS.transfer, { fromId: 'a', toId: 'b', amount: 25, idempotencyKey: 't1' });
      const second = await call(INTERNAL_CURRENCY_PATHS.transfer, { fromId: 'a', toId: 'b', amount: 25, idempotencyKey: 't1' });
      expect(second.json).toEqual(first.json);
      expect(await balance('a')).toBe(75);
      expect(await balance('b')).toBe(25);
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────
  describe('amount validation', () => {
    const bad = [
      ['NaN', Number.NaN],
      ['float', 1.5],
      ['negative', -5],
      ['zero', 0],
      ['string', 'abc'],
    ] as const;

    for (const [label, value] of bad) {
      it(`credit rejects ${label} with 400 and leaves balance untouched`, async () => {
        const r = await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: value as any, reason: 'x' });
        expect(r.status).toBe(400);
        expect(await balance('a')).toBe(0);
      });
      it(`debit rejects ${label} with 400`, async () => {
        await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 50, reason: 'grant' });
        const r = await call(INTERNAL_CURRENCY_PATHS.debit, { playerId: 'a', amount: value as any, reason: 'x' });
        expect(r.status).toBe(400);
        expect(await balance('a')).toBe(50);
      });
      it(`transfer rejects ${label} with 400`, async () => {
        await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 50, reason: 'grant' });
        const r = await call(INTERNAL_CURRENCY_PATHS.transfer, { fromId: 'a', toId: 'b', amount: value as any });
        expect(r.status).toBe(400);
        expect(await balance('a')).toBe(50);
        expect(await balance('b')).toBe(0);
      });
    }

    it('transfer to self is rejected with 400', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 50, reason: 'grant' });
      const r = await call(INTERNAL_CURRENCY_PATHS.transfer, { fromId: 'a', toId: 'a', amount: 10 });
      expect(r.status).toBe(400);
      expect(await balance('a')).toBe(50);
    });

    it('createTrade rejects negative/NaN/float offers with 400 but allows 0', async () => {
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'a', amount: 50, reason: 'grant' });
      await call(INTERNAL_CURRENCY_PATHS.credit, { playerId: 'b', amount: 50, reason: 'grant' });
      expect((await call(INTERNAL_CURRENCY_PATHS.createTrade, { aId: 'a', bId: 'b', aAmount: -1, bAmount: 0 })).status).toBe(400);
      expect((await call(INTERNAL_CURRENCY_PATHS.createTrade, { aId: 'a', bId: 'b', aAmount: 1.5, bAmount: 0 })).status).toBe(400);
      expect((await call(INTERNAL_CURRENCY_PATHS.createTrade, { aId: 'a', bId: 'b', aAmount: Number.NaN, bAmount: 0 })).status).toBe(400);
      expect((await call(INTERNAL_CURRENCY_PATHS.createTrade, { aId: 'a', bId: 'b', aAmount: 0, bAmount: 0 })).status).toBe(200);
    });
  });

  // ── Missing trade ───────────────────────────────────────────────────────
  describe('missing trade lookups', () => {
    it('confirm of unknown trade → 404', async () => {
      const r = await call(INTERNAL_CURRENCY_PATHS.confirmTrade, { tradeId: 'nope', playerId: 'a' });
      expect(r.status).toBe(404);
    });
    it('cancel of unknown trade → 404', async () => {
      const r = await call(INTERNAL_CURRENCY_PATHS.cancelTrade, { tradeId: 'nope' });
      expect(r.status).toBe(404);
    });
  });
});
