// Physics and Collision Handling for Metalyceum
import * as THREE from 'three';
import { state } from './state.js';
import {
  MAP_SIZE,
  COVERED_BOUNDS,
  LOBBY_BOUNDS,
  MAIN_BUILDING_MEZZANINE_Y,
  MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
  RIVER_PTS
} from './config.js';
import { AMP_ROAD_SEGMENTS, CV_ROAD_SEGMENTS } from './utils.js';

function pointToSegmentDistSq(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) {
    const ddx = px - x1, ddz = pz - z1;
    return ddx * ddx + ddz * ddz;
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  const cx = x1 + dx * t, cz = z1 + dz * t;
  const ddx = px - cx, ddz = pz - cz;
  return ddx * ddx + ddz * ddz;
}

// Scratch objects — zero allocations per frame
const _sphere = new THREE.Sphere(new THREE.Vector3(), 0.4);
const _sphereLoose = new THREE.Sphere(new THREE.Vector3(), 0.55);
const _cBox = new THREE.Box3();

// Terrain helpers — module-level so they are not recreated (as closures) on every
// getTerrainHeight call. Previously defined inside the function which allocated new
// Function objects each invocation.
function _flatCircularH(x, z, cx, cz, rInner, rOuter) {
  const dx = x - cx, dz = z - cz;
  return 1 - _ss(rInner, rOuter, Math.sqrt(dx * dx + dz * dz));
}

// Loop instead of .map() + spread — eliminates 2 array allocations per call.
function _flatPolylineH(x, z, segments, rInner, rOuter) {
  let d = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const sd = Math.sqrt(pointToSegmentDistSq(x, z, s[0], s[1], s[2], s[3]));
    if (sd < d) d = sd;
  }
  return 1 - _ss(rInner, rOuter, d);
}

// Smooth cubic interpolation: returns 0 at t≤lo, 1 at t≥hi, S-curve between.
function _ss(lo, hi, t) {
  const v = Math.max(0, Math.min(1, (t - lo) / (hi - lo)));
  return v * v * (3 - 2 * v);
}

// Helper to determine if (x, z) is on a rotated box (bridge deck)
function isOnRotatedBridge(x, z, centerX, centerZ, angle, length, width) {
  const dx = x - centerX;
  const dz = z - centerZ;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rx = dx * cos - dz * sin;
  const rz = dx * sin + dz * cos;
  return Math.abs(rx) <= width / 2 && Math.abs(rz) <= length / 2;
}

// Shortest distance from point (px,pz) to segment (ax,az)→(bx,bz).

// Meandering river polyline — single source of truth used by both getTerrainHeight and getWaterSurfaceHeight.
// Kept well away from the main building (avoids |x|<35, |z|<50).
// Rolling hills with fully smooth transitions into every flat zone.
// No hard cutoffs — all edges use smoothstep so terrain fades naturally.
export function getTerrainHeight(x, z, ignoreBridges = false) {
  if (!ignoreBridges) {
    // 1. Road Bridge at (26, 93)
    if (isOnRotatedBridge(x, z, 26, 93, Math.atan2(13, 19), 12.0, 4.5)) {
      return 0.275; // Top of the deck (bridgeY + 0.125)
    }
    // 2. Stone Arch Bridge at (73, 8)
    // length=2.8 is along the river; width=6.5 is the crossing span (was swapped)
    const segAngle = Math.atan2(18, 3);
    const perpAngle = segAngle + Math.PI / 2;
    if (isOnRotatedBridge(x, z, 73, 8, -perpAngle, 2.8, 6.5)) {
      const rawTerrainY = getTerrainHeight(73, 8, true);
      return rawTerrainY + 3.6; // Top of road deck
    }
    // 3. Second-floor mezzanine deck inside the main building
    // Only active when the player is already elevated (above ROOM_HEIGHT / 2),
    // so ground-floor players are not affected.
    if (
      Math.abs(x) <= 29.5 && z >= -40 && z <= 40 &&
      state.localPlayer && state.localPlayer.y >= MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y
    ) {
      return MAIN_BUILDING_MEZZANINE_Y; // Mezzanine deck surface
    }
  }

  // ── Contributors ──────────────────────────────────────────────────────
  // Each line computes ONE modification to the base terrain.
  // Flat zones return 0..1 (1=fully flat). Depth/height modifiers return signed offsets.
  // _flatCircularH / _flatPolylineH are module-level — no closure re-creation per call.

  const f1 = _flatCircularH(x, z, 0, 0, 50, 76);                       // main building

  // Fountain approach corridor
  const corrX = Math.max(0, Math.abs(x) - 11);
  const corrZ = Math.max(0, z - 74) + Math.max(0, 44 - z);
  const f2 = 1 - _ss(0, 14, Math.sqrt(corrX * corrX + corrZ * corrZ));

  const f3 = _flatPolylineH(x, z, AMP_ROAD_SEGMENTS, 4, 11);            // road → amphitheater
  const f4 = _flatPolylineH(x, z, CV_ROAD_SEGMENTS, 4, 11);             // road → concert venue

  const d5 = Math.sqrt((x - 65) ** 2 + (z - 150) ** 2);
  const hillRise = _ss(6, 36, d5) * 9 * (1 - _ss(36, 52, d5));         // amphitheater bowl
  const f5 = _flatCircularH(x, z, 65, 150, 0, 46);

  const d6 = Math.sqrt(((x + 85) / 28) ** 2 + ((z - 140) / 22) ** 2);  // concert venue (elliptical)
  const f6 = 1 - _ss(1.0, 1.8, d6);

  const f7 = _flatCircularH(x, z, 160, 220, 30, 70);                    // airport
  const f8 = _flatCircularH(x, z, 75, 25, 5, 22);                       // cave entrance
  const f10 = _flatCircularH(x, z, 130, -80, 0, 80);                    // castle

  // Underground city cavity
  const d9 = Math.sqrt((x - 120) ** 2 + (z - 95) ** 2);
  const cavity = _ss(14, 0, d9) * 8;

  // River channel — polyline distance with canyon + berm
  let riverDist = Infinity;
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const d = Math.sqrt(pointToSegmentDistSq(x, z, RIVER_PTS[i][0], RIVER_PTS[i][1], RIVER_PTS[i + 1][0], RIVER_PTS[i + 1][1]));
    if (d < riverDist) riverDist = d;
  }
  // Wider, deeper channel: inner 9u half-width, 7u deep; berm 9–13u, 1.5u deep
  const riverChannel = _ss(9.0, 0.0, riverDist) * 7.0
    + _ss(13.0, 9.0, riverDist) * 1.5;

  // Waterfall step at (30, 90)
  const wfDist = Math.abs((x - 30) * Math.cos(-0.6) + (z - 90) * Math.sin(-0.6));
  const wfHeight = _ss(3, 0, wfDist) * 3.5 * (1 - _ss(1, 8, Math.abs(z - 90)));

  // Large lakes (depth modifiers)
  const lake1 = 5 * (1 - _ss(5, 55, Math.sqrt((x - 250) ** 2 + (z + 250) ** 2)));
  const lake2 = 4.5 * (1 - _ss(5, 45, Math.sqrt((x + 200) ** 2 + (z - 280) ** 2)));

  // Base rolling hills — two overlapping sine octaves, amplitude ≈ ±3.7 u
  const hills = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.2
              + Math.cos(x * 0.05) * Math.sin(z * 0.05) * 1.5;

  const flatFactor = 1 - Math.max(f1, f2, f3, f4, f5, f6, f7, f8, f10);
  return (hills - cavity + Math.max(wfHeight - riverChannel, 0)) * flatFactor + hillRise - riverChannel - lake1 - lake2;
}

export function checkCollision(targetX, targetZ) {
  return _checkCollisionWith(_sphere, targetX, targetZ);
}

// Safety-net collision check with expanded radius — only fires on gross failures.
// Used on the Cannon path so the net doesn't veto positions Cannon already validated.
function _checkCollisionWith(sphere, targetX, targetZ) {
  // Map limits check
  const mapLim = MAP_SIZE / 2 - 2;
  if (Math.abs(targetX) > mapLim || Math.abs(targetZ) > mapLim) {
    return true;
  }

  // Reuse scratch objects — zero allocations
  sphere.center.set(targetX, state.localPlayer?.y ?? 0, targetZ);

  for (const wallBox of state.WALLS) {
    if (wallBox.intersectsSphere(sphere)) return true;
  }

  for (const collider of state.PLACED_ASSET_COLLIDERS) {
    _cBox.min.set(collider.minX, -20, collider.minZ);
    _cBox.max.set(collider.maxX, 20, collider.maxZ);
    if (_cBox.intersectsSphere(sphere)) return true;
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

// Returns the water surface Y at (x,z) if the point is within the river channel, or null if dry land.
export function getWaterSurfaceHeight(x, z) {
  // Check large lakes first (cheap bounding box test)
  const lake1Dist = Math.sqrt((x - 250) * (x - 250) + (z + 250) * (z + 250));
  if (lake1Dist < 55) return getTerrainHeight(250, -250, true) - 2.0;
  const lake2Dist = Math.sqrt((x + 200) * (x + 200) + (z - 280) * (z - 280));
  if (lake2Dist < 45) return getTerrainHeight(-200, 280, true) - 2.0;

  // Coarse early-out: check bounding box of river + lakes (cheap)
  if (x > 310 || x < -250 || z > 330 || z < -310) return null;

  let riverDist = Infinity;
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const d = Math.sqrt(pointToSegmentDistSq(x, z, RIVER_PTS[i][0], RIVER_PTS[i][1], RIVER_PTS[i + 1][0], RIVER_PTS[i + 1][1]));
    if (d < riverDist) riverDist = d;
  }
  // Water fills the inner 4.5u of the 9u half-width channel (some bank visible on each side)
  if (riverDist > 4.5) return null;
  // Find the closest river control point to sample terrain at the channel centre
  let closestX = RIVER_PTS[0][0], closestZ = RIVER_PTS[0][1];
  let minDist2 = Infinity;
  for (let i = 0; i < RIVER_PTS.length; i++) {
    const dx = x - RIVER_PTS[i][0], dz = z - RIVER_PTS[i][1];
    const d2 = dx * dx + dz * dz;
    if (d2 < minDist2) { minDist2 = d2; closestX = RIVER_PTS[i][0]; closestZ = RIVER_PTS[i][1]; }
  }
  // Water surface = terrain at channel centre (already depressed) + 1.0, matching buildRiverRibbon
  const ref = getTerrainHeight(closestX, closestZ, true);
  return ref + 1.0;
}
