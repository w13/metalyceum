// Large outdoor venues (Amphitheater & Concert Venue) and pathways
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { createBrickTexture, createStoneTexture } from '../textures.js';
import { registerStaticScenery } from './visibility.js';
import { vec2LengthAngle } from './utils.js';
import { FOUNTAIN_X, FOUNTAIN_Z } from './plaza.js';

export function buildOutdoorVenues() {
  const fx = FOUNTAIN_X, fz = FOUNTAIN_Z;

  // - Road materials (polygonOffset prevents z-fighting with terrain)
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#334155', roughness: 0.85, metalness: 0.04,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const roadBorderMat = new THREE.MeshStandardMaterial({
    color: '#475569', roughness: 0.7, metalness: 0.08,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });

  // - Helper: build a straight road segment
  function buildRoad(x1, z1, x2, z2, width) {
    const { len } = vec2LengthAngle(x1, z1, x2, z2);
    if (len < 0.5) return;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    const terrainY = getTerrainHeight(mx, mz);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(width, len),
      roadMat
    );
    road.rotation.x = -Math.PI / 2;
    road.rotation.y = Math.atan2(dx, -dz);
    road.position.set(mx, terrainY + 0.04, mz);
    road.receiveShadow = true;
    state.scene.add(road);

    addRoadBorders(mx, mz, dx, dz, width, len, 0.045);
  }

  /** Place two border strips along the edges of a road segment. */
  function addRoadBorders(mx, mz, dx, dz, width, len, yOff) {
    const perpAngle = Math.atan2(dz, dx) + Math.PI / 2;
    [-1, 1].forEach((side) => {
      const bx = mx + Math.cos(perpAngle) * (width / 2) * side;
      const bz = mz + Math.sin(perpAngle) * (width / 2) * side;
      const borderY = getTerrainHeight(bx, bz);
      const border = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, len),
        roadBorderMat
      );
      border.rotation.x = -Math.PI / 2;
      border.rotation.y = Math.atan2(dx, -dz);
      border.position.set(bx, borderY + yOff, bz);
      state.scene.add(border);
    });
  }

  // - Helper: build a 3D terrain-following road segment
  function buildRoadSegment3D(p1, p2, width) {
    const direction = new THREE.Vector3().subVectors(p2, p1);
    const len = direction.length();
    if (len < 0.1) return;

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(width, len),
      roadMat
    );

    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    road.position.copy(midpoint);

    const target = new THREE.Vector3().copy(midpoint).add(direction);
    road.lookAt(target);
    road.rotateX(Math.PI / 2);
    road.receiveShadow = true;
    state.scene.add(road);

    // Side borders
    [-1, 1].forEach((side) => {
      const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
      const bp1 = new THREE.Vector3().copy(p1).addScaledVector(right, (width / 2) * side);
      const bp2 = new THREE.Vector3().copy(p2).addScaledVector(right, (width / 2) * side);
      
      bp1.y = getTerrainHeight(bp1.x, bp1.z) + 0.045;
      bp2.y = getTerrainHeight(bp2.x, bp2.z) + 0.045;

      const bDir = new THREE.Vector3().subVectors(bp2, bp1);
      const bLen = bDir.length();
      const bMid = new THREE.Vector3().addVectors(bp1, bp2).multiplyScalar(0.5);

      const border = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, bLen),
        roadBorderMat
      );
      border.position.copy(bMid);
      border.lookAt(new THREE.Vector3().copy(bMid).add(bDir));
      border.rotateX(Math.PI / 2);
      state.scene.add(border);
    });
  }

  // - Road 1: Fountain plaza NE edge -> Amphitheater (65, 150)
  // CatmullRom + per-segment terrain sampling — follows the hills rather than
  // floating at a single midpoint height the way the old buildRoad did.
  {
    const ampPts = [
      new THREE.Vector3(4.3, 0, 62.7),
      new THREE.Vector3(14,  0, 78),
      new THREE.Vector3(27,  0, 97),
      new THREE.Vector3(42,  0, 118),
      new THREE.Vector3(56,  0, 137),
      new THREE.Vector3(65,  0, 150),
    ];
    ampPts.forEach(p => { p.y = getTerrainHeight(p.x, p.z) + 0.04; });
    const ampCurve = new THREE.CatmullRomCurve3(ampPts);
    const ampSegPts = ampCurve.getPoints(28);
    ampSegPts.forEach(p => { p.y = getTerrainHeight(p.x, p.z) + 0.04; });
    for (let i = 0; i < ampSegPts.length - 1; i++) buildRoadSegment3D(ampSegPts[i], ampSegPts[i + 1], 5.0);
  }

  // - Road 2: Fountain plaza NW edge -> Concert Venue Entrance (Meandering & Terrain-Following)
  const curvePoints = [
    new THREE.Vector3(-5.3, 0, 61.8),
    new THREE.Vector3(-18.0, 0, 68.0),
    new THREE.Vector3(-26.0, 0, 86.0),
    new THREE.Vector3(-38.0, 0, 104.0),
    new THREE.Vector3(-48.0, 0, 122.0),
    new THREE.Vector3(-60.0, 0, 140.0)
  ];
  curvePoints.forEach(p => {
    p.y = getTerrainHeight(p.x, p.z) + 0.04;
  });

  const pathCurve = new THREE.CatmullRomCurve3(curvePoints);
  const divisions = 15;
  const pathPoints = pathCurve.getPoints(divisions);

  // Re-sample Y for exact terrain following at each step
  pathPoints.forEach(p => {
    p.y = getTerrainHeight(p.x, p.z) + 0.04;
  });

  // Render segments
  for (let i = 0; i < pathPoints.length - 1; i++) {
    buildRoadSegment3D(pathPoints[i], pathPoints[i+1], 4.5);
  }

  // - Road 3: Fountain plaza S edge -> Main Building Entrance (0, 42)
  buildRoad(0, 49.0, 0, 42, 5.0);

  buildAmphitheater();
  buildConcertVenue();
}

export function buildAmphitheater() {
  const ax = 65, az = 150;
  const baseY = getTerrainHeight(ax, az);

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.78 });
  const warmStoneMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.7 });
  const seatMat = new THREE.MeshStandardMaterial({ color: '#57534e', roughness: 0.75, flatShading: true });
  const stageMat = new THREE.MeshStandardMaterial({ color: '#4a5568', roughness: 0.6, metalness: 0.08 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.15, metalness: 0.05 });
  const screenMat = state.sharedScenery.screenMat;
  const bronzeMat = state.sharedScenery.bronzeMat;
  const stageAngle = Math.PI * 0.25;
  const cosSA = Math.cos(stageAngle);
  const sinSA = Math.sin(stageAngle);
  const perpAngle = stageAngle + Math.PI / 2;
  const cosPA = Math.cos(perpAngle);
  const sinPA = Math.sin(perpAngle);
  const rowCount = 12;
  const rowStartRadius = 9;
  const rowSpacing = 2.0;
  const rowHeightStep = 0.5;
  const arcAngle = Math.PI * 0.85; // ~153° arc
  const outerRadius = rowStartRadius + (rowCount - 1) * rowSpacing + 0.5; // 31.5

  // ── Terrain sampler for seating rows ───────────────────────────────────
  // Blends from flat (inner rows near orchestra) to terrain-following (outer rows).
  function rowTerrainOffset(radius) {
    const flatRadius = 10;
    if (radius <= flatRadius) return 0;
    const blend = Math.min((radius - flatRadius) / (outerRadius - flatRadius), 1);
    const angles = [-arcAngle / 2, 0, arcAngle / 2];
    let sum = 0;
    for (const theta of angles) {
      const worldAngle = -(theta + Math.PI * 0.25);
      const sx = ax + Math.cos(worldAngle) * radius;
      const sz = az - Math.sin(worldAngle) * radius;
      sum += getTerrainHeight(sx, sz) - baseY;
    }
    return sum / angles.length * blend;
  }

  // ── Ground platform ─────────────────────────────────────────────────────
  const platform = new THREE.Mesh(
    new THREE.CircleGeometry(34, 48),
    new THREE.MeshStandardMaterial({ color: '#3a5a3a', roughness: 0.85 })
  );
  platform.rotation.x = -Math.PI / 2;
  platform.position.set(ax, baseY + 0.02, az);
  platform.receiveShadow = true;
  state.scene.add(platform);

  // ── Orchestra (marble floor) ────────────────────────────────────────────
  const orchestra = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 36),
    marbleMat
  );
  orchestra.rotation.x = -Math.PI / 2;
  orchestra.position.set(ax, baseY + 0.03, az);
  orchestra.receiveShadow = true;
  state.scene.add(orchestra);

  // Orchestra border ring
  const orchestraBorder = new THREE.Mesh(
    new THREE.RingGeometry(7.4, 7.7, 36),
    new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5 })
  );
  orchestraBorder.rotation.x = -Math.PI / 2;
  orchestraBorder.position.set(ax, baseY + 0.035, az);
  state.scene.add(orchestraBorder);

  // ── Stepped seating (concentric arcs) ────────────────────────────────────
  for (let row = 0; row < rowCount; row++) {
    const radius = rowStartRadius + row * rowSpacing;
    const segments = 24 + row * 2;

    const stepGeo = new THREE.RingGeometry(
      radius - 0.5,
      radius + 0.5,
      segments, 1,
      -arcAngle / 2,
      arcAngle
    );
    const tOff = rowTerrainOffset(radius);
    const step = new THREE.Mesh(stepGeo, seatMat);
    step.rotation.x = -Math.PI / 2;
    step.position.set(ax, baseY + 0.03 + row * rowHeightStep + tOff, az);
    step.rotation.z = Math.PI * 0.25;
    step.receiveShadow = true;
    state.scene.add(step);

    // Vertical riser
    if (row > 0) {
      const prevTOff = rowTerrainOffset(radius - rowSpacing);
      const riserH = tOff - prevTOff + rowHeightStep;
      if (riserH > 0.01) {
        const riser = new THREE.Mesh(
          new THREE.CylinderGeometry(radius + 0.5, radius + 0.5, riserH - 0.03, segments, 1, true, -arcAngle / 2, arcAngle),
          stoneMat
        );
        riser.position.set(ax, baseY + (row - 0.5) * rowHeightStep + (tOff + prevTOff) / 2, az);
        riser.rotation.y = Math.PI * 0.25;
        state.scene.add(riser);
      }
    }
  }

  // ── Radial staircases (kerkides) — 5 stairs, 6 wedges ──────────────────
  const stairCount = 5;
  const stairMat = new THREE.MeshStandardMaterial({ color: '#78716c', roughness: 0.72 });

  for (let s = 0; s < stairCount; s++) {
    const theta = -arcAngle / 2 + (arcAngle / (stairCount + 1)) * (s + 1);
    const cosA = Math.cos(theta + Math.PI * 0.25);
    const sinA = Math.sin(theta + Math.PI * 0.25);

    // Batch all stair steps into one InstancedMesh (60 identical BoxGeometry → 1 draw call)
    const stairStepGeo = new THREE.BoxGeometry(1.0, rowHeightStep * 0.7, rowSpacing * 0.45);
    const stairInstances = new THREE.InstancedMesh(stairStepGeo, stairMat, rowCount);
    stairInstances.castShadow = true;
    stairInstances.receiveShadow = true;
    const _stairObj = new THREE.Object3D();
    for (let row = 0; row < rowCount; row++) {
      const r = rowStartRadius + row * rowSpacing;
      const tOff = rowTerrainOffset(r);
      const y = baseY + 0.03 + row * rowHeightStep + tOff;
      const px = ax + cosA * (r - rowSpacing * 0.25);
      const pz = az - sinA * (r - rowSpacing * 0.25);
      _stairObj.position.set(px, y - rowHeightStep * 0.15, pz);
      _stairObj.scale.set(1, 1, 1);
      _stairObj.rotation.set(0, 0, 0);
      _stairObj.updateMatrix();
      stairInstances.setMatrixAt(row, _stairObj.matrix);
    }
    stairInstances.instanceMatrix.needsUpdate = true;
    state.scene.add(stairInstances);
  }

  // ── Retaining wall (analemma) around the outer seating ─────────────────
  const outerTOff = rowTerrainOffset(outerRadius);
  const wallHeight = rowCount * rowHeightStep + 0.5 + outerTOff;
  const outerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(outerRadius + 0.3, outerRadius + 0.3, wallHeight, 48, 1, true, -arcAngle / 2, arcAngle),
    stoneMat
  );
  outerWall.position.set(ax, baseY + wallHeight / 2, az);
  outerWall.rotation.y = Math.PI * 0.25;
  outerWall.castShadow = true;
  outerWall.receiveShadow = true;
  state.scene.add(outerWall);

  // Wall cap (top rim)
  const wallCap = new THREE.Mesh(
    new THREE.RingGeometry(outerRadius + 0.1, outerRadius + 0.6, 48, 1, -arcAngle / 2, arcAngle),
    warmStoneMat
  );
  wallCap.rotation.x = -Math.PI / 2;
  wallCap.position.set(ax, baseY + wallHeight + 0.03, az);
  wallCap.rotation.z = Math.PI * 0.25;
  state.scene.add(wallCap);

  // ── Earth embankment ─────────
  const embBankMat = new THREE.MeshStandardMaterial({ color: '#4a7a2a', roughness: 0.9, flatShading: true });
  const embOuterRadius = outerRadius + 8;
  const embankment = new THREE.Mesh(
    new THREE.RingGeometry(outerRadius + 0.5, embOuterRadius, 48, 1, -arcAngle / 2, arcAngle),
    embBankMat
  );
  embankment.rotation.x = -Math.PI / 2;
  embankment.position.set(ax, baseY + 0.02, az);
  embankment.rotation.z = Math.PI * 0.25;
  embankment.receiveShadow = true;
  state.scene.add(embankment);

  // ── Vomitoria (arched passages at top of each staircase) ───────────────
  for (let s = 0; s < stairCount; s++) {
    const theta = -arcAngle / 2 + (arcAngle / (stairCount + 1)) * (s + 1);
    const cosA = Math.cos(theta + Math.PI * 0.25);
    const sinA = Math.sin(theta + Math.PI * 0.25);
    const px = ax + cosA * (outerRadius + 0.8);
    const pz = az - sinA * (outerRadius + 0.8);
    const archY = baseY + wallHeight;

    [-0.6, 0.6].forEach((off) => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 2.0, 0.25),
        stoneMat
      );
      pillar.position.set(
        px + cosA * off,
        archY,
        pz - sinA * off
      );
      pillar.castShadow = true;
      state.scene.add(pillar);
    });

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.25, 0.35),
      warmStoneMat
    );
    lintel.position.set(px, archY + 1.1, pz);
    state.scene.add(lintel);
  }

  // ── Stage ─────────────────────────────────────────────────────
  const stageW = 22, stageD = 8;
  const stageDist = rowStartRadius - 1.5;

  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(stageW, 0.4, stageD),
    stageMat
  );
  stage.position.set(
    ax + Math.cos(stageAngle) * stageDist,
    baseY + 0.2,
    az + Math.sin(stageAngle) * stageDist
  );
  stage.receiveShadow = true;
  stage.castShadow = true;
  state.scene.add(stage);

  // Stage front facing (decorative panel)
  const stageFront = new THREE.Mesh(
    new THREE.BoxGeometry(stageW + 0.1, 0.35, 0.08),
    new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.3 })
  );
  stageFront.position.set(
    ax + Math.cos(stageAngle) * (stageDist - stageD / 2),
    baseY + 0.175,
    az + Math.sin(stageAngle) * (stageDist - stageD / 2)
  );
  stageFront.rotation.y = stageAngle;
  state.scene.add(stageFront);

  // Stage border trim
  const stageTrim = new THREE.Mesh(
    new THREE.BoxGeometry(stageW + 0.5, 0.06, stageD + 0.5),
    new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5, metalness: 0.15 })
  );
  stageTrim.position.set(
    ax + Math.cos(stageAngle) * stageDist,
    baseY + 0.02,
    az + Math.sin(stageAngle) * stageDist
  );
  state.scene.add(stageTrim);

  // ── Scaenae frons ──────────────
  const scaenaeW = 24;
  const scaenaeH = 9;
  const scaenaeDist = stageDist + stageD / 2 + 0.5;
  const scaenaeX = ax + Math.cos(stageAngle) * scaenaeDist;
  const scaenaeZ = az + Math.sin(stageAngle) * scaenaeDist;

  // Main back wall
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(scaenaeW, scaenaeH, 0.5),
    warmStoneMat
  );
  backWall.position.set(scaenaeX, baseY + scaenaeH / 2, scaenaeZ);
  backWall.receiveShadow = true;
  backWall.castShadow = true;
  state.scene.add(backWall);

  // Three arched niches
  const nicheMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
  const nicheW = [8, 6, 6];
  const nicheH = [5.0, 3.5, 3.5];

  [-1, 0, 1].forEach((n) => {
    const nw = n === 0 ? nicheW[0] : nicheW[1];
    const nh = n === 0 ? nicheH[0] : nicheH[1];
    const nxOff = n * 8.5;

    const niche = new THREE.Mesh(
      new THREE.BoxGeometry(nw, nh, 0.05),
      nicheMat
    );
    niche.position.set(
      scaenaeX + Math.cos(perpAngle) * nxOff,
      baseY + 2.5 + nh / 2,
      scaenaeZ + Math.cos(stageAngle) * 0.28
    );
    state.scene.add(niche);

    // Arch trim
    const archTrim = new THREE.Mesh(
      new THREE.BoxGeometry(nw + 0.4, 0.15, 0.12),
      bronzeMat
    );
    archTrim.position.set(
      scaenaeX + Math.cos(perpAngle) * nxOff,
      baseY + 2.5 + nh + 0.05,
      scaenaeZ + Math.cos(stageAngle) * 0.28
    );
    state.scene.add(archTrim);
  });

  // Pilasters
  [-1, 0, 1].forEach((p) => {
    const pilasterX = scaenaeX + Math.cos(perpAngle) * p * 8.5;
    const pilW = p === 0 ? 0.6 : 0.4;
    const pilaster = new THREE.Mesh(
      new THREE.BoxGeometry(pilW, scaenaeH, 0.55),
      warmStoneMat
    );
    pilaster.position.set(pilasterX, baseY + scaenaeH / 2, scaenaeZ);
    pilaster.castShadow = true;
    state.scene.add(pilaster);
  });

  // Entablature
  const entablature = new THREE.Mesh(
    new THREE.BoxGeometry(scaenaeW + 1.0, 0.5, 0.7),
    warmStoneMat
  );
  entablature.position.set(scaenaeX, baseY + scaenaeH + 0.25, scaenaeZ);
  state.scene.add(entablature);

  // Cornice
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(scaenaeW + 1.5, 0.2, 0.9),
    new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.3 })
  );
  cornice.position.set(scaenaeX, baseY + scaenaeH + 0.6, scaenaeZ);
  state.scene.add(cornice);

  // Pediment
  const pedShape = new THREE.Shape();
  const pedHalf = (scaenaeW + 1.0) / 2;
  pedShape.moveTo(-pedHalf, 0);
  pedShape.lineTo(pedHalf, 0);
  pedShape.lineTo(0, 2.0);
  pedShape.closePath();

  const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 0.5, bevelEnabled: false });
  const pediment = new THREE.Mesh(pedGeo, warmStoneMat);
  pediment.position.set(scaenaeX, baseY + scaenaeH + 0.7, scaenaeZ - 0.22);
  const pedAngle = stageAngle + Math.PI;
  pediment.rotation.y = pedAngle;
  state.scene.add(pediment);

  // ── Screen ────────────────────────────────
  const screenW = 8, screenH = 4.5;
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    screenMat.clone()
  );
  screenMesh.position.set(
    scaenaeX + Math.cos(stageAngle) * 0.3,
    baseY + 5.0,
    scaenaeZ + Math.sin(stageAngle) * 0.3
  );
  screenMesh.rotation.y = stageAngle;
  screenMesh.userData = { roomId: 8 };
  state.clickableScreens.push(screenMesh);
  state.roomScreens.set(8, {
    material: screenMesh.material,
    baseColor: screenMesh.material.color.clone(),
    baseEmissive: screenMesh.material.emissive.clone()
  });
  state.scene.add(screenMesh);

  // Green glow border
  const glowEdgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(screenW + 0.2, screenH + 0.2));
  const glowBorder = new THREE.LineSegments(
    glowEdgeGeo,
    new THREE.LineBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.25 })
  );
  glowBorder.position.copy(screenMesh.position);
  glowBorder.rotation.copy(screenMesh.rotation);
  state.scene.add(glowBorder);

  // ── Grand entrance stairway ──────────────────────────────
  const stairDirX = Math.cos(stageAngle);
  const stairDirZ = Math.sin(stageAngle);
  const stairSteps = 8;
  const stairW = 4.0;
  const stepHeight = 0.2;
  const stepDepth = 0.6;

  for (let st = 0; st < stairSteps; st++) {
    const sDist = stageDist + 1.5 + st * stepDepth;
    const sY = baseY + (st + 1) * stepHeight;
    const stepMesh = new THREE.Mesh(
      new THREE.BoxGeometry(stairW, stepHeight, stepDepth),
      stoneMat
    );
    stepMesh.position.set(
      ax + stairDirX * sDist,
      sY,
      az + stairDirZ * sDist
    );
    stepMesh.receiveShadow = true;
    stepMesh.castShadow = true;
    state.scene.add(stepMesh);
  }

  // ── Entrance marker columns ────────────────────────────────────────────
  const colMat = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.4, metalness: 0.05 });
  [-3.5, 3.5].forEach((xOff) => {
    const colPos = {
      x: ax + stairDirX * (stageDist + 1.0) + Math.cos(perpAngle) * xOff,
      z: az + stairDirZ * (stageDist + 1.0) + Math.sin(perpAngle) * xOff
    };

    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 4.5, 8),
      colMat
    );
    col.position.set(colPos.x, baseY + 2.25, colPos.z);
    col.castShadow = true;
    state.scene.add(col);

    const capital = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.2, 0.3, 8),
      colMat
    );
    capital.position.set(colPos.x, baseY + 4.5, colPos.z);
    state.scene.add(capital);

    const topper = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 6, 6),
      new THREE.MeshBasicMaterial({ color: '#22c55e' })
    );
    topper.position.set(colPos.x, baseY + 4.9, colPos.z);
    state.scene.add(topper);
  });

  // ── Collision barriers ─────────────────────────────────────────────────
  // Segmented arc with gaps at each vomitorium so players can enter/exit
  // through the radial staircases from multiple sides.
  const barrierR = 32;
  const gapAngle = 0.12;
  for (let seg = 0; seg < 12; seg++) {
    const a0 = -arcAngle / 2 + (arcAngle / 12) * seg;
    const a1 = -arcAngle / 2 + (arcAngle / 12) * (seg + 1);
    // Check if this segment overlaps any vomitorium gap
    let overlaps = false;
    for (let g = 0; g < stairCount; g++) {
      const gt = -arcAngle / 2 + (arcAngle / (stairCount + 1)) * (g + 1);
      if (a0 < gt + gapAngle * 1.5 && a1 > gt - gapAngle * 1.5) { overlaps = true; break; }
    }
    if (overlaps) continue;
    const midAngle = (a0 + a1) / 2;
    const worldAngle = -(midAngle + Math.PI * 0.25);
    const cx = ax + Math.cos(worldAngle) * (barrierR - 2);
    const cz = az - Math.sin(worldAngle) * (barrierR - 2);
    state.PLACED_ASSET_COLLIDERS.push({
      minX: cx - 3, maxX: cx + 3,
      minZ: cz - 3, maxZ: cz + 3,
      assetId: 'amphitheater'
    });
  }
  // Also block the area behind the stage (scaenae frons side)
  state.PLACED_ASSET_COLLIDERS.push({
    minX: ax + 25, maxX: ax + 40,
    minZ: az + 18, maxZ: az + 40,
    assetId: 'amphitheater'
  });

  registerStaticScenery(platform, { kind: 'outdoor', distance: 140 });
}

export function buildConcertVenue() {
  const vx = -85, vz = 140;
  const baseY = getTerrainHeight(vx, vz);

  const brickTex = createBrickTexture();
  const stoneTex = createStoneTexture();

  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  const stoneTrimMat = state.sharedScenery.limestoneMat;
  const darkGlassMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.15,
    metalness: 0.8,
    transparent: true,
    opacity: 0.75
  });
  const copperDomeMat = new THREE.MeshStandardMaterial({
    color: '#b86842',
    roughness: 0.4,
    metalness: 0.6,
    side: THREE.DoubleSide
  });
  const floorMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
  const stageMat = new THREE.MeshStandardMaterial({ color: '#3d2b1f', roughness: 0.6, metalness: 0.08 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5, metalness: 0.2 });
  const screenMat = state.sharedScenery.screenMat;

  const venueW = 46, venueD = 34, venueH = 10;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(venueW, venueD),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(vx, baseY + 0.02, vz);
  floor.receiveShadow = true;
  state.scene.add(floor);

  // Heavy Corner Buttresses
  const cornerPositions = [
    { x: vx - venueW / 2, z: vz - venueD / 2 },
    { x: vx + venueW / 2, z: vz - venueD / 2 },
    { x: vx - venueW / 2, z: vz + venueD / 2 },
    { x: vx + venueW / 2, z: vz + venueD / 2 }
  ];
  cornerPositions.forEach((pos) => {
    const cornerCol = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, venueH + 1.0, 1.6),
      stoneTrimMat
    );
    cornerCol.position.set(pos.x, baseY + (venueH + 1.0) / 2, pos.z);
    cornerCol.castShadow = true;
    cornerCol.receiveShadow = true;
    state.scene.add(cornerCol);
  });

  // Walls
  // Back Wall (West)
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, venueH, venueD - 1.5),
    brickMat
  );
  backWall.position.set(vx - venueW / 2, baseY + venueH / 2, vz);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  state.scene.add(backWall);

  // North Wall
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(venueW - 1.5, venueH, 0.5),
    brickMat
  );
  northWall.position.set(vx, baseY + venueH / 2, vz - venueD / 2);
  northWall.castShadow = true;
  northWall.receiveShadow = true;
  state.scene.add(northWall);

  // South Wall
  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(venueW - 1.5, venueH, 0.5),
    brickMat
  );
  southWall.position.set(vx, baseY + venueH / 2, vz + venueD / 2);
  southWall.castShadow = true;
  southWall.receiveShadow = true;
  state.scene.add(southWall);

  // East Wall (Front wall - split in two sections for the entrance door centered at vz=140)
  const eastWallLen = (venueD - 6.0) / 2;
  const eastWallN = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, venueH, eastWallLen - 0.8),
    brickMat
  );
  eastWallN.position.set(vx + venueW / 2, baseY + venueH / 2, vz - 3.0 - (eastWallLen - 0.8) / 2);
  eastWallN.castShadow = true;
  eastWallN.receiveShadow = true;
  state.scene.add(eastWallN);

  const eastWallS = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, venueH, eastWallLen - 0.8),
    brickMat
  );
  eastWallS.position.set(vx + venueW / 2, baseY + venueH / 2, vz + 3.0 + (eastWallLen - 0.8) / 2);
  eastWallS.castShadow = true;
  eastWallS.receiveShadow = true;
  state.scene.add(eastWallS);

  // Lintel above entrance
  const lintelHeight = 3.0;
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, lintelHeight, 6.2),
    stoneTrimMat
  );
  lintel.position.set(vx + venueW / 2, baseY + venueH - lintelHeight / 2, vz);
  lintel.castShadow = true;
  state.scene.add(lintel);

  // Arched Windows
  const windowCount = 4;
  const windowWidth = 3.2;
  const windowHeight = 5.5;
  const windowSpacing = (venueW - 6.0) / windowCount;

  for (let i = 0; i < windowCount; i++) {
    const wx = vx - (venueW - 8.0) / 2 + i * windowSpacing;
    
    const windowFrameN = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth, windowHeight, 0.6),
      stoneTrimMat
    );
    windowFrameN.position.set(wx, baseY + 4.0, vz - venueD / 2);
    state.scene.add(windowFrameN);

    const glassN = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth - 0.6, windowHeight - 0.6, 0.2),
      darkGlassMat
    );
    glassN.position.set(wx, baseY + 4.0, vz - venueD / 2);
    state.scene.add(glassN);

    const windowFrameS = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth, windowHeight, 0.6),
      stoneTrimMat
    );
    windowFrameS.position.set(wx, baseY + 4.0, vz + venueD / 2);
    state.scene.add(windowFrameS);

    const glassS = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth - 0.6, windowHeight - 0.6, 0.2),
      darkGlassMat
    );
    glassS.position.set(wx, baseY + 4.0, vz + venueD / 2);
    state.scene.add(glassS);
  }

  // ── Greek Revival Portico (East Entrance) ──────────────────────────────
  // Projects 1.6 units east of the building face so it reads clearly from the road.
  // 4 Doric columns: outer pair flanks the opening, inner pair marks the threshold.
  // The 6-unit doorway gap (z: 137–143) remains passable between the columns.
  const porticoX  = vx + venueW / 2 + 1.6;   // column centerline: x ≈ -60.4
  const porticoColH = venueH - 0.4;             // 9.6 u — taller than the lintel
  const porticoColPositions = [vz - 4.6, vz - 1.6, vz + 1.6, vz + 4.6];

  porticoColPositions.forEach((cz) => {
    // Plinth (square base)
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.28, 0.88), stoneTrimMat);
    plinth.position.set(porticoX, baseY + 0.14, cz);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    state.scene.add(plinth);

    // Shaft — Doric taper (bottom radius 0.36, top 0.27)
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.36, porticoColH - 0.55, 10),
      stoneTrimMat
    );
    shaft.position.set(porticoX, baseY + 0.28 + (porticoColH - 0.55) / 2, cz);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    state.scene.add(shaft);

    // Echinus (curved capital transition)
    const echinus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.28, 0.24, 10),
      stoneTrimMat
    );
    echinus.position.set(porticoX, baseY + porticoColH - 0.32, cz);
    echinus.castShadow = true;
    state.scene.add(echinus);

    // Abacus (flat capital slab)
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), stoneTrimMat);
    abacus.position.set(porticoX, baseY + porticoColH - 0.1, cz);
    abacus.castShadow = true;
    state.scene.add(abacus);
  });

  // Entablature spanning all 4 columns (architrave + frieze + geison)
  const entabSpan = (vz + 4.6) - (vz - 4.6) + 1.0; // 10.2 u with overhang

  const architrave = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.42, entabSpan), stoneTrimMat
  );
  architrave.position.set(porticoX, baseY + porticoColH + 0.21, vz);
  architrave.castShadow = true;
  architrave.receiveShadow = true;
  state.scene.add(architrave);

  const frieze = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.52, entabSpan - 0.1),
    new THREE.MeshStandardMaterial({ color: '#d4cfc6', roughness: 0.5 })
  );
  frieze.position.set(porticoX, baseY + porticoColH + 0.64, vz);
  frieze.castShadow = true;
  state.scene.add(frieze);

  const geison = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.22, entabSpan + 0.4), stoneTrimMat
  );
  geison.position.set(porticoX, baseY + porticoColH + 1.01, vz);
  geison.castShadow = true;
  state.scene.add(geison);

  // Triangular pediment — proper Greek gable facing east (toward road)
  // rotation.y = PI/2 → local +X maps to world -Z (spans north-south), local +Z → world +X (projects east)
  const pedHalfSpan = entabSpan / 2 + 0.1;
  const pedShape = new THREE.Shape();
  pedShape.moveTo(-pedHalfSpan, 0);
  pedShape.lineTo(pedHalfSpan, 0);
  pedShape.lineTo(0, 2.1);
  pedShape.closePath();

  const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 0.58, bevelEnabled: false });
  const pedimentMesh = new THREE.Mesh(pedGeo, stoneTrimMat);
  pedimentMesh.rotation.y = Math.PI / 2;
  pedimentMesh.position.set(porticoX, baseY + porticoColH + 1.12, vz);
  pedimentMesh.castShadow = true;
  state.scene.add(pedimentMesh);

  // Portico roof slab (ties portico to building wall)
  const porticoRoofSlab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.18, entabSpan + 0.6),
    new THREE.MeshStandardMaterial({ color: '#bab6ae', roughness: 0.55 })
  );
  porticoRoofSlab.position.set(vx + venueW / 2 + 0.9, baseY + porticoColH + 1.14, vz);
  state.scene.add(porticoRoofSlab);
  state.roofMeshes.push(porticoRoofSlab);

  // Portico floor extension (marble apron in front of entrance)
  const porticoFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.14, entabSpan + 0.8), stoneTrimMat
  );
  porticoFloor.position.set(vx + venueW / 2 + 0.9, baseY + 0.07, vz);
  porticoFloor.receiveShadow = true;
  state.scene.add(porticoFloor);

  // Stone Trim / Cornice
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(venueW + 0.8, 0.5, venueD + 0.8),
    stoneTrimMat
  );
  cornice.position.set(vx, baseY + venueH + 0.25, vz);
  cornice.castShadow = true;
  state.scene.add(cornice);

  // Oval/Circular Dome Structure
  const domeBaseCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(15.0, 15.5, 1.2, 32),
    stoneTrimMat
  );
  domeBaseCollar.position.set(vx, baseY + venueH + 0.85, vz);
  domeBaseCollar.castShadow = true;
  domeBaseCollar.receiveShadow = true;
  state.scene.add(domeBaseCollar);
  state.roofMeshes.push(domeBaseCollar);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(15.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    copperDomeMat
  );
  dome.position.set(vx, baseY + venueH + 1.45, vz);
  dome.castShadow = true;
  dome.receiveShadow = true;
  state.scene.add(dome);
  state.roofMeshes.push(dome);

  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.4, 3.0, 8),
    stoneTrimMat
  );
  spire.position.set(vx, baseY + venueH + 1.45 + 15.0 + 1.5, vz);
  spire.castShadow = true;
  state.scene.add(spire);
  state.roofMeshes.push(spire);

  const spireGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 6, 6),
    new THREE.MeshBasicMaterial({ color: '#c084fc' })
  );
  spireGlow.position.set(vx, baseY + venueH + 1.45 + 15.0 + 3.0, vz);
  state.scene.add(spireGlow);
  state.roofMeshes.push(spireGlow);

  // Stage (West wall)
  const stageW = 26, stageD = 8, stageH = 0.5;
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(stageW, stageH, stageD),
    stageMat
  );
  stage.position.set(vx - venueW / 2 + stageD / 2 + 1.0, baseY + stageH / 2, vz);
  stage.receiveShadow = true;
  stage.castShadow = true;
  state.scene.add(stage);

  const stageFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, stageH, stageW),
    new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.6 })
  );
  stageFront.position.set(vx - venueW / 2 + stageD + 1.0, baseY + stageH / 2, vz);
  state.scene.add(stageFront);

  // Giant screen
  const screenW = 22, screenH = 8;
  const screenY = baseY + stageH + 0.5 + screenH / 2;
  const screenX = vx - venueW / 2 + 0.5;

  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, screenH + 0.6, 0.3),
      frameMat
    );
    post.position.set(screenX, screenY, vz + side * (screenW / 2 + 0.15));
    post.castShadow = true;
    state.scene.add(post);
  });

  const topRails = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.12, screenW + 0.6),
    frameMat
  );
  topRails.position.set(screenX, screenY + screenH / 2 + 0.3, vz);
  state.scene.add(topRails);

  const bottomRails = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.12, screenW + 0.6),
    frameMat
  );
  bottomRails.position.set(screenX, screenY - screenH / 2 - 0.3, vz);
  state.scene.add(bottomRails);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    screenMat.clone()
  );
  screenMesh.position.set(screenX + 0.15, screenY, vz);
  screenMesh.rotation.y = Math.PI / 2;
  screenMesh.userData = { roomId: 9 };
  state.clickableScreens.push(screenMesh);
  state.roomScreens.set(9, {
    material: screenMesh.material,
    baseColor: screenMesh.material.color.clone(),
    baseEmissive: screenMesh.material.emissive.clone()
  });
  state.scene.add(screenMesh);

  const borderEdgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(screenW + 0.3, screenH + 0.3));
  const border = new THREE.LineSegments(
    borderEdgeGeo,
    new THREE.LineBasicMaterial({ color: '#a855f7', transparent: true, opacity: 0.25 })
  );
  border.position.copy(screenMesh.position);
  border.rotation.copy(screenMesh.rotation);
  state.scene.add(border);

  // Lighting
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#a855f7',
    emissive: '#a855f7',
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.12
  });
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(8, 10, 32),
    glowMat
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.set(vx, baseY + 0.04, vz);
  state.scene.add(glowRing);

  // Entrance steps
  const stepMat = new THREE.MeshStandardMaterial({
    color: '#64748b', roughness: 0.75
  });
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.12, 6.0),
    stepMat
  );
  step.position.set(vx + venueW / 2 + 1.0, baseY + 0.06, vz);
  step.receiveShadow = true;
  step.castShadow = true;
  state.scene.add(step);

  // Collision barriers
  // North Wall
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(vx - venueW / 2 - 0.25, baseY - 0.5, vz - venueD / 2 - 0.25),
    new THREE.Vector3(vx + venueW / 2 + 0.25, baseY + venueH, vz - venueD / 2 + 0.25)
  ));
  // South Wall
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(vx - venueW / 2 - 0.25, baseY - 0.5, vz + venueD / 2 - 0.25),
    new THREE.Vector3(vx + venueW / 2 + 0.25, baseY + venueH, vz + venueD / 2 + 0.25)
  ));
  // West Wall
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(vx - venueW / 2 - 0.25, baseY - 0.5, vz - venueD / 2 - 0.25),
    new THREE.Vector3(vx - venueW / 2 + 0.25, baseY + venueH, vz + venueD / 2 + 0.25)
  ));
  // East Wall - North Section
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(vx + venueW / 2 - 0.25, baseY - 0.5, vz - venueD / 2 - 0.25),
    new THREE.Vector3(vx + venueW / 2 + 0.25, baseY + venueH, vz - 3.0)
  ));
  // East Wall - South Section
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(vx + venueW / 2 - 0.25, baseY - 0.5, vz + 3.0),
    new THREE.Vector3(vx + venueW / 2 + 0.25, baseY + venueH, vz + venueD / 2 + 0.25)
  ));

  registerStaticScenery(floor,     { kind: 'outdoor', distance: 200 });
  registerStaticScenery(dome,      { kind: 'outdoor', distance: 220 });
  registerStaticScenery(backWall,  { kind: 'outdoor', distance: 200 });
  registerStaticScenery(northWall, { kind: 'outdoor', distance: 200 });
  registerStaticScenery(southWall, { kind: 'outdoor', distance: 200 });
}
