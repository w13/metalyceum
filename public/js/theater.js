// Theater Mode for Metalyceum
import * as THREE from 'three';
import {
  restoreSoundtrackAfterRoomMedia,
  suppressSoundtrackForRoomMedia,
} from './audio.js';
import { addChatLog } from './chat.js';
import { handleEditorCanvasClick } from './editor.js';
import { detectRoomEntry, resetCameraFollow } from './engine.js';
import {
  closeModal,
  isModalRegistered,
  openModal,
  registerModal,
} from './modals.js';
import { getTerrainHeight } from './physics.js';
import { syncActiveRoomMediaState } from './room-panel.js';
import { state } from './state.js';

// physics-engine.js dynamically loaded in focusRoomFromLobbyMarker (non-blocking)

// Scratch vectors reused per-frame to avoid GC pressure
const _clickMouse = new THREE.Vector2();
const _clickRaycaster = new THREE.Raycaster();

export function initTheaterUi() {
  registerModal({
    id: 'theater-modal',
    root: '#theater-modal',
    surface: '#theater-modal .theater-card',
    openClass: 'active',
    closeSelectors: ['#close-theater-btn', '#close-theater-footer-btn'],
    initialFocusSelector: '#close-theater-btn',
  });

  const openTheaterBtn = document.getElementById('open-theater-btn');
  if (openTheaterBtn) {
    openTheaterBtn.addEventListener('click', () => {
      if (state.localPlayer.currentRoom !== -1)
        openTheaterMode(state.localPlayer.currentRoom);
    });
  }
}

// Project in-world classroom blackboard (Room 6) to screen space.
// Called each frame from the engine animation loop.
// Moves a previously relocated iframe back to its source container and restores visibility.
function _restoreMovedTheaterIframe(container) {
  if (!state._theaterMovedIframeSource) return;
  const sourceContainer = document.getElementById(
    state._theaterMovedIframeSource,
  );
  const movedIframe = container.querySelector('iframe');
  if (movedIframe && sourceContainer) {
    movedIframe.style.position = 'absolute';
    movedIframe.style.inset = '0';
    movedIframe.style.width = '100%';
    movedIframe.style.height = '100%';
    movedIframe.style.border = '0';
    sourceContainer.appendChild(movedIframe);
  }
  state._theaterMovedIframeSource = null;
  const videoSection = document.querySelector('.video-section');
  if (videoSection) videoSection.style.visibility = '';
}

export function openTheaterMode(roomId) {
  const room = state.ROOMS[roomId];
  const feedVal = room.sourceValue || room.video || '';

  const title = document.getElementById('theater-title');
  const container = document.getElementById('theater-player-container');
  const fallbackBtn = document.getElementById('meet-fallback-btn');

  if (!title || !container || !fallbackBtn) return;

  // If reopening theater (e.g. switching rooms), restore any previously moved iframe first
  _restoreMovedTheaterIframe(container);

  container.innerHTML = '';
  title.innerText = `${room.name} - Theater Mode`;
  fallbackBtn.style.display = 'none';

  if (!feedVal) {
    container.innerHTML = `<div class="theater-placeholder-text">No active video or meeting feed in this room.<br>Use the 'Change Video Feed' button to add a YouTube video or Google Meet link.</div>`;
    suppressSoundtrackForRoomMedia();
    openModal('theater-modal');
    return;
  }

  const isMeet = feedVal.includes('meet.google.com');

  if (isMeet) {
    let meetUrl = feedVal;
    if (!meetUrl.startsWith('http://') && !meetUrl.startsWith('https://')) {
      meetUrl = 'https://' + meetUrl;
    }
    const iframe = document.createElement('iframe');
    iframe.src = meetUrl;
    iframe.allow = 'camera; microphone; display-capture; autoplay';
    container.appendChild(iframe);
    fallbackBtn.href = meetUrl;
    fallbackBtn.style.display = 'inline-flex';
    suppressSoundtrackForRoomMedia();
    openModal('theater-modal');
    if (state.ytPlayer?.pauseVideo)
      try {
        state.ytPlayer.pauseVideo();
      } catch (e) {}
    return;
  }

  // YouTube: move the already-playing iframe from the room panel into the theater
  // rather than spawning a copy — keeps playback seamless across the transition.
  const sourceContainer = document.getElementById('youtube-player');
  const existingIframe = sourceContainer?.querySelector('iframe');

  if (existingIframe) {
    // Clear inline positioning — theater CSS (#theater-player-container iframe) handles sizing
    existingIframe.style.cssText = '';
    container.appendChild(existingIframe);
    state._theaterMovedIframeSource = 'youtube-player';
    // Hide the room-panel video area so it doesn't show as an empty black box
    const videoSection = document.querySelector('.video-section');
    if (videoSection) videoSection.style.visibility = 'hidden';
  } else {
    // Video hasn't loaded yet — create a fresh iframe with autoplay as fallback
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${feedVal}?autoplay=1&enablejsapi=1`;
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    container.appendChild(iframe);
    if (state.ytPlayer?.pauseVideo)
      try {
        state.ytPlayer.pauseVideo();
      } catch (e) {}
  }

  suppressSoundtrackForRoomMedia();
  openModal('theater-modal');
}

export function closeTheaterMode() {
  const modal = document.getElementById('theater-modal');
  const container = document.getElementById('theater-player-container');

  // Return the moved iframe to its original room-panel slot before clearing the container
  if (container) _restoreMovedTheaterIframe(container);

  if (modal && isModalRegistered('theater-modal'))
    closeModal('theater-modal', { restoreFocus: false });
  if (container) container.innerHTML = '';
  restoreSoundtrackAfterRoomMedia();

  if (state.localPlayer.currentRoom !== -1) {
    syncActiveRoomMediaState({ roomId: state.localPlayer.currentRoom });
  }
}

export function onCanvasClick(event) {
  if (handleEditorCanvasClick(event)) {
    return;
  }

  _clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  _clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  _clickRaycaster.setFromCamera(_clickMouse, state.camera);

  // Check for teleport triggers (staircase, etc.)
  const markerIntersects = _clickRaycaster.intersectObjects(
    state.clickableRoomMarkers,
  );
  if (markerIntersects.length > 0) {
    const ud = markerIntersects[0].object.userData;
    if (ud && ud.teleport) {
      state.localPlayer.x = ud.x;
      state.localPlayer.y = ud.y;
      state.localPlayer.z = ud.z;
      if (state.localPlayer.mesh) {
        state.localPlayer.mesh.position.set(ud.x, ud.y, ud.z);
      }
      detectRoomEntry();
      return;
    }
    if (state.localPlayer.currentRoom === -1) {
      if (ud && ud.roomId !== undefined) {
        focusRoomFromLobbyMarker(ud.roomId);
        return;
      }
    }
  }
  if (state.localPlayer.currentRoom === -1) return;

  const intersects = _clickRaycaster.intersectObjects(state.clickableScreens);
  if (intersects.length > 0) {
    const clickedScreen = intersects[0].object;
    if (clickedScreen.userData && clickedScreen.userData.roomId !== undefined) {
      openTheaterMode(clickedScreen.userData.roomId);
    }
  }
}

export function focusRoomFromLobbyMarker(roomId) {
  const room = state.ROOMS[roomId];
  if (!room || !state.localPlayer.mesh) return;

  state.localPlayer.x = room.x;
  state.localPlayer.z = room.z + (room.z < 0 ? 5.2 : -5.2);
  state.localPlayer.y = getTerrainHeight(
    state.localPlayer.x,
    state.localPlayer.z,
  );
  state.localPlayer.velocity.set(0, 0, 0);
  state.localPlayer.mesh.position.set(
    state.localPlayer.x,
    state.localPlayer.y,
    state.localPlayer.z,
  );
  // Sync Cannon body position if physics engine is loaded (non-blocking)
  import('./physics-engine.js')
    .then((m) => {
      if (m.isCannonReady())
        m.teleportPlayer(state.localPlayer.x, state.localPlayer.z);
    })
    .catch((err) => {
      console.warn('[Metalyceum] Physics engine sync failed:', err);
    });
  resetCameraFollow();
  addChatLog('System', `Moved closer to ${room.name}.`, 'system-msg');

  const event = new CustomEvent('room-marker-teleport');
  window.dispatchEvent(event);
}
