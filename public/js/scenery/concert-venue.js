// Concert Venue — grand performance hall with dome, stage, and giant screen
import * as THREE from 'three';
import { createLandmarkFadeZone, makeFadeMaterial } from '../fade-system.js';
import { FLAT, HALF_PI } from '../math.js';
import { LANDMARK_REGISTRY } from '../config.js';
import { getTerrainHeight } from '../physics.js';
import { state } from '../state.js';
import {
  createBrickTexture,
  createCarpetTexture,
  createStoneTexture,
} from '../textures.js';
import { createFloor } from './utils.js';
import { registerStaticScenery } from './visibility.js';

export function buildConcertVenue() {
  const vx = -85,
    vz = 140;
  const baseY = getTerrainHeight(vx, vz);
  const group = new THREE.Group();

  const brickTex = createBrickTexture();
  const carpetTex = createCarpetTexture();

  const brickMat = new THREE.MeshStandardMaterial({
    map: brickTex,
    roughness: 0.85,
  });
  const stoneTrimMat = state.sharedScenery.limestoneMat;
  const darkGlassMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.15,
    metalness: 0.8,
    transparent: true,
    opacity: 0.75,
  });
  const copperDomeMat = new THREE.MeshStandardMaterial({
    color: '#b86842',
    roughness: 0.4,
    metalness: 0.6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
  });
  // Plush red carpet — very matte, no stone tile
  const floorMat = new THREE.MeshStandardMaterial({
    map: carpetTex,
    roughness: 0.94,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const stageMat = new THREE.MeshStandardMaterial({
    color: '#3d2b1f',
    roughness: 0.6,
    metalness: 0.08,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.5,
    metalness: 0.2,
  });
  const screenMat = state.sharedScenery.screenMat;
  const upperWallMat = makeFadeMaterial(
    new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 }),
  );

  const venueW = 46,
    venueD = 34,
    venueH = 10;

  const { pushRoof, pushUpperWall } = createLandmarkFadeZone({
    id: 'concert-venue',
    proximity: { x: vx, z: vz, r: 42 },
    bounds: {
      minX: vx - venueW / 2,
      maxX: vx + venueW / 2,
      minZ: vz - venueD / 2,
      maxZ: vz + venueD / 2,
    },
    upperWallMat,
  });

  // Floor
  group.add(createFloor(venueW, venueD, floorMat, vx, baseY + 0.02, vz));

  // Heavy Corner Buttresses
  const cornerPositions = [
    { x: vx - venueW / 2, z: vz - venueD / 2 },
    { x: vx + venueW / 2, z: vz - venueD / 2 },
    { x: vx - venueW / 2, z: vz + venueD / 2 },
    { x: vx + venueW / 2, z: vz + venueD / 2 },
  ];
  cornerPositions.forEach((pos) => {
    const cornerCol = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, venueH + 1.0, 1.6),
      stoneTrimMat,
    );
    cornerCol.position.set(pos.x, baseY + (venueH + 1.0) / 2, pos.z);
    cornerCol.castShadow = true;
    cornerCol.receiveShadow = true;
    group.add(cornerCol);
  });

  // ── Split walls: lower half always visible, upper half fades on entry ──
  const splitY = 6.0; // lower portion height
  const upperH = venueH - splitY; // 4.0

  function addSplitWall(w, d, cx, cz) {
    // Lower half (always visible, opaque)
    const lower = new THREE.Mesh(new THREE.BoxGeometry(w, splitY, d), brickMat);
    lower.position.set(cx, baseY + splitY / 2, cz);
    lower.castShadow = true;
    lower.receiveShadow = true;
    group.add(lower);
    // Upper half (fades when player is inside)
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(w, upperH, d),
      upperWallMat,
    );
    upper.position.set(cx, baseY + splitY + upperH / 2, cz);
    upper.castShadow = true;
    upper.receiveShadow = true;
    group.add(upper);
    pushUpperWall(upper);
  }

  // Back Wall (West)
  addSplitWall(0.5, venueD - 1.5, vx - venueW / 2, vz);

  // North Wall
  addSplitWall(venueW - 1.5, 0.5, vx, vz - venueD / 2);

  // South Wall
  addSplitWall(venueW - 1.5, 0.5, vx, vz + venueD / 2);

  // East Wall — split for 6-unit doorway
  const ewl = (venueD - 6.0) / 2;
  addSplitWall(0.5, ewl - 0.8, vx + venueW / 2, vz - 3.0 - (ewl - 0.8) / 2);
  addSplitWall(0.5, ewl - 0.8, vx + venueW / 2, vz + 3.0 + (ewl - 0.8) / 2);
  // Glass panel closing the entrance opening so it doesn't look like a freestanding door frame
  const glassDoorMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.15,
    metalness: 0.8,
    transparent: true,
    opacity: 0.6,
  });
  // Glass door removed — left a clear walk-through entrance

  // ── Concert venue ceiling (fades when player enters) ──────────────────
  const concertCeilMat = new THREE.MeshStandardMaterial({
    color: '#1a1a2e',
    roughness: 0.8,
    transparent: true,
    opacity: 1.0,
  });
  const concertCeiling = createFloor(
    venueW - 1.0,
    venueD - 1.0,
    concertCeilMat,
    vx,
    baseY + venueH,
    vz,
  );
  group.add(concertCeiling);
  pushRoof(concertCeiling);

  // Arched Windows
  const windowCount = 4;
  const windowWidth = 3.2;
  const windowHeight = 5.5;
  const windowSpacing = (venueW - 6.0) / windowCount;

  for (let i = 0; i < windowCount; i++) {
    const wx = vx - (venueW - 8.0) / 2 + i * windowSpacing;

    const windowFrameN = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth, windowHeight, 0.6),
      stoneTrimMat,
    );
    windowFrameN.position.set(wx, baseY + 4.0, vz - venueD / 2);
    group.add(windowFrameN);

    const glassN = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth - 0.6, windowHeight - 0.6, 0.2),
      darkGlassMat,
    );
    glassN.position.set(wx, baseY + 4.0, vz - venueD / 2);
    group.add(glassN);

    const windowFrameS = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth, windowHeight, 0.6),
      stoneTrimMat,
    );
    windowFrameS.position.set(wx, baseY + 4.0, vz + venueD / 2);
    group.add(windowFrameS);

    const glassS = new THREE.Mesh(
      new THREE.BoxGeometry(windowWidth - 0.6, windowHeight - 0.6, 0.2),
      darkGlassMat,
    );
    glassS.position.set(wx, baseY + 4.0, vz + venueD / 2);
    group.add(glassS);
  }

  // Portico removed — columns looked freestanding from across the field.
  // The wall opening + lintel still frame the entrance clearly.

  // Stone Trim / Cornice
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(venueW + 0.8, 0.5, venueD + 0.8),
    stoneTrimMat,
  );
  cornice.position.set(vx, baseY + venueH + 0.25, vz);
  cornice.castShadow = true;
  group.add(cornice);

  // Oval/Circular Dome Structure
  const domeBaseCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(15.0, 15.5, 1.2, 32),
    stoneTrimMat,
  );
  domeBaseCollar.position.set(vx, baseY + venueH + 0.85, vz);
  domeBaseCollar.castShadow = true;
  domeBaseCollar.receiveShadow = true;
  group.add(domeBaseCollar);
  pushRoof(domeBaseCollar);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(15.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    copperDomeMat,
  );
  dome.position.set(vx, baseY + venueH + 1.45, vz);
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);
  pushRoof(dome);

  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.4, 3.0, 8),
    stoneTrimMat,
  );
  spire.position.set(vx, baseY + venueH + 1.45 + 15.0 + 1.5, vz);
  spire.castShadow = true;
  spire.receiveShadow = true;
  group.add(spire);
  pushRoof(spire);

  const spireGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 6, 6),
    new THREE.MeshBasicMaterial({ color: '#c084fc' }),
  );
  spireGlow.position.set(vx, baseY + venueH + 1.45 + 15.0 + 3.0, vz);
  group.add(spireGlow);
  pushRoof(spireGlow);

  // Stage (against west wall)
  // stageW = north-south span, stageD = east-west depth — BoxGeometry maps to (X, Y, Z)
  // so we pass (stageD, stageH, stageW) to get depth in X and width in Z.
  const stageW = 26,
    stageD = 8,
    stageH = 0.5;
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(stageD, stageH, stageW),
    stageMat,
  );
  stage.position.set(
    vx - venueW / 2 + stageD / 2 + 1.0,
    baseY + stageH / 2,
    vz,
  );
  stage.receiveShadow = true;
  stage.castShadow = true;
  group.add(stage);

  // Raised lip at the audience-facing (east) edge of the stage
  const stageFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, stageH + 0.1, stageW),
    new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.6 }),
  );
  stageFront.position.set(
    vx - venueW / 2 + stageD + 1.0,
    baseY + stageH / 2 + 0.05,
    vz,
  );
  stageFront.castShadow = true;
  stageFront.receiveShadow = true;
  group.add(stageFront);

  // Collision wall — stops players walking into the stage face so legs don't clip
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(vx - venueW / 2 + stageD + 0.6, baseY, vz - stageW / 2),
      new THREE.Vector3(
        vx - venueW / 2 + stageD + 1.4,
        baseY + stageH + 1.8,
        vz + stageW / 2,
      ),
    ),
  );

  // Giant screen
  const screenW = 22,
    screenH = 8;
  const screenY = baseY + stageH + 0.5 + screenH / 2;
  const screenX = vx - venueW / 2 + 0.5;

  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, screenH + 0.6, 0.3),
      frameMat,
    );
    post.position.set(screenX, screenY, vz + side * (screenW / 2 + 0.15));
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  });

  const topRails = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.12, screenW + 0.6),
    frameMat,
  );
  topRails.position.set(screenX, screenY + screenH / 2 + 0.3, vz);
  topRails.castShadow = true;
  topRails.receiveShadow = true;
  group.add(topRails);

  const bottomRails = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.12, screenW + 0.6),
    frameMat,
  );
  bottomRails.position.set(screenX, screenY - screenH / 2 - 0.3, vz);
  bottomRails.castShadow = true;
  bottomRails.receiveShadow = true;
  group.add(bottomRails);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    screenMat.clone(),
  );
  screenMesh.position.set(screenX + 0.15, screenY, vz);
  screenMesh.rotation.y = Math.PI / 2;
  screenMesh.userData = { roomId: 9 };
  state.clickableScreens.push(screenMesh);
  state.roomScreens.set(9, {
    material: screenMesh.material,
    baseColor: screenMesh.material.color.clone(),
    baseEmissive: screenMesh.material.emissive.clone(),
  });
  group.add(screenMesh);

  const borderEdgeGeo = new THREE.EdgesGeometry(
    new THREE.PlaneGeometry(screenW + 0.3, screenH + 0.3),
  );
  const border = new THREE.LineSegments(
    borderEdgeGeo,
    new THREE.LineBasicMaterial({
      color: '#a855f7',
      transparent: true,
      opacity: 0.25,
    }),
  );
  border.position.copy(screenMesh.position);
  border.rotation.copy(screenMesh.rotation);
  group.add(border);

  // Lighting
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#a855f7',
    emissive: '#a855f7',
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.12,
  });
  const glowRing = new THREE.Mesh(new THREE.RingGeometry(8, 10, 32), glowMat);
  glowRing.rotation.x = FLAT;
  glowRing.position.set(vx, baseY + 0.04, vz);
  group.add(glowRing);

  // ── Grand entrance stairway (proper rise/run: 0.15 rise, 0.35 tread) ──
  const stairMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.55,
    metalness: 0.04,
  });
  const stepRise = 0.15,
    stepTread = 0.35,
    stepCount = 5;
  const stairStartX = vx + venueW / 2 + 0.2;
  for (let i = 0; i < stepCount; i++) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(stepTread, stepRise, 16),
      stairMat,
    );
    s.position.set(
      stairStartX + i * stepTread + stepTread / 2,
      baseY + (i + 0.5) * stepRise,
      vz,
    );
    s.receiveShadow = true;
    s.castShadow = true;
    group.add(s);
  }

  // ── Decorative pilasters along the east facade (skipping center: zOff=0 would block the door) ──
  const pilasterMat = new THREE.MeshStandardMaterial({
    color: '#d4cfc6',
    roughness: 0.5,
    metalness: 0.05,
  });
  for (let zOff = -12; zOff <= 12; zOff += 6) {
    if (zOff === 0) continue;
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, venueH + 1.5, 0.5),
      pilasterMat,
    );
    p.position.set(
      vx + venueW / 2 - 0.2,
      baseY + (venueH + 1.5) / 2,
      vz + zOff,
    );
    p.castShadow = true;
    p.receiveShadow = true;
    group.add(p);
  }

  // ── Pediment above the entrance ──────────────────────────────────────
  const pedMat = new THREE.MeshStandardMaterial({
    color: '#d4cfc6',
    roughness: 0.5,
  });
  const pedHalf = 10;
  const pedShape = new THREE.Shape();
  pedShape.moveTo(-pedHalf, 0);
  pedShape.lineTo(pedHalf, 0);
  pedShape.lineTo(0, 3.5);
  pedShape.closePath();
  const pedGeo = new THREE.ExtrudeGeometry(pedShape, {
    depth: 0.5,
    bevelEnabled: false,
  });
  const pediment = new THREE.Mesh(pedGeo, pedMat);
  pediment.position.set(vx + venueW / 2 - 0.4, baseY + venueH + 0.8, vz);
  pediment.rotation.y = Math.PI / 2;
  pediment.castShadow = true;
  group.add(pediment);

  // Recessed tympanum (recessed inner triangle)
  const tympMat = new THREE.MeshStandardMaterial({
    color: '#b0a898',
    roughness: 0.6,
  });
  const tympShape = new THREE.Shape();
  tympShape.moveTo(-pedHalf + 0.5, 0);
  tympShape.lineTo(pedHalf - 0.5, 0);
  tympShape.lineTo(0, 3.2);
  tympShape.closePath();
  const tympGeo = new THREE.ExtrudeGeometry(tympShape, {
    depth: 0.3,
    bevelEnabled: false,
  });
  const tympanum = new THREE.Mesh(tympGeo, tympMat);
  tympanum.position.set(vx + venueW / 2 - 0.25, baseY + venueH + 0.95, vz);
  tympanum.rotation.y = Math.PI / 2;
  tympanum.castShadow = true;
  tympanum.receiveShadow = true;
  group.add(tympanum);

  // ── Corner acroterion (decorative pedestal on each corner) ──────────
  const accMat = new THREE.MeshStandardMaterial({
    color: '#d4cfc6',
    roughness: 0.5,
  });
  const accPositions = [
    [vx - venueW / 2, vz - venueD / 2],
    [vx + venueW / 2, vz - venueD / 2],
    [vx - venueW / 2, vz + venueD / 2],
    [vx + venueW / 2, vz + venueD / 2],
  ];
  accPositions.forEach(([ax, az]) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), accMat);
    base.position.set(ax, baseY + venueH + 0.2, az);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), accMat);
    pillar.position.set(ax, baseY + venueH + 1.3, az);
    pillar.castShadow = true;
    group.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), accMat);
    cap.position.set(ax, baseY + venueH + 2.3, az);
    cap.castShadow = true;
    group.add(cap);
  });

  // ── Glow ring around the dome base ──────────────────────────────────
  const glowRingMat = new THREE.MeshStandardMaterial({
    color: '#a855f7',
    emissive: '#a855f7',
    emissiveIntensity: 0.06,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  });
  const domeGlowRing = new THREE.Mesh(
    new THREE.RingGeometry(14.0, 15.8, 40),
    glowRingMat,
  );
  domeGlowRing.rotation.x = FLAT;
  domeGlowRing.position.set(vx, baseY + venueH + 0.04, vz);
  group.add(domeGlowRing);

  // Collision barriers
  // North Wall
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(
        vx - venueW / 2 - 0.25,
        baseY - 0.5,
        vz - venueD / 2 - 0.25,
      ),
      new THREE.Vector3(
        vx + venueW / 2 + 0.25,
        baseY + venueH,
        vz - venueD / 2 + 0.25,
      ),
    ),
  );
  // South Wall
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(
        vx - venueW / 2 - 0.25,
        baseY - 0.5,
        vz + venueD / 2 - 0.25,
      ),
      new THREE.Vector3(
        vx + venueW / 2 + 0.25,
        baseY + venueH,
        vz + venueD / 2 + 0.25,
      ),
    ),
  );
  // West Wall
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(
        vx - venueW / 2 - 0.25,
        baseY - 0.5,
        vz - venueD / 2 - 0.25,
      ),
      new THREE.Vector3(
        vx - venueW / 2 + 0.25,
        baseY + venueH,
        vz + venueD / 2 + 0.25,
      ),
    ),
  );
  // East Wall - North Section
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(
        vx + venueW / 2 - 0.25,
        baseY - 0.5,
        vz - venueD / 2 - 0.25,
      ),
      new THREE.Vector3(vx + venueW / 2 + 0.25, baseY + venueH, vz - 3.0),
    ),
  );
  // East Wall - South Section
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(vx + venueW / 2 - 0.25, baseY - 0.5, vz + 3.0),
      new THREE.Vector3(
        vx + venueW / 2 + 0.25,
        baseY + venueH,
        vz + venueD / 2 + 0.25,
      ),
    ),
  );

  state.scene.add(group);
  state.landmarkGroups.set('concertVenue', group);
  const [cx, cz] = LANDMARK_REGISTRY.concertVenue.approxCenter;
  registerStaticScenery(group, { kind: 'outdoor', distance: 120, center: { x: cx, z: cz } });
}
