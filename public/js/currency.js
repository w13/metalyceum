// In-game currency (Sigs) — wallet state, trade requests, WebSocket message handling
import { state } from './state.js';

export const SIGS_NAME = 'Sigs';

// ── Wallet state ──────────────────────────────────────────────────────────
export const walletState = {
  balance: 0,
  pendingRequests: [],   // { from, fromName }
  activeTrade: null,     // { tradeId, partner, partnerName, myOffer, theirOffer, myConfirm, theirConfirm }
  history: [],
};

// ── WebSocket message handlers ────────────────────────────────────────────
export const CURRENCY_HANDLERS = {
  wallet_balance: (data) => {
    walletState.balance = data.balance;
    updateWalletUI();
  },

  trade_request: (data) => {
    walletState.pendingRequests.push({ from: data.fromId, fromName: data.fromName || data.fromId });
    showTradeNotification(data);
  },

  trade_opened: (data) => {
    walletState.activeTrade = {
      tradeId: data.tradeId,
      partner: data.partnerId,
      partnerName: data.partnerName || data.partnerId,
      myOffer: 0,
      theirOffer: 0,
      myConfirm: false,
      theirConfirm: false,
    };
    showTradeWindow();
  },

  trade_update: (data) => {
    if (!walletState.activeTrade || walletState.activeTrade.tradeId !== data.tradeId) return;
    if (data.playerId === state.localPlayer?.id) {
      walletState.activeTrade.myOffer = data.amount;
      walletState.activeTrade.myConfirm = data.confirmed;
    } else {
      walletState.activeTrade.theirOffer = data.amount;
      walletState.activeTrade.theirConfirm = data.confirmed;
    }
    updateTradeWindow();
  },

  trade_completed: (data) => {
    walletState.activeTrade = null;
    hideTradeWindow();
    // Request updated balance
    sendWalletRequest();
  },

  trade_cancelled: (data) => {
    walletState.activeTrade = null;
    hideTradeWindow();
    sendWalletRequest();
  },

  trade_declined: (data) => {
    walletState.pendingRequests = walletState.pendingRequests.filter(r => r.from !== data.fromId);
    hideTradeNotification();
  },
};

// ── UI functions (implemented in wallet.js) ──────────────────────────────
let updateWalletUI = () => {};
let showTradeNotification = (data) => { console.log(`[Currency] Trade request from ${data.fromName}`); };
let showTradeWindow = () => {};
let updateTradeWindow = () => {};
let hideTradeWindow = () => {};
let sendWalletRequest = () => {};

export function registerWalletUICallbacks(callbacks) {
  if (callbacks.updateWalletUI) updateWalletUI = callbacks.updateWalletUI;
  if (callbacks.showTradeNotification) showTradeNotification = callbacks.showTradeNotification;
  if (callbacks.showTradeWindow) showTradeWindow = callbacks.showTradeWindow;
  if (callbacks.updateTradeWindow) updateTradeWindow = callbacks.updateTradeWindow;
  if (callbacks.hideTradeWindow) hideTradeWindow = callbacks.hideTradeWindow;
  if (callbacks.sendWalletRequest) sendWalletRequest = callbacks.sendWalletRequest;
}

// ── Actions ───────────────────────────────────────────────────────────────
export function requestTrade(playerId, playerName) {
  if (!state.socket) return;
  state.socket.send(JSON.stringify({ type: 'trade_request', targetId: playerId, targetName: playerName }));
}

export function acceptTrade(fromId) {
  if (!state.socket) return;
  state.socket.send(JSON.stringify({ type: 'trade_accept', fromId }));
  walletState.pendingRequests = walletState.pendingRequests.filter(r => r.from !== fromId);
}

export function declineTrade(fromId) {
  if (!state.socket) return;
  state.socket.send(JSON.stringify({ type: 'trade_decline', fromId }));
  walletState.pendingRequests = walletState.pendingRequests.filter(r => r.from !== fromId);
}

export function updateTradeOffer(amount) {
  if (!state.socket || !walletState.activeTrade) return;
  const clamped = Math.max(0, Math.min(amount, walletState.balance));
  state.socket.send(JSON.stringify({ type: 'trade_offer', tradeId: walletState.activeTrade.tradeId, amount: clamped }));
}

export function confirmTrade() {
  if (!state.socket || !walletState.activeTrade) return;
  state.socket.send(JSON.stringify({ type: 'trade_confirm', tradeId: walletState.activeTrade.tradeId }));
}

export function cancelTrade() {
  if (!state.socket || !walletState.activeTrade) return;
  state.socket.send(JSON.stringify({ type: 'trade_cancel', tradeId: walletState.activeTrade.tradeId }));
}

export function requestBalance() {
  if (!state.socket) return;
  state.socket.send(JSON.stringify({ type: 'wallet_balance_request' }));
}
