// Procedural Canvas Texture Generators for Metalyceum
// Pure utility functions — no imports from other project modules.

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
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#6b4f3b';
  ctx.fillRect(0, 0, 256, 256);
  
  ctx.strokeStyle = '#3e2a1e';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  
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
  return texture;
}

export function createBrickTexture() {
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
  return texture;
}

export function createMarbleTileTexture() {
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
