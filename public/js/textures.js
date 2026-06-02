// Procedural Canvas Texture Generators for Metalyceum
// Pure utility functions — no imports from other project modules.
import * as THREE from 'three';

export function createGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, 0, 256, 256);
  
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
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark oak base
  ctx.fillStyle = '#3a2510';
  ctx.fillRect(0, 0, 512, 512);

  // Wood grain — per-line sine-wave brightness with noise
  for (let y = 0; y < 512; y++) {
    const grain = Math.sin(y * 0.12 + Math.sin(y * 0.03) * 2) * 18
                + Math.sin(y * 0.3) * 6
                + Math.sin(y * 0.7) * 3;
    const noise = (Math.random() - 0.5) * 8;
    const val = 60 + grain + noise;
    ctx.fillStyle = `rgb(${val + 8}, ${val - 5}, ${val - 20})`;
    ctx.fillRect(0, y, 512, 1);
  }

  // Vertical plank seams every 64px
  ctx.strokeStyle = '#1a0f05';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Subtle horizontal cross-seams (staggered like real flooring)
  for (let col = 0; col < 8; col++) {
    const x = col * 64;
    const offset = (col % 2) * 80;
    ctx.strokeStyle = '#1a0f05';
    ctx.lineWidth = 1.2;
    for (let y = offset; y <= 512 + 80; y += 160) {
      ctx.beginPath();
      ctx.moveTo(x, y % 512);
      ctx.lineTo(x + 64, y % 512);
      ctx.stroke();
    }
  }

  // Glossy highlights
  ctx.strokeStyle = 'rgba(160, 120, 80, 0.07)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 80, y + 2 + Math.random() * 8);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 3);
  texture.anisotropy = 4;
  return texture;
}

export function createDarkWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Deep dark oak base
  ctx.fillStyle = '#1e1005';
  ctx.fillRect(0, 0, 512, 512);

  // Wood grain — per-line sine-wave brightness with noise
  for (let y = 0; y < 512; y++) {
    const grain = Math.sin(y * 0.12 + Math.sin(y * 0.03) * 2) * 10
                + Math.sin(y * 0.3) * 3
                + Math.sin(y * 0.7) * 1.5;
    const noise = (Math.random() - 0.5) * 4;
    const val = 28 + grain + noise;
    ctx.fillStyle = `rgb(${val + 6}, ${val + 1}, ${val - 6})`;
    ctx.fillRect(0, y, 512, 1);
  }

  // Vertical plank seams every 64px
  ctx.strokeStyle = '#0a0401';
  ctx.lineWidth = 2.5;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Subtle horizontal cross-seams (staggered like real flooring)
  for (let col = 0; col < 8; col++) {
    const x = col * 64;
    const offset = (col % 2) * 80;
    ctx.strokeStyle = '#0a0401';
    ctx.lineWidth = 1.5;
    for (let y = offset; y <= 512 + 80; y += 160) {
      ctx.beginPath();
      ctx.moveTo(x, y % 512);
      ctx.lineTo(x + 64, y % 512);
      ctx.stroke();
    }
  }

  // Glossy highlights
  ctx.strokeStyle = 'rgba(120, 90, 60, 0.05)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 80, y + 2 + Math.random() * 8);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 3);
  texture.anisotropy = 4;
  return texture;
}

const _texCache = new Map();

export function createStoneTexture() {
  const cached = _texCache.get('stone');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(0, 0, 256, 256);
  
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 256; i += 64) {
    ctx.moveTo(i, 0); ctx.lineTo(i, 256);
    ctx.moveTo(0, i); ctx.lineTo(256, i);
  }
  ctx.stroke();
  
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
  _texCache.set('stone', texture);
  return texture;
}

export function createBrickTexture() {
  const cached = _texCache.get('brick');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#5c504a';
  ctx.fillRect(0, 0, 256, 256);
  
  ctx.strokeStyle = '#2d2724';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  for (let y = 0; y <= 256; y += 32) {
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
  }
  
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const offset = (row % 2) * 32;
    for (let x = offset; x <= 256 + 32; x += 64) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 32);
    }
  }
  ctx.stroke();
  
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
  _texCache.set('brick', texture);
  return texture;
}

export function createCarpetTexture() {
  const cached = _texCache.get('carpet');
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Deep crimson base
  ctx.fillStyle = '#701020';
  ctx.fillRect(0, 0, size, size);

  // Subtle pile shading — alternating micro-rows give a woven-fabric feel
  for (let y = 0; y < size; y += 2) {
    const alpha = 0.04 + (y % 4 === 0 ? 0.04 : 0);
    ctx.fillStyle = `rgba(220,100,80,${alpha})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Gold diamond lattice — classic ornate carpet motif
  const step = 32;
  ctx.strokeStyle = 'rgba(195,152,55,0.30)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let row = -1; row <= size / step + 1; row++) {
    for (let col = -1; col <= size / step + 1; col++) {
      const cx = col * step;
      const cy = row * step;
      ctx.moveTo(cx,              cy - step / 2);
      ctx.lineTo(cx + step / 2,  cy);
      ctx.lineTo(cx,              cy + step / 2);
      ctx.lineTo(cx - step / 2,  cy);
      ctx.closePath();
    }
  }
  ctx.stroke();

  // Small gold dot at each lattice vertex
  ctx.fillStyle = 'rgba(195,152,55,0.50)';
  for (let row = 0; row <= size / step; row++) {
    for (let col = 0; col <= size / step; col++) {
      ctx.beginPath();
      ctx.arc(col * step, row * step, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Narrow double-rule border (single tile)
  ctx.strokeStyle = 'rgba(195,152,55,0.55)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(5, 5, size - 10, size - 10);
  ctx.strokeStyle = 'rgba(195,152,55,0.30)';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, size - 20, size - 20);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  _texCache.set('carpet', texture);
  return texture;
}

export function createMarbleTileTexture() {
  const cached = _texCache.get('marble');
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Warm ivory base
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle marble veining — random wandering lines
  for (let v = 0; v < 10; v++) {
    ctx.beginPath();
    let cx = Math.random() * 512;
    let cy = Math.random() * 512;
    ctx.moveTo(cx, cy);
    for (let i = 0; i < 30; i++) {
      cx += (Math.random() - 0.5) * 80;
      cy += (Math.random() - 0.5) * 80;
      ctx.lineTo(Math.max(0, Math.min(512, cx)), Math.max(0, Math.min(512, cy)));
    }
    const g = 130 + Math.floor(Math.random() * 60);
    ctx.strokeStyle = `rgba(${g},${g - 8},${g - 18},0.12)`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.stroke();
  }

  // Large square tile grout lines (4×4 grid)
  ctx.strokeStyle = 'rgba(100,90,78,0.3)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i <= 512; i += 128) {
    ctx.moveTo(i, 0); ctx.lineTo(i, 512);
    ctx.moveTo(0, i); ctx.lineTo(512, i);
  }
  ctx.stroke();

  // Corner accent inlay on each tile (small diamond)
  ctx.strokeStyle = 'rgba(160,140,110,0.18)';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const ox = col * 128 + 64;
      const oy = row * 128 + 64;
      const r = 22;
      ctx.beginPath();
      ctx.moveTo(ox, oy - r);
      ctx.lineTo(ox + r, oy);
      ctx.lineTo(ox, oy + r);
      ctx.lineTo(ox - r, oy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  _texCache.set('marble', texture);
  return texture;
}

export function createCanadianFlagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // Red field (left and right thirds)
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 256, 128);
  // White square in the center
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(85, 0, 86, 128);
  // Red maple leaf — 11-point stylized leaf centered in the white square
  const cx = 128, cy = 64;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  // Maple leaf points (normalized to fit in roughly 40×40 box)
  const leafPts = [
    [0, -20], [4, -8], [16, -8], [6, 0], [12, 12],
    [0, 6], [-12, 12], [-6, 0], [-16, -8], [-4, -8], [0, -20]
  ];
  ctx.moveTo(cx + leafPts[0][0], cy + leafPts[0][1]);
  for (let i = 1; i < leafPts.length; i++) {
    ctx.lineTo(cx + leafPts[i][0], cy + leafPts[i][1]);
  }
  ctx.closePath();
  ctx.fill();
  // Stem
  ctx.fillRect(cx - 1, cy + 6, 2, 10);
  // Base
  ctx.fillRect(cx - 4, cy + 14, 8, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createSignBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 1024, 256);
  
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 1024 - 12, 256 - 12);
  
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 1024 - 36, 256 - 36);
  
  ctx.font = 'bold 88px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.shadowColor = '#0f172a';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('METALYCEUM', 512, 100);
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  ctx.font = 'italic 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Funded by Canada Council for the Arts', 512, 185);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
