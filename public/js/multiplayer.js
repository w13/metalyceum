// WebSocket Multiplayer and Network Synchronization for Metalyceum
import { state } from './state.js';
import { applyRoomData } from './utils.js';
import {
  scheduleEventBoardRender,
  scheduleRoomPlayersListRefresh,
  syncActiveRoomMediaState,
  updateRoomPanelDetails,
  setupRoomVideo,
  scheduleRoomVisualRefresh
} from './room-panel.js';
import {
  addChatLog,
  displayChatBubble,
  syncChatScopeWithLocation
} from './chat.js';
import { createPlayerAvatar } from './scenery.js';
import { applyPublishedWorldAssets, setEditorEnabled, updateEditorStatus } from './editor.js';
import { closeModal } from './modals.js';
import { resumeAudioContext } from './audio.js';

let reconnectAttempts = 0;
let reconnectTimer = null;
let heartbeatTimer = null;
let _reconnectOnVisible = false;
let _tabReturnPending = false; // reconnect was triggered by returning to tab
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectFailureShown = false;

function setReconnectOverlay(visible, label = 'Reconnecting…') {
  const el = document.getElementById('reconnect-overlay');
  if (el) el.style.display = visible ? 'flex' : 'none';
  const labelEl = el?.querySelector('.reconnect-label');
  if (labelEl) labelEl.textContent = label;
}

const HEARTBEAT_INTERVAL_MS = 15000;
const MISSED_HEARTBEAT_LIMIT = 2; // trigger reconnect after ~30s without ack

// Network performance profiles: how often the local player's position is sent.
// Remote players are always interpolated, so lower rates stay smooth while
// cutting bandwidth and Durable Object work (DOs are billed by active time).
// Per-frame sending is ~50/s; these profiles trade freshness for efficiency.
// Override at runtime via localStorage['metalyceum:netProfile'].
const NETWORK_PROFILES = {
  'very-efficient': {
    label: 'Very Efficient',
    sendHz: 8,
    description: 'Lowest bandwidth and server cost (~8 updates/sec). Leans hardest on interpolation — best for weak connections, mobile, or large crowds. Remote motion stays smooth but is the least "fresh".'
  },
  'efficient': {
    label: 'Efficient',
    sendHz: 12,
    description: 'Low bandwidth with good smoothness (~12 updates/sec). A cost-conscious default that still feels responsive.'
  },
  'normal': {
    label: 'Normal',
    sendHz: 20,
    description: 'Balanced (~20 updates/sec). Smooth, responsive motion at roughly a third of per-frame traffic. Recommended for most deployments.'
  },
  'high-throughput': {
    label: 'High Throughput',
    sendHz: 50,
    description: 'Maximum freshness and responsiveness (~50 updates/sec, near per-frame). Highest bandwidth and server load — for fast networks or a competitive feel.'
  }
};

const NETWORK_PROFILE = (() => {
  try {
    const stored = localStorage.getItem('metalyceum:netProfile');
    if (stored && NETWORK_PROFILES[stored]) return stored;
  } catch (e) {}
  return 'normal';
})();

const ACTIVE_NETWORK_PROFILE = NETWORK_PROFILES[NETWORK_PROFILE] || NETWORK_PROFILES.normal;
const SEND_INTERVAL_MS = 1000 / ACTIVE_NETWORK_PROFILE.sendHz;
let lastSentTime = 0;

function setConnectionStatus(connected) {
  document.getElementById('connection-status').classList.toggle('connected', connected);
}

function sendSocketMessage(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat(socket) {
  stopHeartbeat();
  state.lastHeartbeatAck = Date.now();
  const tick = () => {
    if (socket !== state.socket || socket.readyState !== WebSocket.OPEN) {
      stopHeartbeat();
      return;
    }
    sendSocketMessage(socket, { type: 'heartbeat' });
    // If no ack within missed-heartbeat window, assume connection is dead
    if (Date.now() - state.lastHeartbeatAck > HEARTBEAT_INTERVAL_MS * MISSED_HEARTBEAT_LIMIT) {
      socket.close(3001, 'Heartbeat timeout');
      return;
    }
  };
  tick();
  heartbeatTimer = setInterval(tick, HEARTBEAT_INTERVAL_MS);
}

function refreshRoomsUi(activeRoomId = state.localPlayer.currentRoom) {
  scheduleEventBoardRender();
  scheduleRoomVisualRefresh();
  if (activeRoomId !== -1) {
    updateRoomPanelDetails();
    syncActiveRoomMediaState({ roomId: activeRoomId });
  }
}

function applyRoomCollection(rooms) {
  if (!Array.isArray(rooms)) return;
  rooms.forEach((roomData, index) => {
    applyRoomData(roomData.roomId ?? index, roomData);
  });
}

function applySingleRoomUpdate(roomId, roomData) {
  applyRoomData(roomId, roomData);
  refreshRoomsUi(state.localPlayer.currentRoom === roomId ? roomId : -1);
}

function renderChatHistory(history) {
  if (!Array.isArray(history)) return;
  history.forEach((entry) => {
    addChatLog(
      entry.username,
      entry.message,
      '',
      entry.scope === 'room' ? 'room' : 'global',
      Number.isInteger(entry.roomId) ? entry.roomId : null,
      entry.messageId
    );
  });
}

function getSystemMessage(data) {
  if (typeof data.message === 'string') return data.message;
  if (typeof data.reason === 'string') return data.reason;
  return '';
}

function showSystemMessage(message) {
  if (!message) return;
  addChatLog('System', message, 'system-msg');
  if (state.editor.enabled) updateEditorStatus(message);
}

function reconcileRemotePlayers(players) {
  const liveIds = new Set(
    (Array.isArray(players) ? players : [])
      .map((player) => player?.id)
      .filter(Boolean)
  );

  for (const id of Array.from(state.remotePlayers.keys())) {
    if (!liveIds.has(id)) {
      state.disconnectedPlayerIds.delete(id);
      removeRemotePlayer(id);
    }
  }

  (Array.isArray(players) ? players : []).forEach((player) => {
    const existing = state.remotePlayers.get(player.id);
    if (existing) {
      // Update existing — smoother than destroy+rebuild
      existing.targetX = player.x;
      existing.targetY = player.y;
      existing.targetZ = player.z;
      existing.targetRy = player.ry || 0;
      existing.isMoving = Boolean(player.isMoving);
      if (typeof player.room === 'number') existing.room = player.room;
    } else {
      spawnRemotePlayer(player);
    }
  });
}

function handleInitMessage(data) {
  state.localPlayer.id = data.id || data.playerId;
  syncChatScopeWithLocation();

  if (Array.isArray(data.rooms)) {
    applyRoomCollection(data.rooms);
  } else if (data.videos) {
    for (let i = 0; i < 8; i += 1) {
      applyRoomData(i, { sourceValue: data.videos[i] || '' });
    }
  }

  renderChatHistory(data.chatHistory);
  refreshRoomsUi();
  applyPublishedWorldAssets(data.worldAssets || []);
  reconcileRemotePlayers(data.players || []);
}

function applyRemoteState(snapshot) {
  if (!snapshot || snapshot.id === state.localPlayer.id) return;
  const remotePlayer = state.remotePlayers.get(snapshot.id);
  if (!remotePlayer) return;

  remotePlayer.targetX = snapshot.x;
  remotePlayer.targetY = snapshot.y;
  remotePlayer.targetZ = snapshot.z;
  remotePlayer.targetRy = snapshot.ry;
  remotePlayer.isMoving = Boolean(snapshot.isMoving);
  if (typeof snapshot.room === 'number') {
    remotePlayer.room = snapshot.room;
  }
}

export function connectMultiplayer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (state.socket) {
    try {
      if (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING) {
        state.socket.close();
      }
    } catch (e) {}
    // Clear old listeners so they don't pile up across reconnects
    state.socket.onopen = null;
    state.socket.onclose = null;
    state.socket.onerror = null;
    state.socket.onmessage = null;
  }
  stopHeartbeat();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl =
    `${protocol}//${window.location.host}/ws?username=${encodeURIComponent(state.localPlayer.username)}&color=${encodeURIComponent(state.localPlayer.color)}`;

  const ws = new WebSocket(wsUrl);
  state.socket = ws;

  ws.addEventListener('open', () => {
    if (ws !== state.socket) return;
    reconnectAttempts = 0;
    reconnectFailureShown = false;
    setConnectionStatus(true);
    startHeartbeat(ws);

    // Undim the screen — no chat spam
    _tabReturnPending = false;
    setReconnectOverlay(false);
    // Clear disconnected state — existing remote players are still visible
    state.disconnectedPlayerIds.clear();

    sendSocketMessage(ws, {
      type: "join",
      x: state.localPlayer.x,
      y: state.localPlayer.y,
      z: state.localPlayer.z,
      ry: state.localPlayer.ry,
      room: state.localPlayer.currentRoom
    });

    syncChatScopeWithLocation();
  });

  ws.addEventListener('close', (event) => {
    if (ws !== state.socket) return;
    stopHeartbeat();
    // Dim the screen — no chat spam
    setReconnectOverlay(true, 'Connection lost — reconnecting…');
    // Don't clear remote players — keep them visible but mark as disconnected
    for (const id of state.remotePlayers.keys()) {
      state.disconnectedPlayerIds.add(id);
    }
    setConnectionStatus(false);
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    if (ws !== state.socket) return;
    console.error('Realtime connection error.');
  });

  ws.addEventListener('message', (event) => {
    if (ws !== state.socket) return;
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "init":
          handleInitMessage(data);
          break;

        case "join":
          if (data.player.id === state.localPlayer.id) return;
          // On reconnect, server sends join for all players — reconcile instead of respawn
          state.disconnectedPlayerIds.delete(data.player.id);
          if (!state.remotePlayers.has(data.player.id)) {
            const wasKnown = state._knownPlayers?.has(data.player.username);
            spawnRemotePlayer(data.player);
            (state._knownPlayers ??= new Set()).add(data.player.username);
            if (!wasKnown) {
              addChatLog("System", `${data.player.username} entered Metalyceum!`, "system-msg");
            }
          }
          if (state.localPlayer.currentRoom !== -1) scheduleRoomPlayersListRefresh();
          break;

        case "move":
          applyRemoteState(data);
          break;

        case "state_batch":
          (data.players || []).forEach((playerState) => {
            applyRemoteState(playerState);
          });
          break;

        case "room_change":
          if (data.id === state.localPlayer.id) return;
          const rPlayer = state.remotePlayers.get(data.id);
          if (rPlayer) {
            rPlayer.room = data.room;
            if (state.localPlayer.currentRoom !== -1) scheduleRoomPlayersListRefresh();
          }
          break;

        case "chat":
          displayChatBubble(data.id, data.message);
          addChatLog(
            data.username,
            data.message,
            '',
            data.scope === 'room' ? 'room' : 'global',
            Number.isInteger(data.roomId) ? data.roomId : null,
            data.messageId
          );
          break;

        case "editor_auth": {
          state.editor.authed = Boolean(data.ok);
          const authStatus = document.getElementById('editor-auth-status');
          if (authStatus) {
            authStatus.textContent = state.editor.authed ? 'Editor unlocked.' : 'Invalid editor token.';
          }
          if (state.editor.authed) {
            closeModal('editor-auth-modal', { restoreFocus: false });
            setEditorEnabled(true);
          }
          break;
        }

        case "world_assets_update":
        case "world_assets":
          applyPublishedWorldAssets(data.assets || []);
          if (state.editor.enabled && !state.editor.dirty) {
            updateEditorStatus('World layout saved.');
          }
          break;

        case "error":
          showSystemMessage(getSystemMessage(data));
          break;

        case "rooms_state":
          applyRoomCollection(data.rooms);
          refreshRoomsUi();
          break;

        case "room_update": {
          const rIdx = Number.isInteger(data.room?.roomId) ? data.room.roomId : data.roomId;
          applySingleRoomUpdate(rIdx, data.room || data);
          break;
        }

        case "video_change": {
          const rIdx = data.room;
          applySingleRoomUpdate(rIdx, { sourceValue: data.videoId });
          break;
        }

        case "heartbeat_ack":
          state.lastHeartbeatAck = Date.now();
          break;

        case "leave":
          state.disconnectedPlayerIds.delete(data.id);
          removeRemotePlayer(data.id);
          if (state.localPlayer.currentRoom !== -1) scheduleRoomPlayersListRefresh();
          break;
      }
    } catch (err) {
      console.error("Error handling websocket payload", err);
    }
  });
}

// clearRemotePlayers removed — preserved players on disconnect; use removeRemotePlayer directly if needed

export function scheduleReconnect() {
  if (reconnectTimer !== null) return;

  // If tab is hidden, defer reconnect until the user comes back
  if (document.hidden) {
    _reconnectOnVisible = true;
    return;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setReconnectOverlay(true, 'Unable to reconnect. Refresh the page and add ?diag if this keeps happening.');
    if (!reconnectFailureShown) {
      reconnectFailureShown = true;
      showSystemMessage('Unable to reconnect to the realtime server. Refresh the page and add ?diag if this keeps happening.');
    }
    return;
  }

  reconnectAttempts++;

  // Tab-return reconnects use the overlay; only log for genuine in-tab disconnects
  if (!_tabReturnPending && reconnectAttempts === 1) {
    addChatLog("System", "❌ Connection lost. Reconnecting…", "system-msg");
  }

  const base = Math.min(MAX_RECONNECT_DELAY, 1000 * Math.pow(2, reconnectAttempts - 1));
  const delay = Math.round(base / 2 + Math.random() * (base / 2));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectMultiplayer();
  }, delay);
}

// Listen for tab visibility changes to trigger deferred reconnects
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && _reconnectOnVisible) {
    _reconnectOnVisible = false;
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      _tabReturnPending = true;
      setReconnectOverlay(true);
      scheduleReconnect();
    }
    // If socket is still alive, nothing to do — no overlay needed
  }
});

export function spawnRemotePlayer(pData) {
  if (state.remotePlayers.has(pData.id)) {
    removeRemotePlayer(pData.id);
  }

  const avatar = createPlayerAvatar(pData.avatar || null, pData.color, pData.username, false);
  avatar.group.position.set(pData.x, pData.y, pData.z);
  avatar.group.rotation.y = pData.ry;

  const playerObj = {
    id: pData.id,
    username: pData.username,
    color: pData.color,
    avatar: pData.avatar,
    room: pData.room,
    x: pData.x, y: pData.y, z: pData.z,
    ry: pData.ry,
    targetX: pData.x, targetY: pData.y, targetZ: pData.z, targetRy: pData.ry,
    isMoving: pData.isMoving,
    isGrounded: true,
    group: avatar.group,
    mesh: avatar.group,
    leftLeg: avatar.leftLeg,
    rightLeg: avatar.rightLeg,
    leftArm: avatar.leftArm,
    rightArm: avatar.rightArm,
    nameTag: avatar.nameTag,
    chatBubble: null,
    chatTimeout: null
  };

  state.remotePlayers.set(pData.id, playerObj);
}

export function removeRemotePlayer(id) {
  const p = state.remotePlayers.get(id);
  if (p) {
    state.scene.remove(p.mesh);
    p.mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    if (p.nameTag && p.nameTag.material && p.nameTag.material.map) {
      p.nameTag.material.map.dispose();
      p.nameTag.material.dispose();
    }
    if (p.chatBubble && p.chatBubble.material && p.chatBubble.material.map) {
      p.chatBubble.material.map.dispose();
      p.chatBubble.material.dispose();
    }
    
    state.remotePlayers.delete(id);
  }
}

export function syncPosition() {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;

  const dx = Math.abs(state.localPlayer.x - state.lastSentPosition.x);
  const dy = Math.abs(state.localPlayer.y - state.lastSentPosition.y);
  const dz = Math.abs(state.localPlayer.z - state.lastSentPosition.z);
  const dry = Math.abs(state.localPlayer.ry - state.lastSentPosition.ry);
  const dMoving = state.localPlayer.isMoving !== state.lastSentPosition.isMoving;

  const changed = dx > 0.05 || dy > 0.05 || dz > 0.05 || dry > 0.02 || dMoving;
  if (!changed) return;

  const now = performance.now();
  if (!dMoving && (now - lastSentTime) < SEND_INTERVAL_MS) return;
  lastSentTime = now;

  sendSocketMessage(state.socket, {
    type: "move",
    x: parseFloat(state.localPlayer.x.toFixed(2)),
    y: parseFloat(state.localPlayer.y.toFixed(2)),
    z: parseFloat(state.localPlayer.z.toFixed(2)),
    ry: parseFloat(state.localPlayer.ry.toFixed(3)),
    isMoving: state.localPlayer.isMoving
  });

  state.lastSentPosition = {
    x: state.localPlayer.x,
    y: state.localPlayer.y,
    z: state.localPlayer.z,
    ry: state.localPlayer.ry,
    isMoving: state.localPlayer.isMoving
  };
}
