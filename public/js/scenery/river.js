// Realistic meandering river with shader-based water, foam edges, waterfall, and bridge
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';

const RIVER_PTS = [
  [200, -200], [180, -175], [160, -150], [137, -125], [115, -100],
  [95, -77], [75, -55], [72, -32], [70, -10], [72, 7], [75, 25],
  [62, 47], [50, 70], [30, 90], [10, 110], [-10, 130],
  [-30, 150], [-55, 170], [-80, 190], [-105, 205], [-130, 220]
];

const RIVER_WIDTH = 8.5;
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
    float edgeDist = min(vUv.x, 1.0 - vUv.x);
    float darkFactor = clamp(edgeDist * 5.0, 0.0, 1.0);
    color *= (0.85 + darkFactor * 0.15);

    // Integrated procedural foam at the edges
    float foamWidth = 0.08; // 8% of the width on each side
    if (edgeDist < foamWidth) {
      float foamFactor = clamp((foamWidth - edgeDist) / foamWidth, 0.0, 1.0);
      
      // Animated noise along the river length and width
      float foamNoise = sin(vUv.y * 120.0 - uTime * 2.5) * 0.5 + 0.5;
      foamNoise *= sin(vUv.x * 40.0 + uTime * 1.2 + vUv.y * 10.0) * 0.5 + 0.5;
      foamNoise = pow(foamNoise, 2.5); // sharpen the foam pattern
      
      float finalFoam = foamNoise * foamFactor * 0.45;
      color = mix(color, vec3(0.95, 0.98, 1.0), finalFoam);
    }

    gl_FragColor = vec4(color, 0.82);
  }
`;

// Shaders for the vertical waterfall
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
    // Water fall effect: scrolling texture and noise
    float flow = sin(vUv.y * 15.0 + uTime * 8.0) * 0.5 + 0.5;
    flow *= sin(vUv.x * 10.0 + uTime * 2.0) * 0.5 + 0.5;
    
    // Add vertical streaks
    float streaks = sin(vUv.x * 60.0 + sin(vUv.y * 10.0) * 2.0) * 0.3 + 0.7;
    
    vec3 waterColor = vec3(0.3, 0.65, 0.9);
    vec3 foamColor = vec3(0.95, 0.98, 1.0);
    
    float foamFactor = pow(flow * streaks, 1.5) * 0.85;
    vec3 color = mix(waterColor, foamColor, foamFactor);
    
    gl_FragColor = vec4(color, 0.75);
  }
`;

function buildRiverRibbon(points, width, material, isUpper) {
  if (points.length < 2) return null;

  const positions = [];
  const indices = [];
  const uvs = [];

  let cumulativeDistance = 0;

  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(i - 1, 0)];
    const next = points[Math.min(i + 1, points.length - 1)];

    // Calculate tangent in XZ plane
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    
    const tangent = new THREE.Vector2(dx, dz);
    if (tangent.lengthSq() < 1e-6) tangent.set(0, 1);
    tangent.normalize();

    // Perpendicular vector (pointing to the right side of the river flow)
    const right = new THREE.Vector2(-tangent.y, tangent.x);

    const [cx, cz] = points[i];

    // Determine the height (waterY) at this point along the river
    let sampleX = cx;
    let sampleZ = cz;

    if (isUpper && i === points.length - 1) {
      // Last point of upper river: sample slightly upstream to get the upper level height
      const pdx = cx - prev[0];
      const pdz = cz - prev[1];
      sampleX = cx - pdx * 0.05;
      sampleZ = cz - pdz * 0.05;
    } else if (!isUpper && i === 0) {
      // First point of lower river: sample slightly downstream to get the lower level height
      const ndx = next[0] - cx;
      const ndz = next[1] - cz;
      sampleX = cx + ndx * 0.05;
      sampleZ = cz + ndz * 0.05;
    }

    const waterY = getTerrainHeight(sampleX, sampleZ) + 2.2;

    const halfWidth = width / 2;
    // Compute left and right coordinates of the ribbon in world space
    const lx = cx - right.x * halfWidth;
    const lz = cz - right.y * halfWidth;
    const rx = cx + right.x * halfWidth;
    const rz = cz + right.y * halfWidth;

    // Map to local coordinates before rotation: (lx, -lz, waterY)
    positions.push(
      lx, -lz, waterY, // Left bank vertex
      rx, -rz, waterY  // Right bank vertex
    );

    // Calculate cumulative distance for UV mapping
    if (i > 0) {
      const pdx = cx - points[i - 1][0];
      const pdz = cz - points[i - 1][1];
      cumulativeDistance += Math.sqrt(pdx * pdx + pdz * pdz);
    }

    const vCoord = cumulativeDistance / width;
    uvs.push(
      0, vCoord, // Left bank vertex
      1, vCoord  // Right bank vertex
    );

    if (i < points.length - 1) {
      const base = i * 2;
      // Triangle 1: base, base + 2, base + 1
      // Triangle 2: base + 1, base + 2, base + 3
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
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

  // Construct upper and lower river ribbons (waterfall is at index 13)
  const upperPts = RIVER_PTS.slice(0, 14);
  const lowerPts = RIVER_PTS.slice(13);

  buildRiverRibbon(upperPts, RIVER_WIDTH, waterMat.clone(), true);
  buildRiverRibbon(lowerPts, RIVER_WIDTH, waterMat.clone(), false);

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
    // Update all water and waterfall material uniforms
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

  // We sample slightly upstream/downstream along flow vector (-1, 1) for top and bottom heights
  const topY = getTerrainHeight(wx + 0.1, wz - 0.1) + 2.2;
  const botY = getTerrainHeight(wx - 0.1, wz + 0.1) + 2.2;
  const fallH = Math.max(0.1, topY - botY);

  const fallMat = new THREE.ShaderMaterial({
    vertexShader: fallVertShader,
    fragmentShader: fallFragShader,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
  });

  const fall = new THREE.Mesh(new THREE.PlaneGeometry(RIVER_WIDTH, fallH), fallMat);
  const cy = (topY + botY) / 2;
  fall.position.set(wx, cy, wz);

  // Rotate to align with the ledge (flow is at angle 3 * Math.PI / 4)
  fall.rotation.y = Math.atan2(-1, 1);
  state.scene.add(fall);

  const mistMat = new THREE.MeshBasicMaterial({
    color: '#e0f2fe', transparent: true, opacity: 0.12, side: THREE.DoubleSide
  });
  const mist = new THREE.Mesh(new THREE.CircleGeometry(2.0, 12), mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(wx, botY + 0.05, wz);
  state.scene.add(mist);

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

  const waterY = getTerrainHeight(bx, bz, true) + 2.2;
  const span = 5.0;       // half-span of the arch
  const archRise = 2.2;   // height of the arch above the springing point
  const springY = waterY + 0.2; // springing level (just above water)

  // ── Solid arch barrel (the curved underside) ────────────────────────
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
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.7, 0.18),
        stoneMat
      );
      seg.position.set(px, springY + 1.45, pz);
      seg.castShadow = true;
      state.scene.add(seg);
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
