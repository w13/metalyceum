// Metalyceum Client App

// --- Configuration Constants ---
const ROOM_WIDTH = 20;
const ROOM_DEPTH = 20;
const ROOM_HEIGHT = 5.5;
const MAP_SIZE = 150; // Size of the grassy area
const ROOM_LABEL_HEIGHT = 5.1;
const CAMERA_FOLLOW_LERP = 1 - Math.pow(0.00035, 1 / 60);
const REMOTE_PLAYER_SMOOTHING = 0.001;
const ROOM_SCENERY_VISIBILITY_DISTANCE = 48;
const OUTDOOR_SCENERY_VISIBILITY_DISTANCE = 88;

const WORLD_CONFIG = {
  exteriorAccent: '#2563eb',
  fogColor: '#070b14',
  skyTop: '#060816',
  skyBottom: '#10203a',
  floorAccent: '#0f172a',
  signAccent: '#38bdf8',
  torchColor: '#f97316',
  roomBeaconColors: {
    idle: '#64748b',
    ready: '#60a5fa',
    upcoming: '#38bdf8',
    live: '#22c55e',
    ended: '#f43f5e'
  }
};

const ROOM_LAYOUTS = {
  0: { themeColor: '#60a5fa', label: 'Conversation room' },
  1: { themeColor: '#8b5cf6', label: 'Workshop room' },
  2: { themeColor: '#f59e0b', label: 'Open studio' },
  3: { themeColor: '#f43f5e', label: 'Broadcast room' },
  4: { themeColor: '#14b8a6', label: 'Lounge room' },
  5: { themeColor: '#22c55e', label: 'Crit room' },
  6: { themeColor: '#38bdf8', label: 'Screening room' },
  7: { themeColor: '#f97316', label: 'Commons room' }
};

const SOUNDTRACK_LIBRARY = [
  {
    title: 'Atrium Glass',
    bpm: 68,
    lengthBeats: 32,
    lanes: [
      {
        wave: 'triangle',
        volume: 0.08,
        attack: 1.4,
        release: 2.8,
        pan: -0.22,
        notes: [
          [0, 'C4', 8, 0.72], [0, 'G4', 8, 0.48], [0, 'D5', 8, 0.3],
          [8, 'A3', 8, 0.66], [8, 'E4', 8, 0.42], [8, 'B4', 8, 0.28],
          [16, 'F3', 8, 0.68], [16, 'C4', 8, 0.44], [16, 'G4', 8, 0.3],
          [24, 'G3', 8, 0.72], [24, 'D4', 8, 0.46], [24, 'A4', 8, 0.3]
        ]
      },
      {
        wave: 'sine',
        volume: 0.045,
        attack: 0.05,
        release: 1.8,
        pan: 0.24,
        notes: [
          [1, 'G5', 1.5, 0.36], [3, 'A5', 1.5, 0.28], [5, 'D5', 1.5, 0.32], [7, 'E5', 1.5, 0.24],
          [9, 'B5', 1.5, 0.38], [11, 'A5', 1.5, 0.26], [13, 'E5', 1.5, 0.3], [15, 'D5', 1.5, 0.24],
          [17, 'A5', 1.5, 0.34], [19, 'G5', 1.5, 0.24], [21, 'D5', 1.5, 0.28], [23, 'C5', 1.5, 0.22],
          [25, 'B5', 1.5, 0.36], [27, 'A5', 1.5, 0.28], [29, 'E5', 1.5, 0.28], [31, 'D5', 1.0, 0.22]
        ]
      },
      {
        wave: 'sine',
        volume: 0.055,
        attack: 0.18,
        release: 1.1,
        pan: 0,
        notes: [
          [0, 'C2', 4, 0.48], [4, 'G2', 4, 0.38], [8, 'A2', 4, 0.44], [12, 'E2', 4, 0.34],
          [16, 'F2', 4, 0.42], [20, 'C2', 4, 0.34], [24, 'G2', 4, 0.46], [28, 'D2', 4, 0.36]
        ]
      }
    ]
  },
  {
    title: 'Fog Over Commons',
    bpm: 62,
    lengthBeats: 32,
    lanes: [
      {
        wave: 'sawtooth',
        volume: 0.045,
        attack: 1.6,
        release: 3.2,
        pan: -0.18,
        notes: [
          [0, 'D4', 8, 0.52], [0, 'A4', 8, 0.34], [0, 'E5', 8, 0.24],
          [8, 'Bb3', 8, 0.48], [8, 'F4', 8, 0.34], [8, 'C5', 8, 0.22],
          [16, 'F4', 8, 0.52], [16, 'C5', 8, 0.36], [16, 'G5', 8, 0.24],
          [24, 'C4', 8, 0.48], [24, 'G4', 8, 0.34], [24, 'D5', 8, 0.22]
        ]
      },
      {
        wave: 'triangle',
        volume: 0.05,
        attack: 0.08,
        release: 1.4,
        pan: 0.28,
        notes: [
          [2, 'A5', 1.5, 0.26], [4, 'G5', 1.5, 0.24], [6, 'F5', 1.5, 0.26],
          [10, 'C6', 1.5, 0.28], [12, 'A5', 1.5, 0.24], [14, 'G5', 1.5, 0.24],
          [18, 'G5', 1.5, 0.26], [20, 'F5', 1.5, 0.22], [22, 'E5', 1.5, 0.22],
          [26, 'D5', 1.5, 0.24], [28, 'G5', 1.5, 0.24], [30, 'A5', 1.0, 0.2]
        ]
      },
      {
        wave: 'sine',
        volume: 0.05,
        attack: 0.14,
        release: 1.6,
        pan: 0,
        notes: [
          [0, 'D2', 4, 0.4], [4, 'A1', 4, 0.32], [8, 'Bb1', 4, 0.36], [12, 'F2', 4, 0.3],
          [16, 'F2', 4, 0.38], [20, 'C2', 4, 0.3], [24, 'C2', 4, 0.36], [28, 'G1', 4, 0.3]
        ]
      }
    ]
  },
  {
    title: 'Starlight Lobby',
    bpm: 74,
    lengthBeats: 32,
    lanes: [
      {
        wave: 'triangle',
        volume: 0.07,
        attack: 1.2,
        release: 2.5,
        pan: -0.2,
        notes: [
          [0, 'E4', 8, 0.56], [0, 'B4', 8, 0.36], [0, 'F#5', 8, 0.24],
          [8, 'C4', 8, 0.5], [8, 'G4', 8, 0.34], [8, 'D5', 8, 0.24],
          [16, 'G3', 8, 0.54], [16, 'D4', 8, 0.36], [16, 'A4', 8, 0.24],
          [24, 'D4', 8, 0.58], [24, 'A4', 8, 0.38], [24, 'E5', 8, 0.24]
        ]
      },
      {
        wave: 'sine',
        volume: 0.04,
        attack: 0.04,
        release: 1.5,
        pan: 0.18,
        notes: [
          [1, 'B5', 1, 0.24], [2.5, 'C6', 1, 0.2], [5, 'A5', 1.5, 0.22], [7, 'G5', 1, 0.2],
          [9, 'D6', 1, 0.24], [10.5, 'C6', 1, 0.2], [13, 'A5', 1.5, 0.22], [15, 'G5', 1, 0.2],
          [17, 'A5', 1, 0.22], [18.5, 'B5', 1, 0.2], [21, 'G5', 1.5, 0.2], [23, 'F#5', 1, 0.2],
          [25, 'E6', 1, 0.24], [26.5, 'D6', 1, 0.2], [29, 'A5', 1.5, 0.22], [31, 'F#5', 0.8, 0.18]
        ]
      },
      {
        wave: 'sine',
        volume: 0.052,
        attack: 0.12,
        release: 1.2,
        pan: 0,
        notes: [
          [0, 'E2', 4, 0.36], [4, 'B1', 4, 0.28], [8, 'C2', 4, 0.32], [12, 'G1', 4, 0.28],
          [16, 'G1', 4, 0.34], [20, 'D2', 4, 0.28], [24, 'D2', 4, 0.36], [28, 'A1', 4, 0.3]
        ]
      }
    ]
  },
  {
    title: 'After Hours Studio',
    bpm: 66,
    lengthBeats: 32,
    lanes: [
      {
        wave: 'triangle',
        volume: 0.075,
        attack: 1.5,
        release: 3.4,
        pan: -0.12,
        notes: [
          [0, 'A3', 8, 0.58], [0, 'E4', 8, 0.38], [0, 'B4', 8, 0.24],
          [8, 'F3', 8, 0.52], [8, 'C4', 8, 0.36], [8, 'G4', 8, 0.22],
          [16, 'C4', 8, 0.56], [16, 'G4', 8, 0.36], [16, 'D5', 8, 0.24],
          [24, 'G3', 8, 0.52], [24, 'D4', 8, 0.36], [24, 'A4', 8, 0.22]
        ]
      },
      {
        wave: 'triangle',
        volume: 0.04,
        attack: 0.05,
        release: 1.7,
        pan: 0.25,
        notes: [
          [2, 'E5', 2, 0.24], [6, 'G5', 2, 0.24], [10, 'C5', 2, 0.22], [14, 'D5', 2, 0.22],
          [18, 'G5', 2, 0.24], [22, 'E5', 2, 0.22], [26, 'A5', 2, 0.22], [30, 'G5', 1.5, 0.18]
        ]
      },
      {
        wave: 'sine',
        volume: 0.05,
        attack: 0.14,
        release: 1.3,
        pan: 0,
        notes: [
          [0, 'A1', 4, 0.36], [4, 'E2', 4, 0.28], [8, 'F2', 4, 0.32], [12, 'C2', 4, 0.28],
          [16, 'C2', 4, 0.34], [20, 'G1', 4, 0.28], [24, 'G1', 4, 0.34], [28, 'D2', 4, 0.28]
        ]
      }
    ]
  }
];

const SOUNDTRACK_STATE = {
  enabled: true,
  isPlaying: false,
  trackIndex: 0,
  nextEventIndex: 0,
  trackStartedAt: 0,
  trackEndTime: 0,
  schedulerId: null,
  transitionId: null,
  activeNodes: new Set(),
  lookAheadSeconds: 0.28,
  schedulerIntervalMs: 90
};

const NOTE_OFFSETS = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11
};

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
  { id: 0, name: "North Hall", x: -17, z: -30, width: 24, depth: 20, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 1, name: "East Studio", x: -14, z: -10, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 2, name: "Open Workshop", x: -11, z: 8, width: 12, depth: 12, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 3, name: "Broadcast Room", x: -14, z: 26, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 4, name: "South Lounge", x: 14, z: -30, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 5, name: "Crit Room", x: 11, z: -12, width: 12, depth: 12, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 6, name: "Screening Room", x: 17, z: 8, width: 24, depth: 20, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
  { id: 7, name: "Commons", x: 14, z: 28, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 }
];

// Room walls definitions for collision checking
// We will generate the walls mathematically based on the room layout.
const WALLS = [];
const PLACED_ASSET_COLLIDERS = [];
const STATIC_SCENERY = [];
const ROOM_INDICATORS = new Map();
const ROOM_SIGN_SPRITES = new Map();
const DEBUG_STATE = {
  enabled: false,
  lastFpsSampleAt: 0,
  framesSinceSample: 0,
  fps: 0
};

const WORLD_ASSET_CATALOG = {
  tree: { label: 'Tree', defaultScale: 1, collidable: true, footprint: 1.2 },
  boulder: { label: 'Boulder', defaultScale: 1, collidable: true, footprint: 1.1 },
  flower: { label: 'Flower', defaultScale: 1, collidable: false, footprint: 0.3 },
  grass_tuft: { label: 'Grass', defaultScale: 1, collidable: false, footprint: 0.35 },
  lantern: { label: 'Lantern', defaultScale: 1, collidable: true, footprint: 0.55 },
  banner: { label: 'Banner', defaultScale: 1, collidable: true, footprint: 0.65 },
  bench: { label: 'Bench', defaultScale: 1, collidable: true, footprint: 1.7 },
  plant: { label: 'Plant', defaultScale: 1, collidable: true, footprint: 0.7 },
  desk: { label: 'Desk', defaultScale: 1, collidable: true, footprint: 1.9 },
  podium: { label: 'Podium', defaultScale: 1, collidable: true, footprint: 1.2 }
};

// --- Game State Variables ---
let scene, camera, renderer, controls;
let placedAssetGroup = null;
let localPlayer = {
  mesh: null,
  body: null,
  leftLeg: null, rightLeg: null,
  leftArm: null, rightArm: null,
  username: "Guest",
  color: "#3b82f6",
  x: 0, y: 0, z: 48, // Start outside the building
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
let animationLoopRunning = false;
let audioCtx = null;
let audioListener = null;
let ambientAudioStarted = false;

// Building fading assets
let ceilingMesh = null;
let ceilingMat = null;
const upperWalls = [];
let upperWallMat = null;
let signFrontMat = null;
let signSideMat = null;
let skyDome = null;
let sceneAmbientLight = null;
let sceneHemisphereLight = null;
let sceneSunLight = null;
const roomSignState = { scheduledRefresh: null };
const roomAudioNodes = new Map();
let debugPanel = null;
let debugStatsEl = null;
let soundtrackCard = null;
let soundtrackTitleEl = null;
let soundtrackStatusEl = null;
let soundtrackToggleBtn = null;
let soundtrackMasterGain = null;
let soundtrackTracks = [];

// Input states
const keys = { w: false, a: false, s: false, d: false, space: false };
const cameraKeys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
let isJoined = false;

// 3D Clickable Objects
const clickableScreens = [];
const clickableRoomMarkers = [];

// Torch list for flickering animation
const torches = [];
const animatedScenery = [];
const placedAssets = new Map();
const editorSelectableObjects = [];
let publishedWorldAssets = [];
const editor = {
  enabled: false,
  authed: false,
  dirty: false,
  selectedId: null,
  placingType: null,
  mode: 'move',
  draftAssets: [],
  transformControls: null,
  transformDragging: false
};

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
    card.dataset.roomId = String(room.id);
    card.tabIndex = 0;

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

function normalizeSoundtrackLibrary() {
  return SOUNDTRACK_LIBRARY.map((track) => ({
    ...track,
    events: track.lanes
      .flatMap((lane) => lane.notes.map(([beat, note, duration, velocity]) => ({
        beat,
        note,
        duration,
        velocity,
        lane
      })))
      .sort((a, b) => a.beat - b.beat)
  }));
}

function noteNameToFrequency(note) {
  const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!match) {
    throw new Error(`Unsupported note: ${note}`);
  }
  const [, pitchClass, octaveRaw] = match;
  const octave = Number.parseInt(octaveRaw, 10);
  const midi = (octave + 1) * 12 + NOTE_OFFSETS[pitchClass];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function beatsToSeconds(beats, bpm) {
  return (60 / bpm) * beats;
}

function updateSoundtrackUi() {
  if (!soundtrackCard || !soundtrackTitleEl || !soundtrackStatusEl || !soundtrackToggleBtn) return;

  const track = soundtrackTracks[SOUNDTRACK_STATE.trackIndex];
  soundtrackTitleEl.textContent = track ? track.title : 'Ambient soundtrack';
  soundtrackStatusEl.textContent = !SOUNDTRACK_STATE.enabled
    ? 'Muted'
    : SOUNDTRACK_STATE.isPlaying
      ? `Playlist active · Track ${SOUNDTRACK_STATE.trackIndex + 1} of ${soundtrackTracks.length}`
      : 'Ready after join';
  soundtrackToggleBtn.textContent = SOUNDTRACK_STATE.enabled ? 'Mute' : 'Unmute';
  soundtrackCard.classList.toggle('muted', !SOUNDTRACK_STATE.enabled);
}

function clearSoundtrackTimers() {
  if (SOUNDTRACK_STATE.schedulerId !== null) {
    window.clearTimeout(SOUNDTRACK_STATE.schedulerId);
    SOUNDTRACK_STATE.schedulerId = null;
  }
  if (SOUNDTRACK_STATE.transitionId !== null) {
    window.clearTimeout(SOUNDTRACK_STATE.transitionId);
    SOUNDTRACK_STATE.transitionId = null;
  }
}

function stopActiveSoundtrackNodes(fadeSeconds = 0.18) {
  if (!audioCtx) return;
  const stopAt = audioCtx.currentTime + fadeSeconds + 0.04;
  SOUNDTRACK_STATE.activeNodes.forEach((entry) => {
    entry.gain.gain.cancelScheduledValues(audioCtx.currentTime);
    entry.gain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, Math.max(fadeSeconds / 3, 0.03));
    try {
      entry.oscillator.stop(stopAt);
    } catch (err) {
      // Oscillators can only be stopped once; ignore redundant stop attempts.
    }
  });
}

function scheduleSoundtrackNote(track, event) {
  if (!audioCtx || !soundtrackMasterGain) return;

  const noteStart = SOUNDTRACK_STATE.trackStartedAt + beatsToSeconds(event.beat, track.bpm);
  const noteDuration = beatsToSeconds(event.duration, track.bpm);
  const lane = event.lane;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const stereoPanner = typeof audioCtx.createStereoPanner === 'function'
    ? audioCtx.createStereoPanner()
    : null;

  oscillator.type = lane.wave;
  oscillator.frequency.setValueAtTime(noteNameToFrequency(event.note), noteStart);

  gain.gain.setValueAtTime(0.0001, noteStart);
  gain.gain.linearRampToValueAtTime(Math.max(lane.volume * event.velocity, 0.0001), noteStart + lane.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration + lane.release);

  oscillator.connect(gain);
  if (stereoPanner) {
    stereoPanner.pan.value = lane.pan || 0;
    gain.connect(stereoPanner);
    stereoPanner.connect(soundtrackMasterGain);
  } else {
    gain.connect(soundtrackMasterGain);
  }

  const nodeRecord = { oscillator, gain };
  SOUNDTRACK_STATE.activeNodes.add(nodeRecord);
  oscillator.onended = () => {
    SOUNDTRACK_STATE.activeNodes.delete(nodeRecord);
    oscillator.disconnect();
    gain.disconnect();
    if (stereoPanner) stereoPanner.disconnect();
  };

  oscillator.start(noteStart);
  oscillator.stop(noteStart + noteDuration + lane.release + 0.05);
}

function queueNextSoundtrackTrack(delaySeconds = 0.4) {
  if (SOUNDTRACK_STATE.transitionId !== null || !SOUNDTRACK_STATE.enabled) return;
  SOUNDTRACK_STATE.transitionId = window.setTimeout(() => {
    SOUNDTRACK_STATE.transitionId = null;
    SOUNDTRACK_STATE.trackIndex = (SOUNDTRACK_STATE.trackIndex + 1) % soundtrackTracks.length;
    startSoundtrackPlayback();
  }, delaySeconds * 1000);
}

function scheduleSoundtrackTick() {
  if (!audioCtx || !SOUNDTRACK_STATE.isPlaying || !SOUNDTRACK_STATE.enabled) return;

  const track = soundtrackTracks[SOUNDTRACK_STATE.trackIndex];
  if (!track) return;

  const lookAheadBeat = Math.max(
    0,
    ((audioCtx.currentTime + SOUNDTRACK_STATE.lookAheadSeconds) - SOUNDTRACK_STATE.trackStartedAt) / (60 / track.bpm)
  );

  while (
    SOUNDTRACK_STATE.nextEventIndex < track.events.length &&
    track.events[SOUNDTRACK_STATE.nextEventIndex].beat < lookAheadBeat
  ) {
    scheduleSoundtrackNote(track, track.events[SOUNDTRACK_STATE.nextEventIndex]);
    SOUNDTRACK_STATE.nextEventIndex += 1;
  }

  if (
    SOUNDTRACK_STATE.nextEventIndex >= track.events.length &&
    audioCtx.currentTime >= SOUNDTRACK_STATE.trackEndTime
  ) {
    SOUNDTRACK_STATE.isPlaying = false;
    updateSoundtrackUi();
    queueNextSoundtrackTrack();
    return;
  }

  SOUNDTRACK_STATE.schedulerId = window.setTimeout(scheduleSoundtrackTick, SOUNDTRACK_STATE.schedulerIntervalMs);
}

function startSoundtrackPlayback() {
  if (!audioCtx || !soundtrackMasterGain || !SOUNDTRACK_STATE.enabled || soundtrackTracks.length === 0) return;

  clearSoundtrackTimers();
  stopActiveSoundtrackNodes(0.08);

  const track = soundtrackTracks[SOUNDTRACK_STATE.trackIndex];
  SOUNDTRACK_STATE.trackStartedAt = audioCtx.currentTime + 0.08;
  SOUNDTRACK_STATE.trackEndTime = SOUNDTRACK_STATE.trackStartedAt + beatsToSeconds(track.lengthBeats, track.bpm);
  SOUNDTRACK_STATE.nextEventIndex = 0;
  SOUNDTRACK_STATE.isPlaying = true;
  soundtrackMasterGain.gain.cancelScheduledValues(audioCtx.currentTime);
  soundtrackMasterGain.gain.setTargetAtTime(0.14, audioCtx.currentTime, 0.2);
  updateSoundtrackUi();
  scheduleSoundtrackTick();
}

function pauseSoundtrackPlayback() {
  if (!audioCtx) return;
  clearSoundtrackTimers();
  SOUNDTRACK_STATE.isPlaying = false;
  if (soundtrackMasterGain) {
    soundtrackMasterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    soundtrackMasterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.08);
  }
  stopActiveSoundtrackNodes(0.14);
  updateSoundtrackUi();
}

function createPanelLabelSprite(title, subtitle = '', accent = '#ffffff') {
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

function registerStaticScenery(object3d, options = {}) {
  STATIC_SCENERY.push({
    object3d,
    kind: options.kind || 'outdoor',
    roomId: options.roomId ?? null,
    distance: options.distance || (options.kind === 'room' ? ROOM_SCENERY_VISIBILITY_DISTANCE : OUTDOOR_SCENERY_VISIBILITY_DISTANCE)
  });
  return object3d;
}

function disposeSprite(sprite) {
  if (!sprite) return;
  if (sprite.material?.map) sprite.material.map.dispose();
  if (sprite.material) sprite.material.dispose();
}

function refreshStaticSceneryVisibility() {
  const currentRoom = localPlayer.currentRoom;
  STATIC_SCENERY.forEach((entry) => {
    if (!entry.object3d) return;
    if (entry.kind === 'room') {
      entry.object3d.visible = currentRoom === entry.roomId;
      return;
    }

    if (!camera) return;
    const distance = camera.position.distanceTo(entry.object3d.position);
    entry.object3d.visible = distance <= entry.distance;
  });
}

function frameIndependentLerp(current, target, dt, decay = 0.001) {
  const factor = 1 - Math.pow(decay, dt);
  return THREE.MathUtils.lerp(current, target, factor);
}

function scheduleRoomVisualRefresh() {
  if (roomSignState.scheduledRefresh !== null) return;
  roomSignState.scheduledRefresh = window.requestAnimationFrame(() => {
    roomSignState.scheduledRefresh = null;
    syncRoomVisuals();
  });
}

function syncRoomVisuals() {
  ROOMS.forEach((room) => {
    const status = getRoomEventStatus(room);
    const marker = ROOM_INDICATORS.get(room.id);
    if (marker) {
      const color = new THREE.Color(WORLD_CONFIG.roomBeaconColors[status.tone] || WORLD_CONFIG.roomBeaconColors.idle);
      if (marker.glow) marker.glow.material.color.copy(color);
      if (marker.glow) marker.glow.material.emissive.copy(color);
      if (marker.ring) marker.ring.material.color.copy(color);
      if (marker.light) marker.light.color.copy(color);
      if (marker.light) {
        marker.light.intensity = status.tone === 'live' ? 0.9 : status.tone === 'upcoming' ? 0.5 : 0.25;
      }
      marker.group.userData.statusTone = status.tone;
    }

    const signSprite = ROOM_SIGN_SPRITES.get(room.id);
    if (signSprite) {
      const nextSubtitle = `${ROOM_LAYOUTS[room.id]?.label || 'Room'} · ${status.label}`;
      if (signSprite.userData.title !== room.name || signSprite.userData.subtitle !== nextSubtitle) {
        const replacement = createPanelLabelSprite(room.name, nextSubtitle, ROOM_LAYOUTS[room.id]?.themeColor || WORLD_CONFIG.signAccent);
        replacement.position.copy(signSprite.position);
        replacement.userData.title = room.name;
        replacement.userData.subtitle = nextSubtitle;
        signSprite.parent.add(replacement);
        signSprite.parent.remove(signSprite);
        disposeSprite(signSprite);
        ROOM_SIGN_SPRITES.set(room.id, replacement);
      }
    }
  });
  updateRoomAudioState();
}

function updateRoomIndicatorAnimations(now) {
  const time = now * 0.001;
  ROOM_INDICATORS.forEach((marker) => {
    if (!marker.group.visible) return;
    const statusTone = marker.group.userData.statusTone || 'idle';
    const pulse = statusTone === 'live'
      ? 1 + Math.sin(time * 3.6 + marker.seed) * 0.08
      : 1 + Math.sin(time * 1.8 + marker.seed) * 0.04;
    marker.ring.scale.setScalar(pulse);
    marker.glow.material.opacity = statusTone === 'live' ? 0.55 + Math.sin(time * 4 + marker.seed) * 0.1 : 0.35;
    marker.group.rotation.y += 0.0025;
  });

  animatedScenery.forEach((item) => {
    if (!item.object.visible) return;
    if (item.type === 'banner') {
      item.object.rotation.z = Math.sin(time * item.speed + item.seed) * item.amplitude;
    } else if (item.type === 'spark') {
      item.object.position.y = item.baseY + Math.sin(time * item.speed + item.seed) * item.amplitude;
    }
  });
}

function initDebugPanel() {
  debugPanel = document.getElementById('debug-panel');
  debugStatsEl = document.getElementById('debug-stats');
}

function initSoundtrackUi() {
  soundtrackCard = document.getElementById('soundtrack-card');
  soundtrackTitleEl = document.getElementById('soundtrack-title');
  soundtrackStatusEl = document.getElementById('soundtrack-status');
  soundtrackToggleBtn = document.getElementById('soundtrack-toggle');
  updateSoundtrackUi();
}

function updateDebugPanel(now) {
  if (!DEBUG_STATE.enabled || !debugPanel || !debugStatsEl) return;

  DEBUG_STATE.framesSinceSample += 1;
  if (!DEBUG_STATE.lastFpsSampleAt) {
    DEBUG_STATE.lastFpsSampleAt = now;
  }
  if (now - DEBUG_STATE.lastFpsSampleAt >= 500) {
    DEBUG_STATE.fps = Math.round((DEBUG_STATE.framesSinceSample * 1000) / (now - DEBUG_STATE.lastFpsSampleAt));
    DEBUG_STATE.framesSinceSample = 0;
    DEBUG_STATE.lastFpsSampleAt = now;
  }

  const visibleScenery = STATIC_SCENERY.reduce((count, entry) => count + (entry.object3d.visible ? 1 : 0), 0);
  const liveRooms = ROOMS.filter((room) => getRoomEventStatus(room).tone === 'live').length;
  debugStatsEl.textContent = `FPS ${DEBUG_STATE.fps || '—'} · Players ${remotePlayers.size + (isJoined ? 1 : 0)} · Visible props ${visibleScenery} / ${STATIC_SCENERY.length} · Live rooms ${liveRooms}`;
  debugPanel.classList.toggle('active', DEBUG_STATE.enabled);
}

function ensureAudioReady() {
  if (audioCtx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  audioCtx = new AudioCtx();
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  if (soundtrackTracks.length === 0) {
    soundtrackTracks = normalizeSoundtrackLibrary();
  }
  soundtrackMasterGain = audioCtx.createGain();
  soundtrackMasterGain.gain.value = 0.0001;
  soundtrackMasterGain.connect(audioCtx.destination);
}

function startAmbientRoomAudio() {
  if (!audioCtx || ambientAudioStarted) return;
  ambientAudioStarted = true;

  ROOMS.forEach((room, index) => {
    const marker = ROOM_INDICATORS.get(room.id);
    if (!marker) return;

    const oscillator = audioCtx.createOscillator();
    oscillator.type = index % 2 === 0 ? 'triangle' : 'sine';
    oscillator.frequency.value = 130 + index * 18;

    const gain = audioCtx.createGain();
    gain.gain.value = 0;

    const panner = audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 5;
    panner.maxDistance = 55;
    panner.rolloffFactor = 1.2;
    panner.positionX.value = marker.group.position.x;
    panner.positionY.value = 2.2;
    panner.positionZ.value = marker.group.position.z;

    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(audioListener.getInput());
    oscillator.start();

    roomAudioNodes.set(room.id, { oscillator, gain, panner });
  });
}

function updateRoomAudioState() {
  if (!audioCtx || !audioListener) return;

  roomAudioNodes.forEach((nodes, roomId) => {
    const room = ROOMS[roomId];
    if (!room) return;
    const status = getRoomEventStatus(room);
    const gainTarget = status.tone === 'live' ? 0.017 : status.tone === 'upcoming' ? 0.009 : 0.0;
    nodes.gain.gain.setTargetAtTime(gainTarget, audioCtx.currentTime, 0.18);
  });
}

async function resumeAudioContext() {
  ensureAudioReady();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (err) {
      console.warn('Unable to resume audio context', err);
    }
  }
  if (audioCtx.state === 'running') {
    startAmbientRoomAudio();
    updateRoomAudioState();
    if (isJoined && SOUNDTRACK_STATE.enabled && !SOUNDTRACK_STATE.isPlaying) {
      startSoundtrackPlayback();
    }
  }
}

// --- Initial Scene Setup ---
function initEngine() {
  const container = document.getElementById('game-container');
  
  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(WORLD_CONFIG.skyBottom);
  scene.fog = new THREE.FogExp2(WORLD_CONFIG.fogColor, 0.012);
  placedAssetGroup = new THREE.Group();
  scene.add(placedAssetGroup);
  
  // 2. Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  // 3. Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // PCF (not PCFSoft) + a 1024 map cuts shadow-pass fill cost ~4x for a stylized
  // low-poly scene where ultra-soft, high-res shadows aren't needed.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  container.appendChild(renderer.domElement);
  
  // 4. Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 35;
  controls.maxPolarAngle = Math.PI / 2.1; // Don't clip below ground

  if (window.THREE && THREE.TransformControls) {
    editor.transformControls = new THREE.TransformControls(camera, renderer.domElement);
    editor.transformControls.setMode(editor.mode);
    editor.transformControls.visible = false;
    editor.transformControls.addEventListener('dragging-changed', (event) => {
      editor.transformDragging = Boolean(event.value);
      controls.enabled = !editor.transformDragging;
    });
    editor.transformControls.addEventListener('objectChange', () => {
      syncSelectedAssetFromObject();
    });
    scene.add(editor.transformControls);
  }
  
  // 5. Lights
  sceneAmbientLight = new THREE.AmbientLight('#cbd5e1', 0.32);
  scene.add(sceneAmbientLight);

  sceneHemisphereLight = new THREE.HemisphereLight('#93c5fd', '#020617', 0.78);
  sceneHemisphereLight.position.set(0, 40, 0);
  scene.add(sceneHemisphereLight);
  
  sceneSunLight = new THREE.DirectionalLight('#dbeafe', 0.92);
  sceneSunLight.position.set(40, 60, 20);
  sceneSunLight.castShadow = true;
  sceneSunLight.shadow.mapSize.width = 1024;
  sceneSunLight.shadow.mapSize.height = 1024;
  sceneSunLight.shadow.camera.near = 0.5;
  sceneSunLight.shadow.camera.far = 150;
  
  const d = 60;
  sceneSunLight.shadow.camera.left = -d;
  sceneSunLight.shadow.camera.right = d;
  sceneSunLight.shadow.camera.top = d;
  sceneSunLight.shadow.camera.bottom = -d;
  sceneSunLight.shadow.bias = -0.0005;
  scene.add(sceneSunLight);

  skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(WORLD_CONFIG.skyTop) },
        bottomColor: { value: new THREE.Color(WORLD_CONFIG.skyBottom) },
        offset: { value: 18 },
        exponent: { value: 0.9 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `
    })
  );
  scene.add(skyDome);
  
  // Build the static map elements
  buildMap();
  refreshStaticSceneryVisibility();
  syncRoomVisuals();
  
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
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
    } while (Math.abs(x) < 32 && Math.abs(z) < 44);
    createFlower(x, z);
  }

  // 4c. Low-Poly Grass Tufts scattered on hills
  for (let i = 0; i < 60; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * (MAP_SIZE - 20);
      z = (Math.random() - 0.5) * (MAP_SIZE - 20);
    } while (Math.abs(x) < 32 && Math.abs(z) < 44);
    createGrassTuft(x, z);
  }

  buildExteriorPlaza();

  // 5. The Metalyceum Building (4x2 rooms grid)
  buildBuilding();
}

// Shared geometries/materials for high-count static scenery. Built once and
// reused across every instance (trees, flowers, grass, torches, boulder skins)
// so we stop allocating duplicate GPU resources for ~160 scattered props.
const sharedScenery = {};
function initSceneryAssets() {
  if (sharedScenery.ready) return;

  // Trees (35)
  sharedScenery.treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  sharedScenery.treeFoliageMat = new THREE.MeshStandardMaterial({ color: '#1e3f20', roughness: 0.8, flatShading: true });
  sharedScenery.treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 5);
  sharedScenery.treeCone1Geo = new THREE.ConeGeometry(2.2, 2.5, 5);
  sharedScenery.treeCone2Geo = new THREE.ConeGeometry(1.7, 2, 5);

  // Boulders (15) — geometry is randomized per rock, but the skin is shared
  sharedScenery.boulderMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true });

  // Flowers (40)
  sharedScenery.flowerStemMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.9 });
  sharedScenery.flowerStemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4);
  sharedScenery.flowerCenterGeo = new THREE.DodecahedronGeometry(0.12, 0);
  const flowerLeafGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
  flowerLeafGeo.rotateX(Math.PI / 4);
  sharedScenery.flowerLeafGeo = flowerLeafGeo;
  // One petal material per palette color (was one per flower)
  sharedScenery.flowerPetalMats = ['#f43f5e', '#eab308', '#3b82f6', '#a855f7'].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })
  );

  // Grass tufts (60)
  sharedScenery.grassTuftMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9, flatShading: true });
  const grassBladeGeo = new THREE.ConeGeometry(0.05, 0.4, 3);
  grassBladeGeo.translate(0, 0.2, 0);
  sharedScenery.grassBladeGeo = grassBladeGeo;

  // Wall torches (16) — PointLight + flame mesh stay per-instance (animated),
  // but all geometries and the static materials are shared.
  sharedScenery.torchBracketGeo = new THREE.BoxGeometry(0.15, 0.4, 0.3);
  sharedScenery.torchMetalMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.8 });
  const torchStickGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.8, 6);
  torchStickGeo.rotateX(Math.PI / 8);
  sharedScenery.torchStickGeo = torchStickGeo;
  sharedScenery.torchWoodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });
  sharedScenery.torchFlameGeo = new THREE.ConeGeometry(0.15, 0.4, 5);
  sharedScenery.torchFlameMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
  sharedScenery.torchParticleGeo = new THREE.SphereGeometry(0.1, 4, 4);
  sharedScenery.torchParticleMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });

  sharedScenery.ready = true;
}

function createTree() {
  initSceneryAssets();
  const tree = new THREE.Group();

  // Trunk
  const trunk = new THREE.Mesh(sharedScenery.treeTrunkGeo, sharedScenery.treeTrunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  tree.add(trunk);

  // Foliage (layers of cones)
  const cone1 = new THREE.Mesh(sharedScenery.treeCone1Geo, sharedScenery.treeFoliageMat);
  cone1.position.y = 4.2;
  cone1.castShadow = true;
  tree.add(cone1);

  const cone2 = new THREE.Mesh(sharedScenery.treeCone2Geo, sharedScenery.treeFoliageMat);
  cone2.position.y = 5.6;
  cone2.castShadow = true;
  tree.add(cone2);

  // Scatter outside the building zone
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - 15);
    z = (Math.random() - 0.5) * (MAP_SIZE - 15);
  } while (Math.abs(x) < 32 && Math.abs(z) < 44);
  
  const groundY = getTerrainHeight(x, z);
  tree.position.set(x, groundY, z);
  
  const scale = 0.85 + Math.random() * 0.45;
  tree.scale.set(scale, scale, scale);
  registerStaticScenery(tree, { kind: 'outdoor' });
  scene.add(tree);
}

function createBoulder() {
  initSceneryAssets();

  // Create randomized low-poly rock geometry (unique per boulder)
  const radius = 1.0 + Math.random() * 1.8;
  const geo = new THREE.DodecahedronGeometry(radius, 0);

  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setX(i, positions.getX(i) + (Math.random() - 0.5) * 0.25);
    positions.setY(i, positions.getY(i) + (Math.random() - 0.5) * 0.25);
    positions.setZ(i, positions.getZ(i) + (Math.random() - 0.5) * 0.25);
  }
  geo.computeVertexNormals();

  const boulder = new THREE.Mesh(geo, sharedScenery.boulderMat);
  
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - 20);
    z = (Math.random() - 0.5) * (MAP_SIZE - 20);
  } while (Math.abs(x) < 32 && Math.abs(z) < 44); // Avoid building area

  const groundY = getTerrainHeight(x, z) - 0.3; // Bury slightly
  boulder.position.set(x, groundY, z);
  boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  boulder.castShadow = true;
  boulder.receiveShadow = true;
  registerStaticScenery(boulder, { kind: 'outdoor', distance: 72 });
  scene.add(boulder);
}

function createFlower(x, z) {
  initSceneryAssets();
  const petalMat = sharedScenery.flowerPetalMats[
    Math.floor(Math.random() * sharedScenery.flowerPetalMats.length)
  ];

  const flower = new THREE.Group();

  // Stem
  const stem = new THREE.Mesh(sharedScenery.flowerStemGeo, sharedScenery.flowerStemMat);
  stem.position.y = 0.25;
  flower.add(stem);

  // Center/Petals
  const center = new THREE.Mesh(sharedScenery.flowerCenterGeo, petalMat);
  center.position.y = 0.5;
  flower.add(center);

  // Small leaves
  const leaf1 = new THREE.Mesh(sharedScenery.flowerLeafGeo, sharedScenery.flowerStemMat);
  leaf1.position.set(0, 0.15, 0.08);
  flower.add(leaf1);

  const groundY = getTerrainHeight(x, z);
  flower.position.set(x, groundY, z);
  
  const scale = 0.8 + Math.random() * 0.4;
  flower.scale.set(scale, scale, scale);
  registerStaticScenery(flower, { kind: 'outdoor', distance: 42 });
  scene.add(flower);
}

function createGrassTuft(x, z) {
  initSceneryAssets();
  const tuft = new THREE.Group();

  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(sharedScenery.grassBladeGeo, sharedScenery.grassTuftMat);
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    blade.rotation.x = (Math.random() - 0.5) * 0.4;
    blade.rotation.y = Math.random() * Math.PI * 2;
    blade.scale.set(1, 0.8 + Math.random() * 0.4, 1);
    tuft.add(blade);
  }
  
  const groundY = getTerrainHeight(x, z);
  tuft.position.set(x, groundY, z);
  registerStaticScenery(tuft, { kind: 'outdoor', distance: 38 });
  scene.add(tuft);
}

function createBannerStand(x, z, rotationY, color) {
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
  animatedScenery.push({
    object: cloth,
    type: 'banner',
    seed: Math.random() * Math.PI * 2,
    speed: 1.2 + Math.random() * 0.5,
    amplitude: 0.06 + Math.random() * 0.03
  });
  scene.add(group);
}

function createGardenLantern(x, z, color = '#60a5fa') {
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
  scene.add(group);
}

function createRoomIndicator(room) {
  const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent, label: 'Room' };
  const group = new THREE.Group();
  
  // Position near the room's corridor entrance
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

  ROOM_INDICATORS.set(room.id, {
    group,
    ring,
    glow,
    light,
    seed: Math.random() * Math.PI * 2
  });
  ROOM_SIGN_SPRITES.set(room.id, sprite);
  clickableRoomMarkers.push(base, ring, glow);

  registerStaticScenery(group, { kind: 'outdoor', distance: 120 });
  scene.add(group);
}

function buildExteriorPlaza() {
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
  scene.add(plaza);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(12, 28), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.03, 54.5);
  path.receiveShadow = true;
  scene.add(path);

  createGardenLantern(-6.5, 48.5, '#38bdf8');
  createGardenLantern(6.5, 48.5, '#38bdf8');
  createGardenLantern(-8, 60, '#8b5cf6');
  createGardenLantern(8, 60, '#8b5cf6');

  createBannerStand(-10.5, 42.5, Math.PI * 0.08, '#38bdf8');
  createBannerStand(10.5, 42.5, -Math.PI * 0.08, '#8b5cf6');
}

function buildRoomInteriorSet(room) {
  const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
  const group = new THREE.Group();
  group.position.set(room.x, 0, room.z);

  // Dynamic rug size
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

  // Dynamic entry strip (aligned along the vertical door frame)
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

  // Benches along the North and South walls facing inward
  const benchMat = new THREE.MeshStandardMaterial({ color: '#3f2a1e', roughness: 0.88 });
  const benchFrameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.78 });
  
  // Custom bench width based on room size
  const benchWidth = room.width > 20 ? 4.0 : (room.width < 15 ? 2.2 : 3.0);
  
  // North bench (facing South)
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

  // South bench (facing North)
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
  benchSouth.rotation.y = Math.PI; // Face North
  group.add(benchSouth);

  // Corner Plant (opposite the entrance/screen areas)
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
  
  // Position plant in the back corner (North-East for left rooms, North-West for right rooms)
  const plantX = room.x < 0 ? room.width / 2 - 1.2 : -room.width / 2 + 1.2;
  plant.position.set(plantX, 0, -room.depth / 2 + 1.2);
  group.add(plant);

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({ color: layout.themeColor })
  );
  spark.position.set(0, 2.25, 0);
  group.add(spark);
  animatedScenery.push({
    object: spark,
    type: 'spark',
    seed: Math.random() * Math.PI * 2,
    speed: 1.8 + Math.random() * 0.4,
    amplitude: 0.22,
    baseY: spark.position.y
  });

  registerStaticScenery(group, { kind: 'room', roomId: room.id });
  scene.add(group);
}

function makePlacedAssetId() {
  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneAssetDef(asset) {
  return {
    id: asset.id,
    type: asset.type,
    x: Number(asset.x) || 0,
    y: Number(asset.y) || 0,
    z: Number(asset.z) || 0,
    rotationY: Number(asset.rotationY) || 0,
    scale: Number(asset.scale) || 1,
    roomId: Number.isInteger(asset.roomId) ? asset.roomId : -1
  };
}

function getRoomIdForPosition(x, z) {
  for (const room of ROOMS) {
    if (
      x >= room.x - room.width / 2 &&
      x <= room.x + room.width / 2 &&
      z >= room.z - room.depth / 2 &&
      z <= room.z + room.depth / 2
    ) {
      return room.id;
    }
  }
  return -1;
}

function getSurfacePointFromPointer(event) {
  if (!camera || !renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  _raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  if (!_raycaster.ray.intersectPlane(plane, point)) return null;
  const roomId = getRoomIdForPosition(point.x, point.z);
  const y = roomId === -1 ? getTerrainHeight(point.x, point.z) : 0;
  return { x: point.x, y, z: point.z, roomId };
}

function createPlacedAssetModel(type) {
  const group = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4f3b', roughness: 0.86 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.78, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 0.15, roughness: 0.55 });

  if (type === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.3, 6), woodMat);
    trunk.position.y = 1.15;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.1, 7), leafMat);
    top.position.y = 2.8;
    const top2 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.55, 7), leafMat);
    top2.position.y = 3.8;
    group.add(trunk, top, top2);
  } else if (type === 'boulder') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), stoneMat);
    rock.scale.set(1.25, 0.72, 0.95);
    rock.position.y = 0.45;
    group.add(rock);
  } else if (type === 'flower') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5), new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.85 }));
    stem.position.y = 0.28;
    const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.75, flatShading: true }));
    bloom.position.y = 0.62;
    group.add(stem, bloom);
  } else if (type === 'grass_tuft') {
    const grassMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.48, 3), grassMat);
      blade.position.y = 0.24;
      blade.rotation.z = (i - 2) * 0.16;
      blade.rotation.y = i * 1.25;
      group.add(blade);
    }
  } else if (type === 'lantern') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), darkMat);
    pole.position.y = 1.1;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.55), darkMat);
    housing.position.y = 2.35;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.42, 0.35), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
    glow.position.y = 2.35;
    group.add(pole, housing, glow, new THREE.PointLight('#38bdf8', 0.45, 7, 2));
  } else if (type === 'banner') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), darkMat);
    pole.position.y = 1.6;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.8), accentMat);
    cloth.position.set(0.65, 2.45, 0);
    cloth.rotation.y = Math.PI / 2;
    group.add(pole, cloth);
  } else if (type === 'bench') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.7), woodMat);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.65, 0.12), woodMat);
    back.position.set(0, 0.95, -0.33);
    group.add(seat, back);
    [-1.1, 1.1].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 5), darkMat);
      leg.position.set(x, 0.25, 0);
      group.add(leg);
    });
  } else if (type === 'plant') {
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.65, 7), stoneMat);
    planter.position.y = 0.32;
    group.add(planter);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 5), leafMat);
      leaf.position.set(Math.cos(i * 1.25) * 0.12, 1.05, Math.sin(i * 1.25) * 0.12);
      leaf.rotation.z = (i - 2) * 0.12;
      group.add(leaf);
    }
  } else if (type === 'desk') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.1), woodMat);
    top.position.y = 0.85;
    group.add(top);
    [-0.95, 0.95].forEach((x) => {
      [-0.38, 0.38].forEach((z) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.8, 5), darkMat);
        leg.position.set(x, 0.4, z);
        group.add(leg);
      });
    });
  } else if (type === 'podium') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.1, 0.9), woodMat);
    base.position.y = 0.55;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.82), woodMat);
    top.position.set(0, 1.2, 0.08);
    top.rotation.x = -Math.PI / 10;
    group.add(base, top);
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

function disposeObjectTree(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}

function clearPlacedAssets() {
  if (!placedAssetGroup) return;
  for (const entry of placedAssets.values()) {
    placedAssetGroup.remove(entry.group);
    disposeObjectTree(entry.group);
  }
  placedAssets.clear();
  editorSelectableObjects.length = 0;
  PLACED_ASSET_COLLIDERS.length = 0;
  if (editor.transformControls) {
    editor.transformControls.detach();
    editor.transformControls.visible = false;
  }
}

function renderPlacedAssets(assetDefs, options = {}) {
  clearPlacedAssets();
  if (!placedAssetGroup) return;
  const applyColliders = options.applyColliders !== false;

  assetDefs.forEach((rawAsset) => {
    const asset = cloneAssetDef(rawAsset);
    if (!WORLD_ASSET_CATALOG[asset.type]) return;
    const group = createPlacedAssetModel(asset.type);
    group.position.set(asset.x, asset.y, asset.z);
    group.rotation.y = asset.rotationY;
    group.scale.setScalar(asset.scale);
    group.userData.assetId = asset.id;
    group.userData.assetType = asset.type;

    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.assetId = asset.id;
        editorSelectableObjects.push(child);
      }
    });

    placedAssetGroup.add(group);
    placedAssets.set(asset.id, { group, asset });

    const catalog = WORLD_ASSET_CATALOG[asset.type];
    if (applyColliders && catalog.collidable) {
      const half = catalog.footprint * asset.scale;
      PLACED_ASSET_COLLIDERS.push({
        assetId: asset.id,
        minX: asset.x - half,
        maxX: asset.x + half,
        minZ: asset.z - half,
        maxZ: asset.z + half
      });
    }
  });

  if (editor.selectedId && placedAssets.has(editor.selectedId)) {
    attachEditorTransform(editor.selectedId);
  } else {
    selectEditorAsset(null);
  }
}

function serializePlacedAssetsFromMap() {
  return Array.from(placedAssets.values()).map(({ asset }) => cloneAssetDef(asset));
}

function getAssetIdFromObject(object) {
  let current = object;
  while (current) {
    if (current.userData && current.userData.assetId) return current.userData.assetId;
    current = current.parent;
  }
  return null;
}

function setEditorDirty(dirty) {
  editor.dirty = dirty;
  const saveBtn = document.getElementById('editor-save-btn');
  if (saveBtn) saveBtn.disabled = !dirty;
  updateEditorStatus();
}

function updateEditorStatus(message) {
  const status = document.getElementById('editor-status-text');
  if (!status) return;
  if (message) {
    status.textContent = message;
  } else if (editor.placingType) {
    status.textContent = `Click the world to place ${WORLD_ASSET_CATALOG[editor.placingType].label}.`;
  } else if (editor.dirty) {
    status.textContent = 'Unsaved world changes.';
  } else {
    status.textContent = 'Select an asset to place or edit.';
  }
}

function updateEditorPalette() {
  document.querySelectorAll('.editor-asset-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.assetType === editor.placingType);
  });
}

function updateEditorInspector() {
  const inspector = document.getElementById('editor-inspector');
  const label = document.getElementById('editor-selection-label');
  if (!inspector || !label) return;
  const entry = editor.selectedId ? placedAssets.get(editor.selectedId) : null;
  inspector.classList.toggle('editor-inspector-empty', !entry);

  if (!entry) {
    label.textContent = 'No asset selected.';
    return;
  }

  const asset = entry.asset;
  const catalog = WORLD_ASSET_CATALOG[asset.type];
  label.textContent = catalog ? catalog.label : asset.type;
  document.getElementById('editor-pos-x').value = asset.x.toFixed(1);
  document.getElementById('editor-pos-y').value = asset.y.toFixed(1);
  document.getElementById('editor-pos-z').value = asset.z.toFixed(1);
  document.getElementById('editor-rot-y').value = String(Math.round(THREE.MathUtils.radToDeg(asset.rotationY)));
  document.getElementById('editor-scale').value = asset.scale.toFixed(2);
  const room = ROOMS[asset.roomId];
  document.getElementById('editor-room-label').textContent = `Scope: ${room ? room.name : 'Outdoor'}`;
}

function attachEditorTransform(assetId) {
  if (!editor.transformControls) return;
  const entry = placedAssets.get(assetId);
  if (!entry) {
    editor.transformControls.detach();
    editor.transformControls.visible = false;
    return;
  }
  editor.transformControls.attach(entry.group);
  editor.transformControls.setMode(editor.mode);
  editor.transformControls.visible = editor.enabled;
}

function selectEditorAsset(assetId) {
  editor.selectedId = assetId;
  attachEditorTransform(assetId);
  updateEditorInspector();
}

function syncSelectedAssetFromObject() {
  if (!editor.selectedId) return;
  const entry = placedAssets.get(editor.selectedId);
  if (!entry) return;
  const roomId = getRoomIdForPosition(entry.group.position.x, entry.group.position.z);
  entry.asset.x = Number(entry.group.position.x.toFixed(3));
  entry.asset.y = Number((roomId === -1 ? getTerrainHeight(entry.group.position.x, entry.group.position.z) : 0).toFixed(3));
  entry.asset.z = Number(entry.group.position.z.toFixed(3));
  entry.asset.roomId = roomId;
  entry.asset.rotationY = Number(entry.group.rotation.y.toFixed(5));
  entry.asset.scale = Number(THREE.MathUtils.clamp(entry.group.scale.x, 0.25, 3).toFixed(3));
  entry.group.position.y = entry.asset.y;
  entry.group.scale.setScalar(entry.asset.scale);
  setEditorDirty(true);
  updateEditorInspector();
}

function placeEditorAsset(type, point) {
  const catalog = WORLD_ASSET_CATALOG[type];
  if (!catalog) return;
  const asset = {
    id: makePlacedAssetId(),
    type,
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3)),
    z: Number(point.z.toFixed(3)),
    rotationY: 0,
    scale: catalog.defaultScale,
    roomId: point.roomId
  };
  const nextAssets = serializePlacedAssetsFromMap().concat(asset);
  renderPlacedAssets(nextAssets, { applyColliders: false });
  selectEditorAsset(asset.id);
  setEditorDirty(true);
}

function handleEditorCanvasClick(event) {
  if (!editor.enabled || editor.transformDragging) return false;

  if (editor.placingType) {
    const point = getSurfacePointFromPointer(event);
    if (point) {
      placeEditorAsset(editor.placingType, point);
      return true;
    }
  }

  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  _raycaster.setFromCamera(mouse, camera);
  const intersects = _raycaster.intersectObjects(editorSelectableObjects, true);
  selectEditorAsset(intersects.length > 0 ? getAssetIdFromObject(intersects[0].object) : null);
  return true;
}

function setEditorEnabled(enabled) {
  editor.enabled = enabled;
  editor.placingType = null;
  const panel = document.getElementById('world-editor-panel');
  if (panel) {
    panel.classList.toggle('active', enabled);
    panel.setAttribute('aria-hidden', enabled ? 'false' : 'true');
  }
  updateEditorPalette();
  updateEditorStatus();
  if (enabled) {
    const roomPanel = document.getElementById('room-panel');
    const roomModal = document.getElementById('video-input-modal');
    if (roomPanel) roomPanel.classList.remove('room-panel-visible');
    if (roomModal) roomModal.classList.remove('video-modal-visible');
    editor.draftAssets = publishedWorldAssets.map(cloneAssetDef);
    renderPlacedAssets(editor.draftAssets, { applyColliders: false });
  } else {
    selectEditorAsset(null);
    setEditorDirty(false);
    renderPlacedAssets(publishedWorldAssets, { applyColliders: true });
  }
}

function applyPublishedWorldAssets(assetDefs) {
  publishedWorldAssets = Array.isArray(assetDefs) ? assetDefs.map(cloneAssetDef) : [];
  if (editor.enabled && editor.dirty) {
    updateEditorStatus('Published layout changed. Save or cancel your draft.');
    return;
  }
  renderPlacedAssets(publishedWorldAssets, { applyColliders: !editor.enabled });
}

function saveWorldAssets() {
  if (!socket || socket.readyState !== WebSocket.OPEN || !editor.authed) {
    updateEditorStatus('Editor is not connected.');
    return;
  }
  socket.send(JSON.stringify({
    type: 'world_assets_save',
    assets: serializePlacedAssetsFromMap()
  }));
  setEditorDirty(false);
  updateEditorStatus('Saving world layout...');
}

function cancelWorldAssetDraft() {
  editor.placingType = null;
  updateEditorPalette();
  setEditorDirty(false);
  renderPlacedAssets(publishedWorldAssets, { applyColliders: false });
  updateEditorStatus('Draft discarded.');
}

function duplicateSelectedAsset() {
  if (!editor.selectedId) return;
  const entry = placedAssets.get(editor.selectedId);
  if (!entry) return;
  const copy = cloneAssetDef(entry.asset);
  copy.id = makePlacedAssetId();
  copy.x = Number((copy.x + 1).toFixed(3));
  copy.z = Number((copy.z + 1).toFixed(3));
  copy.y = copy.roomId === -1 ? Number(getTerrainHeight(copy.x, copy.z).toFixed(3)) : 0;
  const nextAssets = serializePlacedAssetsFromMap().concat(copy);
  renderPlacedAssets(nextAssets, { applyColliders: false });
  selectEditorAsset(copy.id);
  setEditorDirty(true);
}

function deleteSelectedAsset() {
  if (!editor.selectedId) return;
  const nextAssets = serializePlacedAssetsFromMap().filter((asset) => asset.id !== editor.selectedId);
  renderPlacedAssets(nextAssets, { applyColliders: false });
  selectEditorAsset(null);
  setEditorDirty(true);
}

function applyInspectorValues() {
  if (!editor.selectedId) return;
  const entry = placedAssets.get(editor.selectedId);
  if (!entry) return;
  const x = Number.parseFloat(document.getElementById('editor-pos-x').value);
  const y = Number.parseFloat(document.getElementById('editor-pos-y').value);
  const z = Number.parseFloat(document.getElementById('editor-pos-z').value);
  const rot = Number.parseFloat(document.getElementById('editor-rot-y').value);
  const scale = Number.parseFloat(document.getElementById('editor-scale').value);
  if (![x, y, z, rot, scale].every(Number.isFinite)) return;
  entry.asset.x = THREE.MathUtils.clamp(x, -80, 80);
  entry.asset.z = THREE.MathUtils.clamp(z, -80, 80);
  entry.asset.roomId = getRoomIdForPosition(entry.asset.x, entry.asset.z);
  entry.asset.y = entry.asset.roomId === -1 ? THREE.MathUtils.clamp(y, -10, 40) : 0;
  entry.asset.rotationY = THREE.MathUtils.degToRad(rot);
  entry.asset.scale = THREE.MathUtils.clamp(scale, 0.25, 3);
  entry.group.position.set(entry.asset.x, entry.asset.y, entry.asset.z);
  entry.group.rotation.y = entry.asset.rotationY;
  entry.group.scale.setScalar(entry.asset.scale);
  setEditorDirty(true);
  updateEditorInspector();
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
  
  // Helper to create a desk aligned vertically (running along Z)
  function createDesk(dx, dz) {
    const desk = new THREE.Group();
    // Top
    const topGeo = new THREE.BoxGeometry(1.2, 0.1, 3.5);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 1.0;
    top.castShadow = true;
    top.receiveShadow = true;
    desk.add(top);
    
    // Legs at the corners
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 4);
    const legOffsets = [
      { x: -0.5, z: -1.6 },
      { x: 0.5, z: -1.6 },
      { x: -0.5, z: 1.6 },
      { x: 0.5, z: 1.6 }
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
  
  // Helper to create a bench aligned vertically (running along Z)
  function createBench(bx, bz) {
    const bench = new THREE.Group();
    // Seat
    const seatGeo = new THREE.BoxGeometry(0.5, 0.08, 3.0);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.6;
    seat.castShadow = true;
    seat.receiveShadow = true;
    bench.add(seat);
    
    // Legs at corners
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 4);
    const legOffsets = [
      { x: -0.2, z: -1.4 },
      { x: 0.2, z: -1.4 },
      { x: -0.2, z: 1.4 },
      { x: 0.2, z: 1.4 }
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
  
  // Place 3 columns of desks and benches running along Z, in 3 rows along X.
  // Room 6 is 24m wide (X: -12 to 12) and 20m deep (Z: -10 to 10).
  const cols = [-5, 0, 5];
  const rows = [-6, -1, 4]; // Closer to East wall (at X = 12)
  
  rows.forEach(dx => {
    cols.forEach(dz => {
      createDesk(dx, dz);
      createBench(dx - 1.0, dz); // Bench on the West side of the desk so students face East
    });
  });
  
  // Speaker/Teacher's Podium at the front (East side) facing West
  const podiumGroup = new THREE.Group();
  const podiumGeo = new THREE.BoxGeometry(1.2, 1.2, 2.2);
  const podium = new THREE.Mesh(podiumGeo, woodMat);
  podium.position.y = 0.6;
  podium.castShadow = true;
  podium.receiveShadow = true;
  podiumGroup.add(podium);
  
  // Lectern top slanted towards West
  const topGeo = new THREE.BoxGeometry(0.8, 0.1, 1.8);
  topGeo.rotateZ(Math.PI / 8); // Slanted book rest
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.set(-0.1, 1.25, 0);
  podiumGroup.add(top);
  
  podiumGroup.position.set(8.5, 0, 0);
  classroomGroup.add(podiumGroup);
  
  classroomGroup.position.set(17, 0, 8);
  registerStaticScenery(classroomGroup, { kind: 'room', roomId: 6 });
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
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.2, emissive: '#020617', emissiveIntensity: 0.2 });

  // 1. FLOOR PLACEMENT (Dynamic Room Floors & Central Lobby Floor)
  ROOMS.forEach((room) => {
    const isWood = room.id % 2 === 0;
    const mat = isWood ? woodFloorMat : stoneFloorMat;
    const roomFloorGeo = new THREE.PlaneGeometry(room.width, room.depth);
    const roomFloor = new THREE.Mesh(roomFloorGeo, mat);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(room.x, 0.01, room.z);
    roomFloor.receiveShadow = true;
    scene.add(roomFloor);

    buildRoomInteriorSet(room);
  });

  // Central Lobby/Corridor Floor (Stone, 10m x 80m, X: [-5, 5], Z: [-40, 40])
  const lobbyFloorGeo = new THREE.PlaneGeometry(10, 80);
  const lobbyFloor = new THREE.Mesh(lobbyFloorGeo, stoneFloorMat);
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.position.set(0, 0.015, 0); // Slightly raised above ground to prevent z-fighting
  lobbyFloor.receiveShadow = true;
  scene.add(lobbyFloor);

  // Helper function to create wall meshes and register collision bounding boxes
  function addWallSegment(xStart, zStart, xEnd, zEnd, height = ROOM_HEIGHT) {
    const dx = xEnd - xStart;
    const dz = zEnd - zStart;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return; // Skip tiny segments
    const angle = Math.atan2(dz, dx);
    
    const thickness = 0.5;
    const lowerHeight = 3.5;
    const upperHeight = height - lowerHeight;
    
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
    const baseboardMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9 });
    
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

  // Helper to create Doric Columns
  function createDoricColumn(x, z, height) {
    const columnGroup = new THREE.Group();
    columnGroup.position.set(x, 0, z);

    const columnColor = '#f1f5f9'; // Off-white clean marble-like color
    const columnMat = new THREE.MeshStandardMaterial({
      color: columnColor,
      roughness: 0.6,
      metalness: 0.1
    });

    // Doric shaft is tapered (narrower at the top)
    const shaftHeight = height - 0.6;
    const shaftGeo = new THREE.CylinderGeometry(0.3, 0.38, shaftHeight, 16);
    const shaft = new THREE.Mesh(shaftGeo, columnMat);
    shaft.position.y = shaftHeight / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    columnGroup.add(shaft);

    // Doric Capital Echinus (flared cylinder)
    const echinusHeight = 0.3;
    const echinusGeo = new THREE.CylinderGeometry(0.5, 0.3, echinusHeight, 16);
    const echinus = new THREE.Mesh(echinusGeo, columnMat);
    echinus.position.y = shaftHeight + echinusHeight / 2;
    echinus.castShadow = true;
    echinus.receiveShadow = true;
    columnGroup.add(echinus);

    // Doric Capital Abacus (flat square block)
    const abacusHeight = 0.3;
    const abacusGeo = new THREE.BoxGeometry(1.1, abacusHeight, 1.1);
    const abacus = new THREE.Mesh(abacusGeo, columnMat);
    abacus.position.y = shaftHeight + echinusHeight + abacusHeight / 2;
    abacus.castShadow = true;
    abacus.receiveShadow = true;
    columnGroup.add(abacus);

    scene.add(columnGroup);
  }

  // 2. BUILD ROOM WALLS (Outer, Partition, and Corridor-Facing Walls)
  ROOMS.forEach((room) => {
    const xMin = room.x - room.width / 2;
    const xMax = room.x + room.width / 2;
    const zMin = room.z - room.depth / 2;
    const zMax = room.z + room.depth / 2;

    // West outer wall (for Left rooms) or East outer wall (for Right rooms)
    if (room.x < 0) {
      addWallSegment(xMin, zMin, xMin, zMax);
    } else {
      addWallSegment(xMax, zMin, xMax, zMax);
    }

    // North wall (spans from outer edge to corridor)
    addWallSegment(xMin, zMin, xMax, zMin);

    // South wall (spans from outer edge to corridor)
    addWallSegment(xMin, zMax, xMax, zMax);

    // Corridor-Facing wall (at X = -5 or X = 5) with a centered 4m doorway
    const corridorX = room.x < 0 ? -5 : 5;
    addWallSegment(corridorX, zMin, corridorX, room.z - 2);
    addWallSegment(corridorX, room.z + 2, corridorX, zMax);
  });

  // 3. FILL CORRIDOR WALL GAPS (Enclosing the grand lobby corridor where no rooms exist)
  // Left side gaps at X = -5
  addWallSegment(-5, -20, -5, -18);
  addWallSegment(-5, -2, -5, 2);
  addWallSegment(-5, 14, -5, 18);
  addWallSegment(-5, 34, -5, 40);

  // Right side gaps at X = 5
  addWallSegment(5, -40, 5, -38);
  addWallSegment(5, -22, 5, -18);
  addWallSegment(5, -6, 5, -2);
  addWallSegment(5, 18, 5, 20);
  addWallSegment(5, 36, 5, 40);

  // 4. CLOSING BACK WALL & BUILDING THE GRAND FRONT ENTRANCE
  // Close the back of the lobby corridor at Z = -40
  addWallSegment(-5, -40, 5, -40);

  // South grand entrance wall at Z = 40 (leaves a 4m central gap from X: -2 to 2)
  addWallSegment(-5, 40, -2, 40);
  addWallSegment(2, 40, 5, 40);

  // 5. DOOR FRAMES FOR ALL ROOM ENTRANCES AND THE MAIN ENTRANCE
  ROOMS.forEach((room) => {
    const corridorX = room.x < 0 ? -5 : 5;
    createDoorFrame(corridorX, room.z, 'V', 4);
  });

  // Front entrance door frame
  createDoorFrame(0, 40, 'H', 4);

  // 6. COLONNADE PLACEMENT (Doric Columns inside the Lobby & Front Portico)
  const colsZ = [-35, -25, -15, -5, 5, 15, 25, 35];
  
  // Left lobby colonnade (at X = -4.2)
  colsZ.forEach(cz => createDoricColumn(-4.2, cz, ROOM_HEIGHT));

  // Right lobby colonnade (at X = 4.2)
  colsZ.forEach(cz => createDoricColumn(4.2, cz, ROOM_HEIGHT));

  // Front entrance portico (4 Doric columns standing in front at Z = 40.8)
  createDoricColumn(-3.5, 40.8, ROOM_HEIGHT);
  createDoricColumn(-1.5, 40.8, ROOM_HEIGHT);
  createDoricColumn(1.5, 40.8, ROOM_HEIGHT);
  createDoricColumn(3.5, 40.8, ROOM_HEIGHT);

  // 7. EMBEDDED SCREENS & WALL MOUNTED TORCHES IN ROOMS
  ROOMS.forEach((room) => {
    const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
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

    const borderMat = new THREE.MeshBasicMaterial({ color: layout.themeColor, wireframe: true });
    const screenBorder = new THREE.Mesh(innerGeo, borderMat);
    screenBorder.position.z = 0.11;
    screenBorder.scale.set(1.02, 1.02, 1.02);
    screenGroup.add(screenBorder);
    
    // Position screen on the far wall (West for left rooms, East for right rooms)
    if (room.x < 0) {
      // Left room: West wall, facing East
      const xPos = room.x - room.width / 2 + 0.15;
      screenGroup.position.set(xPos, 3.5, room.z);
      screenGroup.rotation.y = Math.PI / 2;
      scene.add(screenGroup);
      
      // Flanking wall torches
      createWallTorch(room.x - room.width / 2 + 0.25, 2.5, room.z - 4, Math.PI / 2, room.id, true);
      createWallTorch(room.x - room.width / 2 + 0.25, 2.5, room.z + 4, Math.PI / 2, room.id, false);
    } else {
      // Right room: East wall, facing West
      const xPos = room.x + room.width / 2 - 0.15;
      screenGroup.position.set(xPos, 3.5, room.z);
      screenGroup.rotation.y = -Math.PI / 2;
      scene.add(screenGroup);
      
      // Flanking wall torches
      createWallTorch(room.x + room.width / 2 - 0.25, 2.5, room.z - 4, -Math.PI / 2, room.id, true);
      createWallTorch(room.x + room.width / 2 - 0.25, 2.5, room.z + 4, -Math.PI / 2, room.id, false);
    }
    
    createRoomIndicator(room);
  });

  // 8. CEILING / ROOF PLACEMENT (Fades out when player is indoors)
  ceilingMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9, transparent: true, opacity: 1.0 });
  const ceilingGeo = new THREE.BoxGeometry(60, 0.2, 80); // Covered bounds (X: [-30, 30], Z: [-40, 40])
  ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceilingMesh.position.set(0, ROOM_HEIGHT + 0.1, 0);
  ceilingMesh.castShadow = true;
  ceilingMesh.receiveShadow = true;
  scene.add(ceilingMesh);

  // 9. CLASSROOM ASSETS (Benches and desks in Room 6)
  buildClassroomAssets();

  // 10. EXTERIOR SIGN BOARD (Metalyceum & Canada Council)
  const signTex = createSignBoardTexture();
  signFrontMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, transparent: true, opacity: 1.0 });
  signSideMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8, transparent: true, opacity: 1.0 });
  
  const signMaterials = [signSideMat, signSideMat, signSideMat, signSideMat, signFrontMat, signSideMat];
  const signGeo = new THREE.BoxGeometry(10.5, 1.4, 0.1);
  const signMesh = new THREE.Mesh(signGeo, signMaterials);
  
  // Position right above entrance on the South upper wall (Z: 40)
  signMesh.position.set(0, 4.4, 40.3);
  signMesh.castShadow = true;
  signMesh.receiveShadow = true;
  scene.add(signMesh);
  upperWalls.push(signMesh);
}

function createWallTorch(x, y, z, rotationY, roomId = null, withLight = true) {
  initSceneryAssets();
  const torchGroup = new THREE.Group();

  // Bracket
  const bracket = new THREE.Mesh(sharedScenery.torchBracketGeo, sharedScenery.torchMetalMat);
  bracket.position.set(0, 0, -0.15);
  torchGroup.add(bracket);

  // Wooden stick
  const stick = new THREE.Mesh(sharedScenery.torchStickGeo, sharedScenery.torchWoodMat);
  stick.position.set(0, 0.1, -0.05);
  torchGroup.add(stick);

  // Flame glow shape (per-instance mesh; shared geo/mat)
  const flame = new THREE.Mesh(sharedScenery.torchFlameGeo, sharedScenery.torchFlameMat);
  flame.position.set(0, 0.55, 0.1);
  torchGroup.add(flame);

  // Particle representation for flame (small glowing sphere)
  const particle = new THREE.Mesh(sharedScenery.torchParticleGeo, sharedScenery.torchParticleMat);
  particle.position.set(0, 0.65, 0.1);
  torchGroup.add(particle);

  // Dynamic Point Light (flickering source). Every PBR fragment evaluates every
  // point light, so we light one torch per room (8 total) rather than all 16;
  // the unlit torches keep their emissive flame glow. A slightly higher
  // intensity/range compensates for the lit torch covering the whole room.
  let light = null;
  if (withLight) {
    light = new THREE.PointLight('#f97316', 1.1, 11);
    light.position.set(0, 0.7, 0.15);
    light.castShadow = false;
    torchGroup.add(light);
  }

  torchGroup.position.set(x, y, z);
  torchGroup.rotation.y = rotationY;

  if (roomId !== null) {
    registerStaticScenery(torchGroup, { kind: 'room', roomId });
  }
  scene.add(torchGroup);

  // Track flame mesh (always) and light (when present) for the flicker animation
  torches.push({
    light,
    flame,
    baseIntensity: light ? light.intensity : 0,
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

  for (const collider of PLACED_ASSET_COLLIDERS) {
    if (targetX >= collider.minX && targetX <= collider.maxX &&
        targetZ >= collider.minZ && targetZ <= collider.maxZ) {
      return true;
    }
  }

  return false;
}

// Reusable scratch vectors for per-frame movement math (avoids ~7 allocations
// per frame and the resulting GC churn). Each is fully overwritten or reset
// before use below.
const _oldPos = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _desiredCameraPos = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _projectedLabelPos = new THREE.Vector3();

function updateLocalPlayer(dt) {
  if (!isJoined || !localPlayer.mesh) return;
  if (editor.enabled) {
    localPlayer.isMoving = false;
    localPlayer.velocity.x = 0;
    localPlayer.velocity.z = 0;
    animateAvatarWalk(localPlayer, dt);
    return;
  }

  const oldPos = _oldPos.copy(localPlayer.mesh.position);

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
  const moveDirection = _moveDir.set(0, 0, 0);

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
    const camDirection = _camDir;
    camera.getWorldDirection(camDirection);
    camDirection.y = 0;
    camDirection.normalize();

    // Camera right vector
    const camRight = _camRight;
    camRight.crossVectors(camera.up, camDirection).negate().normalize();

    // Find absolute target moving direction
    const targetDirection = _targetDir.set(0, 0, 0)
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
  
  // Update controls target and camera follow with a small amount of smoothing so
  // the player still feels anchored while camera movement is less abrupt.
  const delta = _delta.subVectors(localPlayer.mesh.position, oldPos);
  _desiredCameraPos.copy(camera.position).add(delta);
  camera.position.lerp(_desiredCameraPos, CAMERA_FOLLOW_LERP);
  controls.target.x = frameIndependentLerp(controls.target.x, localPlayer.mesh.position.x, dt, 0.0009);
  controls.target.y = frameIndependentLerp(controls.target.y, localPlayer.mesh.position.y + 1.2, dt, 0.0009);
  controls.target.z = frameIndependentLerp(controls.target.z, localPlayer.mesh.position.z, dt, 0.0009);

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
    const minX = rx - room.width / 2;
    const maxX = rx + room.width / 2;
    const minZ = rz - room.depth / 2;
    const maxZ = rz + room.depth / 2;

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
          scheduleRoomVisualRefresh();
          applyPublishedWorldAssets(data.worldAssets || []);

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

        case "editor_auth": {
          editor.authed = Boolean(data.ok);
          const authPanel = document.getElementById('editor-auth-panel');
          const authStatus = document.getElementById('editor-auth-status');
          if (authStatus) {
            authStatus.textContent = editor.authed ? 'Editor unlocked.' : 'Invalid editor token.';
          }
          if (editor.authed) {
            if (authPanel) authPanel.classList.remove('active');
            setEditorEnabled(true);
          }
          break;
        }

        case "world_assets_update":
          applyPublishedWorldAssets(data.assets || []);
          if (editor.enabled && !editor.dirty) {
            updateEditorStatus('World layout saved.');
          }
          break;

        case "error":
          if (typeof data.reason === 'string') {
            addChatLog('System', data.reason, 'system-msg');
            if (editor.enabled) updateEditorStatus(data.reason);
          }
          break;

        case "room_update": {
          const rIdx = Number.isInteger(data.room?.roomId) ? data.room.roomId : data.roomId;
          applyRoomData(rIdx, data.room || data);
          renderEventBoard();
          scheduleRoomVisualRefresh();
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
          scheduleRoomVisualRefresh();
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
  
  // 2. Animate Torches (Point light flickering & flame wiggling)
  const time = now * 0.005;
  torches.forEach((t) => {
    const flicker = Math.sin(time * 3 + t.seed) * Math.cos(time * 7 + t.seed) * 0.15;
    if (t.light) t.light.intensity = t.baseIntensity + flicker;
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
    const lerpSpeed = 1 - Math.pow(REMOTE_PLAYER_SMOOTHING, dt);
    
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

    const horizontalDistance = camera.position.distanceTo(p.mesh.position);
    p.mesh.visible = horizontalDistance < 95;
    if (p.nameTag) {
      p.nameTag.visible = horizontalDistance < 42;
    }
  });

  updateRoomIndicatorAnimations(now);
  refreshStaticSceneryVisibility();
  
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

  if (sceneSunLight) {
    sceneSunLight.intensity = localPlayer.currentRoom === -1 ? 0.92 : 0.62;
  }
  if (sceneHemisphereLight) {
    sceneHemisphereLight.intensity = localPlayer.currentRoom === -1 ? 0.78 : 0.55;
  }

  controls.update();
  updateDebugPanel(now);

  // 5. Render Scene
  renderer.render(scene, camera);
}

function startAnimationLoop() {
  if (!renderer || animationLoopRunning) return;
  lastTime = performance.now();
  renderer.setAnimationLoop(animate);
  animationLoopRunning = true;
}

function stopAnimationLoop() {
  if (!renderer || !animationLoopRunning) return;
  renderer.setAnimationLoop(null);
  animationLoopRunning = false;
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

function focusRoomFromLobbyMarker(roomId) {
  const room = ROOMS[roomId];
  if (!room || !localPlayer.mesh) return;

  localPlayer.x = room.x;
  localPlayer.z = room.z + (room.z < 0 ? 5.2 : -5.2);
  localPlayer.y = getTerrainHeight(localPlayer.x, localPlayer.z);
  localPlayer.velocity.set(0, 0, 0);
  localPlayer.mesh.position.set(localPlayer.x, localPlayer.y, localPlayer.z);
  controls.target.set(room.x, 1.4, room.z);
  addChatLog('System', `Moved closer to ${room.name}.`, 'system-msg');
  detectRoomEntry();
  syncPosition();
}

function onCanvasClick(event) {
  if (handleEditorCanvasClick(event)) {
    return;
  }

  // Calculate mouse position in normalized device coordinates
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  _raycaster.setFromCamera(mouse, camera);

  if (localPlayer.currentRoom === -1) {
    const markerIntersects = _raycaster.intersectObjects(clickableRoomMarkers);
    if (markerIntersects.length > 0) {
      const targetRoom = markerIntersects[0].object.userData?.roomId;
      if (targetRoom !== undefined) {
        focusRoomFromLobbyMarker(targetRoom);
        return;
      }
    }
    return;
  }

  const intersects = _raycaster.intersectObjects(clickableScreens);
  
  if (intersects.length > 0) {
    const clickedScreen = intersects[0].object;
    if (clickedScreen.userData && clickedScreen.userData.roomId !== undefined) {
      openTheaterMode(clickedScreen.userData.roomId);
    }
  }
}

function initEditorUiHandlers() {
  const palette = document.getElementById('editor-asset-palette');
  if (palette) {
    palette.innerHTML = '';
    Object.entries(WORLD_ASSET_CATALOG).forEach(([type, config]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'editor-asset-btn';
      btn.dataset.assetType = type;
      btn.textContent = config.label;
      btn.addEventListener('click', () => {
        if (!editor.enabled) return;
        editor.placingType = editor.placingType === type ? null : type;
        updateEditorPalette();
        updateEditorStatus();
      });
      palette.appendChild(btn);
    });
  }

  const toggleBtn = document.getElementById('editor-toggle-btn');
  const authPanel = document.getElementById('editor-auth-panel');
  const authForm = document.getElementById('editor-auth-panel');
  const authInput = document.getElementById('editor-token-input');
  const authStatus = document.getElementById('editor-auth-status');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (editor.authed) {
        setEditorEnabled(!editor.enabled);
      } else if (authPanel) {
        authPanel.classList.toggle('active');
        if (authInput) authInput.focus();
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        if (authStatus) authStatus.textContent = 'Connect to Metalyceum before unlocking the editor.';
        return;
      }
      socket.send(JSON.stringify({
        type: 'editor_auth',
        token: authInput ? authInput.value : ''
      }));
      if (authStatus) authStatus.textContent = 'Checking token...';
    });
  }

  const exitBtn = document.getElementById('editor-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => setEditorEnabled(false));
  }

  document.querySelectorAll('.editor-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editor.mode = btn.dataset.editorMode || 'move';
      document.querySelectorAll('.editor-mode-btn').forEach((modeBtn) => {
        modeBtn.classList.toggle('active', modeBtn === btn);
      });
      if (editor.transformControls) {
        editor.transformControls.setMode(editor.mode);
      }
    });
  });

  ['editor-pos-x', 'editor-pos-y', 'editor-pos-z', 'editor-rot-y', 'editor-scale'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', applyInspectorValues);
    }
  });

  const duplicateBtn = document.getElementById('editor-duplicate-btn');
  if (duplicateBtn) duplicateBtn.addEventListener('click', duplicateSelectedAsset);

  const deleteBtn = document.getElementById('editor-delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedAsset);

  const cancelBtn = document.getElementById('editor-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelWorldAssetDraft);

  const saveBtn = document.getElementById('editor-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveWorldAssets);
}

// --- Form & UI Handle Bindings ---
function initUiHandlers() {
  initEditorUiHandlers();

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
    resumeAudioContext();
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

  document.getElementById('event-board-list').addEventListener('click', (e) => {
    const card = e.target.closest('.event-board-item');
    if (!card) return;
    const roomId = Number.parseInt(card.dataset.roomId || '', 10);
    if (Number.isNaN(roomId)) return;
    focusRoomFromLobbyMarker(roomId);
  });

  document.getElementById('event-board-list').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.event-board-item');
    if (!card) return;
    e.preventDefault();
    const roomId = Number.parseInt(card.dataset.roomId || '', 10);
    if (!Number.isNaN(roomId)) {
      focusRoomFromLobbyMarker(roomId);
    }
  });

  document.getElementById('soundtrack-toggle').addEventListener('click', async () => {
    SOUNDTRACK_STATE.enabled = !SOUNDTRACK_STATE.enabled;
    if (!SOUNDTRACK_STATE.enabled) {
      pauseSoundtrackPlayback();
      updateSoundtrackUi();
      return;
    }
    updateSoundtrackUi();
    await resumeAudioContext();
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
    if (editor.enabled && e.key !== 'Escape') return;
    
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
    if (e.key === '`') {
      DEBUG_STATE.enabled = !DEBUG_STATE.enabled;
      if (debugPanel) {
        debugPanel.classList.toggle('active', DEBUG_STATE.enabled);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (editor.enabled) {
      keys.w = false;
      keys.a = false;
      keys.s = false;
      keys.d = false;
      keys.space = false;
      cameraKeys.ArrowLeft = false;
      cameraKeys.ArrowRight = false;
      cameraKeys.ArrowUp = false;
      cameraKeys.ArrowDown = false;
      return;
    }
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

  window.addEventListener('pointerdown', () => {
    if (isJoined) {
      resumeAudioContext();
    }
  });
  
  // Focus helper: pressing ESC defocuses inputs and exits theater mode
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (editor.enabled) {
        if (editor.placingType) {
          editor.placingType = null;
          updateEditorPalette();
          updateEditorStatus();
        } else {
          selectEditorAsset(null);
        }
      }
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
      stopAnimationLoop();
      pauseSoundtrackPlayback();
      if (ytPlayer && ytPlayer.pauseVideo) {
        try { ytPlayer.pauseVideo(); } catch (e) {}
      }
      if (boardYtPlayer && boardYtPlayer.pauseVideo) {
        try { boardYtPlayer.pauseVideo(); } catch (e) {}
      }
      return;
    }
    startAnimationLoop();
    if (localPlayer.currentRoom !== -1) {
      setupRoomVideo(localPlayer.currentRoom);
    }
    if (isJoined) {
      resumeAudioContext();
    }
  });

  const gameContainer = document.getElementById('game-container');
  gameContainer.style.contentVisibility = 'auto';
  gameContainer.style.containIntrinsicSize = 'auto none auto 100vh';
}

// --- App Entry Point ---
window.addEventListener('DOMContentLoaded', () => {
  soundtrackTracks = normalizeSoundtrackLibrary();
  initEngine();
  initDebugPanel();
  initSoundtrackUi();
  initUiHandlers();
  initPerformanceOptimization();
  renderEventBoard();
  roomStatusTimer = window.setInterval(() => {
    renderEventBoard();
    scheduleRoomVisualRefresh();
    if (localPlayer.currentRoom !== -1) {
      updateRoomPanelDetails();
    }
  }, 30000);
  
  // Kickstart animation loop (WebGL updates)
  startAnimationLoop();
});
