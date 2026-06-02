// AI & Developer Helpers / Tools for Metalyceum
import * as THREE from 'three';
import { state } from './state.js';
import { MAP_SIZE, WORLD_ASSET_CATALOG, LANDMARK_REGISTRY, COVERED_BOUNDS } from './config.js';
import { getTerrainHeight, getRoomBounds, getRoomIdForPosition } from './physics.js';
import { teleportPlayer } from './physics-engine.js';

// Local developer tools state
export const devState = {
  showMap: false,
  showAssetBoxes: false,
  showWallBoxes: false,
  showRiverPath: false,
  showFlatZones: false,
  showLandmarkBoxes: false,

  // 2D Map Pan/Zoom state
  zoom: 1.0,
  panX: 0,
  panY: 0,

  // Canvas drag state
  isDragging: false,
  startX: 0,
  startY: 0,

  // Tooltip details
  hoveredAsset: null,
  hoveredRoom: null,
  hoveredCoords: { x: 0, z: 0 },

  // 3D Helpers
  helpersGroup: null,
  helpersDirty: false,
  lastAssetCount: 0,

  // Auditor results
  auditIssues: [],
  staticAuditIssues: [],    // from auditStaticScenery()
  lastInspected: null,      // from alt+click inspector
  showStaticAuditMarkers: false,
};
// River coordinates (matching physics.js)
import { RIVER_PTS } from '../config.js';
import { pointToSegmentDistSq } from '../math.js';

// Helper: Point-to-segment distance
// Get distance to closest point on the river (uses shared math)
function getRiverDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const d = pointToSegmentDistSq(x, z, RIVER_PTS[i][0], RIVER_PTS[i][1], RIVER_PTS[i + 1][0], RIVER_PTS[i + 1][1]);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// Teleport developer helper
export function devTeleport(x, z) {
  const y = getTerrainHeight(x, z);

  const dx = x - state.localPlayer.x;
  const dz = z - state.localPlayer.z;

  state.localPlayer.x = x;
  state.localPlayer.y = y;
  state.localPlayer.z = z;

  if (state.localPlayer.mesh) {
    state.localPlayer.mesh.position.set(x, y, z);
  }

  teleportPlayer(x, z);

  if (state.camera) {
    state.camera.position.x += dx;
    state.camera.position.z += dz;
  }

  if (state.controls) {
    state.controls.target.set(x, y + 1.45, z);
  }

  console.log(`[Dev Teleport] Warped player to: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
}

// --- World Auditor ---
export function runWorldAudit() {
  devState.auditIssues = [];
  const assets = Array.from(state.placedAssets.values());

  // 1. Check Asset vs Asset clipping & Z-fighting
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i].asset;
    const catA = WORLD_ASSET_CATALOG[a.type] || { footprint: 1.0, label: a.type };
    const rA = (catA.footprint * a.scale) / 2;

    for (let j = i + 1; j < assets.length; j++) {
      const b = assets[j].asset;
      const catB = WORLD_ASSET_CATALOG[b.type] || { footprint: 1.0, label: b.type };
      const rB = (catB.footprint * b.scale) / 2;

      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = rA + rB;

      if (dist < minDist) {
        devState.auditIssues.push({
          type: 'clipping',
          severity: 'high',
          assetIdA: a.id,
          assetTypeA: a.type,
          assetIdB: b.id,
          assetTypeB: b.type,
          x: (a.x + b.x) / 2,
          z: (a.z + b.z) / 2,
          message: `Clipping: "${catA.label}" and "${catB.label}" overlap (dist ${dist.toFixed(2)}u < ${minDist.toFixed(2)}u)`
        });
      }

      // Z-fighting check (extremely close position)
      const dy = a.y - b.y;
      const dist3d = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist3d < 0.08) {
        devState.auditIssues.push({
          type: 'z-fighting',
          severity: 'high',
          assetIdA: a.id,
          assetTypeA: a.type,
          assetIdB: b.id,
          assetTypeB: b.type,
          x: a.x,
          z: a.z,
          message: `Z-Fighting: "${catA.label}" and "${catB.label}" overlap exactly (dist ${dist3d.toFixed(3)}u)`
        });
      }
    }

    // 2. Check River Encroachment
    const rivDist = getRiverDist(a.x, a.z);
    if (rivDist < 5.0) {
      devState.auditIssues.push({
        type: 'river',
        severity: 'critical',
        assetIdA: a.id,
        assetTypeA: a.type,
        x: a.x,
        z: a.z,
        message: `River Encroachment: "${catA.label}" sits in river channel (dist ${rivDist.toFixed(2)}u < 5u)`
      });
    }

    // 3. Check Wall Collisions
    const minAx = a.x - rA, maxAx = a.x + rA;
    const minAz = a.z - rA, maxAz = a.z + rA;
    for (const wall of state.WALLS) {
      const overlapX = minAx < wall.max.x && maxAx > wall.min.x;
      const overlapZ = minAz < wall.max.z && maxAz > wall.min.z;
      if (overlapX && overlapZ) {
        devState.auditIssues.push({
          type: 'wall-collision',
          severity: 'high',
          assetIdA: a.id,
          assetTypeA: a.type,
          x: a.x,
          z: a.z,
          message: `Wall Clip: "${catA.label}" overlaps building wall collider`
        });
      }
    }

    // 4. Check Terrain alignment (floating / buried)
    if (a.roomId === -1) {
      const terrainH = getTerrainHeight(a.x, a.z);
      const diff = a.y - terrainH;
      if (diff > 0.15) {
        devState.auditIssues.push({
          type: 'floating',
          severity: 'medium',
          assetIdA: a.id,
          assetTypeA: a.type,
          x: a.x,
          z: a.z,
          message: `Floating: "${catA.label}" sits +${diff.toFixed(2)}u above terrain`
        });
      } else if (diff < -0.15) {
        devState.auditIssues.push({
          type: 'buried',
          severity: 'medium',
          assetIdA: a.id,
          assetTypeA: a.type,
          x: a.x,
          z: a.z,
          message: `Buried: "${catA.label}" sits ${diff.toFixed(2)}u under terrain`
        });
      }
    }

    // 5. Check placed asset vs landmark overlap
    for (const [lmKey, lmDef] of Object.entries(LANDMARK_REGISTRY)) {
      const lmGroup = state.landmarkGroups.get(lmKey);
      const [lcx, lcz] = lmDef.approxCenter;
      const groupOffX = lmGroup ? lmGroup.position.x : 0;
      const groupOffZ = lmGroup ? lmGroup.position.z : 0;
      const lx = lcx + groupOffX, lz = lcz + groupOffZ;
      const dist = Math.sqrt((a.x - lx) ** 2 + (a.z - lz) ** 2);
      if (dist < lmDef.approxRadius + rA) {
        devState.auditIssues.push({
          type: 'landmark-overlap',
          severity: 'medium',
          assetIdA: a.id,
          assetTypeA: a.type,
          landmarkKey: lmKey,
          x: a.x,
          z: a.z,
          message: `Landmark Overlap: "${catA.label}" is inside ${lmDef.label} footprint`
        });
      }
    }
  }

  // 6. Check Room & River overlaps
  state.ROOMS.forEach(room => {
    const bounds = getRoomBounds(room);
    const corners = [
      [bounds.minX, bounds.minZ],
      [bounds.maxX, bounds.minZ],
      [bounds.minX, bounds.maxZ],
      [bounds.maxX, bounds.maxZ],
      [room.x, room.z]
    ];
    for (const [cx, cz] of corners) {
      const d = getRiverDist(cx, cz);
      if (d < 5.0) {
        devState.auditIssues.push({
          type: 'river-room',
          severity: 'critical',
          roomId: room.id,
          x: cx,
          z: cz,
          message: `Critical Encroachment: Room "${room.name}" overlaps river at (${cx.toFixed(1)}, ${cz.toFixed(1)})`
        });
        break;
      }
    }
  });

  // 7. Landmark vs river
  for (const [lmKey, lmDef] of Object.entries(LANDMARK_REGISTRY)) {
    const lmGroup = state.landmarkGroups.get(lmKey);
    const [lcx, lcz] = lmDef.approxCenter;
    const groupOffX = lmGroup ? lmGroup.position.x : 0;
    const groupOffZ = lmGroup ? lmGroup.position.z : 0;
    const lx = lcx + groupOffX, lz = lcz + groupOffZ;
    const d = getRiverDist(lx, lz);
    if (d < lmDef.approxRadius + 5) {
      devState.auditIssues.push({
        type: 'landmark-river',
        severity: 'critical',
        landmarkKey: lmKey,
        x: lx,
        z: lz,
        message: `Landmark River: ${lmDef.label} center is within ${(d).toFixed(1)}u of river channel`
      });
    }
  }

  // 8. Landmark vs landmark overlap
  const lmEntries = Object.entries(LANDMARK_REGISTRY);
  for (let i = 0; i < lmEntries.length; i++) {
    const [keyA, defA] = lmEntries[i];
    const grpA = state.landmarkGroups.get(keyA);
    const offAx = grpA ? grpA.position.x : 0;
    const offAz = grpA ? grpA.position.z : 0;
    const axC = defA.approxCenter[0] + offAx, azC = defA.approxCenter[1] + offAz;
    for (let j = i + 1; j < lmEntries.length; j++) {
      const [keyB, defB] = lmEntries[j];
      const grpB = state.landmarkGroups.get(keyB);
      const offBx = grpB ? grpB.position.x : 0;
      const offBz = grpB ? grpB.position.z : 0;
      const bxC = defB.approxCenter[0] + offBx, bzC = defB.approxCenter[1] + offBz;
      const dist = Math.sqrt((axC - bxC) ** 2 + (azC - bzC) ** 2);
      if (dist < defA.approxRadius + defB.approxRadius) {
        devState.auditIssues.push({
          type: 'landmark-landmark',
          severity: 'high',
          landmarkKey: keyA,
          x: (axC + bxC) / 2,
          z: (azC + bzC) / 2,
          message: `Landmark Overlap: ${defA.label} and ${defB.label} footprints overlap (dist ${dist.toFixed(1)}u)`
        });
      }
    }
  }

  updateAuditorUI();
  devState.helpersDirty = true;
  return devState.auditIssues;
}

function updateAuditorUI() {
  if (typeof document === 'undefined') return;
  const list = document.getElementById('dev-auditor-list');
  const countBadge = document.getElementById('dev-auditor-count');
  if (!list) return;

  list.innerHTML = '';
  if (countBadge) {
    countBadge.textContent = `${devState.auditIssues.length} issues`;
    countBadge.className = devState.auditIssues.length > 0 ? 'badge badge-warn' : 'badge badge-ok';
  }

  if (devState.auditIssues.length === 0) {
    list.innerHTML = '<div class="auditor-empty-state">No issues found. World is perfectly clean!</div>';
    return;
  }

  devState.auditIssues.forEach(issue => {
    const div = document.createElement('div');
    div.className = `auditor-item severity-${issue.severity}`;

    const info = document.createElement('div');
    info.className = 'auditor-info';
    info.innerHTML = `<strong>[${issue.type.toUpperCase()}]</strong> ${issue.message}`;

    const warpBtn = document.createElement('button');
    warpBtn.className = 'btn-primary btn-xs auditor-warp-btn';
    warpBtn.textContent = 'Warp';
    warpBtn.addEventListener('click', () => {
      devTeleport(issue.x, issue.z);
    });

    div.appendChild(info);
    div.appendChild(warpBtn);
    list.appendChild(div);
  });
}

// --- 3D Scene Helpers ---
export function rebuild3DHelpers() {
  if (!state.scene) return;
  if (!devState.helpersGroup) {
    devState.helpersGroup = new THREE.Group();
    state.scene.add(devState.helpersGroup);
  }

  // Clear old helpers
  while(devState.helpersGroup.children.length > 0) {
    const child = devState.helpersGroup.children[0];
    devState.helpersGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  }

  // 1. Placed Asset footprint box helpers
  if (devState.showAssetBoxes && state.placedAssets) {
    for (const entry of state.placedAssets.values()) {
      const asset = entry.asset;
      const catalog = WORLD_ASSET_CATALOG[asset.type];
      if (!catalog) continue;

      const hasIssue = devState.auditIssues.some(iss => iss.assetIdA === asset.id || iss.assetIdB === asset.id);
      const color = hasIssue ? '#ef4444' : '#38bdf8';

      const half = (catalog.footprint * asset.scale) / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(asset.x - half, asset.y, asset.z - half),
        new THREE.Vector3(asset.x + half, asset.y + 3.0 * asset.scale, asset.z + half)
      );
      const helper = new THREE.Box3Helper(box, new THREE.Color(color));
      devState.helpersGroup.add(helper);
    }
  }

  // 2. Wall Box helpers
  if (devState.showWallBoxes && state.WALLS) {
    state.WALLS.forEach(wall => {
      const helper = new THREE.Box3Helper(wall, new THREE.Color('#f87171'));
      devState.helpersGroup.add(helper);
    });
  }

  // 3. River path line strip + boundaries
  if (devState.showRiverPath) {
    const points = RIVER_PTS.map(pt => new THREE.Vector3(pt[0], getTerrainHeight(pt[0], pt[1], true) + 0.15, pt[1]));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: '#0ea5e9', linewidth: 3 });
    const line = new THREE.Line(geometry, material);
    devState.helpersGroup.add(line);

    const leftPoints = [];
    const rightPoints = [];
    for (let i = 0; i < RIVER_PTS.length; i++) {
      const pt = RIVER_PTS[i];
      let dx = 0, dz = 0;
      if (i < RIVER_PTS.length - 1) {
        dx = RIVER_PTS[i+1][0] - pt[0];
        dz = RIVER_PTS[i+1][1] - pt[1];
      } else {
        dx = pt[0] - RIVER_PTS[i-1][0];
        dz = pt[1] - RIVER_PTS[i-1][1];
      }
      const len = Math.sqrt(dx*dx + dz*dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const lx = pt[0] + nx * 5.0;
      const lz = pt[1] + nz * 5.0;
      const rx = pt[0] - nx * 5.0;
      const rz = pt[1] - nz * 5.0;

      leftPoints.push(new THREE.Vector3(lx, getTerrainHeight(lx, lz, true) + 0.15, lz));
      rightPoints.push(new THREE.Vector3(rx, getTerrainHeight(rx, rz, true) + 0.15, rz));
    }

    const leftGeom = new THREE.BufferGeometry().setFromPoints(leftPoints);
    const rightGeom = new THREE.BufferGeometry().setFromPoints(rightPoints);
    const boundaryMat = new THREE.LineBasicMaterial({ color: 'rgba(56, 189, 248, 0.45)', linewidth: 1.5 });

    devState.helpersGroup.add(new THREE.Line(leftGeom, boundaryMat));
    devState.helpersGroup.add(new THREE.Line(rightGeom, boundaryMat));
  }

  // 4. Flat zone boundary rings (driven by LANDMARK_REGISTRY)
  if (devState.showFlatZones) {
    const zoneColors = ['#10b981', '#3b82f6', '#a855f7', '#eab308', '#64748b'];
    Object.values(LANDMARK_REGISTRY).forEach((def, idx) => {
      const [cx, cz] = def.approxCenter;
      const lmGroup = state.landmarkGroups.get(Object.keys(LANDMARK_REGISTRY)[idx]);
      const offX = lmGroup ? lmGroup.position.x : 0;
      const offZ = lmGroup ? lmGroup.position.z : 0;
      const circlePoints = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const px = cx + offX + Math.cos(theta) * def.approxRadius;
        const pz = cz + offZ + Math.sin(theta) * def.approxRadius;
        circlePoints.push(new THREE.Vector3(px, getTerrainHeight(px, pz) + 0.1, pz));
      }
      const circleGeom = new THREE.BufferGeometry().setFromPoints(circlePoints);
      const circleMat = new THREE.LineBasicMaterial({ color: zoneColors[idx % zoneColors.length], linewidth: 2 });
      devState.helpersGroup.add(new THREE.Line(circleGeom, circleMat));
    });
  }

  // 5. Landmark bounding box helpers
  if (devState.showLandmarkBoxes) {
    Object.entries(LANDMARK_REGISTRY).forEach(([key, def]) => {
      const lmGroup = state.landmarkGroups.get(key);
      const offX = lmGroup ? lmGroup.position.x : 0;
      const offZ = lmGroup ? lmGroup.position.z : 0;
      const [cx, cz] = def.approxCenter;
      const lx = cx + offX, lz = cz + offZ;
      const r = def.approxRadius;
      const terrainH = getTerrainHeight(lx, lz);
      const hasIssue = devState.auditIssues.some(iss => iss.landmarkKey === key);
      const color = hasIssue ? '#ef4444' : '#f59e0b';
      const box = new THREE.Box3(
        new THREE.Vector3(lx - r, terrainH - 0.5, lz - r),
        new THREE.Vector3(lx + r, terrainH + 20, lz + r)
      );
      devState.helpersGroup.add(new THREE.Box3Helper(box, new THREE.Color(color)));
    });
  }

  // 6. Static scenery misalignment markers
  if (devState.showStaticAuditMarkers && devState.staticAuditIssues.length > 0) {
    const _tmpV = new THREE.Vector3();
    devState.staticAuditIssues.forEach(issue => {
      const { x, y, z } = issue.worldPos;
      const terrainY = issue.terrainY;
      const color = issue.severity === 'high' ? '#ef4444' : issue.type === 'tilted' ? '#a855f7' : '#f59e0b';

      // Sphere at object position
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 6, 6),
        new THREE.MeshBasicMaterial({ color, depthTest: false })
      );
      sphere.position.set(x, y + 0.3, z);
      devState.helpersGroup.add(sphere);

      // Vertical line from terrain to object Y showing the gap
      if (issue.type === 'floating' || issue.type === 'buried') {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, terrainY, z),
          new THREE.Vector3(x, y, z),
        ]);
        devState.helpersGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color })));
      }

      // Tilt indicator: axes helper
      if (issue.type === 'tilted' && issue.index < state.STATIC_SCENERY.length) {
        const obj = state.STATIC_SCENERY[issue.index]?.object3d;
        if (obj) {
          const axes = new THREE.AxesHelper(1.5);
          axes.position.set(x, y + 0.5, z);
          axes.rotation.copy(obj.rotation);
          devState.helpersGroup.add(axes);
        }
      }
    });
  }

  // 7. Last-inspected object marker (alt+click)
  if (devState.lastInspected) {
    const { worldPos } = devState.lastInspected;
    const markerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', depthTest: false })
    );
    markerSphere.position.set(worldPos.x, worldPos.y + 0.25, worldPos.z);
    devState.helpersGroup.add(markerSphere);

    const axes = new THREE.AxesHelper(2.0);
    axes.position.set(worldPos.x, worldPos.y, worldPos.z);
    devState.helpersGroup.add(axes);
  }
}

// Call on frame ticks to update helper group representation
export function updateDevTools(now) {
  if (state.editor.enabled && state.editor.selectedId) {
    const entry = state.placedAssets.get(state.editor.selectedId);
    if (entry) {
      const pos = entry.group.position;
      const rot = entry.group.rotation.y;
      const scl = entry.group.scale.x;
      if (!devState.lastSelectedPos ||
          devState.lastSelectedPos.x !== pos.x ||
          devState.lastSelectedPos.y !== pos.y ||
          devState.lastSelectedPos.z !== pos.z ||
          devState.lastSelectedRot !== rot ||
          devState.lastSelectedScale !== scl) {
        devState.lastSelectedPos = { x: pos.x, y: pos.y, z: pos.z };
        devState.lastSelectedRot = rot;
        devState.lastSelectedScale = scl;
        devState.helpersDirty = true;
      }
    }
  } else {
    devState.lastSelectedPos = null;
  }

  const currentAssetCount = state.placedAssets?.size || 0;
  if (currentAssetCount !== devState.lastAssetCount || devState.helpersDirty) {
    devState.lastAssetCount = currentAssetCount;
    devState.helpersDirty = false;
    rebuild3DHelpers();
  }

  if (devState.showMap) {
    renderDevMapCanvas();
  }
}

// --- 2D Interactive Dev Map Canvas ---
let mapCanvas = null;
let mapCtx = null;

function initMapDOM() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dev-map-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'dev-map-panel';
  panel.className = 'glass dev-map-panel';
  panel.style.display = 'none';

  // Build landmark warp buttons HTML
  const lmButtons = Object.entries(LANDMARK_REGISTRY).map(([key, def]) =>
    `<button class="btn-primary btn-xs dev-landmark-warp-btn" data-lm="${key}">${def.label}</button>`
  ).join('');

  panel.innerHTML = `
    <div class="dev-map-header">
      <div>
        <h3>2D World Inspector</h3>
        <p>Drag to Pan · Scroll to Zoom · Double-Click to Teleport</p>
      </div>
      <button class="modal-close-btn" id="close-dev-map-btn">✕</button>
    </div>

    <div class="dev-map-body">
      <div class="dev-map-canvas-container">
        <canvas id="dev-map-canvas" width="600" height="600"></canvas>
        <div id="dev-map-tooltip" class="dev-map-tooltip"></div>
      </div>

      <div class="dev-map-auditor">
        <div class="auditor-header">
          <h4>Placement Auditor</h4>
          <span id="dev-auditor-count" class="badge badge-ok">0 issues</span>
        </div>
        <div id="dev-auditor-list" class="dev-auditor-list">
          <div class="auditor-empty-state">Run auditor to audit layout...</div>
        </div>
        <div class="auditor-actions">
          <button id="dev-audit-run-btn" class="btn-primary btn-sm" style="width: 100%;">Audit World Assets</button>
        </div>
        <div class="auditor-landmarks">
          <h4 style="margin: 8px 0 4px; font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em;">Warp to Landmark</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">${lmButtons}</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  mapCanvas = document.getElementById('dev-map-canvas');
  mapCtx = mapCanvas.getContext('2d');

  document.getElementById('close-dev-map-btn').addEventListener('click', () => {
    toggleDevMap(false);
  });

  document.getElementById('dev-audit-run-btn').addEventListener('click', () => {
    runWorldAudit();
  });

  // Landmark warp buttons
  panel.querySelectorAll('.dev-landmark-warp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const def = LANDMARK_REGISTRY[btn.dataset.lm];
      if (!def) return;
      const lmGroup = state.landmarkGroups.get(btn.dataset.lm);
      const offX = lmGroup ? lmGroup.position.x : 0;
      const offZ = lmGroup ? lmGroup.position.z : 0;
      devTeleport(def.approxCenter[0] + offX, def.approxCenter[1] + offZ);
    });
  });

  // Pan & Zoom Mouse Event Listeners
  mapCanvas.addEventListener('mousedown', (e) => {
    devState.isDragging = true;
    devState.startX = e.clientX;
    devState.startY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!devState.isDragging || !devState.showMap) return;
    const dx = e.clientX - devState.startX;
    const dy = e.clientY - devState.startY;
    devState.startX = e.clientX;
    devState.startY = e.clientY;

    const scale = (mapCanvas.width / MAP_SIZE) * devState.zoom;
    devState.panX -= dx / scale;
    devState.panY -= dy / scale;

    const maxPan = MAP_SIZE / 2;
    devState.panX = Math.max(-maxPan, Math.min(maxPan, devState.panX));
    devState.panY = Math.max(-maxPan, Math.min(maxPan, devState.panY));

    renderDevMapCanvas();
  });

  window.addEventListener('mouseup', () => {
    devState.isDragging = false;
  });

  mapCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    devState.zoom = Math.max(0.8, Math.min(10.0, devState.zoom * zoomFactor));
    renderDevMapCanvas();
  }, { passive: false });

  mapCanvas.addEventListener('dblclick', (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const worldPos = screenToWorld(sx, sy, mapCanvas.width, mapCanvas.height);

    const half = MAP_SIZE / 2;
    if (Math.abs(worldPos.wx) <= half && Math.abs(worldPos.wz) <= half) {
      devTeleport(worldPos.wx, worldPos.wz);
      renderDevMapCanvas();
    }
  });

  mapCanvas.addEventListener('mousemove', (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const worldPos = screenToWorld(sx, sy, mapCanvas.width, mapCanvas.height);
    devState.hoveredCoords = { x: worldPos.wx, z: worldPos.wz };

    let hovered = null;
    if (state.placedAssets) {
      for (const entry of state.placedAssets.values()) {
        const asset = entry.asset;
        const catalog = WORLD_ASSET_CATALOG[asset.type] || { footprint: 1.0 };
        const radius = (catalog.footprint * asset.scale) / 2;
        const dx = asset.x - worldPos.wx;
        const dz = asset.z - worldPos.wz;
        if (Math.sqrt(dx*dx + dz*dz) < radius) {
          hovered = entry;
          break;
        }
      }
    }
    devState.hoveredAsset = hovered;

    let hoverRoom = null;
    for (const room of state.ROOMS) {
      const bounds = getRoomBounds(room);
      if (worldPos.wx >= bounds.minX && worldPos.wx <= bounds.maxX &&
          worldPos.wz >= bounds.minZ && worldPos.wz <= bounds.maxZ) {
        hoverRoom = room;
        break;
      }
    }
    devState.hoveredRoom = hoverRoom;

    updateTooltipUI(e.clientX - rect.left, e.clientY - rect.top);
  });

  mapCanvas.addEventListener('mouseleave', () => {
    const tooltip = document.getElementById('dev-map-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  });
}

function updateTooltipUI(x, y) {
  if (typeof document === 'undefined') return;
  const tooltip = document.getElementById('dev-map-tooltip');
  if (!tooltip) return;

  tooltip.style.display = 'block';
  tooltip.style.left = `${x + 12}px`;
  tooltip.style.top = `${y + 12}px`;

  let html = `<strong>Coord:</strong> (${devState.hoveredCoords.x.toFixed(1)}, ${devState.hoveredCoords.z.toFixed(1)})<br/>`;
  html += `<strong>Elevation:</strong> ${getTerrainHeight(devState.hoveredCoords.x, devState.hoveredCoords.z).toFixed(2)}u<br/>`;

  if (devState.hoveredRoom) {
    html += `<strong>Room:</strong> ${devState.hoveredRoom.name} (ID: ${devState.hoveredRoom.id})<br/>`;
  } else {
    html += `<strong>Room:</strong> Outdoors<br/>`;
  }

  if (devState.hoveredAsset) {
    const asset = devState.hoveredAsset.asset;
    const catalog = WORLD_ASSET_CATALOG[asset.type] || { label: asset.type };
    html += `<hr style="margin:4px 0;border-color:rgba(255,255,255,0.1);"/>`;
    html += `<strong>Asset:</strong> ${catalog.label}<br/>`;
    html += `<strong>Scale:</strong> ${asset.scale.toFixed(2)}<br/>`;
    html += `<strong>Pos:</strong> (${asset.x.toFixed(1)}, ${asset.y.toFixed(1)}, ${asset.z.toFixed(1)})<br/>`;

    const issues = devState.auditIssues.filter(iss => iss.assetIdA === asset.id || iss.assetIdB === asset.id);
    if (issues.length > 0) {
      html += `<span style="color:#f87171;font-weight:bold;">⚠ Warnings (${issues.length}):</span><br/>`;
      issues.forEach(iss => {
        html += `<span style="color:#fca5a5;font-size:0.75rem;">• ${iss.type}</span><br/>`;
      });
    }
  }

  tooltip.innerHTML = html;
}

function worldToScreen(wx, wz, canvasWidth, canvasHeight) {
  const scale = (canvasWidth / MAP_SIZE) * devState.zoom;
  const sx = canvasWidth / 2 + (wx - devState.panX) * scale;
  const sy = canvasHeight / 2 + (wz - devState.panY) * scale;
  return { sx, sy };
}

function screenToWorld(sx, sy, canvasWidth, canvasHeight) {
  const scale = (canvasWidth / MAP_SIZE) * devState.zoom;
  const wx = devState.panX + (sx - canvasWidth / 2) / scale;
  const wz = devState.panY + (sy - canvasHeight / 2) / scale;
  return { wx, wz };
}

function renderDevMapCanvas() {
  if (!mapCtx || !mapCanvas) return;

  const w = mapCanvas.width;
  const h = mapCanvas.height;
  const ctx = mapCtx;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  const scale = (w / MAP_SIZE) * devState.zoom;

  // 1. Draw Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  const gridSpacing = 50;

  for (let gx = -MAP_SIZE/2; gx <= MAP_SIZE/2; gx += gridSpacing) {
    const pt = worldToScreen(gx, 0, w, h);
    if (pt.sx >= 0 && pt.sx <= w) {
      ctx.beginPath();
      ctx.moveTo(pt.sx, 0);
      ctx.lineTo(pt.sx, h);
      ctx.stroke();
    }
  }
  for (let gz = -MAP_SIZE/2; gz <= MAP_SIZE/2; gz += gridSpacing) {
    const pt = worldToScreen(0, gz, w, h);
    if (pt.sy >= 0 && pt.sy <= h) {
      ctx.beginPath();
      ctx.moveTo(0, pt.sy);
      ctx.lineTo(w, pt.sy);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1.5;
  const centerPt = worldToScreen(0, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(centerPt.sx, 0); ctx.lineTo(centerPt.sx, h);
  ctx.moveTo(0, centerPt.sy); ctx.lineTo(w, centerPt.sy);
  ctx.stroke();

  // 2. Draw Landmark zones (from LANDMARK_REGISTRY)
  const zoneColors = [
    { border: '#10b981', fill: 'rgba(16, 185, 129, 0.1)' },
    { border: '#64748b', fill: 'rgba(100, 116, 139, 0.1)' },
    { border: '#3b82f6', fill: 'rgba(59, 130, 246, 0.1)' },
    { border: '#a855f7', fill: 'rgba(168, 85, 247, 0.1)' },
    { border: '#f97316', fill: 'rgba(249, 115, 22, 0.1)' },
  ];
  Object.entries(LANDMARK_REGISTRY).forEach(([key, def], idx) => {
    const lmGroup = state.landmarkGroups.get(key);
    const offX = lmGroup ? lmGroup.position.x : 0;
    const offZ = lmGroup ? lmGroup.position.z : 0;
    const lx = def.approxCenter[0] + offX;
    const lz = def.approxCenter[1] + offZ;
    const pt = worldToScreen(lx, lz, w, h);
    const r = def.approxRadius * scale;
    const colors = zoneColors[idx % zoneColors.length];

    ctx.fillStyle = colors.fill;
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (scale > 1.2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.label, pt.sx, pt.sy + 3);
    }
  });

  // 3. Draw River Path
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 10 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  RIVER_PTS.forEach((pt, i) => {
    const sPt = worldToScreen(pt[0], pt[1], w, h);
    if (i === 0) ctx.moveTo(sPt.sx, sPt.sy);
    else ctx.lineTo(sPt.sx, sPt.sy);
  });
  ctx.stroke();

  ctx.strokeStyle = 'rgba(14, 165, 233, 0.55)';
  ctx.lineWidth = 3.2 * scale;
  ctx.beginPath();
  RIVER_PTS.forEach((pt, i) => {
    const sPt = worldToScreen(pt[0], pt[1], w, h);
    if (i === 0) ctx.moveTo(sPt.sx, sPt.sy);
    else ctx.lineTo(sPt.sx, sPt.sy);
  });
  ctx.stroke();

  // 4. Draw Rooms
  state.ROOMS.forEach(room => {
    const bounds = getRoomBounds(room);
    const tl = worldToScreen(bounds.minX, bounds.minZ, w, h);
    const br = worldToScreen(bounds.maxX, bounds.maxZ, w, h);
    const rw = br.sx - tl.sx;
    const rh = br.sy - tl.sy;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.fillRect(tl.sx, tl.sy, rw, rh);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tl.sx, tl.sy, rw, rh);

    if (rw > 24) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, tl.sx + rw / 2, tl.sy + rh / 2 + 3);
    }
  });

  // 5. Draw Walls
  if (state.WALLS) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 1;
    state.WALLS.forEach(wall => {
      const tl = worldToScreen(wall.min.x, wall.min.z, w, h);
      const br = worldToScreen(wall.max.x, wall.max.z, w, h);
      ctx.fillRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy);
      ctx.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy);
    });
  }

  // 6. Draw Placed Assets
  if (state.placedAssets) {
    for (const entry of state.placedAssets.values()) {
      const asset = entry.asset;
      const catalog = WORLD_ASSET_CATALOG[asset.type] || { footprint: 1.0 };
      const radius = (catalog.footprint * asset.scale * scale) / 2;
      const pt = worldToScreen(asset.x, asset.z, w, h);

      const hasIssue = devState.auditIssues.some(iss => iss.assetIdA === asset.id || iss.assetIdB === asset.id);

      let color = '#94a3b8';
      if (asset.type === 'tree') color = '#10b981';
      else if (asset.type === 'boulder') color = '#64748b';
      else if (asset.type === 'flower') color = '#ec4899';
      else if (asset.type === 'lantern') color = '#eab308';
      else if (asset.type === 'banner') color = '#6366f1';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, Math.max(radius, 2.5), 0, Math.PI * 2);
      ctx.fill();

      if (hasIssue) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        const pulse = 1.0 + 0.3 * Math.sin(Date.now() * 0.007);
        ctx.arc(pt.sx, pt.sy, Math.max(radius * pulse, 4.5), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, Math.max(radius, 2.5), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // 7. Draw NPCs & Remote Players
  if (state.npcs) {
    ctx.fillStyle = '#a3e635';
    state.npcs.forEach(npc => {
      const pt = worldToScreen(npc.x, npc.z, w, h);
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (state.remotePlayers) {
    ctx.fillStyle = '#f59e0b';
    state.remotePlayers.forEach(p => {
      const pt = worldToScreen(p.x, p.z, w, h);
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, 3.0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 8. Draw Local Player
  if (state.localPlayer) {
    const pt = worldToScreen(state.localPlayer.x, state.localPlayer.z, w, h);
    ctx.save();
    ctx.translate(pt.sx, pt.sy);
    ctx.rotate(-state.localPlayer.ry);

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(-4.5, 4.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(4.5, 4.5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  const tlBound = worldToScreen(-300, -300, w, h);
  const brBound = worldToScreen(300, 300, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(tlBound.sx, tlBound.sy, brBound.sx - tlBound.sx, brBound.sy - tlBound.sy);
  ctx.setLineDash([]);
}

export function toggleDevMap(forceState) {
  if (typeof document === 'undefined') return;
  const show = typeof forceState === 'boolean' ? forceState : !devState.showMap;
  devState.showMap = show;

  const checkbox = document.getElementById('dev-map-checkbox');
  if (checkbox) checkbox.checked = show;

  initMapDOM();
  const panel = document.getElementById('dev-map-panel');
  if (panel) {
    panel.style.display = show ? 'flex' : 'none';
    if (show) {
      if (state.localPlayer) {
        devState.panX = state.localPlayer.x;
        devState.panY = state.localPlayer.z;
      }
      renderDevMapCanvas();
    }
  }
}

// --- lil-gui setup ---
export function initDevTools(gui) {
  if (!gui) return;

  if (typeof document !== 'undefined') {
    initMapDOM();
  }

  const folder = gui.addFolder('AI & Dev Helpers');

  const mapControl = folder.add(devState, 'showMap').name('Show 2D Map').onChange((v) => {
    toggleDevMap(v);
  });
  if (typeof document !== 'undefined') {
    const input = mapControl.domElement.querySelector('input');
    if (input) input.id = 'dev-map-checkbox';
  }

  folder.add(devState, 'showAssetBoxes').name('Show Asset Colliders').onChange(() => {
    devState.helpersDirty = true;
  });
  folder.add(devState, 'showWallBoxes').name('Show Wall Colliders').onChange(() => {
    devState.helpersDirty = true;
  });
  folder.add(devState, 'showRiverPath').name('Show River Path').onChange(() => {
    devState.helpersDirty = true;
  });
  folder.add(devState, 'showFlatZones').name('Show Flat Zones').onChange(() => {
    devState.helpersDirty = true;
  });
  folder.add(devState, 'showLandmarkBoxes').name('Show Landmark Boxes').onChange(() => {
    devState.helpersDirty = true;
  });
  folder.add(devState, 'showStaticAuditMarkers').name('Show Misalign Markers').onChange(() => {
    devState.helpersDirty = true;
  });

  folder.add({ audit: () => runWorldAudit() }, 'audit').name('Run Placement Audit');
  folder.add({ auditStatic: () => {
    const issues = _auditStaticScenery();
    devState.showStaticAuditMarkers = true;
    devState.helpersDirty = true;
    console.log(`[Static Audit] ${issues.length} issues found. Markers enabled.`);
  }}, 'auditStatic').name('Audit Static Scenery');
  folder.add({ clearInspected: () => {
    devState.lastInspected = null;
    devState.helpersDirty = true;
  }}, 'clearInspected').name('Clear Inspector');

  folder.close();

  // Alt+click: inspect any mesh in the scene
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'M' && e.shiftKey) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        toggleDevMap();
      }
    });

    window.addEventListener('click', (e) => {
      if (!e.altKey || !state.DEBUG_STATE?.enabled || !state.camera || !state.renderer) return;
      const canvas = state.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, state.camera);
      const hits = raycaster.intersectObjects(state.scene.children, true);
      if (!hits.length) return;

      const obj = hits[0].object;
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      const wq = new THREE.Quaternion();
      obj.getWorldQuaternion(wq);
      const wr = new THREE.Euler().setFromQuaternion(wq);
      const ws = new THREE.Vector3();
      obj.getWorldScale(ws);

      // Walk parent chain to identify landmark membership
      let parentInfo = 'scene-root';
      let cur = obj.parent;
      while (cur && cur !== state.scene) {
        for (const [key, grp] of state.landmarkGroups.entries()) {
          if (grp === cur) { parentInfo = `landmark:${key}`; break; }
        }
        if (parentInfo !== 'scene-root') break;
        cur = cur.parent;
      }

      const terrainY = getTerrainHeight(wp.x, wp.z);
      const result = {
        type: obj.type,
        geometry: obj.geometry?.type || '—',
        worldPos: { x: +wp.x.toFixed(3), y: +wp.y.toFixed(3), z: +wp.z.toFixed(3) },
        worldRotDeg: { x: +(wr.x * 180 / Math.PI).toFixed(1), y: +(wr.y * 180 / Math.PI).toFixed(1), z: +(wr.z * 180 / Math.PI).toFixed(1) },
        worldScale: { x: +ws.x.toFixed(3), y: +ws.y.toFixed(3), z: +ws.z.toFixed(3) },
        terrainY: +terrainY.toFixed(3),
        yAboveTerrain: +(wp.y - terrainY).toFixed(3),
        parentChain: parentInfo,
        userData: obj.userData,
      };

      devState.lastInspected = result;
      devState.helpersDirty = true;
      console.log('[Inspector] Alt+clicked:');
      console.log(JSON.stringify(result, null, 2));
    });
  }
}

// --- Calculation helpers (used by both API and internals) ---

function _nearestLandmark(x, z) {
  let best = null, bestDist = Infinity;
  for (const [key, def] of Object.entries(LANDMARK_REGISTRY)) {
    const lmGroup = state.landmarkGroups.get(key);
    const offX = lmGroup ? lmGroup.position.x : 0;
    const offZ = lmGroup ? lmGroup.position.z : 0;
    const dist = Math.sqrt((x - (def.approxCenter[0] + offX)) ** 2 + (z - (def.approxCenter[1] + offZ)) ** 2);
    if (dist < bestDist) { bestDist = dist; best = { key, label: def.label, dist: +dist.toFixed(2), radius: def.approxRadius }; }
  }
  return best;
}

function _nearestRoom(x, z) {
  let best = null, bestDist = Infinity;
  for (const room of state.ROOMS) {
    const dist = Math.sqrt((x - room.x) ** 2 + (z - room.z) ** 2);
    if (dist < bestDist) { bestDist = dist; best = { id: room.id, name: room.name, dist: +dist.toFixed(2) }; }
  }
  return best;
}

function _worldQuery(x, z) {
  const terrainHeight = +getTerrainHeight(x, z).toFixed(3);
  const roomId = getRoomIdForPosition(x, z);
  const room = roomId !== -1 ? state.ROOMS.find(r => r.id === roomId) : null;
  const riverDist = +getRiverDist(x, z).toFixed(2);
  const isInRiver = riverDist < 5.0;

  let wallCollision = false;
  for (const wall of state.WALLS) {
    if (x >= wall.min.x && x <= wall.max.x && z >= wall.min.z && z <= wall.max.z) { wallCollision = true; break; }
  }

  let assetCollision = false;
  for (const col of state.PLACED_ASSET_COLLIDERS) {
    if (x >= col.minX && x <= col.maxX && z >= col.minZ && z <= col.maxZ) { assetCollision = true; break; }
  }

  return {
    x: +x.toFixed(2), z: +z.toFixed(2),
    terrainHeight,
    roomId,
    roomName: room ? room.name : 'outdoors',
    riverDist,
    isInRiver,
    wallCollision,
    assetCollision,
    nearestLandmark: _nearestLandmark(x, z),
    nearestRoom: _nearestRoom(x, z),
  };
}

function _sampleTerrain(cx, cz, radius, steps = 5) {
  const points = [];
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const px = cx - radius + (2 * radius * i / (steps - 1));
      const pz = cz - radius + (2 * radius * j / (steps - 1));
      const y = getTerrainHeight(px, pz);
      points.push({ x: +px.toFixed(1), z: +pz.toFixed(1), y: +y.toFixed(3) });
      if (y < min) min = y;
      if (y > max) max = y;
      sum += y;
    }
  }
  const avg = sum / points.length;
  const maxSlope = max - min;
  return { points, min: +min.toFixed(3), max: +max.toFixed(3), avg: +avg.toFixed(3), maxSlope: +maxSlope.toFixed(3), isFlat: maxSlope < 1.0 };
}

// --- Static Scenery Auditor ---
// Shared between the lil-gui button and metalyceumDev.auditStaticScenery()
const _tmpVec = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();

function _auditStaticScenery(threshold = 0.4) {
  const issues = [];

  for (let i = 0; i < state.STATIC_SCENERY.length; i++) {
    const entry = state.STATIC_SCENERY[i];
    const obj = entry.object3d;
    if (!obj) continue;

    // Use world position (handles objects nested inside landmark groups)
    obj.getWorldPosition(_tmpVec);
    const wx = _tmpVec.x, wy = _tmpVec.y, wz = _tmpVec.z;

    // Outdoor objects should sit on the terrain; room objects are on flat floors
    if (entry.kind !== 'room') {
      const terrainY = getTerrainHeight(wx, wz);
      const diff = wy - terrainY;
      if (Math.abs(diff) > threshold) {
        issues.push({
          index: i,
          kind: entry.kind,
          worldPos: { x: +wx.toFixed(2), y: +wy.toFixed(2), z: +wz.toFixed(2) },
          terrainY: +terrainY.toFixed(3),
          diff: +diff.toFixed(3),
          severity: Math.abs(diff) > 2 ? 'high' : 'medium',
          type: diff > 0 ? 'floating' : 'buried',
          message: diff > 0
            ? `Floating: scenery[${i}] sits +${diff.toFixed(2)}u above terrain at (${wx.toFixed(1)}, ${wz.toFixed(1)})`
            : `Buried: scenery[${i}] sits ${diff.toFixed(2)}u under terrain at (${wx.toFixed(1)}, ${wz.toFixed(1)})`,
        });
      }
    }

    // Tilt check — objects should be upright (rotation.x ≈ 0, rotation.z ≈ 0)
    // Flat planes are excluded (they deliberately have rotation.x = -PI/2)
    obj.getWorldQuaternion(_tmpQuat);
    _tmpEuler.setFromQuaternion(_tmpQuat);
    const rx = _tmpEuler.x, rz = _tmpEuler.z;
    const isLikelyFlatPlane = obj.children?.length === 0 && obj.geometry?.type?.includes('Plane');
    if (!isLikelyFlatPlane && (Math.abs(rx) > 0.18 || Math.abs(rz) > 0.18)) {
      issues.push({
        index: i,
        kind: entry.kind,
        worldPos: { x: +wx.toFixed(2), y: +wy.toFixed(2), z: +wz.toFixed(2) },
        worldRotDeg: {
          x: +(rx * 180 / Math.PI).toFixed(1),
          y: +(_tmpEuler.y * 180 / Math.PI).toFixed(1),
          z: +(rz * 180 / Math.PI).toFixed(1),
        },
        severity: 'medium',
        type: 'tilted',
        message: `Tilted: scenery[${i}] at (${wx.toFixed(1)}, ${wz.toFixed(1)}) — rotX=${(rx * 180 / Math.PI).toFixed(1)}°, rotZ=${(rz * 180 / Math.PI).toFixed(1)}°`,
      });
    }
  }

  devState.staticAuditIssues = issues;
  devState.helpersDirty = true;

  const floating = issues.filter(i => i.type === 'floating').length;
  const buried = issues.filter(i => i.type === 'buried').length;
  const tilted = issues.filter(i => i.type === 'tilted').length;
  console.log(`[auditStaticScenery] ${state.STATIC_SCENERY.length} objects scanned → ${issues.length} issues (${floating} floating, ${buried} buried, ${tilted} tilted)`);
  issues.forEach(iss => console.log(`  [${iss.severity.toUpperCase()}] ${iss.message}`));

  return issues;
}

// --- Global LLM-callable API ---
function exposeLLMApi() {
  if (typeof window === 'undefined') return;

  window.metalyceumDev = {

    // ── Navigation ─────────────────────────────────────────────────────────

    teleport: (x, z) => devTeleport(x, z),

    teleportTo: (name) => {
      const def = LANDMARK_REGISTRY[name];
      if (!def) { console.warn(`[metalyceumDev] Unknown landmark: "${name}". Try: ${Object.keys(LANDMARK_REGISTRY).join(', ')}`); return; }
      const lmGroup = state.landmarkGroups.get(name);
      const offX = lmGroup ? lmGroup.position.x : 0;
      const offZ = lmGroup ? lmGroup.position.z : 0;
      devTeleport(def.approxCenter[0] + offX, def.approxCenter[1] + offZ);
    },

    toggleMap: (v) => toggleDevMap(v),

    // ── Landmark transforms ────────────────────────────────────────────────

    setLandmark: (name, { x = 0, y = 0, z = 0, rotY = 0 } = {}) => {
      const lmGroup = state.landmarkGroups.get(name);
      if (!lmGroup) { console.warn(`[metalyceumDev] Landmark "${name}" not found. Build the map first.`); return; }
      lmGroup.position.set(x, y, z);
      lmGroup.rotation.y = rotY;
      devState.helpersDirty = true;
      console.log(`[metalyceumDev] Moved ${name}: ${JSON.stringify({ x, y, z, rotY })}`);
    },

    getLandmark: (name) => {
      const lmGroup = state.landmarkGroups.get(name);
      if (!lmGroup) return null;
      return { x: lmGroup.position.x, y: lmGroup.position.y, z: lmGroup.position.z, rotY: lmGroup.rotation.y };
    },

    listLandmarks: () => Object.keys(LANDMARK_REGISTRY),

    // ── Auditing ───────────────────────────────────────────────────────────

    audit: () => runWorldAudit(),

    getAuditIssues: () => devState.auditIssues,

    /**
     * For audit issue at `index`, returns a concrete fix to paste into source.
     * clipping/z-fighting → minimum delta to separate the two assets
     * floating/buried    → exact y to snap asset to terrain
     * river              → delta to move asset 5.5u clear of river centre
     * wall-collision     → delta to move asset outside the overlapping wall
     * landmark-overlap   → delta to move asset to landmark radius edge
     */
    suggestFix: (index) => {
      const issue = devState.auditIssues[index];
      if (!issue) return { error: `No issue at index ${index}. Run audit() first.` };

      if (issue.type === 'clipping' || issue.type === 'z-fighting') {
        const entA = state.placedAssets.get(issue.assetIdA);
        const entB = state.placedAssets.get(issue.assetIdB);
        if (!entA || !entB) return { error: 'Asset not found in placedAssets' };
        const a = entA.asset, b = entB.asset;
        const catA = WORLD_ASSET_CATALOG[a.type] || { footprint: 1.0 };
        const catB = WORLD_ASSET_CATALOG[b.type] || { footprint: 1.0 };
        const rA = (catA.footprint * a.scale) / 2;
        const rB = (catB.footprint * b.scale) / 2;
        const dx = b.x - a.x, dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        const need = rA + rB + 0.1;
        const push = need - dist;
        const nx = dx / dist, nz = dz / dist;
        return {
          action: 'move asset B away from asset A',
          assetIdToMove: b.id,
          assetTypeToMove: b.type,
          delta: { x: +(nx * push).toFixed(3), z: +(nz * push).toFixed(3) },
          newPos: { x: +(b.x + nx * push).toFixed(3), z: +(b.z + nz * push).toFixed(3) },
        };
      }

      if (issue.type === 'floating' || issue.type === 'buried') {
        const ent = state.placedAssets.get(issue.assetIdA);
        if (!ent) return { error: 'Asset not found' };
        const a = ent.asset;
        const targetY = +getTerrainHeight(a.x, a.z).toFixed(3);
        return {
          action: 'snap asset y to terrain',
          assetId: a.id,
          newY: targetY,
          currentY: a.y,
          delta: +(targetY - a.y).toFixed(3),
        };
      }

      if (issue.type === 'river') {
        const ent = state.placedAssets.get(issue.assetIdA);
        if (!ent) return { error: 'Asset not found' };
        const a = ent.asset;
        // Find closest river segment midpoint and push away from it
        let closestPt = [0, 0];
        let closestDist = Infinity;
        for (let i = 0; i < RIVER_PTS.length - 1; i++) {
          const mx = (RIVER_PTS[i][0] + RIVER_PTS[i+1][0]) / 2;
          const mz = (RIVER_PTS[i][1] + RIVER_PTS[i+1][1]) / 2;
          const d = Math.sqrt((a.x - mx) ** 2 + (a.z - mz) ** 2);
          if (d < closestDist) { closestDist = d; closestPt = [mx, mz]; }
        }
        const dx = a.x - closestPt[0], dz = a.z - closestPt[1];
        const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
        const need = 5.5;
        const push = need - dist;
        return {
          action: 'move asset away from river',
          assetId: a.id,
          delta: { x: +(dx / dist * push).toFixed(3), z: +(dz / dist * push).toFixed(3) },
          newPos: { x: +(a.x + dx / dist * push).toFixed(3), z: +(a.z + dz / dist * push).toFixed(3) },
        };
      }

      return { note: `No auto-fix for issue type "${issue.type}"`, issue };
    },

    // ── Position intelligence ──────────────────────────────────────────────

    /**
     * One-shot query for a position. Returns terrain height, room, river proximity,
     * wall/asset collision status, and nearest landmark/room.
     * Use this before placing any geometry to understand the site.
     */
    worldQuery: (x, z) => _worldQuery(x, z),

    /**
     * Sample terrain heights across a grid centred at (cx, cz).
     * Returns individual point heights + min/max/avg/maxSlope + isFlat flag.
     * Use before writing baseY calculations for a new structure.
     *   steps=5  → 25 points (quick overview)
     *   steps=10 → 100 points (detail for large builds)
     */
    sampleTerrain: (cx, cz, radius, steps = 5) => _sampleTerrain(cx, cz, radius, steps),

    /**
     * Horizontal + vertical measurement between two points.
     * Returns distance, terrain heights, slope — useful for roads and ramps.
     */
    measure: (x1, z1, x2, z2) => {
      const dx = x2 - x1, dz = z2 - z1;
      const xzDist = +Math.sqrt(dx * dx + dz * dz).toFixed(3);
      const y1 = +getTerrainHeight(x1, z1).toFixed(3);
      const y2 = +getTerrainHeight(x2, z2).toFixed(3);
      const yMid = +getTerrainHeight((x1 + x2) / 2, (z1 + z2) / 2).toFixed(3);
      return {
        xzDist, y1, y2, yMid,
        heightDiff: +(y2 - y1).toFixed(3),
        slopePct: xzDist > 0 ? +(Math.abs(y2 - y1) / xzDist * 100).toFixed(1) : 0,
        direction: xzDist > 0 ? { x: +(dx / xzDist).toFixed(4), z: +(dz / xzDist).toFixed(4) } : { x: 0, z: 0 },
      };
    },

    /**
     * Find clear positions on the map for a new structure of given radius.
     * Avoids: river channel, existing landmarks, rooms, main building zone.
     * Returns up to `limit` candidates sorted by distance from world centre.
     */
    findClearSpace: (radius, { limit = 5, excludeLandmarks = true } = {}) => {
      const step = Math.max(radius * 2, 20);
      const half = MAP_SIZE / 2 - radius - 10;
      const candidates = [];

      for (let x = -half; x <= half; x += step) {
        for (let z = -half; z <= half; z += step) {
          // Skip main building zone
          if (x >= COVERED_BOUNDS.minX - radius && x <= COVERED_BOUNDS.maxX + radius &&
              z >= COVERED_BOUNDS.minZ - radius && z <= COVERED_BOUNDS.maxZ + radius) continue;

          // Skip river
          if (getRiverDist(x, z) < radius + 8) continue;

          // Skip rooms
          let inRoom = false;
          for (const room of state.ROOMS) {
            const b = getRoomBounds(room, radius + 5);
            if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) { inRoom = true; break; }
          }
          if (inRoom) continue;

          // Skip existing landmarks
          if (excludeLandmarks) {
            let tooClose = false;
            for (const [key, def] of Object.entries(LANDMARK_REGISTRY)) {
              const lmGroup = state.landmarkGroups.get(key);
              const offX = lmGroup ? lmGroup.position.x : 0;
              const offZ = lmGroup ? lmGroup.position.z : 0;
              const dist = Math.sqrt((x - (def.approxCenter[0] + offX)) ** 2 + (z - (def.approxCenter[1] + offZ)) ** 2);
              if (dist < def.approxRadius + radius + 15) { tooClose = true; break; }
            }
            if (tooClose) continue;
          }

          const distFromCentre = Math.sqrt(x * x + z * z);
          candidates.push({ x: Math.round(x), z: Math.round(z), distFromCentre: +distFromCentre.toFixed(1), terrainHeight: +getTerrainHeight(x, z).toFixed(2) });
        }
      }

      candidates.sort((a, b) => a.distFromCentre - b.distFromCentre);
      return candidates.slice(0, limit);
    },

    // ── World state snapshot ───────────────────────────────────────────────

    /**
     * Full JSON snapshot of the world — landmarks, rooms, walls, placed asset summary,
     * player position. The LLM equivalent of reading every file at once.
     */
    snapshot: () => {
      const landmarks = Object.entries(LANDMARK_REGISTRY).map(([key, def]) => {
        const lmGroup = state.landmarkGroups.get(key);
        return {
          key, label: def.label,
          center: def.approxCenter, radius: def.approxRadius,
          groupOffset: lmGroup
            ? { x: +lmGroup.position.x.toFixed(3), y: +lmGroup.position.y.toFixed(3), z: +lmGroup.position.z.toFixed(3), rotY: +lmGroup.rotation.y.toFixed(5) }
            : { x: 0, y: 0, z: 0, rotY: 0 },
          terrainHeight: +getTerrainHeight(def.approxCenter[0], def.approxCenter[1]).toFixed(3),
        };
      });

      const rooms = state.ROOMS.map(r => {
        const b = getRoomBounds(r);
        return { id: r.id, name: r.name, x: r.x, z: r.z, width: r.width, depth: r.depth, bounds: b };
      });

      const walls = state.WALLS.map(w => ({
        min: { x: +w.min.x.toFixed(2), y: +w.min.y.toFixed(2), z: +w.min.z.toFixed(2) },
        max: { x: +w.max.x.toFixed(2), y: +w.max.y.toFixed(2), z: +w.max.z.toFixed(2) },
      }));

      const assets = Array.from(state.placedAssets.values()).slice(0, 200).map(({ asset }) => ({
        id: asset.id, type: asset.type,
        x: asset.x, y: asset.y, z: asset.z,
        rotY: asset.rotationY, scale: asset.scale, roomId: asset.roomId,
      }));

      return {
        player: state.localPlayer
          ? { x: +state.localPlayer.x.toFixed(2), y: +state.localPlayer.y.toFixed(2), z: +state.localPlayer.z.toFixed(2) }
          : null,
        landmarks,
        rooms,
        walls,
        placedAssets: { count: state.placedAssets.size, list: assets },
        mapSize: MAP_SIZE,
      };
    },

    // ── Geometry helpers ───────────────────────────────────────────────────

    /**
     * Returns the PLACED_ASSET_COLLIDERS entry for a box footprint.
     * Paste the return value directly into state.PLACED_ASSET_COLLIDERS.push(...).
     *   metalyceumDev.colliderBox(130, -80, 60, 60)
     */
    colliderBox: (cx, cz, w, d, id = 'custom') => ({
      minX: +(cx - w / 2).toFixed(3), maxX: +(cx + w / 2).toFixed(3),
      minZ: +(cz - d / 2).toFixed(3), maxZ: +(cz + d / 2).toFixed(3),
      assetId: id,
    }),

    /**
     * Returns the Box3 constructor arguments for state.WALLS.push(new THREE.Box3(...)).
     * Pass baseY from getTerrainHeight; h is wall height.
     *   metalyceumDev.wallBox(-85, 140, 46, 34, 10, baseY)
     */
    wallBox: (cx, cz, w, d, h, baseY = 0) => ({
      min: { x: +(cx - w / 2).toFixed(3), y: +(baseY - 0.5).toFixed(3), z: +(cz - d / 2).toFixed(3) },
      max: { x: +(cx + w / 2).toFixed(3), y: +(baseY + h).toFixed(3), z: +(cz + d / 2).toFixed(3) },
      jsCode: `new THREE.Box3(new THREE.Vector3(${+(cx - w/2).toFixed(2)}, ${+(baseY-0.5).toFixed(2)}, ${+(cz - d/2).toFixed(2)}), new THREE.Vector3(${+(cx + w/2).toFixed(2)}, ${+(baseY+h).toFixed(2)}, ${+(cz + d/2).toFixed(2)}))`,
    }),

    /**
     * Returns the terrain height at a position — the value used for baseY in scenery files.
     * This is the most commonly needed calculation when writing new geometry.
     */
    terrainAt: (x, z) => +getTerrainHeight(x, z).toFixed(4),

    // ── Asset listing ──────────────────────────────────────────────────────

    listAssets: () => {
      const byType = {};
      for (const { asset } of state.placedAssets.values()) {
        if (!byType[asset.type]) byType[asset.type] = [];
        byType[asset.type].push({ id: asset.id, x: asset.x, z: asset.z, scale: asset.scale });
      }
      return byType;
    },

    // ── Object inspection ──────────────────────────────────────────────────

    /**
     * Scan all state.STATIC_SCENERY objects for terrain misalignment and tilt.
     * threshold: max Y deviation from terrain before flagging (default 0.4u).
     * Results are stored in devState.staticAuditIssues and shown as 3D markers
     * when "Show Misalign Markers" is toggled on.
     */
    auditStaticScenery: (threshold = 0.4) => _auditStaticScenery(threshold),

    /**
     * Detailed world-transform report for every object within `radius` units of
     * the player. Covers STATIC_SCENERY and placed dynamic assets.
     * Returns array sorted by distance — paste result into the diagnostics report
     * or use it to identify which object needs fixing.
     */
    inspectNearby: (radius = 30) => {
      const px = state.localPlayer?.x ?? 0;
      const pz = state.localPlayer?.z ?? 0;
      const results = [];
      const _tmp = new THREE.Vector3();
      const _tq = new THREE.Quaternion();
      const _te = new THREE.Euler();

      for (const entry of state.STATIC_SCENERY) {
        const obj = entry.object3d;
        if (!obj) continue;
        obj.getWorldPosition(_tmp);
        const d = Math.sqrt((_tmp.x - px) ** 2 + (_tmp.z - pz) ** 2);
        if (d > radius) continue;

        obj.getWorldQuaternion(_tq);
        _te.setFromQuaternion(_tq);
        const terrainY = getTerrainHeight(_tmp.x, _tmp.z);
        results.push({
          source: 'static-scenery',
          kind: entry.kind,
          worldPos: { x: +_tmp.x.toFixed(2), y: +_tmp.y.toFixed(2), z: +_tmp.z.toFixed(2) },
          worldRotDeg: {
            x: +(_te.x * 180 / Math.PI).toFixed(1),
            y: +(_te.y * 180 / Math.PI).toFixed(1),
            z: +(_te.z * 180 / Math.PI).toFixed(1),
          },
          scale: +obj.scale.x.toFixed(3),
          terrainY: +terrainY.toFixed(3),
          yAboveTerrain: +(_tmp.y - terrainY).toFixed(3),
          dist: +d.toFixed(1),
        });
      }

      for (const { asset } of state.placedAssets.values()) {
        const d = Math.sqrt((asset.x - px) ** 2 + (asset.z - pz) ** 2);
        if (d > radius) continue;
        const terrainY = getTerrainHeight(asset.x, asset.z);
        results.push({
          source: 'placed-asset',
          type: asset.type,
          id: asset.id.slice(0, 8),
          worldPos: { x: asset.x, y: asset.y, z: asset.z },
          worldRotDeg: { y: +(asset.rotationY * 180 / Math.PI).toFixed(1) },
          scale: asset.scale,
          terrainY: +terrainY.toFixed(3),
          yAboveTerrain: +(asset.y - terrainY).toFixed(3),
          dist: +d.toFixed(1),
        });
      }

      results.sort((a, b) => a.dist - b.dist);
      return results;
    },

    /** Returns issues from the last auditStaticScenery() call. */
    getStaticAuditIssues: () => devState.staticAuditIssues,

    /** Returns the last object selected via alt+click, or null. */
    getLastInspected: () => devState.lastInspected,

    /** Clear the alt+click inspector result and its 3D marker. */
    clearInspected: () => { devState.lastInspected = null; devState.helpersDirty = true; },

    // ── Proximity / intersection ───────────────────────────────────────────

    /**
     * Compute pairwise distances between all objects near a point (or the player).
     * Covers: placed assets (footprint circles), landmark groups (approxRadius circles),
     * and static scenery groups (estimated 1.5u radius).
     *
     * Returns an array sorted by distance (ascending). Entries with dist <= 0 are
     * intersecting/clipping; entries with dist < 0.5 are touching.
     *
     *   metalyceumDev.proximity()            // objects within 60u of player
     *   metalyceumDev.proximity(130, -80, 80) // objects within 80u of (130, -80)
     */
    proximity: (cx, cz, radius = 60) => {
      if (cx === undefined) {
        cx = state.localPlayer?.x ?? 0;
        cz = state.localPlayer?.z ?? 0;
      }

      // Collect all objects as {id, label, x, z, r} circles
      const objs = [];

      // Placed dynamic assets
      for (const { asset } of state.placedAssets.values()) {
        const d = Math.sqrt((asset.x - cx) ** 2 + (asset.z - cz) ** 2);
        if (d > radius) continue;
        const cat = WORLD_ASSET_CATALOG[asset.type];
        const r = cat ? (cat.footprint * asset.scale) / 2 : 0.5;
        objs.push({ kind: 'asset', id: asset.id.slice(0, 8), label: `${asset.type}`, x: asset.x, z: asset.z, r });
      }

      // Landmark groups (approxRadius from registry)
      for (const [key, def] of Object.entries(LANDMARK_REGISTRY)) {
        const grp = state.landmarkGroups.get(key);
        const lx = def.approxCenter[0] + (grp ? grp.position.x : 0);
        const lz = def.approxCenter[1] + (grp ? grp.position.z : 0);
        const d = Math.sqrt((lx - cx) ** 2 + (lz - cz) ** 2);
        if (d > radius + def.approxRadius) continue;
        objs.push({ kind: 'landmark', id: key, label: def.label, x: lx, z: lz, r: def.approxRadius });
      }

      // Static scenery groups (world position, estimated radius 1.5u)
      const _tmp2 = new THREE.Vector3();
      for (let i = 0; i < state.STATIC_SCENERY.length; i++) {
        const entry = state.STATIC_SCENERY[i];
        if (!entry.object3d) continue;
        entry.object3d.getWorldPosition(_tmp2);
        const d = Math.sqrt((_tmp2.x - cx) ** 2 + (_tmp2.z - cz) ** 2);
        if (d > radius) continue;
        objs.push({ kind: 'static', id: `scenery[${i}]`, label: `static(${entry.kind})`, x: +_tmp2.x.toFixed(2), z: +_tmp2.z.toFixed(2), r: 1.5 });
      }

      // Compute all pairwise distances
      const pairs = [];
      for (let i = 0; i < objs.length; i++) {
        for (let j = i + 1; j < objs.length; j++) {
          const a = objs[i], b = objs[j];
          const dx = a.x - b.x, dz = a.z - b.z;
          const centreDist = Math.sqrt(dx * dx + dz * dz);
          const edgeDist = centreDist - a.r - b.r; // negative = intersecting
          pairs.push({
            a: { kind: a.kind, id: a.id, label: a.label, pos: { x: a.x, z: a.z }, r: a.r },
            b: { kind: b.kind, id: b.id, label: b.label, pos: { x: b.x, z: b.z }, r: b.r },
            centreDist: +centreDist.toFixed(3),
            edgeDist: +edgeDist.toFixed(3),
            status: edgeDist < 0 ? 'INTERSECTING' : edgeDist < 0.3 ? 'touching' : edgeDist < 2 ? 'close' : 'clear',
          });
        }
      }

      pairs.sort((a, b) => a.edgeDist - b.edgeDist);

      const intersecting = pairs.filter(p => p.status === 'INTERSECTING').length;
      const touching = pairs.filter(p => p.status === 'touching').length;
      console.log(`[proximity] ${objs.length} objects, ${pairs.length} pairs — ${intersecting} intersecting, ${touching} touching`);
      pairs.filter(p => p.status === 'INTERSECTING' || p.status === 'touching').forEach(p =>
        console.log(`  [${p.status}] ${p.a.label}(${p.a.id}) ↔ ${p.b.label}(${p.b.id})  edge dist: ${p.edgeDist}u`)
      );

      return pairs;
    },

    /**
     * Show the nearest N objects to a given position (or player) with their
     * edge-to-edge distances. Quick orientation check before placing geometry.
     *   metalyceumDev.nearestObjects()         // top 10 nearest to player
     *   metalyceumDev.nearestObjects(130,-80,15) // top 15 nearest to (130,-80)
     */
    nearestObjects: (cx, cz, topN = 10) => {
      if (cx === undefined) { cx = state.localPlayer?.x ?? 0; cz = state.localPlayer?.z ?? 0; }
      const _tmp3 = new THREE.Vector3();
      const items = [];

      for (const { asset } of state.placedAssets.values()) {
        const d = Math.sqrt((asset.x - cx) ** 2 + (asset.z - cz) ** 2);
        const cat = WORLD_ASSET_CATALOG[asset.type];
        const r = cat ? (cat.footprint * asset.scale) / 2 : 0.5;
        items.push({ label: `asset:${asset.type}`, id: asset.id.slice(0, 8), x: asset.x, z: asset.z, r, centreDist: +d.toFixed(2), edgeDist: +(d - r).toFixed(2) });
      }
      for (const [key, def] of Object.entries(LANDMARK_REGISTRY)) {
        const grp = state.landmarkGroups.get(key);
        const lx = def.approxCenter[0] + (grp ? grp.position.x : 0);
        const lz = def.approxCenter[1] + (grp ? grp.position.z : 0);
        const d = Math.sqrt((lx - cx) ** 2 + (lz - cz) ** 2);
        items.push({ label: `landmark:${def.label}`, id: key, x: lx, z: lz, r: def.approxRadius, centreDist: +d.toFixed(2), edgeDist: +(d - def.approxRadius).toFixed(2) });
      }
      for (let i = 0; i < state.STATIC_SCENERY.length; i++) {
        const entry = state.STATIC_SCENERY[i];
        if (!entry.object3d) continue;
        entry.object3d.getWorldPosition(_tmp3);
        const d = Math.sqrt((_tmp3.x - cx) ** 2 + (_tmp3.z - cz) ** 2);
        items.push({ label: `static:${entry.kind}`, id: `scenery[${i}]`, x: +_tmp3.x.toFixed(2), z: +_tmp3.z.toFixed(2), r: 1.5, centreDist: +d.toFixed(2), edgeDist: +(d - 1.5).toFixed(2) });
      }

      items.sort((a, b) => a.edgeDist - b.edgeDist);
      return items.slice(0, topN);
    },
  };
}

// Expose API immediately and after DOMContentLoaded (whichever comes first)
exposeLLMApi();
if (typeof document !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', exposeLLMApi);
}
