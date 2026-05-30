// HUD UI, Event Board, Chat Panels, and Theater Mode for Metalyceum
import { state } from './state.js';
import { ROOM_LAYOUTS, WORLD_CONFIG, SOUNDTRACK_STATE } from './config.js';
import {
  getRoomEventStatus,
  getRoomEventWindow,
  getRoomPlaybackStartSeconds,
  formatDateTime,
  safeMeetUrl
} from './utils.js';
import { resumeAudioContext, pauseSoundtrackPlayback, updateSoundtrackUi } from './audio.js';
import { getTerrainHeight, isLocalPlayerUnderRoof } from './physics.js';
import { createPlayerAvatar } from './scenery.js';
import {
  setEditorEnabled,
  updateEditorPalette,
  updateEditorStatus,
  cancelWorldAssetDraft,
  selectEditorAsset,
  handleEditorCanvasClick,
  initEditorUiHandlers
} from './editor.js';
import { connectMultiplayer } from './multiplayer.js';

// Project the in-world classroom blackboard (Room 6) to screen space and size
// the embedded video container over it. Called each frame from the engine loop.
export function updateClassroomBoard() {
  const container = document.getElementById('embedded-board-container');
  if (!container) return;

  if (state.localPlayer.currentRoom !== 6) {
    container.style.display = 'none';
    if (state.boardYtPlayer && state.boardYtPlayer.pauseVideo) {
      try { state.boardYtPlayer.pauseVideo(); } catch (e) {}
    }
    return;
  }

  const screenPos = new THREE.Vector3(10, 3.5, 19.7);
  screenPos.project(state.camera);
  const inFrustum = screenPos.x >= -1 && screenPos.x <= 1 &&
                    screenPos.y >= -1 && screenPos.y <= 1 &&
                    screenPos.z >= -1 && screenPos.z <= 1;
  if (!inFrustum || screenPos.z > 1) {
    container.style.display = 'none';
    return;
  }

  const tl = new THREE.Vector3(10 + 3.3, 3.5 + 1.8, 19.7);
  const br = new THREE.Vector3(10 - 3.3, 3.5 - 1.8, 19.7);
  tl.project(state.camera);
  br.project(state.camera);

  const tlx = (tl.x * 0.5 + 0.5) * window.innerWidth;
  const tly = (-tl.y * 0.5 + 0.5) * window.innerHeight;
  const brx = (br.x * 0.5 + 0.5) * window.innerWidth;
  const bry = (-br.y * 0.5 + 0.5) * window.innerHeight;

  container.style.left = `${Math.min(tlx, brx)}px`;
  container.style.top = `${Math.min(tly, bry)}px`;
  container.style.width = `${Math.abs(tlx - brx)}px`;
  container.style.height = `${Math.abs(tly - bry)}px`;
  container.style.display = 'block';

  const room6 = state.ROOMS[6];
  if (state.boardYtPlayer && state.boardYtPlayer.playVideo &&
      room6 && room6.sourceValue && room6.sourceType === 'youtube') {
    try { state.boardYtPlayer.playVideo(); } catch (e) {}
  }
}

export function initDebugPanel() {
  state.debugPanel = document.getElementById('debug-panel');
  state.debugStatsEl = document.getElementById('debug-stats');
}

export function initSoundtrackUi() {
  state.soundtrackCard = document.getElementById('soundtrack-card');
  state.soundtrackTitleEl = document.getElementById('soundtrack-title');
  state.soundtrackStatusEl = document.getElementById('soundtrack-status');
  state.soundtrackToggleBtn = document.getElementById('soundtrack-toggle');
  updateSoundtrackUi();
}

export function updateDebugPanel(now) {
  if (!state.DEBUG_STATE.enabled || !state.debugPanel || !state.debugStatsEl) return;

  state.DEBUG_STATE.framesSinceSample += 1;
  if (!state.DEBUG_STATE.lastFpsSampleAt) {
    state.DEBUG_STATE.lastFpsSampleAt = now;
  }
  if (now - state.DEBUG_STATE.lastFpsSampleAt >= 500) {
    state.DEBUG_STATE.fps = Math.round((state.DEBUG_STATE.framesSinceSample * 1000) / (now - state.DEBUG_STATE.lastFpsSampleAt));
    state.DEBUG_STATE.framesSinceSample = 0;
    state.DEBUG_STATE.lastFpsSampleAt = now;
  }

  const visibleScenery = state.STATIC_SCENERY.reduce((count, entry) => count + (entry.object3d.visible ? 1 : 0), 0);
  const liveRooms = state.ROOMS.filter((room) => getRoomEventStatus(room).tone === 'live').length;
  state.debugStatsEl.textContent = `FPS ${state.DEBUG_STATE.fps || '—'} · Players ${state.remotePlayers.size + (state.isJoined ? 1 : 0)} · Visible props ${visibleScenery} / ${state.STATIC_SCENERY.length} · Live rooms ${liveRooms}`;
  state.debugPanel.classList.toggle('active', state.DEBUG_STATE.enabled);
}

export function renderEventBoard() {
  const list = document.getElementById('event-board-list');
  const count = document.getElementById('event-board-count');
  if (!list || !count) return;

  list.innerHTML = '';
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
    list.appendChild(card);
  });

  count.textContent = `${liveCount} live · ${upcomingCount} upcoming`;
}

export function updateRoomPanelDetails() {
  const room = state.ROOMS[state.localPlayer.currentRoom];
  if (!room) return;

  const status = getRoomEventStatus(room);
  const { startDate, endDate, durationMinutes } = getRoomEventWindow(room);
  const locationTag = document.getElementById('hud-location');
  if (locationTag) {
    locationTag.innerText = `In Room: ${room.name}`;
  }

  document.getElementById('room-title').innerText = room.name;
  document.getElementById('room-source-type').innerText = room.sourceType === 'meet'
    ? 'Google Meet'
    : room.sourceType === 'youtube'
      ? 'YouTube Live'
      : 'Not set';
  document.getElementById('room-status-badge').innerText = status.label;
  document.getElementById('room-status-badge').className = `event-status-badge ${status.tone}`;
  document.getElementById('room-status-text').innerText = status.detail;
  document.getElementById('room-start-time').innerText = startDate ? formatDateTime(startDate.toISOString()) : 'Not scheduled';
  document.getElementById('room-end-time').innerText = endDate ? formatDateTime(endDate.toISOString()) : '—';
  document.getElementById('room-duration').innerText = durationMinutes > 0 ? `${durationMinutes} min` : 'Open-ended';
  document.getElementById('room-source-value').innerText = room.sourceValue || 'No YouTube Live or Meet link set';
}

export function populateMeetCard(el, videoId, isBoard) {
  el.innerHTML = '';
  const icon = document.createElement('span');
  icon.style.cssText = `font-size: ${isBoard ? 28 : 32}px; margin-bottom: ${isBoard ? 6 : 8}px;`;
  icon.textContent = '🌐';
  const title = document.createElement('div');
  title.style.cssText = "font-weight:600;font-size:14px;margin-bottom:4px;font-family:'Plus Jakarta Sans',sans-serif;";
  title.textContent = 'Google Meet Active';
  const sub = document.createElement('div');
  sub.style.cssText = "font-size:11px;color:#94a3b8;margin-bottom:12px;font-family:'Plus Jakarta Sans',sans-serif;";
  sub.textContent = isBoard ? 'Classroom is currently in a live meeting.' : 'This room has a live video call.';
  const a = document.createElement('a');
  a.style.cssText = "background:#2563eb;color:#fff;padding:6px 12px;border-radius:4px;font-size:11px;text-decoration:none;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;pointer-events:auto;";
  const url = safeMeetUrl(videoId);
  if (url) a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'Join Meeting';
  el.append(icon, title, sub, a);
}

export function openTheaterMode(roomId) {
  const room = state.ROOMS[roomId];
  const feedVal = room.video || "";
  
  const modal = document.getElementById('theater-modal');
  const title = document.getElementById('theater-title');
  const container = document.getElementById('theater-player-container');
  const fallbackBtn = document.getElementById('meet-fallback-btn');
  
  if (!modal || !container) return;
  
  container.innerHTML = '';
  title.innerText = `${room.name} - Theater Mode`;
  
  if (!feedVal) {
    container.innerHTML = `<div class="theater-placeholder-text">No active video or meeting feed in this room.<br>Use the 'Change Video Feed' button to add a YouTube video or Google Meet link.</div>`;
    fallbackBtn.style.display = 'none';
  } else {
    const isMeet = feedVal.includes('meet.google.com');
    if (isMeet) {
      let meetUrl = feedVal;
      if (!meetUrl.startsWith('http://') && !meetUrl.startsWith('https://')) {
        meetUrl = 'https://' + meetUrl;
      }
      
      const iframe = document.createElement('iframe');
      iframe.src = meetUrl;
      iframe.allow = "camera; microphone; display-capture; autoplay";
      container.appendChild(iframe);
      
      fallbackBtn.href = meetUrl;
      fallbackBtn.style.display = 'inline-flex';
    } else {
      fallbackBtn.style.display = 'none';
      
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${feedVal}?autoplay=1&enablejsapi=1`;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }
  }
  
  modal.classList.add('active');
  
  if (state.ytPlayer && state.ytPlayer.pauseVideo) {
    try { state.ytPlayer.pauseVideo(); } catch(e) {}
  }
  if (state.boardYtPlayer && state.boardYtPlayer.pauseVideo) {
    try { state.boardYtPlayer.pauseVideo(); } catch(e) {}
  }
}

export function closeTheaterMode() {
  const modal = document.getElementById('theater-modal');
  const container = document.getElementById('theater-player-container');
  if (modal) modal.classList.remove('active');
  if (container) container.innerHTML = '';
  
  if (state.localPlayer.currentRoom !== -1) {
    setupRoomVideo(state.localPlayer.currentRoom);
  }
}

export function onCanvasClick(event) {
  if (handleEditorCanvasClick(event)) {
    return;
  }

  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, state.camera);

  if (state.localPlayer.currentRoom === -1) {
    const markerIntersects = raycaster.intersectObjects(state.clickableRoomMarkers);
    if (markerIntersects.length > 0) {
      const targetRoom = markerIntersects[0].object.userData?.roomId;
      if (targetRoom !== undefined) {
        focusRoomFromLobbyMarker(targetRoom);
        return;
      }
    }
    return;
  }

  const intersects = raycaster.intersectObjects(state.clickableScreens);
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
  state.localPlayer.y = getTerrainHeight(state.localPlayer.x, state.localPlayer.z);
  state.localPlayer.velocity.set(0, 0, 0);
  state.localPlayer.mesh.position.set(state.localPlayer.x, state.localPlayer.y, state.localPlayer.z);
  state.controls.target.set(room.x, 1.4, room.z);
  addChatLog('System', `Moved closer to ${room.name}.`, 'system-msg');
  
  // Custom event trigger for engine
  const event = new CustomEvent('room-marker-teleport');
  window.dispatchEvent(event);
}

import { sanitizeColor } from './utils.js';

export function refreshRoomPlayersList() {
  const listContainer = document.getElementById('room-players-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  
  if (state.localPlayer.currentRoom === -1) return;

  function makePlayerItem(color, label, strong) {
    const li = document.createElement('li');
    li.className = 'room-player-item';
    const badge = document.createElement('span');
    badge.className = 'room-player-badge';
    badge.style.backgroundColor = sanitizeColor(color);
    const name = document.createElement(strong ? 'strong' : 'span');
    name.textContent = label;
    li.appendChild(badge);
    li.appendChild(name);
    return li;
  }

  // Add self
  listContainer.appendChild(
    makePlayerItem(state.localPlayer.color, `${state.localPlayer.username} (You)`, true)
  );

  // Add matching remote players
  state.remotePlayers.forEach((p) => {
    if (p.room === state.localPlayer.currentRoom) {
      listContainer.appendChild(makePlayerItem(p.color, p.username, false));
    }
  });

  // Capacity update
  const count = listContainer.children.length;
  const capacityEl = document.getElementById('room-capacity');
  if (capacityEl) capacityEl.innerText = `${count} / 10 Players`;
}

import { createPanelLabelSprite, disposeSprite } from './scenery.js';
import { updateRoomAudioState } from './audio.js';

export function scheduleRoomVisualRefresh() {
  if (state.roomSignState.scheduledRefresh !== null) return;
  state.roomSignState.scheduledRefresh = window.requestAnimationFrame(() => {
    state.roomSignState.scheduledRefresh = null;
    syncRoomVisuals();
  });
}

export function syncRoomVisuals() {
  state.ROOMS.forEach((room) => {
    const status = getRoomEventStatus(room);
    const marker = state.ROOM_INDICATORS.get(room.id);
    if (marker) {
      const color = new THREE.Color(WORLD_CONFIG.roomBeaconColors[status.tone] || WORLD_CONFIG.roomBeaconColors.idle);
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
        const replacement = createPanelLabelSprite(room.name, nextSubtitle, ROOM_LAYOUTS[room.id]?.themeColor || WORLD_CONFIG.signAccent);
        replacement.position.copy(signSprite.position);
        replacement.userData.title = room.name;
        replacement.userData.subtitle = nextSubtitle;
        signSprite.parent.add(replacement);
        signSprite.parent.remove(signSprite);
        disposeSprite(signSprite);
        state.ROOM_SIGN_SPRITES.set(room.id, replacement);
      }
    }
  });
  updateRoomAudioState();
}

export function updateRoomIndicatorAnimations(now) {
  const time = now * 0.001;
  state.ROOM_INDICATORS.forEach((marker) => {
    if (!marker.group.visible) return;
    const statusTone = marker.group.userData.statusTone || 'idle';
    const pulse = statusTone === 'live'
      ? 1 + Math.sin(time * 3.6 + marker.seed) * 0.08
      : 1 + Math.sin(time * 1.8 + marker.seed) * 0.04;
    marker.ring.scale.setScalar(pulse);
    marker.glow.material.opacity = statusTone === 'live' ? 0.55 + Math.sin(time * 4 + marker.seed) * 0.1 : 0.35;
    marker.group.rotation.y += 0.0025;
  });

  state.animatedScenery.forEach((item) => {
    if (!item.object.visible) return;
    if (item.type === 'banner') {
      item.object.rotation.z = Math.sin(time * item.speed + item.seed) * item.amplitude;
    } else if (item.type === 'spark') {
      item.object.position.y = item.baseY + Math.sin(time * item.speed + item.seed) * item.amplitude;
    }
  });
}

export function addChatLog(author, message, className = "") {
  const log = document.getElementById('chat-log');
  if (!log) return;
  const msgDiv = document.createElement('div');
  
  if (className) {
    msgDiv.className = className;
    msgDiv.textContent = message;
  } else {
    msgDiv.className = 'chat-msg';
    const authorSpan = document.createElement('span');
    authorSpan.className = 'chat-author';
    authorSpan.style.color = author === state.localPlayer.username ? '#818cf8' : '#38bdf8';
    authorSpan.textContent = `${author}:`;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    msgDiv.appendChild(authorSpan);
    msgDiv.appendChild(msgSpan);
  }
  
  log.appendChild(msgDiv);
  log.scrollTop = log.scrollHeight;
}

export function displayChatBubble(playerId, text) {
  let targetP = null;
  if (playerId === state.localPlayer.id) {
    targetP = state.localPlayer;
    targetP.group = state.localPlayer.mesh;
  } else {
    targetP = state.remotePlayers.get(playerId);
  }

  if (!targetP || !targetP.group) return;

  if (targetP.chatBubble) {
    targetP.group.remove(targetP.chatBubble);
    targetP.chatBubble.material.map.dispose();
    targetP.chatBubble.material.dispose();
    targetP.chatBubble = null;
  }
  if (targetP.chatTimeout) {
    clearTimeout(targetP.chatTimeout);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;

  const r = 8;
  const x = 6, y = 6, w = 244, h = 50;
  
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  
  ctx.lineTo(128 + 10, y + h);
  ctx.lineTo(128, y + h + 12);
  ctx.lineTo(128 - 10, y + h);
  
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  let displayVal = text;
  if (text.length > 25) {
    displayVal = text.substring(0, 22) + "...";
  }
  ctx.fillText(displayVal, 128, 30);

  const texture = new THREE.CanvasTexture(canvas);
  const bubbleMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const bubbleSprite = new THREE.Sprite(bubbleMat);
  bubbleSprite.scale.set(2.4, 0.75, 1);
  bubbleSprite.position.set(0, 3.4, 0);

  targetP.chatBubble = bubbleSprite;
  targetP.group.add(bubbleSprite);

  targetP.chatTimeout = setTimeout(() => {
    if (targetP.group && targetP.chatBubble) {
      targetP.group.remove(targetP.chatBubble);
      targetP.chatBubble.material.map.dispose();
      targetP.chatBubble.material.dispose();
      targetP.chatBubble = null;
    }
  }, 4500);
}

export function setupRoomVideo(roomId) {
  const room = state.ROOMS[roomId];
  const videoId = room.sourceValue || room.video || "";

  if (!videoId) {
    const roomYt = document.getElementById('youtube-player');
    if (roomYt) roomYt.style.display = 'none';
    const roomMeet = document.getElementById('room-meet-card');
    if (roomMeet) roomMeet.style.display = 'none';
    if (state.ytPlayer && state.ytPlayer.pauseVideo) {
      try { state.ytPlayer.pauseVideo(); } catch (e) {}
    }
    state.activeRoomVideoId = "";
    
    if (roomId === 6) {
      const boardYt = document.getElementById('embedded-youtube-player');
      if (boardYt) boardYt.style.display = 'none';
      const boardMeet = document.getElementById('board-meet-card');
      if (boardMeet) boardMeet.style.display = 'none';
      if (state.boardYtPlayer && state.boardYtPlayer.pauseVideo) {
        try { state.boardYtPlayer.pauseVideo(); } catch (e) {}
      }
    }
    return;
  }

  const isMeet = room.sourceType === 'meet';
  const playbackStart = getRoomPlaybackStartSeconds(room);

  // 1. Handle Classroom Blackboard (Room 6)
  if (roomId === 6) {
    const boardContainer = document.getElementById('embedded-board-container');
    let boardYt = document.getElementById('embedded-youtube-player');
    let boardMeet = document.getElementById('board-meet-card');

    if (isMeet) {
      if (boardYt) boardYt.style.display = 'none';
      if (state.boardYtPlayer && state.boardYtPlayer.pauseVideo) {
        try { state.boardYtPlayer.pauseVideo(); } catch(e) {}
      }
      
      if (!boardMeet) {
        boardMeet = document.createElement('div');
        boardMeet.id = 'board-meet-card';
        boardMeet.style.cssText = "width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #fff; text-align: center; padding: 20px; box-sizing: border-box;";
        boardContainer.appendChild(boardMeet);
      }
      populateMeetCard(boardMeet, videoId, true);
      boardMeet.style.display = 'flex';
    } else {
      if (boardMeet) boardMeet.style.display = 'none';
      if (boardYt) boardYt.style.display = 'block';

      if (state.boardYtPlayer && typeof state.boardYtPlayer.loadVideoById === 'function') {
        try {
          state.boardYtPlayer.loadVideoById({
            videoId: videoId,
            startSeconds: playbackStart
          });
        } catch (e) {}
      } else if (window.YT && window.YT.Player) {
        try {
          state.boardYtPlayer = new window.YT.Player('embedded-youtube-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
              'playsinline': 1,
              'autoplay': 1,
              'controls': 1,
              'rel': 0,
              'start': playbackStart
            },
            events: {
              'onReady': (event) => {
                event.target.playVideo();
              }
            }
          });
        } catch (err) {
          console.error("Failed to build board YT player", err);
        }
      }
    }
  }

  // 2. Handle Side Room Panel
  const roomContainer = document.querySelector('.video-container');
  let roomYt = document.getElementById('youtube-player');
  let roomMeet = document.getElementById('room-meet-card');

  if (isMeet) {
    if (roomYt) roomYt.style.display = 'none';
    if (state.ytPlayer && state.ytPlayer.pauseVideo) {
      try { state.ytPlayer.pauseVideo(); } catch(e) {}
    }

    if (!roomMeet) {
      roomMeet = document.createElement('div');
      roomMeet.id = 'room-meet-card';
      roomMeet.style.cssText = "width: 100%; height: 100%; position: absolute; top: 0; left: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #fff; text-align: center; padding: 15px; box-sizing: border-box;";
      roomContainer.appendChild(roomMeet);
    }
    populateMeetCard(roomMeet, videoId, false);
    roomMeet.style.display = 'flex';
    state.activeRoomVideoId = videoId;
  } else {
    if (roomMeet) roomMeet.style.display = 'none';
    if (roomYt) roomYt.style.display = 'block';

    if (state.activeRoomVideoId === videoId) {
      if (state.ytPlayer && state.ytPlayer.playVideo) {
        try {
          state.ytPlayer.playVideo();
        } catch (e) {}
      }
      return;
    }

    state.activeRoomVideoId = videoId;

    if (state.ytPlayer && typeof state.ytPlayer.loadVideoById === 'function') {
      state.ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: playbackStart
      });
    } else {
      try {
        if (window.YT && window.YT.Player) {
          state.ytPlayer = new window.YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
              'playsinline': 1,
              'autoplay': 1,
              'controls': 1,
              'rel': 0,
              'start': playbackStart
            },
            events: {
              'onReady': (event) => {
                event.target.playVideo();
              }
            }
          });
        }
      } catch (err) {
        console.error("Failed to build side room YT player", err);
      }
    }
  }
}

export function initUiHandlers() {
  initEditorUiHandlers();

  // Login form submission
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username-input').value.trim();
    const avatarType = "explorer";
    const color = document.getElementById('color-input').value;
    
    if (!username) return;
    
    state.localPlayer.username = username;
    state.localPlayer.avatarType = avatarType;
    state.localPlayer.color = color;
    
    // Spawn local avatar
    const avatar = createPlayerAvatar(avatarType, color, username, true);
    state.localPlayer.mesh = avatar.group;
    state.localPlayer.mesh.position.set(state.localPlayer.x, state.localPlayer.y, state.localPlayer.z);
    state.localPlayer.mesh.rotation.y = state.localPlayer.ry;
    
    // Animate the login card out, then hide the overlay. (Must not depend on a
    // specific card element existing, or the overlay would never close and would
    // keep the username field focused — blocking movement keys.)
    const loginOverlay = document.getElementById('login-overlay');
    const loginCard = loginOverlay ? loginOverlay.querySelector('.login-card') : null;
    if (loginCard) {
      loginCard.style.opacity = '0';
      loginCard.style.transform = 'translateY(-20px)';
    }
    document.activeElement?.blur?.();
    setTimeout(() => {
      if (loginOverlay) {
        loginOverlay.classList.remove('active');
        loginOverlay.style.display = 'none';
      }
    }, 500);
    
    // Initialize multiplayer connection
    connectMultiplayer();
    state.isJoined = true;
    resumeAudioContext();
  });

  // Color picker synchronization
  const colorPicker = document.getElementById('color-input');
  const colorHexEl = document.getElementById('color-hex');
  if (colorPicker && colorHexEl) {
    colorPicker.addEventListener('input', (e) => {
      colorHexEl.textContent = e.target.value.toUpperCase();
    });
  }

  // Chat submit handler
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({
        type: 'chat',
        message: msg
      }));
    }
    addChatLog(state.localPlayer.username, msg);
    displayChatBubble(state.localPlayer.id, msg);
    input.value = '';
  });

  document.getElementById('event-board-list').addEventListener('click', (e) => {
    const card = e.target.closest('.event-board-item');
    if (!card) return;
    const roomId = Number.parseInt(card.dataset.roomId || '', 10);
    if (Number.isNaN(roomId)) return;
    focusRoomFromLobbyMarker(roomId);
  });

  document.getElementById('event-board-list').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.event-board-item');
    if (!card) return;
    e.preventDefault();
    const roomId = Number.parseInt(card.dataset.roomId || '', 10);
    if (!Number.isNaN(roomId)) {
      focusRoomFromLobbyMarker(roomId);
    }
  });

  document.getElementById('soundtrack-toggle').addEventListener('click', async () => {
    SOUNDTRACK_STATE.enabled = !SOUNDTRACK_STATE.enabled;
    if (!SOUNDTRACK_STATE.enabled) {
      pauseSoundtrackPlayback();
      updateSoundtrackUi();
      return;
    }
    updateSoundtrackUi();
    await resumeAudioContext();
  });

  document.getElementById('close-panel-btn').addEventListener('click', () => {
    document.getElementById('room-panel').classList.remove('room-panel-visible');
    document.getElementById('room-panel').setAttribute('aria-hidden', 'true');
  });

  // Theater mode buttons
  const openTheaterBtn = document.getElementById('open-theater-btn');
  if (openTheaterBtn) {
    openTheaterBtn.addEventListener('click', () => {
      if (state.localPlayer.currentRoom !== -1) {
        openTheaterMode(state.localPlayer.currentRoom);
      }
    });
  }

  const closeTheaterBtn = document.getElementById('close-theater-btn');
  if (closeTheaterBtn) {
    closeTheaterBtn.addEventListener('click', () => {
      closeTheaterMode();
    });
  }

  const boardMaximizeBtn = document.getElementById('board-maximize-btn');
  if (boardMaximizeBtn) {
    boardMaximizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTheaterMode(6);
    });
  }

  // Click on WebGL canvas to raycast
  const container = document.getElementById('game-container');
  if (container) {
    container.addEventListener('click', onCanvasClick);
  }

  window.addEventListener('pointerdown', () => {
    if (state.isJoined) {
      resumeAudioContext();
    }
  });
  
  window.addEventListener('keydown', (e) => {
    // Movement / camera input (ignored while typing in a field).
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      const k = e.key.toLowerCase();
      if (k === 'w') state.keys.w = true;
      else if (k === 's') state.keys.s = true;
      else if (k === 'a') state.keys.a = true;
      else if (k === 'd') state.keys.d = true;
      if (e.key === ' ') state.keys.space = true;
      if (e.key === 'ArrowLeft') state.cameraKeys.ArrowLeft = true;
      else if (e.key === 'ArrowRight') state.cameraKeys.ArrowRight = true;
      else if (e.key === 'ArrowUp') state.cameraKeys.ArrowUp = true;
      else if (e.key === 'ArrowDown') state.cameraKeys.ArrowDown = true;
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
      const modal = document.getElementById('video-input-modal');
      if (modal) modal.classList.remove('video-modal-visible');
      closeTheaterMode();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') state.keys.w = false;
    else if (k === 's') state.keys.s = false;
    else if (k === 'a') state.keys.a = false;
    else if (k === 'd') state.keys.d = false;
    if (e.key === ' ') state.keys.space = false;
    if (e.key === 'ArrowLeft') state.cameraKeys.ArrowLeft = false;
    else if (e.key === 'ArrowRight') state.cameraKeys.ArrowRight = false;
    else if (e.key === 'ArrowUp') state.cameraKeys.ArrowUp = false;
    else if (e.key === 'ArrowDown') state.cameraKeys.ArrowDown = false;
  });
}
