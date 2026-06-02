// Procedural instanced details: forest trees, wildflower meadows, ponds, and grass patches
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { isFrontPlazaFootprint, isVenueRoadFootprint, AMP_ROAD_SEGMENTS, CV_ROAD_SEGMENTS } from '../utils.js';
import { registerStaticScenery } from './visibility.js';
import { deformGroundGeometry, addSceneryCollider } from './utils.js';
import { FLAT, HALF_PI } from '../math.js';

export function buildWorldDetails() {
  const _t = new THREE.Object3D();

  // Returns false if the point overlaps a road, building, or venue.
  function isSafe(x, z) {
    if (Math.abs(x) < 33 && Math.abs(z) < 45) return false;           // main building
    if (isFrontPlazaFootprint(x, z)) return false;
    if (isVenueRoadFootprint(x, z, 4)) return false;
    if (Math.abs(x - 65) < 42 && Math.abs(z - 150) < 42) return false; // amphitheater platform
    if (Math.abs(x + 85) < 27 && Math.abs(z - 140) < 21) return false; // concert hall footprint
    if (Math.abs(x - 160) < 55 && Math.abs(z - 220) < 55) return false; // airport
    if (Math.abs(x - 75) < 25 && Math.abs(z - 25) < 25) return false;   // cave & underground city
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
    { x: 14, z: -110, r: 7 },       // shifted north, shrunk — clear of tree cluster (0,-145)
    { x: 172, z: 55, r: 6 },
    { x: -150, z: 72, r: 5 },       // moved — clear of tree cluster (-158,36) and venue road
    { x: 30, z: 215, r: 5 },        // moved — clear of tree cluster (64,198), north of amphitheater
    { x: -50, z: 215, r: 5 },       // moved — east of river (river at z=215 is at x≈-122)
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
    mud.rotation.x = FLAT;
    mud.position.set(cx, by + 0.01, cz);
    mud.receiveShadow = true;
    state.scene.add(mud);

    // Gravel / stone apron
    const gravel = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.28, r * 1.62, 48),
      new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.82 })
    );
    gravel.rotation.x = FLAT;
    gravel.position.set(cx, by + 0.009, cz);
    gravel.receiveShadow = true;
    state.scene.add(gravel);

    // Water surface — ShaderMaterial with vertex waves
    const waterUniforms = { uTime: { value: 0 } };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float wave = sin(pos.x * 0.5 + uTime * 1.2) * 0.04
                     + sin(pos.y * 0.3 + uTime * 0.8 + 1.7) * 0.025
                     + sin((pos.x + pos.y) * 0.2 + uTime * 0.6) * 0.02;
          pos.z += wave;
          vElevation = wave;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          vec3 deep = vec3(0.02, 0.12, 0.28);
          vec3 shallow = vec3(0.05, 0.25, 0.45);
          vec3 highlight = vec3(0.15, 0.50, 0.75);
          float depthFactor = 0.5 + vElevation * 4.0;
          depthFactor = clamp(depthFactor, 0.0, 1.0);
          vec3 color = mix(deep, shallow, depthFactor);
          float spec = pow(max(0.0, 0.5 + vElevation * 6.0), 8.0) * 0.3;
          color += highlight * spec;
          float shimmer2 = sin(vUv.x * 25.0 + uTime * 1.8) * sin(vUv.y * 18.0 - uTime * 1.2) * 0.04;
          color += shimmer2;
          float edgeDist = min(vUv.x, 1.0 - vUv.x);
          float darkFactor = clamp(edgeDist * 4.0, 0.0, 1.0);
          color *= (0.85 + darkFactor * 0.15);
          gl_FragColor = vec4(color, 0.84);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, 48), waterMat);
    water.rotation.x = FLAT;
    water.position.set(cx, by + 0.03, cz);
    water.receiveShadow = true;
    water.userData.waterUniforms = waterUniforms;
    state.scene.add(water);

    // Bright shimmer overlay — still a static decorative ring
    const shimmer = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.08, r * 0.48, 32),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8', roughness: 0.02, metalness: 0.28,
        transparent: true, opacity: 0.25, side: THREE.DoubleSide
      })
    );
    shimmer.rotation.x = FLAT;
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

    // ── Daffodils at the water's edge (10 per pond) ─────────────────────
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.6;
      const dx = cx + Math.cos(ang) * (r * 0.82 + Math.random() * 0.3);
      const dz = cz + Math.sin(ang) * (r * 0.82 + Math.random() * 0.3);
      const dy = getTerrainHeight(dx, dz);
      const stemH = 0.3 + Math.random() * 0.15;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.02, stemH, 4),
        state.sharedScenery.flowerStemMat
      );
      stem.position.set(dx, dy + stemH / 2, dz);
      state.scene.add(stem);
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.7 })
      );
      petal.position.set(dx, dy + stemH + 0.02, dz);
      state.scene.add(petal);
    }

    // ── Turbulence rocks (2 large, partially submerged) ─────────────────
    const rockRipples = [];
    for (let i = 0; i < 2; i++) {
      const ang = (Math.PI * 2 * i) / 2 + (Math.random() - 0.5) * 0.8;
      const rockR = 0.4 + Math.random() * 0.3;
      const rockDist = r * 0.35;
      const rx = cx + Math.cos(ang) * rockDist;
      const rz = cz + Math.sin(ang) * rockDist;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rockR, 0),
        state.sharedScenery.boulderMat
      );
      rock.position.set(rx, by + 0.03 + rockR * 0.35, rz);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.scale.set(1, 0.5 + Math.random() * 0.3, 1);
      rock.castShadow = true;
      state.scene.add(rock);

      // Ripple ring around the rock
      const rippleMat = new THREE.MeshBasicMaterial({
        color: '#7dd3fc', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false
      });
      const ripple = new THREE.Mesh(new THREE.RingGeometry(rockR * 0.6, rockR * 1.2, 24), rippleMat);
      ripple.rotation.x = FLAT;
      ripple.position.set(rx, by + 0.035, rz);
      ripple.userData = {
        baseOpacity: 0.12 + Math.random() * 0.10,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.6,
        scaleSpeed: 0.5 + Math.random() * 0.4,
      };
      state.scene.add(ripple);
      rockRipples.push(ripple);
    }
    // Store ripple data for animation
    water.userData.ripples = rockRipples;

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
    // Wind-animated ShaderMaterial for stems
    const stemWindUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#22c55e') } };
    const stemWindMat = new THREE.ShaderMaterial({
      uniforms: stemWindUniforms,
      vertexShader: `
        uniform float uTime;
        void main() {
          vec3 pos = position;
          float h = pos.y * 2.0;
          float wind = sin(pos.x * 1.2 + uTime * 1.5 + pos.z * 0.8) * 0.12
                     + sin(pos.x * 0.6 + uTime * 0.9 + pos.z * 0.4) * 0.06;
          pos.x += wind * h;
          pos.z += wind * 0.4 * h;
          vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        void main() {
          float light = 0.55 + 0.45 * max(0.0, dot(vec3(0.5, 0.8, 0.3), vec3(0, 1, 0)));
          gl_FragColor = vec4(uColor * light, 1.0);
        }
      `,
    });
    // Wind-animated ShaderMaterial for flower centers (with vertex color for per-flower tint)
    const centerWindMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        varying vec3 vColor;
        void main() {
          vColor = instanceColor;
          vec3 pos = position;
          float wind = sin(pos.x * 1.2 + uTime * 1.5 + pos.z * 0.8) * 0.08
                     + sin(pos.x * 0.6 + uTime * 0.9 + pos.z * 0.4) * 0.04;
          pos.x += wind;
          pos.z += wind * 0.4;
          vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float light = 0.55 + 0.45 * max(0.0, dot(vec3(0.5, 0.8, 0.3), vec3(0, 1, 0)));
          gl_FragColor = vec4(vColor * light, 1.0);
        }
      `,
    });

    const mStem = new THREE.InstancedMesh(state.sharedScenery.flowerStemGeo, stemWindMat, mPts.length);
    const mCenter = new THREE.InstancedMesh(state.sharedScenery.flowerCenterGeo, centerWindMat, mPts.length);
    mStem.castShadow = true;
    mCenter.castShadow = true;
    mStem.userData.windUniforms = stemWindUniforms;
    mCenter.userData.windUniforms = { uTime: { value: 0 } };

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
    state.animatedScenery.push({
      object: { userData: {} },
      type: 'river',
      update: function (time) {
        const t = time * 0.001;
        stemWindUniforms.uTime.value = t;
        centerWindMat.uniforms.uTime.value = t;
      },
    });
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

  // ── Pond water + ripple animation ───────────────────────────────────────
  // Collect all pond water meshes and their ripple data from the scene
  const pondWaterMeshes = [];
  state.scene.traverse((child) => {
    if (child.isMesh && child.userData && child.userData.waterUniforms && child.userData.ripples) {
      pondWaterMeshes.push(child);
    }
  });
  if (pondWaterMeshes.length > 0) {
    state.animatedScenery.push({
      object: { userData: {} },
      type: 'river',
      update: function (time) {
        const t = time * 0.001;
        for (let p = 0; p < pondWaterMeshes.length; p++) {
          const water = pondWaterMeshes[p];
          // Update water shader time
          if (water.userData.waterUniforms) {
            water.userData.waterUniforms.uTime.value = t;
          }
          // Animate ripple rings around turbulence rocks
          const ripples = water.userData.ripples;
          if (ripples) {
            for (let r = 0; r < ripples.length; r++) {
              const ring = ripples[r];
              const ud = ring.userData;
              const pulse = Math.sin(t * ud.speed + ud.phase) * 0.5 + 0.5;
              const scalePulse = 0.96 + Math.sin(t * ud.scaleSpeed + ud.phase * 1.3) * 0.06;
              ring.scale.setScalar(scalePulse);
              ring.material.opacity = ud.baseOpacity * (0.5 + pulse * 0.5);
            }
          }
        }
      },
    });
  }
}
