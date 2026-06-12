// CurrencyDO — server-authoritative wallet, transfer, and trade-lock system.
// Each Sigs balance is stored in SQLite. All mutations are idempotent and audited.
import { DurableObject } from 'cloudflare:workers';
import { Bindings } from '../constants';
import { INTERNAL_CURRENCY_PATHS } from '../internal/currency_endpoints';

const WALLET_TABLE = `
  CREATE TABLE IF NOT EXISTS wallets (
    player_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

const TRADE_TABLE = `
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    player_a TEXT NOT NULL,
    player_b TEXT NOT NULL,
    amount_a INTEGER NOT NULL DEFAULT 0,
    amount_b INTEGER NOT NULL DEFAULT 0,
    confirm_a INTEGER NOT NULL DEFAULT 0,
    confirm_b INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER
  )
`;

const AUDIT_TABLE = `
  CREATE TABLE IF NOT EXISTS currency_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

// Idempotency: caller-supplied keys map to the stored response so a replay
// returns the original result verbatim without re-executing the mutation.
const IDEMPOTENCY_TABLE = `
  CREATE TABLE IF NOT EXISTS idempotency (
    key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

// Upper bound for any single amount — well below Number.MAX_SAFE_INTEGER so
// sums of a few amounts can never silently lose precision.
const MAX_AMOUNT = 1e12;
// Idempotency keys older than ~24h are pruned opportunistically on insert.
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

function logEvent(type: string, data: Record<string, unknown>): void {
  console.log(`[CurrencyDO] ${type}`, JSON.stringify(data));
}

function generateId(): string {
  return crypto.randomUUID();
}

// Strictly validate a positive integer amount. Rejects NaN, Infinity, floats,
// non-numbers, <= 0, and anything above MAX_AMOUNT. `NaN <= 0` is false, so the
// old `amount <= 0` guard let NaN/floats through — this is the shared fix.
function parseAmount(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) return null;
  if (v <= 0 || v > MAX_AMOUNT) return null;
  return v;
}

// Same as parseAmount but allows 0 — used for trade offers (a side may offer
// nothing). Still rejects NaN/floats/negatives/overflow.
function parseAmountAllowZero(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) return null;
  if (v < 0 || v > MAX_AMOUNT) return null;
  return v;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

export class CurrencyDO extends DurableObject<Bindings> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initTables();
  }

  private initTables(): void {
    this.sql.exec(WALLET_TABLE);
    this.sql.exec(TRADE_TABLE);
    this.sql.exec(AUDIT_TABLE);
    this.sql.exec(IDEMPOTENCY_TABLE);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        // ── Balance ─────────────────────────────────────────────────
        case INTERNAL_CURRENCY_PATHS.balance: {
          const { playerId } = await request.json() as { playerId: string };
          const balance = this.getBalance(playerId);
          return new Response(JSON.stringify({ playerId, balance }));
        }

        // ── Credit (admin grant, game reward) ───────────────────────
        case INTERNAL_CURRENCY_PATHS.credit: {
          const { playerId, amount, reason, idempotencyKey } = await request.json() as {
            playerId: string; amount: unknown; reason: string; idempotencyKey?: string;
          };
          const replay = this.checkIdempotency(idempotencyKey);
          if (replay) return replay;
          const amt = parseAmount(amount);
          if (amt === null) return jsonResponse({ error: 'amount must be a positive integer' }, 400);
          const existing = this.getBalance(playerId);
          const newBalance = existing + amt;
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', playerId, newBalance);
          this.audit(playerId, amt, newBalance, reason);
          logEvent('credit', { playerId, amount: amt, reason });
          return this.respond({ playerId, balance: newBalance }, 200, idempotencyKey);
        }

        // ── Debit (shop purchase, game fee) ─────────────────────────
        case INTERNAL_CURRENCY_PATHS.debit: {
          const { playerId, amount, reason, idempotencyKey } = await request.json() as {
            playerId: string; amount: unknown; reason: string; idempotencyKey?: string;
          };
          const replay = this.checkIdempotency(idempotencyKey);
          if (replay) return replay;
          const amt = parseAmount(amount);
          if (amt === null) return jsonResponse({ error: 'amount must be a positive integer' }, 400);
          const current = this.getBalance(playerId);
          if (current < amt) return jsonResponse({ error: 'insufficient funds', balance: current, needed: amt }, 402);
          const newBalance = current - amt;
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', playerId, newBalance);
          this.audit(playerId, -amt, newBalance, reason);
          logEvent('debit', { playerId, amount: amt, reason });
          return this.respond({ playerId, balance: newBalance }, 200, idempotencyKey);
        }

        // ── Transfer (player-to-player) ─────────────────────────────
        case INTERNAL_CURRENCY_PATHS.transfer: {
          const { fromId, toId, amount, idempotencyKey } = await request.json() as {
            fromId: string; toId: string; amount: unknown; idempotencyKey?: string;
          };
          const replay = this.checkIdempotency(idempotencyKey);
          if (replay) return replay;
          const amt = parseAmount(amount);
          if (amt === null) return jsonResponse({ error: 'amount must be a positive integer' }, 400);
          if (fromId === toId) return jsonResponse({ error: 'cannot transfer to self' }, 400);
          const fromBal = this.getBalance(fromId);
          if (fromBal < amt) return jsonResponse({ error: 'insufficient funds', balance: fromBal, needed: amt }, 402);
          const toBal = this.getBalance(toId);
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', fromId, fromBal - amt);
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', toId, toBal + amt);
          this.audit(fromId, -amt, fromBal - amt, `transfer to ${toId}`);
          this.audit(toId, amt, toBal + amt, `transfer from ${fromId}`);
          logEvent('transfer', { fromId, toId, amount: amt });
          return this.respond({ fromBalance: fromBal - amt, toBalance: toBal + amt }, 200, idempotencyKey);
        }

        // ── Create trade ────────────────────────────────────────────
        // No escrow is taken at create. Funds are validated and moved only at
        // settlement (second confirm), keeping the system single-mutation and
        // impossible to mint/destroy currency via the trade flow.
        case INTERNAL_CURRENCY_PATHS.createTrade: {
          const { aId, bId, aAmount, bAmount } = await request.json() as {
            aId: string; bId: string; aAmount: unknown; bAmount: unknown;
          };
          if (aId === bId) return jsonResponse({ error: 'cannot trade with self' }, 400);
          const amtA = parseAmountAllowZero(aAmount);
          const amtB = parseAmountAllowZero(bAmount);
          if (amtA === null || amtB === null) return jsonResponse({ error: 'amounts must be non-negative integers' }, 400);
          const tradeId = generateId();
          this.sql.exec(
            'INSERT INTO trades (id, player_a, player_b, amount_a, amount_b, confirm_a, confirm_b, status, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, unixepoch())',
            tradeId, aId, bId, amtA, amtB, 'pending',
          );
          logEvent('create_trade', { tradeId, aId, bId, aAmount: amtA, bAmount: amtB });
          return jsonResponse({ tradeId });
        }

        // ── Update trade offer ──────────────────────────────────────
        // Sets the caller's offer while pending and RESETS BOTH confirms to 0
        // (anti-scam: changing an offer invalidates prior confirmations).
        case INTERNAL_CURRENCY_PATHS.updateTrade: {
          const { tradeId, playerId, amount } = await request.json() as {
            tradeId: string; playerId: string; amount: unknown;
          };
          const row = this.getTrade(tradeId);
          if (!row) return jsonResponse({ error: 'trade not found' }, 404);
          const isA = row.player_a === playerId;
          const isB = row.player_b === playerId;
          if (!isA && !isB) return jsonResponse({ error: 'not a participant' }, 403);
          if (row.status !== 'pending') return jsonResponse({ error: `trade already ${row.status}` }, 409);
          const amt = parseAmountAllowZero(amount);
          if (amt === null) return jsonResponse({ error: 'amount must be a non-negative integer' }, 400);
          if (isA) {
            this.sql.exec('UPDATE trades SET amount_a = ?, confirm_a = 0, confirm_b = 0 WHERE id = ?', amt, tradeId);
          } else {
            this.sql.exec('UPDATE trades SET amount_b = ?, confirm_a = 0, confirm_b = 0 WHERE id = ?', amt, tradeId);
          }
          logEvent('update_trade', { tradeId, playerId, amount: amt });
          return jsonResponse({ tradeId, amount: amt });
        }

        // ── Confirm trade ───────────────────────────────────────────
        // First confirm just records the flag. When the SECOND confirm lands
        // the trade is settled atomically: re-check both balances, and either
        // apply the net swap (complete) or fail 402 and reset confirms.
        case INTERNAL_CURRENCY_PATHS.confirmTrade: {
          const { tradeId, playerId } = await request.json() as {
            tradeId: string; playerId: string;
          };
          const row = this.getTrade(tradeId);
          if (!row) return jsonResponse({ error: 'trade not found' }, 404);
          if (row.status !== 'pending') return jsonResponse({ error: `trade already ${row.status}` }, 409);

          const isA = row.player_a === playerId;
          const isB = row.player_b === playerId;
          if (!isA && !isB) return jsonResponse({ error: 'not a participant' }, 403);

          if (isA) this.sql.exec('UPDATE trades SET confirm_a = 1 WHERE id = ?', tradeId);
          if (isB) this.sql.exec('UPDATE trades SET confirm_b = 1 WHERE id = ?', tradeId);

          const updated = this.getTrade(tradeId);
          if (!updated || updated.confirm_a < 1 || updated.confirm_b < 1) {
            return jsonResponse({ status: 'confirmed', tradeId, playerId });
          }

          // Both confirmed → settle atomically. Re-read live balances.
          const balA = this.getBalance(updated.player_a);
          const balB = this.getBalance(updated.player_b);
          const amountA = updated.amount_a;
          const amountB = updated.amount_b;
          if (balA < amountA || balB < amountB) {
            // Settle-time funds check failed: do NOT cancel — reset confirms so
            // participants can re-confirm once funds are restored. No money moves.
            this.sql.exec('UPDATE trades SET confirm_a = 0, confirm_b = 0 WHERE id = ?', tradeId);
            logEvent('trade_settle_failed', { tradeId });
            return jsonResponse({
              error: 'insufficient funds at settlement',
              playerId: balA < amountA ? updated.player_a : updated.player_b,
            }, 402);
          }
          // Net swap: A −amountA +amountB; B −amountB +amountA.
          const newA = balA - amountA + amountB;
          const newB = balB - amountB + amountA;
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', updated.player_a, newA);
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', updated.player_b, newB);
          this.sql.exec('UPDATE trades SET status = ?, completed_at = unixepoch() WHERE id = ?', 'completed', tradeId);
          this.audit(updated.player_a, amountB - amountA, newA, `trade ${tradeId} with ${updated.player_b}`);
          this.audit(updated.player_b, amountA - amountB, newB, `trade ${tradeId} with ${updated.player_a}`);
          logEvent('trade_completed', { tradeId });
          return jsonResponse({ status: 'completed', tradeId });
        }

        // ── Cancel trade ────────────────────────────────────────────
        // No escrow was ever held, so cancel simply marks the trade cancelled.
        case INTERNAL_CURRENCY_PATHS.cancelTrade: {
          const { tradeId } = await request.json() as { tradeId: string };
          const row = this.getTrade(tradeId);
          if (!row) return jsonResponse({ error: 'trade not found' }, 404);
          if (row.status !== 'pending') return jsonResponse({ error: `trade already ${row.status}` }, 409);
          this.sql.exec("UPDATE trades SET status = 'cancelled', completed_at = unixepoch() WHERE id = ?", tradeId);
          logEvent('trade_cancelled', { tradeId });
          return jsonResponse({ status: 'cancelled' });
        }

        // ── History ─────────────────────────────────────────────────
        case INTERNAL_CURRENCY_PATHS.history: {
          const { playerId, limit } = await request.json() as { playerId: string; limit?: number };
          const maxRows = Math.min(limit || 20, 100);
          const rows = this.sql.exec(
            'SELECT * FROM currency_audit WHERE player_id = ? ORDER BY id DESC LIMIT ?',
            playerId, maxRows,
          ).toArray();
          return new Response(JSON.stringify({ entries: rows }));
        }

        default:
          return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logEvent('error', { path, error: msg });
      return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
  }

  // Workers' SqlStorageCursor.one() THROWS when the result has != 1 row, so it
  // cannot be used for lookups that may miss. Use .toArray()[0] ?? null instead
  // so unknown players read 0 and missing trades 404 (rather than 500).
  private getBalance(playerId: string): number {
    const row = this.sql.exec('SELECT balance FROM wallets WHERE player_id = ?', playerId).toArray()[0] ?? null;
    return row ? (row.balance as number) : 0;
  }

  private getTrade(tradeId: string): TradeRow | null {
    const row = this.sql.exec('SELECT * FROM trades WHERE id = ?', tradeId).toArray()[0] ?? null;
    return row as unknown as TradeRow | null;
  }

  // Returns the stored Response for a known idempotency key, or null. A null
  // key (no key supplied) always returns null → caller executes normally.
  private checkIdempotency(key: string | undefined): Response | null {
    if (!key) return null;
    const row = this.sql.exec('SELECT response FROM idempotency WHERE key = ?', key).toArray()[0] ?? null;
    if (!row) return null;
    return new Response(row.response as string);
  }

  // Build the JSON response and, if a key was supplied, persist it for replay.
  // Prunes entries older than the TTL opportunistically on each insert.
  private respond(body: unknown, status: number, idempotencyKey: string | undefined): Response {
    const text = JSON.stringify(body);
    if (idempotencyKey) {
      this.sql.exec('DELETE FROM idempotency WHERE created_at < unixepoch() - ?', IDEMPOTENCY_TTL_SECONDS);
      this.sql.exec(
        'INSERT INTO idempotency (key, response, created_at) VALUES (?, ?, unixepoch())',
        idempotencyKey, text,
      );
    }
    return new Response(text, { status });
  }

  private audit(playerId: string, delta: number, balanceAfter: number, reason: string): void {
    this.sql.exec(
      'INSERT INTO currency_audit (player_id, delta, balance_after, reason, created_at) VALUES (?, ?, ?, ?, unixepoch())',
      playerId, delta, balanceAfter, reason,
    );
  }
}

interface TradeRow {
  id: string;
  player_a: string;
  player_b: string;
  amount_a: number;
  amount_b: number;
  confirm_a: number;
  confirm_b: number;
  status: string;
  created_at: number;
  completed_at: number | null;
}
