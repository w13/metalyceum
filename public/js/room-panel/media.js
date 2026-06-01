// YouTube Live and Google Meet media synchronization for Metalyceum room screens
import * as THREE from 'three';
import { state } from '../state.js';
import { getRoomPlaybackStartSeconds, safeMeetUrl, parseVideoInput } from '../utils.js';
import { closeModal, isModalRegistered, isModalOpen } from '../modals.js';
import { restoreSoundtrackAfterRoomMedia, suppressSoundtrackForRoomMedia } from '../audio.js';

let _roomVideoContainer = null;
const roomScreenTextureCache = new Map();
const roomScreenTextureLoads = new Map();
const ROOM_MEDIA_SYNC_DELAY_MS = 60;
const ROOM_MEDIA_LAZY_LOAD_DELAY_MS = 180;
const roomScreenTextureLoader = new THREE.TextureLoader();
roomScreenTextureLoader.setCrossOrigin('anonymous');

function createElement(tagName, { className = '', textContent = '', styleText = '' } = {}) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  if (styleText) el.style.cssText = styleText;
  return el;
}

function setDisplayById(elementId, display) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = display;
  return el;
}

function pauseYoutubePlayer(player) {
  if (!player?.pauseVideo) return;
  try { player.pauseVideo(); } catch (e) {}
}

function getEmbeddedYoutubeIframe(containerId) {
  return document.getElementById(containerId)?.querySelector('iframe') || null;
}

function postYoutubeIframeCommand(iframe, func) {
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func,
      args: []
    }), 'https://www.youtube.com');
  } catch (e) {}
}

function pauseEmbeddedYoutubeIframe(iframe) {
  postYoutubeIframeCommand(iframe, 'pauseVideo');
}

function resumeEmbeddedYoutubeIframe(iframe) {
  postYoutubeIframeCommand(iframe, 'playVideo');
}

function hasReusableYoutubeEmbed(containerId, sourceKey) {
  const iframe = getEmbeddedYoutubeIframe(containerId);
  return Boolean(iframe && iframe.dataset.sourceKey === sourceKey);
}

function getMediaSlotKeys(slot) {
  return slot === 'board'
    ? { timerKey: 'boardLoadTimer', tokenKey: 'boardLoadToken' }
    : { timerKey: 'roomPanelLoadTimer', tokenKey: 'roomPanelLoadToken' };
}

function clearMediaSlotLoad(slot) {
  const { timerKey, tokenKey } = getMediaSlotKeys(slot);
  const timer = state.roomMediaState[timerKey];
  if (timer !== null) {
    window.clearTimeout(timer);
    state.roomMediaState[timerKey] = null;
  }
  state.roomMediaState[tokenKey] += 1;
}

function scheduleMediaSlotLoad(slot, callback) {
  const { timerKey, tokenKey } = getMediaSlotKeys(slot);
  clearMediaSlotLoad(slot);
  const token = state.roomMediaState[tokenKey];

  state.roomMediaState[timerKey] = window.setTimeout(() => {
    state.roomMediaState[timerKey] = null;

    const run = () => {
      if (token !== state.roomMediaState[tokenKey]) return;
      callback();
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 120 });
    } else {
      run();
    }
  }, ROOM_MEDIA_LAZY_LOAD_DELAY_MS);
}

function clearEmbedTarget(elementId) {
  const target = document.getElementById(elementId);
  if (!target) return null;
  target.replaceChildren();
  target.style.display = 'none';
  return target;
}

function renderYoutubeEmbed({ containerId, videoId, playbackStart = 0, sourceKey }) {
  const existingIframe = getEmbeddedYoutubeIframe(containerId);
  const target = existingIframe?.dataset.sourceKey === sourceKey
    ? document.getElementById(containerId)
    : clearEmbedTarget(containerId);
  if (!target) return;

  if (existingIframe?.dataset.sourceKey === sourceKey) {
    target.style.position = 'absolute';
    target.style.inset = '0';
    target.style.width = '100%';
    target.style.height = '100%';
    target.style.display = 'block';
    window.setTimeout(() => resumeEmbeddedYoutubeIframe(existingIframe), 0);
    return;
  }

  // Resolve full URLs (e.g. youtube.com/live/ID) to bare video IDs
  const resolvedId = parseVideoInput(videoId) || videoId;
  const iframe = document.createElement('iframe');
  const params = new URLSearchParams({
    autoplay: '1',
    enablejsapi: '1',
    playsinline: '1',
    rel: '0',
    start: String(Math.max(0, Math.floor(playbackStart)))
  });
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(resolvedId)}?${params.toString()}`;
  iframe.title = 'Room video';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;
  iframe.style.position = 'absolute';
  iframe.style.inset = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  iframe.dataset.sourceKey = sourceKey;
  iframe.dataset.videoId = resolvedId;

  target.style.position = 'absolute';
  target.style.inset = '0';
  target.style.width = '100%';
  target.style.height = '100%';
  target.style.display = 'block';
  target.appendChild(iframe);
}

function getOrCreateMeetCard(container, meetCardId, styleText) {
  if (!container) return null;

  let meetCard = document.getElementById(meetCardId);
  if (!meetCard) {
    meetCard = createElement('div', { styleText });
    meetCard.id = meetCardId;
    container.appendChild(meetCard);
  }
  return meetCard;
}

function populateMeetCard(el, videoId, isBoard) {
  el.innerHTML = '';
  const icon = createElement('span', {
    styleText: `font-size: ${isBoard ? 28 : 32}px; margin-bottom: ${isBoard ? 6 : 8}px;`,
    textContent: '🌐'
  });
  const title = createElement('div', {
    styleText: "font-weight:600;font-size:14px;margin-bottom:4px;font-family:'Plus Jakarta Sans',sans-serif;",
    textContent: 'Google Meet Active'
  });
  const sub = createElement('div', {
    styleText: "font-size:11px;color:#94a3b8;margin-bottom:12px;font-family:'Plus Jakarta Sans',sans-serif;",
    textContent: isBoard ? 'Classroom has a live meeting.' : 'Room has a live video call.'
  });
  const a = createElement('a', {
    styleText: "background:#2563eb;color:#fff;padding:6px 12px;border-radius:4px;font-size:11px;text-decoration:none;font-weight:600;pointer-events:auto;",
    textContent: 'Join Meeting'
  });
  const url = safeMeetUrl(videoId);
  if (url) a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  el.append(icon, title, sub, a);
}

function hideMediaSlot(youtubeId, meetCardId, player, { preserveYoutube = false } = {}) {
  const youtubeTarget = document.getElementById(youtubeId);
  if (youtubeTarget) {
    const iframe = getEmbeddedYoutubeIframe(youtubeId);
    if (preserveYoutube && iframe) {
      pauseEmbeddedYoutubeIframe(iframe);
      youtubeTarget.style.display = 'none';
    } else {
      clearEmbedTarget(youtubeId);
    }
  }
  const meetCard = setDisplayById(meetCardId, 'none');
  if (meetCard) meetCard.innerHTML = '';
  pauseYoutubePlayer(player);
}

function setRoomPanelMediaVisible(visible) {
  if (!_roomVideoContainer) _roomVideoContainer = document.querySelector('.video-container');
  if (_roomVideoContainer) {
    _roomVideoContainer.style.display = visible ? 'block' : 'none';
  }
}

function clearRoomMediaUi({ preserveYoutube = false } = {}) {
  clearMediaSlotLoad('room-panel');
  hideMediaSlot('youtube-player', 'room-meet-card', state.ytPlayer, { preserveYoutube });
  setRoomPanelMediaVisible(false);
  state.activeRoomVideoId = '';
}

function closeTheaterPlayback() {
  const theaterContainer = document.getElementById('theater-player-container');
  if (state._theaterMovedIframeSource && theaterContainer) {
    const sourceContainer = document.getElementById(state._theaterMovedIframeSource);
    const movedIframe = getEmbeddedYoutubeIframe('theater-player-container');
    if (movedIframe && sourceContainer) {
      movedIframe.style.position = 'absolute';
      movedIframe.style.inset = '0';
      movedIframe.style.width = '100%';
      movedIframe.style.height = '100%';
      movedIframe.style.border = '0';
      sourceContainer.appendChild(movedIframe);
      pauseEmbeddedYoutubeIframe(movedIframe);
    }
    state._theaterMovedIframeSource = null;
    const videoSection = document.querySelector('.video-section');
    if (videoSection) videoSection.style.visibility = '';
  }
  if (theaterContainer && theaterContainer.childElementCount > 0) {
    theaterContainer.innerHTML = '';
  }
  if (isModalRegistered('theater-modal') && isModalOpen('theater-modal')) {
    closeModal('theater-modal', { restoreFocus: false });
  }
}

function getRoomMediaSource(room) {
  return room?.sourceValue || room?.video || '';
}

function hasRoomMediaSource(room) {
  return Boolean(getRoomMediaSource(room));
}

function getRoomMediaStateKey(roomId = state.localPlayer.currentRoom) {
  const room = roomId >= 0 ? state.ROOMS[roomId] : null;
  if (!room) return '';
  return `${roomId}:${room.sourceType}:${getRoomMediaSource(room)}`;
}

function clearPendingRoomMediaSync() {
  if (state.roomMediaState.pendingSyncTimer !== null) {
    window.clearTimeout(state.roomMediaState.pendingSyncTimer);
    state.roomMediaState.pendingSyncTimer = null;
  }
  state.roomMediaState.pendingRoomId = -2;
}

function applyRoomScreenFallback(roomId) {
  const screenEntry = state.roomScreens.get(roomId);
  if (!screenEntry) return;
  screenEntry.pendingVideoId = '';
  screenEntry.material.map = null;
  screenEntry.material.emissiveMap = null;
  screenEntry.material.color.copy(screenEntry.baseColor);
  screenEntry.material.emissive.copy(screenEntry.baseEmissive);
  screenEntry.material.emissiveIntensity = 0.2;
  screenEntry.material.toneMapped = true;
  screenEntry.material.needsUpdate = true;
}

/** Fallback thumbnail sizes for videos missing hqdefault.jpg */
const THUMBNAIL_SIZES = ['hqdefault', 'mqdefault', 'default'];

function loadThumbnailSize(videoId, sizes, index) {
  return new Promise((resolve) => {
    roomScreenTextureLoader.load(
      `https://i.ytimg.com/vi/${videoId}/${sizes[index]}.jpg`,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve(texture);
      },
      undefined,
      () => {
        // Try next size, or null if none left
        if (index + 1 < sizes.length) {
          resolve(loadThumbnailSize(videoId, sizes, index + 1));
        } else {
          resolve(null);
        }
      }
    );
  });
}

function loadRoomScreenThumbnail(videoId) {
  if (roomScreenTextureCache.has(videoId)) {
    return Promise.resolve(roomScreenTextureCache.get(videoId));
  }
  if (roomScreenTextureLoads.has(videoId)) {
    return roomScreenTextureLoads.get(videoId);
  }

  const texturePromise = loadThumbnailSize(videoId, THUMBNAIL_SIZES, 0).then((texture) => {
    if (texture) {
      roomScreenTextureCache.set(videoId, texture);
    }
    roomScreenTextureLoads.delete(videoId);
    return texture;
  });

  roomScreenTextureLoads.set(videoId, texturePromise);
  return texturePromise;
}

export function syncRoomScreenMedia(room) {
  const screenEntry = state.roomScreens.get(room.id);
  if (!screenEntry) return;

  const rawId = room.sourceType === 'youtube' ? getRoomMediaSource(room) : '';
  const videoId = rawId ? (parseVideoInput(rawId) || rawId) : '';
  if (!videoId) {
    applyRoomScreenFallback(room.id);
    return;
  }

  screenEntry.pendingVideoId = videoId;
  loadRoomScreenThumbnail(videoId).then((texture) => {
    const latestEntry = state.roomScreens.get(room.id);
    if (!latestEntry || latestEntry.pendingVideoId !== videoId) return;
    if (!texture) {
      applyRoomScreenFallback(room.id);
      return;
    }
    latestEntry.material.map = texture;
    latestEntry.material.emissiveMap = texture;
    latestEntry.material.color.set('#ffffff');
    latestEntry.material.emissive.set('#ffffff');
    latestEntry.material.emissiveIntensity = 0.95;
    latestEntry.material.toneMapped = false;
    latestEntry.material.needsUpdate = true;
  });
}

function showMeetSlot({ container, youtubeId, meetCardId, meetCardStyle, player, videoId, isBoard }) {
  clearEmbedTarget(youtubeId);
  pauseYoutubePlayer(player);

  const meetCard = getOrCreateMeetCard(container, meetCardId, meetCardStyle);
  if (!meetCard) return;
  populateMeetCard(meetCard, videoId, isBoard);
  meetCard.style.display = 'flex';
}

export function setupRoomVideo(roomId) {
  const room = state.ROOMS[roomId];
  const videoId = getRoomMediaSource(room);
  const mediaStateKey = getRoomMediaStateKey(roomId);

  if (!videoId) {
    clearRoomMediaUi();
    return;
  }

  const isMeet = room.sourceType === 'meet';
  const playbackStart = getRoomPlaybackStartSeconds(room);

  clearMediaSlotLoad('room-panel');

  const oldBoard = document.getElementById('embedded-board-container');
  if (oldBoard) oldBoard.style.display = 'none';

  hideMediaSlot('youtube-player', 'room-meet-card', state.ytPlayer, {
    preserveYoutube: !isMeet && hasReusableYoutubeEmbed('youtube-player', mediaStateKey)
  });
  setRoomPanelMediaVisible(false);
  scheduleMediaSlotLoad('room-panel', () => {
    if (state.localPlayer.currentRoom !== roomId || getRoomMediaStateKey(roomId) !== mediaStateKey) return;

    if (!_roomVideoContainer) _roomVideoContainer = document.querySelector('.video-container');
    if (!_roomVideoContainer) return;
    setRoomPanelMediaVisible(true);

    if (isMeet) {
      showMeetSlot({
        container: _roomVideoContainer,
        youtubeId: 'youtube-player',
        meetCardId: 'room-meet-card',
        meetCardStyle: '',
        player: state.ytPlayer,
        videoId,
        isBoard: false
      });
      return;
    }

    renderYoutubeEmbed({
      containerId: 'youtube-player',
      videoId,
      playbackStart,
      sourceKey: mediaStateKey
    });
  });
  state.activeRoomVideoId = videoId;
}

function applyActiveRoomMediaState({ roomId = state.localPlayer.currentRoom, stopOtherMedia = false, closeTheater = false } = {}) {
  const room = roomId >= 0 ? state.ROOMS[roomId] : null;
  const mediaStateKey = getRoomMediaStateKey(roomId);
  const hasMedia = Boolean(room && hasRoomMediaSource(room));

  if (!stopOtherMedia &&
      state.roomMediaState.activeRoomId === roomId &&
      state.roomMediaState.activeSourceKey === mediaStateKey) {
    return;
  }

  if (stopOtherMedia) {
    pauseYoutubePlayer(state.ytPlayer);
    pauseYoutubePlayer(state.boardYtPlayer);
    if (closeTheater) closeTheaterPlayback();
  }

  if (!room) {
    clearRoomMediaUi({ preserveYoutube: state.roomMediaState.activeSourceType === 'youtube' });
    state.roomMediaState.activeRoomId = -1;
    state.roomMediaState.activeSourceKey = '';
    state.roomMediaState.activeSourceType = 'none';
    restoreSoundtrackAfterRoomMedia();
    return;
  }

  if (hasMedia) {
    suppressSoundtrackForRoomMedia();
  } else {
    restoreSoundtrackAfterRoomMedia();
  }

  setupRoomVideo(roomId);
  state.roomMediaState.activeRoomId = roomId;
  state.roomMediaState.activeSourceKey = mediaStateKey;
  state.roomMediaState.activeSourceType = room?.sourceType || 'none';
}

export function syncActiveRoomMediaState(options = {}) {
  clearPendingRoomMediaSync();
  applyActiveRoomMediaState(options);
}

export function scheduleActiveRoomMediaState(options = {}) {
  const roomId = options.roomId ?? state.localPlayer.currentRoom;
  const room = roomId >= 0 ? state.ROOMS[roomId] : null;
  clearPendingRoomMediaSync();

  const delay = room && hasRoomMediaSource(room) ? ROOM_MEDIA_SYNC_DELAY_MS : 0;
  if (delay === 0) {
    applyActiveRoomMediaState({ ...options, roomId });
    return;
  }

  state.roomMediaState.pendingRoomId = roomId;
  state.roomMediaState.pendingSyncTimer = window.setTimeout(() => {
    state.roomMediaState.pendingSyncTimer = null;
    state.roomMediaState.pendingRoomId = -2;
    applyActiveRoomMediaState({ ...options, roomId });
  }, delay);
}

export function pauseActiveEmbeddedYoutube() {
  const activeIframe = state._theaterMovedIframeSource
    ? getEmbeddedYoutubeIframe('theater-player-container')
    : getEmbeddedYoutubeIframe('youtube-player');
  pauseEmbeddedYoutubeIframe(activeIframe);
}

export function resumeActiveEmbeddedYoutube() {
  const roomId = state.localPlayer.currentRoom;
  const room = roomId >= 0 ? state.ROOMS[roomId] : null;
  if (!room || room.sourceType !== 'youtube' || !getRoomMediaSource(room)) return;

  const activeIframe = state._theaterMovedIframeSource
    ? getEmbeddedYoutubeIframe('theater-player-container')
    : getEmbeddedYoutubeIframe('youtube-player');

  if (activeIframe) {
    window.setTimeout(() => resumeEmbeddedYoutubeIframe(activeIframe), 0);
    return;
  }

  setupRoomVideo(roomId);
}
