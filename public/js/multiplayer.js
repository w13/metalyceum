// WebSocket Multiplayer and Network Synchronization for Metalyceum
import { state } from './state.js';
import { applyRoomData } from './utils.js';
import {
  renderEventBoard,
  refreshRoomPlayersList,
  addChatLog,
  displayChatBubble,
  updateRoomPanelDetails,
  setupRoomVideo,
  scheduleRoomVisualRefresh
} from './ui.js';
import { createPlayerAvatar } from './scenery.js';
import { applyPublishedWorldAssets, setEditorEnabled, updateEditorStatus } from './editor.js';
import { resumeAudioContext } from './audio.js';

let reconnectAttempts = 0;
let reconnectTimer = null;
const MAX_RECONNECT_DELAY = 30000;

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
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl =
    `${protocol}//${window.location.host}/ws?username=${encodeURIComponent(state.localPlayer.username)}&color=${encodeURIComponent(state.localPlayer.color)}`;

  const ws = new WebSocket(wsUrl);
  state.socket = ws;

  ws.addEventListener('open', () => {
    if (ws !== state.socket) return;
    reconnectAttempts = 0;
    document.getElementById('connection-status').classList.add('connected');

    clearRemotePlayers();

    ws.send(JSON.stringify({
      type: "join",
      x: state.localPlayer.x,
      y: state.localPlayer.y,
      z: state.localPlayer.z,
      ry: state.localPlayer.ry
    }));
  });

  ws.addEventListener('close', () => {
    if (ws !== state.socket) return;
    document.getElementById('connection-status').classList.remove('connected');
    scheduleReconnect();
  });

  ws.addEventListener('message', (event) => {
    if (ws !== state.socket) return;
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "init":
        state.localPlayer.id = data.id || data.playerId;
          
          if (Array.isArray(data.rooms)) {
            data.rooms.forEach((roomData, index) => {
              const roomId = Number.isInteger(roomData.roomId) ? roomData.roomId : index;
              applyRoomData(roomId, roomData);
            });
          } else if (data.videos) {
            for (let i = 0; i < 8; i++) {
              applyRoomData(i, { sourceValue: data.videos[i] || "" });
            }
          }
          renderEventBoard();
          scheduleRoomVisualRefresh();
          applyPublishedWorldAssets(data.worldAssets || []);

          (data.players || []).forEach((p) => {
            spawnRemotePlayer(p);
          });
          break;

        case "join":
          if (data.player.id === state.localPlayer.id) return;
          spawnRemotePlayer(data.player);
          addChatLog("System", `${data.player.username} entered Metalyceum!`, "system-msg");
          if (state.localPlayer.currentRoom !== -1) refreshRoomPlayersList();
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
            if (state.localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          }
          break;

        case "chat":
          displayChatBubble(data.id, data.message);
          addChatLog(data.username, data.message);
          break;

        case "editor_auth": {
          state.editor.authed = Boolean(data.ok);
          const authPanel = document.getElementById('editor-auth-panel');
          const authStatus = document.getElementById('editor-auth-status');
          if (authStatus) {
            authStatus.textContent = state.editor.authed ? 'Editor unlocked.' : 'Invalid editor token.';
          }
          if (state.editor.authed) {
            if (authPanel) authPanel.classList.remove('active');
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
          if (typeof data.message === 'string') {
            addChatLog('System', data.message, 'system-msg');
            if (state.editor.enabled) updateEditorStatus(data.message);
          } else if (typeof data.reason === 'string') {
            addChatLog('System', data.reason, 'system-msg');
            if (state.editor.enabled) updateEditorStatus(data.reason);
          }
          break;

        case "room_update": {
          const rIdx = Number.isInteger(data.room?.roomId) ? data.room.roomId : data.roomId;
          applyRoomData(rIdx, data.room || data);
          renderEventBoard();
          scheduleRoomVisualRefresh();
          if (state.localPlayer.currentRoom === rIdx) {
            updateRoomPanelDetails();
            setupRoomVideo(rIdx);
          }
          break;
        }

        case "video_change": {
          const rIdx = data.room;
          applyRoomData(rIdx, { sourceValue: data.videoId });
          renderEventBoard();
          scheduleRoomVisualRefresh();
          if (state.localPlayer.currentRoom === rIdx) {
            updateRoomPanelDetails();
            setupRoomVideo(rIdx);
          }
          break;
        }

        case "leave":
          removeRemotePlayer(data.id);
          if (state.localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          break;
      }
    } catch (err) {
      console.error("Error handling websocket payload", err);
    }
  });
}

export function clearRemotePlayers() {
  for (const id of Array.from(state.remotePlayers.keys())) {
    removeRemotePlayer(id);
  }
}

export function scheduleReconnect() {
  if (reconnectTimer !== null) return;
  reconnectAttempts++;
  const base = Math.min(MAX_RECONNECT_DELAY, 1000 * Math.pow(2, reconnectAttempts - 1));
  const delay = Math.round(base / 2 + Math.random() * (base / 2));
  addChatLog("System", `Disconnected from server. Reconnecting in ${Math.round(delay / 1000)}s...`, "system-msg");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectMultiplayer();
  }, delay);
}

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

  state.socket.send(JSON.stringify({
    type: "move",
    x: parseFloat(state.localPlayer.x.toFixed(2)),
    y: parseFloat(state.localPlayer.y.toFixed(2)),
    z: parseFloat(state.localPlayer.z.toFixed(2)),
    ry: parseFloat(state.localPlayer.ry.toFixed(3)),
    isMoving: state.localPlayer.isMoving
  }));

  state.lastSentPosition = {
    x: state.localPlayer.x,
    y: state.localPlayer.y,
    z: state.localPlayer.z,
    ry: state.localPlayer.ry,
    isMoving: state.localPlayer.isMoving
  };
}
