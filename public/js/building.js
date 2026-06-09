// Building Construction, Architecture, and Scenery Population for Metalyceum
import * as THREE from 'three';
import { state } from './state.js';
import {
  ROOM_HEIGHT,
  MAP_SIZE,
  WORLD_CONFIG,
  ROOM_LAYOUTS,
  COVERED_BOUNDS,
  MAIN_BUILDING_ELEVATOR_GROUND_Y,
  MAIN_BUILDING_MEZZANINE_Y,
  MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
  MAIN_BUILDING_ELEVATOR_Z,
  MAIN_BUILDING_ELEVATOR_W,
  MAIN_BUILDING_ELEVATOR_D,
  MAIN_BUILDING_ELEVATOR_H,
  MAIN_BUILDING_ELEVATOR_FRONT_Z
} from './config.js';
import { getTerrainHeight } from './physics.js';
import { HALF_PI, FLAT } from './math.js';
import { vec2LengthAngle, samplePosition, createFloor } from './scenery/utils.js';
import {
  createBuildingFadeZone,
  makeFadeMaterial,
  makeObjectFadeable,
  resetFadeZones
} from './fade-system.js';
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
  createMarbleTileTexture, createDarkWoodTexture
} from './textures.js';

import { createDoorFrame } from './building/doors.js';
import { buildClassroomAssets } from './building/interiors.js';
import { createWallTorch } from './building/torches.js';
import { buildRoof } from './building/roof.js';


// Named building extents — aliased from COVERED_BOUNDS in config.js
const BLDG_X_MIN = COVERED_BOUNDS.minX;
const BLDG_X_MAX = COVERED_BOUNDS.maxX;
const BLDG_Z_MIN = COVERED_BOUNDS.minZ;
const BLDG_Z_MAX = COVERED_BOUNDS.maxZ;

/**
 * Creates and registers a standard interactive room screen group.
 * Used for both ground-floor and upper-floor rooms to avoid duplication.
 *
 * @param {object} room        - room definition from state.ROOMS
 * @param {object} frameMat    - THREE.Material for the outer frame
 * @param {object} screenMat   - THREE.Material prototype to clone for the screen
 * @param {number} screenY     - world Y position for the screen center
 * @param {number} wallOffset  - distance from the inner wall face to the screen
 * @param {object[]|null} upperFloorArr - if non-null, push group into this array too
 * @returns {THREE.Group} the screen group (already added to scene)
 */
function buildRoomScreen(room, frameMat, screenMat, screenY, wallOffset = 0.22, upperFloorArr = null) {
  const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
  const screenGroup = new THREE.Group();

  const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.2), frameMat);
  outerFrame.castShadow = true;
  screenGroup.add(outerFrame);

  const innerGeo = new THREE.BoxGeometry(6.6, 3.6, 0.05);
  const innerScreenMat = screenMat.clone();
  const innerScreen = new THREE.Mesh(innerGeo, innerScreenMat);
  innerScreen.position.z = 0.1;
  innerScreen.userData = { roomId: room.id };
  state.clickableScreens.push(innerScreen);
  state.roomScreens.set(room.id, {
    material: innerScreenMat,
    baseColor: innerScreenMat.color.clone(),
    baseEmissive: innerScreenMat.emissive.clone()
  });
  screenGroup.add(innerScreen);

  const screenBorder = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({ color: layout.themeColor, wireframe: true }));
  screenBorder.position.z = 0.11;
  screenBorder.scale.set(1.02, 1.02, 1.02);
  screenGroup.add(screenBorder);

  if (room.x < 0) {
    screenGroup.position.set(room.x - room.width / 2 + wallOffset, screenY, room.z);
    screenGroup.rotation.y = Math.PI / 2;
  } else {
    screenGroup.position.set(room.x + room.width / 2 - wallOffset, screenY, room.z);
    screenGroup.rotation.y = -Math.PI / 2;
  }

  state.scene.add(screenGroup);
  if (upperFloorArr) {
    if (typeof upperFloorArr === 'function') upperFloorArr(screenGroup);
    else upperFloorArr.push(screenGroup);
  }
  return screenGroup;
}

export function buildMap() {
  // Guard against double-build — if reinitialized, the old scene would leak
  // geometries, materials, and textures. Currently only called once from initEngine.
  if (state._mapBuilt) return;
  state._mapBuilt = true;
  resetFadeZones();
  state.upperWalls = [];
  state.upperFloor = [];
  state.groundFloorItems = [];
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

  buildExteriorPlaza();
  buildBuilding();
  buildOutdoorVenues();
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
  const stoneTex = createStoneTexture();
  const brickTex = createBrickTexture();
  const woodTex = createWoodTexture();
  const darkWoodTex = createDarkWoodTexture();
  
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  state.upperWallMat = makeFadeMaterial(new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 }));
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
  const darkWoodFloorMat = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.35, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const stoneFloorMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const frameMat = state.sharedScenery.frameMat;
  const screenMat = state.sharedScenery.screenMat;
  const { pushRoof, pushUpperWall, pushUpperFloor, pushGroundFloor, consumeGroundFloorItems } =
    createBuildingFadeZone({
      id: 'main-building',
      proximity: { x: 0, z: 0, r: 68 },
      bounds: COVERED_BOUNDS,
      upperLevelThresholdY: MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
      upperWallMat: state.upperWallMat,
      getRideProgress: () => state._elevatorIsRiding ? (state.elevatorRideProgress || 0) : 0,
      isRideActive: () => !!state._elevatorIsRiding
    });

  const batcher = createBatcher(pushUpperWall);
  const { addMesh, addOrientedBox, flush: flushBatches } = batcher;

  // ════════════════════════════════════════════════════════════════
  // SECTION 1: Room floors
  // ════════════════════════════════════════════════════════════════
  state.ROOMS.forEach((room) => {
    const isWood = room.id % 2 === 0;
    const mat = isWood ? woodFloorMat : stoneFloorMat;
    state.scene.add(createFloor(room.width, room.depth, mat, room.x, 0.005, room.z));

    buildRoomInteriorSet(room);
  });

  // ════════════════════════════════════════════════════════════════
  // SECTION 2: Lobby, entrance, and ground floor decoration
  // ════════════════════════════════════════════════════════════════
  // ── Grand wood-floored atrium ──────────────────────────────────────────
  state.scene.add(createFloor(10, 80, darkWoodFloorMat, 0, 0.015, 0));

  // Decorative border strip around the lobby floor edge
  const lobbyBorderMat = new THREE.MeshStandardMaterial({ color: '#4a2c11', roughness: 0.6, metalness: 0.08 });
  state.scene.add(createFloor(10.2, 80.2, lobbyBorderMat, 0, 0.012, 0, false));

  // Entrance medallion — a dark circular accent at the main door (z=40)
  const medallionMat = new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.7, metalness: 0.05 });
  const medallion = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), medallionMat);
  medallion.rotation.x = FLAT;
  medallion.position.set(0, 0.018, 38);
  state.scene.add(medallion);

  const medallionRing = new THREE.Mesh(
    new THREE.RingGeometry(1.75, 2.0, 24),
    new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.5, metalness: 0.1 })
  );
  medallionRing.rotation.x = FLAT;
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

  state.scene.add(createFloor(11.5, 5.2, marbleMat, 0, 0.025, 37.4));

  state.scene.add(createFloor(11.5, 5.0, marbleMat, 0, 0.125, 42.5));

  const carpetMat = new THREE.MeshStandardMaterial({ color: '#7a1a1a', roughness: 0.75, metalness: 0.02, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const borderMat = new THREE.MeshStandardMaterial({ color: '#b8860b', roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });

  state.scene.add(createFloor(3.2, 2.0, carpetMat, 0, 0.12, 41.0));

  [-1.6, 1.6].forEach((xOff) => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 2.0), borderMat);
    border.rotation.x = FLAT;
    border.position.set(xOff, 0.121, 41.0);
    state.scene.add(border);
  });

  state.scene.add(createFloor(3.2, 78, carpetMat, 0, 0.03, 0));

  [-1.6, 1.6].forEach((xOff) => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 78), borderMat);
    border.rotation.x = FLAT;
    border.position.set(xOff, 0.031, 0);
    state.scene.add(border);
  });

  [-1, 1].forEach((zOff) => {
    const endCap = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.06), borderMat);
    endCap.rotation.x = FLAT;
    endCap.position.set(0, 0.031, zOff * 39);
    state.scene.add(endCap);
  });

  // ════════════════════════════════════════════════════════════════
  // SECTION 3: Wall system — shared slab builder & room walls
  // ════════════════════════════════════════════════════════════════
  // Shared wall slab builder — used by both addWallSegment and addUpperWallSegment.
  // baseY: Y position of the bottom of the slab.
  // stateArr: optional debug collection array to append the mesh into.
  function _addWallSlabAt(xStart, zStart, xEnd, zEnd, baseY, height, thickness, material, baseboardMat, stateArr) {
    const { len, angle } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
    if (len < 0.01) return;
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(len, height, thickness), material);
    wallMesh.position.set((xStart + xEnd) / 2, baseY + height / 2, (zStart + zEnd) / 2);
    wallMesh.rotation.y = -angle;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    state.scene.add(wallMesh);
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
    return wallMesh;
  }

  function addWallSegment(xStart, zStart, xEnd, zEnd, height = ROOM_HEIGHT) {
    const { len, angle } = vec2LengthAngle(xStart, zStart, xEnd, zEnd);
    if (len < 0.01) return;

    const thickness = 0.5;
    const lowerHeight = 3.5;
    const upperHeight = height - lowerHeight;
    const baseboardMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9 });

    // Lower wall (always opaque, always visible)
    const lowerWall = _addWallSlabAt(xStart, zStart, xEnd, zEnd, 0, lowerHeight, thickness, wallMat, baseboardMat, null);

    // Upper wall (transparent for indoor/outdoor fade)
    if (upperHeight > 0.05) {
      const upperWall = _addWallSlabAt(xStart, zStart, xEnd, zEnd, lowerHeight, upperHeight, thickness, state.upperWallMat, baseboardMat, null);
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

  state.ROOMS.forEach((room) => {
    createDoorFrame(room.x < 0 ? -5 : 5, room.z, 'V', 4);
  });
  createDoorFrame(0, 40, 'H', 4);

  // ════════════════════════════════════════════════════════════════
  // SECTION 4: Corridor columns
  // ════════════════════════════════════════════════════════════════
  // Torches along the main building hallway
  const hallwayTorchZs = [-36, -20, -2, 17, 34];
  hallwayTorchZs.forEach((z) => {
    // Left wall of hallway (facing right)
    createWallTorch(-4.75, 2.8, z, Math.PI / 2, null, true);
    // Right wall of hallway (facing left)
    createWallTorch(4.75, 2.8, z, -Math.PI / 2, null, true);
  });

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

  state.ROOMS.forEach((room) => {
    if (room.id >= 8) return;
    const screen = buildRoomScreen(room, frameMat, screenMat, 3.5);
    pushGroundFloor(screen);
    const torchX = room.x < 0 ? room.x - room.width / 2 + 0.25 : room.x + room.width / 2 - 0.25;
    const torchRy = room.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    createWallTorch(torchX, 2.5, room.z - 4, torchRy, room.id, true);
    createWallTorch(torchX, 2.5, room.z + 4, torchRy, room.id, false);
    createRoomIndicator(room);
  });

  // ════════════════════════════════════════════════════════════════
  // SECTION 5: Ground-floor ceiling & sign
  // ════════════════════════════════════════════════════════════════
  state.ceilingMat = makeFadeMaterial(new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9, depthWrite: true }));
  const ceilingGeo = new THREE.PlaneGeometry(60, 80);
  state.ceilingMesh = new THREE.Mesh(ceilingGeo, state.ceilingMat);
  state.ceilingMesh.rotation.x = HALF_PI;
  state.ceilingMesh.position.set(0, ROOM_HEIGHT + 0.1, 0);
  state.ceilingMesh.castShadow = true;
  state.ceilingMesh.receiveShadow = true;
  state.scene.add(state.ceilingMesh);
  pushRoof(state.ceilingMesh);

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
  pushUpperWall(signMesh);

  // ════════════════════════════════════════════════════════════════
  // SECTION 6: Upper facade & portico (batcher-based instanced geometry)
  // ════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════
  // SECTION 7: Elevator car, doors, and collision
  // ════════════════════════════════════════════════════════════════
  // ── Animated Opulent Elevator (north end of lobby) ─────────────────────
  const eZ = MAIN_BUILDING_ELEVATOR_Z;
  const eW = MAIN_BUILDING_ELEVATOR_W;
  const eD = MAIN_BUILDING_ELEVATOR_D;
  const eH = MAIN_BUILDING_ELEVATOR_H;
  const eFrontZ = MAIN_BUILDING_ELEVATOR_FRONT_Z;
  const goldMat = new THREE.MeshStandardMaterial({ color: '#b8860b', roughness: 0.2, metalness: 0.8 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#cd7f32', roughness: 0.25, metalness: 0.7 });
  const mahoganyMat = new THREE.MeshStandardMaterial({ color: '#3a1508', roughness: 0.35, metalness: 0.1 });

  const elevatorCar = new THREE.Group();
  elevatorCar.position.set(0, MAIN_BUILDING_ELEVATOR_GROUND_Y, eZ);

  const eMarble = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.1, metalness: 0.05 });
  const eDarkMarble = new THREE.MeshStandardMaterial({ color: '#2a1a0a', roughness: 0.15, metalness: 0.12 });

  // Back wall (z = -eD/2) and side walls
  const backWallZ = -(eD / 2 - 0.1);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(eW - 0.2, eH - 0.5, 0.08), mahoganyMat);
  backWall.position.set(0, (eH - 0.5) / 2, backWallZ);
  elevatorCar.add(backWall);

  const backTopTrim = new THREE.Mesh(new THREE.BoxGeometry(eW - 0.1, 0.04, 0.1), goldMat);
  backTopTrim.position.set(0, eH - 0.3, backWallZ);
  elevatorCar.add(backTopTrim);

  const backBottomTrim = new THREE.Mesh(new THREE.BoxGeometry(eW - 0.1, 0.04, 0.1), goldMat);
  backBottomTrim.position.set(0, 0.15, backWallZ);
  elevatorCar.add(backBottomTrim);
  [-eW / 2 + 0.1, eW / 2 - 0.1].forEach(xOff => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, eH - 0.5, eD - 0.2), mahoganyMat);
    p.position.set(xOff, (eH - 0.5) / 2, 0);
    elevatorCar.add(p);
  });

  // Marble floor
  const ef = createFloor(eW - 0.1, eD - 0.1, eMarble, 0, 0.015, 0);
  elevatorCar.add(ef);
  const eb = new THREE.Mesh(new THREE.RingGeometry(eW / 2 - 0.25, eW / 2 - 0.05, 24), eDarkMarble);
  eb.rotation.x = FLAT;
  eb.position.set(0, 0.017, 0);
  elevatorCar.add(eb);

  // Ceiling + crown molding + chandelier
  elevatorCar.add(createFloor(eW - 0.1, eD - 0.1, eMarble, 0, eH, 0, false));
  const cr = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 16), goldMat);
  cr.position.set(0, eH - 0.01, 0);
  cr.rotation.x = HALF_PI;
  elevatorCar.add(cr);

  const chMat = new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#fef08a', emissiveIntensity: 0.4 });
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), chMat);
  ch.position.set(0, eH - 0.15, 0);
  elevatorCar.add(ch);
  const cabinLight = new THREE.PointLight('#fef3c7', 0, 6.5, 2.2);
  cabinLight.position.set(0, eH - 0.2, 0);
  elevatorCar.add(cabinLight);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshStandardMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.6 }));
    d.position.set(Math.cos(a) * 0.2, eH - 0.35, Math.sin(a) * 0.2);
    elevatorCar.add(d);
  }
  state.scene.add(elevatorCar);

  // ── Swing doors (hinged at outer edges, children of car) ──────────────
  const halfDoorW = (eW - 0.3) / 2; // each door panel width
  const doorPivots = [];
  for (let side = -1; side <= 1; side += 2) {
    // Pivot group at the hinge edge
    const pivot = new THREE.Group();
    pivot.position.set(side * (eW / 2 - 0.04), 0, eD / 2);
    elevatorCar.add(pivot);

    // Door panel
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(halfDoorW, eH - 0.7, 0.06),
      mahoganyMat
    );
    door.position.set(-side * halfDoorW / 2, (eH - 0.7) / 2, 0);
    pivot.add(door);

    // Gold inlay stripe
    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(halfDoorW - 0.2, eH - 1.0, 0.07),
      goldMat
    );
    inlay.position.set(-side * halfDoorW / 2, (eH - 0.7) / 2, 0.035);
    pivot.add(inlay);

    // Handle (brass pull)
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.18, 6),
      brassMat
    );
    handle.rotation.x = HALF_PI;
    handle.position.set(-side * halfDoorW / 3, 1.3, 0.05);
    pivot.add(handle);

    pivot.userData._side = side;
    doorPivots.push(pivot);
  }

  // Door frame (brass pillars + pediment — static in scene, not on car)
  [-0.9, 0.9].forEach(xOff => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, eH + 0.2, 0.06), brassMat);
    f.position.set(xOff, (eH + 0.2) / 2 - 0.1, eFrontZ + 0.01);
    state.scene.add(f);
  });
  const ft = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.08), brassMat);
  ft.position.set(0, eH + 0.05, eFrontZ + 0.01);
  state.scene.add(ft);
  const ps = new THREE.Shape();
  ps.moveTo(-0.9, 0);
  ps.lineTo(0.9, 0);
  ps.lineTo(0, 0.25);
  ps.closePath();
  const pd = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: 0.08, bevelEnabled: false }), goldMat);
  pd.position.set(0, eH + 0.1, eFrontZ + 0.01);
  state.scene.add(pd);

  // Indicator light (static in scene)
  const ib = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.02), brassMat);
  ib.position.set(0, eH + 0.5, eFrontZ + 0.03);
  state.scene.add(ib);
  const il = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), new THREE.MeshBasicMaterial({ color: '#22c55e' }));
  il.position.set(0, eH + 0.5, eFrontZ + 0.04);
  state.scene.add(il);
  const cb = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), brassMat);
  cb.position.set(0.3, 1.3, eFrontZ + 0.04);
  state.scene.add(cb);
  const cl = new THREE.Mesh(new THREE.CircleGeometry(0.02, 6), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
  cl.position.set(0.3, 1.3, eFrontZ + 0.05);
  state.scene.add(cl);

  // State refs for elevator.js
  state._elevatorCar = elevatorCar;
  state._elevatorDoorPivots = doorPivots;
  state._elevatorHalfHeight = eH / 2; // needed by engine.js to center the door collider
  state._elevatorCabinLight = cabinLight;
  state._elevatorCabinGlowMat = chMat;

  // ── Elevator collision ────────────────────────────────────────────────
  // Room interior walls (3 sides — back, left, right)
  const collHalfW = eW / 2 - 0.2;
  const collHalfD = eD / 2 - 0.2;
  const collH = eH;
  // These walls are always active — they define the elevator room boundaries
  // Back wall
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(-collHalfW, 0, eZ - collHalfD - 0.05),
    new THREE.Vector3(collHalfW, collH, eZ - collHalfD + 0.05)
  ));
  // Left wall
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(-collHalfW - 0.05, 0, eZ - collHalfD),
    new THREE.Vector3(-collHalfW + 0.05, collH, eZ + collHalfD)
  ));
  // Right wall
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(collHalfW - 0.05, 0, eZ - collHalfD),
    new THREE.Vector3(collHalfW + 0.05, collH, eZ + collHalfD)
  ));

  // Door collision wall (active when closed, disabled when open)
  const doorCollider = new THREE.Mesh(
    new THREE.BoxGeometry(eW - 0.3, eH, 0.1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  doorCollider.position.set(0, eH / 2, eFrontZ + 0.05);
  doorCollider.visible = false;
  state.scene.add(doorCollider);
  state._elevatorDoorCollider = doorCollider;
  state._elevatorDoorBox = new THREE.Box3().setFromObject(doorCollider);
  state._elevatorDoorBox.userData = { _isElevatorDoor: true };
  state.WALLS.push(state._elevatorDoorBox);
  // ════════════════════════════════════════════════════════════════
  // SECTION 8: Second floor construction
  // ════════════════════════════════════════════════════════════════
  // ── Second floor ──────────────────────────────────────────────────────
  const mezzY = MAIN_BUILDING_MEZZANINE_Y; // deck surface Y
  const f2Height = 3.3;          // interior height of second floor
  const f2Thickness = 0.5;       // wall thickness (matches ground floor)
  const f2BaseboardMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9 });

  // Helper — add a wall slab that starts at mezzY (not ground).
  // Delegates to the shared _addWallSlabAt builder defined in the outer scope.
  function addUpperWallSegment(xStart, zStart, xEnd, zEnd, height = f2Height) {
    const wall = _addWallSlabAt(xStart, zStart, xEnd, zEnd, mezzY, height, f2Thickness, wallMat, f2BaseboardMat, state.upperFloor);
    if (wall) pushUpperFloor(wall);
  }

  // ── Floor slabs ─────────────────────────────────────────────────────
  const mezzFloorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.35, metalness: 0.08 });
  const mezzSlateFloorMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });

  // West wing (gallery side): x -30 → -5, z -40 → +40
  const westFloor = createFloor(25, 80, mezzSlateFloorMat, -17.5, mezzY, 0);
  state.scene.add(westFloor);
  pushUpperFloor(westFloor);

  // East wing (interactive side): x +5 → +30, z -40 → +40
  const eastFloor = createFloor(25, 80, mezzFloorMat, 17.5, mezzY, 0);
  state.scene.add(eastFloor);
  pushUpperFloor(eastFloor);

  // Corridor: x -5 → +5, z -40 → +40
  const corridorFloor = createFloor(10, 80, mezzFloorMat, 0, mezzY, 0);
  state.scene.add(corridorFloor);
  pushUpperFloor(corridorFloor);

  // Dark wood border strip along corridor edges (matches ground floor)
  const corridorBorderMat = new THREE.MeshStandardMaterial({ color: '#4a2c11', roughness: 0.6, metalness: 0.08 });
  [-5.1, 5.1].forEach((x) => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 80), corridorBorderMat);
    border.rotation.x = FLAT;
    border.position.set(x, mezzY + 0.002, 0);
    state.scene.add(border);
    pushUpperFloor(border);
  });

  // ── Second-floor ceiling (underside of roof space) ──────────────────
  const f2CeilingMat = makeFadeMaterial(new THREE.MeshStandardMaterial({ color: '#1e1510', roughness: 0.9 }));
  const f2Ceiling = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), f2CeilingMat);
  f2Ceiling.rotation.x = HALF_PI;
  f2Ceiling.position.set(0, mezzY + f2Height + 0.05, 0);
  f2Ceiling.receiveShadow = true;
  state.scene.add(f2Ceiling);
  pushUpperFloor(f2Ceiling);

  // ── Interior walls — second floor ───────────────────────────────────
  // Left corridor wall (x = -5), with 4u door gaps at same Z as ground floor rooms
  // id < 8 excludes outdoor venues (amphitheater id=8, concert venue id=9, etc.)
  // which would otherwise inject z=140+ into the corridor wall builder and create
  // 100+ unit wall segments extending out through the front of the building.
  const leftUpperDoorZs = state.ROOMS.filter((r) => r.x < 0 && !r.floor && r.id < 8).map((r) => r.z);
  const rightUpperDoorZs = state.ROOMS.filter((r) => r.x > 0 && !r.floor && r.id < 8).map((r) => r.z);

  // Build corridor walls with door gaps (same pattern as ground floor addWallSegment calls)
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
  // These add physics collision to the outside walls at the second-floor height
  addUpperWallSegment(BLDG_X_MIN + 0.5, BLDG_Z_MIN, BLDG_X_MIN + 0.5, BLDG_Z_MAX);
  addUpperWallSegment(BLDG_X_MAX - 0.5, BLDG_Z_MIN, BLDG_X_MAX - 0.5, BLDG_Z_MAX);

  // East wing room divider with 4u door gap at x≈17.5 (centre of the wing)
  addUpperWallSegment(5, -8, 14, -8);     // west part of divider
  addUpperWallSegment(21, -8, 30, -8);    // east part of divider

  // West wing is open plan — full gallery from z=-40 to z=+40

  // ── Door frames on second-floor corridor openings ────────────────────
  state.ROOMS.filter((r) => !r.floor && r.id < 8).forEach((room) => {
    const dfGroup = createDoorFrame(room.x < 0 ? -5 : 5, room.z, 'V', f2Height, mezzY);
    pushUpperFloor(dfGroup);
  });
  // East-wing room divider door
  pushUpperFloor(createDoorFrame(17.5, -8, 'H', f2Height, mezzY));

  // ── Second-floor columns aligned with ground-floor positions ─────────
  const f2ColHeight = f2Height - 0.6;  // 2.7u shaft
  const f2EchinusH = 0.28;
  const f2AbacusH = 0.28;
  const f2ShaftGeo = new THREE.CylinderGeometry(0.28, 0.34, f2ColHeight, 16);
  const f2EchinusGeo = new THREE.CylinderGeometry(0.46, 0.28, f2EchinusH, 16);
  const f2AbacusGeo = new THREE.BoxGeometry(1.0, f2AbacusH, 1.0);
  const f2ColMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.6, metalness: 0.1 });

  // Reuse the same column Z positions as the ground floor corridor columns
  const f2ColPositions = [];
  getCorridorColumnZs(leftUpperDoorZs).forEach((z) => f2ColPositions.push({ x: -4.2, z }));
  getCorridorColumnZs(rightUpperDoorZs).forEach((z) => f2ColPositions.push({ x: 4.2, z }));

  const f2TotalCols = f2ColPositions.length;
  const f2ShaftInst = new THREE.InstancedMesh(f2ShaftGeo, f2ColMat, f2TotalCols);
  const f2EchinusInst = new THREE.InstancedMesh(f2EchinusGeo, f2ColMat, f2TotalCols);
  const f2AbacusInst = new THREE.InstancedMesh(f2AbacusGeo, f2ColMat, f2TotalCols);
  f2ShaftInst.castShadow = true; f2ShaftInst.receiveShadow = true;
  f2EchinusInst.castShadow = true; f2EchinusInst.receiveShadow = true;
  f2AbacusInst.castShadow = true; f2AbacusInst.receiveShadow = true;

  const f2TempObj = new THREE.Object3D();
  for (let i = 0; i < f2TotalCols; i++) {
    const pos = f2ColPositions[i];
    f2TempObj.position.set(pos.x, mezzY + f2ColHeight / 2, pos.z);
    f2TempObj.updateMatrix(); f2ShaftInst.setMatrixAt(i, f2TempObj.matrix);
    f2TempObj.position.set(pos.x, mezzY + f2ColHeight + f2EchinusH / 2, pos.z);
    f2TempObj.updateMatrix(); f2EchinusInst.setMatrixAt(i, f2TempObj.matrix);
    f2TempObj.position.set(pos.x, mezzY + f2ColHeight + f2EchinusH + f2AbacusH / 2, pos.z);
    f2TempObj.updateMatrix(); f2AbacusInst.setMatrixAt(i, f2TempObj.matrix);
  }
  state.scene.add(f2ShaftInst);
  state.scene.add(f2EchinusInst);
  state.scene.add(f2AbacusInst);
  pushUpperFloor(f2ShaftInst, f2EchinusInst, f2AbacusInst);

  // ── Glass railings — all open edges ─────────────────────────────────
  const glassRailMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8', roughness: 0.05, metalness: 0.6,
    transparent: true, opacity: 0.28, side: THREE.DoubleSide
  });
  const mezzRailMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.5, metalness: 0.05 });
  const railH = 1.05;       // railing height above deck
  const railGlassH = 0.9;   // glass panel height
  const railTopT = 0.1;     // top handrail thickness

  function addRailingSegment(x1, z1, x2, z2) {
    const { len, angle } = vec2LengthAngle(x1, z1, x2, z2);
    if (len < 0.5) return;
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;

    // Glass panel
    const gPanel = new THREE.Mesh(new THREE.BoxGeometry(len, railGlassH, 0.06), glassRailMat);
    gPanel.position.set(mx, mezzY + railGlassH / 2 + 0.05, mz);
    gPanel.rotation.y = -angle;
    state.scene.add(gPanel);
    pushUpperFloor(gPanel);

    // Top handrail
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(len + 0.12, railTopT, railTopT), mezzRailMat);
    topRail.position.set(mx, mezzY + railH, mz);
    topRail.rotation.y = -angle;
    state.scene.add(topRail);
    pushUpperFloor(topRail);

    // Bottom rail
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(len + 0.12, railTopT, railTopT), mezzRailMat);
    botRail.position.set(mx, mezzY + 0.06, mz);
    botRail.rotation.y = -angle;
    state.scene.add(botRail);
    pushUpperFloor(botRail);

    // Posts every ~3.5u
    const postCount = Math.max(2, Math.round(len / 3.5) + 1);
    for (let i = 0; i < postCount; i++) {
      const t = postCount > 1 ? i / (postCount - 1) : 0.5;
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, railH, 6), mezzRailMat);
      post.position.set(px, mezzY + railH / 2, pz);
      state.scene.add(post);
      pushUpperFloor(post);
    }
  }

  // South-facing opening above main entrance — spans only the door gap to avoid protruding through facade
  addRailingSegment(-2, 40, 2, 40);
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(-2.1, mezzY, 39.5),
    new THREE.Vector3(2.1, mezzY + f2Height, 40.5)
  ));
  // East wing — south open edge (Room 10 south wall, no exterior wall here)
  // West gallery — perimeter railings are covered by the exterior facade, no extra needed
  // Corridor north open edge (above elevator vestibule, overlooking elevator lobby)
  addRailingSegment(-4.8, -38, 4.8, -38);
  // East wing north-end railing (above elevator approach)
  addRailingSegment(5, -38, 29.5, -38);
  // West gallery north-end railing
  addRailingSegment(-29.5, -38, -5, -38);
  // South edges removed — they looked like trusses extending from the front of the building

  // ── Torches on second-floor corridor walls ───────────────────────────
  const f2TorchZs = [-34, -20, -4, 14, 32];
  f2TorchZs.forEach((z) => {
    // Push torch groups to upperFloor so they fade with the rest of the 2nd-floor interior
    pushUpperFloor(createWallTorch(-4.75, mezzY + 2.2, z, Math.PI / 2, null, true));
    pushUpperFloor(createWallTorch(4.75, mezzY + 2.2, z, -Math.PI / 2, null, true));
  });

  // ── Interactive screen for Room 10 — Upper Gallery (east wing south) ─
  const room10 = state.ROOMS.find((r) => r.id === 10);
  if (room10) {
    // Room 10 screen is mounted on the east outer wall (x≈29.3) rather than the
    // room's inner wall face, so we call buildRoomScreen with an explicit override
    // by temporarily patching room.x to make the positioning formula yield x=29.3.
    // wallOffset=0.22 → room.x + room.width/2 - 0.22 = 29.3 → room.x = 29.3 - 12.5 + 0.22 = 17.02
    // It's cleaner to just place the group manually after building it.
    const r10ScreenY = mezzY + f2Height * 0.55;
    const r10Group = buildRoomScreen(room10, frameMat, screenMat, r10ScreenY, 0.22, pushUpperFloor);
    // Override position: buildRoomScreen placed it at room.x+room.width/2−0.22 ≈ 29.78; correct to 29.3
    r10Group.position.set(29.3, r10ScreenY, 8);
    createRoomIndicator(room10);
    // Torches flanking the screen
    pushUpperFloor(createWallTorch(29.3, mezzY + 2.2, 8 - 4, -Math.PI / 2, 10, true));
    pushUpperFloor(createWallTorch(29.3, mezzY + 2.2, 8 + 4, -Math.PI / 2, 10, false));
  }

  // ── Decorative step at the elevator opening onto the second floor ─────
  // A small stone landing plate at the elevator exit (z = -33.4, the front of the shaft)
  const elevLandingMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.72, metalness: 0.06 });
  const elevLanding = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.0), elevLandingMat);
  elevLanding.position.set(0, mezzY + 0.06, -33.4);
  elevLanding.receiveShadow = true;
  state.scene.add(elevLanding);
  pushUpperFloor(elevLanding);

  buildRoof(batcher, { limestoneMat, bronzeMat, limestoneShadowMat }, { entablatureY, registerRoofMesh: pushRoof });

  consumeGroundFloorItems();
}

export { createDoorFrame } from './building/doors.js';
export { buildClassroomAssets } from './building/interiors.js';
export { createWallTorch } from './building/torches.js';
