// Building Construction, Architecture, and Scenery Population for Metalyceum
import * as THREE from 'three';
import { state } from './state.js';
import {
  ROOM_HEIGHT,
  MAP_SIZE,
  COVERED_BOUNDS,
  MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
  MAIN_BUILDING_ELEVATOR_Z,
  MAIN_BUILDING_ELEVATOR_W,
  MAIN_BUILDING_ELEVATOR_D,
  MAIN_BUILDING_ELEVATOR_H
} from './config.js';
import { getTerrainHeight } from './physics.js';
import { HALF_PI, FLAT } from './math.js';
import { vec2LengthAngle, samplePosition, createFloor } from './scenery/utils.js';
import {
  createBuildingFadeZone,
  makeFadeMaterial,
  resetFadeZones
} from './fade-system.js';
import {
  initSceneryAssets,
  createBoulder,
  buildExteriorPlaza,
  buildOutdoorVenues,
  buildWorldDetails,
  initLazyVenueLoading,
} from './scenery.js';
import { createGrassTexture } from './textures.js';
import { createMainBuildingMaterials } from './building/materials.js';
import { buildElevator } from './building/elevator.js';

import { createDoorFrame } from './building/doors.js';
import { createWallTorch } from './building/torches.js';
import { buildRoof } from './building/roof.js';

import { buildGroundFloor } from './building/ground-floor.js';
import { buildGroundWalls, buildUpperWalls } from './building/walls.js';
import { buildUpperFloor } from './building/upper-floor.js';


// Named building extents — aliased from COVERED_BOUNDS in config.js
const BLDG_X_MIN = COVERED_BOUNDS.minX;
const BLDG_X_MAX = COVERED_BOUNDS.maxX;
const BLDG_Z_MIN = COVERED_BOUNDS.minZ;
const BLDG_Z_MAX = COVERED_BOUNDS.maxZ;



export async function buildMap(onProgress) {
  // Guard against double-build — if reinitialized, the old scene would leak
  // geometries, materials, and textures. Currently only called once from initEngine.
  if (state._mapBuilt) return;
  state._mapBuilt = true;
  resetFadeZones();
  state.upperWalls = [];
  state.upperFloor = [];
  state.roofMeshes = [];
  state.ceilingMat = null;
  state.ceilingMesh = null;
  state.upperWallMat = null;

  const grassTex = createGrassTexture();
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 120, 120);
  
  const positions = groundGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const vx = positions.getX(i);
    const vy = positions.getY(i);
    const height = getTerrainHeight(vx, -vy);
    positions.setZ(i, height);
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = FLAT;
  ground.receiveShadow = true;
  state.scene.add(ground);
  
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#372d20', roughness: 0.9 });
  const fenceGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3);
  const railGeo = new THREE.BoxGeometry(0.15, 0.2, 5.2);
  
  let postCount = 0;
  let railCount = 0;
  const limit = MAP_SIZE / 2 - 1.5;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    for (let offset = -limit; offset <= limit; offset += 5) {
      postCount++;
      if (offset < limit) {
        railCount += 2;
      }
    }
  }
  
  const postInstances = new THREE.InstancedMesh(fenceGeo, fenceMat, postCount);
  const railInstances = new THREE.InstancedMesh(railGeo, fenceMat, railCount);
  postInstances.castShadow = false;
  railInstances.castShadow = false;
  
  const tempObj = new THREE.Object3D();
  let postIdx = 0;
  let railIdx = 0;
  
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    const isHorizontal = angle === 0 || angle === Math.PI;
    
    for (let offset = -limit; offset <= limit; offset += 5) {
      const x = isHorizontal ? (angle === 0 ? limit : -limit) : offset;
      const z = isHorizontal ? offset : (angle === Math.PI / 2 ? limit : -limit);
      const groundY = getTerrainHeight(x, z);

      tempObj.position.set(x, groundY + 0.6, z);
      tempObj.rotation.set(0, 0, 0);
      tempObj.scale.set(1, 1, 1);
      tempObj.updateMatrix();
      postInstances.setMatrixAt(postIdx++, tempObj.matrix);
      
      if (offset < limit) {
        const railX = isHorizontal ? x : offset + 2.5;
        const railZ = isHorizontal ? offset + 2.5 : z;
        const railY = getTerrainHeight(railX, railZ);

        tempObj.position.set(railX, railY + 0.9, railZ);
        tempObj.rotation.set(0, isHorizontal ? Math.PI / 2 : 0, 0);
        tempObj.scale.set(1, 1, 1);
        tempObj.updateMatrix();
        railInstances.setMatrixAt(railIdx++, tempObj.matrix);
        
        tempObj.position.set(railX, railY + 0.4, railZ);
        tempObj.rotation.set(0, isHorizontal ? Math.PI / 2 : 0, 0);
        tempObj.scale.set(1, 1, 1);
        tempObj.updateMatrix();
        railInstances.setMatrixAt(railIdx++, tempObj.matrix);
      }
    }
  }
  state.scene.add(postInstances);
  state.scene.add(railInstances);

  initSceneryAssets();

  const TREE_COUNT = 50;
  const trunkInstances = new THREE.InstancedMesh(state.sharedScenery.treeTrunkGeo, state.sharedScenery.treeTrunkMat, TREE_COUNT);
  const cone1Instances = new THREE.InstancedMesh(state.sharedScenery.treeCone1Geo, state.sharedScenery.treeFoliageMat, TREE_COUNT);
  const cone2Instances = new THREE.InstancedMesh(state.sharedScenery.treeCone2Geo, state.sharedScenery.treeFoliageMat, TREE_COUNT);
  
  trunkInstances.castShadow = true;
  trunkInstances.receiveShadow = true;
  cone1Instances.castShadow = true;
  cone2Instances.castShadow = true;

  for (let i = 0; i < TREE_COUNT; i++) {
    const { x, z, groundY } = samplePosition(15);
    const scale = 0.85 + Math.random() * 0.45;
    
    tempObj.position.set(x, groundY + 2 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    trunkInstances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 4.2 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    cone1Instances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 5.6 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    cone2Instances.setMatrixAt(i, tempObj.matrix);
  }
  state.scene.add(trunkInstances);
  state.scene.add(cone1Instances);
  state.scene.add(cone2Instances);

  for (let i = 0; i < 15; i++) {
    createBoulder();
  }

  const flowerColors = ['#f43f5e', '#eab308', '#3b82f6', '#a855f7'];
  const stemInstances = new THREE.InstancedMesh(state.sharedScenery.flowerStemGeo, state.sharedScenery.flowerStemMat, 40);
  const leafInstances = new THREE.InstancedMesh(state.sharedScenery.flowerLeafGeo, state.sharedScenery.flowerStemMat, 40);
  const centerInstances = new THREE.InstancedMesh(state.sharedScenery.flowerCenterGeo, state.sharedScenery.flowerCenterMat, 40);

  stemInstances.castShadow = true;
  leafInstances.castShadow = true;
  centerInstances.castShadow = true;

  for (let i = 0; i < 40; i++) {
    const { x, z, groundY } = samplePosition();
    const scale = 0.8 + Math.random() * 0.4;
    
    tempObj.position.set(x, groundY + 0.25 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    stemInstances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 0.15 * scale, z + 0.08 * scale);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    leafInstances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 0.5 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    centerInstances.setMatrixAt(i, tempObj.matrix);
    
    const randomColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    centerInstances.setColorAt(i, new THREE.Color(randomColor));
  }
  state.scene.add(stemInstances);
  state.scene.add(leafInstances);
  state.scene.add(centerInstances);

  const grassInstances = new THREE.InstancedMesh(state.sharedScenery.grassBladeGeo, state.sharedScenery.grassTuftMat, 180);
  grassInstances.castShadow = false; // tiny blades don't contribute meaningful shadows
  let bladeIdx = 0;
  for (let i = 0; i < 60; i++) {
    const { x, z, groundY } = samplePosition();

    for (let j = 0; j < 3; j++) {
      const rotZ = (Math.random() - 0.5) * 0.4;
      const rotX = (Math.random() - 0.5) * 0.4;
      const rotY = Math.random() * Math.PI * 2;
      const scaleY = 0.8 + Math.random() * 0.4;
      
      tempObj.position.set(x, groundY, z);
      tempObj.rotation.set(rotX, rotY, rotZ);
      tempObj.scale.set(1, scaleY, 1);
      tempObj.updateMatrix();
      grassInstances.setMatrixAt(bladeIdx++, tempObj.matrix);
    }
  }
  state.scene.add(grassInstances);

  onProgress?.('Building the plaza…');
  await new Promise(r => setTimeout(r, 0));
  buildExteriorPlaza();

  onProgress?.('Constructing the building…');
  await new Promise(r => setTimeout(r, 0));
  buildBuilding();

  onProgress?.('Populating the world…');
  await new Promise(r => setTimeout(r, 0));
  buildOutdoorVenues();
  initLazyVenueLoading();  // starts polling for far landmarks (airport, castle, cave)
  buildWorldDetails();
}

/** Batcher context — bundles the museum-batch system for addMesh / addOrientedBox. */
function createBatcher(onUpperWall = null) {
  const batches = new Map();
  const tempObj = new THREE.Object3D();

  function getGeometryBatchKey(geometry) {
    const params = geometry.parameters || {};
    switch (geometry.type) {
      case 'BoxGeometry': return `Box:${params.width}:${params.height}:${params.depth}`;
      case 'PlaneGeometry': return `Plane:${params.width}:${params.height}`;
      case 'CylinderGeometry': return `Cylinder:${params.radiusTop}:${params.radiusBottom}:${params.height}:${params.radialSegments}`;
      case 'SphereGeometry': return `Sphere:${params.radius}:${params.widthSegments}:${params.heightSegments}`;
      default: return geometry.uuid;
    }
  }

  function queueMuseumMesh(geometry, material, x, y, z, rotX = 0, rotY = 0, rotZ = 0, upper = false) {
    const key = `${getGeometryBatchKey(geometry)}|${material.uuid}|${upper ? 'upper' : 'static'}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material, upper, matrices: [] };
      batches.set(key, batch);
    } else if (batch.geometry !== geometry) geometry.dispose();
    tempObj.position.set(x, y, z);
    tempObj.rotation.set(rotX, rotY, rotZ);
    tempObj.scale.set(1, 1, 1);
    tempObj.updateMatrix();
    batch.matrices.push(tempObj.matrix.clone());
  }

  function addMesh(geometry, material, x, y, z, rotX = 0, rotY = 0, rotZ = 0, upper = false) {
    queueMuseumMesh(geometry, material, x, y, z, rotX, rotY, rotZ, upper);
  }

  function addOrientedBox(width, height, depth, x, y, z, angle, material, normalX = 0, normalZ = 0, normalOffset = 0, upper = false) {
    addMesh(new THREE.BoxGeometry(width, height, depth), material, x + normalX * normalOffset, y, z + normalZ * normalOffset, 0, -angle, 0, upper);
  }

  function flush() {
    batches.forEach((batch) => {
      const instanced = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      batch.matrices.forEach((matrix, index) => instanced.setMatrixAt(index, matrix));
      instanced.instanceMatrix.needsUpdate = true;
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      state.scene.add(instanced);
      if (batch.upper && onUpperWall) onUpperWall(instanced);
    });
    batches.clear();
  }

  return { addMesh, addOrientedBox, flush };
}

export function buildBuilding() {
  const materials = createMainBuildingMaterials(state.sharedScenery);
  const {
    stoneTex,
    brickTex,
    woodTex,
    darkWoodTex,
    wallMat,
    sharedBaseboardMat,
    limestoneMat,
    limestoneShadowMat,
    bronzeMat,
    slateGlassMat,
    bannerMat,
    woodFloorMat,
    darkWoodFloorMat,
    stoneFloorMat,
    frameMat,
    screenMat
  } = materials;
  state.upperWallMat = materials.upperWallMat;

  const { pushRoof, pushUpperWall, pushUpperFloor, pushGroundFloor } =
    createBuildingFadeZone({
      id: 'main-building',
      proximity: { x: 0, z: 0, r: 68 },
      bounds: COVERED_BOUNDS,
      upperLevelThresholdY: MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
      upperWallMat: state.upperWallMat,
      getRideProgress: () => state.elevator.isRiding ? (state.elevator.rideProgress || 0) : 0,
      isRideActive: () => !!state.elevator.isRiding
    });

  const batcher = createBatcher(pushUpperWall);
  const { addMesh, addOrientedBox, flush: flushBatches } = batcher;

  // ── 1. Ground Floor ─────────────────────────────────────────────────
  buildGroundFloor(state.scene, state, materials, pushGroundFloor, pushUpperWall);

  // ── 2. Ground Floor Walls ───────────────────────────────────────────
  buildGroundWalls(state.scene, state, materials, pushUpperWall);

  // ── 3. Ground Floor Door Frames & Hallway Torches ───────────────────
  state.ROOMS.forEach((room) => {
    createDoorFrame(room.x < 0 ? -5 : 5, room.z, 'V', 4);
  });
  createDoorFrame(0, 40, 'H', 4);

  const hallwayTorchZs = [-36, -20, -2, 17, 34];
  hallwayTorchZs.forEach((z) => {
    createWallTorch(-4.75, 2.8, z, Math.PI / 2, null, true);
    createWallTorch(4.75, 2.8, z, -Math.PI / 2, null, true);
  });

  // ── 4. Ground Floor Corridor Columns ────────────────────────────────
  const columnColor = '#f1f5f9';
  const columnMat = new THREE.MeshStandardMaterial({ color: columnColor, roughness: 0.6, metalness: 0.1 });
  const columnHeight = ROOM_HEIGHT;
  const shaftHeight = columnHeight - 0.6;
  const echinusHeight = 0.3;
  const abacusHeight = 0.3;
  const shaftGeo = new THREE.CylinderGeometry(0.3, 0.38, shaftHeight, 16);
  const echinusGeo = new THREE.CylinderGeometry(0.5, 0.3, echinusHeight, 16);
  const abacusGeo = new THREE.BoxGeometry(1.1, abacusHeight, 1.1);

  function getCorridorColumnZs(doorZs, minZ = -38, maxZ = 38, clearance = 3) {
    const blockedRanges = [...doorZs].sort((a, b) => a - b).map((doorZ) => ({
      start: Math.max(minZ, doorZ - clearance), end: Math.min(maxZ, doorZ + clearance)
    }));
    const columnZs = [];
    let cursor = minZ;
    blockedRanges.forEach(({ start, end }) => {
      if (start - cursor >= 4) columnZs.push((cursor + start) / 2);
      cursor = Math.max(cursor, end);
    });
    if (maxZ - cursor >= 4) columnZs.push((cursor + maxZ) / 2);
    return columnZs;
  }

  const columnPositions = [];
  const leftDoorZs = state.ROOMS.filter((r) => r.x < 0).map((r) => r.z);
  const rightDoorZs = state.ROOMS.filter((r) => r.x > 0).map((r) => r.z);
  getCorridorColumnZs(leftDoorZs).forEach((z) => columnPositions.push({ x: -4.2, z }));
  getCorridorColumnZs(rightDoorZs).forEach((z) => columnPositions.push({ x: 4.2, z }));
  [-3.5, -1.5, 1.5, 3.5].forEach((x) => columnPositions.push({ x, z: 40.8 }));

  const perimSpacing = 7, perimOffset = -0.3;
  function addPerimeterCol(x, z) {
    if (!columnPositions.some(p => Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01)) {
      columnPositions.push({ x, z });
    }
  }
  for (let x = -28; x <= 28; x += perimSpacing) { if (Math.abs(x) > 4) addPerimeterCol(x, 40 + perimOffset); }
  for (let x = -28; x <= 28; x += perimSpacing) { addPerimeterCol(x, -40 - perimOffset); }
  for (let z = -35; z <= 35; z += perimSpacing) { addPerimeterCol(-30 - perimOffset, z); }
  for (let z = -35; z <= 35; z += perimSpacing) { addPerimeterCol(30 + perimOffset, z); }

  const totalColumns = columnPositions.length;
  const shaftInstances = new THREE.InstancedMesh(shaftGeo, columnMat, totalColumns);
  const echinusInstances = new THREE.InstancedMesh(echinusGeo, columnMat, totalColumns);
  const abacusInstances = new THREE.InstancedMesh(abacusGeo, columnMat, totalColumns);
  shaftInstances.castShadow = true; shaftInstances.receiveShadow = true;
  echinusInstances.castShadow = true; echinusInstances.receiveShadow = true;
  abacusInstances.castShadow = true; abacusInstances.receiveShadow = true;

  const tempObj = new THREE.Object3D();
  for (let i = 0; i < totalColumns; i++) {
    const pos = columnPositions[i];
    tempObj.position.set(pos.x, shaftHeight / 2, pos.z);
    tempObj.updateMatrix(); shaftInstances.setMatrixAt(i, tempObj.matrix);
    tempObj.position.set(pos.x, shaftHeight + echinusHeight / 2, pos.z);
    tempObj.updateMatrix(); echinusInstances.setMatrixAt(i, tempObj.matrix);
    tempObj.position.set(pos.x, shaftHeight + echinusHeight + abacusHeight / 2, pos.z);
    tempObj.updateMatrix(); abacusInstances.setMatrixAt(i, tempObj.matrix);
  }
  state.scene.add(shaftInstances);
  state.scene.add(echinusInstances);
  state.scene.add(abacusInstances);

  // ── 5. Ground Floor Ceiling ─────────────────────────────────────────
  state.ceilingMat = makeFadeMaterial(new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9, depthWrite: true }));
  const ceilingGeo = new THREE.PlaneGeometry(60, 80);
  state.ceilingMesh = new THREE.Mesh(ceilingGeo, state.ceilingMat);
  state.ceilingMesh.rotation.x = HALF_PI;
  state.ceilingMesh.position.set(0, ROOM_HEIGHT + 0.1, 0);
  state.ceilingMesh.castShadow = true;
  state.ceilingMesh.receiveShadow = true;
  state.scene.add(state.ceilingMesh);
  pushRoof(state.ceilingMesh);

  // ── 6. Animated Opulent Elevator ───────────────────────────────────
  state.elevator = buildElevator(state.scene, materials);
  state.WALLS.push(state.elevator.doorBox);

  // Elevator collision
  const collHalfW = MAIN_BUILDING_ELEVATOR_W / 2 - 0.2;
  const collHalfD = MAIN_BUILDING_ELEVATOR_D / 2 - 0.2;
  const collH = MAIN_BUILDING_ELEVATOR_H;
  const eZ = MAIN_BUILDING_ELEVATOR_Z;
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(-collHalfW, 0, eZ - collHalfD - 0.05),
    new THREE.Vector3(collHalfW, collH, eZ - collHalfD + 0.05)
  ));
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(-collHalfW - 0.05, 0, eZ - collHalfD),
    new THREE.Vector3(-collHalfW + 0.05, collH, eZ + collHalfD)
  ));
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(collHalfW - 0.05, 0, eZ - collHalfD),
    new THREE.Vector3(collHalfW + 0.05, collH, eZ + collHalfD)
  ));

  // ── 7. Upper Floor Walls ───────────────────────────────────────────
  buildUpperWalls(state.scene, state, materials, pushUpperFloor);

  // ── 8. Upper Floor structure & items ───────────────────────────────
  buildUpperFloor(state.scene, state, materials, pushUpperFloor);

  // ── 9. Upper Facade & Portico ──────────────────────────────────────
  const upperFloorHeight = 3.3;
  const secondFloorY = ROOM_HEIGHT;
  const entablatureY = secondFloorY + upperFloorHeight + 0.35;
  const corniceThickness = 0.72;

  function addFacadeBand(xStart, zStart, xEnd, zEnd, y, height, depth, material, normalX, normalZ) {
    const { len, angle } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
    if (len < 0.01) return;
    addOrientedBox(len, height, depth, (xStart + xEnd) / 2, y, (zStart + zEnd) / 2, angle, material, normalX, normalZ, depth * 0.35, true);
  }

  function addBanner(x, z, rotY) {
    addMesh(new THREE.PlaneGeometry(3.2, 4.8), bannerMat, x, secondFloorY + 1.75, z, 0, rotY, 0, true);
    const rodDepth = 0.18;
    const rodOffsetX = Math.sin(rotY) * rodDepth * 0.5;
    const rodOffsetZ = Math.cos(rotY) * rodDepth * 0.5;
    addMesh(new THREE.BoxGeometry(3.55, 0.12, 0.16), bronzeMat, x + rodOffsetX, secondFloorY + 4.15, z + rodOffsetZ, 0, rotY, 0, true);
    addMesh(new THREE.BoxGeometry(3.55, 0.12, 0.16), bronzeMat, x + rodOffsetX, secondFloorY - 0.65, z + rodOffsetZ, 0, rotY, 0, true);
  }

  function buildUpperFacade(xStart, zStart, xEnd, zEnd, normalX, normalZ, decorative = true) {
    const { len, angle } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
    if (len < 0.01) return;
    const dx = xEnd - xStart;
    const dz = zEnd - zStart;
    const segments = Math.max(1, Math.floor(len / 5));
    const segLen = len / segments;
    const thickness = 0.5;
    const tangentX = dx / len;
    const tangentZ = dz / len;
    const windowHeight = decorative ? 2.05 : 1.8;
    const windowWidth = decorative ? Math.min(3.1, segLen - 1.15) : 2.4;
    const pilasterWidth = decorative ? 0.38 : 0.24;

    for (let s = 0; s < segments; s++) {
      const t0 = s / segments;
      const t1 = (s + 1) / segments;
      const sx = xStart + dx * t0, sz = zStart + dz * t0;
      const ex = xStart + dx * t1, ez = zStart + dz * t1;
      const mx = (sx + ex) / 2, mz = (sz + ez) / 2;

      addOrientedBox(segLen - 0.6, upperFloorHeight, thickness, mx, secondFloorY + upperFloorHeight / 2, mz, angle, decorative ? limestoneMat : state.upperWallMat, normalX, normalZ, 0, true);

      if (decorative) {
        addOrientedBox(pilasterWidth, upperFloorHeight + 0.2, thickness + 0.24, sx + tangentX * 0.22, secondFloorY + upperFloorHeight / 2, sz + tangentZ * 0.22, angle, limestoneShadowMat, normalX, normalZ, 0.12, true);
        addOrientedBox(pilasterWidth, upperFloorHeight + 0.2, thickness + 0.24, ex - tangentX * 0.22, secondFloorY + upperFloorHeight / 2, ez - tangentZ * 0.22, angle, limestoneShadowMat, normalX, normalZ, 0.12, true);
      }

      addOrientedBox(windowWidth + 0.7, windowHeight + 0.55, thickness + 0.16, mx, secondFloorY + upperFloorHeight * 0.54, mz, angle, limestoneShadowMat, normalX, normalZ, 0.08, true);
      addOrientedBox(windowWidth, windowHeight, thickness + 0.08, mx, secondFloorY + upperFloorHeight * 0.54, mz, angle, slateGlassMat, normalX, normalZ, 0.16, true);
      addOrientedBox(windowWidth + 0.95, 0.18, thickness + 0.3, mx, secondFloorY + 0.6, mz, angle, limestoneShadowMat, normalX, normalZ, 0.18, true);
      addOrientedBox(windowWidth + 1.05, 0.22, thickness + 0.34, mx, secondFloorY + upperFloorHeight - 0.4, mz, angle, limestoneShadowMat, normalX, normalZ, 0.2, true);
      addOrientedBox(0.16, windowHeight + 0.12, thickness + 0.18, mx - tangentX * windowWidth * 0.24, secondFloorY + upperFloorHeight * 0.54, mz - tangentZ * windowWidth * 0.24, angle, bronzeMat, normalX, normalZ, 0.2, true);
      addOrientedBox(0.16, windowHeight + 0.12, thickness + 0.18, mx + tangentX * windowWidth * 0.24, secondFloorY + upperFloorHeight * 0.54, mz + tangentZ * windowWidth * 0.24, angle, bronzeMat, normalX, normalZ, 0.2, true);
      addOrientedBox(windowWidth + 0.15, 0.12, thickness + 0.18, mx, secondFloorY + upperFloorHeight * 0.54, mz, angle, bronzeMat, normalX, normalZ, 0.2, true);
    }
  }

  buildUpperFacade(BLDG_X_MIN, BLDG_Z_MIN, BLDG_X_MAX, BLDG_Z_MIN, 0, -1, true);
  buildUpperFacade(BLDG_X_MIN, BLDG_Z_MAX, BLDG_X_MAX, BLDG_Z_MAX, 0, 1, true);
  buildUpperFacade(BLDG_X_MIN, BLDG_Z_MIN, BLDG_X_MIN, BLDG_Z_MAX, -1, 0, true);
  buildUpperFacade(BLDG_X_MAX, BLDG_Z_MIN, BLDG_X_MAX, BLDG_Z_MAX, 1, 0, true);

  addFacadeBand(BLDG_X_MIN, BLDG_Z_MIN, BLDG_X_MAX, BLDG_Z_MIN, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, 0, -1);
  addFacadeBand(BLDG_X_MIN, BLDG_Z_MAX, BLDG_X_MAX, BLDG_Z_MAX, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, 0, 1);
  addFacadeBand(BLDG_X_MIN, BLDG_Z_MIN, BLDG_X_MIN, BLDG_Z_MAX, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, -1, 0);
  addFacadeBand(BLDG_X_MAX, BLDG_Z_MIN, BLDG_X_MAX, BLDG_Z_MAX, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, 1, 0);
  addFacadeBand(BLDG_X_MIN, BLDG_Z_MIN, BLDG_X_MAX, BLDG_Z_MIN, entablatureY, 0.6, corniceThickness, limestoneMat, 0, -1);
  addFacadeBand(BLDG_X_MIN, BLDG_Z_MAX, BLDG_X_MAX, BLDG_Z_MAX, entablatureY, 0.6, corniceThickness, limestoneMat, 0, 1);
  addFacadeBand(BLDG_X_MIN, BLDG_Z_MIN, BLDG_X_MIN, BLDG_Z_MAX, entablatureY, 0.6, corniceThickness, limestoneMat, -1, 0);
  addFacadeBand(BLDG_X_MAX, BLDG_Z_MIN, BLDG_X_MAX, BLDG_Z_MAX, entablatureY, 0.6, corniceThickness, limestoneMat, 1, 0);

  [-25.5, 25.5].forEach((x) => {
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, x, secondFloorY + upperFloorHeight / 2 + 0.2, BLDG_Z_MIN, 0, limestoneShadowMat, 0, -1, 0.32, true);
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, x, secondFloorY + upperFloorHeight / 2 + 0.2, BLDG_Z_MAX, 0, limestoneShadowMat, 0, 1, 0.32, true);
  });
  [-35.5, 35.5].forEach((z) => {
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, BLDG_X_MIN, secondFloorY + upperFloorHeight / 2 + 0.2, z, Math.PI / 2, limestoneShadowMat, -1, 0, 0.32, true);
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, BLDG_X_MAX, secondFloorY + upperFloorHeight / 2 + 0.2, z, Math.PI / 2, limestoneShadowMat, 1, 0, 0.32, true);
  });

  addBanner(-17.5, 40, 0);
  addBanner(17.5, 40, 0);

  const porticoFriezeZ = 41.15;
  addMesh(new THREE.BoxGeometry(13.8, 0.85, 1.55), limestoneMat, 0, ROOM_HEIGHT + 0.55, porticoFriezeZ, 0, 0, 0, true);
  addMesh(new THREE.BoxGeometry(9.6, 0.22, 0.18), bronzeMat, 0, ROOM_HEIGHT + 0.55, porticoFriezeZ + 0.82, 0, 0, 0, true);
  addMesh(new THREE.BoxGeometry(14.6, 0.32, 1.75), limestoneShadowMat, 0, ROOM_HEIGHT + 1.07, porticoFriezeZ, 0, 0, 0, true);
  addMesh(new THREE.BoxGeometry(7.3, 0.28, 1.4), limestoneMat, -2.92, ROOM_HEIGHT + 1.74, porticoFriezeZ - 0.02, 0, 0, 0.34, true);
  addMesh(new THREE.BoxGeometry(7.3, 0.28, 1.4), limestoneMat, +2.92, ROOM_HEIGHT + 1.74, porticoFriezeZ - 0.02, 0, 0, -0.34, true);
  flushBatches();

  // ── 10. Roof ────────────────────────────────────────────────────────
  buildRoof(batcher, { limestoneMat, bronzeMat, limestoneShadowMat }, { entablatureY, registerRoofMesh: pushRoof });
}

export { createDoorFrame } from './building/doors.js';
export { buildClassroomAssets } from './building/interiors.js';
export { createWallTorch } from './building/torches.js';
export { buildUpperFloorFurnishings } from './building/upstairs.js';
