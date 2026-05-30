// Shared Game State Object for Metalyceum

export const state = {
  // --- Three.js & Engine Variables ---
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  placedAssetGroup: null,
  ceilingMesh: null,
  ceilingMat: null,
  upperWalls: [],
  upperWallMat: null,
  signFrontMat: null,
  signSideMat: null,
  skyDome: null,
  sceneAmbientLight: null,
  sceneHemisphereLight: null,
  sceneSunLight: null,
  lastTime: 0,

  // --- Scenery & Assets Cache ---
  sharedScenery: {},
  torches: [],
  animatedScenery: [],
  placedAssets: new Map(), // id -> asset definition
  editorSelectableObjects: [],
  publishedWorldAssets: [],
  ROOM_INDICATORS: new Map(),
  ROOM_SIGN_SPRITES: new Map(),
  STATIC_SCENERY: [],
  WALLS: [],
  PLACED_ASSET_COLLIDERS: [],
  clickableScreens: [],
  clickableRoomMarkers: [],

  // --- Players & Game State ---
  isJoined: false,
  localPlayer: {
    id: null,
    mesh: null,
    body: null,
    leftLeg: null,
    rightLeg: null,
    leftArm: null,
    rightArm: null,
    username: "Guest",
    color: "#3b82f6",
    x: 0,
    y: 0,
    z: 48, // Start outside the building
    ry: 0,
    isMoving: false,
    velocity: null, // will be initialized to Vector3 in engine
    isGrounded: true,
    currentRoom: -1
  },
  remotePlayers: new Map(), // id -> player metadata + mesh
  npcs: [], // Ambient simulated NPCs

  // --- Input States ---
  keys: { w: false, a: false, s: false, d: false, space: false },
  cameraKeys: { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false },

  // --- Audio Context & Synth State ---
  audioCtx: null,
  audioListener: null,
  ambientAudioStarted: false,
  soundtrackMasterGain: null,
  soundtrackTracks: [],
  roomAudioNodes: new Map(),

  // --- Network & Video Feed API Variables ---
  socket: null,
  ytPlayer: null,
  boardYtPlayer: null, // YouTube player for classroom blackboard
  ytApiReady: false,
  activeRoomVideoId: "",
  roomStatusTimer: null,
  lastSentPosition: { x: 0, y: 0, z: 0, ry: 0, isMoving: false },
  animationLoopRunning: false,

  // --- Room Sign Scheduling State ---
  roomSignState: { scheduledRefresh: null },

  // --- UI Elements & Debug Panel ---
  debugPanel: null,
  debugStatsEl: null,
  soundtrackCard: null,
  soundtrackTitleEl: null,
  soundtrackStatusEl: null,
  soundtrackToggleBtn: null,
  DEBUG_STATE: {
    enabled: false,
    lastFpsSampleAt: 0,
    framesSinceSample: 0,
    fps: 0
  },

  // --- Editor State ---
  editor: {
    enabled: false,
    authed: false,
    dirty: false,
    selectedId: null,
    placingType: null,
    mode: 'move', // 'move' | 'rotate' | 'scale'
    draftAssets: [],
    transformControls: null,
    transformDragging: false
  },

  // --- Room Definitions ---
  ROOMS: [
    { id: 0, name: "North Hall", x: -17, z: -30, width: 24, depth: 20, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    { id: 1, name: "East Studio", x: -14, z: -10, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    { id: 2, name: "Open Workshop", x: -11, z: 8, width: 12, depth: 12, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    { id: 3, name: "Broadcast Room", x: -14, z: 26, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    { id: 4, name: "South Lounge", x: 14, z: -30, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    { id: 5, name: "Crit Room", x: 11, z: -12, width: 12, depth: 12, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    { id: 6, name: "Screening Room", x: 17, z: 8, width: 24, depth: 20, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    { id: 7, name: "Commons", x: 14, z: 28, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 }
  ]
};
