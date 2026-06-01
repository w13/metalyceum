// Debug panel, diagnostics collection, performance (FPS), and clipboard tools for Metalyceum
import * as THREE from 'three';
import { state } from '../state.js';
import { getRoomEventStatus } from '../utils.js';

export function initDebugPanel() {
  state.debugPanel = document.getElementById('debug-panel');
  state.debugPlayerPosEl = document.getElementById('debug-player-pos');
  state.debugCameraPosEl = document.getElementById('debug-camera-pos');
  state.debugCameraDirEl = document.getElementById('debug-camera-dir');
  state.debugFpsValEl = document.getElementById('debug-fps-val');
  state.debugPlayersValEl = document.getElementById('debug-players-val');
  state.debugPropsValEl = document.getElementById('debug-props-val');
  state.debugRoomsValEl = document.getElementById('debug-rooms-val');
  state.debugErrorEl = document.getElementById('debug-errors');

  // Wire up Copy button
  const copyBtn = document.getElementById('copy-debug-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      copyDiagnosticsToClipboard();
    });
  }
}

function copyDiagnosticsToClipboard() {
  const pPos = state.debugPlayerPosEl?.textContent || '—';
  const cPos = state.debugCameraPosEl?.textContent || '—';
  const cDir = state.debugCameraDirEl?.textContent || '—';
  const fps = state.debugFpsValEl?.textContent || '—';
  const players = state.debugPlayersValEl?.textContent || '—';
  const props = state.debugPropsValEl?.textContent || '—';
  const rooms = state.debugRoomsValEl?.textContent || '—';
  
  const text = `Metalyceum Diagnostics Report
==============================
Timestamp: ${new Date().toISOString()}
- ${pPos}
- ${cPos}
- ${cDir}
Performance Metrics:
- FPS: ${fps}
- Players Online: ${players}
- Visible Props: ${props}
- Live Rooms: ${rooms}
==============================`;

  navigator.clipboard.writeText(text).then(() => {
    const copyBtn = document.getElementById('copy-debug-btn');
    if (copyBtn) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      copyBtn.style.background = 'hsl(var(--success))';
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '';
      }, 1500);
    }
  }).catch(err => {
    console.error('Failed to copy diagnostics: ', err);
  });
}

export function updateDebugPanel(now) {
  if (!state.DEBUG_STATE.enabled || !state.debugPanel) return;

  state.DEBUG_STATE.framesSinceSample += 1;
  if (!state.DEBUG_STATE.lastFpsSampleAt) {
    state.DEBUG_STATE.lastFpsSampleAt = now;
  }
  if (now - state.DEBUG_STATE.lastFpsSampleAt >= 500) {
    state.DEBUG_STATE.fps = Math.round(
      (state.DEBUG_STATE.framesSinceSample * 1000) / (now - state.DEBUG_STATE.lastFpsSampleAt)
    );
    state.DEBUG_STATE.framesSinceSample = 0;
    state.DEBUG_STATE.lastFpsSampleAt = now;
    // Recompute stats only when the display actually refreshes (every 500ms)
    state.DEBUG_STATE.visibleScenery = state.STATIC_SCENERY.reduce(
      (count, entry) => count + (entry.object3d.visible ? 1 : 0), 0
    );
    state.DEBUG_STATE.liveRooms = state.ROOMS.filter((room) => getRoomEventStatus(room).tone === 'live').length;
  }

  // Update Player Position
  if (state.debugPlayerPosEl) {
    state.debugPlayerPosEl.textContent = `X: ${state.localPlayer.x.toFixed(2)} | Y: ${state.localPlayer.y.toFixed(2)} | Z: ${state.localPlayer.z.toFixed(2)}`;
  }

  // Update Camera Position & Direction
  if (state.camera) {
    if (state.debugCameraPosEl) {
      state.debugCameraPosEl.textContent = `X: ${state.camera.position.x.toFixed(2)} | Y: ${state.camera.position.y.toFixed(2)} | Z: ${state.camera.position.z.toFixed(2)}`;
    }
    if (state.debugCameraDirEl && typeof THREE !== 'undefined') {
      const camDir = new THREE.Vector3();
      state.camera.getWorldDirection(camDir);
      state.debugCameraDirEl.textContent = `X: ${camDir.x.toFixed(2)} | Y: ${camDir.y.toFixed(2)} | Z: ${camDir.z.toFixed(2)}`;
    }
  }

  // Update Grid metrics
  if (state.debugFpsValEl) state.debugFpsValEl.textContent = state.DEBUG_STATE.fps || '—';
  if (state.debugPlayersValEl) state.debugPlayersValEl.textContent = String(state.remotePlayers.size + (state.isJoined ? 1 : 0));
  if (state.debugPropsValEl) {
    const vs = state.DEBUG_STATE.visibleScenery ?? 0;
    state.debugPropsValEl.textContent = `${vs} / ${state.STATIC_SCENERY.length}`;
  }
  if (state.debugRoomsValEl) state.debugRoomsValEl.textContent = String(state.DEBUG_STATE.liveRooms ?? 0);

  // Show recent errors in the debug panel
  const errEl = state.debugErrorEl;
  if (errEl) {
    const recent = state.errorLog.slice(-5);
    errEl.innerHTML = recent.map(e =>
      `<div style="font-size:10px;color:${e.type === 'console' ? '#fbbf24' : '#f87171'};padding:1px 0;">[${new Date(e.ts).toLocaleTimeString()}] ${e.type}: ${e.msg.slice(0, 120)}</div>`
    ).join('');
  }
}
