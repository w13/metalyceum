// Physics and Collision Handling for Metalyceum
import { state } from './state.js';
import { MAP_SIZE, COVERED_BOUNDS, LOBBY_BOUNDS } from './config.js';

// Scratch objects — zero allocations per frame
const _sphere = new THREE.Sphere(new THREE.Vector3(), 0.4);
const _cBox = new THREE.Box3();

// Bumpy terrain function - flat in the center building zone, rolling hills outdoors
export function getTerrainHeight(x, z) {
  const distFromCenter = Math.sqrt(x * x + z * z);
  if (distFromCenter < 52) {
    return 0; // Flat safety zone for the building foundation
  }
  // Flat zone for the fountain plaza — covers the circular plaza (radius ~18 at z=49.5),
  // the approach path, and all fountain landscaping.
  if (z > 38 && Math.abs(x) < 18) {
    return 0;
  }
  // Flat zone for the amphitheater orchestra & inner seating at (65, 150)
  // Reduced to r≈20 so outer seating rests on the natural terrain slope
  if ((x - 65) * (x - 65) + (z - 150) * (z - 150) < 400) {
    return 0;
  }
  // Flat zone for the concert hall at (-85, 140)
  if ((x + 85) * (x + 85) + (z - 140) * (z - 140) < 1764) {
    return 0;
  }
  // Smoothly blend hills into flat ground near the building
  const blendFactor = Math.min((distFromCenter - 52) * 0.08, 1.0);
  const hills = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.2 + Math.cos(x * 0.05) * Math.sin(z * 0.05) * 1.5;
  return hills * blendFactor;
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
  return isPointWithinBounds(state.localPlayer.x, state.localPlayer.z, LOBBY_BOUNDS);
}
