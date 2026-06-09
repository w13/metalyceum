// Underground City — cave entrance descending to a subterranean settlement
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { createLandmarkFadeZone } from '../fade-system.js';
import { registerStaticScenery } from './visibility.js';
import { HALF_PI, FLAT } from '../math.js';
import { createFloor } from './utils.js';

export function buildCaveAndUndergroundCity() {
  const cx = 120, cz = 80;
  const baseY = getTerrainHeight(cx, cz);
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#2d2d2d', roughness: 0.9, flatShading: true });
  const warmStoneMat = new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 0.85 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.8 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9, transparent: true, opacity: 1.0 });
  const warmLightMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.3 });
  const dimLightMat = new THREE.MeshStandardMaterial({ color: '#d97706', emissive: '#d97706', emissiveIntensity: 0.12 });

  const UG_Y = -8;
  const UGW = 26, UGD = 36, UGH = 5.5;
  const { pushRoof } = createLandmarkFadeZone({
    id: 'underground-city',
    proximity: { x: cx, z: cz + 18, r: 32 },
    bounds: {
      minX: cx - UGW / 2,
      maxX: cx + UGW / 2,
      minZ: cz + 18 - UGD / 2,
      maxZ: cz + 18 + UGD / 2,
      maxY: -1
    }
  });

  // ── Cave entrance ──────────────────────────────────────────────────
  // Grand archway at the mouth
  const archMat = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.8 });
  const entranceRadius = 3.5;
  // Side pillars
  for (let side = -1; side <= 1; side += 2) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), archMat);
    pillar.position.set(cx + side * 2.5, baseY + 2.5, cz);
    pillar.castShadow = true;
    group.add(pillar);
  }
  // Curved lintel / arch top
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (Math.PI / 8) * i;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), archMat);
    seg.position.set(cx + Math.cos(a) * entranceRadius, baseY + 5 + Math.sin(a) * entranceRadius, cz);
    group.add(seg);
  }

  // Descending ramp — wider, smoother
  const rampMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.85 });
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const rx = cx;
    const rz = cz + 3 + t * 12;
    const ry = baseY + 0.05 - t * 0.7;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 1.2), rampMat);
    seg.position.set(rx, ry, rz);
    seg.receiveShadow = true;
    group.add(seg);
  }

  // Ramp side walls
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const wx = cx + side * 3.2;
      const wz = cz + 2 + t * 13;
      const wy = baseY + 0.3 - t * 0.7 + 1.25;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.5, 1.8), stoneMat);
      wall.position.set(wx, wy, wz);
      group.add(wall);
    }
  }

  // Torches along the ramp walls
  const torchLightMat = new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#f97316', emissiveIntensity: 0.6 });
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const tz = cz + 4 + i * 3;
      const ty = baseY + 0.3 - (i / 3) * 0.7 + 1.8;
      const torch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), torchLightMat);
      torch.position.set(cx + side * 3.5, ty, tz);
      group.add(torch);
    }
  }

  // ── Underground city chamber ────────────────────────────────────────
  const ugX = cx, ugZ = cz + 18;

  // Floor
  group.add(createFloor(UGW, UGD, floorMat, ugX, UG_Y + 0.02, ugZ));

  // Cobblestone street grid (east-west lanes)
  const cobbleMat = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.9 });
  for (let zOff = -14; zOff <= 14; zOff += 8) {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(UGW - 2, 0.04, 1.5), cobbleMat);
    lane.position.set(ugX, UG_Y + 0.04, ugZ + zOff);
    group.add(lane);
  }
  for (let xOff = -10; xOff <= 10; xOff += 8) {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, UGD - 2), cobbleMat);
    lane.position.set(ugX + xOff, UG_Y + 0.04, ugZ);
    group.add(lane);
  }

  // Ceiling
  const ugCeiling = createFloor(UGW, UGD, ceilingMat, ugX, UG_Y + UGH, ugZ);
  group.add(ugCeiling);
  pushRoof(ugCeiling);

  // Chamber walls
  const backW = new THREE.Mesh(new THREE.BoxGeometry(UGW, UGH, 0.4), stoneMat);
  backW.position.set(ugX, UG_Y + UGH / 2, ugZ + UGD / 2);
  backW.castShadow = true;
  group.add(backW);

  for (let side = -1; side <= 1; side += 2) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.4, UGH, UGD), stoneMat);
    sw.position.set(ugX + side * UGW / 2, UG_Y + UGH / 2, ugZ);
    sw.castShadow = true;
    group.add(sw);
  }

  // Entrance wall with opening
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(10, UGH, 0.4), stoneMat);
  frontL.position.set(ugX - 7, UG_Y + UGH / 2, ugZ - UGD / 2);
  group.add(frontL);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(10, UGH, 0.4), stoneMat);
  frontR.position.set(ugX + 7, UG_Y + UGH / 2, ugZ - UGD / 2);
  group.add(frontR);

  // ── Buildings ──────────────────────────────────────────────────────
  const buildMat = new THREE.MeshStandardMaterial({ color: '#6a5a4a', roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.85 });
  const windowMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 0.25 });
  const doorMat = new THREE.MeshStandardMaterial({ color: '#2a1a0a', roughness: 0.9 });
  const pillarMat2 = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.8 });

  const structures = [
    { x: ugX - 7, z: ugZ + 7, w: 5, d: 5, h: 2.8, color: '#6a5a4a' },
    { x: ugX + 7, z: ugZ + 7, w: 5, d: 5, h: 2.8, color: '#7a6a5a' },
    { x: ugX - 7, z: ugZ - 4, w: 5, d: 5, h: 2.8, color: '#6a5a4a' },
    { x: ugX + 7, z: ugZ - 4, w: 5, d: 5, h: 2.8, color: '#7a6a5a' },
    { x: ugX, z: ugZ + 11, w: 6, d: 4, h: 3.0, color: '#5a4a3a' }, // temple/shrine
    { x: ugX - 3, z: ugZ - 9, w: 3.5, d: 3.5, h: 2.2, color: '#6a5a4a' },
    { x: ugX + 3, z: ugZ - 9, w: 3.5, d: 3.5, h: 2.2, color: '#7a6a5a' },
  ];

  structures.forEach((s, idx) => {
    const bMat = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.8 });

    for (let side = 0; side < 4; side++) {
      const nx = side === 0 ? 1 : side === 2 ? -1 : 0;
      const nz = side === 1 ? 1 : side === 3 ? -1 : 0;
      const w = nx !== 0 ? 0.2 : s.d + 0.2;
      const d = nx !== 0 ? s.w + 0.2 : 0.2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(nx !== 0 ? w : s.w, s.h, nx !== 0 ? d : w), bMat);
      wall.position.set(s.x + nx * s.w / 2, UG_Y + s.h / 2, s.z + nz * s.d / 2);
      wall.castShadow = true;
      group.add(wall);
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.3, 0.15, s.d + 0.3), roofMat);
    roof.position.set(s.x, UG_Y + s.h + 0.075, s.z);
    group.add(roof);

    // Glowing window
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.05), windowMat);
    win.position.set(s.x, UG_Y + 1.5, s.z + s.d / 2 + 0.01);
    group.add(win);

    // Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.04), doorMat);
    door.position.set(s.x, UG_Y + 0.6, s.z - s.d / 2 - 0.01);
    group.add(door);
  });

  // ── Central monument ───────────────────────────────────────────────
  const monMat = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.7, metalness: 0.1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.4, 10), monMat);
  base.position.set(ugX, UG_Y + 0.2, ugZ);
  group.add(base);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 3.5, 8), monMat);
  shaft.position.set(ugX, UG_Y + 2.1, ugZ);
  group.add(shaft);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), warmLightMat);
  orb.position.set(ugX, UG_Y + 4.0, ugZ);
  group.add(orb);
  // Glow ring around the orb
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.7, 16),
    new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  );
  glowRing.rotation.x = FLAT;
  glowRing.position.set(ugX, UG_Y + 3.95, ugZ);
  group.add(glowRing);

  // ── Hanging lanterns from ceiling ──────────────────────────────────
  const chainMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.8 });
  for (let xOff = -8; xOff <= 8; xOff += 8) {
    for (let zOff = -12; zOff <= 12; zOff += 8) {
      // Chain
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4), chainMat);
      chain.position.set(ugX + xOff, UG_Y + UGH - 0.5, ugZ + zOff);
      group.add(chain);
      // Lantern body
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.4, 8), dimLightMat);
      lantern.position.set(ugX + xOff, UG_Y + UGH - 1.0, ugZ + zOff);
      group.add(lantern);
    }
  }

  // ── Market stalls near the entrance ────────────────────────────────
  const stallMat = new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.85 });
  const canvasMat = new THREE.MeshStandardMaterial({ color: '#a08060', roughness: 0.9 });
  for (let side = -1; side <= 1; side += 2) {
    const sx = ugX + side * 4;
    const sz = ugZ - 12;
    // Counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1.0), stallMat);
    counter.position.set(sx, UG_Y + 0.4, sz);
    counter.castShadow = true;
    group.add(counter);
    // Awning
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.04, 1.3), canvasMat);
    awning.position.set(sx, UG_Y + 1.4, sz);
    group.add(awning);
    // Awning posts
    for (let p = -1; p <= 1; p += 2) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.2, 4), stallMat);
      post.position.set(sx + p * 1.1, UG_Y + 0.7, sz);
      group.add(post);
    }
  }

  // ── Glowing mushrooms / crystals ───────────────────────────────────
  const shroomMat = new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 0.08 });
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.3;
    const d = 2 + Math.random() * 3;
    const mx = ugX + Math.cos(a) * d;
    const mz = ugZ + Math.sin(a) * d;
    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 4), shroomMat.clone());
    stem.material = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.9 });
    stem.position.set(mx, UG_Y + 0.15, mz);
    group.add(stem);
    // Cap
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), shroomMat);
    cap.position.set(mx, UG_Y + 0.32, mz);
    cap.scale.set(1, 0.5, 1);
    group.add(cap);
  }

  // ── Tunnel floor (connecting ramp to city) ─────────────────────────
  for (let i = 0; i < 6; i++) {
    const t = (i + 1) / 6;
    const tx = cx;
    const tz = cz + 5 + t * 12;
    const ty = UG_Y + 0.05 + (1 - t) * 0.3;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2), rampMat);
    seg.position.set(tx, ty, tz);
    group.add(seg);
  }

  // ── Tunnel ceiling (arches) ────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const tArch = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 0.4), stoneMat);
    tArch.position.set(cx, baseY + 0.5 - (i / 3) * 0.7 + 2.2, cz + 6 + i * 3);
    group.add(tArch);
  }

  // ── Ambient point light at the center ──────────────────────────────
  const ambient = new THREE.PointLight('#fbbf24', 0.6, 25);
  ambient.position.set(ugX, UG_Y + 3, ugZ);
  group.add(ambient);

  // ── Collision barrier ──────────────────────────────────────────────
  state.PLACED_ASSET_COLLIDERS.push({
    minX: ugX - UGW / 2 - 1, maxX: ugX + UGW / 2 + 1,
    minZ: ugZ - UGD / 2 - 1, maxZ: ugZ + UGD / 2 + 1,
    assetId: 'underground-city'
  });

  // ── Room detection for ceiling fade ────────────────────────────────
  if (!state.ROOMS.find((r) => r.id === 12)) {
    state.ROOMS.push({
      id: 12, name: "Underground City",
      x: ugX, z: ugZ, width: UGW, depth: UGD,
      video: "", sourceValue: "", sourceType: "none",
      startTime: null, durationMinutes: 0, updatedAt: 0
    });
  }

  state.scene.add(group);
  state.landmarkGroups.set('undergroundCity', group);
  registerStaticScenery(group, { kind: 'outdoor', distance: 100 });
}
