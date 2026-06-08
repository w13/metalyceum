// Exterior plaza construction, banners, indicators, and the animated fountain
import * as THREE from 'three';
export const FOUNTAIN_X = 0;
export const FOUNTAIN_Z = 56.5;

import { state } from '../state.js';
import { ROOM_LAYOUTS, WORLD_CONFIG, ROOM_LABEL_HEIGHT } from '../config.js';
import { getTerrainHeight } from '../physics.js';
import { createMarbleTileTexture, createStoneTexture, createBrickTexture, createCanadianFlagTexture } from '../textures.js';
import { registerStaticScenery } from './visibility.js';
import { createPanelLabelSprite } from './assets.js';
import { deformPlaneToTerrain, createGroundedPatch, createGroundedRing, getTerrainCeiling, addSceneryCollider } from './utils.js';
import { createTrimmedBush, createOrnamentalTree, createFlowerCluster, buildFrontApproachLandscaping } from './foliage.js';
import { HALF_PI, FLAT } from '../math.js';

export function createBannerStand(x, z, rotationY, color, texture) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.85 });
  const clothMat = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.08,
        roughness: 0.65
      });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.4, 6), poleMat);
  pole.position.y = 3.2;
  pole.castShadow = true;
  pole.receiveShadow = true;
  group.add(pole);

  const topper = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), poleMat);
  topper.position.y = 6.7;
  topper.castShadow = true;
  topper.receiveShadow = true;
  group.add(topper);

  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), clothMat);
  cloth.position.set(0.95, 4.7, 0);
  cloth.rotation.y = Math.PI / 2;
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  group.add(cloth);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), poleMat);
  trim.position.set(0.05, 4.7, 0);
  trim.castShadow = true;
  trim.receiveShadow = true;
  group.add(trim);

  group.position.set(x, getTerrainHeight(x, z), z);
  group.rotation.y = rotationY;
  registerStaticScenery(group, { kind: 'outdoor' });
  state.animatedScenery.push({
    object: cloth,
    type: 'banner',
    seed: Math.random() * Math.PI * 2,
    speed: 1.2 + Math.random() * 0.5,
    amplitude: 0.06 + Math.random() * 0.03
  });
  state.scene.add(group);
}

export function createRoomIndicator(room) {
  const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent, label: 'Room' };
  const group = new THREE.Group();
  
  const indicatorX = room.x < 0 
    ? room.x + room.width / 2 - 1.5 
    : room.x - room.width / 2 + 1.5;
  group.position.set(indicatorX, 0.15, room.z);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.18, 18),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.7, metalness: 0.2 })
  );
  base.position.y = 0.08;
  base.userData.roomId = room.id;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.12, 10, 24),
    new THREE.MeshStandardMaterial({ color: layout.themeColor, emissive: layout.themeColor, emissiveIntensity: 0.16 })
  );
  ring.rotation.x = HALF_PI;
  ring.position.y = 0.24;
  ring.userData.roomId = room.id;
  group.add(ring);

  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 1.32, 2.8, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: layout.themeColor,
      emissive: layout.themeColor,
      emissiveIntensity: 0.38,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    })
  );
  glow.position.y = 1.45;
  glow.userData.roomId = room.id;
  group.add(glow);

  const light = new THREE.PointLight(layout.themeColor, 0.45, 9, 2);
  light.position.y = 1.9;
  group.add(light);

  const sprite = createPanelLabelSprite(room.name, layout.label, layout.themeColor);
  sprite.position.set(0, ROOM_LABEL_HEIGHT, 0);
  sprite.userData.title = room.name;
  sprite.userData.subtitle = layout.label;
  group.add(sprite);

  state.ROOM_INDICATORS.set(room.id, {
    group,
    ring,
    glow,
    light,
    seed: Math.random() * Math.PI * 2
  });
  state.ROOM_SIGN_SPRITES.set(room.id, sprite);
  state.clickableRoomMarkers.push(base, ring, glow);

  registerStaticScenery(group, { kind: 'outdoor', distance: 120 });
  state.scene.add(group);
  // Push to groundFloorItems so the fade layer hides this on the second floor
  if (state.groundFloorItems) state.groundFloorItems.push(group);
}

export function buildExteriorPlaza() {
  const lawnMat = new THREE.MeshStandardMaterial({
    color: '#3a7d3a',
    roughness: 0.85,
    metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.62, metalness: 0.06 });
  const lawnIslands = [
    { x: -12.5, z: 47.0, radius: 1.95, scaleX: 2.95, scaleY: 1.7 },
    { x: 12.5, z: 47.0, radius: 1.95, scaleX: 2.95, scaleY: 1.7 },
    { x: -16.4, z: 58.8, radius: 2.25, scaleX: 2.35, scaleY: 1.9 },
    { x: 16.4, z: 58.8, radius: 2.25, scaleX: 2.35, scaleY: 1.9 },
    { x: -24.0, z: 63.0, radius: 1.55, scaleX: 2.2, scaleY: 1.1 },
    { x: 22.0, z: 63.0, radius: 1.55, scaleX: 2.2, scaleY: 1.1 }
  ];

  lawnIslands.forEach((island) => {
    const lawn = createGroundedPatch(
      new THREE.CircleGeometry(island.radius, 32),
      lawnMat,
      island.x,
      island.z,
      { yOffset: 0.055, scaleX: island.scaleX, scaleY: island.scaleY }
    );
    state.scene.add(lawn);

    const curb = createGroundedRing(
      island.radius * 0.95,
      island.radius * 1.08,
      32,
      curbMat,
      island.x,
      island.z,
      { yOffset: 0.085, scaleX: island.scaleX, scaleY: island.scaleY }
    );
    state.scene.add(curb);
  });

  buildFrontFountain();
  buildFrontApproachLandscaping();
  // Replace decorative banners with Canadian flags at the main entrance
  {
    const flagTex = createCanadianFlagTexture();
    createBannerStand(-12.25, 41.6, Math.PI * 0.08, null, flagTex);
    createBannerStand(12.25, 41.6, -Math.PI * 0.08, null, flagTex);
  }
}

export function buildFrontFountain() {
  // Kept farther forward so the front entrance spawn and path stay clear.
  const fx = FOUNTAIN_X, fz = FOUNTAIN_Z;
  const fountainBaseY = getTerrainCeiling(fx, fz, 3.7, 3.7);

  // ── Materials ──────────────────────────────────────────────────────────
  const stoneTex = createStoneTexture();
  const brickTex = createBrickTexture();

  const masonryMat = new THREE.MeshStandardMaterial({
    map: stoneTex, roughness: 0.78, color: '#94a3b8'
  });
  const brickMat = new THREE.MeshStandardMaterial({
    map: brickTex, roughness: 0.85
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#64748b', roughness: 0.5, metalness: 0.3
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#0c4a6e', roughness: 0.05, metalness: 0.8,
    transparent: true, opacity: 0.72
  });
  const darkWaterMat = new THREE.MeshStandardMaterial({
    color: '#082f49', roughness: 0.1, metalness: 0.6,
    transparent: true, opacity: 0.7
  });
  const brightWaterMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8', roughness: 0.02, metalness: 0.45,
    transparent: true, opacity: 0.5, side: THREE.DoubleSide
  });
  const sprayMat = new THREE.MeshStandardMaterial({
    color: '#a5f3fc', roughness: 0.02, metalness: 0.12,
    transparent: true, opacity: 0.42, side: THREE.DoubleSide
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: '#166534', roughness: 0.8, flatShading: true
  });
  const darkFoliageMat = new THREE.MeshStandardMaterial({
    color: '#14532d', roughness: 0.82, flatShading: true
  });

  // ── Marble fountain plaza slab ──────────────────────────────────────────
  // Circular disc (r=7.5) the fountain sits on, plus a rectangular approach
  // strip that connects the building's front portico (z≈44) to the slab.
  {
    const marbleTex = createMarbleTileTexture();
    const marblePlazaMat = new THREE.MeshStandardMaterial({
      map: marbleTex,
      color: '#ede8dc',
      roughness: 0.12,
      metalness: 0.08,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });

    // Promenade widened slightly so the new side gardens can move outward
    // without crowding the main entry axis.
    const approachGeo = new THREE.PlaneGeometry(8.75, 12.5, 16, 24);
    deformPlaneToTerrain(approachGeo, 50.25);
    const marbleApproach = new THREE.Mesh(approachGeo, marblePlazaMat.clone());
    marbleApproach.rotation.x = FLAT;
    marbleApproach.position.set(fx, 0.09, 50.25);
    marbleApproach.receiveShadow = true;
    state.scene.add(marbleApproach);

    // Round plaza slab — fountain sits at its center
    const marbleSlab = new THREE.Mesh(
      new THREE.CircleGeometry(8.2, 56),
      marblePlazaMat
    );
    marbleSlab.rotation.x = FLAT;
    marbleSlab.position.set(fx, fountainBaseY + 0.15, fz);
    marbleSlab.receiveShadow = true;
    state.scene.add(marbleSlab);

    // Slim stone curb ring marking the slab perimeter
    const slabRim = new THREE.Mesh(
      new THREE.TorusGeometry(8.2, 0.07, 4, 56),
      new THREE.MeshStandardMaterial({ color: '#b0a898', roughness: 0.5, metalness: 0.12 })
    );
    slabRim.rotation.x = HALF_PI;
    slabRim.position.set(fx, fountainBaseY + 0.15, fz);
    state.scene.add(slabRim);
  }

  // ── Masonry base wall ──────────────────────────────────────────────────
  // Outer ring with slight taper
  const baseWall = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.7, 0.8, 36),
    masonryMat
  );
  baseWall.position.set(fx, fountainBaseY + 0.4, fz);
  baseWall.receiveShadow = true;
  baseWall.castShadow = true;
  state.scene.add(baseWall);
  addSceneryCollider(fx - 3.8, fx + 3.8, fz - 3.8, fz + 3.8, 'front-fountain');

  const apronRing = createGroundedRing(
    3.85,
    5.15,
    40,
    new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.82, metalness: 0.04 }),
    fx,
    fz,
    { yOffset: 0.05 }
  );
  state.scene.add(apronRing);

  // Brick cap ring on top of the wall
  const capRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.55, 0.15, 8, 36),
    brickMat
  );
  capRing.position.set(fx, fountainBaseY + 0.8, fz);
  capRing.rotation.x = HALF_PI;
  capRing.castShadow = true;
  capRing.receiveShadow = true;
  state.scene.add(capRing);

  // ── Inner basin floor ──────────────────────────────────────────────────
  const basinFloor = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 32),
    masonryMat
  );
  basinFloor.rotation.x = FLAT;
  basinFloor.position.set(fx, fountainBaseY + 0.03, fz);
  basinFloor.castShadow = true;
  basinFloor.receiveShadow = true;
  state.scene.add(basinFloor);

  // ── Water pool ─────────────────────────────────────────────────────────
  const waterPool = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 3.12, 0.78, 36),
    new THREE.MeshStandardMaterial({
      color: '#1a6fa8',
      emissive: '#0a3a60',
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.55,
      transparent: true,
      opacity: 0.70,
      side: THREE.DoubleSide
    })
  );
  waterPool.position.set(fx, fountainBaseY + 0.39, fz);
  waterPool.userData.baseY = waterPool.position.y;
  waterPool.receiveShadow = true;
  state.scene.add(waterPool);



  // ── Central pedestal (stepped) ─────────────────────────────────────────
  const baseStep = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.0, 0.35, 14),
    masonryMat
  );
  baseStep.position.set(fx, fountainBaseY + 0.8 + 0.175, fz);
  baseStep.castShadow = true;
  baseStep.receiveShadow = true;
  state.scene.add(baseStep);

  const midStep = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.75, 0.5, 12),
    masonryMat
  );
  midStep.position.set(fx, fountainBaseY + 0.8 + 0.35 + 0.25, fz);
  midStep.castShadow = true;
  midStep.receiveShadow = true;
  state.scene.add(midStep);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 1.2, 10),
    masonryMat
  );
  column.position.set(fx, fountainBaseY + 0.8 + 0.35 + 0.5 + 0.6, fz);
  column.castShadow = true;
  column.receiveShadow = true;
  state.scene.add(column);

  // Decorative ring mid-column
  const midRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.06, 6, 14),
    trimMat
  );
  midRing.position.set(fx, fountainBaseY + 0.8 + 0.35 + 0.5 + 0.4, fz);
  midRing.rotation.x = HALF_PI;
  midRing.castShadow = true;
  midRing.receiveShadow = true;
  state.scene.add(midRing);

  // ── Upper basin ────────────────────────────────────────────────────────
  const upperBowl = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    masonryMat
  );
  upperBowl.position.set(fx, fountainBaseY + 0.8 + 0.35 + 0.5 + 1.2 + 0.55, fz);
  upperBowl.scale.y = 0.6;
  upperBowl.castShadow = true;
  upperBowl.receiveShadow = true;
  state.scene.add(upperBowl);

  // Brick trim on upper bowl rim
  const bowlRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.08, 6, 18),
    brickMat
  );
  bowlRim.position.set(fx, fountainBaseY + 0.8 + 0.35 + 0.5 + 1.2 + 0.55 - 0.02, fz);
  bowlRim.rotation.x = HALF_PI;
  bowlRim.castShadow = true;
  bowlRim.receiveShadow = true;
  state.scene.add(bowlRim);

  // ── Upper basin water fill ─────────────────────────────────────────
  const upperBowlY = fountainBaseY + 0.8 + 0.35 + 0.5 + 1.2 + 0.55;

  const upperWaterBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.84, 0.32, 18),
    new THREE.MeshStandardMaterial({
      color: '#0a3d6b', roughness: 0.08, metalness: 0.7,
      transparent: true, opacity: 0.78
    })
  );
  upperWaterBody.position.set(fx, upperBowlY - 0.38, fz);
  upperWaterBody.userData.baseY = upperWaterBody.position.y;
  state.scene.add(upperWaterBody);

  const upperWater = new THREE.Mesh(
    new THREE.CircleGeometry(0.76, 20),
    new THREE.MeshStandardMaterial({
      color: '#38bdf8', roughness: 0.02, metalness: 0.45,
      transparent: true, opacity: 0.35, side: THREE.DoubleSide
    })
  );
  upperWater.position.set(fx, upperBowlY - 0.19, fz);
  upperWater.userData.baseY = upperWater.position.y;
  state.scene.add(upperWater);

  let waterApple = null;
  let waterAppleGlow = null;

  // ── Top finial ─────────────────────────────────────────────────────────
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    trimMat
  );
  finial.position.set(fx, fountainBaseY + 0.8 + 0.35 + 0.5 + 1.2 + 0.55 + 0.08, fz);
  state.scene.add(finial);

  // ── Bushes around the fountain plaza ─────────────────────────────────────
  [
    { x: fx - 13.5, z: fz + 3.1, scale: 0.86, id: 'fountain-bush-west-back' },
    { x: fx + 12.6, z: fz + 3.7, scale: 0.86, id: 'fountain-bush-east-back' },
    { x: fx - 11.2, z: fz - 4.8, scale: 0.72, id: 'fountain-bush-west-front' },
    { x: fx + 11.2, z: fz - 4.8, scale: 0.72, id: 'fountain-bush-east-front' }
  ].forEach((pos) => {
    createTrimmedBush(pos.x, pos.z, {
      scale: pos.scale,
      bodyColor: foliageMat.color.getHexString ? `#${foliageMat.color.getHexString()}` : '#166534',
      tuftColor: darkFoliageMat.color.getHexString ? `#${darkFoliageMat.color.getHexString()}` : '#14532d',
      assetId: pos.id
    });
  });

  // Keep the promenade shoulders open; the flower beds now live in the outer
  // lawn islands built by buildFrontApproachLandscaping().

  // ── Collision barrier ───────────────────────────────────────────────────
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(fx - 3.8, -0.5, fz - 3.8),
    new THREE.Vector3(fx + 3.8, 2.5, fz + 3.8)
  ));

  // ── Enhanced animated water surfaces ────────────────
  const waterAnimGroup = new THREE.Group();
  waterAnimGroup.position.set(fx, fountainBaseY, fz);
  state.scene.add(waterAnimGroup);

  // ── Large apple-shaped water column: fills the entire pool ────────────
  // A wide-bottomed water mass that covers nearly the full pool radius (r≈2.6)
  // at the base, narrows through an organic apple waist (r≈1.4), then tapers
  // up to the upper bowl (r≈0.3). Creates the illusion of deep pool water.
  {
    const colTopY = 3.1;
    const colBotY = 0.35;
    const colH = colTopY - colBotY;
    const baPts = [];
    const baN = 40;
    for (let i = 0; i <= baN; i++) {
      const t = i / baN;
      // Custom profile: wide base → narrow waist → tapered top
      let r;
      if (t < 0.15) {
        // Base: flares out to cover the pool floor
        const p = t / 0.15;
        r = 0.3 + p * p * 2.3; // 0.3 → 2.6
      } else if (t < 0.45) {
        // Lower body: gently narrow from 2.6 → 1.6
        const p = (t - 0.15) / 0.3;
        r = 2.6 - p * 1.0;
      } else if (t < 0.65) {
        // Waist: apple bulge, 1.6 → 1.8 → 1.4
        const p = (t - 0.45) / 0.2;
        r = 1.6 + 0.2 * Math.sin(p * Math.PI);
      } else if (t < 0.85) {
        // Upper body: taper 1.4 → 0.8
        const p = (t - 0.65) / 0.2;
        r = 1.4 - p * 0.6;
      } else {
        // Top: narrow neck 0.8 → 0.3
        const p = (t - 0.85) / 0.15;
        r = 0.8 - p * 0.5;
      }
      baPts.push(new THREE.Vector2(Math.max(0.05, r), t * colH - colH / 2));
    }
    const bigApple = new THREE.Mesh(
      new THREE.LatheGeometry(baPts, 28),
      new THREE.MeshStandardMaterial({
        color: '#1d4ed8', emissive: '#0ea5e9', emissiveIntensity: 0.3,
        roughness: 0.03, metalness: 0.5,
        transparent: true, opacity: 0.48, side: THREE.DoubleSide
      })
    );
    bigApple.position.set(0, (colTopY + colBotY) / 2, 0);
    waterAnimGroup.add(bigApple);
  }

  // ── 3D apple-shaped water blob ─────────────────────────────────────────
  {
    const appleProfilePts = [];
    const appleR = 0.92;
    const appleH = 1.72;
    const appleN = 36;
    for (let i = 0; i <= appleN; i++) {
      const t = i / appleN;
      const angle = t * Math.PI;
      let r = Math.sin(angle) * appleR;
      if (t > 0.3 && t < 0.7) {
        r *= 1 + 0.14 * Math.sin((t - 0.3) / 0.4 * Math.PI);
      }
      if (t > 0.80) {
        const pinch = (t - 0.80) / 0.20;
        r *= 1 - pinch * 0.58;
      }
      const y = Math.cos(angle) * (appleH / 2);
      appleProfilePts.push(new THREE.Vector2(Math.max(0, r), y));
    }

    waterApple = new THREE.Mesh(
      new THREE.LatheGeometry(appleProfilePts, 24),
      new THREE.MeshStandardMaterial({
        color: '#0ea5e9', roughness: 0.02, metalness: 0.62,
        transparent: true, opacity: 0.70, side: THREE.DoubleSide
      })
    );
    waterApple.position.y = 4.35;
    waterApple.userData.baseY = waterApple.position.y;
    waterAnimGroup.add(waterApple);

    const appleGlowPts = appleProfilePts.map((p) => new THREE.Vector2(p.x * 0.72, p.y * 0.9));
    waterAppleGlow = new THREE.Mesh(
      new THREE.LatheGeometry(appleGlowPts, 18),
      new THREE.MeshStandardMaterial({
        color: '#7dd3fc', roughness: 0.01, metalness: 0.25,
        transparent: true, opacity: 0.38, side: THREE.DoubleSide
      })
    );
    waterAppleGlow.position.y = 4.35;
    waterAppleGlow.userData.baseY = waterAppleGlow.position.y;
    waterAnimGroup.add(waterAppleGlow);
  }

  // 3D pool surface — animated cylinder cap with ripple deformation
  const poolSurfaceGeo = new THREE.CircleGeometry(2.96, 48);
  const poolPos = poolSurfaceGeo.attributes.position;
  const poolRadii = new Float32Array(poolPos.count);
  for (let i = 0; i < poolPos.count; i++) {
    const vx = poolPos.getX(i);
    const vy = poolPos.getY(i);
    poolRadii[i] = Math.sqrt(vx * vx + vy * vy);
  }
  poolSurfaceGeo.userData.poolRadii = poolRadii;

  const poolSurfaceMat = new THREE.MeshStandardMaterial({
    color: '#0ea5e9',
    roughness: 0.05,
    metalness: 0.35,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide
  });
  const poolSurface = new THREE.Mesh(poolSurfaceGeo, poolSurfaceMat);
  poolSurface.position.y = 0.72;
  poolSurface.userData.baseY = poolSurface.position.y;
  poolSurface.userData.waveAmp = 0.025;
  poolSurface.userData.waveFreq = 2.5;
  waterAnimGroup.add(poolSurface);

  // Second water layer

  // Emanating ripple rings
  const rippleMat = new THREE.MeshStandardMaterial({
    color: '#67e8f9',
    roughness: 0.02,
    metalness: 0.18,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
  });
  const poolRipple = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 2.6, 48),
    rippleMat
  );
  poolRipple.position.y = 0.706;
  poolRipple.userData.baseY = poolRipple.position.y;
  waterAnimGroup.add(poolRipple);

  const poolRipple2 = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 2.6, 48),
    rippleMat.clone()
  );
  poolRipple2.position.y = 0.707;
  poolRipple2.userData.baseY = poolRipple2.position.y;
  waterAnimGroup.add(poolRipple2);

  // Fake caustic light disc
  const causticMat = new THREE.MeshBasicMaterial({
    color: '#7dd3fc',
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide
  });
  const causticDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 32),
    causticMat
  );
  causticDisc.position.y = 0.25;
  causticDisc.userData.baseY = causticDisc.position.y;
  waterAnimGroup.add(causticDisc);

  // Upper bowl water surface
  const upperPoolSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 24),
    brightWaterMat.clone()
  );
  upperPoolSurface.position.y = 3.35;
  upperPoolSurface.userData.baseY = upperPoolSurface.position.y;
  waterAnimGroup.add(upperPoolSurface);

  const upperRippleMat = new THREE.MeshStandardMaterial({
    color: '#a5f3fc',
    roughness: 0.02,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide
  });
  const upperRipple = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.62, 24),
    upperRippleMat
  );
  upperRipple.position.y = 3.355;
  upperRipple.userData.baseY = upperRipple.position.y;
  waterAnimGroup.add(upperRipple);

  const upperRipple2 = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.62, 24),
    upperRippleMat.clone()
  );
  upperRipple2.position.y = 3.356;
  upperRipple2.userData.baseY = upperRipple2.position.y;
  waterAnimGroup.add(upperRipple2);

  // Center spray jet
  const centerJet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.09, 1.55, 10, 1, true),
    sprayMat.clone()
  );
  centerJet.position.y = 3.72;
  centerJet.userData.baseY = centerJet.position.y;
  waterAnimGroup.add(centerJet);

  // Cascade streams
  const cascadeBlobPts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const angle = t * Math.PI;
    let r = Math.sin(angle) * 0.16;
    if (t > 0.2 && t < 0.8) r *= 1 + 0.18 * Math.sin((t - 0.2) / 0.6 * Math.PI);
    cascadeBlobPts.push(new THREE.Vector2(Math.max(0, r), (t - 0.5) * 2.1));
  }
  const cascadeStreamGeo = new THREE.LatheGeometry(cascadeBlobPts, 16);

  const cascadeMat = new THREE.MeshStandardMaterial({
    color: '#7dd3fc',
    roughness: 0.02,
    metalness: 0.45,
    transparent: true,
    opacity: 0.60,
    side: THREE.DoubleSide
  });

  const cascadeStreams = [];
  const streamCount = 6;
  for (let i = 0; i < streamCount; i++) {
    const streamPivot = new THREE.Group();
    streamPivot.rotation.y = (Math.PI * 2 * i) / streamCount;

    const stream = new THREE.Mesh(cascadeStreamGeo, cascadeMat.clone());
    stream.position.set(0, 2.22, 0.92);
    stream.rotation.x = Math.PI * 0.22;
    stream.userData = {
      baseY: stream.position.y,
      phase: i * 0.7
    };
    streamPivot.add(stream);
    waterAnimGroup.add(streamPivot);
    cascadeStreams.push(stream);
  }

  // Rising bubbles
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: '#bae6fd',
    roughness: 0.0,
    metalness: 0.05,
    transparent: true,
    opacity: 0.45
  });
  const bubbleCount = 10;
  const bubbles = [];
  for (let i = 0; i < bubbleCount; i++) {
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.025 + Math.random() * 0.03, 6, 6),
      bubbleMat.clone()
    );
    const angle = (Math.PI * 2 * i) / bubbleCount + (Math.random() - 0.5) * 0.4;
    const radius = 0.06 + Math.random() * 0.18;
    const heightOffset = 0.8 + Math.random() * 1.8;
    bubble.position.set(
      Math.cos(angle) * radius,
      heightOffset,
      Math.sin(angle) * radius
    );
    bubble.userData = {
      radius: radius,
      riseSpeed: 0.3 + Math.random() * 0.25,
      wobbleAmp: 0.02 + Math.random() * 0.03,
      wobbleFreq: 0.8 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      respawnY: heightOffset,
      maxY: 3.5 + Math.random() * 0.4
    };
    waterAnimGroup.add(bubble);
    bubbles.push(bubble);
  }

  waterAnimGroup.userData = {
    basinWater: waterPool,
    upperWaterBody,
    upperWater,
    poolSurface,
    // poolSurface2 removed,
    poolRipple,
    poolRipple2,
    causticDisc,
    upperPoolSurface,
    upperRipple,
    upperRipple2,
    centerJet,
    cascadeStreams,
    bubbles,
    waterApple,
    waterAppleGlow
  };

  registerStaticScenery(waterAnimGroup, { kind: 'outdoor', distance: 95 });
  state.animatedScenery.push({
    object: waterAnimGroup,
    type: 'fountain',
    seed: Math.random() * Math.PI * 2,
    speed: 0.3,
    amplitude: 0.02
  });

  // Fish
  const fishColors = ['#f97316', '#f43f5e', '#eab308', '#38bdf8', '#a855f7'];
  for (let i = 0; i < 3; i++) {
    const fishGroup = new THREE.Group();
    const angle = (Math.PI * 2 / 3) * i;
    const orbitRadius = 1.2 + Math.random() * 0.6;

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 5, 5),
      new THREE.MeshStandardMaterial({ color: fishColors[i], roughness: 0.5 })
    );
    body.scale.set(1.8, 0.7, 0.7);
    body.position.x = 0.1;
    fishGroup.add(body);

    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.08, 4),
      new THREE.MeshStandardMaterial({ color: fishColors[i], roughness: 0.6 })
    );
    tail.position.x = -0.08;
    tail.rotation.z = Math.PI / 2;
    fishGroup.add(tail);

    fishGroup.userData = {
      orbitAngle: angle,
      orbitRadius: orbitRadius,
      orbitSpeed: 0.6 + Math.random() * 0.4,
      bobPhase: Math.random() * Math.PI * 2,
      bobSpeed: 1.2 + Math.random() * 0.6
    };
    fishGroup.position.set(fx, fountainBaseY + 0.1, fz);
    state.scene.add(fishGroup);
    state.animatedScenery.push({
      object: fishGroup,
      type: 'fish',
      seed: Math.random() * 100
    });
  }
}
