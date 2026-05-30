// Physics and Collision Handling for Metalyceum
import { state } from './state.js';
import { MAP_SIZE, COVERED_BOUNDS, LOBBY_BOUNDS } from './config.js';

// Bumpy terrain function - flat in the center building zone, rolling hills outdoors
export function getTerrainHeight(x, z) {
  const distFromCenter = Math.sqrt(x * x + z * z);
  if (distFromCenter < 52) {
    return 0; // Flat safety zone for the building foundation
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
    return true; // Collided with edge barrier
  }

  // Iterate over building walls and check bounding boxes
  for (const wall of state.WALLS) {
    if (targetX >= wall.minX && targetX <= wall.maxX &&
        targetZ >= wall.minZ && targetZ <= wall.maxZ) {
      return true; // Hit a building wall
    }
  }

  for (const collider of state.PLACED_ASSET_COLLIDERS) {
    if (targetX >= collider.minX && targetX <= collider.maxX &&
        targetZ >= collider.minZ && targetZ <= collider.maxZ) {
      return true;
    }
  }

  return false;
}

export function isPointWithinBounds(x, z, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

// Return the id of the room whose footprint contains (x, z), or -1 if outdoors.
// Mirrors the bounds test in detectRoomEntry so placed assets get the same scope.
export function getRoomIdForPosition(x, z) {
  for (const room of state.ROOMS) {
    const minX = room.x - room.width / 2;
    const maxX = room.x + room.width / 2;
    const minZ = room.z - room.depth / 2;
    const maxZ = room.z + room.depth / 2;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return room.id;
  }
  return -1;
}

export function isLocalPlayerUnderRoof() {
  if (state.localPlayer.currentRoom !== -1) return true;
  return isPointWithinBounds(state.localPlayer.x, state.localPlayer.z, LOBBY_BOUNDS)
    && isPointWithinBounds(state.localPlayer.x, state.localPlayer.z, COVERED_BOUNDS);
}
