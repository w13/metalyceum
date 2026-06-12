// Wallet HUD panel — balance display, trade window, and notification toast
import { state } from '../state.js';
import {
  SIGS_NAME, walletState, registerWalletUICallbacks, requestBalance,
  acceptTrade, declineTrade, updateTradeOffer, confirmTrade, cancelTrade,
} from '../currency.js';

let walletPanel = null;
let tradeModal = null;
let notificationToast = null;

export function initWalletUI() {
  // Create the wallet balance badge (always visible when non-zero)
  const hudBar = document.getElementById('hud-icon-bar');
  if (!hudBar) return;

  const badge = document.createElement('button');
  badge.id = 'wallet-badge';
  badge.className = 'hud-icon-square glass';
  badge.type = 'button';
  badge.title = `${SIGS_NAME} Wallet`;
  badge.innerHTML = `<span class="hud-icon-glyph">💰</span><span class="hud-icon-label" id="wallet-balance-label">0 ${SIGS_NAME}</span>`;
  badge.addEventListener('click', () => toggleWalletPanel());
  hudBar.appendChild(badge);

  // Create wallet panel
  walletPanel = document.createElement('div');
  walletPanel.id = 'wallet-panel';
  walletPanel.className = 'hud-card wallet-card glass';
  walletPanel.setAttribute('aria-hidden', 'true');
  walletPanel.style.display = 'none';
  walletPanel.innerHTML = `
    <div class="wallet-header">
      <h3>${SIGS_NAME} Wallet</h3>
      <button type="button" class="modal-close-btn" id="close-wallet-btn" aria-label="Close wallet">✕</button>
    </div>
    <div class="wallet-balance-row">
      <span class="wallet-balance-label">Balance</span>
      <span class="wallet-balance-value" id="wallet-balance-value">0</span>
    </div>
    <div class="wallet-history" id="wallet-history">
      <p class="wallet-history-empty">No transactions yet.</p>
    </div>
  `;
  document.getElementById('hud-container')?.appendChild(walletPanel);

  // Wire close button
  document.getElementById('close-wallet-btn')?.addEventListener('click', () => toggleWalletPanel(false));

  // Create trade notification toast
  notificationToast = document.createElement('div');
  notificationToast.id = 'trade-toast';
  notificationToast.className = 'trade-toast glass';
  notificationToast.style.display = 'none';
  notificationToast.innerHTML = `
    <p id="trade-toast-text">Trade request received</p>
    <div class="trade-toast-actions">
      <button type="button" class="btn-primary btn-sm" id="trade-toast-accept">Accept</button>
      <button type="button" class="btn-secondary btn-sm" id="trade-toast-decline">Decline</button>
    </div>
  `;
  document.body.appendChild(notificationToast);

  // Create trade modal
  tradeModal = document.createElement('div');
  tradeModal.id = 'trade-modal';
  tradeModal.className = 'trade-modal';
  tradeModal.style.display = 'none';
  tradeModal.innerHTML = `
    <div class="trade-modal-content glass">
      <div class="trade-modal-header">
        <h3>Trading with <span id="trade-partner-name">Partner</span></h3>
        <button type="button" class="modal-close-btn" id="close-trade-btn" aria-label="Close trade">✕</button>
      </div>
      <div class="trade-offer-row">
        <div class="trade-side">
          <h4>Your Offer</h4>
          <p id="trade-my-offer" class="trade-offer-amount">0 ${SIGS_NAME}</p>
          <div class="trade-offer-controls">
            <button type="button" id="trade-offer-minus" class="trade-btn-small">−</button>
            <input type="number" id="trade-offer-input" value="0" min="0" max="999999" step="10">
            <button type="button" id="trade-offer-plus" class="trade-btn-small">+</button>
          </div>
          <p class="trade-your-balance">Your balance: <span id="trade-my-balance">0</span> ${SIGS_NAME}</p>
        </div>
        <div class="trade-vs">⬌</div>
        <div class="trade-side">
          <h4>Their Offer</h4>
          <p id="trade-their-offer" class="trade-offer-amount">0 ${SIGS_NAME}</p>
        </div>
      </div>
      <div class="trade-status-row">
        <span id="trade-my-check">⬜ Your confirmation</span>
        <span id="trade-their-check">⬜ Their confirmation</span>
      </div>
      <div class="trade-actions">
        <button type="button" class="btn-primary" id="trade-confirm-btn" disabled>Confirm Trade</button>
        <button type="button" class="btn-secondary" id="trade-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(tradeModal);

  // Wire trade modal buttons
  document.getElementById('close-trade-btn')?.addEventListener('click', cancelTrade);
  document.getElementById('trade-cancel-btn')?.addEventListener('click', cancelTrade);
  document.getElementById('trade-confirm-btn')?.addEventListener('click', confirmTrade);
  document.getElementById('trade-offer-minus')?.addEventListener('click', () => adjustTradeOffer(-10));
  document.getElementById('trade-offer-plus')?.addEventListener('click', () => adjustTradeOffer(10));
  document.getElementById('trade-offer-input')?.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) updateTradeOffer(val);
  });

  // Register UI callbacks with the currency module
  registerWalletUICallbacks({
    updateWalletUI,
    showTradeNotification,
    hideTradeNotification,
    showTradeWindow,
    updateTradeWindow,
    hideTradeWindow,
    sendWalletRequest: requestBalance,
  });

  // Request initial balance
  requestBalance();
}

function updateWalletUI() {
  const label = document.getElementById('wallet-balance-label');
  const value = document.getElementById('wallet-balance-value');
  if (label) label.textContent = `${walletState.balance} ${SIGS_NAME}`;
  if (value) value.textContent = walletState.balance.toLocaleString();
}

function toggleWalletPanel(forceState) {
  if (!walletPanel) return;
  const isOpen = forceState !== undefined ? forceState : walletPanel.style.display === 'none';
  walletPanel.style.display = isOpen ? '' : 'none';
  walletPanel.setAttribute('aria-hidden', String(!isOpen));

  // Populate history
  if (isOpen) {
    const historyDiv = document.getElementById('wallet-history');
    if (historyDiv && walletState.history.length > 0) {
      historyDiv.innerHTML = walletState.history.map(e =>
        `<div class="wallet-history-item ${e.delta >= 0 ? 'credit' : 'debit'}">
          <span class="wallet-history-delta">${e.delta >= 0 ? '+' : ''}${e.delta} ${SIGS_NAME}</span>
          <span class="wallet-history-reason">${e.reason}</span>
        </div>`
      ).join('');
    }
  }
}

let _currentRequestId = null;
let _toastHideTimer = null;

function showTradeNotification(data) {
  if (!notificationToast) return;
  _currentRequestId = data.fromId;
  document.getElementById('trade-toast-text').textContent = `${data.fromName || data.fromId} wants to trade!`;
  document.getElementById('trade-toast-accept').onclick = () => {
    acceptTrade(_currentRequestId);
    notificationToast.style.display = 'none';
  };
  document.getElementById('trade-toast-decline').onclick = () => {
    declineTrade(_currentRequestId);
    notificationToast.style.display = 'none';
  };
  // Clear any pending auto-hide from a previous notification before showing
  if (_toastHideTimer !== null) { clearTimeout(_toastHideTimer); _toastHideTimer = null; }
  notificationToast.style.display = 'flex';
  // Auto-hide after 15 seconds
  _toastHideTimer = setTimeout(() => { _toastHideTimer = null; if (notificationToast) notificationToast.style.display = 'none'; }, 15000);
}

function hideTradeNotification() {
  if (notificationToast) notificationToast.style.display = 'none';
}

function showTradeWindow() {
  if (!tradeModal) return;
  const trade = walletState.activeTrade;
  if (!trade) return;
  document.getElementById('trade-partner-name').textContent = trade.partnerName;
  document.getElementById('trade-my-balance').textContent = walletState.balance.toLocaleString();
  document.getElementById('trade-offer-input').value = '0';
  tradeModal.style.display = 'flex';
  updateTradeWindow();
}

function updateTradeWindow() {
  if (!tradeModal || !walletState.activeTrade) return;
  const t = walletState.activeTrade;
  document.getElementById('trade-my-offer').textContent = `${t.myOffer} ${SIGS_NAME}`;
  document.getElementById('trade-their-offer').textContent = `${t.theirOffer} ${SIGS_NAME}`;
  document.getElementById('trade-my-check').textContent = t.myConfirm ? '✅ You confirmed' : '⬜ Your confirmation';
  document.getElementById('trade-their-check').textContent = t.theirConfirm ? '✅ They confirmed' : '⬜ Their confirmation';
  document.getElementById('trade-confirm-btn').disabled = t.myOffer === 0 && t.theirOffer === 0;
}

function hideTradeWindow() {
  if (tradeModal) tradeModal.style.display = 'none';
}

function adjustTradeOffer(delta) {
  const input = document.getElementById('trade-offer-input');
  if (!input) return;
  const current = parseInt(input.value, 10) || 0;
  const newVal = Math.max(0, Math.min(current + delta, walletState.balance));
  input.value = String(newVal);
  updateTradeOffer(newVal);
}

// Expose for other modules
export { toggleWalletPanel };
