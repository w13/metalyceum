// Room players list and visual indicators updates for Metalyceum
import { state } from '../state.js';
import { ROOM_LAYOUTS, WORLD_CONFIG } from '../config.js';
import { sanitizeColor, getRoomEventStatus } from '../utils.js';
import { createPanelLabelSprite, disposeSprite } from '../scenery.js';
import { updateRoomAudioState } from '../audio.js';
import { syncRoomScreenMedia } from './media.js';

const _scratchColor = new THREE.Color();

function createElement(tagName, { className = '', textContent = '', styleText = '' } = {}) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  if (styleText) el.style.cssText = styleText;
  return el;
}

function makePlayerItem(color, label, strong) {
  const li = createElement('li', { className: 'room-player-item' });
  const badge = createElement('span', { className: 'room-player-badge' });
  badge.style.backgroundColor = sanitizeColor(color);
  const name = createElement(strong ? 'strong' : 'span', { textContent: label });
  li.appendChild(badge);
  li.appendChild(name);
  return li;
}

export function refreshRoomPlayersList() {
  const listContainer = state.roomPlayersListEl;
  if (!listContainer) return;
  if (state.localPlayer.currentRoom === -1) {
    listContainer.replaceChildren();
    if (state.roomCapacityEl) state.roomCapacityEl.innerText = '0 / 10 Players';
    return;
  }

  const fragment = document.createDocumentFragment();
  fragment.appendChild(makePlayerItem(state.localPlayer.color, `${state.localPlayer.username} (You)`, true));

  state.remotePlayers.forEach((p) => {
    if (p.room === state.localPlayer.currentRoom) {
      fragment.appendChild(makePlayerItem(p.color, p.username, false));
    }
  });

  const count = fragment.childElementCount;
  listContainer.replaceChildren(fragment);
  if (state.roomCapacityEl) state.roomCapacityEl.innerText = `${count} / 10 Players`;
}

export function scheduleRoomPlayersListRefresh() {
  if (state.roomUiState.roomPlayersScheduled) return;
  state.roomUiState.roomPlayersScheduled = true;
  window.requestAnimationFrame(() => {
    state.roomUiState.roomPlayersScheduled = false;
    refreshRoomPlayersList();
  });
}

function schedulePendingRoomSignSpriteUpdates() {
  if (state.roomSignState.spriteRefreshScheduled) return;
  state.roomSignState.spriteRefreshScheduled = true;

  window.requestAnimationFrame(() => {
    state.roomSignState.spriteRefreshScheduled = false;
    const nextUpdate = state.roomSignState.pendingSpriteUpdates.shift();
    if (!nextUpdate) return;

    const currentSprite = state.ROOM_SIGN_SPRITES.get(nextUpdate.roomId);
    if (currentSprite !== nextUpdate.previousSprite || !currentSprite?.parent) {
      if (state.roomSignState.pendingSpriteUpdates.length > 0) {
        schedulePendingRoomSignSpriteUpdates();
      }
      return;
    }

    const replacement = createPanelLabelSprite(nextUpdate.title, nextUpdate.subtitle, nextUpdate.accent);
    replacement.position.copy(currentSprite.position);
    replacement.userData.title = nextUpdate.title;
    replacement.userData.subtitle = nextUpdate.subtitle;
    currentSprite.parent.add(replacement);
    currentSprite.parent.remove(currentSprite);
    disposeSprite(currentSprite);
    state.ROOM_SIGN_SPRITES.set(nextUpdate.roomId, replacement);

    if (state.roomSignState.pendingSpriteUpdates.length > 0) {
      schedulePendingRoomSignSpriteUpdates();
    }
  });
}

function queueRoomSignSpriteUpdate(roomId, nextTitle, nextSubtitle, accent, previousSprite) {
  const pending = state.roomSignState.pendingSpriteUpdates;
  const existing = pending.find((entry) => entry.roomId === roomId);
  if (existing) {
    existing.title = nextTitle;
    existing.subtitle = nextSubtitle;
    existing.accent = accent;
    existing.previousSprite = previousSprite;
  } else {
    pending.push({
      roomId,
      title: nextTitle,
      subtitle: nextSubtitle,
      accent,
      previousSprite
    });
  }
  schedulePendingRoomSignSpriteUpdates();
}

export function syncRoomVisuals() {
  state.ROOMS.forEach((room) => {
    const status = getRoomEventStatus(room);
    syncRoomScreenMedia(room);
    const marker = state.ROOM_INDICATORS.get(room.id);
    if (marker) {
      _scratchColor.set(WORLD_CONFIG.roomBeaconColors[status.tone] || WORLD_CONFIG.roomBeaconColors.idle);
      const color = _scratchColor;
      if (marker.glow) marker.glow.material.color.copy(color);
      if (marker.glow) marker.glow.material.emissive.copy(color);
      if (marker.ring) marker.ring.material.color.copy(color);
      if (marker.light) marker.light.color.copy(color);
      if (marker.light) {
        marker.light.intensity = status.tone === 'live' ? 0.9 : status.tone === 'upcoming' ? 0.5 : 0.25;
      }
      marker.group.userData.statusTone = status.tone;
    }

    const signSprite = state.ROOM_SIGN_SPRITES.get(room.id);
    if (signSprite) {
      const nextSubtitle = `${ROOM_LAYOUTS[room.id]?.label || 'Room'} · ${status.label}`;
      if (signSprite.userData.title !== room.name || signSprite.userData.subtitle !== nextSubtitle) {
        queueRoomSignSpriteUpdate(
          room.id,
          room.name,
          nextSubtitle,
          ROOM_LAYOUTS[room.id]?.themeColor || WORLD_CONFIG.signAccent,
          signSprite
        );
      }
    }
  });
  updateRoomAudioState();
}

export function scheduleRoomVisualRefresh() {
  if (state.roomSignState.scheduledRefresh !== null) return;
  state.roomSignState.scheduledRefresh = window.requestAnimationFrame(() => {
    state.roomSignState.scheduledRefresh = null;
    syncRoomVisuals();
  });
}
