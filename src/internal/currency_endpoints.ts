// Internal endpoint constants for CurrencyDO — shared between CurrencyDO, AdminDO, and world DO.
export const INTERNAL_CURRENCY_PATHS = {
  rate: '/internal/currency/rate',            // GET current exchange/rate info
  balance: '/internal/currency/balance',      // GET { playerId } → { balance }
  credit: '/internal/currency/credit',        // POST { playerId, amount, reason } → { balance }
  debit: '/internal/currency/debit',          // POST { playerId, amount, reason } → { balance }
  transfer: '/internal/currency/transfer',    // POST { fromId, toId, amount } → { fromBalance, toBalance }
  createTrade: '/internal/currency/create-trade',  // POST { aId, bId, aAmount, bAmount } → { tradeId }
  confirmTrade: '/internal/currency/confirm-trade', // POST { tradeId, playerId } → { status }
  cancelTrade: '/internal/currency/cancel-trade',   // POST { tradeId } → { status }
  // updateTrade: set a participant's offer while pending; resets BOTH confirms to 0
  // (anti-scam: changing an offer invalidates prior confirmations — RuneScape rule).
  updateTrade: '/internal/currency/update-trade',   // POST { tradeId, playerId, amount } → { tradeId, amount }
  history: '/internal/currency/history',      // GET { playerId, limit } → { entries[] }
} as const;

export type InternalCurrencyPath = (typeof INTERNAL_CURRENCY_PATHS)[keyof typeof INTERNAL_CURRENCY_PATHS];

const BASE_URL = 'http://internal';

export function internalCurrencyUrl(path: InternalCurrencyPath): string {
  return `${BASE_URL}${path}`;
}
