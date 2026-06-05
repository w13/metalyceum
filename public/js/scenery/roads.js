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

    const bridgeMat = new THREE.MeshStandardMaterial({ color: '#8a7a5a', roughness: 0.78 });
    const brX = 26, brZ = 93;
    const bridgeY = 0.15; // flush with the road on the banks
    const roadAngle = Math.atan2(13, 19);
    const tangent = new THREE.Vector3(Math.sin(roadAngle), 0, Math.cos(roadAngle));
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x);

    // 1. Raised road deck (oriented along roadAngle)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.25, 12.0), bridgeMat);
    deck.position.set(brX, bridgeY, brZ);
    deck.rotation.y = roadAngle;
    deck.castShadow = true;
    deck.receiveShadow = true;
    state.scene.add(deck);

    // 2. Pillars at both banks (local Z = -4.2 and 4.2)
    for (let offsetZ of [-4.2, 4.2]) {
      const px = brX + tangent.x * offsetZ;
      const pz = brZ + tangent.z * offsetZ;
      const pillarBaseY = getTerrainHeight(px, pz, true);
      const pillarH = Math.max(0.2, bridgeY - pillarBaseY);
      const pillarY = (bridgeY + pillarBaseY) / 2;

      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, pillarH, 1.5),
        bridgeMat
      );
      pillar.position.set(px, pillarY, pz);
      pillar.rotation.y = roadAngle;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      state.scene.add(pillar);
    }

    // 3. Curved arch underside
    const archCount = 10;
    for (let i = 0; i < archCount; i++) {
      const t = i / (archCount - 1);
      const theta = Math.PI * t;
      const localZ = Math.cos(theta) * 4.2;
      const localY = -Math.sin(theta) * 2.2 - 0.15;

      const px = brX + tangent.x * localZ;
      const pz = brZ + tangent.z * localZ;
      const py = bridgeY + localY;

      // Always render the arch block — if it's under the terrain it's invisible anyway,
      // but skipping it leaves gaps in the arch at the edges where terrain meets the banks.
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.25, 1.0),
        bridgeMat
      );
      block.position.set(px, py, pz);
      block.rotation.y = roadAngle;
      block.rotateX(theta - Math.PI / 2);
      block.castShadow = true;
      block.receiveShadow = true;
      state.scene.add(block);
    }

    // 4. Side walls (parapets) + posts
    for (let side of [-1, 1]) {
      const wallX = -right.x * side * 2.3;
      const wallZ = -right.z * side * 2.3;

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.7, 12.0),
        bridgeMat
      );
      wall.position.set(brX + wallX, bridgeY + 0.35, brZ + wallZ);
      wall.rotation.y = roadAngle;
      wall.castShadow = true;
      state.scene.add(wall);

      // Add small decorative posts
      for (let posZ of [-6.0, -3.0, 0, 3.0, 6.0]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.9, 0.25),
          bridgeMat
        );
        post.position.set(
          brX + wallX + tangent.x * posZ,
          bridgeY + 0.45,
          brZ + wallZ + tangent.z * posZ
        );
        post.rotation.y = roadAngle;
        post.castShadow = true;
        state.scene.add(post);
      }
    }

    // 5. Small transition ramps at the ends of the bridge
    for (let side of [-1, 1]) {
      const edgeZ = side * 6.0;
      const px = brX + tangent.x * edgeZ;
      const pz = brZ + tangent.z * edgeZ;
      const rampH = getTerrainHeight(px, pz, true);
      
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.1, 1.2),
        bridgeMat
      );
      ramp.position.set(
        px + tangent.x * side * 0.6,
        (bridgeY + rampH) / 2,
        pz + tangent.z * side * 0.6
      );
      ramp.rotation.y = roadAngle;
      ramp.receiveShadow = true;
      state.scene.add(ramp);
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
