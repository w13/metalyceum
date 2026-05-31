// HUD UI coordinator, Keyboard handlers, and general event wiring for Metalyceum
import { state } from './state.js';
import { resumeAudioContext, updateSoundtrackUi } from './audio.js';
import { isAnyModalOpen, isNodeInsideOpenModal } from './modals.js';
import {
  getActiveChatScope, addChatLog,
  setChatFilter, syncChatScopeWithLocation
} from './chat.js';
import {
  closeRoomEventModal, initRoomEventModal, initRoomPanelCache
} from './room-panel.js';
import {
  initTheaterUi, closeTheaterMode, onCanvasClick,
  focusRoomFromLobbyMarker
} from './theater.js';
import {
  updateEditorPalette, updateEditorStatus,
  selectEditorAsset, initEditorUiHandlers
} from './editor.js';
import { toggleMinimap } from './minimap.js';

import { initDebugPanel, updateDebugPanel } from './ui/debug-panel.js';
import { initSoundtrackUi, initSoundtrackControls } from './ui/soundtrack-panel.js';
import { initLoginForm, initColorPickerSync } from './ui/login.js';

function setPanelOpen(panel, button, isOpen) {
  if (!panel || !button) return;
  panel.classList.toggle('panel-open', isOpen);
  panel.setAttribute('aria-hidden', String(!isOpen));
  button.classList.toggle('active', isOpen);
}

function initHudPanels() {
  const musicIconBtn = document.getElementById('music-icon-btn');
  const soundtrackCard = document.getElementById('soundtrack-card');
  const eventsIconBtn = document.getElementById('events-icon-btn');
  const eventsPanel = document.getElementById('events-panel');
  const debugIconBtn = document.getElementById('debug-icon-btn');
  const debugPanel = document.getElementById('debug-panel');

  if (musicIconBtn && soundtrackCard) {
    musicIconBtn.addEventListener('click', async () => {
      const isOpen = !soundtrackCard.classList.contains('panel-open');
      setPanelOpen(soundtrackCard, musicIconBtn, isOpen);
      setPanelOpen(eventsPanel, eventsIconBtn, false);
      setPanelOpen(debugPanel, debugIconBtn, false);
      state.DEBUG_STATE.enabled = false;
      if (isOpen && state.isJoined) {
        state.soundtrackState.enabled = true;
        await resumeAudioContext();
        updateSoundtrackUi();
      }
    });
  }

  if (eventsIconBtn && eventsPanel) {
    eventsIconBtn.addEventListener('click', () => {
      const isOpen = !eventsPanel.classList.contains('panel-open');
      setPanelOpen(eventsPanel, eventsIconBtn, isOpen);
      setPanelOpen(soundtrackCard, musicIconBtn, false);
      setPanelOpen(debugPanel, debugIconBtn, false);
      state.DEBUG_STATE.enabled = false;
    });
  }

  if (debugIconBtn && debugPanel) {
    debugIconBtn.addEventListener('click', () => {
      const isOpen = !debugPanel.classList.contains('panel-open');
      setPanelOpen(debugPanel, debugIconBtn, isOpen);
      setPanelOpen(soundtrackCard, musicIconBtn, false);
      setPanelOpen(eventsPanel, eventsIconBtn, false);
      state.DEBUG_STATE.enabled = isOpen;
    });
  }
}

function handleChatSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    addChatLog('System', 'Chat is unavailable while disconnected.', 'system-msg');
    return;
  }

  const scope = getActiveChatScope();

  state.socket.send(JSON.stringify({ type: 'chat', message: msg, scope }));
  input.value = '';
  input.blur();
}

function handleEventBoardSelection(card) {
  if (!card) return;
  const roomId = Number.parseInt(card.dataset.roomId || '', 10);
  if (!Number.isNaN(roomId)) focusRoomFromLobbyMarker(roomId);
}

function initChatAndEventBoard() {
  const chatForm = document.getElementById('chat-form');
  const eventBoardList = document.getElementById('event-board-list');

  if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);

  document.querySelectorAll('[data-chat-filter]').forEach((button) => {
    button.addEventListener('click', () => { setChatFilter(button.dataset.chatFilter); });
  });

  syncChatScopeWithLocation();

  if (eventBoardList) {
    eventBoardList.addEventListener('click', (e) => {
      handleEventBoardSelection(e.target.closest('.event-board-item'));
    });

    eventBoardList.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      handleEventBoardSelection(e.target.closest('.event-board-item'));
    });
  }
}

function initRoomPanelClose() {
  const closePanelBtn = document.getElementById('close-panel-btn');
  if (!closePanelBtn) return;

  closePanelBtn.addEventListener('click', () => {
    closeRoomEventModal({ restoreFocus: false });
    const roomPanel = state.roomPanelEl || document.getElementById('room-panel');
    if (roomPanel) {
      roomPanel.classList.remove('room-panel-visible');
      roomPanel.setAttribute('aria-hidden', 'true');
    }
  });
}

function initGlobalPointerHandlers() {
  const container = document.getElementById('game-container');
  if (container) container.addEventListener('click', onCanvasClick);

  window.addEventListener('pointerdown', async () => {
    await resumeAudioContext();
    if (
      state.audioCtx &&
      state.audioCtx.state === 'running' &&
      state.soundtrackState.enabled &&
      !state.soundtrackState.isPlaying
    ) {
      const { startSoundtrackPlayback } = await import('./audio.js');
      startSoundtrackPlayback();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (isNodeInsideOpenModal(e.target)) return;
    const tag = e.target?.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      document.activeElement?.blur?.();
    }
  });
}

function setMovementKeyState(key, isPressed) {
  if (key === 'w') state.keys.w = isPressed;
  else if (key === 's') state.keys.s = isPressed;
  else if (key === 'a') state.keys.a = isPressed;
  else if (key === 'd') state.keys.d = isPressed;
}

function setCameraKeyState(key, isPressed) {
  if (key === 'ArrowLeft') state.cameraKeys.ArrowLeft = isPressed;
  else if (key === 'ArrowRight') state.cameraKeys.ArrowRight = isPressed;
  else if (key === 'ArrowUp') state.cameraKeys.ArrowUp = isPressed;
  else if (key === 'ArrowDown') state.cameraKeys.ArrowDown = isPressed;
}

function initKeyboardHandlers() {
  window.addEventListener('keydown', (e) => {
    if (isAnyModalOpen()) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      const k = e.key.toLowerCase();
      setMovementKeyState(k, true);
      if (e.key === ' ') state.keys.space = true;
      setCameraKeyState(e.key, true);
    }

    if (e.key === 'm' || e.key === 'M') {
      toggleMinimap();
    }

    if (e.key === '`' || e.key === 'Backquote') {
      const debugIconBtn = document.getElementById('debug-icon-btn');
      const debugPanel = state.debugPanel || document.getElementById('debug-panel');
      const musicIconBtn = document.getElementById('music-icon-btn');
      const soundtrackCard = document.getElementById('soundtrack-card');
      const eventsIconBtn = document.getElementById('events-icon-btn');
      const eventsPanel = document.getElementById('events-panel');

      state.DEBUG_STATE.enabled = !state.DEBUG_STATE.enabled;
      setPanelOpen(debugPanel, debugIconBtn, state.DEBUG_STATE.enabled);
      if (state.DEBUG_STATE.enabled) {
        setPanelOpen(soundtrackCard, musicIconBtn, false);
        setPanelOpen(eventsPanel, eventsIconBtn, false);
      }
    }

    if (e.key === 'Escape') {
      if (state.editor.enabled) {
        if (state.editor.placingType) {
          state.editor.placingType = null;
          updateEditorPalette();
          updateEditorStatus();
        } else {
          selectEditorAsset(null);
        }
      }
      document.activeElement.blur();
      closeTheaterMode();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    setMovementKeyState(k, false);
    if (e.key === ' ') state.keys.space = false;
    setCameraKeyState(e.key, false);
  });
}

export function initUiHandlers() {
  initRoomEventModal();
  initRoomPanelCache();
  initTheaterUi();
  initEditorUiHandlers();
  initLoginForm();
  initColorPickerSync();
  initHudPanels();
  initChatAndEventBoard();
  initSoundtrackControls();
  initRoomPanelClose();
  initGlobalPointerHandlers();
  initKeyboardHandlers();
}

export { initDebugPanel, updateDebugPanel } from './ui/debug-panel.js';
export { initSoundtrackUi } from './ui/soundtrack-panel.js';
