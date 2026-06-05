// Debug panel, diagnostics collection, performance (FPS), and clipboard tools for Metalyceum
import * as THREE from 'three';
import { state } from '../state.js';
import { getRoomEventStatus } from '../utils.js';
import { getTerrainHeight, getRoomBounds } from '../physics.js';

// Reusable scratch vector — avoids new THREE.Vector3() allocation every frame in debug panel
const _camDir = new THREE.Vector3();
import { LANDMARK_REGISTRY, RIVER_PTS } from '../config.js';
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

// Shared scratch vector for world-position queries in the copy function
const _cpWp = new THREE.Vector3();

// Returns the 8-sector bearing of (ox,oz) relative to (px,pz) given a camera forward direction.
// fwdX/fwdZ must be the XZ-projected, normalized camera forward vector.
function _relBearing(px, pz, ox, oz, fwdX, fwdZ) {
  const dx = ox - px, dz = oz - pz;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.3) return 'here';
  const nx = dx / len, nz = dz / len;
  // fwdDot: positive = ahead. rightDot: positive = to the right of forward.
  const fwdDot  = nx * fwdX + nz * fwdZ;
  const rightDot = nx * fwdZ - nz * fwdX;
  const deg = ((Math.atan2(rightDot, fwdDot) * 180 / Math.PI) + 360) % 360;
  if (deg < 22.5 || deg >= 337.5) return 'ahead';
  if (deg < 67.5)  return 'ahead-right';
  if (deg < 112.5) return 'right';
  if (deg < 157.5) return 'behind-right';
  if (deg < 202.5) return 'behind';
  if (deg < 247.5) return 'behind-left';
  if (deg < 292.5) return 'left';
  return 'ahead-left';
}

function _riverDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const [ax, az] = RIVER_PTS[i], [bx, bz] = RIVER_PTS[i + 1];
    const dax = bx - ax, daz = bz - az;
    const l2 = dax * dax + daz * daz;
    const t = l2 < 0.001 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dax + (z - az) * daz) / l2));
    const ex = ax + dax * t - x, ez = az + daz * t - z;
    const d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
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

  // ── Camera forward direction on XZ (normalized) — used for relative bearings ──
  let nFwdX = 0, nFwdZ = 1;
  if (state.camera) {
    state.camera.getWorldDirection(_cpWp);
    const fLen = Math.sqrt(_cpWp.x * _cpWp.x + _cpWp.z * _cpWp.z);
    if (fLen > 0.001) { nFwdX = _cpWp.x / fLen; nFwdZ = _cpWp.z / fLen; }
  }

  // ── Terrain ───────────────────────────────────────────────────────────────
  const terrainY = getTerrainHeight(px, pz);
  const sampleH = [[20,0],[-20,0],[0,20],[0,-20]].map(([dx,dz]) => getTerrainHeight(px+dx, pz+dz));
  const slopeRange = (Math.max(...sampleH) - Math.min(...sampleH)).toFixed(2);

  // ── River ─────────────────────────────────────────────────────────────────
  const rivDist = _riverDist(px, pz);
  const rivLabel = rivDist < 5   ? `${rivDist.toFixed(1)}u  !! INSIDE RIVER CHANNEL`
                 : rivDist < 15  ? `${rivDist.toFixed(1)}u  (near river)`
                 : `${rivDist.toFixed(1)}u`;

  // ── Nearest landmark (header context) ────────────────────────────────────
  let nearestLM = null, nearestLMDist = Infinity;
  for (const [key, def] of Object.entries(LANDMARK_REGISTRY)) {
    const grp = state.landmarkGroups?.get(key);
    const lx = def.approxCenter[0] + (grp ? grp.position.x : 0);
    const lz = def.approxCenter[1] + (grp ? grp.position.z : 0);
    const d = Math.sqrt((px - lx) ** 2 + (pz - lz) ** 2);
    if (d < nearestLMDist) { nearestLMDist = d; nearestLM = { key, def, lx, lz }; }
  }
  const lmInsideFlag = nearestLM && nearestLMDist < nearestLM.def.approxRadius ? ' [INSIDE]' : '';
  const lmLine = nearestLM ? `${nearestLM.def.label}  ${nearestLMDist.toFixed(1)}u${lmInsideFlag}` : '—';

  // ── Current room bounds ───────────────────────────────────────────────────
  let roomBoundsLine = '';
  if (currentRoom) {
    const b = getRoomBounds(currentRoom);
    roomBoundsLine = `\n           Bounds: X [${b.minX.toFixed(1)}, ${b.maxX.toFixed(1)}]  Z [${b.minZ.toFixed(1)}, ${b.maxZ.toFixed(1)}]`;
  }

  // ── Nearby objects — semantic scan, sorted by distance ───────────────────
  // Radius: 50u for scene objects (you're close to these); 120u for landmarks (large, visible far)
  const NEARBY_R = 50;
  const LANDMARK_R = 120;
  const objects = [];

  // 1. Placed dynamic assets
  for (const { asset } of (state.placedAssets?.values() ?? [])) {
    const d = Math.sqrt((asset.x - px) ** 2 + (asset.z - pz) ** 2);
    if (d > NEARBY_R) continue;
    const bearing = _relBearing(px, pz, asset.x, asset.z, nFwdX, nFwdZ);
    const yAbove = (asset.y - getTerrainHeight(asset.x, asset.z)).toFixed(2);
    objects.push({ d, line: `Placed asset: ${asset.type}  id:${asset.id.slice(0, 8)}  pos:(${asset.x.toFixed(1)}, ${asset.y.toFixed(1)}, ${asset.z.toFixed(1)})  y+${yAbove}  [${bearing}]` });
  }

  // 2. Static scenery groups — registered named scene entities
  for (const entry of (state.STATIC_SCENERY ?? [])) {
    if (!entry.object3d) continue;
    entry.object3d.getWorldPosition(_cpWp);
    const d = Math.sqrt((_cpWp.x - px) ** 2 + (_cpWp.z - pz) ** 2);
    if (d > NEARBY_R) continue;
    // Identify landmark parent by walking the group chain
    let lmHint = '';
    for (const [key, grp] of (state.landmarkGroups?.entries() ?? [])) {
      let cur = entry.object3d.parent;
      while (cur && cur !== state.scene) {
        if (cur === grp) { lmHint = `  [${key}]`; break; }
        cur = cur.parent;
      }
      if (lmHint) break;
    }
    const visible = entry.object3d.visible ? '' : '  [hidden]';
    const bearing = _relBearing(px, pz, _cpWp.x, _cpWp.z, nFwdX, nFwdZ);
    objects.push({ d, line: `Static (${entry.kind})${lmHint}${visible}  pos:(${_cpWp.x.toFixed(1)}, ${_cpWp.y.toFixed(1)}, ${_cpWp.z.toFixed(1)})  [${bearing}]` });
  }

  // 3. Landmark groups
  for (const [key, grp] of (state.landmarkGroups?.entries() ?? [])) {
    const def = LANDMARK_REGISTRY[key];
    if (!def) continue;
    const lx = def.approxCenter[0] + grp.position.x;
    const lz = def.approxCenter[1] + grp.position.z;
    const d = Math.sqrt((lx - px) ** 2 + (lz - pz) ** 2);
    if (d > LANDMARK_R) continue;
    const inside = d < def.approxRadius ? '  [INSIDE]' : '';
    const bearing = _relBearing(px, pz, lx, lz, nFwdX, nFwdZ);
    objects.push({ d, line: `Landmark: ${def.label}${inside}  center:(${lx.toFixed(0)}, ${lz.toFixed(0)})  r=${def.approxRadius}  [${bearing}]` });
  }

  // 4. Rooms (excluding current)
  for (const room of (state.ROOMS ?? [])) {
    if (room.id === currentRoomId) continue;
    const d = Math.sqrt((room.x - px) ** 2 + (room.z - pz) ** 2);
    if (d > NEARBY_R) continue;
    const bearing = _relBearing(px, pz, room.x, room.z, nFwdX, nFwdZ);
    objects.push({ d, line: `Room: ${room.name} (id:${room.id})  @ (${room.x}, ${room.z})  [${bearing}]` });
  }

  objects.sort((a, b) => a.d - b.d);
  const objectList = objects.length
    ? objects.map(o => `  ${String(o.d.toFixed(0)).padStart(3)}u  ${o.line}`).join('\n')
    : '  (none within 50u)';

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
    inspectedBlock = `\nLast alt+click:\n` +
      `  ${ins.geometry}  pos:(${ins.worldPos.x}, ${ins.worldPos.y}, ${ins.worldPos.z})` +
      `  rot:Y=${ins.worldRotDeg.y}°  scale:(${ins.worldScale.x}, ${ins.worldScale.y}, ${ins.worldScale.z})` +
      `  y+${ins.yAboveTerrain}u above terrain  parent:${ins.parentChain}` +
      (Object.keys(ins.userData ?? {}).length ? `\n  userData: ${JSON.stringify(ins.userData)}` : '');
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

  const text = `Metalyceum Scene Report
==============================
Timestamp: ${new Date().toISOString()}
Player:    ${pPos}  Heading: ${headingDeg}°
           Room: ${roomLabel} (id:${currentRoomId})  State: ${underRoof}${roomBoundsLine}
Camera:    ${cPos}
Direction: ${cDir}

Location:
  Terrain:  y=${terrainY.toFixed(3)}  slope ±${slopeRange}u over 20u
  River:    ${rivLabel}
  Landmark: ${lmLine}

Performance: ${fps} fps | ${players} players | ${props} visible props
Network: ${webSocket}  (profile: ${state._netProfile || 'normal'})
Memory:  ${mem}
Counts:  colliders:${colliderCount}  walls:${wallCount}  upperWalls:${upperWallCount}  roofMeshes:${roofCount}  sceneRoot:${sceneCount}  landmarks:${lmGroupCount}

Objects within 50u  (closest first — [bearing] is relative to camera forward):
${objectList}
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
      state.camera.getWorldDirection(_camDir);
      state.debugCameraDirEl.textContent = `X: ${_camDir.x.toFixed(2)} | Y: ${_camDir.y.toFixed(2)} | Z: ${_camDir.z.toFixed(2)}`;
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
