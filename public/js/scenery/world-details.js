// Procedural instanced details: forest trees, wildflower meadows, ponds, and grass patches
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { isFrontPlazaFootprint, isVenueRoadFootprint } from '../utils.js';
import { registerStaticScenery } from './visibility.js';
import { deformGroundGeometry, addSceneryCollider } from './utils.js';

export function buildWorldDetails() {
  const _t = new THREE.Object3D();

  // Returns false if the point overlaps a road, building, or venue.
  function isSafe(x, z) {
    if (Math.abs(x) < 33 && Math.abs(z) < 45) return false;           // main building
    if (isFrontPlazaFootprint(x, z)) return false;
    if (isVenueRoadFootprint(x, z, 4)) return false;
    if (Math.abs(x - 65) < 42 && Math.abs(z - 150) < 42) return false; // amphitheater platform
    if (Math.abs(x + 85) < 27 && Math.abs(z - 140) < 21) return false; // concert hall footprint
    // Road corridors
    if (z > 58 && z < 152 && x > -4 && x < 70) return false;         // road -> amphitheater
    if (z > 58 && z < 140 && x > -90 && x < 4) return false;         // road -> concert hall
    if (z > 40 && z < 59 && Math.abs(x) < 5) return false;           // road -> main building
    return true;
  }

  // ── 1. TREE CLUSTERS (InstancedMesh) ─────────────────────────────────────
  const treePts = [];
  function cluster(cx, cz, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.7;
      const d = (0.25 + Math.random() * 0.75) * spread;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!isSafe(x, z)) continue;
      treePts.push({ x, z, s: 0.7 + Math.random() * 0.55 });
    }
  }

  // Northern woodland
  cluster(-42, -72, 10, 14);
  cluster(42, -72, 10, 14);
  cluster(-85, -108, 11, 16);
  cluster(85, -108, 11, 16);
  cluster(0, -145, 12, 17);
  cluster(-58, -180, 9, 14);
  cluster(62, -180, 9, 14);
  cluster(-135, -88, 8, 12);
  cluster(135, -88, 8, 12);

  // Flanks of the venue roads
  cluster(112, 74, 8, 12);
  cluster(120, 120, 8, 12);
  cluster(-112, 74, 8, 12);
  cluster(-124, 114, 8, 12);

  // Around the venues
  cluster(105, 155, 8, 13);
  cluster(64, 198, 8, 12);
  cluster(-118, 148, 8, 13);
  cluster(-88, 194, 8, 12);

  // Far open areas / corners
  cluster(-158, 36, 7, 12);
  cluster(158, 36, 7, 12);
  cluster(-152, -56, 7, 12);
  cluster(152, -56, 7, 12);
  cluster(-200, 90, 6, 14);
  cluster(200, 90, 6, 14);
  cluster(0, -230, 10, 20);

  if (treePts.length > 0) {
    const n = treePts.length;
    const iT = new THREE.InstancedMesh(state.sharedScenery.treeTrunkGeo, state.sharedScenery.treeTrunkMat, n);
    const iC1 = new THREE.InstancedMesh(state.sharedScenery.treeCone1Geo, state.sharedScenery.treeFoliageMat, n);
    const iC2 = new THREE.InstancedMesh(state.sharedScenery.treeCone2Geo, state.sharedScenery.treeFoliageMat, n);
    [iT, iC1, iC2].forEach(m => { m.castShadow = true; m.receiveShadow = true; });

    treePts.forEach(({ x, z, s }, i) => {
      const gy = getTerrainHeight(x, z);
      _t.scale.setScalar(s);
      _t.rotation.set(0, Math.random() * Math.PI * 2, 0);

      _t.position.set(x, gy + 2 * s, z); _t.updateMatrix(); iT.setMatrixAt(i, _t.matrix);
      _t.position.set(x, gy + 4.2 * s, z); _t.updateMatrix(); iC1.setMatrixAt(i, _t.matrix);
      _t.position.set(x, gy + 5.6 * s, z); _t.updateMatrix(); iC2.setMatrixAt(i, _t.matrix);
    });
    iT.instanceMatrix.needsUpdate = true;
    iC1.instanceMatrix.needsUpdate = true;
    iC2.instanceMatrix.needsUpdate = true;
    state.scene.add(iT);
    state.scene.add(iC1);
    state.scene.add(iC2);
  }

  // ── 2. PONDS ──────────────────────────────────────────────────────────────
  const pondDefs = [
    { x: 132, z: -32, r: 7 },
    { x: -136, z: -26, r: 6 },
    { x: 14, z: -122, r: 9 },
    { x: 172, z: 55, r: 6 },
    { x: -172, z: 50, r: 6 },
    { x: 65, z: 204, r: 7 },
    { x: -92, z: 198, r: 7 },
  ];

  // Batch all reeds across all ponds into one InstancedMesh
  const REEDS_PER_POND = 16;
  const reedGeo = new THREE.CylinderGeometry(0.035, 0.055, 1.0, 4);
  const reedMat = new THREE.MeshStandardMaterial({ color: '#4a7a20', roughness: 0.88 });
  const reedInst = new THREE.InstancedMesh(reedGeo, reedMat, pondDefs.length * REEDS_PER_POND);
  reedInst.castShadow = true;
  let ri = 0;

  pondDefs.forEach(({ x: cx, z: cz, r }) => {
    const by = getTerrainHeight(cx, cz);

    // Mud/earth ring
    const mud = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.80, r * 1.30, 48),
      new THREE.MeshStandardMaterial({ color: '#3b2618', roughness: 0.97 })
    );
    mud.rotation.x = -Math.PI / 2;
    mud.position.set(cx, by + 0.01, cz);
    mud.receiveShadow = true;
    state.scene.add(mud);

    // Gravel / stone apron
    const gravel = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.28, r * 1.62, 48),
      new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.82 })
    );
    gravel.rotation.x = -Math.PI / 2;
    gravel.position.set(cx, by + 0.009, cz);
    gravel.receiveShadow = true;
    state.scene.add(gravel);

    // Water surface
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.82, 48),
      new THREE.MeshStandardMaterial({
        color: '#0c4a6e', roughness: 0.04, metalness: 0.72,
        transparent: true, opacity: 0.84
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, by + 0.03, cz);
    water.receiveShadow = true;
    state.scene.add(water);

    // Bright shimmer overlay
    const shimmer = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.08, r * 0.48, 32),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8', roughness: 0.02, metalness: 0.28,
        transparent: true, opacity: 0.25, side: THREE.DoubleSide
      })
    );
    shimmer.rotation.x = -Math.PI / 2;
    shimmer.position.set(cx, by + 0.04, cz);
    state.scene.add(shimmer);

    // Pondside rocks
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.55;
      const rx = cx + Math.cos(ang) * (r * 1.05 + Math.random() * 1.5);
      const rz = cz + Math.sin(ang) * (r * 1.05 + Math.random() * 1.5);
      const rg = new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.45, 0);
      const rock = new THREE.Mesh(rg, state.sharedScenery.boulderMat);
      rock.position.set(rx, getTerrainHeight(rx, rz) + 0.07, rz);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      state.scene.add(rock);
    }

    // Reeds
    for (let i = 0; i < REEDS_PER_POND; i++) {
      const ang = (Math.PI * 2 * i) / REEDS_PER_POND + (Math.random() - 0.5) * 0.45;
      const rx = cx + Math.cos(ang) * (r * 0.65 + Math.random() * r * 0.45);
      const rz = cz + Math.sin(ang) * (r * 0.65 + Math.random() * r * 0.45);
      const rh = 0.7 + Math.random() * 0.95;
      _t.position.set(rx, getTerrainHeight(rx, rz) + rh * 0.5, rz);
      _t.scale.set(1, rh, 1);
      _t.rotation.set((Math.random() - 0.5) * 0.18, Math.random() * Math.PI * 2, 0);
      _t.updateMatrix();
      reedInst.setMatrixAt(ri++, _t.matrix);
    }

    // Soft collision barrier
    addSceneryCollider(cx - r * 0.72, cx + r * 0.72, cz - r * 0.72, cz + r * 0.72, `pond-${cx}-${cz}`);
    registerStaticScenery(water, { kind: 'outdoor', distance: 130 });
  });

  reedInst.instanceMatrix.needsUpdate = true;
  state.scene.add(reedInst);

  // ── 3. WILDFLOWER MEADOWS (InstancedMesh) ─────────────────────────────────
  const flowerColors = ['#f43f5e', '#eab308', '#3b82f6', '#a855f7', '#22c55e', '#f97316', '#fb923c'];
  const meadowDefs = [
    // East and west of venue roads
    { cx: 100, cz: 90, n: 50, r: 18 },
    { cx: -104, cz: 86, n: 50, r: 18 },
    // Open southern fields
    { cx: 86, cz: 24, n: 40, r: 16 },
    { cx: -86, cz: 24, n: 40, r: 16 },
    // Around venues
    { cx: 100, cz: 154, n: 38, r: 15 },
    { cx: -122, cz: 112, n: 38, r: 15 },
    // Northern meadows
    { cx: -24, cz: -96, n: 45, r: 17 },
    { cx: 24, cz: -96, n: 45, r: 17 },
    { cx: 0, cz: -182, n: 55, r: 22 },
    // Pond-side wildflowers
    ...pondDefs.map(({ x, z, r }) => ({ cx: x, cz: z, n: 24, r: r * 1.6 })),
  ];

  const mPts = [];
  meadowDefs.forEach(({ cx, cz, n, r }) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!isSafe(x, z)) continue;
      mPts.push({ x, z, s: 0.65 + Math.random() * 0.55, c: flowerColors[Math.floor(Math.random() * flowerColors.length)] });
    }
  });

  if (mPts.length > 0) {
    const mStem = new THREE.InstancedMesh(state.sharedScenery.flowerStemGeo, state.sharedScenery.flowerStemMat, mPts.length);
    const mCenter = new THREE.InstancedMesh(state.sharedScenery.flowerCenterGeo, state.sharedScenery.flowerCenterMat, mPts.length);
    mStem.castShadow = true;
    mCenter.castShadow = true;

    mPts.forEach(({ x, z, s, c }, i) => {
      const gy = getTerrainHeight(x, z);
      _t.scale.setScalar(s);
      _t.rotation.set(0, Math.random() * Math.PI * 2, 0);

      _t.position.set(x, gy + 0.25 * s, z); _t.updateMatrix(); mStem.setMatrixAt(i, _t.matrix);
      _t.position.set(x, gy + 0.50 * s, z); _t.updateMatrix(); mCenter.setMatrixAt(i, _t.matrix);
      mCenter.setColorAt(i, new THREE.Color(c));
    });
    mStem.instanceMatrix.needsUpdate = true;
    mCenter.instanceMatrix.needsUpdate = true;
    if (mCenter.instanceColor) mCenter.instanceColor.needsUpdate = true;
    state.scene.add(mStem);
    state.scene.add(mCenter);
  }

  // ── 4. EXTRA GRASS PATCHES (InstancedMesh) ────────────────────────────────
  const grassDefs = [
    { cx: 96, cz: 145, r: 25 },
    { cx: -100, cz: 130, r: 24 },
    { cx: 44, cz: -58, r: 22 },
    { cx: -44, cz: -58, r: 22 },
    { cx: 0, cz: -168, r: 28 },
    { cx: 160, cz: 24, r: 22 },
    { cx: -160, cz: 24, r: 22 },
    { cx: 130, cz: -30, r: 18 },
    { cx: -135, cz: -25, r: 18 },
  ];
  const BLADES_PER_SPOT = 40;

  const gPts = [];
  grassDefs.forEach(({ cx, cz, r }) => {
    for (let b = 0; b < BLADES_PER_SPOT; b++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!isSafe(x, z)) continue;
      for (let j = 0; j < 3; j++) {
        gPts.push({
          x: x + (Math.random() - 0.5) * 0.4,
          z: z + (Math.random() - 0.5) * 0.4,
          rx: (Math.random() - 0.5) * 0.4,
          ry: Math.random() * Math.PI * 2,
          rz: (Math.random() - 0.5) * 0.4,
          sy: 0.75 + Math.random() * 0.45
        });
      }
    }
  });

  if (gPts.length > 0) {
    const gInst = new THREE.InstancedMesh(state.sharedScenery.grassBladeGeo, state.sharedScenery.grassTuftMat, gPts.length);
    gInst.castShadow = true;
    gPts.forEach(({ x, z, rx, ry, rz, sy }, i) => {
      _t.position.set(x, getTerrainHeight(x, z), z);
      _t.rotation.set(rx, ry, rz);
      _t.scale.set(1, sy, 1);
      _t.updateMatrix();
      gInst.setMatrixAt(i, _t.matrix);
    });
    gInst.instanceMatrix.needsUpdate = true;
    state.scene.add(gInst);
  }
}
