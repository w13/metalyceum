// Meandering river with shader-based water, foam edges, waterfall pool, and bridge
import * as THREE from 'three';
import { RIVER_PTS } from '../config.js';
import { FLAT, HALF_PI } from '../math.js';
import { getTerrainHeight } from '../physics.js';
import { state } from '../state.js';

const RIVER_WIDTH = 8.0; // wider water mesh to fill the deepened channel
const BRIDGE_X = 73,
  BRIDGE_Z = 8;
const WATERFALL_X = 30,
  WATERFALL_Z = 90;

// ── Shaders ──────────────────────────────────────────────────────────────
const waterVertShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // uv.x = across width (0..1), uv.y = along river length (increases downstream)
    // Displace Y (vertical) so waves are surface ripples, not horizontal wiggles
    float wave1 = sin(vUv.x * 6.0 + uTime * 1.2) * 0.05
                + sin(vUv.y * 2.2 + uTime * 0.9 + 1.3) * 0.04;
    float wave2 = sin(vUv.x * 2.5 + vUv.y * 1.8 + uTime * 0.7) * 0.07
                + sin(vUv.x * 4.0 - vUv.y * 1.4 + uTime * 1.1) * 0.05;
    vElevation = wave1 + wave2;
    pos.y += vElevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const waterFragShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;
  void main() {
    vec3 deep = vec3(0.02, 0.12, 0.28);
    vec3 shallow = vec3(0.05, 0.25, 0.45);
    vec3 highlight = vec3(0.15, 0.50, 0.75);
    float depthFactor = 0.5 + vElevation * 3.0;
    depthFactor = clamp(depthFactor, 0.0, 1.0);
    vec3 color = mix(deep, shallow, depthFactor);
    float spec = pow(max(0.0, 0.5 + vElevation * 5.0), 8.0) * 0.3;
    color += highlight * spec;
    float shimmer = sin(vUv.x * 30.0 + uTime * 2.0) * sin(vUv.y * 20.0 - uTime * 1.5) * 0.03;
    color += shimmer;
    float edgeDist = min(vUv.x, 1.0 - vUv.x) * 2.0;
    edgeDist = clamp(edgeDist, 0.0, 1.0);
    color *= (0.85 + edgeDist * 0.15);
    gl_FragColor = vec4(color, 0.82);
  }
`;
const fallVertShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fallFragShader = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float flow = sin(vUv.y * 15.0 + uTime * 8.0) * 0.5 + 0.5;
    flow *= sin(vUv.x * 10.0 + uTime * 2.0) * 0.5 + 0.5;
    float streaks = sin(vUv.x * 60.0 + sin(vUv.y * 10.0) * 2.0) * 0.3 + 0.7;
    vec3 waterColor = vec3(0.3, 0.65, 0.9);
    vec3 foamColor = vec3(0.95, 0.98, 1.0);
    float foamFactor = pow(flow * streaks, 1.5) * 0.85;
    vec3 color = mix(waterColor, foamColor, foamFactor);
    gl_FragColor = vec4(color, 0.75);
  }
`;

// Helper to build a terrain-following river ribbon (shared by upper/lower)
function buildRiverRibbon(points, width, material, isUpper) {
  if (points.length < 2) return null;
  const positions = [];
  const indices = [];
  const uvs = [];
  let cumulativeDistance = 0;

  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(i - 1, 0)];
    const next = points[Math.min(i + 1, points.length - 1)];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const tangent = new THREE.Vector2(dx, dz);
    if (tangent.lengthSq() < 1e-6) tangent.set(0, 1);
    tangent.normalize();
    const right = new THREE.Vector2(-tangent.y, tangent.x);
    const [cx, cz] = points[i];
    let sampleX = cx;
    let sampleZ = cz;
    if (isUpper && i === points.length - 1) {
      sampleX = points[i - 1][0];
      sampleZ = points[i - 1][1];
    } else if (!isUpper && i === 0) {
      sampleX = points[i + 1][0];
      sampleZ = points[i + 1][1];
    }
    const waterY = getTerrainHeight(sampleX, sampleZ) + 1.0;
    const halfW = width / 2;
    positions.push(cx + right.x * halfW, waterY + 0.02, cz + right.y * halfW);
    positions.push(cx - right.x * halfW, waterY - 0.02, cz - right.y * halfW);
    uvs.push(0, cumulativeDistance / width, 1, cumulativeDistance / width);
    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    cumulativeDistance += Math.sqrt((next[0] - cx) ** 2 + (next[1] - cz) ** 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  state.scene.add(mesh);
  return mesh;
}

export function buildRiver() {
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: waterVertShader,
    fragmentShader: waterFragShader,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
  });

  const upperPts = RIVER_PTS.slice(0, 14);
  const lowerPts = RIVER_PTS.slice(13);
  const waterMaterials = [];
  const upperMat = waterMat.clone();
  const lowerMat = waterMat.clone();
  waterMaterials.push(upperMat.uniforms.uTime);
  waterMaterials.push(lowerMat.uniforms.uTime);
  buildRiverRibbon(upperPts, RIVER_WIDTH, upperMat, true);
  buildRiverRibbon(lowerPts, RIVER_WIDTH, lowerMat, false);

  // ── Boulders along the river ── (InstancedMesh — was 25 individual draw calls)
  const rockMat = state.sharedScenery.boulderMat;
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0); // base size; scale varies per instance
  const rockInstances = new THREE.InstancedMesh(rockGeo, rockMat, 25);
  rockInstances.castShadow = true;
  rockInstances.receiveShadow = true;
  const _rockObj = new THREE.Object3D();
  for (let i = 0; i < 25; i++) {
    const segIdx = Math.floor(Math.random() * (RIVER_PTS.length - 1));
    const [ax, az] = RIVER_PTS[segIdx];
    const [bx, bz] = RIVER_PTS[segIdx + 1];
    const frac = Math.random();
    const rx = ax + (bx - ax) * frac;
    const rz = az + (bz - az) * frac;
    const side = Math.random() > 0.5 ? 1 : -1;
    const perpAngle = Math.atan2(bz - az, bx - ax) + Math.PI / 2;
    const offset = (RIVER_WIDTH / 2 + 0.6 + Math.random() * 2.5) * side;
    const bx3 = rx + Math.cos(perpAngle) * offset;
    const bz3 = rz + Math.sin(perpAngle) * offset;
    const rockY = getTerrainHeight(bx3, bz3);
    const scaleX = 0.5 + Math.random();
    const scaleY = (0.4 + Math.random() * 0.6) * scaleX;
    _rockObj.position.set(bx3, rockY + 0.05, bz3);
    _rockObj.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    _rockObj.scale.set(scaleX, scaleY, scaleX);
    _rockObj.updateMatrix();
    rockInstances.setMatrixAt(i, _rockObj.matrix);
  }
  rockInstances.instanceMatrix.needsUpdate = true;
  state.scene.add(rockInstances);

  // ── Daffodils along the riverbanks ── (InstancedMesh — was 100 individual draw calls)
  const stemMat = new THREE.MeshStandardMaterial({
    color: '#22c55e',
    roughness: 0.9,
  });
  const petalMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    roughness: 0.7,
  });
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.4, 4);
  const headGeo = new THREE.SphereGeometry(0.04, 6, 6);
  const stemInstances = new THREE.InstancedMesh(stemGeo, stemMat, 50);
  const headInstances = new THREE.InstancedMesh(headGeo, petalMat, 50);
  stemInstances.castShadow = false;
  headInstances.castShadow = false;
  const _daffObj = new THREE.Object3D();
  for (let i = 0; i < 50; i++) {
    const segIdx = Math.floor(Math.random() * (RIVER_PTS.length - 1));
    const [ax, az] = RIVER_PTS[segIdx];
    const [bx, bz] = RIVER_PTS[segIdx + 1];
    const frac = Math.random();
    const fx2 = ax + (bx - ax) * frac;
    const fz2 = az + (bz - az) * frac;
    const side = Math.random() > 0.5 ? 1 : -1;
    const perpAngle = Math.atan2(bz - az, bx - ax) + Math.PI / 2;
    const offset = (RIVER_WIDTH / 2 + 0.4 + Math.random() * 2.0) * side;
    const dax = fx2 + Math.cos(perpAngle) * offset;
    const daz = fz2 + Math.sin(perpAngle) * offset;
    const dy = getTerrainHeight(dax, daz);
    _daffObj.position.set(dax, dy + 0.2, daz);
    _daffObj.rotation.set(0, Math.random() * Math.PI * 2, 0);
    _daffObj.scale.setScalar(1);
    _daffObj.updateMatrix();
    stemInstances.setMatrixAt(i, _daffObj.matrix);
    _daffObj.position.set(dax, dy + 0.42, daz);
    _daffObj.updateMatrix();
    headInstances.setMatrixAt(i, _daffObj.matrix);
  }
  stemInstances.instanceMatrix.needsUpdate = true;
  headInstances.instanceMatrix.needsUpdate = true;
  state.scene.add(stemInstances);
  state.scene.add(headInstances);

  // ── Waterfall ────────────────────────────────────────────────────────
  buildWaterfall(waterMaterials);

  buildStoneArchBridge();

  // ── Large lakes ──────────────────────────────────────────────────────
  const lakeMat = waterMat.clone();
  waterMaterials.push(lakeMat.uniforms.uTime);

  // Lake 1 — Northeast (250, -250), r=55
  const lake1Geo = new THREE.CircleGeometry(55, 32);
  const lake1 = new THREE.Mesh(lake1Geo, lakeMat);
  lake1.rotation.x = FLAT;
  lake1.position.set(250, getTerrainHeight(250, -250) + 1.0, -250);
  lake1.receiveShadow = true;
  state.scene.add(lake1);

  // Lake 2 — Southwest (-200, 280), r=45
  const lake2Geo = new THREE.CircleGeometry(45, 32);
  const lake2 = new THREE.Mesh(lake2Geo, lakeMat);
  lake2.rotation.x = FLAT;
  lake2.position.set(-200, getTerrainHeight(-200, 280) + 1.0, 280);
  lake2.receiveShadow = true;
  state.scene.add(lake2);

  function animateRiver(time) {
    const t = time * 0.001;
    for (let i = 0; i < waterMaterials.length; i++) waterMaterials[i].value = t;
  }

  state.animatedScenery.push({
    object: { userData: {} },
    type: 'river',
    update: animateRiver,
  });
}

// ── Waterfall — curtain + pool + foam + rocks ────────────────────────────
function buildWaterfall(waterMaterials) {
  const wx = WATERFALL_X,
    wz = WATERFALL_Z;

  // Sample terrain upstream (higher) and downstream (lower) of the cliff line
  // The waterfall line runs at angle -0.6 rad through (30,90)
  // Upstream = along (-sin, cos) = (0.565, 0.825), downstream = opposite
  const upX = wx + 5 * 0.565,
    upZ = wz + 5 * 0.825;
  const dnX = wx - 5 * 0.565,
    dnZ = wz - 5 * 0.825;
  const topY = getTerrainHeight(upX, upZ);
  const botY = getTerrainHeight(dnX, dnZ);
  const fallH = Math.max(1.0, topY - botY);

  // Waterfall curtain (shader-based falling water)
  const fallMat = new THREE.ShaderMaterial({
    vertexShader: fallVertShader,
    fragmentShader: fallFragShader,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
  });
  if (waterMaterials) waterMaterials.push(fallMat.uniforms.uTime);

  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(RIVER_WIDTH + 1.5, fallH),
    fallMat,
  );
  fall.position.set(wx, (topY + botY) / 2, wz);
  fall.rotation.y = Math.atan2(0.565, 0.825); // align with cliff line
  state.scene.add(fall);

  // Mist / splash at the base (translucent circle)
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#e0f2fe',
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const mist = new THREE.Mesh(new THREE.CircleGeometry(3.0, 16), mistMat);
  mist.rotation.x = FLAT;
  mist.position.set(wx, botY + 0.1, wz);
  state.scene.add(mist);

  // Pool at the base (small dark circle at bottom)
  const poolMat = new THREE.MeshBasicMaterial({
    color: '#0a3a5a',
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.5, 16), poolMat);
  pool.rotation.x = FLAT;
  pool.position.set(wx, botY + 0.05, wz);
  state.scene.add(pool);

  // Foam line at the cliff edge (top)
  const foamMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(RIVER_WIDTH + 1.5, 0.3),
    foamMat,
  );
  foam.position.set(wx, topY + 0.15, wz);
  foam.rotation.y = Math.atan2(0.565, 0.825);
  state.scene.add(foam);

  // Rocks around the base
  const wfRockMat = state.sharedScenery.boulderMat;
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.6;
    const d = 1.5 + Math.random() * 3.0;
    const rx = wx + Math.cos(a) * d;
    const rz = wz + Math.sin(a) * d;
    const ry = getTerrainHeight(rx, rz);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.6, 0),
      wfRockMat,
    );
    rock.position.set(rx, ry + 0.05, rz);
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    rock.scale.set(1, 0.4 + Math.random() * 0.5, 1);
    state.scene.add(rock);
  }
}

// ── Stone Arch Bridge ────────────────────────────────────────────────────
// Uses InstancedMesh for voussoirs, crenellations and ramp steps to reduce
// 54+ individual scene.add() calls to just 5 instanced draw calls.
function buildStoneArchBridge() {
  const bx = BRIDGE_X,
    bz = BRIDGE_Z;
  const brickMat = new THREE.MeshStandardMaterial({
    color: '#8a7a5a',
    roughness: 0.78,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.7,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: '#5a4a3a',
    roughness: 0.75,
  });
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.8,
  });

  let segAngle = 0;
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const [ax, az] = RIVER_PTS[i];
    const [bx2, bz2] = RIVER_PTS[i + 1];
    const midX = (ax + bx2) / 2,
      midZ = (az + bz2) / 2;
    if (Math.sqrt((midX - bx) ** 2 + (midZ - bz) ** 2) < 6) {
      segAngle = Math.atan2(bz2 - az, bx2 - ax);
      break;
    }
  }
  const perpAngle = segAngle + Math.PI / 2;

  // Use raw terrain (ignoring the bridge override) as the river-bottom reference.
  // This prevents the recursive getTerrainHeight call from returning the already-elevated
  // bridge deck height, which made the arch crown float ~2u above the road surface.
  const rawBridgeY = getTerrainHeight(bx, bz, true); // river bottom ≈ −6u here
  const deckSurfaceY = rawBridgeY + 3.6; // matches physics.js return value

  const span = 5.0;
  const archRise = 2.2;
  const archR = (span * span + archRise * archRise) / (2 * archRise);
  // Crown of arch = deckSurfaceY; centre of circular arc is that many units below the crown
  const centerY = deckSurfaceY - archR;

  // ── Arch voussoirs — batched into two InstancedMesh (alternating brick/stone)
  const voussoirCount = 18;
  const rowCount = 3;
  const totalBrick = Math.ceil(voussoirCount / 2) * rowCount; // even indices
  const totalStone = Math.floor(voussoirCount / 2) * rowCount; // odd indices
  const vGeo = new THREE.BoxGeometry(0.5, 0.22, 0.3);
  const brickInst = new THREE.InstancedMesh(vGeo, brickMat, totalBrick);
  const stoneInst = new THREE.InstancedMesh(vGeo, stoneMat, totalStone);
  brickInst.castShadow = true;
  stoneInst.castShadow = true;
  const _vo = new THREE.Object3D();
  let brickIdx = 0,
    stoneIdx = 0;
  for (let i = 0; i < voussoirCount; i++) {
    const t = i / (voussoirCount - 1);
    const axOff = (t - 0.5) * span * 2;
    const ayOff =
      centerY + Math.sqrt(Math.max(0, archR * archR - axOff * axOff));
    for (let row = -1; row <= 1; row++) {
      const rOff = row * 0.6;
      _vo.position.set(
        bx + Math.cos(perpAngle) * rOff + Math.cos(segAngle) * axOff,
        ayOff + 0.11,
        bz + Math.sin(perpAngle) * rOff + Math.sin(segAngle) * axOff,
      );
      _vo.rotation.set(0, 0, 0);
      _vo.scale.setScalar(1);
      _vo.updateMatrix();
      if (i % 2 === 0) {
        brickInst.setMatrixAt(brickIdx++, _vo.matrix);
      } else {
        stoneInst.setMatrixAt(stoneIdx++, _vo.matrix);
      }
    }
  }
  brickInst.instanceMatrix.needsUpdate = true;
  stoneInst.instanceMatrix.needsUpdate = true;
  state.scene.add(brickInst);
  state.scene.add(stoneInst);

  // Deck — centre at deckSurfaceY (box is 0.3 thick; top face = deckSurfaceY + 0.15)
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 2.8), stoneMat);
  deck.position.set(bx, deckSurfaceY, bz);
  deck.rotation.y = -perpAngle;
  deck.castShadow = true;
  deck.receiveShadow = true;
  state.scene.add(deck);

  const road = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 2.4), roadMat);
  road.position.set(bx, deckSurfaceY + 0.19, bz);
  road.rotation.y = -perpAngle;
  road.receiveShadow = true;
  state.scene.add(road);

  // ── Parapet walls with crenellations — batched into InstancedMesh per side
  const crenGeo = new THREE.BoxGeometry(0.55, 0.7, 0.18);
  const merlonGeo = new THREE.BoxGeometry(0.45, 0.25, 0.18);
  // 10 segments + 5 merlons per side × 2 sides = 20 crenInst, 10 merlonInst
  const crenInst = new THREE.InstancedMesh(crenGeo, stoneMat, 20);
  const merlonInst = new THREE.InstancedMesh(merlonGeo, darkStoneMat, 10);
  crenInst.castShadow = true;
  const _cv = new THREE.Object3D();
  let crenIdx = 0,
    merlonIdx = 0;
  for (let side = -1; side <= 1; side += 2) {
    const pOff = side * 1.55;
    for (let i = 0; i < 10; i++) {
      const t = i / 9 - 0.5;
      const px = bx + Math.cos(perpAngle) * pOff + Math.cos(segAngle) * t * 5;
      const pz = bz + Math.sin(perpAngle) * pOff + Math.sin(segAngle) * t * 5;
      _cv.position.set(px, deckSurfaceY + 0.5, pz);
      _cv.rotation.set(0, 0, 0);
      _cv.scale.setScalar(1);
      _cv.updateMatrix();
      crenInst.setMatrixAt(crenIdx++, _cv.matrix);
      if (i % 2 === 0) {
        _cv.position.set(px, deckSurfaceY + 0.9, pz);
        _cv.updateMatrix();
        merlonInst.setMatrixAt(merlonIdx++, _cv.matrix);
      }
    }
  }
  // Approach ramps — extend outward along the crossing direction (perpAngle), not along the river.
  // Steps interpolate from deckSurfaceY (inner) down to natural terrain (outer).
  for (let side = -1; side <= 1; side += 2) {
    for (let step = 0; step < 5; step++) {
      const t = (step + 1) / 5; // 0.2 → 1.0 going outward
      const dist = span * 0.5 + t * 4.5; // 3.0 → 7.0 units from centre
      const stepX = bx + Math.cos(perpAngle) * side * dist;
      const stepZ = bz + Math.sin(perpAngle) * side * dist;
      const groundY = getTerrainHeight(stepX, stepZ, true);
      // Height: starts near deckSurfaceY at t=0, reaches natural terrain at t=1
      const stepSurfaceY = deckSurfaceY + (groundY - deckSurfaceY) * t;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.15, 2.2),
        stoneMat,
      );
      stepMesh.position.set(stepX, stepSurfaceY + 0.075, stepZ);
      stepMesh.rotation.y = -perpAngle;
      stepMesh.receiveShadow = true;
      stepMesh.castShadow = true;
      state.scene.add(stepMesh);
    }
  }
}
