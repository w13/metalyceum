// Shared scenery utilities — terrain ribbons, terrain helpers, colliders, water shader factory
import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../physics.js';
import { isWorldPlacementAllowed } from '../utils.js';

// ── Terrain deformation helpers ──────────────────────────────────────────
export function deformPlaneToTerrain(geometry, translateZ) {
  deformGroundGeometry(geometry, 0, translateZ);
}

export function deformGroundGeometry(geometry, centerX, centerZ, scaleX = 1, scaleY = 1) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i) * scaleX;
    const vy = pos.getY(i) * scaleY;
    const h = getTerrainHeight(centerX + vx, centerZ - vy);
    pos.setX(i, vx);
    pos.setY(i, vy);
    pos.setZ(i, h);
  }
  geometry.computeVertexNormals();
}

export function getTerrainCeiling(x, z, halfX = 0, halfZ = 0) {
  const sampleOffsets = [
    [0, 0],
    [-halfX, -halfZ], [-halfX, halfZ],
    [halfX, -halfZ], [halfX, halfZ],
    [-halfX, 0], [halfX, 0],
    [0, -halfZ], [0, halfZ]
  ];
  return sampleOffsets.reduce((maxHeight, [offsetX, offsetZ]) => {
    return Math.max(maxHeight, getTerrainHeight(x + offsetX, z + offsetZ));
  }, getTerrainHeight(x, z));
}

export function createGroundedPatch(geometry, material, centerX, centerZ, {
  yOffset = 0.02,
  scaleX = 1,
  scaleY = 1,
  receiveShadow = true,
  castShadow = false
} = {}) {
  deformGroundGeometry(geometry, centerX, centerZ, scaleX, scaleY);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(centerX, yOffset, centerZ);
  mesh.receiveShadow = receiveShadow;
  mesh.castShadow = castShadow;
  return mesh;
}

export function createGroundedRing(innerRadius, outerRadius, segments, material, centerX, centerZ, options = {}) {
  return createGroundedPatch(
    new THREE.RingGeometry(innerRadius, outerRadius, segments),
    material,
    centerX,
    centerZ,
    options
  );
}

export function addSceneryCollider(minX, maxX, minZ, maxZ, assetId) {
  state.PLACED_ASSET_COLLIDERS.push({ minX, maxX, minZ, maxZ, assetId });
}

/** Rejection-sample a world position that passes isWorldPlacementAllowed. */
export function samplePosition(margin = 20) {
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - margin);
    z = (Math.random() - 0.5) * (MAP_SIZE - margin);
  } while (!isWorldPlacementAllowed(x, z));
  return { x, z, groundY: getTerrainHeight(x, z) };
}

/** Compute length, angle, and deltas from (x1,z1) to (x2,z2). */
export function vec2LengthAngle(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  return { dx, dz, len, angle: Math.atan2(dz, dx) };
}

// ── Terrain-following ribbon (used by roads + river) ─────────────────────
export function buildTerrainRibbon(points, width, material, options = {}) {
  if (points.length < 2) return null;
  const {
    yOffset = 0, lateralOffset = 0, addUVs = false, verticalBias = 0,
  } = options;

  const positions = [];
  const indices = [];
  const uvs = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(i - 1, 0)];
    const next = points[Math.min(i + 1, points.length - 1)];

    const cx = prev[0] !== undefined ? prev[0] : prev.x;
    const cz = prev[1] !== undefined ? prev[1] : prev.z;
    const nx = next[0] !== undefined ? next[0] : next.x;
    const nz = next[1] !== undefined ? next[1] : next.z;
    let dx = nx - cx, dz = nz - cz;
    let tangentLen = Math.sqrt(dx * dx + dz * dz);
    if (tangentLen < 0.001) { dx = 0; dz = 1; tangentLen = 1; }
    const tx = dx / tangentLen, tz = dz / tangentLen;
    const rx = -tz, rz = tx;

    const ptx = points[i][0] !== undefined ? points[i][0] : points[i].x;
    const ptz = points[i][1] !== undefined ? points[i][1] : points[i].z;
    const centerX = ptx + rx * lateralOffset;
    const centerZ = ptz + rz * lateralOffset;
    const halfW = width / 2;

    const yL = getTerrainHeight(centerX - rx * halfW, centerZ - rz * halfW) + yOffset + (verticalBias > 0 ? verticalBias : 0);
    const yR = getTerrainHeight(centerX + rx * halfW, centerZ + rz * halfW) + yOffset + (verticalBias < 0 ? -verticalBias : 0);

    positions.push(centerX - rx * halfW, yL, centerZ - rz * halfW);
    positions.push(centerX + rx * halfW, yR, centerZ + rz * halfW);

    if (addUVs) uvs.push(0, i / points.length, 1, i / points.length);

    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (addUVs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Water shader factory ─────────────────────────────────────────────────
export function createWaterShader(opts = {}) {
  const {
    deepColor = [0.02, 0.12, 0.28],
    shallowColor = [0.05, 0.25, 0.45],
    highlightColor = [0.15, 0.50, 0.75],
    opacity = 0.82,
    waveFreq1 = 0.8, waveFreq2 = 0.3,
    waveAmp = 0.04,
  } = opts;

  return new THREE.ShaderMaterial({
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave1 = sin(pos.x * ${waveFreq1.toFixed(1)} + uTime * 1.2) * ${waveAmp.toFixed(3)}
                    + sin(pos.y * ${(waveFreq1 * 0.75).toFixed(1)} + uTime * 0.9 + 1.3) * ${(waveAmp * 0.75).toFixed(3)};
        float wave2 = sin(pos.x * ${waveFreq2.toFixed(1)} + pos.y * ${(waveFreq2 * 1.3).toFixed(1)} + uTime * 0.7) * ${(waveAmp * 1.5).toFixed(3)}
                    + sin(pos.x * ${(waveFreq2 * 1.7).toFixed(1)} - pos.y * ${(waveFreq2 * 1.7).toFixed(1)} + uTime * 1.1) * ${waveAmp.toFixed(3)};
        pos.z += wave1 + wave2;
        vElevation = pos.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        vec3 deep = vec3(${deepColor.join(',')});
        vec3 shallow = vec3(${shallowColor.join(',')});
        vec3 highlight = vec3(${highlightColor.join(',')});
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
        gl_FragColor = vec4(color, ${opacity.toFixed(2)});
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
  });
}

// ── Floor slab helper ─────────────────────────────────────────────────────
export function createFloor(w, d, mat, x, y, z, receiveShadow = true) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  if (receiveShadow) mesh.receiveShadow = true;
  return mesh;
}

// ── Boulder scatter ──────────────────────────────────────────────────────
const _boulderMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true });
export function scatterBoulders(centerX, centerZ, count, opts = {}) {
  const { minR = 0.25, maxR = 0.6, spread = 3.0, minDist = 1.0 } = opts;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = minDist + Math.random() * spread;
    const rx = centerX + Math.cos(a) * d;
    const rz = centerZ + Math.sin(a) * d;
    const ry = getTerrainHeight(rx, rz);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(minR + Math.random() * (maxR - minR), 0), _boulderMat);
    rock.position.set(rx, ry + 0.05, rz);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.scale.set(1, 0.4 + Math.random() * 0.5, 1);
    state.scene.add(rock);
  }
}
