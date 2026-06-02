// Realistic meandering river with shader-based water, foam edges, waterfall, and bridge
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';

const RIVER_PTS = [
  [200, -200], [160, -150], [115, -100], [75, -55],
  [70, -10], [75, 25], [50, 70], [10, 110],
  [-30, 150], [-80, 190], [-130, 220]
];

const RIVER_WIDTH = 4.5;
const BRIDGE_X = 73, BRIDGE_Z = 8;
const WATERFALL_X = 30, WATERFALL_Z = 90;

// Vertex/fragment shader for the water surface
const waterVertShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Two-octave wave displacement
    float wave1 = sin(pos.x * 0.8 + uTime * 1.2) * 0.04
                + sin(pos.y * 0.6 + uTime * 0.9 + 1.3) * 0.03;
    float wave2 = sin(pos.x * 0.3 + pos.y * 0.4 + uTime * 0.7) * 0.06
                + sin(pos.x * 0.5 - pos.y * 0.5 + uTime * 1.1) * 0.04;
    pos.z += wave1 + wave2;
    vElevation = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFragShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // Base deep blue
    vec3 deep = vec3(0.02, 0.12, 0.28);
    vec3 shallow = vec3(0.05, 0.25, 0.45);
    vec3 highlight = vec3(0.15, 0.50, 0.75);

    // Mix based on pseudo-depth (elevation offset from wave)
    float depthFactor = 0.5 + vElevation * 3.0;
    depthFactor = clamp(depthFactor, 0.0, 1.0);
    vec3 color = mix(deep, shallow, depthFactor);

    // Specular-like highlight based on view angle (simplified)
    float spec = pow(max(0.0, 0.5 + vElevation * 5.0), 8.0) * 0.3;
    color += highlight * spec;

    // Subtle time-based shimmer
    float shimmer = sin(vUv.x * 30.0 + uTime * 2.0) * sin(vUv.y * 20.0 - uTime * 1.5) * 0.03;
    color += shimmer;

    // Edge darkening
    float edgeDist = min(vUv.x, 1.0 - vUv.x) * 2.0;
    edgeDist = clamp(edgeDist, 0.0, 1.0);
    color *= (0.85 + edgeDist * 0.15);

    gl_FragColor = vec4(color, 0.82);
  }
`;

const foamVertShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const foamFragShader = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    // Procedural foam texture along the strip length
    float foam = sin(vUv.x * 80.0 + uTime * 1.5) * 0.5 + 0.5;
    foam *= sin(vUv.y * 30.0 - uTime * 0.8 + vUv.x * 10.0) * 0.5 + 0.5;
    foam = pow(foam, 3.0);
    foam *= 1.0 - vUv.y; // fades inward
    float alpha = foam * 0.35;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

export function buildRiver() {
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: waterVertShader,
    fragmentShader: waterFragShader,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
  });

  const foamMat = new THREE.ShaderMaterial({
    vertexShader: foamVertShader,
    fragmentShader: foamFragShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
  });

  // Build river segments
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const [ax, az] = RIVER_PTS[i];
    const [bx, bz] = RIVER_PTS[i + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.5) continue;
    const segAngle = Math.atan2(dx, -dz);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    // Water sits at the terrain height (which includes the 4.3u river channel depression)
    // plus a small offset so it's just above the channel bottom, well below the surface
    const waterY = getTerrainHeight(mx, mz) + 1.0;

    // Water surface with wave shader
    const segGeo = new THREE.PlaneGeometry(RIVER_WIDTH, len, 16, 16 * Math.ceil(len / 3));
    const seg = new THREE.Mesh(segGeo, waterMat.clone());
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.y = segAngle;
    seg.position.set(mx, waterY, mz);
    state.scene.add(seg);

    // Foam strips along each edge
    for (let side = -1; side <= 1; side += 2) {
      const perpAngle = Math.atan2(dz, dx) + Math.PI / 2;
      const fx = mx + Math.cos(perpAngle) * (RIVER_WIDTH / 2 - 0.1) * side;
      const fz = mz + Math.sin(perpAngle) * (RIVER_WIDTH / 2 - 0.1) * side;
      const foamGeo = new THREE.PlaneGeometry(0.3, len, 1, 8);
      const foam = new THREE.Mesh(foamGeo, foamMat.clone());
      foam.rotation.x = -Math.PI / 2;
      foam.rotation.y = segAngle;
      foam.position.set(fx, waterY + 0.01, fz);
      state.scene.add(foam);
    }
  }

  // ── Waterfall ────────────────────────────────────────────────────────
  buildWaterfall();

  // ── Boulders & rocks along the river ────────────────────────────────
  for (let i = 0; i < 25; i++) {
    const segIdx = Math.floor(Math.random() * (RIVER_PTS.length - 1));
    const [ax, az] = RIVER_PTS[segIdx];
    const [bx, bz] = RIVER_PTS[segIdx + 1];
    const frac = Math.random();
    const rx = ax + (bx - ax) * frac;
    const rz = az + (bz - az) * frac;
    const side = (Math.random() > 0.5 ? 1 : -1);
    const perpAngle = Math.atan2(bz - az, bx - ax) + Math.PI / 2;
    const offset = (RIVER_WIDTH / 2 + 0.6 + Math.random() * 2.5) * side;
    const bx3 = rx + Math.cos(perpAngle) * offset;
    const bz3 = rz + Math.sin(perpAngle) * offset;
    const rockY = getTerrainHeight(bx3, bz3);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.5, 0),
      new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true })
    );
    rock.position.set(bx3, rockY + 0.05, bz3);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.scale.set(1, 0.4 + Math.random() * 0.6, 1);
    rock.castShadow = true;
    state.scene.add(rock);
  }

  // ── Daffodils along the riverbanks ──────────────────────────────────
  for (let i = 0; i < 50; i++) {
    const segIdx = Math.floor(Math.random() * (RIVER_PTS.length - 1));
    const [ax, az] = RIVER_PTS[segIdx];
    const [bx, bz] = RIVER_PTS[segIdx + 1];
    const frac = Math.random();
    const fx2 = ax + (bx - ax) * frac;
    const fz2 = az + (bz - az) * frac;
    const side = (Math.random() > 0.5 ? 1 : -1);
    const perpAngle = Math.atan2(bz - az, bx - ax) + Math.PI / 2;
    const offset = (RIVER_WIDTH / 2 + 0.4 + Math.random() * 2.0) * side;
    const dax = fx2 + Math.cos(perpAngle) * offset;
    const daz = fz2 + Math.sin(perpAngle) * offset;
    const dy = getTerrainHeight(dax, daz);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.9 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 4), stemMat);
    stem.position.set(dax, dy + 0.2, daz);
    state.scene.add(stem);
    const petalMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.7 });
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), petalMat);
    center.position.set(dax, dy + 0.42, daz);
    state.scene.add(center);
  }

  // ── Stone arch bridge ────────────────────────────────────────────────
  buildStoneArchBridge();

  // Animate water and foam shaders each frame
  function animateRiver(time) {
    const t = time * 0.001;
    // Update all water material uniforms
    state.scene.traverse((child) => {
      if (child.isMesh && child.material && child.material.uniforms && child.material.uniforms.uTime) {
        child.material.uniforms.uTime.value = t;
      }
    });
  }

  state.animatedScenery.push({
    object: { userData: {} },
    type: 'river',
    update: animateRiver,
  });
}

function buildWaterfall() {
  const wx = WATERFALL_X, wz = WATERFALL_Z;

  const fallMat = new THREE.MeshStandardMaterial({
    color: '#7dd3fc', roughness: 0.02, metalness: 0.3,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide
  });
  const topY = getTerrainHeight(wx + 2, wz - 2) + 0.5;
  const botY = getTerrainHeight(wx - 2, wz + 2) + 0.5;
  const fallH = Math.max(0, topY - botY + 0.5);
  if (fallH > 0.5) {
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.5, fallH), fallMat);
    fall.position.set(wx, (topY + botY) / 2, wz);
    state.scene.add(fall);

    const mistMat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe', transparent: true, opacity: 0.12, side: THREE.DoubleSide
    });
    const mist = new THREE.Mesh(new THREE.CircleGeometry(2.0, 12), mistMat);
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(wx, botY + 0.05, wz);
    state.scene.add(mist);
  }

  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
    const d = 1.0 + Math.random() * 2.5;
    const rx = wx + Math.cos(a) * d;
    const rz = wz + Math.sin(a) * d;
    const ry = getTerrainHeight(rx, rz);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.5, 0),
      new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true })
    );
    rock.position.set(rx, ry + 0.05, rz);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.scale.set(1, 0.4 + Math.random() * 0.6, 1);
    rock.castShadow = true;
    state.scene.add(rock);
  }
}

function buildStoneArchBridge() {
  const bx = BRIDGE_X, bz = BRIDGE_Z;
  const brickMat = new THREE.MeshStandardMaterial({ color: '#8a7a5a', roughness: 0.78 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.7 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.75 });
  const roadMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 });

  // Find river angle at the bridge crossing
  let segAngle = 0;
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const [ax, az] = RIVER_PTS[i];
    const [bx2, bz2] = RIVER_PTS[i + 1];
    const midX = (ax + bx2) / 2, midZ = (az + bz2) / 2;
    if (Math.sqrt((midX - bx) ** 2 + (midZ - bz) ** 2) < 6) {
      segAngle = Math.atan2(bz2 - az, bx2 - ax);
      break;
    }
  }
  const perpAngle = segAngle + Math.PI / 2;

  const bridgeY = getTerrainHeight(bx, bz);
  const span = 5.0;       // half-span of the arch
  const archRise = 2.2;   // height of the arch above the springing point
  const springY = bridgeY + 0.2; // springing level (just above water)

  // ── Solid arch barrel (the curved underside) ────────────────────────
  // Circular arch: center at (0, springY + rise - R), radius R = (span²+rise²)/(2·rise)
  const archR = (span * span + archRise * archRise) / (2 * archRise);
  const centerY = springY + archRise - archR;
  const voussoirCount = 18;
  for (let i = 0; i < voussoirCount; i++) {
    const t = i / (voussoirCount - 1);
    const axOff = (t - 0.5) * span * 2; // -5 to +5
    const ayOff = centerY + Math.sqrt(Math.max(0, archR * archR - axOff * axOff));
    const w = 0.5;

    for (let row = -1; row <= 1; row++) {
      const rOff = row * 0.6;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.22, 0.3),
        i % 2 === 0 ? brickMat : stoneMat
      );
      block.position.set(
        bx + Math.cos(perpAngle) * rOff + Math.cos(segAngle) * axOff,
        ayOff + 0.11,
        bz + Math.sin(perpAngle) * rOff + Math.sin(segAngle) * axOff
      );
      block.castShadow = true;
      state.scene.add(block);
    }
  }

  // ── Spandrel fill (triangular panels between arch and deck) ─────────
  // Solid stone blocks filling the gap between the arch curve and the flat deck
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8;
      const xOff = (t - 0.5) * span * 2 * 0.85;
      const archH = Math.cos(Math.asin(Math.abs(t - 0.5) * 2)) * archRise;
      const fillH = (1.2 - 0.2) - archH * 0.6;
      if (fillH < 0.1) continue;
      const fill = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, fillH, 0.25),
        stoneMat
      );
      fill.position.set(
        bx + Math.cos(perpAngle) * side * 0.85 + Math.cos(segAngle) * xOff,
        springY + archH * 0.5 + fillH / 2,
        bz + Math.sin(perpAngle) * side * 0.85 + Math.sin(segAngle) * xOff
      );
      state.scene.add(fill);
    }
  }

  // ── Solid deck slab ─────────────────────────────────────────────────
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 2.8), stoneMat);
  deck.position.set(bx, springY + 1.1, bz);
  deck.rotation.y = -perpAngle;
  deck.castShadow = true;
  deck.receiveShadow = true;
  state.scene.add(deck);

  // ── Cobblestone road surface on deck ────────────────────────────────
  const road = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 2.4), roadMat);
  road.position.set(bx, springY + 1.2, bz);
  road.rotation.y = -perpAngle;
  road.receiveShadow = true;
  state.scene.add(road);

  // ── Parapet walls with crenellations ────────────────────────────────
  for (let side = -1; side <= 1; side += 2) {
    const pOff = side * 1.55;
    for (let i = 0; i < 10; i++) {
      const t = (i / 9) - 0.5;
      const px = bx + Math.cos(perpAngle) * pOff + Math.cos(segAngle) * t * 5;
      const pz = bz + Math.sin(perpAngle) * pOff + Math.sin(segAngle) * t * 5;
      // Solid wall segment
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.7, 0.18),
        stoneMat
      );
      seg.position.set(px, springY + 1.45, pz);
      seg.castShadow = true;
      state.scene.add(seg);
      // Merlon on top (every other one is raised)
      if (i % 2 === 0) {
        const merlon = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.25, 0.18),
          darkStoneMat
        );
        merlon.position.set(px, springY + 1.85, pz);
        state.scene.add(merlon);
      }
    }
  }

  // ── Approach ramps (stone slopes from bank up to bridge deck) ──────
  for (let side = -1; side <= 1; side += 2) {
    for (let step = 0; step < 5; step++) {
      const t = (step + 1) / 5;
      const axOff = side * (span + t * 2.5);
      const rampY = springY + t * 0.6;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.15, 2.2),
        stoneMat
      );
      stepMesh.position.set(
        bx + Math.cos(segAngle) * axOff,
        rampY + 0.075,
        bz + Math.sin(segAngle) * axOff
      );
      stepMesh.receiveShadow = true;
      stepMesh.castShadow = true;
      state.scene.add(stepMesh);
    }
  }

  // ── Cutwater / pier on each side (triangular deflection at water level) ──
  for (let side = -1; side <= 1; side += 2) {
    const cw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.35, 0.6, 6),
      darkStoneMat
    );
    cw.position.set(
      bx + Math.cos(perpAngle) * side * 1.2,
      springY + 0.3,
      bz + Math.sin(perpAngle) * side * 1.2
    );
    state.scene.add(cw);
  }
}
