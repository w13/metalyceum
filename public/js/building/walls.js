import * as THREE from 'three';
import { state } from '../state.js';
import {
  ROOM_HEIGHT,
  COVERED_BOUNDS,
  MAIN_BUILDING_MEZZANINE_Y
} from '../config.js';
import { vec2LengthAngle } from '../scenery/utils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Named building extents — aliased from COVERED_BOUNDS in config.js
const BLDG_X_MIN = COVERED_BOUNDS.minX;
const BLDG_X_MAX = COVERED_BOUNDS.maxX;
const BLDG_Z_MIN = COVERED_BOUNDS.minZ;
const BLDG_Z_MAX = COVERED_BOUNDS.maxZ;

/**
 * Shared wall slab builder — used by both buildGroundWalls and buildUpperWalls.
 */
function _addWallSlabAt(xStart, zStart, xEnd, zEnd, baseY, height, thickness, material, baseboardMat, stateArr, castShadow = true, mergeTarget = null) {
  const { len, angle } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
  if (len < 0.01) return null;
  const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(len, height, thickness), material);
  wallMesh.position.set((xStart + xEnd) / 2, baseY + height / 2, (zStart + zEnd) / 2);
  wallMesh.rotation.y = -angle;
  wallMesh.castShadow = castShadow;
  wallMesh.receiveShadow = castShadow;

  if (!mergeTarget) state.scene.add(wallMesh);
  if (stateArr) stateArr.push(wallMesh);

  const bbH = 0.3, bbT = 0.07;
  const bbGeo = new THREE.BoxGeometry(len, bbH, bbT);
  [thickness / 2 + bbT / 2, -(thickness / 2 + bbT / 2)].forEach((zOff) => {
    const bb = new THREE.Mesh(bbGeo, baseboardMat);
    bb.position.set(0, -(height / 2) + bbH / 2, zOff);
    wallMesh.add(bb);
  });

  wallMesh.updateWorldMatrix(true, false);
  state.WALLS.push(new THREE.Box3().setFromObject(wallMesh));

  if (mergeTarget) {
    // Collect world-space geometry; mesh stays out of the scene
    const slabGeo = wallMesh.geometry.clone();
    slabGeo.applyMatrix4(wallMesh.matrixWorld);
    mergeTarget.slabs.push(slabGeo);

    wallMesh.children.forEach(child => {
      if (!child.isMesh) return;
      child.updateMatrix();
      const bbWorldGeo = child.geometry.clone();
      bbWorldGeo.applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(wallMesh.matrixWorld, child.matrix)
      );
      mergeTarget.boards.push(bbWorldGeo);
    });
  }

  return wallMesh;
}

export function buildGroundWalls(scene, state, materials, pushUpperWall) {
  const { wallMat, sharedBaseboardMat } = materials;
  const lowerMerge = { slabs: [], boards: [] };

  function addWallSegment(xStart, zStart, xEnd, zEnd, height = ROOM_HEIGHT) {
    const { len } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
    if (len < 0.01) return;

    const thickness = 0.5;
    const lowerHeight = 3.5;
    const upperHeight = height - lowerHeight;

    // Lower wall — collected into lowerMerge, flushed to one merged mesh after all segments
    _addWallSlabAt(xStart, zStart, xEnd, zEnd, 0, lowerHeight, thickness, wallMat, sharedBaseboardMat, null, true, lowerMerge);

    // Upper wall — added to scene individually (fade-system controlled via shared upperWallMat)
    if (upperHeight > 0.05) {
      const upperWall = _addWallSlabAt(xStart, zStart, xEnd, zEnd, lowerHeight, upperHeight, thickness, state.upperWallMat, sharedBaseboardMat, null);
      pushUpperWall(upperWall);
    }
  }

  state.ROOMS.forEach((room) => {
    if (room.id >= 8) return;
    const xMin = room.x - room.width / 2;
    const xMax = room.x + room.width / 2;
    const zMin = room.z - room.depth / 2;
    const zMax = room.z + room.depth / 2;
    if (room.x < 0) { addWallSegment(xMin, zMin, xMin, zMax); }
    else { addWallSegment(xMax, zMin, xMax, zMax); }
    addWallSegment(xMin, zMin, xMax, zMin);
    addWallSegment(xMin, zMax, xMax, zMax);
    const corridorX = room.x < 0 ? -5 : 5;
    addWallSegment(corridorX, zMin, corridorX, room.z - 2);
    addWallSegment(corridorX, room.z + 2, corridorX, zMax);
  });

  addWallSegment(-5, -20, -5, -18);
  addWallSegment(-5, -2, -5, 2);
  addWallSegment(-5, 14, -5, 18);
  addWallSegment(-5, 34, -5, 40);
  addWallSegment(5, -40, 5, -38);
  addWallSegment(5, -22, 5, -18);
  addWallSegment(5, -6, 5, -2);
  addWallSegment(5, 18, 5, 20);
  addWallSegment(5, 36, 5, 40);
  addWallSegment(-5, -40, 5, -40);
  addWallSegment(-5, 40, -2, 40);
  addWallSegment(2, 40, 5, 40);

  // Flush lower walls: merge collected geometries into two draw calls (slabs + baseboards)
  if (lowerMerge.slabs.length) {
    const m = new THREE.Mesh(mergeGeometries(lowerMerge.slabs), wallMat);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    lowerMerge.slabs.forEach(g => g.dispose());
    lowerMerge.slabs.length = 0;
  }
  if (lowerMerge.boards.length) {
    const m = new THREE.Mesh(mergeGeometries(lowerMerge.boards), sharedBaseboardMat);
    m.receiveShadow = true;
    scene.add(m);
    lowerMerge.boards.forEach(g => g.dispose());
    lowerMerge.boards.length = 0;
  }
}

export function buildUpperWalls(scene, state, materials, pushUpperFloor) {
  const { wallMat } = materials;
  const mezzY = MAIN_BUILDING_MEZZANINE_Y;
  const f2Height = 3.3;
  const f2Thickness = 0.5;
  const f2BaseboardMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9 });

  function addUpperWallSegment(xStart, zStart, xEnd, zEnd, height = f2Height) {
    const wall = _addWallSlabAt(xStart, zStart, xEnd, zEnd, mezzY, height, f2Thickness, wallMat, f2BaseboardMat, state.upperFloor, false);
    if (wall) pushUpperFloor(wall);
  }

  const leftUpperDoorZs = state.ROOMS.filter((r) => r.x < 0 && !r.floor && r.id < 8).map((r) => r.z);
  const rightUpperDoorZs = state.ROOMS.filter((r) => r.x > 0 && !r.floor && r.id < 8).map((r) => r.z);

  function addUpperCorridorWall(corridorX, doorZs, zMin = -40, zMax = 40) {
    const sorted = [...doorZs].sort((a, b) => a - b);
    let cursor = zMin;
    sorted.forEach((dz) => {
      const gapStart = dz - 2;
      const gapEnd = dz + 2;
      if (gapStart > cursor) addUpperWallSegment(corridorX, cursor, corridorX, gapStart);
      cursor = Math.max(cursor, gapEnd);
    });
    if (zMax > cursor) addUpperWallSegment(corridorX, cursor, corridorX, zMax);
  }

  addUpperCorridorWall(-5, leftUpperDoorZs);
  addUpperCorridorWall(5, rightUpperDoorZs);

  // North cap (z = -40) and south cap (z = +40)
  addUpperWallSegment(BLDG_X_MIN, BLDG_Z_MIN + 0.4, BLDG_X_MAX, BLDG_Z_MIN + 0.4);
  addUpperWallSegment(-30, 39.6, -2, 39.6);   // gap for main entrance
  addUpperWallSegment(2, BLDG_Z_MAX - 0.4, BLDG_X_MAX, BLDG_Z_MAX - 0.4);

  // Outer wall collision backs (interior face of the exterior limestone facade)
  addUpperWallSegment(BLDG_X_MIN + 0.5, BLDG_Z_MIN, BLDG_X_MIN + 0.5, BLDG_Z_MAX);
  addUpperWallSegment(BLDG_X_MAX - 0.5, BLDG_Z_MIN, BLDG_X_MAX - 0.5, BLDG_Z_MAX);

  // East wing room divider with 4u door gap at x≈17.5 (centre of the wing)
  addUpperWallSegment(5, -8, 14, -8);     // west part of divider
  addUpperWallSegment(21, -8, 30, -8);    // east part of divider
}
