import * as THREE from 'three';
import { MAIN_BUILDING_MEZZANINE_Y } from '../config.js';
import { makeFadeMaterial } from '../fade-system.js';
import { FLAT, HALF_PI } from '../math.js';
import { createFloor, vec2LengthAngle } from '../scenery/utils.js';
import { createRoomIndicator } from '../scenery.js';
import { state } from '../state.js';
import { createDoorFrame } from './doors.js';
import { buildRoomScreen } from './ground-floor.js';
import { createWallTorch } from './torches.js';
import { buildUpperFloorFurnishings } from './upstairs.js';

export function buildUpperFloor(scene, state, materials, pushUpperFloor) {
  const mezzY = MAIN_BUILDING_MEZZANINE_Y; // deck surface Y
  const f2Height = 3.3; // interior height of second floor
  const { woodTex, stoneTex, frameMat, screenMat } = materials;

  // ── Floor slabs ─────────────────────────────────────────────────────
  const mezzFloorMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.35,
    metalness: 0.08,
  });
  const mezzSlateFloorMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.8,
  });

  // West wing (gallery side): x -30 → -5, z -40 → +40
  const westFloor = createFloor(25, 80, mezzSlateFloorMat, -17.5, mezzY, 0);
  scene.add(westFloor);
  pushUpperFloor(westFloor);

  // East wing (interactive side): x +5 → +30, z -40 → +40
  const eastFloor = createFloor(25, 80, mezzFloorMat, 17.5, mezzY, 0);
  scene.add(eastFloor);
  pushUpperFloor(eastFloor);

  // Corridor: x -5 → +5, z -40 → +40
  const corridorFloor = createFloor(10, 80, mezzFloorMat, 0, mezzY, 0);
  scene.add(corridorFloor);
  pushUpperFloor(corridorFloor);

  // Dark wood border strip along corridor edges (matches ground floor)
  const corridorBorderMat = new THREE.MeshStandardMaterial({
    color: '#4a2c11',
    roughness: 0.6,
    metalness: 0.08,
  });
  [-5.1, 5.1].forEach((x) => {
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 80),
      corridorBorderMat,
    );
    border.rotation.x = FLAT;
    border.position.set(x, mezzY + 0.002, 0);
    scene.add(border);
    pushUpperFloor(border);
  });

  // ── Second-floor ceiling (underside of roof space) ──────────────────
  const f2CeilingMat = makeFadeMaterial(
    new THREE.MeshStandardMaterial({ color: '#1e1510', roughness: 0.9 }),
  );
  const f2Ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 80),
    f2CeilingMat,
  );
  f2Ceiling.rotation.x = HALF_PI;
  f2Ceiling.position.set(0, mezzY + f2Height + 0.05, 0);
  f2Ceiling.receiveShadow = true;
  scene.add(f2Ceiling);
  pushUpperFloor(f2Ceiling);

  // ── Door frames on second-floor corridor openings ────────────────────
  const leftUpperDoorZs = state.ROOMS.filter(
    (r) => r.x < 0 && !r.floor && r.id < 8,
  ).map((r) => r.z);
  state.ROOMS.filter((r) => !r.floor && r.id < 8).forEach((room) => {
    const dfGroup = createDoorFrame(
      room.x < 0 ? -5 : 5,
      room.z,
      'V',
      f2Height,
      mezzY,
    );
    pushUpperFloor(dfGroup);
  });
  // East-wing room divider door
  pushUpperFloor(createDoorFrame(17.5, -8, 'H', f2Height, mezzY));

  // ── Second-floor columns aligned with ground-floor positions ─────────
  const f2ColHeight = f2Height - 0.6; // 2.7u shaft
  const f2EchinusH = 0.28;
  const f2AbacusH = 0.28;
  const f2ShaftGeo = new THREE.CylinderGeometry(0.28, 0.34, f2ColHeight, 16);
  const f2EchinusGeo = new THREE.CylinderGeometry(0.46, 0.28, f2EchinusH, 16);
  const f2AbacusGeo = new THREE.BoxGeometry(1.0, f2AbacusH, 1.0);
  const f2ColMat = new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    roughness: 0.6,
    metalness: 0.1,
  });

  function getCorridorColumnZs(doorZs, minZ = -38, maxZ = 38, clearance = 3) {
    const blockedRanges = [...doorZs]
      .sort((a, b) => a - b)
      .map((doorZ) => ({
        start: Math.max(minZ, doorZ - clearance),
        end: Math.min(maxZ, doorZ + clearance),
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

  // Reuse the same column Z positions as the ground floor corridor columns
  const f2ColPositions = [];
  getCorridorColumnZs(leftUpperDoorZs).forEach((z) =>
    f2ColPositions.push({ x: -4.2, z }),
  );
  // Right door list
  const rightUpperDoorZs = state.ROOMS.filter(
    (r) => r.x > 0 && !r.floor && r.id < 8,
  ).map((r) => r.z);
  getCorridorColumnZs(rightUpperDoorZs).forEach((z) =>
    f2ColPositions.push({ x: 4.2, z }),
  );

  const f2TotalCols = f2ColPositions.length;
  const f2ShaftInst = new THREE.InstancedMesh(
    f2ShaftGeo,
    f2ColMat,
    f2TotalCols,
  );
  const f2EchinusInst = new THREE.InstancedMesh(
    f2EchinusGeo,
    f2ColMat,
    f2TotalCols,
  );
  const f2AbacusInst = new THREE.InstancedMesh(
    f2AbacusGeo,
    f2ColMat,
    f2TotalCols,
  );
  f2ShaftInst.castShadow = true;
  f2ShaftInst.receiveShadow = true;
  f2EchinusInst.castShadow = true;
  f2EchinusInst.receiveShadow = true;
  f2AbacusInst.castShadow = true;
  f2AbacusInst.receiveShadow = true;

  const f2TempObj = new THREE.Object3D();
  for (let i = 0; i < f2TotalCols; i++) {
    const pos = f2ColPositions[i];
    f2TempObj.position.set(pos.x, mezzY + f2ColHeight / 2, pos.z);
    f2TempObj.updateMatrix();
    f2ShaftInst.setMatrixAt(i, f2TempObj.matrix);
    f2TempObj.position.set(pos.x, mezzY + f2ColHeight + f2EchinusH / 2, pos.z);
    f2TempObj.updateMatrix();
    f2EchinusInst.setMatrixAt(i, f2TempObj.matrix);
    f2TempObj.position.set(
      pos.x,
      mezzY + f2ColHeight + f2EchinusH + f2AbacusH / 2,
      pos.z,
    );
    f2TempObj.updateMatrix();
    f2AbacusInst.setMatrixAt(i, f2TempObj.matrix);
  }
  scene.add(f2ShaftInst);
  scene.add(f2EchinusInst);
  scene.add(f2AbacusInst);
  pushUpperFloor(f2ShaftInst, f2EchinusInst, f2AbacusInst);

  // ── Glass railings — all open edges ─────────────────────────────────
  const glassRailMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.05,
    metalness: 0.6,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
  });
  const mezzRailMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.5,
    metalness: 0.05,
  });
  const railH = 1.05; // railing height above deck
  const railGlassH = 0.9; // glass panel height
  const railTopT = 0.1; // top handrail thickness

  function addRailingSegment(x1, z1, x2, z2) {
    const { len, angle } = vec2LengthAngle(x1, z1, x2, z2);
    if (len < 0.5) return;
    const mx = (x1 + x2) / 2,
      mz = (z1 + z2) / 2;

    // Glass panel
    const gPanel = new THREE.Mesh(
      new THREE.BoxGeometry(len, railGlassH, 0.06),
      glassRailMat,
    );
    gPanel.position.set(mx, mezzY + railGlassH / 2 + 0.05, mz);
    gPanel.rotation.y = -angle;
    scene.add(gPanel);
    pushUpperFloor(gPanel);

    // Top handrail
    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(len + 0.12, railTopT, railTopT),
      mezzRailMat,
    );
    topRail.position.set(mx, mezzY + railH, mz);
    topRail.rotation.y = -angle;
    scene.add(topRail);
    pushUpperFloor(topRail);

    // Bottom rail
    const botRail = new THREE.Mesh(
      new THREE.BoxGeometry(len + 0.12, railTopT, railTopT),
      mezzRailMat,
    );
    botRail.position.set(mx, mezzY + 0.06, mz);
    botRail.rotation.y = -angle;
    scene.add(botRail);
    pushUpperFloor(botRail);

    // Posts every ~3.5u
    const postCount = Math.max(2, Math.round(len / 3.5) + 1);
    for (let i = 0; i < postCount; i++) {
      const t = postCount > 1 ? i / (postCount - 1) : 0.5;
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.07, railH, 6),
        mezzRailMat,
      );
      post.position.set(px, mezzY + railH / 2, pz);
      scene.add(post);
      pushUpperFloor(post);
    }
  }

  // South-facing opening above main entrance
  addRailingSegment(-2, 40, 2, 40);
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(-2.1, mezzY, 39.5),
      new THREE.Vector3(2.1, mezzY + f2Height, 40.5),
    ),
  );
  // Corridor open edges
  addRailingSegment(-4.8, -38, 4.8, -38);
  addRailingSegment(5, -38, 29.5, -38);
  addRailingSegment(-29.5, -38, -5, -38);

  // ── Torches on second-floor corridor walls ───────────────────────────
  const f2TorchZs = [-34, -20, -4, 14, 32];
  f2TorchZs.forEach((z) => {
    pushUpperFloor(
      createWallTorch(-4.75, mezzY + 2.2, z, Math.PI / 2, null, true),
    );
    pushUpperFloor(
      createWallTorch(4.75, mezzY + 2.2, z, -Math.PI / 2, null, true),
    );
  });

  // ── Interactive screen for Room 10 ───────────────────────────────────
  const room10 = state.ROOMS.find((r) => r.id === 10);
  if (room10) {
    const r10ScreenY = mezzY + f2Height * 0.55;
    const r10Group = buildRoomScreen(
      room10,
      frameMat,
      screenMat,
      r10ScreenY,
      0.22,
      pushUpperFloor,
    );
    r10Group.position.set(29.3, r10ScreenY, 8);
    createRoomIndicator(room10, pushUpperFloor);
    // Torches flanking the screen
    pushUpperFloor(
      createWallTorch(29.3, mezzY + 2.2, 8 - 4, -Math.PI / 2, 10, true),
    );
    pushUpperFloor(
      createWallTorch(29.3, mezzY + 2.2, 8 + 4, -Math.PI / 2, 10, false),
    );
  }

  // ── Decorative step at the elevator opening onto the second floor ─────
  const elevLandingMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.72,
    metalness: 0.06,
  });
  const elevLanding = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.12, 2.0),
    elevLandingMat,
  );
  elevLanding.position.set(0, mezzY + 0.06, -33.4);
  elevLanding.receiveShadow = true;
  scene.add(elevLanding);
  pushUpperFloor(elevLanding);

  buildUpperFloorFurnishings(pushUpperFloor);
}
