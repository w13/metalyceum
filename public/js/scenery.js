// Scenery, Procedural 3D Models, and Ambient NPCs for Metalyceum
import { state } from './state.js';
import {
  MAP_SIZE,
  WORLD_CONFIG,
  ROOM_LAYOUTS,
  ROOM_SCENERY_VISIBILITY_DISTANCE,
  OUTDOOR_SCENERY_VISIBILITY_DISTANCE,
  ROOM_LABEL_HEIGHT
} from './config.js';
import { getTerrainHeight } from './physics.js';
import { getRoomEventStatus, safeMeetUrl } from './utils.js';

// --- Procedural Texture Generators ---
export function createGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base green
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, 0, 256, 256);
  
  // Noise & Grass details
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 2 + Math.random() * 6;
    const colorVal = 60 + Math.floor(Math.random() * 40);
    ctx.strokeStyle = `rgb(${colorVal - 20}, ${colorVal + 30}, ${colorVal - 30})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - len);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  return texture;
}

export function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base wood color
  ctx.fillStyle = '#6b4f3b';
  ctx.fillRect(0, 0, 256, 256);
  
  // Draw planks outlines
  ctx.strokeStyle = '#3e2a1e';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  
  // Staggered vertical joints
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const offset = (row % 2) * 64;
    for (let x = offset; x <= 256 + 64; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x % 256, y);
      ctx.lineTo(x % 256, y + 32);
      ctx.stroke();
    }
  }
  
  // Draw wood grain lines
  ctx.strokeStyle = 'rgba(62, 42, 30, 0.15)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + (Math.random() - 0.5) * 15, 170, y + (Math.random() - 0.5) * 15, 256, y);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

export function createStoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base grey
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(0, 0, 256, 256);
  
  // Grid lines (Tile borders)
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 256; i += 64) {
    ctx.moveTo(i, 0); ctx.lineTo(i, 256);
    ctx.moveTo(0, i); ctx.lineTo(256, i);
  }
  ctx.stroke();
  
  // Texture noise
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const grey = 80 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, 0.15)`;
    ctx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 4);
  return texture;
}

export function createBrickTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base red-brown brick
  ctx.fillStyle = '#5c504a';
  ctx.fillRect(0, 0, 256, 256);
  
  // Mortar lines
  ctx.strokeStyle = '#2d2724';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  // Horizontal lines
  for (let y = 0; y <= 256; y += 32) {
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
  }
  
  // Vertical staggered lines
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const offset = (row % 2) * 32;
    for (let x = offset; x <= 256 + 32; x += 64) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 32);
    }
  }
  ctx.stroke();
  
  // Brick surface weathering
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const noise = Math.random() > 0.5 ? 20 : -20;
    ctx.fillStyle = `rgba(${92 + noise}, ${80 + noise}, ${74 + noise}, 0.12)`;
    ctx.fillRect(x, y, 3 + Math.random() * 6, 2 + Math.random() * 4);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 2);
  return texture;
}

export function createSignBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Background (dark slate)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 1024, 256);
  
  // Outer border
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 1024 - 12, 256 - 12);
  
  // Inner border
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 1024 - 36, 256 - 36);
  
  // Write "Metalyceum"
  ctx.font = 'bold 88px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.shadowColor = '#0f172a';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('METALYCEUM', 512, 100);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Write "Funded by Canada Council for the Arts"
  ctx.font = 'italic 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Funded by Canada Council for the Arts', 512, 185);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// --- Dynamic Text Sprites ---
export function createPlayerNameSprite(name, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  // Round rect
  const r = 8;
  const x = 8, y = 8, w = 240, h = 48;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  
  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Text
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(3, 0.75, 1);
  return sprite;
}

export function createPanelLabelSprite(title, subtitle = '', accent = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = subtitle ? 152 : 112;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(8, 15, 28, 0.88)';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  const radius = 18;
  const width = canvas.width - 20;
  const height = canvas.height - 20;
  const x = 10;
  const y = 10;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.fillRect(26, 24, 8, height - 28);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(title, 54, subtitle ? 50 : 56);

  if (subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle, 54, 96);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.6, subtitle ? 1.7 : 1.2, 1);
  sprite.userData.disposeTexture = texture;
  return sprite;
}

// --- Static Scenery Visibility Registration ---
export function registerStaticScenery(object3d, options = {}) {
  const dist = options.distance || (options.kind === 'room' ? ROOM_SCENERY_VISIBILITY_DISTANCE : OUTDOOR_SCENERY_VISIBILITY_DISTANCE);
  state.STATIC_SCENERY.push({
    object3d,
    kind: options.kind || 'outdoor',
    roomId: options.roomId ?? null,
    distance: dist,
    distanceSquared: dist * dist
  });
  return object3d;
}

export function disposeSprite(sprite) {
  if (!sprite) return;
  if (sprite.material?.map) sprite.material.map.dispose();
  if (sprite.material) sprite.material.dispose();
}

export function refreshStaticSceneryVisibility() {
  const currentRoom = state.localPlayer.currentRoom;
  state.STATIC_SCENERY.forEach((entry) => {
    if (!entry.object3d) return;
    if (entry.kind === 'room') {
      entry.object3d.visible = currentRoom === entry.roomId;
      return;
    }

    if (!state.camera) return;
    const distanceSq = state.camera.position.distanceToSquared(entry.object3d.position);
    entry.object3d.visible = distanceSq <= entry.distanceSquared;
  });
}

// --- Shared Scenery Materials/Geometries ---
export function initSceneryAssets() {
  if (state.sharedScenery.ready) return;

  // Trees (35)
  state.sharedScenery.treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  state.sharedScenery.treeFoliageMat = new THREE.MeshStandardMaterial({ color: '#1e3f20', roughness: 0.8, flatShading: true });
  state.sharedScenery.treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 5);
  state.sharedScenery.treeCone1Geo = new THREE.ConeGeometry(2.2, 2.5, 5);
  state.sharedScenery.treeCone2Geo = new THREE.ConeGeometry(1.7, 2, 5);

  // Boulders (15)
  state.sharedScenery.boulderMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true });

  // Flowers (40)
  state.sharedScenery.flowerStemMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.9 });
  state.sharedScenery.flowerStemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4);
  state.sharedScenery.flowerCenterGeo = new THREE.DodecahedronGeometry(0.12, 0);
  const flowerLeafGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
  flowerLeafGeo.rotateX(Math.PI / 4);
  state.sharedScenery.flowerLeafGeo = flowerLeafGeo;
  state.sharedScenery.flowerCenterMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true });
  state.sharedScenery.flowerPetalMats = ['#f43f5e', '#eab308', '#3b82f6', '#a855f7'].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })
  );

  // Grass tufts (60)
  state.sharedScenery.grassTuftMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9, flatShading: true });
  const grassBladeGeo = new THREE.ConeGeometry(0.05, 0.4, 3);
  grassBladeGeo.translate(0, 0.2, 0);
  state.sharedScenery.grassBladeGeo = grassBladeGeo;

  // Wall torches (16)
  state.sharedScenery.torchBracketGeo = new THREE.BoxGeometry(0.15, 0.4, 0.3);
  state.sharedScenery.torchMetalMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.8 });
  const torchStickGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.8, 6);
  torchStickGeo.rotateX(Math.PI / 8);
  state.sharedScenery.torchStickGeo = torchStickGeo;
  state.sharedScenery.torchWoodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });
  state.sharedScenery.torchFlameGeo = new THREE.ConeGeometry(0.15, 0.4, 5);
  state.sharedScenery.torchFlameMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
  state.sharedScenery.torchParticleGeo = new THREE.SphereGeometry(0.1, 4, 4);
  state.sharedScenery.torchParticleMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });

  state.sharedScenery.ready = true;
}

// --- Procedural Scene Object Creators ---
export function createBannerStand(x, z, rotationY, color) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.85 });
  const clothMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    roughness: 0.65
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.4, 6), poleMat);
  pole.position.y = 3.2;
  pole.castShadow = true;
  group.add(pole);

  const topper = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), poleMat);
  topper.position.y = 6.7;
  group.add(topper);

  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), clothMat);
  cloth.position.set(0.95, 4.7, 0);
  cloth.rotation.y = Math.PI / 2;
  group.add(cloth);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.12), poleMat);
  trim.position.set(0.05, 4.7, 0);
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

export function createGardenLantern(x, z, color = '#60a5fa') {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.9 });
  const housingMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.65 });
  const glowMat = new THREE.MeshBasicMaterial({ color });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.8, 6), poleMat);
  pole.position.y = 1.4;
  group.add(pole);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), housingMat);
  housing.position.y = 2.9;
  group.add(housing);

  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.46), glowMat);
  glow.position.y = 2.9;
  group.add(glow);

  const light = new THREE.PointLight(color, 0.7, 8, 2);
  light.position.y = 2.9;
  group.add(light);

  group.position.set(x, getTerrainHeight(x, z), z);
  registerStaticScenery(group, { kind: 'outdoor' });
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
  group.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.12, 10, 24),
    new THREE.MeshStandardMaterial({ color: layout.themeColor, emissive: layout.themeColor, emissiveIntensity: 0.16 })
  );
  ring.rotation.x = Math.PI / 2;
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
}

export function buildExteriorPlaza() {
  const plazaMat = new THREE.MeshStandardMaterial({
    color: WORLD_CONFIG.floorAccent,
    roughness: 0.78,
    metalness: 0.08
  });
  const pathMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.82
  });

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(18, 48), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.02, 49.5);
  plaza.receiveShadow = true;
  state.scene.add(plaza);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(12, 28), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.03, 54.5);
  path.receiveShadow = true;
  state.scene.add(path);

  createGardenLantern(-6.5, 48.5, '#38bdf8');
  createGardenLantern(6.5, 48.5, '#38bdf8');
  createGardenLantern(-8, 60, '#8b5cf6');
  createGardenLantern(8, 60, '#8b5cf6');

  createBannerStand(-10.5, 42.5, Math.PI * 0.08, '#38bdf8');
  createBannerStand(10.5, 42.5, -Math.PI * 0.08, '#8b5cf6');
}

export function buildRoomInteriorSet(room) {
  const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
  const group = new THREE.Group();
  group.position.set(room.x, 0, room.z);

  const rugRadius = Math.min(room.width, room.depth) * 0.35;
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(rugRadius, rugRadius, 0.03, 28),
    new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: layout.themeColor,
      emissiveIntensity: 0.06,
      roughness: 0.82
    })
  );
  rug.position.y = 0.03;
  group.add(rug);

  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.04, 3.8),
    new THREE.MeshStandardMaterial({
      color: layout.themeColor,
      emissive: layout.themeColor,
      emissiveIntensity: 0.2,
      roughness: 0.55
    })
  );
  const stripX = room.x < 0 ? room.width / 2 - 0.1 : -room.width / 2 + 0.1;
  strip.position.set(stripX, 0.04, 0);
  group.add(strip);

  const benchMat = new THREE.MeshStandardMaterial({ color: '#3f2a1e', roughness: 0.88 });
  const benchFrameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.78 });
  const benchWidth = room.width > 20 ? 4.0 : (room.width < 15 ? 2.2 : 3.0);
  
  // North bench
  const benchNorth = new THREE.Group();
  const seatNorth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.14, 0.7), benchMat);
  seatNorth.position.y = 0.62;
  benchNorth.add(seatNorth);
  
  const backNorth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.8, 0.12), benchMat);
  backNorth.position.set(0, 1.0, -0.28);
  benchNorth.add(backNorth);
  
  [-benchWidth / 2 + 0.25, benchWidth / 2 - 0.25].forEach((legX) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 4), benchFrameMat);
    leg.position.set(legX, 0.3, -0.1);
    benchNorth.add(leg);
  });
  benchNorth.position.set(0, 0, -room.depth / 2 + 1.2);
  group.add(benchNorth);

  // South bench
  const benchSouth = new THREE.Group();
  const seatSouth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.14, 0.7), benchMat);
  seatSouth.position.y = 0.62;
  benchSouth.add(seatSouth);
  
  const backSouth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.8, 0.12), benchMat);
  backSouth.position.set(0, 1.0, -0.28);
  benchSouth.add(backSouth);
  
  [-benchWidth / 2 + 0.25, benchWidth / 2 - 0.25].forEach((legX) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 4), benchFrameMat);
    leg.position.set(legX, 0.3, -0.1);
    benchSouth.add(leg);
  });
  benchSouth.position.set(0, 0, room.depth / 2 - 1.2);
  benchSouth.rotation.y = Math.PI;
  group.add(benchSouth);

  // Corner Plant
  const plant = new THREE.Group();
  const planter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.64, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72 })
  );
  planter.position.y = 0.35;
  plant.add(planter);

  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 1.2, 5),
      new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.8, flatShading: true })
    );
    leaf.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.12, 1 + Math.random() * 0.15, Math.sin((i / 4) * Math.PI * 2) * 0.12);
    leaf.rotation.z = (Math.random() - 0.5) * 0.35;
    leaf.rotation.x = (Math.random() - 0.5) * 0.35;
    plant.add(leaf);
  }
  
  const plantX = room.x < 0 ? room.width / 2 - 1.2 : -room.width / 2 + 1.2;
  plant.position.set(plantX, 0, -room.depth / 2 + 1.2);
  group.add(plant);

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({ color: layout.themeColor })
  );
  spark.position.set(0, 2.25, 0);
  group.add(spark);
  state.animatedScenery.push({
    object: spark,
    type: 'spark',
    seed: Math.random() * Math.PI * 2,
    speed: 1.8 + Math.random() * 0.4,
    amplitude: 0.22,
    baseY: spark.position.y
  });

  registerStaticScenery(group, { kind: 'room', roomId: room.id });
  state.scene.add(group);
}

// Low-Poly unique boulders
export function createBoulder() {
  initSceneryAssets();

  const radius = 1.0 + Math.random() * 1.8;
  const geo = new THREE.DodecahedronGeometry(radius, 0);

  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setX(i, positions.getX(i) + (Math.random() - 0.5) * 0.25);
    positions.setY(i, positions.getY(i) + (Math.random() - 0.5) * 0.25);
    positions.setZ(i, positions.getZ(i) + (Math.random() - 0.5) * 0.25);
  }
  geo.computeVertexNormals();

  const boulder = new THREE.Mesh(geo, state.sharedScenery.boulderMat);
  
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - 20);
    z = (Math.random() - 0.5) * (MAP_SIZE - 20);
  } while (Math.abs(x) < 32 && Math.abs(z) < 44);
  
  const groundY = getTerrainHeight(x, z);
  boulder.position.set(x, groundY + 0.15, z);
  boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  
  const scale = 0.85 + Math.random() * 0.45;
  boulder.scale.set(scale, scale, scale);
  registerStaticScenery(boulder, { kind: 'outdoor', distance: 68 });
  state.scene.add(boulder);
}

// --- Player Avatar Creation ---
export function createPlayerAvatar(avatarType, colorHex, username, isLocal = false, isNpc = false) {
  const avatarGroup = new THREE.Group();

  const shirtMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.8 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
  const brownMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.85 });
  const hatBandMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
  
  // 1. Torso
  const torsoGeo = new THREE.CylinderGeometry(0.35, 0.28, 1.0, 6);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  avatarGroup.add(torso);

  // 2. Head
  const headGeo = new THREE.SphereGeometry(0.28, 6, 6);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.8;
  head.castShadow = true;
  avatarGroup.add(head);

  // 3. Stylized Explorer Hat
  const hatGroup = new THREE.Group();
  
  const brimGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 8);
  const brim = new THREE.Mesh(brimGeo, brownMat);
  brim.position.y = 2.02;
  brim.castShadow = true;
  hatGroup.add(brim);

  const bandGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.08, 8);
  const band = new THREE.Mesh(bandGeo, hatBandMat);
  band.position.y = 2.1;
  band.castShadow = true;
  hatGroup.add(band);

  const crownGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 8);
  const crown = new THREE.Mesh(crownGeo, brownMat);
  crown.position.y = 2.25;
  crown.castShadow = true;
  hatGroup.add(crown);

  avatarGroup.add(hatGroup);

  // 4. Adventurer Backpack
  const packGeo = new THREE.BoxGeometry(0.42, 0.6, 0.22);
  const backpack = new THREE.Mesh(packGeo, brownMat);
  backpack.position.set(0, 1.1, -0.28);
  backpack.castShadow = true;
  avatarGroup.add(backpack);

  // 5. Arms
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 4);
  armGeo.translate(0, -0.35, 0);
  
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.48, 1.5, 0);
  leftArm.castShadow = true;
  avatarGroup.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.48, 1.5, 0);
  rightArm.castShadow = true;
  avatarGroup.add(rightArm);

  // 6. Legs
  const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 4);
  legGeo.translate(0, -0.3, 0);

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.2, 0.6, 0);
  leftLeg.castShadow = true;
  avatarGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.2, 0.6, 0);
  rightLeg.castShadow = true;
  avatarGroup.add(rightLeg);

  // 7. Feet / Shoes
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.1, 0.25);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.2, 0.05, 0.05);
  avatarGroup.add(leftShoe);
  
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.2, 0.05, 0.05);
  avatarGroup.add(rightShoe);

  // 8. Floating Name Tag
  let tagColor = '#38bdf8';
  if (isLocal) {
    tagColor = '#818cf8';
  } else if (isNpc) {
    tagColor = '#f59e0b';
  }
  const nameTag = createPlayerNameSprite(username, tagColor);
  nameTag.position.set(0, 2.7, 0);
  avatarGroup.add(nameTag);

  state.scene.add(avatarGroup);

  return {
    group: avatarGroup,
    leftLeg, rightLeg,
    leftArm, rightArm,
    nameTag
  };
}

// --- NPC Generation & Pathfinding ---
export function spawnNpcs() {
  const npcNames = [
    "Hans (Guide)",
    "Wise Old Man",
    "Bob the Bartender",
    "Aubury the Mage",
    "Giles the Banker",
    "Gnome Trainer"
  ];
  
  const npcColors = [
    "#10b981", // Emerald Green
    "#8b5cf6", // Violet Purple
    "#f59e0b", // Amber Orange
    "#ec4899", // Pink
    "#06b6d4", // Cyan Blue
    "#f43f5e"  // Rose Red
  ];

  const npcPositions = [
    { x: 0, z: 26 },    // Hans near the main southern entrance
    { x: -10, z: -10 }, // Wise Old Man in Room 1
    { x: -30, z: 10 },  // Bob the Bartender in Room 4
    { x: 10, z: 10 },   // Aubury in Room 6
    { x: 30, z: -10 },  // Giles in Room 3
    { x: -25, z: -25 }  // Gnome Trainer wandering outdoors northwest
  ];

  for (let i = 0; i < npcNames.length; i++) {
    const name = npcNames[i];
    const color = npcColors[i];
    const pos = npcPositions[i];
    const groundY = getTerrainHeight(pos.x, pos.z);

    const avatar = createPlayerAvatar(null, color, name, false, true);
    avatar.group.position.set(pos.x, groundY, pos.z);

    state.npcs.push({
      name: name,
      color: color,
      mesh: avatar.group,
      leftLeg: avatar.leftLeg,
      rightLeg: avatar.rightLeg,
      leftArm: avatar.leftArm,
      rightArm: avatar.rightArm,
      x: pos.x,
      y: groundY,
      z: pos.z,
      ry: 0,
      targetX: pos.x,
      targetZ: pos.z,
      isMoving: false,
      isGrounded: true,
      speed: 2.8,
      waitTimer: Math.random() * 4 + 2,
      state: "idle"
    });
  }
}

export function updateNpcs(dt) {
  state.npcs.forEach((npc) => {
    if (npc.state === "idle") {
      npc.waitTimer -= dt;
      if (npc.waitTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 12;
        
        let tx = npc.x + Math.cos(angle) * dist;
        let tz = npc.z + Math.sin(angle) * dist;

        const limit = MAP_SIZE / 2 - 4;
        tx = Math.max(-limit, Math.min(limit, tx));
        tz = Math.max(-limit, Math.min(limit, tz));

        npc.targetX = tx;
        npc.targetZ = tz;
        npc.state = "walk";
        npc.isMoving = true;
      }
    } else if (npc.state === "walk") {
      const dx = npc.targetX - npc.x;
      const dz = npc.targetZ - npc.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.2) {
        npc.state = "idle";
        npc.isMoving = false;
        npc.waitTimer = Math.random() * 4 + 2;
      } else {
        const moveStep = npc.speed * dt;
        const angle = Math.atan2(dz, dx);
        
        npc.x += Math.cos(angle) * moveStep;
        npc.z += Math.sin(angle) * moveStep;
        npc.ry = angle;

        npc.y = getTerrainHeight(npc.x, npc.z);
        npc.mesh.position.set(npc.x, npc.y, npc.z);
        npc.mesh.rotation.y = -npc.ry + Math.PI / 2; // Rotate towards direction

        // Animate legs
        const walkCycle = performance.now() * 0.008;
        if (npc.leftLeg && npc.rightLeg) {
          npc.leftLeg.rotation.x = Math.sin(walkCycle) * 0.58;
          npc.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.58;
        }
        if (npc.leftArm && npc.rightArm) {
          npc.leftArm.rotation.x = -Math.sin(walkCycle) * 0.45;
          npc.rightArm.rotation.x = Math.sin(walkCycle) * 0.45;
        }
      }
    }
  });
}
