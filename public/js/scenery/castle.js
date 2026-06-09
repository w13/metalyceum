import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { createLandmarkFadeZone } from '../fade-system.js';
import { registerStaticScenery } from './visibility.js';
import { HALF_PI, FLAT } from '../math.js';


export const CASTLE_CENTER = [130, -80];

const CX = 130;
const CZ = -80;
const S = 4;

const OUTER_W = 18 * S;
const OUTER_D = 16 * S;
const OUTER_H = 5.5 * S;
const WALL_T = 0.48 * S;
const TOWER_R = 1.9 * S;

const KEEP_W = 8.5 * S;
const KEEP_D = 10 * S;
const KEEP_H = 7.5 * S;
const KEEP_WALL_T = 0.42 * S;

const KEEP_X = CX - 4 * S;
const COURTYARD_X = CX + 2.75 * S;
const GATE_W = 3 * S;
const GATE_PASSAGE_D = 4.2 * S;
const GATEHOUSE_H = 6.5 * S;

function addMesh(parent, geometry, material, x, y, z, { rx = 0, ry = 0, rz = 0, castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, material, w, h, d, x, y, z, options = {}) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z, options);
}

function addPlane(parent, material, w, d, x, y, z, options = {}) {
  return addMesh(parent, new THREE.PlaneGeometry(w, d), material, x, y, z, { rx: FLAT, ...options });
}

function addFloorSlab(parent, material, w, d, x, y, z, thickness = 0.12 * S, options = {}) {
  return addBox(parent, material, w, thickness, d, x, y + thickness / 2, z, {
    castShadow: false,
    ...options
  });
}

function addPointTorch(parent, x, y, z, rotationY, metalMat, woodMat, flameMat, emberMat) {
  const torch = new THREE.Group();

  addBox(torch, metalMat, 0.14, 0.32, 0.26, 0, 0, -0.14, { castShadow: false, receiveShadow: false });

  const arm = addMesh(torch, new THREE.CylinderGeometry(0.045, 0.06, 0.72, 6), woodMat, 0, 0.14, -0.02, {
    rx: Math.PI / 8,
    castShadow: false,
    receiveShadow: false
  });
  arm.castShadow = false;

  const flame = addMesh(torch, new THREE.ConeGeometry(0.14, 0.34, 5), flameMat, 0, 0.52, 0.12, {
    castShadow: false,
    receiveShadow: false
  });
  const ember = addMesh(torch, new THREE.SphereGeometry(0.09, 5, 5), emberMat, 0, 0.62, 0.12, {
    castShadow: false,
    receiveShadow: false
  });

  const light = new THREE.PointLight('#f97316', 0.95, 12);
  light.position.set(0, 0.62, 0.16);
  light.castShadow = false;
  torch.add(light);

  torch.position.set(x, y, z);
  torch.rotation.y = rotationY;
  parent.add(torch);

  state.torches.push({
    light,
    flame,
    baseIntensity: light.intensity,
    seed: Math.random() * 100,
    worldPos: new THREE.Vector3(x, y, z)
  });

  return { torch, ember };
}

function addWallBattlements(parent, battMat, start, end, fixed, y, axis = 'x') {
  const step = 1.4 * S;
  const battlements = [];
  for (let t = start; t <= end; t += step) {
    if (axis === 'x') {
      battlements.push(addBox(parent, battMat, 0.62 * S, 0.72 * S, 0.72 * S, t, y, fixed));
    } else {
      battlements.push(addBox(parent, battMat, 0.72 * S, 0.72 * S, 0.62 * S, fixed, y, t));
    }
  }
  return battlements;
}

function addTowerCrenellations(parent, battMat, tx, ty, tz, radius) {
  const battlements = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    battlements.push(addBox(
      parent,
      battMat,
      0.46 * S,
      0.7 * S,
      0.46 * S,
      tx + Math.cos(a) * radius * 0.82,
      ty,
      tz + Math.sin(a) * radius * 0.82,
      { ry: a }
    ));
  }
  return battlements;
}

function addQuoins(parent, blockMat, cx, cz, width, depth, baseY, height) {
  const blockW = 0.52 * S;
  const blockH = 0.52 * S;
  const blockD = 0.78 * S;
  const corners = [
    { x: cx - width / 2, z: cz - depth / 2, sx: -1, sz: -1 },
    { x: cx + width / 2, z: cz - depth / 2, sx: 1, sz: -1 },
    { x: cx - width / 2, z: cz + depth / 2, sx: -1, sz: 1 },
    { x: cx + width / 2, z: cz + depth / 2, sx: 1, sz: 1 }
  ];

  for (const corner of corners) {
    for (let y = baseY + blockH / 2; y < baseY + height - blockH / 2; y += blockH * 1.05) {
      addBox(parent, blockMat, blockW, blockH, blockD, corner.x + corner.sx * 0.12 * S, y, corner.z + corner.sz * 0.16 * S);
      addBox(parent, blockMat, blockD, blockH, blockW, corner.x + corner.sx * 0.16 * S, y, corner.z + corner.sz * 0.12 * S);
    }
  }
}

function addArrowSlits(parent, x, z, baseY, height, count, orientation, material) {
  const step = count > 1 ? height / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const y = baseY + i * step;
    if (orientation === 'x') {
      addBox(parent, material, 0.1 * S, 0.68 * S, 0.28 * S, x, y, z);
    } else {
      addBox(parent, material, 0.28 * S, 0.68 * S, 0.1 * S, x, y, z);
    }
  }
}

function addLancetWindow(parent, x, y, z, rotationY, frameMat, glassMat) {
  const windowGroup = new THREE.Group();
  addBox(windowGroup, frameMat, 0.18 * S, 1.7 * S, 1.02 * S, 0, 0, 0);
  addBox(windowGroup, frameMat, 0.18 * S, 1.7 * S, 0.18 * S, 0, 0, -0.42 * S);
  addBox(windowGroup, frameMat, 0.18 * S, 1.7 * S, 0.18 * S, 0, 0, 0.42 * S);
  addBox(windowGroup, frameMat, 0.18 * S, 0.22 * S, 1.02 * S, 0, -0.74 * S, 0);
  addMesh(windowGroup, new THREE.CylinderGeometry(0.52 * S, 0.52 * S, 0.18 * S, 12, 1, false, Math.PI, Math.PI), frameMat, 0, 0.8 * S, 0, {
    rz: HALF_PI,
    ry: HALF_PI
  });
  addBox(windowGroup, glassMat, 0.08 * S, 1.36 * S, 0.72 * S, 0, -0.04 * S, 0, { castShadow: false });
  addMesh(windowGroup, new THREE.CylinderGeometry(0.36 * S, 0.36 * S, 0.08 * S, 12, 1, false, Math.PI, Math.PI), glassMat, 0, 0.66 * S, 0, {
    rz: HALF_PI,
    ry: HALF_PI,
    castShadow: false
  });
  windowGroup.position.set(x, y, z);
  windowGroup.rotation.y = rotationY;
  parent.add(windowGroup);
  return windowGroup;
}

function addCollider(minX, maxX, minZ, maxZ) {
  state.PLACED_ASSET_COLLIDERS.push({ minX, maxX, minZ, maxZ, assetId: 'castle' });
}

export function buildCastle() {
  const baseY = getTerrainHeight(CX, CZ);
  const group = new THREE.Group();
  const fadeables = [];

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#8f8072', roughness: 0.9 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#67584c', roughness: 0.92 });
  const lightStoneMat = new THREE.MeshStandardMaterial({ color: '#b6a695', roughness: 0.82 });
  const battMat = new THREE.MeshStandardMaterial({ color: '#7b6b5b', roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#433126', roughness: 0.84 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#5f5147', roughness: 0.82 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4225', roughness: 0.86 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.88 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#232a34', roughness: 0.66, metalness: 0.24 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#9dc2ff',
    emissive: '#9dc2ff',
    emissiveIntensity: 0.16,
    roughness: 0.12,
    metalness: 0.02
  });
  const fireMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
  const emberMat = new THREE.MeshBasicMaterial({ color: '#fde68a' });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#5a4a3e', roughness: 0.96 });
  const borderMat = new THREE.MeshStandardMaterial({ color: '#7b6756', roughness: 0.86 });
  const carpetMat = new THREE.MeshStandardMaterial({ color: '#7a1024', roughness: 0.78, side: THREE.DoubleSide });
  const carpetAccentMat = new THREE.MeshStandardMaterial({ color: '#c4a04b', roughness: 0.72, side: THREE.DoubleSide });
  const velvetMat = new THREE.MeshStandardMaterial({ color: '#243a73', roughness: 0.72, side: THREE.DoubleSide });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#b58a2b', roughness: 0.32, metalness: 0.55 });

  const gateWallX = CX + OUTER_W / 2;
  const gatehouseX = gateWallX + GATE_PASSAGE_D / 2 - WALL_T / 2;
  const gateY = baseY + GATEHOUSE_H / 2;
  const gateDoorH = 3.3 * S;
  const gateDoorPanelW = GATE_W * 0.45;

  const keepFloorY = baseY + 0.03;
  const keepRoofY = baseY + KEEP_H;
  const keepCeilingY = keepRoofY - 0.42 * S;
  const keepDoorH = 3.4 * S;
  const keepDoorW = 2.2 * S;
  const keepDoorX = KEEP_X + KEEP_W / 2 + 0.08 * S;
  const hallInnerW = KEEP_W - KEEP_WALL_T * 2.4;
  const hallInnerD = KEEP_D - KEEP_WALL_T * 2.4;
  const { pushRoof } = createLandmarkFadeZone({
    id: 'castle',
    proximity: { x: CX, z: CZ, r: 58 },
    bounds: {
      minX: KEEP_X - hallInnerW / 2,
      maxX: KEEP_X + hallInnerW / 2,
      minZ: CZ - hallInnerD / 2,
      maxZ: CZ + hallInnerD / 2
    }
  });

  // Courtyard and approaches
  addBox(group, darkStoneMat, OUTER_W + 2 * S, 0.42 * S, OUTER_D + 2 * S, CX, baseY - 0.2 * S, CZ);
  addFloorSlab(group, floorMat, OUTER_W - 2.3 * S, OUTER_D - 2.3 * S, CX, baseY + 0.06, CZ, 0.1 * S);
  addFloorSlab(group, borderMat, OUTER_W - 8.4 * S, 2.1 * S, COURTYARD_X - 0.2 * S, baseY + 0.03, CZ, 0.05 * S);
  addFloorSlab(group, borderMat, 2.5 * S, OUTER_D - 8.4 * S, KEEP_X + KEEP_W / 2 + 1.2 * S, baseY + 0.03, CZ, 0.05 * S);

  for (let i = -2; i <= 2; i++) {
    addFloorSlab(group, lightStoneMat, 2.35 * S, 0.82 * S, gateWallX + 2 * S + Math.abs(i) * 0.5 * S, baseY + 0.035, CZ + i * 1.05 * S, 0.05 * S);
  }

  // Curtain walls
  const wallSpanX = OUTER_W - TOWER_R * 1.5;
  const wallSpanZ = OUTER_D - TOWER_R * 1.5;
  addBox(group, stoneMat, wallSpanX, OUTER_H, WALL_T, CX, baseY + OUTER_H / 2, CZ - OUTER_D / 2);
  addBox(group, stoneMat, wallSpanX, OUTER_H, WALL_T, CX, baseY + OUTER_H / 2, CZ + OUTER_D / 2);
  addBox(group, stoneMat, WALL_T, OUTER_H, wallSpanZ, CX - OUTER_W / 2, baseY + OUTER_H / 2, CZ);

  const eastSegmentDepth = (OUTER_D - GATE_W - TOWER_R * 1.5) / 2;
  addBox(
    group,
    stoneMat,
    WALL_T,
    OUTER_H,
    eastSegmentDepth,
    gateWallX,
    baseY + OUTER_H / 2,
    CZ - (GATE_W / 2 + eastSegmentDepth / 2)
  );
  addBox(
    group,
    stoneMat,
    WALL_T,
    OUTER_H,
    eastSegmentDepth,
    gateWallX,
    baseY + OUTER_H / 2,
    CZ + (GATE_W / 2 + eastSegmentDepth / 2)
  );

  const outerBattlementY = baseY + OUTER_H + 0.34 * S;
  fadeables.push(
    ...addWallBattlements(group, battMat, CX - wallSpanX / 2, CX + wallSpanX / 2, CZ - OUTER_D / 2, outerBattlementY, 'x'),
    ...addWallBattlements(group, battMat, CX - wallSpanX / 2, CX + wallSpanX / 2, CZ + OUTER_D / 2, outerBattlementY, 'x'),
    ...addWallBattlements(group, battMat, CZ - wallSpanZ / 2, CZ + wallSpanZ / 2, CX - OUTER_W / 2, outerBattlementY, 'z'),
    ...addWallBattlements(group, battMat, CZ - OUTER_D / 2 + 1.6 * S, CZ - GATE_W / 2 - 1.2 * S, gateWallX, outerBattlementY, 'z'),
    ...addWallBattlements(group, battMat, CZ + GATE_W / 2 + 1.2 * S, CZ + OUTER_D / 2 - 1.6 * S, gateWallX, outerBattlementY, 'z')
  );

  for (let x = CX - wallSpanX / 2 + 2.2 * S; x <= CX + wallSpanX / 2 - 2.2 * S; x += 3 * S) {
    addArrowSlits(group, x, CZ - OUTER_D / 2 - 0.02 * S, baseY + 2.1 * S, 1.6 * S, 2, 'z', ironMat);
    addArrowSlits(group, x, CZ + OUTER_D / 2 + 0.02 * S, baseY + 2.1 * S, 1.6 * S, 2, 'z', ironMat);
  }
  for (let z = CZ - wallSpanZ / 2 + 2.2 * S; z <= CZ + wallSpanZ / 2 - 2.2 * S; z += 3 * S) {
    addArrowSlits(group, CX - OUTER_W / 2 - 0.02 * S, z, baseY + 2.2 * S, 1.6 * S, 2, 'x', ironMat);
  }

  // Corner towers
  const towerPositions = [
    [CX - OUTER_W / 2, CZ - OUTER_D / 2],
    [CX + OUTER_W / 2, CZ - OUTER_D / 2],
    [CX - OUTER_W / 2, CZ + OUTER_D / 2],
    [CX + OUTER_W / 2, CZ + OUTER_D / 2]
  ];

  for (const [tx, tz] of towerPositions) {
    addMesh(group, new THREE.CylinderGeometry(TOWER_R * 0.92, TOWER_R, OUTER_H + 1.4 * S, 12), stoneMat, tx, baseY + (OUTER_H + 1.4 * S) / 2, tz);
    addBox(group, trimMat, TOWER_R * 2.1, 0.24 * S, TOWER_R * 2.1, tx, baseY + OUTER_H - 0.14 * S, tz);
    fadeables.push(...addTowerCrenellations(group, battMat, tx, baseY + OUTER_H + 0.36 * S, tz, TOWER_R));
    fadeables.push(addMesh(group, new THREE.ConeGeometry(TOWER_R + 0.55 * S, 2.2 * S, 12), roofMat, tx, baseY + OUTER_H + 1.5 * S, tz));

    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      addArrowSlits(group, tx + Math.cos(a) * TOWER_R * 0.78, tz + Math.sin(a) * TOWER_R * 0.78, baseY + 2.2 * S, 1.9 * S, 2, Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'x' : 'z', ironMat);
    }
  }

  // Gatehouse with open gate tunnel
  addBox(group, stoneMat, GATE_PASSAGE_D, GATEHOUSE_H, WALL_T * 0.9, gatehouseX, gateY, CZ - (GATE_W / 2 + 0.54 * S));
  addBox(group, stoneMat, GATE_PASSAGE_D, GATEHOUSE_H, WALL_T * 0.9, gatehouseX, gateY, CZ + (GATE_W / 2 + 0.54 * S));
  addBox(group, stoneMat, GATE_PASSAGE_D, 1.2 * S, GATE_W + 1.1 * S, gatehouseX, baseY + GATEHOUSE_H - 0.6 * S, CZ);
  addBox(group, trimMat, GATE_PASSAGE_D + 0.45 * S, 0.18 * S, GATE_W + 1.3 * S, gatehouseX, baseY + 3.9 * S, CZ);
  addBox(group, battMat, GATE_PASSAGE_D + 0.7 * S, 0.2 * S, GATE_W + 1.5 * S, gatehouseX, baseY + GATEHOUSE_H + 0.08 * S, CZ);
  addFloorSlab(group, borderMat, GATE_PASSAGE_D - 0.55 * S, GATE_W - 0.45 * S, gatehouseX, baseY + 0.03, CZ, 0.06 * S);
  const gateBattlementY = baseY + GATEHOUSE_H + 0.34 * S;
  fadeables.push(
    ...addWallBattlements(group, battMat, CZ - GATE_W / 2 - 0.55 * S, CZ + GATE_W / 2 + 0.55 * S, gatehouseX - GATE_PASSAGE_D / 2 + 0.55 * S, gateBattlementY, 'z'),
    ...addWallBattlements(group, battMat, CZ - GATE_W / 2 - 0.55 * S, CZ + GATE_W / 2 + 0.55 * S, gatehouseX + GATE_PASSAGE_D / 2 - 0.55 * S, gateBattlementY, 'z'),
    addMesh(group, new THREE.ConeGeometry(2.5 * S, 1.9 * S, 4), roofMat, gatehouseX, baseY + GATEHOUSE_H + 1.0 * S, CZ, { ry: Math.PI / 4 })
  );

  addBox(group, darkWoodMat, 0.22 * S, gateDoorH, gateDoorPanelW, gateWallX + GATE_PASSAGE_D / 2 + 0.36 * S, baseY + gateDoorH / 2, CZ - GATE_W * 0.28, {
    ry: 0.95
  });
  addBox(group, darkWoodMat, 0.22 * S, gateDoorH, gateDoorPanelW, gateWallX + GATE_PASSAGE_D / 2 + 0.36 * S, baseY + gateDoorH / 2, CZ + GATE_W * 0.28, {
    ry: -0.95
  });
  addBox(group, ironMat, 0.08 * S, 0.42 * S, GATE_W * 0.92, gatehouseX - 0.75 * S, baseY + gateDoorH + 0.72 * S, CZ);
  for (let i = 0; i < 6; i++) {
    const z = CZ - GATE_W * 0.42 + i * (GATE_W * 0.168);
    addBox(group, ironMat, 0.05 * S, 1.25 * S, 0.05 * S, gatehouseX - 0.78 * S, baseY + gateDoorH + 0.08 * S, z, { castShadow: false });
  }
  addBox(group, trimMat, 0.24 * S, 1.1 * S, GATE_W + 0.95 * S, gatehouseX - GATE_PASSAGE_D / 2 + 0.12 * S, baseY + gateDoorH + 0.38 * S, CZ);
  addBox(group, trimMat, 0.24 * S, 1.1 * S, GATE_W + 0.95 * S, gatehouseX + GATE_PASSAGE_D / 2 - 0.12 * S, baseY + gateDoorH + 0.38 * S, CZ);

  addPointTorch(group, gateWallX + 1.45 * S, baseY + 1.5 * S, CZ - GATE_W * 0.82, -HALF_PI, ironMat, woodMat, fireMat, emberMat);
  addPointTorch(group, gateWallX + 1.45 * S, baseY + 1.5 * S, CZ + GATE_W * 0.82, HALF_PI, ironMat, woodMat, fireMat, emberMat);

  // Great keep shell
  addBox(group, stoneMat, KEEP_W, 0.42 * S, KEEP_D, KEEP_X, baseY - 0.18 * S, CZ);
  addBox(group, stoneMat, KEEP_W, KEEP_H, KEEP_WALL_T, KEEP_X, baseY + KEEP_H / 2, CZ - KEEP_D / 2);
  addBox(group, stoneMat, KEEP_W, KEEP_H, KEEP_WALL_T, KEEP_X, baseY + KEEP_H / 2, CZ + KEEP_D / 2);
  addBox(group, stoneMat, KEEP_WALL_T, KEEP_H, KEEP_D, KEEP_X - KEEP_W / 2, baseY + KEEP_H / 2, CZ);
  addBox(group, stoneMat, KEEP_WALL_T, KEEP_H, (KEEP_D - keepDoorW) / 2, KEEP_X + KEEP_W / 2, baseY + KEEP_H / 2, CZ - (keepDoorW / 2 + (KEEP_D - keepDoorW) / 4));
  addBox(group, stoneMat, KEEP_WALL_T, KEEP_H, (KEEP_D - keepDoorW) / 2, KEEP_X + KEEP_W / 2, baseY + KEEP_H / 2, CZ + (keepDoorW / 2 + (KEEP_D - keepDoorW) / 4));
  addBox(group, trimMat, KEEP_WALL_T, 1.1 * S, keepDoorW + 0.9 * S, KEEP_X + KEEP_W / 2 + 0.04 * S, baseY + keepDoorH + 0.48 * S, CZ);
  addBox(group, trimMat, KEEP_W + 0.15 * S, 0.22 * S, 0.34 * S, KEEP_X, baseY + 2.2 * S, CZ - KEEP_D / 2 - 0.06 * S);
  addBox(group, trimMat, KEEP_W + 0.15 * S, 0.22 * S, 0.34 * S, KEEP_X, baseY + 2.2 * S, CZ + KEEP_D / 2 + 0.06 * S);
  addBox(group, trimMat, KEEP_W + 0.45 * S, 0.2 * S, KEEP_D + 0.45 * S, KEEP_X, baseY + KEEP_H + 0.18 * S, CZ);
  const keepBattlementY = baseY + KEEP_H + 0.34 * S;
  fadeables.push(
    ...addWallBattlements(group, battMat, KEEP_X - KEEP_W / 2 + 0.9 * S, KEEP_X + KEEP_W / 2 - 0.9 * S, CZ - KEEP_D / 2, keepBattlementY, 'x'),
    ...addWallBattlements(group, battMat, KEEP_X - KEEP_W / 2 + 0.9 * S, KEEP_X + KEEP_W / 2 - 0.9 * S, CZ + KEEP_D / 2, keepBattlementY, 'x'),
    ...addWallBattlements(group, battMat, CZ - KEEP_D / 2 + 0.9 * S, CZ - keepDoorW / 2 - 0.8 * S, KEEP_X + KEEP_W / 2, keepBattlementY, 'z'),
    ...addWallBattlements(group, battMat, CZ + keepDoorW / 2 + 0.8 * S, CZ + KEEP_D / 2 - 0.9 * S, KEEP_X + KEEP_W / 2, keepBattlementY, 'z'),
    ...addWallBattlements(group, battMat, CZ - KEEP_D / 2 + 0.9 * S, CZ + KEEP_D / 2 - 0.9 * S, KEEP_X - KEEP_W / 2, keepBattlementY, 'z')
  );
  addQuoins(group, lightStoneMat, KEEP_X, CZ, KEEP_W, KEEP_D, baseY, KEEP_H);

  const keepRoof = addMesh(group, new THREE.ConeGeometry(Math.max(KEEP_W, KEEP_D) * 0.72, 2.8 * S, 4), roofMat, KEEP_X, baseY + KEEP_H + 1.45 * S, CZ, {
    ry: Math.PI / 4
  });
  const keepCeiling = addBox(group, darkStoneMat, hallInnerW, 0.18 * S, hallInnerD, KEEP_X, keepCeilingY, CZ, { castShadow: false });
  fadeables.push(keepRoof, keepCeiling);

  // Keep doors and exterior detailing
  addBox(group, darkWoodMat, 0.2 * S, keepDoorH, keepDoorW * 0.48, keepDoorX, baseY + keepDoorH / 2, CZ - keepDoorW * 0.3, {
    ry: 0.88
  });
  addBox(group, darkWoodMat, 0.2 * S, keepDoorH, keepDoorW * 0.48, keepDoorX, baseY + keepDoorH / 2, CZ + keepDoorW * 0.3, {
    ry: -0.88
  });

  for (let z = -1; z <= 1; z++) {
    addFloorSlab(group, borderMat, 1.2 * S, 0.52 * S, KEEP_X + KEEP_W / 2 + 0.65 * S + Math.abs(z) * 0.28 * S, baseY + 0.03, CZ + z * 0.82 * S, 0.05 * S);
  }

  fadeables.push(
    addLancetWindow(group, KEEP_X - KEEP_W / 2 - 0.04 * S, baseY + 4.65 * S, CZ, HALF_PI, trimMat, glassMat),
    addLancetWindow(group, KEEP_X, baseY + 4.55 * S, CZ - KEEP_D / 2 - 0.04 * S, 0, trimMat, glassMat),
    addLancetWindow(group, KEEP_X, baseY + 4.55 * S, CZ + KEEP_D / 2 + 0.04 * S, Math.PI, trimMat, glassMat)
  );

  for (const zOff of [-2.8 * S, -1.3 * S, 1.3 * S, 2.8 * S]) {
    addArrowSlits(group, KEEP_X - KEEP_W / 2, CZ + zOff, baseY + 2.1 * S, 1.8 * S, 2, 'x', ironMat);
    addArrowSlits(group, KEEP_X + KEEP_W / 2, CZ + zOff, baseY + 2.1 * S, 1.8 * S, 2, 'x', ironMat);
  }
  for (const xOff of [-2.4 * S, 2.4 * S]) {
    addArrowSlits(group, KEEP_X + xOff, CZ - KEEP_D / 2, baseY + 2.0 * S, 1.8 * S, 2, 'z', ironMat);
    addArrowSlits(group, KEEP_X + xOff, CZ + KEEP_D / 2, baseY + 2.0 * S, 1.8 * S, 2, 'z', ironMat);
  }

  // Great hall interior
  addFloorSlab(group, floorMat, hallInnerW - 0.12 * S, hallInnerD - 0.12 * S, KEEP_X, baseY + 0.02, CZ, 0.1 * S);
  addFloorSlab(group, borderMat, hallInnerW - 0.4 * S, 0.7 * S, KEEP_X, baseY + 0.025, CZ - hallInnerD / 2 + 0.48 * S, 0.05 * S);
  addFloorSlab(group, borderMat, hallInnerW - 0.4 * S, 0.7 * S, KEEP_X, baseY + 0.025, CZ + hallInnerD / 2 - 0.48 * S, 0.05 * S);
  addFloorSlab(group, borderMat, 0.7 * S, hallInnerD - 1.35 * S, KEEP_X - hallInnerW / 2 + 0.48 * S, baseY + 0.025, CZ, 0.05 * S);
  addFloorSlab(group, borderMat, 0.7 * S, hallInnerD - 1.35 * S, KEEP_X + hallInnerW / 2 - 0.48 * S, baseY + 0.025, CZ, 0.05 * S);
  addFloorSlab(group, carpetAccentMat, 2.15 * S, hallInnerD - 3.2 * S, KEEP_X + 0.7 * S, baseY + 0.065, CZ, 0.025 * S);
  addFloorSlab(group, carpetMat, 1.7 * S, hallInnerD - 4.1 * S, KEEP_X + 0.7 * S, baseY + 0.078, CZ, 0.018 * S);
  addFloorSlab(group, carpetAccentMat, 4.1 * S, 2.1 * S, KEEP_X - KEEP_W / 2 + 2.45 * S, baseY + 0.065, CZ, 0.025 * S);
  addFloorSlab(group, velvetMat, 3.1 * S, 1.35 * S, KEEP_X - KEEP_W / 2 + 2.45 * S, baseY + 0.078, CZ, 0.018 * S);

  addBox(group, darkStoneMat, 3.4 * S, 0.72 * S, 5.0 * S, KEEP_X - KEEP_W / 2 + 2.55 * S, baseY + 0.36 * S, CZ);

  const throneBaseX = KEEP_X - KEEP_W / 2 + 1.45 * S;
  addBox(group, woodMat, 0.9 * S, 0.24 * S, 1.05 * S, throneBaseX, baseY + 0.52 * S, CZ);
  addBox(group, darkWoodMat, 0.16 * S, 1.2 * S, 1.05 * S, throneBaseX - 0.28 * S, baseY + 1.22 * S, CZ);
  addBox(group, darkWoodMat, 0.44 * S, 0.18 * S, 1.05 * S, throneBaseX + 0.08 * S, baseY + 1.72 * S, CZ);
  addBox(group, goldMat, 0.18 * S, 0.18 * S, 1.18 * S, throneBaseX - 0.28 * S, baseY + 1.98 * S, CZ);
  addBox(group, goldMat, 0.12 * S, 0.32 * S, 0.12 * S, throneBaseX + 0.2 * S, baseY + 1.96 * S, CZ - 0.38 * S);
  addBox(group, goldMat, 0.12 * S, 0.32 * S, 0.12 * S, throneBaseX + 0.2 * S, baseY + 1.96 * S, CZ + 0.38 * S);

  for (const side of [-1, 1]) {
    addPlane(group, velvetMat, 1.1 * S, 2.0 * S, KEEP_X - KEEP_W / 2 + 0.72 * S, baseY + 3.9 * S, CZ + side * 2.1 * S, {
      rx: 0,
      ry: HALF_PI
    });
    addBox(group, goldMat, 0.12 * S, 2.1 * S, 0.12 * S, KEEP_X - KEEP_W / 2 + 0.76 * S, baseY + 3.9 * S, CZ + side * 2.1 * S);
  }

  const banquetTableX = KEEP_X + 1.4 * S;
  for (const zOff of [-2.75 * S, 2.75 * S]) {
    addBox(group, woodMat, 3.2 * S, 0.2 * S, 1.15 * S, banquetTableX, baseY + 0.96 * S, CZ + zOff);
    addBox(group, darkWoodMat, 0.2 * S, 0.86 * S, 0.2 * S, banquetTableX - 1.18 * S, baseY + 0.46 * S, CZ + zOff - 0.38 * S);
    addBox(group, darkWoodMat, 0.2 * S, 0.86 * S, 0.2 * S, banquetTableX + 1.18 * S, baseY + 0.46 * S, CZ + zOff - 0.38 * S);
    addBox(group, darkWoodMat, 0.2 * S, 0.86 * S, 0.2 * S, banquetTableX - 1.18 * S, baseY + 0.46 * S, CZ + zOff + 0.38 * S);
    addBox(group, darkWoodMat, 0.2 * S, 0.86 * S, 0.2 * S, banquetTableX + 1.18 * S, baseY + 0.46 * S, CZ + zOff + 0.38 * S);

    addBox(group, woodMat, 3.0 * S, 0.16 * S, 0.32 * S, banquetTableX, baseY + 0.56 * S, CZ + zOff - 0.88 * S);
    addBox(group, woodMat, 3.0 * S, 0.16 * S, 0.32 * S, banquetTableX, baseY + 0.56 * S, CZ + zOff + 0.88 * S);
    addBox(group, darkWoodMat, 0.16 * S, 0.48 * S, 0.16 * S, banquetTableX - 1.12 * S, baseY + 0.24 * S, CZ + zOff - 0.88 * S);
    addBox(group, darkWoodMat, 0.16 * S, 0.48 * S, 0.16 * S, banquetTableX + 1.12 * S, baseY + 0.24 * S, CZ + zOff - 0.88 * S);
    addBox(group, darkWoodMat, 0.16 * S, 0.48 * S, 0.16 * S, banquetTableX - 1.12 * S, baseY + 0.24 * S, CZ + zOff + 0.88 * S);
    addBox(group, darkWoodMat, 0.16 * S, 0.48 * S, 0.16 * S, banquetTableX + 1.12 * S, baseY + 0.24 * S, CZ + zOff + 0.88 * S);
  }

  for (const xOff of [-0.55 * S, 1.95 * S]) {
    for (const zOff of [-4.1 * S, 4.1 * S]) {
      addBox(group, lightStoneMat, 0.58 * S, 3.1 * S, 0.58 * S, KEEP_X + xOff, baseY + 1.55 * S, CZ + zOff);
      addBox(group, trimMat, 0.78 * S, 0.16 * S, 0.78 * S, KEEP_X + xOff, baseY + 3.13 * S, CZ + zOff);
      addBox(group, trimMat, 0.78 * S, 0.16 * S, 0.78 * S, KEEP_X + xOff, baseY + 0.08 * S, CZ + zOff);
    }
  }

  addBox(group, darkWoodMat, 0.75 * S, 1.5 * S, 3.1 * S, KEEP_X + KEEP_W / 2 - 0.72 * S, baseY + 0.75 * S, CZ);
  addBox(group, woodMat, 0.2 * S, 0.18 * S, 2.7 * S, KEEP_X + KEEP_W / 2 - 0.18 * S, baseY + 1.52 * S, CZ);
  for (const zOff of [-0.9 * S, 0, 0.9 * S]) {
    addBox(group, goldMat, 0.12 * S, 0.12 * S, 0.46 * S, KEEP_X + KEEP_W / 2 - 0.12 * S, baseY + 1.18 * S, CZ + zOff);
  }

  addBox(group, darkStoneMat, 0.4 * S, 1.2 * S, 1.8 * S, KEEP_X + KEEP_W / 2 - 0.35 * S, baseY + 0.62 * S, CZ - 2.6 * S);
  addBox(group, darkStoneMat, 0.4 * S, 1.2 * S, 1.8 * S, KEEP_X + KEEP_W / 2 - 0.35 * S, baseY + 0.62 * S, CZ + 2.6 * S);
  addBox(group, ironMat, 0.16 * S, 0.12 * S, 1.22 * S, KEEP_X + KEEP_W / 2 - 0.1 * S, baseY + 0.74 * S, CZ - 2.6 * S);
  addBox(group, ironMat, 0.16 * S, 0.12 * S, 1.22 * S, KEEP_X + KEEP_W / 2 - 0.1 * S, baseY + 0.74 * S, CZ + 2.6 * S);
  addBox(group, emberMat, 0.16 * S, 0.24 * S, 0.9 * S, KEEP_X + KEEP_W / 2 - 0.18 * S, baseY + 1.08 * S, CZ - 2.6 * S, { castShadow: false });
  addBox(group, emberMat, 0.16 * S, 0.24 * S, 0.9 * S, KEEP_X + KEEP_W / 2 - 0.18 * S, baseY + 1.08 * S, CZ + 2.6 * S, { castShadow: false });

  addPointTorch(group, KEEP_X + 1.3 * S, baseY + 1.7 * S, CZ - 4.05 * S, -HALF_PI, ironMat, woodMat, fireMat, emberMat);
  addPointTorch(group, KEEP_X + 1.3 * S, baseY + 1.7 * S, CZ + 4.05 * S, HALF_PI, ironMat, woodMat, fireMat, emberMat);
  addPointTorch(group, KEEP_X - 2.75 * S, baseY + 1.95 * S, CZ - 4.2 * S, -HALF_PI, ironMat, woodMat, fireMat, emberMat);
  addPointTorch(group, KEEP_X - 2.75 * S, baseY + 1.95 * S, CZ + 4.2 * S, HALF_PI, ironMat, woodMat, fireMat, emberMat);

  const chandelier = new THREE.Group();
  addMesh(chandelier, new THREE.CylinderGeometry(0.03 * S, 0.03 * S, 1.6 * S, 5), ironMat, 0, 0.8 * S, 0, { castShadow: false, receiveShadow: false });
  addMesh(chandelier, new THREE.TorusGeometry(0.75 * S, 0.05 * S, 8, 20), ironMat, 0, 0, 0, { rx: HALF_PI, castShadow: false, receiveShadow: false });
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    const candleX = Math.cos(a) * 0.75 * S;
    const candleZ = Math.sin(a) * 0.75 * S;
    addBox(chandelier, lightStoneMat, 0.08 * S, 0.28 * S, 0.08 * S, candleX, 0.16 * S, candleZ, { castShadow: false, receiveShadow: false });
    addMesh(chandelier, new THREE.ConeGeometry(0.06 * S, 0.16 * S, 5), fireMat, candleX, 0.4 * S, candleZ, { castShadow: false, receiveShadow: false });
  }
  chandelier.position.set(KEEP_X - 0.2 * S, keepCeilingY - 0.85 * S, CZ);
  group.add(chandelier);
  fadeables.push(chandelier);

  // Courtyard accents
  addBox(group, stoneMat, 1.35 * S, 0.95 * S, 1.35 * S, COURTYARD_X - 0.4 * S, baseY + 0.48 * S, CZ - 3.2 * S);
  addMesh(group, new THREE.CylinderGeometry(0.48 * S, 0.6 * S, 0.92 * S, 10), trimMat, COURTYARD_X - 0.4 * S, baseY + 0.95 * S, CZ - 3.2 * S);
  addMesh(group, new THREE.TorusGeometry(0.34 * S, 0.05 * S, 6, 14), ironMat, COURTYARD_X - 0.4 * S, baseY + 1.36 * S, CZ - 3.2 * S, {
    rx: HALF_PI,
    castShadow: false
  });

  for (let i = 0; i < 4; i++) {
    addMesh(group, new THREE.CylinderGeometry(0.26, 0.32, 1.5, 10), woodMat, COURTYARD_X + 2.4 * S + i * 0.66, baseY + 0.75, CZ + 2.9 * S);
    addBox(group, ironMat, 0.18, 0.1, 0.18, COURTYARD_X + 2.4 * S + i * 0.66, baseY + 1.16, CZ + 2.9 * S);
  }

  // Colliders: perimeter walls, towers, gatehouse sides, keep shell
  addCollider(CX - wallSpanX / 2, CX + wallSpanX / 2, CZ - OUTER_D / 2 - WALL_T, CZ - OUTER_D / 2 + WALL_T);
  addCollider(CX - wallSpanX / 2, CX + wallSpanX / 2, CZ + OUTER_D / 2 - WALL_T, CZ + OUTER_D / 2 + WALL_T);
  addCollider(CX - OUTER_W / 2 - WALL_T, CX - OUTER_W / 2 + WALL_T, CZ - wallSpanZ / 2, CZ + wallSpanZ / 2);
  addCollider(gateWallX - WALL_T, gateWallX + WALL_T, CZ - OUTER_D / 2 + TOWER_R * 0.72, CZ - GATE_W / 2 - 0.45 * S);
  addCollider(gateWallX - WALL_T, gateWallX + WALL_T, CZ + GATE_W / 2 + 0.45 * S, CZ + OUTER_D / 2 - TOWER_R * 0.72);

  for (const [tx, tz] of towerPositions) {
    addCollider(tx - TOWER_R * 0.82, tx + TOWER_R * 0.82, tz - TOWER_R * 0.82, tz + TOWER_R * 0.82);
  }

  addCollider(gatehouseX - GATE_PASSAGE_D / 2 - 0.1 * S, gatehouseX + GATE_PASSAGE_D / 2 + 0.1 * S, CZ - GATE_W / 2 - 0.95 * S, CZ - GATE_W / 2 + 0.08 * S);
  addCollider(gatehouseX - GATE_PASSAGE_D / 2 - 0.1 * S, gatehouseX + GATE_PASSAGE_D / 2 + 0.1 * S, CZ + GATE_W / 2 - 0.08 * S, CZ + GATE_W / 2 + 0.95 * S);

  addCollider(KEEP_X - KEEP_W / 2 - KEEP_WALL_T, KEEP_X + KEEP_W / 2 + KEEP_WALL_T, CZ - KEEP_D / 2 - KEEP_WALL_T, CZ - KEEP_D / 2 + KEEP_WALL_T);
  addCollider(KEEP_X - KEEP_W / 2 - KEEP_WALL_T, KEEP_X + KEEP_W / 2 + KEEP_WALL_T, CZ + KEEP_D / 2 - KEEP_WALL_T, CZ + KEEP_D / 2 + KEEP_WALL_T);
  addCollider(KEEP_X - KEEP_W / 2 - KEEP_WALL_T, KEEP_X - KEEP_W / 2 + KEEP_WALL_T, CZ - KEEP_D / 2, CZ + KEEP_D / 2);
  addCollider(KEEP_X + KEEP_W / 2 - KEEP_WALL_T, KEEP_X + KEEP_W / 2 + KEEP_WALL_T, CZ - KEEP_D / 2, CZ - keepDoorW / 2 - 0.1 * S);
  addCollider(KEEP_X + KEEP_W / 2 - KEEP_WALL_T, KEEP_X + KEEP_W / 2 + KEEP_WALL_T, CZ + keepDoorW / 2 + 0.1 * S, CZ + KEEP_D / 2);

  const keepRoom = {
    id: 11,
    name: 'Castle Great Hall',
    x: KEEP_X,
    z: CZ,
    width: hallInnerW,
    depth: hallInnerD,
    bounds: {
      minX: KEEP_X - hallInnerW / 2,
      maxX: KEEP_X + hallInnerW / 2,
      minZ: CZ - hallInnerD / 2,
      maxZ: CZ + hallInnerD / 2
    },
    video: '',
    sourceValue: '',
    sourceType: 'none',
    startTime: null,
    durationMinutes: 0,
    updatedAt: 0
  };

  const roomIndex = state.ROOMS.findIndex((room) => room.id === 11);
  if (roomIndex === -1) state.ROOMS.push(keepRoom);
  else state.ROOMS[roomIndex] = keepRoom;

  pushRoof(fadeables);

  state.scene.add(group);
  state.landmarkGroups.set('castle', group);
  registerStaticScenery(group, { kind: 'outdoor', distance: 200 });
}
