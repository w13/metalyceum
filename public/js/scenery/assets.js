// Shared asset geometries and material pools
import { state } from '../state.js';
import { registerStaticScenery } from './visibility.js';
import { samplePosition } from './utils.js';

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

export function initSceneryAssets() {
  if (state.sharedScenery.ready) return;

  state.sharedScenery.treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  state.sharedScenery.treeFoliageMat = new THREE.MeshStandardMaterial({ color: '#1e3f20', roughness: 0.8, flatShading: true });
  state.sharedScenery.treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 5);
  state.sharedScenery.treeCone1Geo = new THREE.ConeGeometry(2.2, 2.5, 5);
  state.sharedScenery.treeCone2Geo = new THREE.ConeGeometry(1.7, 2, 5);

  state.sharedScenery.boulderMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true });

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

  state.sharedScenery.grassTuftMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9, flatShading: true });
  const grassBladeGeo = new THREE.ConeGeometry(0.05, 0.4, 3);
  grassBladeGeo.translate(0, 0.2, 0);
  state.sharedScenery.grassBladeGeo = grassBladeGeo;

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

  // ── Shared venue materials (used across building.js, venues.js) ─────────
  state.sharedScenery.screenMat = new THREE.MeshStandardMaterial({
    color: '#090d16', roughness: 0.2, emissive: '#020617', emissiveIntensity: 0.2
  });
  state.sharedScenery.bronzeMat = new THREE.MeshStandardMaterial({
    color: '#8a6a3d', roughness: 0.42, metalness: 0.5
  });
  state.sharedScenery.frameMat = new THREE.MeshStandardMaterial({
    color: '#1e293b', roughness: 0.5, metalness: 0.2
  });
  state.sharedScenery.limestoneMat = new THREE.MeshStandardMaterial({
    color: '#e7dfd2', roughness: 0.72
  });

  state.sharedScenery.ready = true;
}

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
  
  const { x, z, groundY } = samplePosition(20);
  boulder.position.set(x, groundY + 0.15, z);
  boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  
  const scale = 0.85 + Math.random() * 0.45;
  boulder.scale.set(scale, scale, scale);
  registerStaticScenery(boulder, { kind: 'outdoor', distance: 68 });
  state.scene.add(boulder);
}
