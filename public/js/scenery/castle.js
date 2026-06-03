// Scottish-style castle — 400% scale with grand gatehouse door
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { registerStaticScenery } from './visibility.js';

const HALF_PI = Math.PI / 2;
const FLAT = -HALF_PI;

export const CASTLE_CENTER = [130, -80];

const CX = 130, CZ = -80;

// All dimensions ×4  (original × 4)
const S = 4;
const keepW = 10 * S, keepD = 12 * S, keepH = 14 * S;
const wallH = 6 * S;
const wallT = 0.5 * S;
const towerR = 2.0 * S;

export function buildCastle() {
  const baseY = getTerrainHeight(CX, CZ);
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#8a7a6a', roughness: 0.85 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#3a2a2a', roughness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#6a5a4a', roughness: 0.7 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.8 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#3a1f0a', roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.7, metalness: 0.3 });

  // ── Central keep ────────────────────────────────────────────────────
  const keep = new THREE.Mesh(new THREE.BoxGeometry(keepW, keepH, keepD), stoneMat);
  keep.position.set(CX, baseY + keepH / 2, CZ);
  keep.castShadow = true;
  keep.receiveShadow = true;
  group.add(keep);

  // Keep battlements
  const battMat = new THREE.MeshStandardMaterial({ color: '#7a6a5a', roughness: 0.85 });
  const merlonSize = 0.8 * S;
  const merlonStep = 2 * S;
  for (let xOff = -keepW/2 + merlonSize; xOff <= keepW/2 - merlonSize; xOff += merlonStep) {
    for (let zOff = -keepD/2 + merlonSize; zOff <= keepD/2 - merlonSize; zOff += merlonStep) {
      if (Math.abs(xOff) < keepW/2 - merlonSize * 1.5 && Math.abs(zOff) < keepD/2 - merlonSize * 1.5) continue;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(merlonSize, merlonSize, merlonSize), battMat);
      merlon.position.set(CX + xOff, baseY + keepH + merlonSize / 2, CZ + zOff);
      merlon.castShadow = true;
      group.add(merlon);
    }
  }

  // Keep roof
  const roofBase = Math.max(keepW, keepD) * 0.75;
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(roofBase, 3 * S, 4), roofMat);
  keepRoof.position.set(CX, baseY + keepH + 1.5 * S, CZ);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.castShadow = true;
  group.add(keepRoof);

  // Flagpole
  const poleMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.8 });
  const flagMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * S, 0.08 * S, 1.5 * S, 4), poleMat);
  pole.position.set(CX, baseY + keepH + 3.5 * S, CZ);
  group.add(pole);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.5 * S, 0.35 * S), flagMat);
  flag.position.set(CX + 0.05, baseY + keepH + 4.0 * S, CZ + 0.2 * S);
  group.add(flag);

  // Keep slit windows
  const winMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
  for (let side = 0; side < 4; side++) {
    const nx = side === 0 ? 1 : side === 2 ? -1 : 0;
    const nz = side === 1 ? 1 : side === 3 ? -1 : 0;
    for (let floor = 0; floor < 4; floor++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(nx !== 0 ? 0.08 * S : 0.4 * S, 0.6 * S, nz !== 0 ? 0.08 * S : 0.4 * S), winMat);
      win.position.set(
        CX + nx * (keepW / 2 + 0.01),
        baseY + 2.5 * S + floor * 3.5 * S,
        CZ + nz * (keepD / 2 + 0.01)
      );
      group.add(win);
    }
  }

  // ── Corner towers ──────────────────────────────────────────────────
  const towerPositions = [
    [CX - keepW / 2 - 1.5 * S, CZ - keepD / 2 - 1.5 * S],
    [CX + keepW / 2 + 1.5 * S, CZ - keepD / 2 - 1.5 * S],
    [CX - keepW / 2 - 1.5 * S, CZ + keepD / 2 + 1.5 * S],
    [CX + keepW / 2 + 1.5 * S, CZ + keepD / 2 + 1.5 * S],
  ];

  towerPositions.forEach(([tx, tz]) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(towerR - 0.2 * S, towerR, 6 * S, 12), stoneMat);
    tower.position.set(tx, baseY + 3 * S, tz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(towerR + 0.1 * S, 2.0 * S, 12), roofMat);
    towerRoof.position.set(tx, baseY + 6 * S + 1.0 * S, tz);
    towerRoof.castShadow = true;
    group.add(towerRoof);

    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3 * S, 0.6 * S, 0.3 * S), darkStoneMat);
      m.position.set(tx + Math.cos(a) * towerR * 0.9, baseY + 6.3 * S, tz + Math.sin(a) * towerR * 0.9);
      group.add(m);
    }
  });

  // ── Curtain walls ──────────────────────────────────────────────────
  const nWall = new THREE.Mesh(new THREE.BoxGeometry(keepW + 6 * S, wallH, wallT), stoneMat);
  nWall.position.set(CX, baseY + wallH / 2, CZ - keepD / 2 - 2.5 * S);
  nWall.castShadow = true;
  nWall.receiveShadow = true;
  group.add(nWall);

  const sWall = new THREE.Mesh(new THREE.BoxGeometry(keepW + 6 * S, wallH, wallT), stoneMat);
  sWall.position.set(CX, baseY + wallH / 2, CZ + keepD / 2 + 2.5 * S);
  sWall.castShadow = true;
  sWall.receiveShadow = true;
  group.add(sWall);

  const wWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, keepD + 8 * S), stoneMat);
  wWall.position.set(CX - keepW / 2 - 3 * S, baseY + wallH / 2, CZ);
  wWall.castShadow = true;
  wWall.receiveShadow = true;
  group.add(wWall);

  // East wall sections (gatehouse gap)
  const eWallN = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 6 * S), stoneMat);
  eWallN.position.set(CX + keepW / 2 + 3 * S, baseY + wallH / 2, CZ - 4 * S);
  eWallN.castShadow = true;
  eWallN.receiveShadow = true;
  group.add(eWallN);

  const eWallS = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 6 * S), stoneMat);
  eWallS.position.set(CX + keepW / 2 + 3 * S, baseY + wallH / 2, CZ + 4 * S);
  eWallS.castShadow = true;
  eWallS.receiveShadow = true;
  group.add(eWallS);

  // Wall walkways
  const walkMat = new THREE.MeshStandardMaterial({ color: '#7a6a5a', roughness: 0.85 });
  const walkwayN = new THREE.Mesh(new THREE.BoxGeometry(keepW + 5.5 * S, 0.12 * S, 0.8 * S), walkMat);
  walkwayN.position.set(CX, baseY + wallH + 0.06 * S, CZ - keepD / 2 - 2.5 * S);
  group.add(walkwayN);
  const walkwayS = new THREE.Mesh(new THREE.BoxGeometry(keepW + 5.5 * S, 0.12 * S, 0.8 * S), walkMat);
  walkwayS.position.set(CX, baseY + wallH + 0.06 * S, CZ + keepD / 2 + 2.5 * S);
  group.add(walkwayS);

  // Wall battlements
  const battWallMat = new THREE.MeshStandardMaterial({ color: '#6a5a4a', roughness: 0.85 });
  for (let xOff = -keepW/2; xOff <= keepW/2; xOff += 2 * S) {
    for (let zOff = -8 * S; zOff <= 8 * S; zOff += 2 * S) {
      const onNorth = Math.abs(zOff + 2.5 * S) < S;
      const onSouth = Math.abs(zOff - 2.5 * S) < S;
      if (!onNorth && !onSouth) continue;
      if (Math.abs(xOff) > keepW/2 + 3 * S) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6 * S, 0.6 * S, 0.6 * S), battWallMat);
      m.position.set(CX + xOff, baseY + wallH + 0.3 * S, CZ + (onNorth ? -keepD/2 - 2.5*S : keepD/2 + 2.5*S));
      group.add(m);
    }
  }

  // ── Gatehouse with door ─────────────────────────────────────────────
  const gateMat = new THREE.MeshStandardMaterial({ color: '#7a6a5a', roughness: 0.8 });
  const gateX = CX + keepW / 2 + 3.5 * S;
  const gateZ = CZ;

  // Gatehouse tower
  const gateTower = new THREE.Mesh(new THREE.BoxGeometry(3.5 * S, 5.5 * S, 4.5 * S), gateMat);
  gateTower.position.set(gateX, baseY + 2.75 * S, gateZ);
  gateTower.castShadow = true;
  gateTower.receiveShadow = true;
  group.add(gateTower);

  // Gate arch pillars
  const archMat = new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 0.85 });
  const gateL = new THREE.Mesh(new THREE.BoxGeometry(0.5 * S, 3.5 * S, 0.5 * S), archMat);
  gateL.position.set(gateX, baseY + 1.75 * S, gateZ - 1.2 * S);
  group.add(gateL);
  const gateR = new THREE.Mesh(new THREE.BoxGeometry(0.5 * S, 3.5 * S, 0.5 * S), archMat);
  gateR.position.set(gateX, baseY + 1.75 * S, gateZ + 1.2 * S);
  group.add(gateR);
  const gateTop = new THREE.Mesh(new THREE.BoxGeometry(0.5 * S, 0.4 * S, 2.9 * S), archMat);
  gateTop.position.set(gateX, baseY + 3.5 * S, gateZ);
  group.add(gateTop);

  // Gatehouse roof
  const gateRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8 * S, 1.5 * S, 4), roofMat);
  gateRoof.position.set(gateX, baseY + 5.5 * S + 0.75 * S, gateZ);
  gateRoof.rotation.y = Math.PI / 4;
  gateRoof.castShadow = true;
  group.add(gateRoof);

  // ── Grand wooden door ──────────────────────────────────────────────
  // ── Open gate — doors swung aside, no portcullis ─────────────────────
  const doorW = 1.1 * S, doorH = 2.8 * S;
  for (let side = -1; side <= 1; side += 2) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.08 * S), darkWoodMat);
    door.position.set(gateX + 0.2, baseY + doorH / 2, gateZ + side * 2.0 * S);
    door.rotation.y = side * 0.5;
    door.castShadow = true;
    group.add(door);
  }
  state.roofMeshes.push(gateRoof);

  // ── Inner courtyard ────────────────────────────────────────────────
  const paveMat = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.9 });
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(keepW + 4 * S, keepD + 4 * S), paveMat);
  pave.rotation.x = FLAT;
  pave.position.set(CX, baseY + 0.015, CZ);
  pave.receiveShadow = true;
  group.add(pave);

  // ── Courtyard furnishings (avatar-scale: ~2u tall player, so table at ~1u, chair at ~0.5u) ──
  // Great Hall table
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.2), woodMat);
  tableTop.position.set(CX + 3 * S, baseY + 0.85, CZ);
  tableTop.castShadow = true;
  group.add(tableTop);
  for (let lx = -1.2; lx <= 1.2; lx += 2.4) {
    for (let lz = -0.5; lz <= 0.5; lz += 1.0) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), darkWoodMat);
      leg.position.set(CX + 3 * S + lx, baseY + 0.38, CZ + lz);
      group.add(leg);
    }
  }

  // Benches
  for (let side = -1; side <= 1; side += 2) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.35), woodMat);
    bench.position.set(CX + 3 * S, baseY + 0.45, CZ + side * 0.85);
    group.add(bench);
    for (let bx = -1.0; bx <= 1.0; bx += 2.0) {
      const bLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.05), darkWoodMat);
      bLeg.position.set(CX + 3 * S + bx, baseY + 0.19, CZ + side * 0.85);
      group.add(bLeg);
    }
  }

  // Throne
  const throneBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.8), woodMat);
  throneBase.position.set(CX - keepW / 2 + 0.5, baseY + 0.08, CZ + 1.0);
  throneBase.castShadow = true;
  group.add(throneBase);
  const throneBack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.8), darkWoodMat);
  throneBack.position.set(CX - keepW / 2 + 0.45, baseY + 0.5, CZ + 1.0);
  group.add(throneBack);
  const goldMat = new THREE.MeshStandardMaterial({ color: '#b8860b', roughness: 0.3, metalness: 0.6 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.85), goldMat);
  trim.position.set(CX - keepW / 2 + 0.45, baseY + 0.9, CZ + 1.0);
  group.add(trim);

  // Runner rug
  const rugMat = new THREE.MeshStandardMaterial({ color: '#7a1a1a', roughness: 0.8, side: THREE.DoubleSide });
  const rugLong = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 5.0), rugMat);
  rugLong.rotation.x = FLAT;
  rugLong.position.set(CX + 2 * S, baseY + 0.015, CZ);
  group.add(rugLong);

  // Fire pit
  const ironMat2 = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.7, metalness: 0.3 });
  const fireMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
  const fireRing = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 12), ironMat2);
  fireRing.position.set(CX + 3 * S, baseY + 0.02, CZ - 3 * S);
  group.add(fireRing);
  const fireGlow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), fireMat);
  fireGlow.position.set(CX + 3 * S, baseY + 0.08, CZ - 3 * S);
  group.add(fireGlow);

  // Well
  const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.4, 10), stoneMat);
  wellBase.position.set(CX - 3 * S, baseY + 0.2, CZ - 5 * S);
  group.add(wellBase);
  for (let s = -1; s <= 1; s += 2) {
    const wp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 4), woodMat);
    wp.position.set(CX - 3 * S + s * 0.35, baseY + 0.4, CZ - 5 * S);
    group.add(wp);
  }

  // Barrels
  for (let i = 0; i < 3; i++) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.4, 8), woodMat);
    barrel.position.set(CX + 5.5 * S + (i - 1) * 0.55, baseY + 0.2, CZ + 2.5 * S);
    barrel.castShadow = true;
    group.add(barrel);
  }

  // Weapon rack
  const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.25), darkWoodMat);
  rackBase.position.set(CX + 5.5 * S, baseY + 0.025, CZ - 2.5 * S);
  group.add(rackBase);
  for (let i = 0; i < 3; i++) {
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.8, 4), ironMat2);
    spear.position.set(CX + 5.5 * S + (i - 1) * 0.2, baseY + 0.42, CZ - 2.5 * S);
    group.add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), ironMat2);
    tip.position.set(CX + 5.5 * S + (i - 1) * 0.2, baseY + 0.82, CZ - 2.5 * S);
    group.add(tip);
  }

  // Tapestries
  const bannerMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.6, side: THREE.DoubleSide });
  for (let side = -1; side <= 1; side += 2) {
    const tap = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), bannerMat);
    tap.position.set(CX + side * (keepW / 2 + 0.02), baseY + 3.5 * S, CZ);
    tap.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(tap);
  }

  // ── Room detection for roof fade ────────────────────────────────────
  if (!state.ROOMS.find((r) => r.id === 11)) {
    state.ROOMS.push({
      id: 11, name: "Castle Courtyard",
      x: CX, z: CZ, width: keepW + 10 * S, depth: keepD + 10 * S,
      video: "", sourceValue: "", sourceType: "none",
      startTime: null, durationMinutes: 0, updatedAt: 0
    });
  }

  // ── Collision barrier ──────────────────────────────────────────────
  state.PLACED_ASSET_COLLIDERS.push({
    minX: CX - keepW/2 - 5 * S, maxX: CX + keepW/2 + 5 * S,
    minZ: CZ - keepD/2 - 5 * S, maxZ: CZ + keepD/2 + 5 * S,
    assetId: 'castle'
  });

  state.scene.add(group);
  state.landmarkGroups.set('castle', group);
  registerStaticScenery(group, { kind: 'outdoor', distance: 200 });
}
