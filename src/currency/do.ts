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

function logEvent(type: string, data: Record<string, unknown>): void {
  console.log(`[CurrencyDO] ${type}`, JSON.stringify(data));
}

function generateId(): string {
  return crypto.randomUUID();
}

export class CurrencyDO extends DurableObject<Bindings> {
  private sql: DurableObjectSqlStorage;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initTables();
  }

  private initTables(): void {
    this.sql.exec(WALLET_TABLE);
    this.sql.exec(TRADE_TABLE);
    this.sql.exec(AUDIT_TABLE);
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
          const { playerId, amount, reason } = await request.json() as {
            playerId: string; amount: number; reason: string;
          };
          if (amount <= 0) return new Response(JSON.stringify({ error: 'amount must be positive' }), { status: 400 });
          const existing = this.getBalance(playerId);
          const newBalance = existing + amount;
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', playerId, newBalance);
          this.audit(playerId, amount, newBalance, reason);
          logEvent('credit', { playerId, amount, reason });
          return new Response(JSON.stringify({ playerId, balance: newBalance }));
        }

        // ── Debit (shop purchase, game fee) ─────────────────────────
        case INTERNAL_CURRENCY_PATHS.debit: {
          const { playerId, amount, reason } = await request.json() as {
            playerId: string; amount: number; reason: string;
          };
          if (amount <= 0) return new Response(JSON.stringify({ error: 'amount must be positive' }), { status: 400 });
          const current = this.getBalance(playerId);
          if (current < amount) return new Response(JSON.stringify({ error: 'insufficient funds', balance: current, needed: amount }), { status: 402 });
          const newBalance = current - amount;
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', playerId, newBalance);
          this.audit(playerId, -amount, newBalance, reason);
          logEvent('debit', { playerId, amount, reason });
          return new Response(JSON.stringify({ playerId, balance: newBalance }));
        }

        // ── Transfer (player-to-player) ─────────────────────────────
        case INTERNAL_CURRENCY_PATHS.transfer: {
          const { fromId, toId, amount } = await request.json() as {
            fromId: string; toId: string; amount: number;
          };
          if (amount <= 0) return new Response(JSON.stringify({ error: 'amount must be positive' }), { status: 400 });
          if (fromId === toId) return new Response(JSON.stringify({ error: 'cannot transfer to self' }), { status: 400 });
          const fromBal = this.getBalance(fromId);
          if (fromBal < amount) return new Response(JSON.stringify({ error: 'insufficient funds', balance: fromBal, needed: amount }), { status: 402 });
          const toBal = this.getBalance(toId);
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', fromId, fromBal - amount);
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', toId, toBal + amount);
          this.audit(fromId, -amount, fromBal - amount, `transfer to ${toId}`);
          this.audit(toId, amount, toBal + amount, `transfer from ${fromId}`);
          logEvent('transfer', { fromId, toId, amount });
          return new Response(JSON.stringify({ fromBalance: fromBal - amount, toBalance: toBal + amount }));
        }

        // ── Create trade ────────────────────────────────────────────
        case INTERNAL_CURRENCY_PATHS.createTrade: {
          const { aId, bId, aAmount, bAmount } = await request.json() as {
            aId: string; bId: string; aAmount: number; bAmount: number;
          };
          if (aAmount < 0 || bAmount < 0) return new Response(JSON.stringify({ error: 'amounts cannot be negative' }), { status: 400 });
          const balA = this.getBalance(aId);
          if (balA < aAmount) return new Response(JSON.stringify({ error: 'insufficient funds', playerId: aId, balance: balA, needed: aAmount }), { status: 402 });
          const balB = this.getBalance(bId);
          if (balB < bAmount) return new Response(JSON.stringify({ error: 'insufficient funds', playerId: bId, balance: balB, needed: bAmount }), { status: 402 });
          // Lock the funds by deducting immediately
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', aId, balA - aAmount);
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', bId, balB + 0); // touch to ensure row exists
          const tradeId = generateId();
          this.sql.exec(
            'INSERT INTO trades (id, player_a, player_b, amount_a, amount_b, confirm_a, confirm_b, status, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, unixepoch())',
            tradeId, aId, bId, aAmount, bAmount, 'pending',
          );
          logEvent('create_trade', { tradeId, aId, bId, aAmount, bAmount });
          return new Response(JSON.stringify({ tradeId }));
        }

        // ── Confirm trade (two-phase: 1st = lock, 2nd = execute) ────
        case INTERNAL_CURRENCY_PATHS.confirmTrade: {
          const { tradeId, playerId } = await request.json() as {
            tradeId: string; playerId: string;
          };
          const row = this.sql.exec('SELECT * FROM trades WHERE id = ?', tradeId).one();
          if (!row) return new Response(JSON.stringify({ error: 'trade not found' }), { status: 404 });
          if (row.status !== 'pending') return new Response(JSON.stringify({ error: `trade already ${row.status}` }), { status: 409 });

          // Mark this player's confirmation
          const isA = row.player_a === playerId;
          const isB = row.player_b === playerId;
          if (!isA && !isB) return new Response(JSON.stringify({ error: 'not a participant' }), { status: 403 });

          if (isA) this.sql.exec('UPDATE trades SET confirm_a = 1 WHERE id = ?', tradeId);
          if (isB) this.sql.exec('UPDATE trades SET confirm_b = 1 WHERE id = ?', tradeId);

          // Check if both have confirmed → execute the trade
          const updatedRow = this.sql.exec('SELECT * FROM trades WHERE id = ?', tradeId).one();
          if (updatedRow && (updatedRow.confirm_a as number) > 0 && (updatedRow.confirm_b as number) > 0) {
            // Execute: transfer the locked funds
            const balA = this.getBalance(row.player_a as string);
            const balB = this.getBalance(row.player_b as string);
            const amountA = row.amount_a as number;
            const amountB = row.amount_b as number;
            // Player A gets B's offer
            this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', row.player_a as string, balA + amountB);
            // Player B gets A's offer
            this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', row.player_b as string, balB + amountA);
            this.sql.exec('UPDATE trades SET status = ?, completed_at = unixepoch() WHERE id = ?', 'completed', tradeId);
            this.audit(row.player_a as string, amountB - amountA, balA + amountB, `trade ${tradeId} with ${row.player_b}`);
            this.audit(row.player_b as string, amountA - amountB, balB + amountA, `trade ${tradeId} with ${row.player_a}`);
            logEvent('trade_completed', { tradeId });
            return new Response(JSON.stringify({ status: 'completed', tradeId }));
          }

          return new Response(JSON.stringify({ status: 'confirmed', tradeId, playerId }));
        }

        // ── Cancel trade ────────────────────────────────────────────
        case INTERNAL_CURRENCY_PATHS.cancelTrade: {
          const { tradeId } = await request.json() as { tradeId: string };
          const row = this.sql.exec('SELECT * FROM trades WHERE id = ?', tradeId).one();
          if (!row) return new Response(JSON.stringify({ error: 'trade not found' }), { status: 404 });
          if (row.status !== 'pending') return new Response(JSON.stringify({ error: `trade already ${row.status}` }), { status: 409 });
          // Refund locked funds
          const balA = this.getBalance(row.player_a as string);
          const balB = this.getBalance(row.player_b as string);
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', row.player_a as string, balA + (row.amount_a as number));
          this.sql.exec('INSERT OR REPLACE INTO wallets (player_id, balance, updated_at) VALUES (?, ?, unixepoch())', row.player_b as string, balB + (row.amount_b as number));
          this.sql.exec("UPDATE trades SET status = 'cancelled', completed_at = unixepoch() WHERE id = ?", tradeId);
          logEvent('trade_cancelled', { tradeId });
          return new Response(JSON.stringify({ status: 'cancelled' }));
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

  private getBalance(playerId: string): number {
    const row = this.sql.exec('SELECT balance FROM wallets WHERE player_id = ?', playerId).one();
    return row ? (row.balance as number) : 0;
  }

  private audit(playerId: string, delta: number, balanceAfter: number, reason: string): void {
    this.sql.exec(
      'INSERT INTO currency_audit (player_id, delta, balance_after, reason, created_at) VALUES (?, ?, ?, ?, unixepoch())',
      playerId, delta, balanceAfter, reason,
    );
  }
}
