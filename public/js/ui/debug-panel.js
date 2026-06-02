// Debug panel, diagnostics collection, performance (FPS), and clipboard tools for Metalyceum
import * as THREE from 'three';
import { state } from '../state.js';
import { getRoomEventStatus } from '../utils.js';
import { getTerrainHeight, getRoomBounds } from '../physics.js';
import { LANDMARK_REGISTRY } from '../config.js';
import { devState } from '../dev-tools.js';

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

// River waypoints — kept in sync with physics.js / dev-tools.js
const _riverPts = [
  [200, -200], [160, -150], [120, -100], [80, -55],
  [70, -10], [78, 35], [65, 80], [35, 120],
  [-10, 155], [-70, 190], [-130, 220]
];
function _ptSegDist(px, pz, ax, az, bx, bz) {
  const dax = bx - ax, daz = bz - az;
  const l2 = dax * dax + daz * daz;
  if (l2 < 0.001) return Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dax + (pz - az) * daz) / l2));
  return Math.sqrt((px - ax - t * dax) ** 2 + (pz - az - t * daz) ** 2);
}
function _riverDist(x, z) {
  let d = Infinity;
  for (let i = 0; i < _riverPts.length - 1; i++) {
    const s = _ptSegDist(x, z, _riverPts[i][0], _riverPts[i][1], _riverPts[i + 1][0], _riverPts[i + 1][1]);
    if (s < d) d = s;
  }
  return d;
}

function copyDiagnosticsToClipboard() {
  const pPos = state.debugPlayerPosEl?.textContent || '—';
  const cPos = state.debugCameraPosEl?.textContent || '—';
  const cDir = state.debugCameraDirEl?.textContent || '—';
  const fps = state.debugFpsValEl?.textContent || '—';
  const players = state.debugPlayersValEl?.textContent || '—';
  const props = state.debugPropsValEl?.textContent || '—';
  const rooms = state.debugRoomsValEl?.textContent || '—';

  const px = state.localPlayer?.x ?? 0;
  const pz = state.localPlayer?.z ?? 0;
  const pry = state.localPlayer?.ry ?? 0;
  const headingDeg = Math.round(((pry * 180 / Math.PI) % 360 + 360) % 360);

  const currentRoomId = state.localPlayer?.currentRoom ?? -1;
  const currentRoom = currentRoomId >= 0 ? state.ROOMS.find(r => r.id === currentRoomId) : null;
  const roomLabel = currentRoom?.name || 'Outdoors';
  const underRoof = state.cameraRig?.wasUnderRoof ? 'Inside' : 'Outside';

  const mem = performance.memory
    ? `JS: ${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB`
    : 'N/A';
  const webSocket = state.socket?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected';

  // ── Terrain ───────────────────────────────────────────────────────────────
  const terrainY = getTerrainHeight(px, pz);
  const sampleH = [[20,0],[-20,0],[0,20],[0,-20]].map(([dx,dz]) => getTerrainHeight(px+dx, pz+dz));
  const slopeRange = (Math.max(...sampleH) - Math.min(...sampleH)).toFixed(2);

  // ── River ─────────────────────────────────────────────────────────────────
  const rivDist = _riverDist(px, pz);
  const rivLabel = rivDist < 5   ? `${rivDist.toFixed(1)}u  !! INSIDE RIVER CHANNEL`
                 : rivDist < 15  ? `${rivDist.toFixed(1)}u  (near river)`
                 : `${rivDist.toFixed(1)}u`;

  // ── Nearest landmark ──────────────────────────────────────────────────────
  let nearestLM = null, nearestLMDist = Infinity;
  for (const [key, def] of Object.entries(LANDMARK_REGISTRY)) {
    const grp = state.landmarkGroups?.get(key);
    const lx = def.approxCenter[0] + (grp ? grp.position.x : 0);
    const lz = def.approxCenter[1] + (grp ? grp.position.z : 0);
    const d = Math.sqrt((px - lx) ** 2 + (pz - lz) ** 2);
    if (d < nearestLMDist) { nearestLMDist = d; nearestLM = { key, def, d }; }
  }
  const lmInsideFlag = nearestLM && nearestLMDist < nearestLM.def.approxRadius ? ' [INSIDE]' : '';
  const lmLine = nearestLM ? `${nearestLM.def.label}  ${nearestLMDist.toFixed(1)}u${lmInsideFlag}` : '—';

  // ── Current room bounds ───────────────────────────────────────────────────
  let roomBoundsLine = '';
  if (currentRoom) {
    const b = getRoomBounds(currentRoom);
    roomBoundsLine = `\n           Bounds: X [${b.minX.toFixed(1)}, ${b.maxX.toFixed(1)}]  Z [${b.minZ.toFixed(1)}, ${b.maxZ.toFixed(1)}]`;
  }

  // ── Nearby: landmark groups, placed assets, rooms ─────────────────────────
  const nearby = [];

  if (state.landmarkGroups) {
    for (const [key, grp] of state.landmarkGroups.entries()) {
      const def = LANDMARK_REGISTRY[key];
      if (!def) continue;
      const lx = def.approxCenter[0] + grp.position.x;
      const lz = def.approxCenter[1] + grp.position.z;
      const d = Math.sqrt((px - lx) ** 2 + (pz - lz) ** 2);
      if (d < 120) {
        const inside = d < def.approxRadius ? ' [INSIDE]' : '';
        nearby.push({ label: `Landmark: ${def.label} @ (${lx.toFixed(0)}, ${lz.toFixed(0)})  ${d.toFixed(0)}u${inside}`, d });
      }
    }
  }

  if (state.placedAssets) {
    for (const { asset } of state.placedAssets.values()) {
      const dx = asset.x - px, dz = asset.z - pz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 120) {
        nearby.push({ label: `Asset: ${asset.type}  @ (${asset.x.toFixed(1)}, ${asset.z.toFixed(1)})  ${d.toFixed(0)}u  [id:${asset.id.slice(0, 8)}]`, d });
      }
    }
  }

  for (const room of state.ROOMS) {
    if (room.id === currentRoomId) continue;
    const dx = room.x - px, dz = room.z - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 120) {
      nearby.push({ label: `Room: ${room.name} (id:${room.id})  @ (${room.x}, ${room.z})  ${d.toFixed(0)}u`, d });
    }
  }

  // Scan scene for meshes (river segments, bridge parts, etc. not in landmarks)
  const _wp = new THREE.Vector3();
  if (state.scene) {
    state.scene.traverse((child) => {
      if (nearby.length >= 30) return;
      if (child.type !== 'Mesh' || !child.geometry) return;
      child.getWorldPosition(_wp);
      const ox = _wp.x, oz = _wp.z;
      const d = Math.sqrt((px - ox) ** 2 + (pz - oz) ** 2);
      if (d > 120) return;
      const g = child.geometry;
      const p = g.parameters || {};
      let dim = g.type;
      if (p.width) dim = `${(p.width||0).toFixed(1)}x${(p.height||0).toFixed(1)}`;
      else if (p.radiusTop) dim = `r${(p.radiusTop||0).toFixed(2)} h${(p.height||0).toFixed(2)}`;
      const label = `${dim} @ (${ox.toFixed(1)},${oz.toFixed(1)}) y=${_wp.y.toFixed(1)} ${d.toFixed(0)}u`;
      nearby.push({ label, d });
    });
  }

  nearby.sort((a, b) => a.d - b.d);
  const nearbyList = nearby.slice(0, 30).map(n => n.label).join('\n  ') || '(none within 120u)';

  // ── Landmark offsets (non-zero) ───────────────────────────────────────────
  const lmOffsets = [];
  if (state.landmarkGroups) {
    for (const [key, grp] of state.landmarkGroups.entries()) {
      const { x, y, z } = grp.position, ry = grp.rotation.y;
      if (Math.abs(x) > 0.001 || Math.abs(y) > 0.001 || Math.abs(z) > 0.001 || Math.abs(ry) > 0.001) {
        lmOffsets.push(`  ${key}: {x:${x.toFixed(3)}, y:${y.toFixed(3)}, z:${z.toFixed(3)}, rotY:${ry.toFixed(5)}}`);
      }
    }
  }
  const lmOffsetBlock = lmOffsets.length
    ? `\nLandmark offsets (non-zero):\n${lmOffsets.join('\n')}`
    : '';

  // ── Placed-asset audit issues ─────────────────────────────────────────────
  let auditBlock = '';
  const issues = (typeof window !== 'undefined' && window.metalyceumDev?.getAuditIssues?.()) || [];
  if (issues.length > 0) {
    const bySev = { critical: 0, high: 0, medium: 0 };
    issues.forEach(i => { if (bySev[i.severity] !== undefined) bySev[i.severity]++; });
    const summary = Object.entries(bySev).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ');
    const list = issues.slice(0, 12).map(i => `  [${i.severity.toUpperCase()}] ${i.message}`).join('\n');
    const more = issues.length > 12 ? `\n  ... and ${issues.length - 12} more` : '';
    auditBlock = `\nPlacement audit: ${issues.length} issues (${summary})\n${list}${more}`;
  }

  // ── Static scenery audit issues ───────────────────────────────────────────
  let staticAuditBlock = '';
  const sIssues = devState.staticAuditIssues;
  if (sIssues.length > 0) {
    const bySev = { high: 0, medium: 0 };
    sIssues.forEach(i => { if (bySev[i.severity] !== undefined) bySev[i.severity]++; });
    const summary = Object.entries(bySev).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ');
    const list = sIssues.slice(0, 10).map(i => `  [${i.severity.toUpperCase()}] ${i.message}`).join('\n');
    const more = sIssues.length > 10 ? `\n  ... and ${sIssues.length - 10} more` : '';
    staticAuditBlock = `\nStatic scenery audit: ${sIssues.length} issues (${summary})\n${list}${more}`;
  }

  // ── Last alt+click inspected object ──────────────────────────────────────
  let inspectedBlock = '';
  const ins = devState.lastInspected;
  if (ins) {
    inspectedBlock = `\nLast inspected (Alt+click):\n` +
      `  Geometry:      ${ins.geometry}\n` +
      `  World pos:     (${ins.worldPos.x}, ${ins.worldPos.y}, ${ins.worldPos.z})\n` +
      `  World rot deg: X=${ins.worldRotDeg.x}°  Y=${ins.worldRotDeg.y}°  Z=${ins.worldRotDeg.z}°\n` +
      `  World scale:   (${ins.worldScale.x}, ${ins.worldScale.y}, ${ins.worldScale.z})\n` +
      `  Terrain Y:     ${ins.terrainY}  |  Y above terrain: ${ins.yAboveTerrain}u\n` +
      `  Parent chain:  ${ins.parentChain}` +
      (Object.keys(ins.userData ?? {}).length ? `\n  userData:      ${JSON.stringify(ins.userData)}` : '');
  }

  // ── Error log ─────────────────────────────────────────────────────────────
  const recentErrors = (state.errorLog ?? []).slice(-5);
  const errorBlock = recentErrors.length
    ? `\nErrors (last ${recentErrors.length}):\n` + recentErrors.map(e =>
        `  [${new Date(e.ts).toLocaleTimeString()}] ${e.type}: ${e.msg.slice(0, 120)}`
      ).join('\n')
    : '';

  // ── Counts ────────────────────────────────────────────────────────────────
  const colliderCount = state.PLACED_ASSET_COLLIDERS?.length ?? 0;
  const wallCount = state.WALLS?.length ?? 0;
  const upperWallCount = state.upperWalls?.length ?? 0;
  const roofCount = state.roofMeshes?.length ?? 0;
  const sceneCount = state.scene ? state.scene.children.length : '?';
  const lmGroupCount = state.landmarkGroups?.size ?? 0;

  const text = `Metalyceum Diagnostics Report
==============================
Timestamp: ${new Date().toISOString()}
Player:    ${pPos}  Heading: ${headingDeg}°
           Room: ${roomLabel} (id:${currentRoomId})  State: ${underRoof}${roomBoundsLine}
Camera:    ${cPos}
Direction: ${cDir}

Position context:
- Terrain:   y=${terrainY.toFixed(3)}  (slope ±${slopeRange}u over 20u)
- River:     ${rivLabel}
- Nearest landmark: ${lmLine}

Network:   ${webSocket}  (Profile: ${state._netProfile || 'normal'})
Memory:    ${mem}
Performance:
- FPS: ${fps}
- Players Online: ${players}
- Visible Props: ${props} / ${state.STATIC_SCENERY?.length ?? '?'}
- Live Rooms: ${rooms}
- Upper Walls: ${upperWallCount}, Roof Meshes: ${roofCount}
- Colliders: ${colliderCount}, WALLS: ${wallCount}
- Scene root objects: ${sceneCount}, Landmark groups: ${lmGroupCount}

Nearby (<120u):
  ${nearbyList}
${lmOffsetBlock}${auditBlock}${staticAuditBlock}${inspectedBlock}${errorBlock}
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
