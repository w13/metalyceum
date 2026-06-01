// Large outdoor venues (Amphitheater & Concert Venue) and pathways
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { createBrickTexture, createStoneTexture, createCarpetTexture } from '../textures.js';
import { registerStaticScenery } from './visibility.js';
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
    buildTerrainRibbon(points, width, roadMat, 0.15);
    buildTerrainRibbon(points, 0.12, roadBorderMat, 0.18, width / 2);
    buildTerrainRibbon(points, 0.12, roadBorderMat, 0.18, -width / 2);
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

  // Road 3 removed — plaza circle + approach strip cover the connection
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
  const rowCount = 12;
  const rowStartRadius = 9;
  const rowSpacing = 2.0;
  const arcAngle = Math.PI * 0.85;
  const outerRadius = rowStartRadius + (rowCount - 1) * rowSpacing + 0.5;

  // Row Y: each row sits at the higher of terrain height or the step level
  function rowY(row) {
    const radius = rowStartRadius + row * rowSpacing;
    const angles = [-arcAngle / 2, 0, arcAngle / 2];
    let sum = 0;
    for (const theta of angles) {
      const wa = -(theta + Math.PI * 0.25);
      sum += getTerrainHeight(ax + Math.cos(wa) * radius, az - Math.sin(wa) * radius);
    }
    return Math.max(sum / 3, baseY + row * 0.5) + 0.03;
  }

  // ── Unified amphitheater ──────────────────────────────────────────────
  // Orchestra: flat marble circle at center
  const orch = new THREE.Mesh(new THREE.CircleGeometry(8, 36), marbleMat);
  orch.rotation.x = -Math.PI / 2;
  orch.position.set(ax, baseY + 0.03, az);
  orch.receiveShadow = true;
  state.scene.add(orch);

  // Orchestra border
  const ob = new THREE.Mesh(new THREE.RingGeometry(7.8, 8.2, 36),
    new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5 }));
  ob.rotation.x = -Math.PI / 2;
  ob.position.set(ax, baseY + 0.035, az);
  state.scene.add(ob);

  // Stepped seating — concentric arcs rising with the terrain hill
  for (let row = 0; row < rowCount; row++) {
    const r = rowStartRadius + row * rowSpacing;
    const y = rowY(row);
    const segs = 24 + row * 2;
    const sg = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.5, r + 0.5, segs, 1, -arcAngle / 2, arcAngle),
      seatMat);
    sg.rotation.x = -Math.PI / 2;
    sg.position.set(ax, y, az);
    sg.rotation.z = Math.PI * 0.25;
    sg.receiveShadow = true;
    state.scene.add(sg);

    if (row > 0) {
      const prevY = rowY(row - 1);
      const rh = y - prevY;
      if (rh > 0.01) {
        const riser = new THREE.Mesh(
          new THREE.CylinderGeometry(r + 0.5, r + 0.5, rh - 0.03, segs, 1, true, -arcAngle / 2, arcAngle),
          stoneMat);
        riser.position.set(ax, (y + prevY) / 2, az);
        riser.rotation.y = Math.PI * 0.25;
        state.scene.add(riser);
      }
    }
  }

  // Radial stairs — 5 staircases up the seating
  const stairMat = new THREE.MeshStandardMaterial({ color: '#78716c', roughness: 0.72 });
  for (let s = 0; s < 5; s++) {
    const theta = -arcAngle / 2 + (arcAngle / 6) * (s + 1);
    const ca = Math.cos(theta + Math.PI * 0.25);
    const sa = Math.sin(theta + Math.PI * 0.25);
    const stepGeo = new THREE.BoxGeometry(1.0, 0.35, 0.9);
    const inst = new THREE.InstancedMesh(stepGeo, stairMat, rowCount);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const obj = new THREE.Object3D();
    for (let row = 0; row < rowCount; row++) {
      const r = rowStartRadius + row * rowSpacing;
      const y = rowY(row);
      obj.position.set(ax + ca * (r - 0.5), y - 0.075, az - sa * (r - 0.5));
      obj.updateMatrix();
      inst.setMatrixAt(row, obj.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    state.scene.add(inst);
  }

  // Retaining wall around outer seating
  const outerY = rowY(rowCount - 1);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(outerRadius + 0.3, outerRadius + 0.3, outerY - baseY + 0.5, 48, 1, true, -arcAngle / 2, arcAngle),
    stoneMat);
  wall.position.set(ax, (baseY + outerY + 0.5) / 2, az);
  wall.rotation.y = Math.PI * 0.25;
  wall.castShadow = true;
  wall.receiveShadow = true;
  state.scene.add(wall);

  // Wall cap
  const cap = new THREE.Mesh(
    new THREE.RingGeometry(outerRadius + 0.1, outerRadius + 0.6, 48, 1, -arcAngle / 2, arcAngle),
    warmStoneMat);
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(ax, outerY + 0.5, az);
  cap.rotation.z = Math.PI * 0.25;
  state.scene.add(cap);

  // Stage — sits at the open side of the seating arc, connected to the orchestra
  const stageDist = rowStartRadius - 1.5;
  const stage = new THREE.Mesh(new THREE.BoxGeometry(22, 0.4, 8), stageMat);
  stage.position.set(ax + cosSA * stageDist, baseY + 0.2, az + sinSA * stageDist);
  stage.receiveShadow = true;
  stage.castShadow = true;
  state.scene.add(stage);

  const sf = new THREE.Mesh(new THREE.BoxGeometry(22.1, 0.35, 0.08),
    new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.3 }));
  sf.position.set(ax + cosSA * (stageDist - 4), baseY + 0.175, az + sinSA * (stageDist - 4));
  sf.rotation.y = stageAngle;
  state.scene.add(sf);

  // Scaenae frons — grand backdrop wall with screen
  const sDist = stageDist + 5;
  const sx = ax + cosSA * sDist, sz = az + sinSA * sDist;
  const bw = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 0.5), warmStoneMat);
  bw.position.set(sx, baseY + 4.5, sz);
  bw.receiveShadow = true;
  bw.castShadow = true;
  state.scene.add(bw);

  // Screen embedded in the central niche of the scaenae frons
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), screenMat.clone());
  sm.position.set(sx + cosSA * 0.3, baseY + 4.8, sz + sinSA * 0.3);
  sm.rotation.y = stageAngle;
  sm.userData = { roomId: 8 };
  state.clickableScreens.push(sm);
  state.roomScreens.set(8, { material: sm.material, baseColor: sm.material.color.clone(),
    baseEmissive: sm.material.emissive.clone() });
  state.scene.add(sm);

  const gl = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.2, 4.2)),
    new THREE.LineBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.25 }));
  gl.position.copy(sm.position); gl.rotation.copy(sm.rotation);
  state.scene.add(gl);

  // Entrance stairway from the road
  for (let st = 0; st < 8; st++) {
    const d = stageDist + 2 + st * 0.6;
    const step = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.6), stoneMat);
    step.position.set(ax + cosSA * d, baseY + (st + 1) * 0.2, az + sinSA * d);
    step.receiveShadow = true;
    step.castShadow = true;
    state.scene.add(step);
  }

  // Collision: block the seating arc with stairway gaps
  for (let seg = 0; seg < 10; seg++) {
    if ([2, 4, 6, 8].includes(seg)) continue;
    const ma = (-arcAngle / 2 + (arcAngle / 10) * (seg + 0.5));
    const wa = -(ma + Math.PI * 0.25);
    const cx = ax + Math.cos(wa) * 30, cz = az - Math.sin(wa) * 30;
    state.PLACED_ASSET_COLLIDERS.push({ minX: cx - 3, maxX: cx + 3, minZ: cz - 3, maxZ: cz + 3, assetId: 'amphitheater' });
  }
  // Block the stage area and scaenae frons
  const stageCx = ax + cosSA * (stageDist + 2);
  const stageCz = az + sinSA * (stageDist + 2);
  state.PLACED_ASSET_COLLIDERS.push({ minX: stageCx - 13, maxX: stageCx + 10, minZ: stageCz - 13, maxZ: stageCz + 10, assetId: 'amphitheater' });

  registerStaticScenery(orch, { kind: 'outdoor', distance: 140 });
}

export function buildConcertVenue() {
  const vx = -85, vz = 140;
  const baseY = getTerrainHeight(vx, vz);

  const brickTex    = createBrickTexture();
  const carpetTex   = createCarpetTexture();

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
    side: THREE.DoubleSide,
    transparent: true, opacity: 1.0
  });
  // Plush red carpet — very matte, no stone tile
  const floorMat = new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.94, metalness: 0 });
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
  state.upperWalls.push(backWall);

  // North Wall
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(venueW - 1.5, venueH, 0.5),
    brickMat
  );
  northWall.position.set(vx, baseY + venueH / 2, vz - venueD / 2);
  northWall.castShadow = true;
  northWall.receiveShadow = true;
  state.scene.add(northWall);
  state.upperWalls.push(northWall);

  // South Wall
  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(venueW - 1.5, venueH, 0.5),
    brickMat
  );
  southWall.position.set(vx, baseY + venueH / 2, vz + venueD / 2);
  southWall.castShadow = true;
  southWall.receiveShadow = true;
  state.scene.add(southWall);
  state.upperWalls.push(southWall);

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
  state.upperWalls.push(eastWallN);

  const eastWallS = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, venueH, eastWallLen - 0.8),
    brickMat
  );
  eastWallS.position.set(vx + venueW / 2, baseY + venueH / 2, vz + 3.0 + (eastWallLen - 0.8) / 2);
  eastWallS.castShadow = true;
  eastWallS.receiveShadow = true;
  state.scene.add(eastWallS);
  state.upperWalls.push(eastWallS);

  // Lintel above entrance
  const lintelHeight = 3.0;
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, lintelHeight, 6.2),
    stoneTrimMat
  );
  lintel.position.set(vx + venueW / 2, baseY + venueH - lintelHeight / 2, vz);
  lintel.castShadow = true;
  state.scene.add(lintel);
  state.upperWalls.push(lintel);

  // ── Concert venue ceiling (fades when player enters) ──────────────────
  const concertCeilMat = new THREE.MeshStandardMaterial({
    color: '#1a1a2e', roughness: 0.8,
    transparent: true, opacity: 1.0
  });
  const concertCeiling = new THREE.Mesh(
    new THREE.PlaneGeometry(venueW - 1.0, venueD - 1.0),
    concertCeilMat
  );
  concertCeiling.rotation.x = -Math.PI / 2;
  concertCeiling.position.set(vx, baseY + venueH, vz);
  concertCeiling.receiveShadow = true;
  state.scene.add(concertCeiling);
  state.roofMeshes.push(concertCeiling);

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

  // Portico removed — columns looked freestanding from across the field.
  // The wall opening + lintel still frame the entrance clearly.

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

  // Stage (against west wall)
  // stageW = north-south span, stageD = east-west depth — BoxGeometry maps to (X, Y, Z)
  // so we pass (stageD, stageH, stageW) to get depth in X and width in Z.
  const stageW = 26, stageD = 8, stageH = 0.5;
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(stageD, stageH, stageW),
    stageMat
  );
  stage.position.set(vx - venueW / 2 + stageD / 2 + 1.0, baseY + stageH / 2, vz);
  stage.receiveShadow = true;
  stage.castShadow = true;
  state.scene.add(stage);

  // Raised lip at the audience-facing (east) edge of the stage
  const stageFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, stageH + 0.1, stageW),
    new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.6 })
  );
  stageFront.position.set(vx - venueW / 2 + stageD + 1.0, baseY + stageH / 2 + 0.05, vz);
  stageFront.castShadow = true;
  state.scene.add(stageFront);

  // Collision wall — stops players walking into the stage face so legs don't clip
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(vx - venueW / 2 + stageD + 0.6, baseY, vz - stageW / 2),
    new THREE.Vector3(vx - venueW / 2 + stageD + 1.4, baseY + stageH + 1.8, vz + stageW / 2)
  ));

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
