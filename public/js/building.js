// Building Construction, Architecture, and Scenery Population for Metalyceum
import * as THREE from 'three';
import { state } from './state.js';
import { ROOM_HEIGHT, MAP_SIZE, WORLD_CONFIG, ROOM_LAYOUTS } from './config.js';
import { getTerrainHeight } from './physics.js';
import { vec2LengthAngle, samplePosition } from './scenery/utils.js';
import {
  initSceneryAssets,
  createBoulder,
  createRoomIndicator,
  buildExteriorPlaza,
  buildRoomInteriorSet,
  buildOutdoorVenues,
  buildWorldDetails,
  registerStaticScenery,
  refreshStaticSceneryVisibility
} from './scenery.js';
import {
  createGrassTexture, createBrickTexture,
  createStoneTexture, createWoodTexture, createSignBoardTexture,
  createMarbleTileTexture
} from './textures.js';

import { createDoorFrame } from './building/doors.js';
import { buildClassroomAssets } from './building/interiors.js';
import { createWallTorch } from './building/torches.js';
import { buildRoof } from './building/roof.js';

export function syncSelectedAssetFromObject() {
  const customEvent = new CustomEvent('sync-selected-asset-object');
  window.dispatchEvent(customEvent);
}

export function buildMap() {
  const grassTex = createGrassTexture();
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 550, 550);
  
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
  ground.rotation.x = -Math.PI / 2;
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
  grassInstances.castShadow = true;
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

  buildExteriorPlaza();
  buildBuilding();
  buildOutdoorVenues();
  buildWorldDetails();
}

/** Batcher context — bundles the museum-batch system for addMesh / addOrientedBox. */
function createBatcher() {
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
      if (batch.upper) state.upperWalls.push(instanced);
    });
    batches.clear();
  }

  return { addMesh, addOrientedBox, flush };
}

export function buildBuilding() {
  const stoneTex = createStoneTexture();
  const brickTex = createBrickTexture();
  const woodTex = createWoodTexture();
  
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  state.upperWallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85, transparent: true, opacity: 1.0 });
  const limestoneMat = state.sharedScenery.limestoneMat;
  const limestoneShadowMat = new THREE.MeshStandardMaterial({ color: '#cabfaa', roughness: 0.8 });
  const bronzeMat = state.sharedScenery.bronzeMat;
  const slateGlassMat = new THREE.MeshStandardMaterial({
    color: '#162235',
    roughness: 0.18,
    metalness: 0.08,
    transparent: true,
    opacity: 0.96
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: WORLD_CONFIG.exteriorAccent,
    roughness: 0.65,
    metalness: 0.08,
    side: THREE.DoubleSide
  });
  
  const woodFloorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.35, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const stoneFloorMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const frameMat = state.sharedScenery.frameMat;
  const screenMat = state.sharedScenery.screenMat;

  const batcher = createBatcher();
  const { addMesh, addOrientedBox, flush: flushBatches } = batcher;

  state.ROOMS.forEach((room) => {
    const isWood = room.id % 2 === 0;
    const mat = isWood ? woodFloorMat : stoneFloorMat;
    const roomFloorGeo = new THREE.PlaneGeometry(room.width, room.depth);
    const roomFloor = new THREE.Mesh(roomFloorGeo, mat);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(room.x, 0.005, room.z);
    roomFloor.receiveShadow = true;
    state.scene.add(roomFloor);

    buildRoomInteriorSet(room);
  });

  // ── Grand wood-floored atrium ──────────────────────────────────────────
  const lobbyFloorGeo = new THREE.PlaneGeometry(10, 80);
  const lobbyFloor = new THREE.Mesh(lobbyFloorGeo, woodFloorMat);
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.position.set(0, 0.015, 0);
  lobbyFloor.receiveShadow = true;
  state.scene.add(lobbyFloor);

  // Decorative border strip around the lobby floor edge
  const lobbyBorderMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.6, metalness: 0.08 });
  const lobbyBorder = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 80.2), lobbyBorderMat);
  lobbyBorder.rotation.x = -Math.PI / 2;
  lobbyBorder.position.set(0, 0.012, 0);
  state.scene.add(lobbyBorder);

  // Entrance medallion — a dark circular accent at the main door (z=40)
  const medallionMat = new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.7, metalness: 0.05 });
  const medallion = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), medallionMat);
  medallion.rotation.x = -Math.PI / 2;
  medallion.position.set(0, 0.018, 38);
  state.scene.add(medallion);

  const medallionRing = new THREE.Mesh(
    new THREE.RingGeometry(1.75, 2.0, 24),
    new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.5, metalness: 0.1 })
  );
  medallionRing.rotation.x = -Math.PI / 2;
  medallionRing.position.set(0, 0.019, 38);
  state.scene.add(medallionRing);

  // ── Entrance threshold & stone landing ─────────────────────────────────
  const landingMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.72, metalness: 0.06, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const landingStep = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.10, 3.2), landingMat);
  landingStep.position.set(0, 0.07, 41.6);
  landingStep.receiveShadow = true;
  landingStep.castShadow = true;
  state.scene.add(landingStep);

  const trimBorderMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.5, metalness: 0.3 });
  const trimBorder = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.04, 3.3), trimBorderMat);
  trimBorder.position.set(0, 0.04, 41.6);
  state.scene.add(trimBorder);

  const sill = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.8), landingMat);
  sill.position.set(0, 0.05, 40.2);
  sill.receiveShadow = true;
  state.scene.add(sill);

  const marbleTex = createMarbleTileTexture();
  const marbleMat = new THREE.MeshStandardMaterial({ map: marbleTex, color: '#ede8dc', roughness: 0.12, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  const innerFoyer = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 5.2), marbleMat);
  innerFoyer.rotation.x = -Math.PI / 2;
  innerFoyer.position.set(0, 0.025, 37.4);
  innerFoyer.receiveShadow = true;
  state.scene.add(innerFoyer);

  const porticoFoyer = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 5.0), marbleMat);
  porticoFoyer.rotation.x = -Math.PI / 2;
  porticoFoyer.position.set(0, 0.125, 42.5);
  porticoFoyer.receiveShadow = true;
  state.scene.add(porticoFoyer);

  const carpetMat = new THREE.MeshStandardMaterial({ color: '#7a1a1a', roughness: 0.75, metalness: 0.02, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const borderMat = new THREE.MeshStandardMaterial({ color: '#b8860b', roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });

  const carpetExterior = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), carpetMat);
  carpetExterior.rotation.x = -Math.PI / 2;
  carpetExterior.position.set(0, 0.12, 41.0);
  carpetExterior.receiveShadow = true;
  state.scene.add(carpetExterior);

  [-1.6, 1.6].forEach((xOff) => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 2.0), borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(xOff, 0.121, 41.0);
    state.scene.add(border);
  });

  const carpetInterior = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 78), carpetMat);
  carpetInterior.rotation.x = -Math.PI / 2;
  carpetInterior.position.set(0, 0.03, 0);
  carpetInterior.receiveShadow = true;
  state.scene.add(carpetInterior);

  [-1.6, 1.6].forEach((xOff) => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 78), borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(xOff, 0.031, 0);
    state.scene.add(border);
  });

  [-1, 1].forEach((zOff) => {
    const endCap = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.06), borderMat);
    endCap.rotation.x = -Math.PI / 2;
    endCap.position.set(0, 0.031, zOff * 39);
    state.scene.add(endCap);
  });

  function addWallSegment(xStart, zStart, xEnd, zEnd, height = ROOM_HEIGHT) {
    const { len, angle } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
    if (len < 0.01) return;
    
    const thickness = 0.5;
    const lowerHeight = 3.5;
    const upperHeight = height - lowerHeight;
    
    const lowerGeo = new THREE.BoxGeometry(len, lowerHeight, thickness);
    const lowerWall = new THREE.Mesh(lowerGeo, wallMat);
    lowerWall.position.set((xStart + xEnd) / 2, lowerHeight / 2, (zStart + zEnd) / 2);
    lowerWall.rotation.y = -angle;
    lowerWall.castShadow = true;
    lowerWall.receiveShadow = true;
    state.scene.add(lowerWall);
    
    if (upperHeight > 0.05) {
      const upperGeo = new THREE.BoxGeometry(len, upperHeight, thickness);
      const upperWall = new THREE.Mesh(upperGeo, state.upperWallMat);
      upperWall.position.set((xStart + xEnd) / 2, lowerHeight + upperHeight / 2, (zStart + zEnd) / 2);
      upperWall.rotation.y = -angle;
      upperWall.castShadow = true;
      upperWall.receiveShadow = true;
      state.scene.add(upperWall);
      state.upperWalls.push(upperWall);
    }
    
    const baseboardHeight = 0.35;
    const baseboardThickness = 0.08;
    const baseboardGeo = new THREE.BoxGeometry(len, baseboardHeight, baseboardThickness);
    const baseboardMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9 });
    
    const baseboard1 = new THREE.Mesh(baseboardGeo, baseboardMat);
    baseboard1.position.set(0, -lowerHeight / 2 + baseboardHeight / 2, thickness / 2 + baseboardThickness / 2);
    baseboard1.castShadow = true;
    baseboard1.receiveShadow = true;
    lowerWall.add(baseboard1);
    
    const baseboard2 = new THREE.Mesh(baseboardGeo, baseboardMat);
    baseboard2.position.set(0, -lowerHeight / 2 + baseboardHeight / 2, -thickness / 2 - baseboardThickness / 2);
    baseboard2.castShadow = true;
    baseboard2.receiveShadow = true;
    lowerWall.add(baseboard2);

    lowerWall.updateWorldMatrix(true, false);
    state.WALLS.push(new THREE.Box3().setFromObject(lowerWall));
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

  state.ROOMS.forEach((room) => {
    createDoorFrame(room.x < 0 ? -5 : 5, room.z, 'V', 4);
  });
  createDoorFrame(0, 40, 'H', 4);

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
  addPerimeterCol(-30 - perimOffset, -40 - perimOffset);
  addPerimeterCol(30 + perimOffset, -40 - perimOffset);
  addPerimeterCol(-30 - perimOffset, 40 + perimOffset);
  addPerimeterCol(30 + perimOffset, 40 + perimOffset);
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

  state.ROOMS.forEach((room) => {
    if (room.id >= 8) return;
    const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
    const screenGroup = new THREE.Group();
    const screenWallOffset = 0.22;
    const outerGeo = new THREE.BoxGeometry(7, 4, 0.2);
    const outerFrame = new THREE.Mesh(outerGeo, frameMat);
    outerFrame.castShadow = true;
    screenGroup.add(outerFrame);
    const innerGeo = new THREE.BoxGeometry(6.6, 3.6, 0.05);
    const innerScreenMat = screenMat.clone();
    const innerScreen = new THREE.Mesh(innerGeo, innerScreenMat);
    innerScreen.position.z = 0.1;
    innerScreen.userData = { roomId: room.id };
    state.clickableScreens.push(innerScreen);
    state.roomScreens.set(room.id, {
      material: innerScreenMat, baseColor: innerScreenMat.color.clone(), baseEmissive: innerScreenMat.emissive.clone()
    });
    screenGroup.add(innerScreen);
    const borderMat = new THREE.MeshBasicMaterial({ color: layout.themeColor, wireframe: true });
    const screenBorder = new THREE.Mesh(innerGeo, borderMat);
    screenBorder.position.z = 0.11;
    screenBorder.scale.set(1.02, 1.02, 1.02);
    screenGroup.add(screenBorder);
    if (room.x < 0) {
      screenGroup.position.set(room.x - room.width / 2 + screenWallOffset, 3.5, room.z);
      screenGroup.rotation.y = Math.PI / 2;
    } else {
      screenGroup.position.set(room.x + room.width / 2 - screenWallOffset, 3.5, room.z);
      screenGroup.rotation.y = -Math.PI / 2;
    }
    state.scene.add(screenGroup);
    createWallTorch(room.x < 0 ? room.x - room.width / 2 + 0.25 : room.x + room.width / 2 - 0.25, 2.5, room.z - 4, room.x < 0 ? Math.PI / 2 : -Math.PI / 2, room.id, true);
    createWallTorch(room.x < 0 ? room.x - room.width / 2 + 0.25 : room.x + room.width / 2 - 0.25, 2.5, room.z + 4, room.x < 0 ? Math.PI / 2 : -Math.PI / 2, room.id, false);
    createRoomIndicator(room);
  });

  state.ceilingMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9, transparent: true, opacity: 1.0, depthWrite: true });
  state.roofMeshes = [];
  const ceilingGeo = new THREE.PlaneGeometry(60, 82);
  state.ceilingMesh = new THREE.Mesh(ceilingGeo, state.ceilingMat);
  state.ceilingMesh.rotation.x = Math.PI / 2;
  state.ceilingMesh.position.set(0, ROOM_HEIGHT + 0.1, 0);
  state.ceilingMesh.castShadow = true;
  state.ceilingMesh.receiveShadow = true;
  state.scene.add(state.ceilingMesh);

  buildClassroomAssets();

  const signTex = createSignBoardTexture();
  state.signFrontMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, transparent: true, opacity: 1.0 });
  state.signSideMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8, transparent: true, opacity: 1.0 });
  const signMaterials = [state.signSideMat, state.signSideMat, state.signSideMat, state.signSideMat, state.signFrontMat, state.signSideMat];
  const signGeo = new THREE.BoxGeometry(10.5, 1.4, 0.1);
  const signMesh = new THREE.Mesh(signGeo, signMaterials);
  signMesh.position.set(0, 4.4, 41.5);
  signMesh.castShadow = true;
  signMesh.receiveShadow = true;
  state.scene.add(signMesh);
  state.upperWalls.push(signMesh);

  const upperFloorHeight = 3.3;
  const secondFloorY = ROOM_HEIGHT;
  const entablatureY = secondFloorY + upperFloorHeight + 0.35;
  const corniceThickness = 0.72;

  function addFacadeBand(xStart, zStart, xEnd, zEnd, y, height, depth, material, normalX, normalZ) {
    const { len, angle } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
    if (len < 0.01) return;
    addOrientedBox(len + 1.1, height, depth, (xStart + xEnd) / 2, y, (zStart + zEnd) / 2, angle, material, normalX, normalZ, depth * 0.35, true);
  }

  function addBanner(x, z, rotY) {
    addMesh(new THREE.PlaneGeometry(3.2, 4.8), bannerMat, x, secondFloorY + 1.75, z, 0, rotY, 0, true);
    const rodDepth = 0.18;
    const rodOffsetX = Math.sin(rotY) * rodDepth * 0.5;
    const rodOffsetZ = Math.cos(rotY) * rodDepth * 0.5;
    addMesh(new THREE.BoxGeometry(3.55, 0.12, 0.16), bronzeMat, x + rodOffsetX, secondFloorY + 4.15, z + rodOffsetZ, 0, rotY, 0, true);
    addMesh(new THREE.BoxGeometry(3.55, 0.12, 0.16), bronzeMat, x + rodOffsetX, secondFloorY - 0.65, z + rodOffsetZ, 0, rotY, 0, true);
  }

  function addAcroterion(x, z) {
    addMesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), limestoneMat, x, entablatureY + 0.15, z, 0, 0, 0, true);
    addMesh(new THREE.CylinderGeometry(0.18, 0.26, 0.55, 12), bronzeMat, x, entablatureY + 0.58, z, 0, 0, 0, true);
    addMesh(new THREE.SphereGeometry(0.22, 12, 10), bronzeMat, x, entablatureY + 0.95, z, 0, 0, 0, true);
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

      if (decorative && normalZ > 0.9 && Math.abs(mx) < 7.6) {
        const railZ = mz + normalZ * 0.72;
        addMesh(new THREE.BoxGeometry(3.8, 0.16, 0.16), bronzeMat, mx, secondFloorY + 0.9, railZ, 0, 0, 0, true);
        addMesh(new THREE.BoxGeometry(3.8, 0.16, 0.16), bronzeMat, mx, secondFloorY + 1.55, railZ, 0, 0, 0, true);
        [-1.45, -0.7, 0, 0.7, 1.45].forEach((offset) => {
          addMesh(new THREE.BoxGeometry(0.12, 0.72, 0.12), bronzeMat, mx + offset, secondFloorY + 1.22, railZ, 0, 0, 0, true);
        });
      }
    }
  }

  buildUpperFacade(-30, -40, 30, -40, 0, -1, true);
  buildUpperFacade(-30, 40, 30, 40, 0, 1, true);
  buildUpperFacade(-30, -40, -30, 40, -1, 0, true);
  buildUpperFacade(30, -40, 30, 40, 1, 0, true);
  buildUpperFacade(-5, -40, -5, 40, -1, 0, false);
  buildUpperFacade(5, -40, 5, 40, 1, 0, false);

  addFacadeBand(-30, -40, 30, -40, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, 0, -1);
  addFacadeBand(-30, 40, 30, 40, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, 0, 1);
  addFacadeBand(-30, -40, -30, 40, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, -1, 0);
  addFacadeBand(30, -40, 30, 40, secondFloorY + 0.28, 0.26, 0.8, limestoneShadowMat, 1, 0);
  addFacadeBand(-30, -40, 30, -40, entablatureY, 0.6, corniceThickness, limestoneMat, 0, -1);
  addFacadeBand(-30, 40, 30, 40, entablatureY, 0.6, corniceThickness, limestoneMat, 0, 1);
  addFacadeBand(-30, -40, -30, 40, entablatureY, 0.6, corniceThickness, limestoneMat, -1, 0);
  addFacadeBand(30, -40, 30, 40, entablatureY, 0.6, corniceThickness, limestoneMat, 1, 0);

  [-25.5, 25.5].forEach((x) => {
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, x, secondFloorY + upperFloorHeight / 2 + 0.2, -40, 0, limestoneShadowMat, 0, -1, 0.32, true);
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, x, secondFloorY + upperFloorHeight / 2 + 0.2, 40, 0, limestoneShadowMat, 0, 1, 0.32, true);
  });
  [-35.5, 35.5].forEach((z) => {
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, -30, secondFloorY + upperFloorHeight / 2 + 0.2, z, Math.PI / 2, limestoneShadowMat, -1, 0, 0.32, true);
    addOrientedBox(1.2, upperFloorHeight + 1.0, 0.95, 30, secondFloorY + upperFloorHeight / 2 + 0.2, z, Math.PI / 2, limestoneShadowMat, 1, 0, 0.32, true);
  });

  addBanner(-17.5, 40.62, 0);
  addBanner(17.5, 40.62, 0);

  const porticoFriezeZ = 41.15;
  addMesh(new THREE.BoxGeometry(13.8, 0.85, 1.55), limestoneMat, 0, ROOM_HEIGHT + 0.55, porticoFriezeZ, 0, 0, 0, true);
  addMesh(new THREE.BoxGeometry(9.6, 0.22, 0.18), bronzeMat, 0, ROOM_HEIGHT + 0.55, porticoFriezeZ + 0.82, 0, 0, 0, true);
  addMesh(new THREE.BoxGeometry(14.6, 0.32, 1.75), limestoneShadowMat, 0, ROOM_HEIGHT + 1.07, porticoFriezeZ, 0, 0, 0, true);
  addMesh(new THREE.BoxGeometry(7.3, 0.28, 1.4), limestoneMat, -2.92, ROOM_HEIGHT + 1.74, porticoFriezeZ - 0.02, 0, 0, 0.34, true);
  addMesh(new THREE.BoxGeometry(7.3, 0.28, 1.4), limestoneMat, 2.92, ROOM_HEIGHT + 1.74, porticoFriezeZ - 0.02, 0, 0, -0.34, true);
  addMesh(new THREE.BoxGeometry(5.2, 0.2, 1.1), limestoneShadowMat, 0, ROOM_HEIGHT + 1.55, porticoFriezeZ - 0.18, 0, 0, 0, true);
  addMesh(new THREE.BoxGeometry(0.55, 1.0, 0.55), bronzeMat, 0, ROOM_HEIGHT + 1.95, porticoFriezeZ - 0.22, 0, 0, 0, true);

  addAcroterion(-29.2, -39.2);
  addAcroterion(29.2, -39.2);
  addAcroterion(-29.2, 39.2);
  addAcroterion(29.2, 39.2);
  flushBatches();

  buildRoof(batcher, { limestoneMat, bronzeMat, limestoneShadowMat }, { entablatureY });
}

export { createDoorFrame } from './building/doors.js';
export { buildClassroomAssets } from './building/interiors.js';
export { createWallTorch } from './building/torches.js';
