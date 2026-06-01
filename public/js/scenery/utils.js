// Low-level terrain-alignment and collision helper utilities
import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../physics.js';
import { isWorldPlacementAllowed } from '../utils.js';

export function deformPlaneToTerrain(geometry, translateZ) {
  deformGroundGeometry(geometry, 0, translateZ);
}

export function deformGroundGeometry(geometry, centerX, centerZ, scaleX = 1, scaleY = 1) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i) * scaleX;
    const vy = pos.getY(i) * scaleY;
    const h = getTerrainHeight(centerX + vx, centerZ - vy);
    pos.setX(i, vx);
    pos.setY(i, vy);
    pos.setZ(i, h);
  }
  geometry.computeVertexNormals();
}

export function getTerrainCeiling(x, z, halfX = 0, halfZ = 0) {
  const sampleOffsets = [
    [0, 0],
    [-halfX, -halfZ],
    [-halfX, halfZ],
    [halfX, -halfZ],
    [halfX, halfZ],
    [-halfX, 0],
    [halfX, 0],
    [0, -halfZ],
    [0, halfZ]
  ];

  return sampleOffsets.reduce((maxHeight, [offsetX, offsetZ]) => {
    return Math.max(maxHeight, getTerrainHeight(x + offsetX, z + offsetZ));
  }, getTerrainHeight(x, z));
}

export function createGroundedPatch(geometry, material, centerX, centerZ, {
  yOffset = 0.02,
  scaleX = 1,
  scaleY = 1,
  receiveShadow = true,
  castShadow = false
} = {}) {
  deformGroundGeometry(geometry, centerX, centerZ, scaleX, scaleY);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(centerX, yOffset, centerZ);
  mesh.receiveShadow = receiveShadow;
  mesh.castShadow = castShadow;
  return mesh;
}

export function createGroundedRing(innerRadius, outerRadius, segments, material, centerX, centerZ, options = {}) {
  return createGroundedPatch(
    new THREE.RingGeometry(innerRadius, outerRadius, segments),
    material,
    centerX,
    centerZ,
    options
  );
}

export function addSceneryCollider(minX, maxX, minZ, maxZ, assetId) {
  state.PLACED_ASSET_COLLIDERS.push({ minX, maxX, minZ, maxZ, assetId });
}

/** Rejection-sample a world position that passes isWorldPlacementAllowed. */
export function samplePosition(margin = 20) {
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - margin);
    z = (Math.random() - 0.5) * (MAP_SIZE - margin);
  } while (!isWorldPlacementAllowed(x, z));
  return { x, z, groundY: getTerrainHeight(x, z) };
}

/** Compute length, angle, and deltas from (x1,z1) to (x2,z2). Caller checks early-exit. */
export function vec2LengthAngle(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  return { dx, dz, len, angle: Math.atan2(dz, dx) };
}
