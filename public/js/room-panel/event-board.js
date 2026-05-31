import { state } from '../state.js';
import { getRoomEventStatus, getRoomEventWindow } from '../utils.js';

let _lastEventBoardFingerprint = '';

export function renderEventBoard() {
  const list = document.getElementById('event-board-list');
  const count = document.getElementById('event-board-count');
  if (!list || !count) return;

  // Skip rebuild when room names, statuses, and detail text haven't changed.
  // This avoids unnecessary DOM churn from the 30-second periodic timer when
  // no actual event data has changed since the last render.
  const fingerprint = state.ROOMS.map((r) => {
    const s = getRoomEventStatus(r);
    return `${r.id}:${r.name}:${s.tone}:${s.detail}`;
  }).join('|');
  if (fingerprint === _lastEventBoardFingerprint) return;
  _lastEventBoardFingerprint = fingerprint;

  const fragment = document.createDocumentFragment();
  let liveCount = 0;
  let upcomingCount = 0;

  const statusPriority = { live: 0, upcoming: 1, ready: 2, ended: 3, idle: 4 };
  const roomsForBoard = state.ROOMS
    .map((room) => ({
      room,
      status: getRoomEventStatus(room),
      startDate: getRoomEventWindow(room).startDate
    }))
    .sort((a, b) => {
      const toneDiff = statusPriority[a.status.tone] - statusPriority[b.status.tone];
      if (toneDiff !== 0) return toneDiff;
      const aStart = a.startDate ? a.startDate.getTime() : Number.POSITIVE_INFINITY;
      const bStart = b.startDate ? b.startDate.getTime() : Number.POSITIVE_INFINITY;
      if (aStart !== bStart) return aStart - bStart;
      return a.room.id - b.room.id;
    });

  roomsForBoard.forEach(({ room, status }) => {
    if (status.tone === 'live') liveCount += 1;
    if (status.tone === 'upcoming') upcomingCount += 1;

    const card = document.createElement('div');
    card.className = 'event-board-item';
    card.dataset.roomId = String(room.id);
    card.tabIndex = 0;

    const topRow = document.createElement('div');
    topRow.className = 'event-board-item-top';
    const title = document.createElement('strong');
    title.textContent = room.name;
    const badge = document.createElement('span');
    badge.className = `event-status-badge ${status.tone}`;
    badge.textContent = status.label;
    topRow.append(title, badge);

    const meta = document.createElement('div');
    meta.className = 'event-board-item-meta';
    meta.textContent = room.sourceType === 'meet'
      ? 'Google Meet'
      : room.sourceType === 'youtube'
        ? 'YouTube Live'
        : 'No source set';

    const detail = document.createElement('div');
    detail.className = 'event-board-item-detail';
    detail.textContent = status.detail;

    card.append(topRow, meta, detail);
    fragment.appendChild(card);
  });

  list.replaceChildren(fragment);
  count.textContent = `${liveCount} live · ${upcomingCount} upcoming`;
}

export function scheduleEventBoardRender() {
  if (state.roomUiState.eventBoardScheduled) return;
  state.roomUiState.eventBoardScheduled = true;
  window.requestAnimationFrame(() => {
    state.roomUiState.eventBoardScheduled = false;
    renderEventBoard();
  });
}
