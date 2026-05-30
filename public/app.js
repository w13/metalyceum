// Metalyceum Client App

// --- Configuration Constants ---
const ROOM_WIDTH = 20;
const ROOM_DEPTH = 20;
const ROOM_HEIGHT = 5.5;
const MAP_SIZE = 150; // Size of the grassy area

// Bumpy terrain function - flat in the center building zone, rolling hills outdoors
function getTerrainHeight(x, z) {
  const distFromCenter = Math.sqrt(x * x + z * z);
  if (distFromCenter < 52) {
    return 0; // Flat safety zone for the building foundation
  }
  // Smoothly blend hills into flat ground near the building
  const blendFactor = Math.min((distFromCenter - 52) * 0.08, 1.0);
  const hills = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.2 + Math.cos(x * 0.05) * Math.sin(z * 0.05) * 1.5;
  return hills * blendFactor;
}

// Define the 8 rooms layout
const ROOMS = [
  { id: 0, name: "North Hall", x: -30, z: -10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 1, name: "East Studio", x: -10, z: -10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 2, name: "Open Workshop", x: 10, z: -10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 3, name: "Broadcast Room", x: 30, z: -10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 4, name: "South Lounge", x: -30, z: 10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 5, name: "Crit Room", x: -10, z: 10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 6, name: "Screening Room", x: 10, z: 10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 7, name: "Commons", x: 30, z: 10, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 }
];

// Room walls definitions for collision checking
// We will generate the walls mathematically based on the room layout.
const WALLS = [];

// --- Game State Variables ---
let scene, camera, renderer, controls;
let localPlayer = {
  mesh: null,
  body: null,
  leftLeg: null, rightLeg: null,
  leftArm: null, rightArm: null,
  username: "Guest",
  color: "#3b82f6",
  x: 0, y: 0, z: 25, // Start outside the building
  ry: 0,
  isMoving: false,
  velocity: new THREE.Vector3(),
  isGrounded: true,
  currentRoom: -1
};

const remotePlayers = new Map(); // id -> player object
const npcs = []; // Ambient NPCs
let socket = null;
let ytPlayer = null;
let boardYtPlayer = null; // YouTube player for classroom blackboard
let ytApiReady = false;
let activeRoomVideoId = "";
let roomStatusTimer = null;
let lastSentPosition = { x: 0, y: 0, z: 0, ry: 0, isMoving: false };

// Building fading assets
let ceilingMesh = null;
let ceilingMat = null;
const upperWalls = [];
let upperWallMat = null;
let signFrontMat = null;
let signSideMat = null;

// Input states
const keys = { w: false, a: false, s: false, d: false, space: false };
const cameraKeys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
let isJoined = false;

// 3D Clickable Objects
const clickableScreens = [];

// Torch list for flickering animation
const torches = [];

// --- Security helpers (defense-in-depth against XSS / CSS injection) ---
// All player-supplied values (usernames, chat, colors, video URLs) are rendered
// via textContent / validated attributes, never raw innerHTML interpolation.
function sanitizeColor(c, fallback = '#3b82f6') {
  return (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : fallback;
}

// Accept only a meet.google.com link; return a normalized https URL or null.
function safeMeetUrl(v) {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v.startsWith('http') ? v : 'https://' + v);
    if (u.hostname === 'meet.google.com' || u.hostname.endsWith('.meet.google.com')) {
      return `https://meet.google.com${u.pathname}`;
    }
  } catch (e) {}
  return null;
}

// Strictly parse a media input into a YouTube ID or a meet.google.com URL.
// Returns the normalized value, or null to reject.
function parseVideoInput(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : 'https://' + s);
    if (u.hostname === 'meet.google.com' || u.hostname.endsWith('.meet.google.com')) {
      return `https://meet.google.com${u.pathname}`;
    }
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      const id = u.searchParams.get('v');
      return id && YT_ID.test(id) ? id : null;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return YT_ID.test(id) ? id : null;
    }
  } catch (e) {}
  return null;
}

function deriveSourceType(sourceValue) {
  if (!sourceValue) return 'none';
  return sourceValue.includes('meet.google.com') ? 'meet' : 'youtube';
}

function applyRoomData(roomId, roomData = {}) {
  const room = ROOMS[roomId];
  if (!room) return;

  if (typeof roomData.name === 'string' && roomData.name.trim()) {
    room.name = roomData.name.trim();
  }

  const nextSourceValue = typeof roomData.sourceValue === 'string'
    ? roomData.sourceValue
    : typeof roomData.videoId === 'string'
      ? roomData.videoId
      : room.sourceValue;
  room.sourceValue = nextSourceValue || "";
  room.video = room.sourceValue;
  room.sourceType = roomData.sourceType || deriveSourceType(room.sourceValue);

  if (roomData.startTime === null) {
    room.startTime = null;
  } else if (typeof roomData.startTime === 'string') {
    room.startTime = roomData.startTime;
  }

  if (typeof roomData.durationMinutes === 'number' && Number.isFinite(roomData.durationMinutes)) {
    room.durationMinutes = Math.max(0, Math.round(roomData.durationMinutes));
  }

  if (typeof roomData.updatedAt === 'number' && Number.isFinite(roomData.updatedAt)) {
    room.updatedAt = roomData.updatedAt;
  }
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getRoomEventWindow(room) {
  if (!room.startTime) {
    return { startDate: null, endDate: null, durationMinutes: room.durationMinutes || 0 };
  }
  const startDate = new Date(room.startTime);
  if (Number.isNaN(startDate.getTime())) {
    return { startDate: null, endDate: null, durationMinutes: room.durationMinutes || 0 };
  }
  const durationMinutes = Math.max(0, room.durationMinutes || 0);
  const endDate = durationMinutes > 0
    ? new Date(startDate.getTime() + durationMinutes * 60 * 1000)
    : null;
  return { startDate, endDate, durationMinutes };
}

function getRoomEventStatus(room) {
  const sourceValue = room.sourceValue || "";
  const { startDate, endDate, durationMinutes } = getRoomEventWindow(room);
  const now = new Date();

  if (!sourceValue && !startDate) {
    return {
      tone: 'idle',
      label: 'Idle',
      detail: 'No event scheduled yet.'
    };
  }

  if (!startDate) {
    return {
      tone: sourceValue ? 'ready' : 'idle',
      label: sourceValue ? 'Open room' : 'Idle',
      detail: sourceValue ? 'Source is ready. Add a start time to schedule it.' : 'No event scheduled yet.'
    };
  }

  if (!sourceValue) {
    if (now < startDate) {
      return {
        tone: 'ready',
        label: 'Scheduled',
        detail: `Starts ${formatDateTime(startDate.toISOString())}. Add a source before it begins.`
      };
    }

    if (!endDate || durationMinutes === 0 || now <= endDate) {
      return {
        tone: 'ready',
        label: 'Awaiting source',
        detail: 'This room has started, but no YouTube Live or Google Meet source is attached yet.'
      };
    }

    return {
      tone: 'ended',
      label: 'Ended',
      detail: `Ended ${formatDateTime(endDate.toISOString())}`
    };
  }

  if (now < startDate) {
    return {
      tone: 'upcoming',
      label: 'Upcoming',
      detail: `Starts ${formatDateTime(startDate.toISOString())}`
    };
  }

  if (!endDate || durationMinutes === 0 || now <= endDate) {
    return {
      tone: 'live',
      label: 'Live now',
      detail: endDate ? `Ends ${formatDateTime(endDate.toISOString())}` : 'Live with no end time set.'
    };
  }

  return {
    tone: 'ended',
    label: 'Ended',
    detail: `Ended ${formatDateTime(endDate.toISOString())}`
  };
}

function getRoomPlaybackStartSeconds(room) {
  if (!room.startTime || room.sourceType !== 'youtube') return 0;
  const { startDate, durationMinutes } = getRoomEventWindow(room);
  if (!startDate) return 0;
  const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000);
  const clampedElapsed = Math.max(0, elapsed);
  if (durationMinutes > 0) {
    return Math.min(durationMinutes * 60, clampedElapsed);
  }
  return clampedElapsed;
}

function renderEventBoard() {
  const list = document.getElementById('event-board-list');
  const count = document.getElementById('event-board-count');
  if (!list || !count) return;

  list.innerHTML = '';
  let liveCount = 0;
  let upcomingCount = 0;

  const statusPriority = { live: 0, upcoming: 1, ready: 2, ended: 3, idle: 4 };
  const roomsForBoard = ROOMS
    .map((room) => ({
      room,
      status: getRoomEventStatus(room),
      startDate: getRoomEventWindow(room).startDate
    }))
    .sort((a, b) => {
      const toneDiff = statusPriority[a.status.tone] - statusPriority[b.status.tone];
      if (toneDiff !== 0) return toneDiff;

      const aStart = a.startDate ? a.startDate.getTime() : Number.POSITIVE_INFINITY;
      const bStart = b.startDate ? b.startDate.getTime() : Number.POSITIVE_INFINITY;
      if (aStart !== bStart) return aStart - bStart;

      return a.room.id - b.room.id;
    });

  roomsForBoard.forEach(({ room, status }) => {
    if (status.tone === 'live') liveCount += 1;
    if (status.tone === 'upcoming') upcomingCount += 1;

    const card = document.createElement('div');
    card.className = 'event-board-item';

    const topRow = document.createElement('div');
    topRow.className = 'event-board-item-top';

    const title = document.createElement('strong');
    title.textContent = room.name;

    const badge = document.createElement('span');
    badge.className = `event-status-badge ${status.tone}`;
    badge.textContent = status.label;

    topRow.append(title, badge);

    const meta = document.createElement('div');
    meta.className = 'event-board-item-meta';
    meta.textContent = room.sourceType === 'meet'
      ? 'Google Meet'
      : room.sourceType === 'youtube'
        ? 'YouTube Live'
        : 'No source set';

    const detail = document.createElement('div');
    detail.className = 'event-board-item-detail';
    detail.textContent = status.detail;

    card.append(topRow, meta, detail);
    list.appendChild(card);
  });

  count.textContent = `${liveCount} live · ${upcomingCount} upcoming`;
}

function updateRoomPanelDetails() {
  const room = ROOMS[localPlayer.currentRoom];
  if (!room) return;

  const status = getRoomEventStatus(room);
  const { startDate, endDate, durationMinutes } = getRoomEventWindow(room);
  const locationTag = document.getElementById('hud-location');
  if (locationTag) {
    locationTag.innerText = `In Room: ${room.name}`;
  }

  document.getElementById('room-title').innerText = room.name;
  document.getElementById('room-source-type').innerText = room.sourceType === 'meet'
    ? 'Google Meet'
    : room.sourceType === 'youtube'
      ? 'YouTube Live'
      : 'Not set';
  document.getElementById('room-status-badge').innerText = status.label;
  document.getElementById('room-status-badge').className = `event-status-badge ${status.tone}`;
  document.getElementById('room-status-text').innerText = status.detail;
  document.getElementById('room-start-time').innerText = startDate ? formatDateTime(startDate.toISOString()) : 'Not scheduled';
  document.getElementById('room-end-time').innerText = endDate ? formatDateTime(endDate.toISOString()) : '—';
  document.getElementById('room-duration').innerText = durationMinutes > 0 ? `${durationMinutes} min` : 'Open-ended';
  document.getElementById('room-source-value').innerText = room.sourceValue || 'No YouTube Live or Meet link set';
}

// Build a Google Meet info card with DOM APIs (no innerHTML interpolation).
function populateMeetCard(el, videoId, isBoard) {
  el.innerHTML = ''; // static clear only
  const icon = document.createElement('span');
  icon.style.cssText = `font-size: ${isBoard ? 28 : 32}px; margin-bottom: ${isBoard ? 6 : 8}px;`;
  icon.textContent = '🌐';
  const title = document.createElement('div');
  title.style.cssText = "font-weight:600;font-size:14px;margin-bottom:4px;font-family:'Plus Jakarta Sans',sans-serif;";
  title.textContent = 'Google Meet Active';
  const sub = document.createElement('div');
  sub.style.cssText = "font-size:11px;color:#94a3b8;margin-bottom:12px;font-family:'Plus Jakarta Sans',sans-serif;";
  sub.textContent = isBoard ? 'Classroom is currently in a live meeting.' : 'This room has a live video call.';
  const a = document.createElement('a');
  a.style.cssText = "background:#2563eb;color:#fff;padding:6px 12px;border-radius:4px;font-size:11px;text-decoration:none;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;pointer-events:auto;";
  const url = safeMeetUrl(videoId);
  if (url) a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'Join Meeting';
  el.append(icon, title, sub, a);
}

// --- Procedural Texture Generators ---
function createGrassTexture() {
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

function createWoodTexture() {
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

function createStoneTexture() {
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

function createBrickTexture() {
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

function createSignBoardTexture() {
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

// --- Dynamic Text Sprites for Player Names ---
function createPlayerNameSprite(name, color = '#ffffff') {
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

// --- Initial Scene Setup ---
function initEngine() {
  const container = document.getElementById('game-container');
  
  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#080b11');
  scene.fog = new THREE.FogExp2('#080b11', 0.015);
  
  // 2. Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  
  // 4. Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 35;
  controls.maxPolarAngle = Math.PI / 2.1; // Don't clip below ground
  
  // 5. Lights
  const ambientLight = new THREE.AmbientLight('#ffffff', 0.45);
  scene.add(ambientLight);
  
  const sunLight = new THREE.DirectionalLight('#e0f2fe', 0.7);
  sunLight.position.set(40, 60, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 150;
  
  const d = 60;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  
  // Build the static map elements
  buildMap();
  
  // Spawn NPC ambient characters
  spawnNpcs();
  
  // Event listeners
  window.addEventListener('resize', onWindowResize);
  document.getElementById('loading-screen').classList.remove('active');
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Environment & Building Construction ---
function buildMap() {
  // 1. Grassy Ground Plane with rolling hills (60x60 grid segments for deformation)
  const grassTex = createGrassTexture();
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 60, 60);
  
  // Deform ground vertices to match getTerrainHeight
  const positions = groundGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const vx = positions.getX(i);
    const vy = positions.getY(i);
    // Plane is rotated -PI/2, so Plane Y maps to 3D Z
    const height = getTerrainHeight(vx, -vy);
    positions.setZ(i, height);
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // 2. Fences / Map Boundary following terrain height
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#372d20', roughness: 0.9 });
  const fenceGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3);
  const railGeo = new THREE.BoxGeometry(0.15, 0.2, 5.2);
  
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    const isHorizontal = angle === 0 || angle === Math.PI;
    const limit = MAP_SIZE / 2 - 1.5;
    
    for (let offset = -limit; offset <= limit; offset += 5) {
      const x = isHorizontal ? (angle === 0 ? limit : -limit) : offset;
      const z = isHorizontal ? offset : (angle === Math.PI / 2 ? limit : -limit);
      const groundY = getTerrainHeight(x, z);

      // Posts
      const post = new THREE.Mesh(fenceGeo, fenceMat);
      post.position.set(x, groundY + 0.6, z);
      post.castShadow = false;
      scene.add(post);
      
      // Rails (connect to next post)
      if (offset < limit) {
        const railX = isHorizontal ? x : offset + 2.5;
        const railZ = isHorizontal ? offset + 2.5 : z;
        const railY = getTerrainHeight(railX, railZ);

        const railUpper = new THREE.Mesh(railGeo, fenceMat);
        const railLower = new THREE.Mesh(railGeo, fenceMat);
        
        railUpper.position.set(railX, railY + 0.9, railZ);
        railLower.position.set(railX, railY + 0.4, railZ);
        
        if (isHorizontal) {
          railUpper.rotation.y = Math.PI / 2;
          railLower.rotation.y = Math.PI / 2;
        }
        
        railUpper.castShadow = false;
        railLower.castShadow = false;
        scene.add(railUpper);
        scene.add(railLower);
      }
    }
  }

  // 3. Low-Poly Trees sitting on hills
  for (let i = 0; i < 35; i++) {
    createTree();
  }

  // 4. Low-Poly Grey Boulders scattered around
  for (let i = 0; i < 15; i++) {
    createBoulder();
  }

  // 4b. Low-Poly Flowers scattered on hills
  for (let i = 0; i < 40; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * (MAP_SIZE - 20);
      z = (Math.random() - 0.5) * (MAP_SIZE - 20);
    } while (Math.abs(x) < 45 && Math.abs(z) < 25);
    createFlower(x, z);
  }

  // 4c. Low-Poly Grass Tufts scattered on hills
  for (let i = 0; i < 60; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * (MAP_SIZE - 20);
      z = (Math.random() - 0.5) * (MAP_SIZE - 20);
    } while (Math.abs(x) < 45 && Math.abs(z) < 25);
    createGrassTuft(x, z);
  }

  // 5. The Metalyceum Building (4x2 rooms grid)
  buildBuilding();
}

function createTree() {
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: '#1e3f20', roughness: 0.8, flatShading: true });
  
  const tree = new THREE.Group();
  
  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 5);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  tree.add(trunk);
  
  // Foliage (layers of cones)
  const coneGeo1 = new THREE.ConeGeometry(2.2, 2.5, 5);
  const cone1 = new THREE.Mesh(coneGeo1, foliageMat);
  cone1.position.y = 4.2;
  cone1.castShadow = true;
  tree.add(cone1);
  
  const coneGeo2 = new THREE.ConeGeometry(1.7, 2, 5);
  const cone2 = new THREE.Mesh(coneGeo2, foliageMat);
  cone2.position.y = 5.6;
  cone2.castShadow = true;
  tree.add(cone2);
  
  // Scatter outside the building zone
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - 15);
    z = (Math.random() - 0.5) * (MAP_SIZE - 15);
  } while (Math.abs(x) < 45 && Math.abs(z) < 25);
  
  const groundY = getTerrainHeight(x, z);
  tree.position.set(x, groundY, z);
  
  const scale = 0.85 + Math.random() * 0.45;
  tree.scale.set(scale, scale, scale);
  scene.add(tree);
}

function createBoulder() {
  const boulderMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true });
  
  // Create randomized low-poly rock geometry
  const radius = 1.0 + Math.random() * 1.8;
  const geo = new THREE.DodecahedronGeometry(radius, 0);
  
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setX(i, positions.getX(i) + (Math.random() - 0.5) * 0.25);
    positions.setY(i, positions.getY(i) + (Math.random() - 0.5) * 0.25);
    positions.setZ(i, positions.getZ(i) + (Math.random() - 0.5) * 0.25);
  }
  geo.computeVertexNormals();

  const boulder = new THREE.Mesh(geo, boulderMat);
  
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - 20);
    z = (Math.random() - 0.5) * (MAP_SIZE - 20);
  } while (Math.abs(x) < 46 && Math.abs(z) < 26); // Avoid building area

  const groundY = getTerrainHeight(x, z) - 0.3; // Bury slightly
  boulder.position.set(x, groundY, z);
  boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  boulder.castShadow = true;
  boulder.receiveShadow = true;
  scene.add(boulder);
}

function createFlower(x, z) {
  const flowerColors = ['#f43f5e', '#eab308', '#3b82f6', '#a855f7'];
  const randomColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
  
  const stemMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.9 });
  const petalMat = new THREE.MeshStandardMaterial({ color: randomColor, roughness: 0.8, flatShading: true });
  
  const flower = new THREE.Group();
  
  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4);
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.25;
  flower.add(stem);
  
  // Center/Petals
  const centerGeo = new THREE.DodecahedronGeometry(0.12, 0);
  const center = new THREE.Mesh(centerGeo, petalMat);
  center.position.y = 0.5;
  flower.add(center);
  
  // Small leaves
  const leafGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
  leafGeo.rotateX(Math.PI / 4);
  const leaf1 = new THREE.Mesh(leafGeo, stemMat);
  leaf1.position.set(0, 0.15, 0.08);
  flower.add(leaf1);
  
  const groundY = getTerrainHeight(x, z);
  flower.position.set(x, groundY, z);
  
  const scale = 0.8 + Math.random() * 0.4;
  flower.scale.set(scale, scale, scale);
  scene.add(flower);
}

function createGrassTuft(x, z) {
  const grassMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9, flatShading: true });
  const tuft = new THREE.Group();
  
  const bladeGeo = new THREE.ConeGeometry(0.05, 0.4, 3);
  bladeGeo.translate(0, 0.2, 0);
  
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeo, grassMat);
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    blade.rotation.x = (Math.random() - 0.5) * 0.4;
    blade.rotation.y = Math.random() * Math.PI * 2;
    blade.scale.set(1, 0.8 + Math.random() * 0.4, 1);
    tuft.add(blade);
  }
  
  const groundY = getTerrainHeight(x, z);
  tuft.position.set(x, groundY, z);
  scene.add(tuft);
}

function createDoorFrame(cx, cz, dir, width) {
  const frameMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 }); // Dark timber
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.95 }); // Even darker trim
  
  const postHeight = 3.0;
  const postWidth = 0.45;
  const postDepth = 0.65;
  
  const group = new THREE.Group();
  
  if (dir === 'H') {
    // Wall is horizontal (runs along X), doorway is a gap in X.
    // Post 1 (Left)
    const post1Geo = new THREE.BoxGeometry(postWidth, postHeight, postDepth);
    const post1 = new THREE.Mesh(post1Geo, frameMat);
    post1.position.set(-width/2, postHeight/2, 0);
    post1.castShadow = true;
    post1.receiveShadow = true;
    group.add(post1);
    
    // Post 2 (Right)
    const post2Geo = new THREE.BoxGeometry(postWidth, postHeight, postDepth);
    const post2 = new THREE.Mesh(post2Geo, frameMat);
    post2.position.set(width/2, postHeight/2, 0);
    post2.castShadow = true;
    post2.receiveShadow = true;
    group.add(post2);
    
    // Lintel (Top header)
    const lintelLen = width + postWidth;
    const lintelHeight = 0.45;
    const lintelGeo = new THREE.BoxGeometry(lintelLen, lintelHeight, postDepth + 0.05);
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, postHeight + lintelHeight/2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);
    
    // Diagonal corner braces
    const braceGeo = new THREE.BoxGeometry(0.2, 0.8, postDepth - 0.05);
    braceGeo.rotateZ(Math.PI / 4); // 45 degrees
    
    const braceLeft = new THREE.Mesh(braceGeo, trimMat);
    braceLeft.position.set(-width/2 + 0.4, postHeight - 0.35, 0);
    braceLeft.castShadow = true;
    group.add(braceLeft);
    
    const braceRight = new THREE.Mesh(braceGeo, trimMat);
    braceRight.position.set(width/2 - 0.4, postHeight - 0.35, 0);
    braceRight.castShadow = true;
    group.add(braceRight);
    
  } else {
    // Wall is vertical (runs along Z), doorway is a gap in Z.
    // Post 1 (Left/North)
    const post1Geo = new THREE.BoxGeometry(postDepth, postHeight, postWidth);
    const post1 = new THREE.Mesh(post1Geo, frameMat);
    post1.position.set(0, postHeight/2, -width/2);
    post1.castShadow = true;
    post1.receiveShadow = true;
    group.add(post1);
    
    // Post 2 (Right/South)
    const post2Geo = new THREE.BoxGeometry(postDepth, postHeight, postWidth);
    const post2 = new THREE.Mesh(post2Geo, frameMat);
    post2.position.set(0, postHeight/2, width/2);
    post2.castShadow = true;
    post2.receiveShadow = true;
    group.add(post2);
    
    // Lintel (Top header)
    const lintelLen = width + postWidth;
    const lintelHeight = 0.45;
    const lintelGeo = new THREE.BoxGeometry(postDepth + 0.05, lintelHeight, lintelLen);
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, postHeight + lintelHeight/2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);
    
    // Diagonal corner braces
    const braceGeo = new THREE.BoxGeometry(postDepth - 0.05, 0.8, 0.2);
    braceGeo.rotateX(Math.PI / 4);
    
    const braceNorth = new THREE.Mesh(braceGeo, trimMat);
    braceNorth.position.set(0, postHeight - 0.35, -width/2 + 0.4);
    braceNorth.castShadow = true;
    group.add(braceNorth);
    
    const braceSouth = new THREE.Mesh(braceGeo, trimMat);
    braceSouth.position.set(0, postHeight - 0.35, width/2 - 0.4);
    braceSouth.castShadow = true;
    group.add(braceSouth);
  }
  
  group.position.set(cx, 0, cz);
  scene.add(group);
}

function updateClassroomBoard() {
  const container = document.getElementById('embedded-board-container');
  if (!container) return;
  
  if (localPlayer.currentRoom !== 6) {
    container.style.display = 'none';
    if (boardYtPlayer && boardYtPlayer.pauseVideo) {
      try { boardYtPlayer.pauseVideo(); } catch(e) {}
    }
    return;
  }
  
  // We are in Room 6. Project classroom blackboard mesh (10, 3.5, 19.8) to screen space
  const screenPos = new THREE.Vector3(10, 3.5, 19.7);
  screenPos.project(camera);
  
  // Check if it's in front of camera
  const inFrustum = screenPos.x >= -1 && screenPos.x <= 1 &&
                    screenPos.y >= -1 && screenPos.y <= 1 &&
                    screenPos.z >= -1 && screenPos.z <= 1;
                    
  if (!inFrustum || screenPos.z > 1) {
    container.style.display = 'none';
    return;
  }
  
  // Project screen corners to calculate size
  const tl = new THREE.Vector3(10 + 3.3, 3.5 + 1.8, 19.7);
  const br = new THREE.Vector3(10 - 3.3, 3.5 - 1.8, 19.7);
  
  tl.project(camera);
  br.project(camera);
  
  const tlx = (tl.x * 0.5 + 0.5) * window.innerWidth;
  const tly = (-tl.y * 0.5 + 0.5) * window.innerHeight;
  
  const brx = (br.x * 0.5 + 0.5) * window.innerWidth;
  const bry = (-br.y * 0.5 + 0.5) * window.innerHeight;
  
  const width = Math.abs(tlx - brx);
  const height = Math.abs(tly - bry);
  
  container.style.left = `${Math.min(tlx, brx)}px`;
  container.style.top = `${Math.min(tly, bry)}px`;
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.display = 'block';
  
  if (boardYtPlayer && boardYtPlayer.playVideo && ROOMS[6].sourceValue && ROOMS[6].sourceType === 'youtube') {
    try {
      boardYtPlayer.playVideo();
    } catch(e) {}
  }
}

function buildClassroomAssets() {
  const woodMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.85 }); // Dark oak wood
  const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 }); // Slate legs
  
  const classroomGroup = new THREE.Group();
  
  // Helper to create a desk
  function createDesk(dx, dz) {
    const desk = new THREE.Group();
    // Top
    const topGeo = new THREE.BoxGeometry(3.5, 0.1, 1.2);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 1.0;
    top.castShadow = true;
    top.receiveShadow = true;
    desk.add(top);
    
    // Legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 4);
    const legOffsets = [
      { x: -1.6, z: -0.5 },
      { x: 1.6, z: -0.5 },
      { x: -1.6, z: 0.5 },
      { x: 1.6, z: 0.5 }
    ];
    legOffsets.forEach(offset => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offset.x, 0.5, offset.z);
      leg.castShadow = true;
      desk.add(leg);
    });
    
    desk.position.set(dx, 0, dz);
    classroomGroup.add(desk);
  }
  
  // Helper to create a bench
  function createBench(bx, bz) {
    const bench = new THREE.Group();
    // Seat
    const seatGeo = new THREE.BoxGeometry(3.0, 0.08, 0.5);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.6;
    seat.castShadow = true;
    seat.receiveShadow = true;
    bench.add(seat);
    
    // Legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 4);
    const legOffsets = [
      { x: -1.4, z: -0.2 },
      { x: 1.4, z: -0.2 },
      { x: -1.4, z: 0.2 },
      { x: 1.4, z: 0.2 }
    ];
    legOffsets.forEach(offset => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offset.x, 0.3, offset.z);
      leg.castShadow = true;
      bench.add(leg);
    });
    
    bench.position.set(bx, 0, bz);
    classroomGroup.add(bench);
  }
  
  // Place 3 rows of desks and benches relative to Room 6 center (10, 10)
  // Local coordinates range from -10 to 10.
  const rows = [
    { dz: -6 },
    { dz: -2 },
    { dz: 2 }
  ];
  
  rows.forEach(row => {
    // Left Desk & Bench
    createDesk(5 - 10, row.dz);
    createBench(5 - 10, row.dz - 1.0);
    
    // Right Desk & Bench
    createDesk(15 - 10, row.dz);
    createBench(15 - 10, row.dz - 1.0);
  });
  
  // Speaker/Teacher's Podium
  const podiumGroup = new THREE.Group();
  const podiumGeo = new THREE.BoxGeometry(2.2, 1.2, 1.2);
  const podium = new THREE.Mesh(podiumGeo, woodMat);
  podium.position.y = 0.6;
  podium.castShadow = true;
  podium.receiveShadow = true;
  podiumGroup.add(podium);
  
  // Lectern top
  const topGeo = new THREE.BoxGeometry(1.0, 0.1, 0.8);
  topGeo.rotateX(-Math.PI / 8); // Slanted book rest
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.set(0, 1.25, 0.1);
  podiumGroup.add(top);
  
  podiumGroup.position.set(0, 0, 7.5);
  classroomGroup.add(podiumGroup);
  
  classroomGroup.position.set(10, 0, 10);
  scene.add(classroomGroup);
}

function buildBuilding() {
  const stoneTex = createStoneTexture();
  const brickTex = createBrickTexture();
  const woodTex = createWoodTexture();
  
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  upperWallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85, transparent: true, opacity: 1.0 });
  
  const woodFloorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75 });
  const stoneFloorMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.2, emissive: '#020617', emissiveIntensity: 0.2 });
  
  // Total dimensions: X is 80m, Z is 40m
  const startX = -40;
  const startZ = -20;
  const endX = 40;
  const endZ = 20;

  // 1. FLOOR PLACEMENT (Alternating Wood and Stone rooms in a checkerboard pattern)
  const roomFloorGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
  ROOMS.forEach((room) => {
    const isWood = (Math.round((room.x + 30) / 20) + Math.round((room.z + 10) / 20)) % 2 === 0;
    const mat = isWood ? woodFloorMat : stoneFloorMat;
    const roomFloor = new THREE.Mesh(roomFloorGeo, mat);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(room.x, 0.01, room.z);
    roomFloor.receiveShadow = true;
    scene.add(roomFloor);
  });

  // Helper function to create wall meshes and register collision bounding boxes
  function addWallSegment(xStart, zStart, xEnd, zEnd, height = ROOM_HEIGHT) {
    const dx = xEnd - xStart;
    const dz = zEnd - zStart;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);
    
    const thickness = 0.5;
    
    // Split wall into lower (opaque) and upper (fading) parts
    const lowerHeight = 3.5;
    const upperHeight = height - lowerHeight; // 2.0
    
    // Lower wall segment
    const lowerGeo = new THREE.BoxGeometry(len, lowerHeight, thickness);
    const lowerWall = new THREE.Mesh(lowerGeo, wallMat);
    lowerWall.position.set((xStart + xEnd) / 2, lowerHeight / 2, (zStart + zEnd) / 2);
    lowerWall.rotation.y = -angle;
    lowerWall.castShadow = true;
    lowerWall.receiveShadow = true;
    scene.add(lowerWall);
    
    // Upper wall segment (fades out indoors)
    if (upperHeight > 0.05) {
      const upperGeo = new THREE.BoxGeometry(len, upperHeight, thickness);
      const upperWall = new THREE.Mesh(upperGeo, upperWallMat);
      upperWall.position.set((xStart + xEnd) / 2, lowerHeight + upperHeight / 2, (zStart + zEnd) / 2);
      upperWall.rotation.y = -angle;
      upperWall.castShadow = true;
      upperWall.receiveShadow = true;
      scene.add(upperWall);
      upperWalls.push(upperWall);
    }
    
    // Add baseboard/skirting board trims on both sides of the lower wall
    const baseboardHeight = 0.35;
    const baseboardThickness = 0.08;
    const baseboardGeo = new THREE.BoxGeometry(len, baseboardHeight, baseboardThickness);
    const baseboardMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9 }); // Dark timber
    
    const baseboard1 = new THREE.Mesh(baseboardGeo, baseboardMat);
    baseboard1.position.set(0, -lowerHeight / 2 + baseboardHeight / 2, thickness / 2 + baseboardThickness / 2);
    baseboard1.castShadow = true;
    baseboard1.receiveShadow = true;
    lowerWall.add(baseboard1);
    
    const baseboard2 = new THREE.Mesh(baseboardGeo, baseboardMat);
    baseboard2.position.set(0, -lowerHeight / 2 + baseboardHeight / 2, -thickness / 2 - baseboardThickness / 2);
    baseboard2.castShadow = true;
    baseboard2.receiveShadow = true;
    lowerWall.add(baseboard2);

    // Register wall bounding box for collision checking
    const pad = 0.35;
    WALLS.push({
      minX: Math.min(xStart, xEnd) - (dz === 0 ? 0 : pad) - (dx === 0 ? thickness/2 + pad : 0),
      maxX: Math.max(xStart, xEnd) + (dz === 0 ? 0 : pad) + (dx === 0 ? thickness/2 + pad : 0),
      minZ: Math.min(zStart, zEnd) - (dx === 0 ? 0 : pad) - (dz === 0 ? thickness/2 + pad : 0),
      maxZ: Math.max(zStart, zEnd) + (dx === 0 ? 0 : pad) + (dz === 0 ? thickness/2 + pad : 0),
    });
  }

  // 2. EXTERIOR WALLS (80m x 40m Building bounds)
  // Outer North Wall
  addWallSegment(-40, -20, -3, -20);
  addWallSegment(3, -20, 40, -20);
  
  // Outer South Wall
  addWallSegment(-40, 20, -3, 20);
  addWallSegment(3, 20, 40, 20);
  
  // Outer East & West Walls
  addWallSegment(-40, -20, -40, 20);
  addWallSegment(40, -20, 40, 20);

  // 3. INTERIOR DIVISION WALLS
  for (let x = -40; x < 40; x += 20) {
    addWallSegment(x, 0, x + 8.5, 0);
    addWallSegment(x + 11.5, 0, x + 20, 0);
  }

  // Vertical dividing walls
  const vertPositions = [-20, 0, 20];
  for (const vx of vertPositions) {
    addWallSegment(vx, -20, vx, -11.5);
    addWallSegment(vx, -8.5, vx, 0);
    
    addWallSegment(vx, 0, vx, 8.5);
    addWallSegment(vx, 11.5, vx, 20);
  }

  // 3b. DOOR FRAMES AND LINTELS
  createDoorFrame(0, 20, 'H', 6);
  createDoorFrame(0, -20, 'H', 6);
  
  createDoorFrame(-30, 0, 'H', 3);
  createDoorFrame(-10, 0, 'H', 3);
  createDoorFrame(10, 0, 'H', 3);
  createDoorFrame(30, 0, 'H', 3);
  
  const doorVertPositions = [-20, 0, 20];
  for (const vx of doorVertPositions) {
    createDoorFrame(vx, -10, 'V', 3);
    createDoorFrame(vx, 10, 'V', 3);
  }

  // 4. PILLARS & CORNER DECORATIONS
  const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, ROOM_HEIGHT, 8);
  for (let x = -40; x <= 40; x += 20) {
    for (let z = -20; z <= 20; z += 20) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, ROOM_HEIGHT / 2, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);
    }
  }

  // 5. EMBEDDED SCREENS & WALL MOUNTED TORCHES IN ROOMS
  ROOMS.forEach((room) => {
    const screenGroup = new THREE.Group();
    
    const outerGeo = new THREE.BoxGeometry(7, 4, 0.2);
    const outerFrame = new THREE.Mesh(outerGeo, frameMat);
    outerFrame.castShadow = true;
    screenGroup.add(outerFrame);
    
    const innerGeo = new THREE.BoxGeometry(6.6, 3.6, 0.05);
    const innerScreen = new THREE.Mesh(innerGeo, screenMat);
    innerScreen.position.z = 0.1;
    innerScreen.userData = { roomId: room.id };
    clickableScreens.push(innerScreen);
    screenGroup.add(innerScreen);

    const borderMat = new THREE.MeshBasicMaterial({ color: '#3b82f6', wireframe: true });
    const screenBorder = new THREE.Mesh(innerGeo, borderMat);
    screenBorder.position.z = 0.11;
    screenBorder.scale.set(1.02, 1.02, 1.02);
    screenGroup.add(screenBorder);
    
    if (room.z < 0) {
      screenGroup.position.set(room.x, 3.5, -19.8);
      screenGroup.rotation.y = 0;
    } else {
      screenGroup.position.set(room.x, 3.5, 19.8);
      screenGroup.rotation.y = Math.PI;
    }
    
    scene.add(screenGroup);

    createWallTorch(room.x - 6, 2.5, room.z < 0 ? -19.7 : 19.7, room.z < 0 ? 0 : Math.PI);
    createWallTorch(room.x + 6, 2.5, room.z < 0 ? -19.7 : 19.7, room.z < 0 ? 0 : Math.PI);
  });

  // 6. CEILING / ROOF PLACEMENT (Fades out when player is indoors)
  ceilingMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9, transparent: true, opacity: 1.0 });
  const ceilingGeo = new THREE.BoxGeometry(80, 0.2, 40);
  ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceilingMesh.position.set(0, ROOM_HEIGHT + 0.1, 0);
  ceilingMesh.castShadow = true;
  ceilingMesh.receiveShadow = true;
  scene.add(ceilingMesh);

  // 7. CLASSROOM ASSETS (Benches and desks in Room 6)
  buildClassroomAssets();

  // 8. EXTERIOR SIGN BOARD (Metalyceum & Canada Council)
  const signTex = createSignBoardTexture();
  signFrontMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, transparent: true, opacity: 1.0 });
  signSideMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8, transparent: true, opacity: 1.0 });
  
  const signMaterials = [signSideMat, signSideMat, signSideMat, signSideMat, signFrontMat, signSideMat];
  const signGeo = new THREE.BoxGeometry(10.5, 1.4, 0.1);
  const signMesh = new THREE.Mesh(signGeo, signMaterials);
  
  // Position right above entrance on the South upper wall (Z: 20)
  signMesh.position.set(0, 4.4, 20.3);
  signMesh.castShadow = true;
  signMesh.receiveShadow = true;
  scene.add(signMesh);
  upperWalls.push(signMesh); // Toggle visibility in sync with upper walls
}

function createWallTorch(x, y, z, rotationY) {
  const torchGroup = new THREE.Group();
  
  // Bracket
  const bracketGeo = new THREE.BoxGeometry(0.15, 0.4, 0.3);
  const metalMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.8 });
  const bracket = new THREE.Mesh(bracketGeo, metalMat);
  bracket.position.set(0, 0, -0.15);
  torchGroup.add(bracket);

  // Wooden stick
  const stickGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.8, 6);
  stickGeo.rotateX(Math.PI / 8); // Angled outwards
  const woodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });
  const stick = new THREE.Mesh(stickGeo, woodMat);
  stick.position.set(0, 0.1, -0.05);
  torchGroup.add(stick);

  // Flame glow shape
  const flameGeo = new THREE.ConeGeometry(0.15, 0.4, 5);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0, 0.55, 0.1);
  torchGroup.add(flame);

  // Particle representation for flame (small glowing sphere)
  const particleGeo = new THREE.SphereGeometry(0.1, 4, 4);
  const particleMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
  const particle = new THREE.Mesh(particleGeo, particleMat);
  particle.position.set(0, 0.65, 0.1);
  torchGroup.add(particle);

  // Dynamic Point Light (Flickering source)
  const light = new THREE.PointLight('#f97316', 0.8, 8);
  light.position.set(0, 0.7, 0.15);
  light.castShadow = false;
  torchGroup.add(light);

  torchGroup.position.set(x, y, z);
  torchGroup.rotation.y = rotationY;
  
  scene.add(torchGroup);

  // Track light and flame mesh to animate flickering
  torches.push({
    light,
    flame,
    baseIntensity: 0.8,
    seed: Math.random() * 100
  });
}

// --- Player Avatar Creation ---
function createPlayerAvatar(avatarType, colorHex, username, isLocal = false, isNpc = false) {
  const avatarGroup = new THREE.Group();

  // Color Material
  const shirtMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.8 }); // Pinkish peach skin
  const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 }); // Dark pants
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
  const brownMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.85 }); // Brown leather for backpack / hat
  const hatBandMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 }); // Dark hat band
  
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

  // 3. Stylized Explorer Hat (Uniform for everyone!)
  const hatGroup = new THREE.Group();
  
  // Hat Brim
  const brimGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 8);
  const brim = new THREE.Mesh(brimGeo, brownMat);
  brim.position.y = 2.02;
  brim.castShadow = true;
  hatGroup.add(brim);

  // Hat Band
  const bandGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.08, 8);
  const band = new THREE.Mesh(bandGeo, hatBandMat);
  band.position.y = 2.1;
  band.castShadow = true;
  hatGroup.add(band);

  // Hat Crown
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

  // 5. Arms (Left / Right)
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 4);
  armGeo.translate(0, -0.35, 0); // Set pivot at shoulder
  
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.48, 1.5, 0);
  leftArm.castShadow = true;
  avatarGroup.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.48, 1.5, 0);
  rightArm.castShadow = true;
  avatarGroup.add(rightArm);

  // 6. Legs (Left / Right)
  const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 4);
  legGeo.translate(0, -0.3, 0); // Pivot at hip

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
  let tagColor = '#38bdf8'; // Sky-blue for others
  if (isLocal) {
    tagColor = '#818cf8'; // Purple-blue for self
  } else if (isNpc) {
    tagColor = '#f59e0b'; // Amber for NPCs
  }
  const nameTag = createPlayerNameSprite(username, tagColor);
  nameTag.position.set(0, 2.7, 0);
  avatarGroup.add(nameTag);

  scene.add(avatarGroup);

  return {
    group: avatarGroup,
    leftLeg, rightLeg,
    leftArm, rightArm,
    nameTag
  };
}

// --- Player Movement & Collisions ---
function checkCollision(targetX, targetZ) {
  // Building outer boundaries check
  // Map limits check
  const mapLim = MAP_SIZE / 2 - 2;
  if (Math.abs(targetX) > mapLim || Math.abs(targetZ) > mapLim) {
    return true; // Collided with edge barrier
  }

  // Iterate over building walls and check bounding boxes
  for (const wall of WALLS) {
    if (targetX >= wall.minX && targetX <= wall.maxX &&
        targetZ >= wall.minZ && targetZ <= wall.maxZ) {
      return true; // Hit a building wall
    }
  }

  return false;
}

function updateLocalPlayer(dt) {
  if (!isJoined || !localPlayer.mesh) return;

  const oldPos = new THREE.Vector3().copy(localPlayer.mesh.position);

  const acceleration = 55.0;
  const maxSpeed = 9.5;
  const drag = 8.5;
  const gravity = 25.0;
  const jumpForce = 10.0;
  
  // 1. Vertical Physics (Gravity & Jump)
  const groundY = getTerrainHeight(localPlayer.x, localPlayer.z);
  
  if (!localPlayer.isGrounded) {
    localPlayer.velocity.y -= gravity * dt;
    localPlayer.y += localPlayer.velocity.y * dt;
    
    // Check ground collision
    if (localPlayer.y <= groundY) {
      localPlayer.y = groundY;
      localPlayer.velocity.y = 0;
      localPlayer.isGrounded = true;
    }
  } else {
    // Follow terrain height dynamically while grounded
    localPlayer.y = groundY;
    
    if (keys.space) {
      localPlayer.velocity.y = jumpForce;
      localPlayer.isGrounded = false;
      keys.space = false; // Reset jump state
    }
  }

  // 2. Horizontal Movement Calculation (Accelerate and Damp)
  const moveDirection = new THREE.Vector3();
  
  if (keys.w) moveDirection.z -= 1;
  if (keys.s) moveDirection.z += 1;
  if (keys.a) moveDirection.x -= 1;
  if (keys.d) moveDirection.x += 1;
  
  moveDirection.normalize();

  // Apply friction/drag to current horizontal velocity
  localPlayer.velocity.x -= localPlayer.velocity.x * drag * dt;
  localPlayer.velocity.z -= localPlayer.velocity.z * drag * dt;

  if (moveDirection.lengthSq() > 0) {
    // Project camera direction onto ground plane
    const camDirection = new THREE.Vector3();
    camera.getWorldDirection(camDirection);
    camDirection.y = 0;
    camDirection.normalize();
    
    // Camera right vector
    const camRight = new THREE.Vector3();
    camRight.crossVectors(camera.up, camDirection).negate().normalize();
    
    // Find absolute target moving direction
    const targetDirection = new THREE.Vector3()
      .addScaledVector(camDirection, -moveDirection.z)
      .addScaledVector(camRight, moveDirection.x)
      .normalize();

    // Accelerate along target direction
    localPlayer.velocity.x += targetDirection.x * acceleration * dt;
    localPlayer.velocity.z += targetDirection.z * acceleration * dt;
  }

  // Cap horizontal speed to maxSpeed
  const speedXZ = Math.sqrt(localPlayer.velocity.x * localPlayer.velocity.x + localPlayer.velocity.z * localPlayer.velocity.z);
  if (speedXZ > maxSpeed) {
    localPlayer.velocity.x = (localPlayer.velocity.x / speedXZ) * maxSpeed;
    localPlayer.velocity.z = (localPlayer.velocity.z / speedXZ) * maxSpeed;
  }

  // Calculate distance steps
  const stepX = localPlayer.velocity.x * dt;
  const stepZ = localPlayer.velocity.z * dt;

  // 3. Slide along walls collision response
  if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
    let nextX = localPlayer.x + stepX;
    let nextZ = localPlayer.z + stepZ;
    
    // Try full movement first
    if (!checkCollision(nextX, nextZ)) {
      localPlayer.x = nextX;
      localPlayer.z = nextZ;
    } else {
      // Try moving along X axis only (allows sliding along Z-facing walls)
      if (!checkCollision(nextX, localPlayer.z)) {
        localPlayer.x = nextX;
        localPlayer.velocity.z = 0; // Cancel Z velocity component
      }
      // Try moving along Z axis only (allows sliding along X-facing walls)
      else if (!checkCollision(localPlayer.x, nextZ)) {
        localPlayer.z = nextZ;
        localPlayer.velocity.x = 0; // Cancel X velocity component
      } else {
        // Hit a corner directly, kill all horizontal velocity
        localPlayer.velocity.x = 0;
        localPlayer.velocity.z = 0;
      }
    }
  }

  // Face rotation matches velocity direction if moving
  if (speedXZ > 0.4) {
    const targetAngle = Math.atan2(localPlayer.velocity.x, localPlayer.velocity.z);
    
    // Smoothly rotate character to face direction of movement
    let diff = targetAngle - localPlayer.ry;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    localPlayer.ry += diff * 15.0 * dt;
    localPlayer.isMoving = true;
  } else {
    localPlayer.isMoving = false;
  }

  // Update localPlayer 3D Model position
  localPlayer.mesh.position.set(localPlayer.x, localPlayer.y, localPlayer.z);
  localPlayer.mesh.rotation.y = localPlayer.ry;
  
  // Update controls target and camera position in lockstep with player movement delta
  const delta = new THREE.Vector3().subVectors(localPlayer.mesh.position, oldPos);
  camera.position.add(delta);
  controls.target.copy(localPlayer.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
  controls.update();

  // 4. Leg and Arm Swing Walking Animation
  animateAvatarWalk(localPlayer, dt);

  // 5. Room entry detection
  detectRoomEntry();

  // 6. Network position sync
  syncPosition();
}

function animateAvatarWalk(playerObj, dt) {
  const isMoving = playerObj.isMoving;
  
  // Limbs access
  const leftLeg = playerObj.leftLeg;
  const rightLeg = playerObj.rightLeg;
  const leftArm = playerObj.leftArm;
  const rightArm = playerObj.rightArm;

  if (!leftLeg || !rightLeg) return;

  if (isMoving && playerObj.isGrounded) {
    const time = Date.now() * 0.012;
    const swingRange = 0.6;
    
    leftLeg.rotation.x = Math.sin(time) * swingRange;
    rightLeg.rotation.x = -Math.sin(time) * swingRange;
    
    if (leftArm && rightArm) {
      leftArm.rotation.x = -Math.sin(time) * swingRange;
      rightArm.rotation.x = Math.sin(time) * swingRange;
    }
  } else {
    // Return to neutral
    const lerpSpeed = 10 * dt;
    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, lerpSpeed);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, lerpSpeed);
    
    if (leftArm && rightArm) {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, lerpSpeed);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, lerpSpeed);
    }
  }
  
  // Vertical jumping animation
  if (!playerObj.isGrounded && leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, -Math.PI / 3, 5 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, Math.PI / 3, 5 * dt);
  } else if (leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0, 10 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, 10 * dt);
  }
}

// --- NPC Generation & Pathfinding ---
function spawnNpcs() {
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

  // Starting positions for NPCs
  const npcPositions = [
    { x: 0, z: 26 },    // Hans near the main southern entrance
    { x: -10, z: -10 }, // Wise Old Man in Room 1
    { x: -30, z: 10 },  // Bob the Bartender in Room 4 (Tavern)
    { x: 10, z: 10 },   // Aubury in Room 6
    { x: 30, z: -10 },  // Giles in Room 3
    { x: -25, z: -25 }  // Gnome Trainer wandering outdoors northwest
  ];

  for (let i = 0; i < npcNames.length; i++) {
    const name = npcNames[i];
    const color = npcColors[i];
    const pos = npcPositions[i];
    const groundY = getTerrainHeight(pos.x, pos.z);

    // Spawn 3D explorer model (isNpc = true)
    const avatar = createPlayerAvatar(null, color, name, false, true);
    avatar.group.position.set(pos.x, groundY, pos.z);

    npcs.push({
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
      speed: 2.8, // Relaxed ambient walking speed
      waitTimer: Math.random() * 4 + 2, // Init wait time
      state: "idle" // "idle" or "walk"
    });
  }
}

function updateNpcs(dt) {
  npcs.forEach((npc) => {
    if (npc.state === "idle") {
      npc.waitTimer -= dt;
      if (npc.waitTimer <= 0) {
        // Pick a random target within a radius of 15 meters
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 12;
        
        let tx = npc.x + Math.cos(angle) * dist;
        let tz = npc.z + Math.sin(angle) * dist;

        // Clamp to general world bounds
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
        // Reached target, switch to idle
        npc.state = "idle";
        npc.isMoving = false;
        npc.waitTimer = Math.random() * 4 + 3; // Wait 3 to 7 seconds
      } else {
        const dirX = dx / dist;
        const dirZ = dz / dist;

        // Face the target smoothly
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - npc.ry;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        npc.ry += diff * 12.0 * dt;

        // Walk step
        const stepX = dirX * npc.speed * dt;
        const stepZ = dirZ * npc.speed * dt;

        const nextX = npc.x + stepX;
        const nextZ = npc.z + stepZ;

        // Check if moving here collides with walls
        if (!checkCollision(nextX, nextZ)) {
          npc.x = nextX;
          npc.z = nextZ;
        } else {
          // Collided, stop and choose another path
          npc.state = "idle";
          npc.isMoving = false;
          npc.waitTimer = Math.random() * 2 + 1; // Wait a short time
        }
      }
    }

    // Update Y position to match local terrain height dynamically
    npc.y = getTerrainHeight(npc.x, npc.z);

    // Update 3D mesh position & rotation
    npc.mesh.position.set(npc.x, npc.y, npc.z);
    npc.mesh.rotation.y = npc.ry;

    // Animate walks (limbs swing)
    animateAvatarWalk(npc, dt);
  });
}

// --- Room Bounding Box Triggers ---
function detectRoomEntry() {
  let activeRoomId = -1;

  for (const room of ROOMS) {
    // Center coords
    const rx = room.x;
    const rz = room.z;
    
    // Bounds boundaries
    const minX = rx - ROOM_WIDTH / 2;
    const maxX = rx + ROOM_WIDTH / 2;
    const minZ = rz - ROOM_DEPTH / 2;
    const maxZ = rz + ROOM_DEPTH / 2;

    if (localPlayer.x >= minX && localPlayer.x <= maxX &&
        localPlayer.z >= minZ && localPlayer.z <= maxZ) {
      activeRoomId = room.id;
      break;
    }
  }

  // Handle entry/exit triggers
  if (activeRoomId !== localPlayer.currentRoom) {
    const prevRoom = localPlayer.currentRoom;
    localPlayer.currentRoom = activeRoomId;
    
    // Notify server of room change
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "room_change",
        room: activeRoomId
      }));
    }

    // Update UI HUD location
    const locTag = document.getElementById('hud-location');
    const panel = document.getElementById('room-panel');
    
    if (activeRoomId === -1) {
      locTag.innerText = "Exploring Outdoors";
      panel.classList.remove('room-panel-visible');
      // Stop YouTube
      if (ytPlayer && ytPlayer.pauseVideo) {
        ytPlayer.pauseVideo();
      }
      activeRoomVideoId = "";
    } else {
      const room = ROOMS[activeRoomId];
      locTag.innerText = `In Room: ${room.name}`;
      
      // Update room UI Panel
      updateRoomPanelDetails();
      panel.classList.add('room-panel-visible');
      
      // Setup/update YouTube stream for this room
      setupRoomVideo(activeRoomId);
      
      // Refresh list of players in the room
      refreshRoomPlayersList();
    }
  }
}

function refreshRoomPlayersList() {
  const listContainer = document.getElementById('room-players-list');
  listContainer.innerHTML = '';
  
  if (localPlayer.currentRoom === -1) return;

  // Build a list item with safe DOM APIs (color validated, name via textContent)
  function makePlayerItem(color, label, strong) {
    const li = document.createElement('li');
    li.className = 'room-player-item';
    const badge = document.createElement('span');
    badge.className = 'room-player-badge';
    badge.style.backgroundColor = sanitizeColor(color);
    const name = document.createElement(strong ? 'strong' : 'span');
    name.textContent = label;
    li.appendChild(badge);
    li.appendChild(name);
    return li;
  }

  // Add self
  listContainer.appendChild(
    makePlayerItem(localPlayer.color, `${localPlayer.username} (You)`, true)
  );

  // Add matching remote players
  remotePlayers.forEach((p) => {
    if (p.room === localPlayer.currentRoom) {
      listContainer.appendChild(makePlayerItem(p.color, p.username, false));
    }
  });

  // Capacity update
  const count = listContainer.children.length;
  document.getElementById('room-capacity').innerText = `${count} / 10 Players`;
}

// --- YouTube & Google Meet Player Logic ---
function setupRoomVideo(roomId) {
  const room = ROOMS[roomId];
  const videoId = room.sourceValue || room.video || "";

  if (!videoId) {
    // Hide both/all
    const roomYt = document.getElementById('youtube-player');
    if (roomYt) roomYt.style.display = 'none';
    const roomMeet = document.getElementById('room-meet-card');
    if (roomMeet) roomMeet.style.display = 'none';
    if (ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch (e) {}
    }
    activeRoomVideoId = "";
    
    if (roomId === 6) {
      const boardYt = document.getElementById('embedded-youtube-player');
      if (boardYt) boardYt.style.display = 'none';
      const boardMeet = document.getElementById('board-meet-card');
      if (boardMeet) boardMeet.style.display = 'none';
      if (boardYtPlayer && boardYtPlayer.pauseVideo) {
        try { boardYtPlayer.pauseVideo(); } catch (e) {}
      }
    }
    return;
  }

  const isMeet = room.sourceType === 'meet';
  const playbackStart = getRoomPlaybackStartSeconds(room);

  // 1. Handle Classroom Blackboard (Room 6)
  if (roomId === 6) {
    const boardContainer = document.getElementById('embedded-board-container');
    let boardYt = document.getElementById('embedded-youtube-player');
    let boardMeet = document.getElementById('board-meet-card');

    if (isMeet) {
      // Hide YT, show Meet Card
      if (boardYt) boardYt.style.display = 'none';
      if (boardYtPlayer && boardYtPlayer.pauseVideo) {
        try { boardYtPlayer.pauseVideo(); } catch(e) {}
      }
      
      if (!boardMeet) {
        boardMeet = document.createElement('div');
        boardMeet.id = 'board-meet-card';
        boardMeet.style.cssText = "width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #fff; text-align: center; padding: 20px; box-sizing: border-box;";
        boardContainer.appendChild(boardMeet);
      }
      populateMeetCard(boardMeet, videoId, true);
      boardMeet.style.display = 'flex';
    } else {
      // Hide Meet, show YT
      if (boardMeet) boardMeet.style.display = 'none';
      if (boardYt) boardYt.style.display = 'block';

      if (boardYtPlayer && typeof boardYtPlayer.loadVideoById === 'function') {
        try {
          boardYtPlayer.loadVideoById({
            videoId: videoId,
            startSeconds: playbackStart
          });
        } catch (e) {}
      } else if (window.YT && window.YT.Player) {
        try {
          boardYtPlayer = new window.YT.Player('embedded-youtube-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
              'playsinline': 1,
              'autoplay': 1,
              'controls': 1,
              'rel': 0,
              'start': playbackStart
            },
            events: {
              'onReady': (event) => {
                event.target.playVideo();
              }
            }
          });
        } catch (err) {
          console.error("Failed to build board YT player", err);
        }
      }
    }
  }

  // 2. Handle Side Room Panel
  const roomContainer = document.querySelector('.video-container');
  let roomYt = document.getElementById('youtube-player');
  let roomMeet = document.getElementById('room-meet-card');

  if (isMeet) {
    // Hide YT, show Meet Card
    if (roomYt) roomYt.style.display = 'none';
    if (ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch(e) {}
    }

    if (!roomMeet) {
      roomMeet = document.createElement('div');
      roomMeet.id = 'room-meet-card';
      roomMeet.style.cssText = "width: 100%; height: 100%; position: absolute; top: 0; left: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #fff; text-align: center; padding: 15px; box-sizing: border-box;";
      roomContainer.appendChild(roomMeet);
    }
    populateMeetCard(roomMeet, videoId, false);
    roomMeet.style.display = 'flex';
    activeRoomVideoId = videoId;
  } else {
    // Hide Meet, show YT
    if (roomMeet) roomMeet.style.display = 'none';
    if (roomYt) roomYt.style.display = 'block';

    if (activeRoomVideoId === videoId) {
      // Already playing correct video, ensure it's playing
      if (ytPlayer && ytPlayer.playVideo) {
        try {
          ytPlayer.playVideo();
        } catch (e) {}
      }
      return;
    }

    activeRoomVideoId = videoId;

    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById({
        videoId: videoId,
        startSeconds: playbackStart
      });
    } else {
      try {
        if (window.YT && window.YT.Player) {
          ytPlayer = new window.YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
              'playsinline': 1,
              'autoplay': 1,
              'controls': 1,
              'rel': 0,
              'start': playbackStart
            },
            events: {
              'onReady': (event) => {
                event.target.playVideo();
              }
            }
          });
        }
      } catch (err) {
        console.error("Failed to build YT player", err);
      }
    }
  }
}

// Global Callback called by YouTube SDK script loading
window.onYouTubeIframeAPIReady = function() {
  ytApiReady = true;
};

// --- WebSocket Sync ---
// --- Reconnect handling: exponential backoff w/ jitter, no stacked sockets ---
let reconnectAttempts = 0;
let reconnectTimer = null;
const MAX_RECONNECT_DELAY = 30000;

// Remove every remote avatar (used before the server re-seeds us on reconnect,
// since reconnecting assigns a fresh id and any prior remote state is stale).
function clearRemotePlayers() {
  for (const id of Array.from(remotePlayers.keys())) {
    removeRemotePlayer(id);
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return; // a reconnect is already pending
  reconnectAttempts++;
  // Full-jitter exponential backoff: random within [base/2, base], capped.
  const base = Math.min(MAX_RECONNECT_DELAY, 1000 * Math.pow(2, reconnectAttempts - 1));
  const delay = Math.round(base / 2 + Math.random() * (base / 2));
  addChatLog("System", `Disconnected from server. Reconnecting in ${Math.round(delay / 1000)}s...`, "system-msg");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectMultiplayer();
  }, delay);
}

function connectMultiplayer() {
  // We are (re)connecting now; cancel any pending retry timer.
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Tear down any previous socket so connections never stack.
  if (socket) {
    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    } catch (e) {}
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  const ws = new WebSocket(wsUrl);
  socket = ws;

  ws.addEventListener('open', () => {
    if (ws !== socket) return; // a newer socket superseded this one
    reconnectAttempts = 0;     // successful connect resets backoff
    document.getElementById('connection-status').classList.add('connected');

    // Drop any stale remote avatars before the server sends a fresh roster.
    clearRemotePlayers();

    // Join the game with profile
    ws.send(JSON.stringify({
      type: "join",
      username: localPlayer.username,
      avatar: localPlayer.avatarType,
      color: localPlayer.color,
      x: localPlayer.x,
      y: localPlayer.y,
      z: localPlayer.z,
      ry: localPlayer.ry
    }));
  });

  ws.addEventListener('close', () => {
    if (ws !== socket) return; // stale socket closing (we already replaced it)
    document.getElementById('connection-status').classList.remove('connected');
    scheduleReconnect();
  });

  ws.addEventListener('message', (event) => {
    if (ws !== socket) return; // ignore messages from a superseded socket
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "init":
          // Receive own ID and list of other players
          localPlayer.id = data.playerId;
          
          if (Array.isArray(data.rooms)) {
            data.rooms.forEach((roomData, index) => {
              const roomId = Number.isInteger(roomData.roomId) ? roomData.roomId : index;
              applyRoomData(roomId, roomData);
            });
          } else if (data.videos) {
            for (let i = 0; i < 8; i++) {
              applyRoomData(i, { sourceValue: data.videos[i] || "" });
            }
          }
          renderEventBoard();

          // Spawn existing players
          data.players.forEach((p) => {
            spawnRemotePlayer(p);
          });
          break;

        case "join":
          if (data.player.id === localPlayer.id) return;
          spawnRemotePlayer(data.player);
          addChatLog("System", `${data.player.username} entered Metalyceum!`, "system-msg");
          if (localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          break;

        case "move":
          if (data.id === localPlayer.id) return;
          const remoteP = remotePlayers.get(data.id);
          if (remoteP) {
            // Target coordinates for lerping in loop
            remoteP.targetX = data.x;
            remoteP.targetY = data.y;
            remoteP.targetZ = data.z;
            remoteP.targetRy = data.ry;
            remoteP.isMoving = data.isMoving;
          }
          break;

        case "room_change":
          if (data.id === localPlayer.id) return;
          const rPlayer = remotePlayers.get(data.id);
          if (rPlayer) {
            rPlayer.room = data.room;
            if (localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          }
          break;

        case "chat":
          // Bubble text above avatar
          displayChatBubble(data.id, data.message);
          addChatLog(data.username, data.message);
          break;

        case "room_update": {
          const rIdx = Number.isInteger(data.room?.roomId) ? data.room.roomId : data.roomId;
          applyRoomData(rIdx, data.room || data);
          renderEventBoard();
          if (localPlayer.currentRoom === rIdx) {
            updateRoomPanelDetails();
            setupRoomVideo(rIdx);
          }
          break;
        }

        case "video_change": {
          const rIdx = data.room;
          applyRoomData(rIdx, { sourceValue: data.videoId });
          renderEventBoard();
          if (localPlayer.currentRoom === rIdx) {
            updateRoomPanelDetails();
            setupRoomVideo(rIdx);
          }
          break;
        }

        case "leave":
          removeRemotePlayer(data.id);
          if (localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          break;
      }
    } catch (err) {
      console.error("Error handling websocket payload", err);
    }
  });
}

function spawnRemotePlayer(pData) {
  // If already spawned, remove first
  if (remotePlayers.has(pData.id)) {
    removeRemotePlayer(pData.id);
  }

  // Create avatar meshes
  const avatar = createPlayerAvatar(pData.avatar, pData.color, pData.username, false);
  avatar.group.position.set(pData.x, pData.y, pData.z);
  avatar.group.rotation.y = pData.ry;

  const playerObj = {
    id: pData.id,
    username: pData.username,
    color: pData.color,
    avatar: pData.avatar,
    room: pData.room,
    x: pData.x, y: pData.y, z: pData.z,
    ry: pData.ry,
    targetX: pData.x, targetY: pData.y, targetZ: pData.z, targetRy: pData.ry,
    isMoving: pData.isMoving,
    mesh: avatar.group,
    leftLeg: avatar.leftLeg,
    rightLeg: avatar.rightLeg,
    leftArm: avatar.leftArm,
    rightArm: avatar.rightArm,
    nameTag: avatar.nameTag,
    chatBubble: null,
    chatTimeout: null
  };

  remotePlayers.set(pData.id, playerObj);
}

function removeRemotePlayer(id) {
  const p = remotePlayers.get(id);
  if (p) {
    scene.remove(p.mesh);
    // Recursively dispose meshes
    p.mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    // Clear nameTag sprite texture
    if (p.nameTag && p.nameTag.material && p.nameTag.material.map) {
      p.nameTag.material.map.dispose();
      p.nameTag.material.dispose();
    }
    if (p.chatBubble && p.chatBubble.material && p.chatBubble.material.map) {
      p.chatBubble.material.map.dispose();
      p.chatBubble.material.dispose();
    }
    
    remotePlayers.delete(id);
  }
}

// Transmit positions throttled to avoid server congestion
function syncPosition() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  const dx = Math.abs(localPlayer.x - lastSentPosition.x);
  const dy = Math.abs(localPlayer.y - lastSentPosition.y);
  const dz = Math.abs(localPlayer.z - lastSentPosition.z);
  const dry = Math.abs(localPlayer.ry - lastSentPosition.ry);
  const dMoving = localPlayer.isMoving !== lastSentPosition.isMoving;

  // Thresholds
  if (dx > 0.05 || dy > 0.05 || dz > 0.05 || dry > 0.02 || dMoving) {
    socket.send(JSON.stringify({
      type: "move",
      x: parseFloat(localPlayer.x.toFixed(2)),
      y: parseFloat(localPlayer.y.toFixed(2)),
      z: parseFloat(localPlayer.z.toFixed(2)),
      ry: parseFloat(localPlayer.ry.toFixed(3)),
      isMoving: localPlayer.isMoving
    }));

    lastSentPosition = {
      x: localPlayer.x,
      y: localPlayer.y,
      z: localPlayer.z,
      ry: localPlayer.ry,
      isMoving: localPlayer.isMoving
    };
  }
}

// Chat functions
function addChatLog(author, message, className = "") {
  const log = document.getElementById('chat-log');
  const msgDiv = document.createElement('div');
  
  if (className) {
    msgDiv.className = className;
    msgDiv.textContent = message;
  } else {
    msgDiv.className = 'chat-msg';
    const authorSpan = document.createElement('span');
    authorSpan.className = 'chat-author';
    authorSpan.style.color = author === localPlayer.username ? '#818cf8' : '#38bdf8';
    authorSpan.textContent = `${author}:`;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    msgDiv.appendChild(authorSpan);
    msgDiv.appendChild(msgSpan);
  }
  
  log.appendChild(msgDiv);
  log.scrollTop = log.scrollHeight;
}

function displayChatBubble(playerId, text) {
  let targetP = null;
  if (playerId === localPlayer.id) {
    targetP = localPlayer;
    // For local player, wrap mock model parameters or attach directly
    targetP.group = localPlayer.mesh;
  } else {
    targetP = remotePlayers.get(playerId);
  }

  if (!targetP || !targetP.group) return;

  // Remove old bubble if exists
  if (targetP.chatBubble) {
    targetP.group.remove(targetP.chatBubble);
    targetP.chatBubble.material.map.dispose();
    targetP.chatBubble.material.dispose();
    targetP.chatBubble = null;
  }
  if (targetP.chatTimeout) {
    clearTimeout(targetP.chatTimeout);
  }

  // Create chat bubble canvas sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  // Bubble style
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;

  const r = 8;
  const x = 6, y = 6, w = 244, h = 50;
  
  // Draw round rect
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  
  // Draw tail arrow
  ctx.lineTo(128 + 10, y + h);
  ctx.lineTo(128, y + h + 12);
  ctx.lineTo(128 - 10, y + h);
  
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Wrap text
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Truncate to fit single line nicely, or multi-line wrap
  let displayVal = text;
  if (text.length > 25) {
    displayVal = text.substring(0, 22) + "...";
  }
  ctx.fillText(displayVal, 128, 30);

  const texture = new THREE.CanvasTexture(canvas);
  const bubbleMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const bubbleSprite = new THREE.Sprite(bubbleMat);
  bubbleSprite.scale.set(2.4, 0.75, 1);
  bubbleSprite.position.set(0, 3.4, 0);

  targetP.chatBubble = bubbleSprite;
  targetP.group.add(bubbleSprite);

  // Auto clean bubble
  targetP.chatTimeout = setTimeout(() => {
    if (targetP.group && targetP.chatBubble) {
      targetP.group.remove(targetP.chatBubble);
      targetP.chatBubble.material.map.dispose();
      targetP.chatBubble.material.dispose();
      targetP.chatBubble = null;
    }
  }, 4500);
}

// --- Main Engine Loop ---
let lastTime = performance.now();

// Orbit the camera around controls.target by the given spherical deltas.
// Replaces the (private, non-existent) OrbitControls.rotateLeft/rotateUp methods.
const _orbitOffset = new THREE.Vector3();
const _orbitSpherical = new THREE.Spherical();
function orbitCamera(deltaTheta, deltaPhi) {
  _orbitOffset.copy(camera.position).sub(controls.target);
  _orbitSpherical.setFromVector3(_orbitOffset);
  _orbitSpherical.theta += deltaTheta;
  _orbitSpherical.phi += deltaPhi;
  // Respect the controls' polar limits and avoid gimbal flip at the poles
  _orbitSpherical.phi = Math.max(
    controls.minPolarAngle,
    Math.min(controls.maxPolarAngle, _orbitSpherical.phi)
  );
  _orbitSpherical.makeSafe();
  _orbitOffset.setFromSpherical(_orbitSpherical);
  camera.position.copy(controls.target).add(_orbitOffset);
  camera.lookAt(controls.target);
}

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1); // Limit dt spike
  lastTime = now;
  
  // 1. Orbit Camera using Arrow keys
  // OrbitControls (r128) does not expose rotateLeft/rotateUp publicly, so we
  // orbit the camera around the target manually via spherical coordinates.
  const rotateSpeed = 1.8 * dt;
  let deltaTheta = 0; // azimuthal (left/right)
  let deltaPhi = 0;   // polar (up/down)
  if (cameraKeys.ArrowLeft) deltaTheta -= rotateSpeed;
  if (cameraKeys.ArrowRight) deltaTheta += rotateSpeed;
  if (cameraKeys.ArrowUp) deltaPhi -= rotateSpeed;
  if (cameraKeys.ArrowDown) deltaPhi += rotateSpeed;
  if (deltaTheta !== 0 || deltaPhi !== 0) {
    orbitCamera(deltaTheta, deltaPhi);
  }
  controls.update();
  
  // 2. Animate Torches (Point light flickering & flame wiggling)
  const time = now * 0.005;
  torches.forEach((t) => {
    const flicker = Math.sin(time * 3 + t.seed) * Math.cos(time * 7 + t.seed) * 0.15;
    t.light.intensity = t.baseIntensity + flicker;
    t.flame.scale.set(
      1 + flicker * 0.1, 
      1 + Math.sin(time * 10 + t.seed) * 0.15, 
      1 + flicker * 0.1
    );
  });
  
  // 3. Update Local Player Physics/Controls
  updateLocalPlayer(dt);
  
  // 3b. Update NPCs positions and walk cycles
  updateNpcs(dt);
  
  // 4. Update Remote Players Positions (Interpolate / lerp for smooth motion)
  remotePlayers.forEach((p) => {
    const lerpSpeed = 10.0 * dt;
    
    p.x = THREE.MathUtils.lerp(p.x, p.targetX, lerpSpeed);
    p.y = THREE.MathUtils.lerp(p.y, p.targetY, lerpSpeed);
    p.z = THREE.MathUtils.lerp(p.z, p.targetZ, lerpSpeed);
    
    // Smooth angular lerp
    // Formulate rotation angles correctly
    let diff = p.targetRy - p.ry;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    p.ry += diff * lerpSpeed;
    
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = p.ry;
    
    // Limbs walk animation
    animateAvatarWalk(p, dt);
  });
  
  // 4b. Update Ceilings and Upper Walls (Fade out when indoors)
  const isInside = localPlayer.currentRoom !== -1;
  const targetOpacity = isInside ? 0.0 : 1.0;
  
  if (ceilingMat) {
    ceilingMat.opacity = THREE.MathUtils.lerp(ceilingMat.opacity, targetOpacity, 8 * dt);
    ceilingMesh.visible = ceilingMat.opacity > 0.02;
  }
  
  if (upperWallMat) {
    upperWallMat.opacity = THREE.MathUtils.lerp(upperWallMat.opacity, targetOpacity, 8 * dt);
    
    // Also fade sign board materials in sync with upper walls
    if (signFrontMat) signFrontMat.opacity = upperWallMat.opacity;
    if (signSideMat) signSideMat.opacity = upperWallMat.opacity;
    
    upperWalls.forEach(w => {
      w.visible = upperWallMat.opacity > 0.02;
    });
  }

  // 4c. Update projected classroom board position
  updateClassroomBoard();

  // 5. Render Scene
  renderer.render(scene, camera);
}

// --- Theater Mode & Raycaster Interactions ---
function openTheaterMode(roomId) {
  const room = ROOMS[roomId];
  const feedVal = room.sourceValue || room.video || "";
  const playbackStart = getRoomPlaybackStartSeconds(room);
  
  const modal = document.getElementById('theater-modal');
  const title = document.getElementById('theater-title');
  const container = document.getElementById('theater-player-container');
  const fallbackBtn = document.getElementById('meet-fallback-btn');
  
  if (!modal || !container) return;
  
  container.innerHTML = ''; // Clear previous content
  title.innerText = `${room.name} - Theater Mode`;
  
  if (!feedVal) {
    container.innerHTML = `<div class="theater-placeholder-text">No live source is set for this room.<br>Use the room event editor to add a YouTube Live or Google Meet link.</div>`;
    fallbackBtn.style.display = 'none';
  } else {
    const isMeet = room.sourceType === 'meet';
    if (isMeet) {
      // Google Meet
      let meetUrl = feedVal;
      if (!meetUrl.startsWith('http://') && !meetUrl.startsWith('https://')) {
        meetUrl = 'https://' + meetUrl;
      }
      
      const iframe = document.createElement('iframe');
      iframe.src = meetUrl;
      iframe.allow = "camera; microphone; display-capture; autoplay";
      container.appendChild(iframe);
      
      // Update fallback link for opening in a new tab if browser restricts embedding
      fallbackBtn.href = meetUrl;
      fallbackBtn.style.display = 'inline-flex';
    } else {
      // YouTube Video
      fallbackBtn.style.display = 'none';
      
      const iframe = document.createElement('iframe');
      const startParam = playbackStart > 0 ? `&start=${playbackStart}` : '';
      iframe.src = `https://www.youtube.com/embed/${feedVal}?autoplay=1&enablejsapi=1${startParam}`;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }
  }
  
  modal.classList.add('active');
  
  // Pause ambient YT player to avoid overlapping audio
  if (ytPlayer && ytPlayer.pauseVideo) {
    try { ytPlayer.pauseVideo(); } catch(e) {}
  }
  if (boardYtPlayer && boardYtPlayer.pauseVideo) {
    try { boardYtPlayer.pauseVideo(); } catch(e) {}
  }
}

function closeTheaterMode() {
  const modal = document.getElementById('theater-modal');
  const container = document.getElementById('theater-player-container');
  if (modal) modal.classList.remove('active');
  if (container) container.innerHTML = ''; // Destroy players/iframes
  
  // Resume ambient players if inside a room
  if (localPlayer.currentRoom !== -1) {
    setupRoomVideo(localPlayer.currentRoom);
  }
}

function onCanvasClick(event) {
  // Only detect screen clicks when the user is inside a room
  if (localPlayer.currentRoom === -1) return;
  
  // Calculate mouse position in normalized device coordinates
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableScreens);
  
  if (intersects.length > 0) {
    const clickedScreen = intersects[0].object;
    if (clickedScreen.userData && clickedScreen.userData.roomId !== undefined) {
      openTheaterMode(clickedScreen.userData.roomId);
    }
  }
}

// --- Form & UI Handle Bindings ---
function initUiHandlers() {
  // Login form submission
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username-input').value.trim();
    const avatarType = "explorer";
    const color = document.getElementById('color-input').value;
    
    if (!username) return;
    
    localPlayer.username = username;
    localPlayer.avatarType = avatarType;
    localPlayer.color = color;
    
    // Spawn local avatar
    const avatar = createPlayerAvatar(avatarType, color, username, true);
    localPlayer.mesh = avatar.group;
    localPlayer.mesh.position.set(localPlayer.x, localPlayer.y, localPlayer.z);
    localPlayer.mesh.rotation.y = localPlayer.ry;
    
    // Assign local limb pointers for animation
    localPlayer.leftLeg = avatar.leftLeg;
    localPlayer.rightLeg = avatar.rightLeg;
    localPlayer.leftArm = avatar.leftArm;
    localPlayer.rightArm = avatar.rightArm;
    
    // Set camera starting position behind player
    camera.position.set(localPlayer.x, localPlayer.y + 10, localPlayer.z + 18);
    controls.target.copy(localPlayer.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
    controls.update();

    // Toggle HUD
    document.getElementById('hud-username').innerText = username;
    document.getElementById('login-overlay').classList.remove('active');
    
    // Initialize multiplayer connection
    connectMultiplayer();
    
    isJoined = true;
  });

  // Color picker synchronization
  const colorInput = document.getElementById('color-input');
  colorInput.addEventListener('input', (e) => {
    document.querySelector('.color-value').innerText = e.target.value;
  });

  // Chat message submission
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    socket.send(JSON.stringify({
      type: "chat",
      message: msg
    }));
    
    // Show bubble locally
    displayChatBubble(localPlayer.id, msg);
    addChatLog(localPlayer.username, msg);
    
    input.value = '';
  });

  // Room side panel close btn
  document.getElementById('close-panel-btn').addEventListener('click', () => {
    document.getElementById('room-panel').classList.remove('room-panel-visible');
    if (ytPlayer && ytPlayer.pauseVideo) {
      ytPlayer.pauseVideo();
    }
  });

  // Video feed control panel toggles
  const changeBtn = document.getElementById('change-video-btn');
  const cancelBtn = document.getElementById('cancel-video-btn');
  const submitBtn = document.getElementById('submit-video-btn');
  const modal = document.getElementById('video-input-modal');
  const urlInput = document.getElementById('video-url-input');
  const roomNameInput = document.getElementById('room-name-input');
  const roomStartInput = document.getElementById('room-start-input');
  const roomDurationInput = document.getElementById('room-duration-input');

  changeBtn.addEventListener('click', () => {
    const room = ROOMS[localPlayer.currentRoom];
    if (!room) return;
    roomNameInput.value = room.name;
    urlInput.value = room.sourceValue || "";
    roomStartInput.value = formatDateTimeLocalValue(room.startTime);
    roomDurationInput.value = room.durationMinutes > 0 ? String(room.durationMinutes) : '';
    modal.classList.add('video-modal-visible');
    roomNameInput.focus();
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('video-modal-visible');
    roomNameInput.value = '';
    urlInput.value = '';
    roomStartInput.value = '';
    roomDurationInput.value = '';
    roomNameInput.style.borderColor = '';
    roomDurationInput.style.borderColor = '';
    urlInput.style.borderColor = '';
  });

  // Reset the invalid-input indicator whenever the user edits the field
  roomNameInput.addEventListener('input', () => {
    roomNameInput.style.borderColor = '';
  });
  urlInput.addEventListener('input', () => {
    urlInput.style.borderColor = '';
  });
  roomDurationInput.addEventListener('input', () => {
    roomDurationInput.style.borderColor = '';
  });

  submitBtn.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    if (!roomName) {
      roomNameInput.style.borderColor = '#f43f5e';
      roomNameInput.focus();
      return;
    }

    let sourceValue = "";
    if (urlInput.value.trim()) {
      sourceValue = parseVideoInput(urlInput.value);
      if (!sourceValue) {
        urlInput.style.borderColor = '#f43f5e';
        urlInput.focus();
        return;
      }
    }

    const durationRaw = roomDurationInput.value.trim();
    const durationMinutes = durationRaw ? Number.parseInt(durationRaw, 10) : 0;
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
      roomDurationInput.style.borderColor = '#f43f5e';
      roomDurationInput.focus();
      return;
    }

    const startTime = roomStartInput.value ? new Date(roomStartInput.value).toISOString() : null;

    if (socket && socket.readyState === WebSocket.OPEN && localPlayer.currentRoom !== -1) {
      socket.send(JSON.stringify({
        type: "room_update",
        room: localPlayer.currentRoom,
        name: roomName,
        sourceValue,
        startTime,
        durationMinutes
      }));

      modal.classList.remove('video-modal-visible');
      roomNameInput.value = '';
      urlInput.value = '';
      roomStartInput.value = '';
      roomDurationInput.value = '';
      roomNameInput.style.borderColor = '';
      urlInput.style.borderColor = '';
      roomDurationInput.style.borderColor = '';
    }
  });

  // Keyboard controls listeners
  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return; // Ignore movement keys when typing in chat
    
    const key = e.key.toLowerCase();
    if (key === 'w') keys.w = true;
    if (key === 's') keys.s = true;
    if (key === 'a') keys.a = true;
    if (key === 'd') keys.d = true;
    if (e.key === ' ') keys.space = true;

    // Camera movements using Arrow Keys
    if (e.key === 'ArrowLeft') cameraKeys.ArrowLeft = true;
    if (e.key === 'ArrowRight') cameraKeys.ArrowRight = true;
    if (e.key === 'ArrowUp') cameraKeys.ArrowUp = true;
    if (e.key === 'ArrowDown') cameraKeys.ArrowDown = true;
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w') keys.w = false;
    if (key === 's') keys.s = false;
    if (key === 'a') keys.a = false;
    if (key === 'd') keys.d = false;

    if (e.key === 'ArrowLeft') cameraKeys.ArrowLeft = false;
    if (e.key === 'ArrowRight') cameraKeys.ArrowRight = false;
    if (e.key === 'ArrowUp') cameraKeys.ArrowUp = false;
    if (e.key === 'ArrowDown') cameraKeys.ArrowDown = false;
  });
  
  // Theater mode buttons
  const openTheaterBtn = document.getElementById('open-theater-btn');
  if (openTheaterBtn) {
    openTheaterBtn.addEventListener('click', () => {
      if (localPlayer.currentRoom !== -1) {
        openTheaterMode(localPlayer.currentRoom);
      }
    });
  }

  const closeTheaterBtn = document.getElementById('close-theater-btn');
  if (closeTheaterBtn) {
    closeTheaterBtn.addEventListener('click', () => {
      closeTheaterMode();
    });
  }

  const boardMaximizeBtn = document.getElementById('board-maximize-btn');
  if (boardMaximizeBtn) {
    boardMaximizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTheaterMode(6); // Room 6 is the classroom
    });
  }

  // Click on WebGL canvas to raycast and select interactive screens
  if (renderer && renderer.domElement) {
    renderer.domElement.addEventListener('click', onCanvasClick);
  }
  
  // Focus helper: pressing ESC defocuses inputs and exits theater mode
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.activeElement.blur();
      modal.classList.remove('video-modal-visible');
      closeTheaterMode();
    }
  });
}

// --- Content Visibility Background optimization ---
// Using modern web API guidelines to pause background rendering loop when offscreen
function initPerformanceOptimization() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Send a standby status
      }
    }
  });

  // Attach contentvisibilityautostatechange to game canvas container to defer calculations
  const gameContainer = document.getElementById('game-container');
  gameContainer.style.contentVisibility = 'auto';
  gameContainer.style.containIntrinsicSize = 'auto none auto 100vh';
  
  gameContainer.addEventListener('contentvisibilityautostatechange', (event) => {
    if (event.skipped) {
      // Browser skipped rendering this, throttle down
      renderer.setAnimationLoop(null);
    } else {
      // Browser resumes, kick off animation loop again
      lastTime = performance.now();
      renderer.setAnimationLoop(animate);
    }
  });
}

// --- App Entry Point ---
window.addEventListener('DOMContentLoaded', () => {
  initEngine();
  initUiHandlers();
  initPerformanceOptimization();
  renderEventBoard();
  roomStatusTimer = window.setInterval(() => {
    renderEventBoard();
    if (localPlayer.currentRoom !== -1) {
      updateRoomPanelDetails();
    }
  }, 30000);
  
  // Kickstart animation loop (WebGL updates)
  renderer.setAnimationLoop(animate);
});
