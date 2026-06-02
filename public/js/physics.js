// Physics and Collision Handling for Metalyceum
import * as THREE from 'three';
import { state } from './state.js';
import { MAP_SIZE, COVERED_BOUNDS, LOBBY_BOUNDS } from './config.js';

// Scratch objects — zero allocations per frame
const _sphere = new THREE.Sphere(new THREE.Vector3(), 0.4);
const _sphereLoose = new THREE.Sphere(new THREE.Vector3(), 0.55);
const _cBox = new THREE.Box3();

// Smooth cubic interpolation: returns 0 at t≤lo, 1 at t≥hi, S-curve between.
function _ss(lo, hi, t) {
  const v = Math.max(0, Math.min(1, (t - lo) / (hi - lo)));
  return v * v * (3 - 2 * v);
}

// Rolling hills with fully smooth transitions into every flat zone.
// No hard cutoffs — all edges use smoothstep so terrain fades naturally.
export function getTerrainHeight(x, z) {
  // Base rolling hills — two overlapping sine octaves, amplitude ≈ ±3.7 u
  const hills = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.2
              + Math.cos(x * 0.05) * Math.sin(z * 0.05) * 1.5;

  // Per-zone flatness influence: 1 = completely flat, 0 = full hills.
  // Max of all zones wins at every point.

  // ── Main building complex (circular, centered at origin) ──────────────
  const d1 = Math.sqrt(x * x + z * z);
  const f1 = 1 - _ss(50, 76, d1);

  // ── Fountain approach corridor (narrow slot north of building) ─────────
  const corrX = Math.max(0, Math.abs(x) - 11);
  const corrZ = Math.max(0, z - 74) + Math.max(0, 44 - z);
  const f2 = 1 - _ss(0, 14, Math.sqrt(corrX * corrX + corrZ * corrZ));

  // ── Road to amphitheater — gentle flat corridor NE from fountain ────────
  // Approximated as distance to the polyline (4,63)→(27,97)→(56,137)→(65,150)
  function _ptSegDist(px, pz, ax, az, bx, bz) {
    const dax = bx - ax, daz = bz - az;
    const l2 = dax * dax + daz * daz;
    if (l2 < 0.001) return Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az));
    const tt = Math.max(0, Math.min(1, ((px - ax) * dax + (pz - az) * daz) / l2));
    return Math.sqrt((px - ax - tt * dax) * (px - ax - tt * dax) + (pz - az - tt * daz) * (pz - az - tt * daz));
  }
  const ampSegs = [
    [4.3, 62.7, 14, 78],
    [14, 78, 27, 97],
    [27, 97, 42, 118],
    [42, 118, 56, 137],
    [56, 137, 65, 150]
  ];
  const rd1 = Math.min(...ampSegs.map(([ax, az, bx, bz]) => _ptSegDist(x, z, ax, az, bx, bz)));
  const f3 = 1 - _ss(4, 11, rd1);

  // ── Road to concert venue — polyline NW from fountain ──────────────────
  const cvSegs = [
    [-5.3, 61.8, -18, 68],
    [-18, 68, -26, 86],
    [-26, 86, -38, 104],
    [-38, 104, -48, 122],
    [-48, 122, -60, 140]
  ];
  const rd2 = Math.min(...cvSegs.map(([ax, az, bx, bz]) => _ptSegDist(x, z, ax, az, bx, bz)));
  const f4 = 1 - _ss(4, 11, rd2);

  // ── Amphitheater at (65, 150) — built into a hill ──────────────────────
  // The terrain rises from the orchestra (flat at r<8) up 6 units at r=35,
  // creating a natural bowl. The seating sits on this slope.
  const d5 = Math.sqrt((x - 65) * (x - 65) + (z - 150) * (z - 150));
  const hillRise = _ss(6, 36, d5) * 9 * (1 - _ss(36, 52, d5));  // hill: +9u from r=6 to r=36, fade by 52
  const f5 = 1 - _ss(0, 46, d5);

  // ── Concert venue at (−85, 140) — elliptical to match building footprint
  const d6 = Math.sqrt(((x + 85) / 28) * ((x + 85) / 28) + ((z - 140) / 22) * ((z - 140) / 22));
  const f6 = 1 - _ss(1.0, 1.8, d6);

  // ── Airport at (160, 220) — flat zone for runway
  const d7 = Math.sqrt((x - 160) * (x - 160) + (z - 220) * (z - 220));
  const f7 = 1 - _ss(30, 70, d7);

  // ── Cave entrance at (75, 25) — flat zone for the approach
  const d8 = Math.sqrt((x - 75) * (x - 75) + (z - 25) * (z - 25));
  const f8 = 1 - _ss(5, 22, d8);

  // ── Underground city cavity — lower the terrain above so it doesn't occlude
  const d9 = Math.sqrt((x - 120) * (x - 120) + (z - 95) * (z - 95));
  const cavity = _ss(14, 0, d9) * 8; // 8 units deep at center, smooth edge over r=14

  // ── Meandering river — kept well away from the main building (avoids |x|<35, |z|<50)
  const riverPts = [
    [200, -200], [180, -175], [160, -150], [137, -125], [115, -100],
    [95, -77], [75, -55], [72, -32], [70, -10], [72, 7], [75, 25],
    [62, 47], [50, 70], [30, 90], [10, 110], [-10, 130],
    [-30, 150], [-55, 170], [-80, 190], [-105, 205], [-130, 220]
  ];
  let riverDist = Infinity;
  for (let i = 0; i < riverPts.length - 1; i++) {
    const d = _ptSegDist(x, z, riverPts[i][0], riverPts[i][1], riverPts[i + 1][0], riverPts[i + 1][1]);
    if (d < riverDist) riverDist = d;
  }
  // Deep, steep-sided canyon: 3.5u deep channel with a 4u edge roll-off so the river
  // is clearly visible from surrounding terrain. The water surface sits at ~channel bottom + 0.5.
  const riverChannel = _ss(4, 0, riverDist) * 3.5  // 3.5u deep at center, steep 4u edge
    + _ss(6, 4, riverDist) * 0.8;                   // 0.8u extra berm at the rim for a visible bank lip

  // ── Castle at (130, -80) — flat zone (4× scale = 80u radius)
  const d10 = Math.sqrt((x - 130) * (x - 130) + (z + 80) * (z + 80));
  const f10 = 1 - _ss(0, 80, d10);

  // ── Waterfall at (30, 90) — terrain step for a 3.5u drop
  const wfDx = x - 30, wfDz = z - 90;
  const wfDist = Math.abs(wfDx * Math.cos(-0.6) + wfDz * Math.sin(-0.6)); // distance to waterfall line
  const wfHeight = _ss(3, 0, wfDist) * 3.5 * (1 - _ss(1, 8, Math.abs(z - 90))); // 3.5u step, only near z=90
  const flatFactor = 1 - Math.max(f1, f2, f3, f4, f5, f6, f7, f8, f10);
  return (hills - cavity + Math.max(wfHeight - riverChannel, 0)) * flatFactor + hillRise - riverChannel;
}

export function checkCollision(targetX, targetZ) {
  // Map limits check
  const mapLim = MAP_SIZE / 2 - 2;
  if (Math.abs(targetX) > mapLim || Math.abs(targetZ) > mapLim) {
    return true;
  }

  // Reuse scratch objects — zero allocations
  _sphere.center.set(targetX, state.localPlayer?.y ?? 0, targetZ);

  for (const wallBox of state.WALLS) {
    if (wallBox.intersectsSphere(_sphere)) return true;
  }

  for (const collider of state.PLACED_ASSET_COLLIDERS) {
    _cBox.min.set(collider.minX, -20, collider.minZ);
    _cBox.max.set(collider.maxX, 20, collider.maxZ);
    if (_cBox.intersectsSphere(_sphere)) return true;
  }

  return false;
}

export function isPointWithinBounds(x, z, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

export function getRoomBounds(room, padding = 0) {
  if (room.bounds) {
    return {
      minX: room.bounds.minX - padding,
      maxX: room.bounds.maxX + padding,
      minZ: room.bounds.minZ - padding,
      maxZ: room.bounds.maxZ + padding
    };
  }

  return {
    minX: room.x - room.width / 2 - padding,
    maxX: room.x + room.width / 2 + padding,
    minZ: room.z - room.depth / 2 - padding,
    maxZ: room.z + room.depth / 2 + padding
  };
}

export function isPointInsideRoom(x, z, room, padding = 0) {
  return isPointWithinBounds(x, z, getRoomBounds(room, padding));
}

// Return the id of the room whose footprint contains (x, z), or -1 if outdoors.
// Mirrors the bounds test in detectRoomEntry so placed assets get the same scope.
export function getRoomIdForPosition(x, z, padding = 0) {
  for (const room of state.ROOMS) {
    if (isPointInsideRoom(x, z, room, padding)) return room.id;
  }
  return -1;
}

export function isLocalPlayerUnderRoof() {
  if (state.localPlayer.currentRoom !== -1) return true;
  if (isPointWithinBounds(state.localPlayer.x, state.localPlayer.z, COVERED_BOUNDS)) return true;
  // Direct distance check for venues that may not trigger room detection
  const px = state.localPlayer.x, pz = state.localPlayer.z;
  if ((px + 85) * (px + 85) + (pz - 140) * (pz - 140) < 400) return true; // concert venue r=20
  if ((px - 65) * (px - 65) + (pz - 150) * (pz - 150) < 400) return true; // amphitheater r=20
  return false;
}

// Safety-net collision check with expanded radius — only fires on gross failures.
// Used on the Cannon path so the net doesn't veto positions Cannon already validated.
export function checkCollisionLoose(targetX, targetZ) {
  const mapLim = MAP_SIZE / 2 - 2;
  if (Math.abs(targetX) > mapLim || Math.abs(targetZ) > mapLim) {
    return true;
  }
  _sphereLoose.center.set(targetX, state.localPlayer?.y ?? 0, targetZ);
  for (const wallBox of state.WALLS) {
    if (wallBox.intersectsSphere(_sphereLoose)) return true;
  }
  for (const collider of state.PLACED_ASSET_COLLIDERS) {
    _cBox.min.set(collider.minX, -20, collider.minZ);
    _cBox.max.set(collider.maxX, 20, collider.maxZ);
    if (_cBox.intersectsSphere(_sphereLoose)) return true;
  }
  return false;
}
