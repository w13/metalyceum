// Event Board, Room Panel, and Video Setup for Metalyceum
import { state } from './state.js';
import { getRoomEventStatus, parseVideoInput } from './utils.js';
import { addChatLog } from './chat.js';
import { closeModal, isModalRegistered, openModal, registerModal } from './modals.js';

export function initRoomPanelCache() {
  state.roomPanelEl = document.getElementById('room-panel');
  state.roomTitleEl = document.getElementById('room-title');
  state.roomStatusBadgeEl = document.getElementById('room-status-badge');
  state.roomStatusTextEl = document.getElementById('room-status-text');
  state.roomPlayersListEl = document.getElementById('room-players-list');
  state.roomCapacityEl = document.getElementById('room-capacity');
}

export function updateRoomPanelDetails() {
  const room = state.ROOMS[state.localPlayer.currentRoom];
  if (!room || !state.roomTitleEl) return;

  const status = getRoomEventStatus(room);
  state.roomTitleEl.innerText = room.name;
  if (state.roomStatusBadgeEl) {
    state.roomStatusBadgeEl.innerText = status.label;
    state.roomStatusBadgeEl.className = `event-status-badge ${status.tone}`;
  }
  if (state.roomStatusTextEl) state.roomStatusTextEl.innerText = status.detail;
}

export function closeRoomEventModal(options = {}) {
  if (!isModalRegistered('room-event-modal')) return;
  closeModal('room-event-modal', options);
}

export function openRoomEventModal() {
  if (!isModalRegistered('room-event-modal')) return;
  if (state.localPlayer.currentRoom === -1) return;
  openModal('room-event-modal');
}

export function initRoomEventModal() {
  registerModal({
    id: 'room-event-modal',
    root: '#video-input-modal',
    surface: '#video-input-form',
    openClass: 'active',
    closeSelectors: ['#cancel-video-btn', '#close-video-btn'],
    initialFocusSelector: '#room-name-input',
    ignoreElements: ['#change-video-btn'],
    onOpen: () => {
      const roomId = state.localPlayer.currentRoom;
      const room = roomId >= 0 ? state.ROOMS[roomId] : null;
      if (!room) return;

      const nameInput = document.getElementById('room-name-input');
      const sourceInput = document.getElementById('video-url-input');
      const startInput = document.getElementById('room-start-input');
      const durationInput = document.getElementById('room-duration-input');

      if (nameInput) nameInput.value = room.name || '';
      if (sourceInput) sourceInput.value = room.sourceValue || '';
      if (startInput) startInput.value = room.startTime ? room.startTime.slice(0, 16) : '';
      if (durationInput) durationInput.value = room.durationMinutes ? String(room.durationMinutes) : '';
    }
  });

  const changeVideoBtn = document.getElementById('change-video-btn');
  if (changeVideoBtn) {
    changeVideoBtn.addEventListener('click', openRoomEventModal);
  }

  const videoInputForm = document.getElementById('video-input-form');
  if (videoInputForm) {
    videoInputForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const roomId = state.localPlayer.currentRoom;
      const room = roomId >= 0 ? state.ROOMS[roomId] : null;
      if (!room) return;
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
        addChatLog('System', 'Reconnect before editing room events.', 'system-msg');
        return;
      }

      const nameInput = document.getElementById('room-name-input');
      const sourceInput = document.getElementById('video-url-input');
      const startInput = document.getElementById('room-start-input');
      const durationInput = document.getElementById('room-duration-input');

      const rawSource = sourceInput?.value.trim() || '';
      const parsedSource = rawSource ? (parseVideoInput(rawSource) ?? rawSource) : (room.sourceValue || '');
      state.socket.send(JSON.stringify({
        type: 'set_room_event',
        roomId,
        name: nameInput?.value.trim() || room.name,
        videoId: parsedSource,
        startTime: startInput?.value ? new Date(startInput.value).toISOString() : room.startTime,
        durationMinutes: durationInput?.value.trim()
          ? Math.max(0, Math.min(1440, Number.parseInt(durationInput.value, 10) || 0))
          : room.durationMinutes
      }));

      closeRoomEventModal();
    });
  }
}

export { renderEventBoard, scheduleEventBoardRender } from './room-panel/event-board.js';
export { refreshRoomPlayersList, scheduleRoomPlayersListRefresh, scheduleRoomVisualRefresh, syncRoomVisuals } from './room-panel/player-list.js';
export { setupRoomVideo, syncActiveRoomMediaState, scheduleActiveRoomMediaState, pauseActiveEmbeddedYoutube, resumeActiveEmbeddedYoutube, syncRoomScreenMedia } from './room-panel/media.js';
