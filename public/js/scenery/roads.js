// Roads and pathways construction for the outdoor campus
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';

export function buildRoads() {
  // - Road materials (polygonOffset prevents z-fighting with terrain)
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#334155', roughness: 0.85, metalness: 0.04,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const roadBorderMat = new THREE.MeshStandardMaterial({
    color: '#475569', roughness: 0.7, metalness: 0.08,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });

  function buildTerrainRibbon(points, width, material, yOffset, lateralOffset = 0) {
    if (points.length < 2) return;

    const positions = [];
    const indices = [];

    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(i - 1, 0)];
      const next = points[Math.min(i + 1, points.length - 1)];
      const tangent = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z);
      if (tangent.lengthSq() < 1e-6) tangent.set(0, 0, 1);
      tangent.normalize();

      const right = new THREE.Vector3(tangent.z, 0, -tangent.x);
      const centerX = points[i].x + right.x * lateralOffset;
      const centerZ = points[i].z + right.z * lateralOffset;
      const halfWidth = width / 2;
      const leftX = centerX - right.x * halfWidth;
      const leftZ = centerZ - right.z * halfWidth;
      const rightX = centerX + right.x * halfWidth;
      const rightZ = centerZ + right.z * halfWidth;

      positions.push(
        leftX, getTerrainHeight(leftX, leftZ) + yOffset, leftZ,
        rightX, getTerrainHeight(rightX, rightZ) + yOffset, rightZ
      );

      if (i < points.length - 1) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    state.scene.add(mesh);
  }

  function buildTerrainRoad(points, width) {
    buildTerrainRibbon(points, width, roadMat, 0.06);
    buildTerrainRibbon(points, 0.12, roadBorderMat, 0.09, width / 2);
    buildTerrainRibbon(points, 0.12, roadBorderMat, 0.09, -width / 2);
  }

  // - Road 1: Fountain plaza NE edge → Amphitheater (terrain-following)
  {
    const ampPts = [
      new THREE.Vector3(4.3, 0, 62.7),
      new THREE.Vector3(14,  0, 78),
      new THREE.Vector3(27,  0, 97),
      new THREE.Vector3(42,  0, 118),
      new THREE.Vector3(56,  0, 137),
      new THREE.Vector3(65,  0, 150)
    ];
    const curve = new THREE.CatmullRomCurve3(ampPts);
    const pts = curve.getPoints(72);
    buildTerrainRoad(pts, 5.0);

    // Bridge/culvert where the road crosses the river (approx. at x=26, z=93)
    // Build a raised stone bridge so the road goes OVER the river
    const bridgeMat = new THREE.MeshStandardMaterial({ color: '#8a7a5a', roughness: 0.78 });
    const brX = 26, brZ = 93;
    const brY = getTerrainHeight(brX, brZ);
    const bridgeH = 2.0; // height above riverbed
    const span = 5.0;

    // Raised road deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.3, 2.0), bridgeMat);
    deck.position.set(brX, brY + bridgeH, brZ);
    deck.castShadow = true;
    deck.receiveShadow = true;
    state.scene.add(deck);

    // Stone side walls (retaining walls) on each side
    for (let side = -1; side <= 1; side += 2) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, bridgeH + 0.2, 5.5), bridgeMat);
      wall.position.set(brX + side * 1.8, brY + (bridgeH + 0.2) / 2, brZ);
      wall.castShadow = true;
      state.scene.add(wall);
    }

    // Approach ramps (stepped stones on both sides)
    for (let side = -1; side <= 1; side += 2) {
      for (let step = 0; step < 4; step++) {
        const t = (step + 1) / 4;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 2.0), bridgeMat);
        ramp.position.set(brX + side * (t * 2.0 + 0.3), brY + t * 0.5, brZ);
        ramp.receiveShadow = true;
        state.scene.add(ramp);
      }
    }
  }

  // - Road 2: Fountain plaza NW edge → Concert Venue (terrain-following)
  {
    const cvPts = [
      new THREE.Vector3(-5.3, 0, 61.8),
      new THREE.Vector3(-18,  0, 68),
      new THREE.Vector3(-26,  0, 86),
      new THREE.Vector3(-38,  0, 104),
      new THREE.Vector3(-48,  0, 122),
      new THREE.Vector3(-60,  0, 140)
    ];
    const curve = new THREE.CatmullRomCurve3(cvPts);
    const pts = curve.getPoints(56);
    buildTerrainRoad(pts, 4.5);
  }

  // Road from fountain to bridge (bridge at (73, 8))
  {
    const roadPts = [
      new THREE.Vector3(4.3, 0, 62.7),
      new THREE.Vector3(12, 0, 52),
      new THREE.Vector3(22, 0, 42),
      new THREE.Vector3(34, 0, 33),
      new THREE.Vector3(46, 0, 25),
      new THREE.Vector3(58, 0, 18),
      new THREE.Vector3(66, 0, 12),
      new THREE.Vector3(73, 0, 8),
    ];
    roadPts.forEach(p => { p.y = getTerrainHeight(p.x, p.z) + 0.15; });
    const curve = new THREE.CatmullRomCurve3(roadPts);
    const pts = curve.getPoints(30);
    pts.forEach(p => { p.y = getTerrainHeight(p.x, p.z) + 0.15; });
    buildTerrainRoad(pts, 3.5);
  }

  // Road from bridge to castle (castle at (130, -80))
  {
    const roadPts = [
      new THREE.Vector3(73, 0, 8),
      new THREE.Vector3(82, 0, -5),
      new THREE.Vector3(94, 0, -22),
      new THREE.Vector3(108, 0, -42),
      new THREE.Vector3(120, 0, -62),
      new THREE.Vector3(130, 0, -80),
    ];
    roadPts.forEach(p => { p.y = getTerrainHeight(p.x, p.z) + 0.15; });
    const curve = new THREE.CatmullRomCurve3(roadPts);
    const pts = curve.getPoints(25);
    pts.forEach(p => { p.y = getTerrainHeight(p.x, p.z) + 0.15; });
    buildTerrainRoad(pts, 3.5);
  }
}
