import * as THREE from 'three';
import { ROOM_LABEL_HEIGHT, ROOM_LAYOUTS, WORLD_CONFIG } from '../config.js';
import { FLAT } from '../math.js';
import { createFloor } from '../scenery/utils.js';
import { buildRoomInteriorSet, createRoomIndicator } from '../scenery.js';
import { state } from '../state.js';
import {
  createMarbleTileTexture,
  createSignBoardTexture,
} from '../textures.js';
import { buildClassroomAssets } from './classroom.js';
import { createWallTorch } from './torches.js';

/**
 * Builds a wall-mounted interactive room screen with a custom theme colored border.
 * @param {object} room       - database room definition
 * @param {object} frameMat   - frame material instance
 * @param {object} screenMat  - raw template screen material
 * @param {number} screenY     - world Y position for the screen center
 * @param {number} wallOffset  - distance from the inner wall face to the screen
 * @param {object[]|null} upperFloorArr - if non-null, push group into this array too
 * @returns {THREE.Group} the screen group (already added to scene)
 */
export function buildRoomScreen(
  room,
  frameMat,
  screenMat,
  screenY,
  wallOffset = 0.22,
  upperFloorArr = null,
) {
  const layout = ROOM_LAYOUTS[room.id] || {
    themeColor: WORLD_CONFIG.signAccent,
  };
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
    baseEmissive: innerScreenMat.emissive.clone(),
  });
  screenGroup.add(innerScreen);

  const screenBorder = new THREE.Mesh(
    innerGeo,
    new THREE.MeshBasicMaterial({ color: layout.themeColor, wireframe: true }),
  );
  screenBorder.position.z = 0.11;
  screenBorder.scale.set(1.02, 1.02, 1.02);
  screenGroup.add(screenBorder);

  if (room.x < 0) {
    screenGroup.position.set(
      room.x - room.width / 2 + wallOffset,
      screenY,
      room.z,
    );
    screenGroup.rotation.y = Math.PI / 2;
  } else {
    screenGroup.position.set(
      room.x + room.width / 2 - wallOffset,
      screenY,
      room.z,
    );
    screenGroup.rotation.y = -Math.PI / 2;
  }

  state.scene.add(screenGroup);
  if (upperFloorArr) {
    if (typeof upperFloorArr === 'function') upperFloorArr(screenGroup);
    else upperFloorArr.push(screenGroup);
  }
  return screenGroup;
}

export function buildGroundFloor(
  scene,
  state,
  materials,
  pushGroundFloor,
  pushUpperWall,
) {
  const { woodFloorMat, darkWoodFloorMat, stoneFloorMat, frameMat, screenMat } =
    materials;

  // ── Room floors ──────────────────────────────────────────────────
  state.ROOMS.forEach((room) => {
    const isWood = room.id % 2 === 0;
    const mat = isWood ? woodFloorMat : stoneFloorMat;
    scene.add(createFloor(room.width, room.depth, mat, room.x, 0.005, room.z));

    buildRoomInteriorSet(room);
  });

  // ── Lobby, entrance, and ground floor decoration ─────────────────
  // Grand atrium
  scene.add(createFloor(10, 80, darkWoodFloorMat, 0, 0.015, 0));

  // Decorative border strip around the lobby floor edge
  const lobbyBorderMat = new THREE.MeshStandardMaterial({
    color: '#4a2c11',
    roughness: 0.6,
    metalness: 0.08,
  });
  scene.add(createFloor(10.2, 80.2, lobbyBorderMat, 0, 0.012, 0, false));

  // Entrance medallion — a dark circular accent at the main door (z=40)
  const medallionMat = new THREE.MeshStandardMaterial({
    color: '#5c3a1e',
    roughness: 0.7,
    metalness: 0.05,
  });
  const medallion = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 24),
    medallionMat,
  );
  medallion.rotation.x = FLAT;
  medallion.position.set(0, 0.018, 38);
  scene.add(medallion);

  const medallionRing = new THREE.Mesh(
    new THREE.RingGeometry(1.75, 2.0, 24),
    new THREE.MeshStandardMaterial({
      color: '#8b5a2b',
      roughness: 0.5,
      metalness: 0.1,
    }),
  );
  medallionRing.rotation.x = FLAT;
  medallionRing.position.set(0, 0.019, 38);
  scene.add(medallionRing);

  // ── Entrance threshold & stone landing ─────────────────────────────
  const landingMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.72,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const landingStep = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.1, 3.2),
    landingMat,
  );
  landingStep.position.set(0, 0.07, 41.6);
  landingStep.receiveShadow = true;
  landingStep.castShadow = true;
  scene.add(landingStep);

  const trimBorderMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.5,
    metalness: 0.3,
  });
  const trimBorder = new THREE.Mesh(
    new THREE.BoxGeometry(4.9, 0.04, 3.3),
    trimBorderMat,
  );
  trimBorder.position.set(0, 0.04, 41.6);
  scene.add(trimBorder);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.06, 0.8),
    landingMat,
  );
  sill.position.set(0, 0.05, 40.2);
  sill.receiveShadow = true;
  scene.add(sill);

  const marbleTex = createMarbleTileTexture();
  const marbleMat = new THREE.MeshStandardMaterial({
    map: marbleTex,
    color: '#ede8dc',
    roughness: 0.12,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  scene.add(createFloor(11.5, 5.2, marbleMat, 0, 0.025, 37.4));
  scene.add(createFloor(11.5, 5.0, marbleMat, 0, 0.125, 42.5));

  const carpetMat = new THREE.MeshStandardMaterial({
    color: '#7a1a1a',
    roughness: 0.75,
    metalness: 0.02,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const borderMat = new THREE.MeshStandardMaterial({
    color: '#b8860b',
    roughness: 0.45,
    metalness: 0.35,
    side: THREE.DoubleSide,
  });

  scene.add(createFloor(3.2, 2.0, carpetMat, 0, 0.12, 41.0));

  [-1.6, 1.6].forEach((xOff) => {
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 2.0),
      borderMat,
    );
    border.rotation.x = FLAT;
    border.position.set(xOff, 0.121, 41.0);
    scene.add(border);
  });

  scene.add(createFloor(3.2, 78, carpetMat, 0, 0.03, 0));

  [-1.6, 1.6].forEach((xOff) => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 78), borderMat);
    border.rotation.x = FLAT;
    border.position.set(xOff, 0.031, 0);
    scene.add(border);
  });

  [-1, 1].forEach((zOff) => {
    const endCap = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.06),
      borderMat,
    );
    endCap.rotation.x = FLAT;
    endCap.position.set(0, 0.031, zOff * 39);
    scene.add(endCap);
  });

  // ── Classroom assets, signs, indicators, and torches ──────────────
  buildClassroomAssets();

  const signTex = createSignBoardTexture();
  state.signFrontMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.6,
    transparent: true,
    opacity: 1.0,
  });
  state.signSideMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.8,
    transparent: true,
    opacity: 1.0,
  });
  const signMaterials = [
    state.signSideMat,
    state.signSideMat,
    state.signSideMat,
    state.signSideMat,
    state.signFrontMat,
    state.signSideMat,
  ];
  const signGeo = new THREE.BoxGeometry(10.5, 1.4, 0.1);
  const signMesh = new THREE.Mesh(signGeo, signMaterials);
  signMesh.position.set(0, 4.4, 41.5);
  signMesh.castShadow = true;
  signMesh.receiveShadow = true;
  scene.add(signMesh);
  pushUpperWall(signMesh);

  state.ROOMS.forEach((room) => {
    if (room.id >= 8) return;
    const screen = buildRoomScreen(room, frameMat, screenMat, 3.5);
    pushGroundFloor(screen);
    const torchX =
      room.x < 0
        ? room.x - room.width / 2 + 0.25
        : room.x + room.width / 2 - 0.25;
    const torchRy = room.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    createWallTorch(torchX, 2.5, room.z - 4, torchRy, room.id, true);
    createWallTorch(torchX, 2.5, room.z + 4, torchRy, room.id, false);
    createRoomIndicator(room, pushGroundFloor);
  });
}
