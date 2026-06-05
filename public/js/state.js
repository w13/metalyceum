// Shared Game State Object for Metalyceum

export const state = {
  // --- Three.js & Engine Variables ---
  /** @type {any} */
  scene: null,
  /** @type {any} */
  camera: null,
  /** @type {any} */
  renderer: null,
  /** @type {any} */
  controls: null,
  placedAssetGroup: null,
  ceilingMesh: null,
  ceilingMat: null,
  upperWalls: [],
  roofMeshes: [],
  upperWallMat: null,
  signFrontMat: null,
  signSideMat: null,
  /** @type {any} */
  skyDome: null,
  sceneAmbientLight: null,
  sceneHemisphereLight: null,
  sceneSunLight: null,
  sceneIndoorLight: null,
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
  /** @type {Map<string, any>} */
  landmarkGroups: new Map(),
  /** Per-building fade registry for roofs, upper stories, and basements. */
  fadeZones: [],
  /** Second-floor meshes — faded only when player is on the ground floor. */
  upperFloor: [],
  /** @type {any[]} */
  WALLS: [],
  /** @type {any[]} */
  PLACED_ASSET_COLLIDERS: [],
  clickableScreens: [],
  clickableRoomMarkers: [],
  roomScreens: new Map(),

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
    z: 44, // Start outside the building, clear of the front plaza props
    ry: 0,
    isMoving: false,
    velocity: null, // will be initialized to Vector3 in engine
    displayVelocity: null, // post-collision XZ velocity for animation/rotation only
    isGrounded: true,
    flying: false,
    currentRoom: -1
  },
  remotePlayers: new Map(), // id -> player metadata + mesh
  npcs: [], // Ambient simulated NPCs

  // --- Input States ---
  keys: { w: false, a: false, s: false, d: false, space: false, shift: false, t: false, y: false },
  cameraKeys: { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false },
  cameraRig: {
    followYaw: Math.PI,
    desiredYaw: Math.PI,
    lastManualInputAt: 0,
    manualControlActive: false,
    lastPlayerMoving: false,
    movementStartedAt: 0,
    wasUnderRoof: false,
    exitWatchUntil: 0
  },

  // --- Audio Context & Synth State ---
  audioCtx: null,
  audioListener: null,
  ambientAudioStarted: false,
  soundtrackMasterGain: null,
  soundtrackTracks: [],
  roomAudioNodes: new Map(),

  // --- Network & Video Feed API Variables ---
  socket: null,
  disconnectedPlayerIds: new Set(),
  lastHeartbeatAck: 0,
  chat: {
    sendScope: 'global',
    filter: 'all',
    renderedMessageIds: new Set(),
    renderedMessageOrder: []
  },
  ytPlayer: null,
  boardYtPlayer: null, // YouTube player for classroom blackboard
  ytApiReady: false,
  activeRoomVideoId: "",
  _theaterMovedIframeSource: null, // container ID of iframe moved into theater modal
  roomStatusTimer: null,
  roomMediaState: {
    pendingSyncTimer: null,
    pendingRoomId: -2,
    activeRoomId: -2,
    activeSourceKey: '',
    activeSourceType: 'none',
    roomPanelLoadTimer: null,
    roomPanelLoadToken: 0,
    boardLoadTimer: null,
    boardLoadToken: 0
  },
  lastSentPosition: { x: 0, y: 0, z: 0, ry: 0, isMoving: false },
  animationLoopRunning: false,

  // --- Room Sign Scheduling State ---
  roomSignState: { scheduledRefresh: null, pendingSpriteUpdates: [], spriteRefreshScheduled: false },

  // --- Room UI Scheduling State ---
  roomUiState: {
    eventBoardScheduled: false,
    roomPlayersScheduled: false
  },

  // --- UI Elements & Debug Panel ---
  debugPanel: null,
  debugPlayerPosEl: null,
  debugCameraPosEl: null,
  debugCameraDirEl: null,
  debugFpsValEl: null,
  debugPlayersValEl: null,
  debugPropsValEl: null,
  debugRoomsValEl: null,
  debugErrorEl: null,
  soundtrackCard: null,
  soundtrackTitleEl: null,
  soundtrackStatusEl: null,
  soundtrackPlayPauseBtn: null,
  soundtrackPrevBtn: null,
  soundtrackNextBtn: null,
  soundtrackTracklistEl: null,
  // --- Room Panel Cached DOM Elements ---
  roomPanelEl: null,
  roomTitleEl: null,
  roomStatusBadgeEl: null,
  roomStatusTextEl: null,
  roomPlayersListEl: null,
  roomCapacityEl: null,
  musicIconBtn: null,
  DEBUG_STATE: {
    enabled: false,
    lastFpsSampleAt: 0,
    framesSinceSample: 0,
    fps: 0
  },
  errorLog: [], // ring buffer: { ts, type, msg, stack? }

  // --- Soundtrack Runtime State ---
  soundtrackState: {
    enabled: true,
    isPlaying: false,
    suppressedByRoomMedia: false,
    previousEnabled: true,
    previousPlaying: false,
    trackIndex: 0,
    nextEventIndex: 0,
    trackStartedAt: 0,
    trackEndTime: 0,
    resumeTrackIndex: null,
    resumeBeatOffset: null,
    schedulerId: null,
    transitionId: null,
    activeNodes: new Set(),
    masterVolume: 1.4,
    pendingStartDelaySeconds: 0,
    pendingFadeInSeconds: 0.7,
    lookAheadSeconds: 0.28,
    schedulerIntervalMs: 90
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
    { id: 7, name: "Commons", x: 14, z: 28, width: 18, depth: 16, video: "", sourceValue: "", sourceType: "none", startTime: null, durationMinutes: 0, updatedAt: 0 },
    {
      id: 8,
      name: "Outdoor Amphitheater",
      x: 65,
      z: 150,
      width: 40,
      depth: 36,
      bounds: { minX: 39, maxX: 91, minZ: 131, maxZ: 171 },
      video: "",
      sourceValue: "",
      sourceType: "none",
      startTime: null,
      durationMinutes: 0,
      updatedAt: 0
    },
    {
      id: 9,
      name: "Concert Venue",
      x: -85,
      z: 140,
      width: 46,
      depth: 34,
      bounds: { minX: -108.5, maxX: -60.5, minZ: 122, maxZ: 158 },
      video: "",
      sourceValue: "",
      sourceType: "none",
      startTime: null,
      durationMinutes: 0,
      updatedAt: 0
    },
    {
      id: 10,
      name: "Upper Gallery",
      x: 17.5,
      z: 8,
      width: 25,
      depth: 30,
      floor: 2,
      video: "",
      sourceValue: "",
      sourceType: "none",
      startTime: null,
      durationMinutes: 0,
      updatedAt: 0
    }
  ]
};
