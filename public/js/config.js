// Configuration Constants for Metalyceum

export const ROOM_WIDTH = 20;
export const ROOM_DEPTH = 20;
export const ROOM_HEIGHT = 5.5;
export const MAP_SIZE = 600; // Size of the grassy area
export const ROOM_LABEL_HEIGHT = 5.1;
export const CAMERA_FOLLOW_LERP = 1 - 0.00035 ** (1 / 60);
export const CAMERA_DEFAULT_DISTANCE = 14.25;
export const CAMERA_DEFAULT_POLAR_ANGLE = 0.98;
export const CAMERA_TARGET_LOOK_HEIGHT = 1.45;
export const CAMERA_TARGET_LOOK_AHEAD = 0.55;
export const CAMERA_TARGET_DECAY = 0.04;
export const CAMERA_EXIT_WATCH_DISTANCE = 11.5;
export const CAMERA_EXIT_WATCH_DURATION_MS = 1400;
export const CAMERA_EXIT_WATCH_POLAR_ANGLE = 1.02;
export const CAMERA_EXIT_WATCH_TARGET_BACK_OFFSET = 1.6;
export const CAMERA_EXIT_WATCH_YAW = 0;
export const CAMERA_AUTO_ALIGN_DECAY = 0.22;
export const CAMERA_AUTO_ALIGN_DELAY_MS = 1800;
export const CAMERA_AUTO_ALIGN_START_DELAY_MS = 0.7 * 1000;
export const CAMERA_HEADING_DECAY = 0.35;
export const REMOTE_PLAYER_SMOOTHING = 0.001;
export const ROOM_SCENERY_VISIBILITY_DISTANCE = 48;
export const OUTDOOR_SCENERY_VISIBILITY_DISTANCE = 88;

export const COVERED_BOUNDS = {
  minX: -30,
  maxX: 30,
  minZ: -40,
  maxZ: 40,
};

export const MAIN_BUILDING_ELEVATOR_GROUND_Y = 0;
export const MAIN_BUILDING_MEZZANINE_Y = 7.5;
export const MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y =
  (MAIN_BUILDING_ELEVATOR_GROUND_Y + MAIN_BUILDING_MEZZANINE_Y) / 2;
export const MAIN_BUILDING_ELEVATOR_Z = -36;
export const MAIN_BUILDING_ELEVATOR_W = 3.2;
export const MAIN_BUILDING_ELEVATOR_D = 3.2;
export const MAIN_BUILDING_ELEVATOR_H = ROOM_HEIGHT;
export const MAIN_BUILDING_ELEVATOR_FRONT_Z =
  MAIN_BUILDING_ELEVATOR_Z + MAIN_BUILDING_ELEVATOR_D / 2;
export const MAIN_BUILDING_ELEVATOR_INTERIOR_HALF_WIDTH =
  MAIN_BUILDING_ELEVATOR_W / 2 - 0.4;
export const MAIN_BUILDING_ELEVATOR_INTERIOR_BACK_Z =
  MAIN_BUILDING_ELEVATOR_Z - MAIN_BUILDING_ELEVATOR_D / 2 + 0.4;
export const MAIN_BUILDING_ELEVATOR_INTERIOR_FRONT_Z =
  MAIN_BUILDING_ELEVATOR_FRONT_Z - 0.2;
export const MAIN_BUILDING_ELEVATOR_PROXIMITY_DIST_SQ = 25;

// Movement tuning constants
export const FOOT_SPREAD = 0.3;
export const TERRAIN_FOLLOW_RATE = 15;
export const WATER_BOUNDS = { minX: -20, maxX: 130, minZ: -30, maxZ: 310 };

export const RIVER_PTS = [
  [200, -200],
  [180, -175],
  [160, -150],
  [137, -125],
  [115, -100],
  [95, -77],
  [75, -55],
  [72, -32],
  [70, -10],
  [72, 7],
  [75, 25],
  [62, 47],
  [50, 70],
  [30, 90],
  [10, 110],
  [-10, 130],
  [-30, 150],
  [-55, 170],
  [-80, 190],
  [-105, 205],
  [-130, 220],
];

export const LOBBY_BOUNDS = {
  minX: -5,
  maxX: 5,
  minZ: -40,
  maxZ: 40,
};

export const WORLD_CONFIG = {
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
    ended: '#f43f5e',
  },
};

export const ROOM_LAYOUTS = {
  0: { themeColor: '#60a5fa', label: 'Conversation room' },
  1: { themeColor: '#8b5cf6', label: 'Workshop room' },
  2: { themeColor: '#f59e0b', label: 'Open studio' },
  3: { themeColor: '#f43f5e', label: 'Broadcast room' },
  4: { themeColor: '#14b8a6', label: 'Lounge room' },
  5: { themeColor: '#22c55e', label: 'Crit room' },
  6: { themeColor: '#38bdf8', label: 'Screening room' },
  7: { themeColor: '#f97316', label: 'Commons room' },
  8: { themeColor: '#22c55e', label: 'Open-air amphitheater' },
  9: { themeColor: '#a855f7', label: 'Concert venue' },
  10: { themeColor: '#f59e0b', label: 'Upper Gallery' },
};

export const LANDMARK_REGISTRY = {
  castle: { label: 'Castle', approxCenter: [130, -80], approxRadius: 40 },
  airport: { label: 'Airport', approxCenter: [160, 220], approxRadius: 50 },
  amphitheater: {
    label: 'Amphitheater',
    approxCenter: [65, 150],
    approxRadius: 22,
  },
  concertVenue: {
    label: 'Concert Venue',
    approxCenter: [-85, 140],
    approxRadius: 23,
  },
  undergroundCity: {
    label: 'Underground City',
    approxCenter: [120, 80],
    approxRadius: 20,
  },
};

// Venue registry — combines landmark metadata with lazy/eager loading config.
// Add a new venue here + create a builder in scenery/ to auto-register it.
// lazyDistance: units from spawn before dynamic import() triggers (0 = eager).
export const VENUE_REGISTRY = [
  {
    key: 'roads',
    label: 'Roads',
    builder: '../scenery/roads.js',
    fn: 'buildRoads',
    lazyDistance: 0,
  },
  {
    key: 'amphitheater',
    label: 'Amphitheater',
    builder: '../scenery/amphitheater.js',
    fn: 'buildAmphitheater',
    lazyDistance: 0,
    cx: 65,
    cz: 150,
  },
  {
    key: 'concertVenue',
    label: 'Concert Venue',
    builder: '../scenery/concert-venue.js',
    fn: 'buildConcertVenue',
    lazyDistance: 0,
    cx: -85,
    cz: 140,
  },
  {
    key: 'river',
    label: 'River',
    builder: '../scenery/river.js',
    fn: 'buildRiver',
    lazyDistance: 0,
  },
  {
    key: 'airport',
    label: 'Airport',
    builder: '../scenery/airport.js',
    fn: 'buildAirport',
    lazyDistance: 120,
    cx: 160,
    cz: 220,
  },
  {
    key: 'castle',
    label: 'Castle',
    builder: '../scenery/castle.js',
    fn: 'buildCastle',
    lazyDistance: 100,
    cx: 130,
    cz: -80,
  },
  {
    key: 'undergroundCity',
    label: 'Underground City',
    builder: '../scenery/underground-city.js',
    fn: 'buildCaveAndUndergroundCity',
    lazyDistance: 95,
    cx: 120,
    cz: 80,
  },
];

export const WORLD_ASSET_CATALOG = {
  tree: { label: 'Tree', defaultScale: 1, collidable: true, footprint: 1.2 },
  boulder: {
    label: 'Boulder',
    defaultScale: 1,
    collidable: true,
    footprint: 1.1,
  },
  flower: {
    label: 'Flower',
    defaultScale: 1,
    collidable: false,
    footprint: 0.3,
  },
  grass_tuft: {
    label: 'Grass',
    defaultScale: 1,
    collidable: false,
    footprint: 0.35,
  },
  lantern: {
    label: 'Lantern',
    defaultScale: 1,
    collidable: true,
    footprint: 0.55,
  },
  banner: {
    label: 'Banner',
    defaultScale: 1,
    collidable: true,
    footprint: 0.65,
  },
  bench: { label: 'Bench', defaultScale: 1, collidable: true, footprint: 1.7 },
  plant: { label: 'Plant', defaultScale: 1, collidable: false, footprint: 0.7 },
  desk: { label: 'Desk', defaultScale: 1, collidable: true, footprint: 1.9 },
  podium: {
    label: 'Podium',
    defaultScale: 1,
    collidable: true,
    footprint: 1.2,
  },
};

export const NOTE_OFFSETS = {
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
  B: 11,
};

export { SOUNDTRACK_LIBRARY } from './midi/soundtrack-data.js';

// NPC spawn definitions — where NPCs appear in the world
export const NPC_SPAWNS = [
  // Indoor NPCs
  {
    x: -17,
    z: -30,
    room: 0,
    name: 'Alex',
    color: '#3b82f6',
    hat: 'none',
    noBackpack: true,
    glasses: true,
    pants: '#1e293b',
    shoes: '#18181b',
  },
  {
    x: 14,
    z: -30,
    room: 4,
    name: 'Riley',
    color: '#a855f7',
    hat: 'none',
    noBackpack: true,
    glasses: false,
    pants: '#4c1d95',
    shoes: '#2e1065',
    skin: '#fcd9b6',
  },
  {
    x: 17,
    z: 8,
    room: 6,
    name: 'Quinn',
    color: '#06b6d4',
    hat: 'none',
    noBackpack: true,
    glasses: true,
    pants: '#155e75',
    shoes: '#18181b',
  },
  // Lobby NPCs
  {
    x: -3,
    z: 35,
    room: -1,
    name: 'Jay',
    color: '#3b82f6',
    hat: 'none',
    noBackpack: false,
    glasses: true,
    pants: '#1e293b',
    shoes: '#18181b',
  },
  {
    x: 0,
    z: -35,
    room: -1,
    name: 'River',
    color: '#22c55e',
    hat: 'none',
    noBackpack: false,
    glasses: false,
    pants: '#064e3b',
    shoes: '#18181b',
  },
  {
    x: 3,
    z: 38,
    room: -1,
    name: 'Parker',
    color: '#14b8a6',
    hat: 'none',
    noBackpack: true,
    glasses: false,
    pants: '#115e59',
    shoes: '#18181b',
  },
  // Amphitheater
  {
    x: 60,
    z: 148,
    room: 8,
    name: 'Ember',
    color: '#f97316',
    hat: 'none',
    noBackpack: true,
    glasses: false,
    pants: '#1e293b',
    shoes: '#18181b',
  },
  {
    x: 70,
    z: 155,
    room: 8,
    name: 'Vale',
    color: '#a855f7',
    hat: 'none',
    noBackpack: false,
    glasses: true,
    pants: '#4c1d95',
    shoes: '#2e1065',
  },
  // Concert venue
  {
    x: -80,
    z: 142,
    room: 9,
    name: 'Lyric',
    color: '#06b6d4',
    hat: 'none',
    noBackpack: false,
    glasses: false,
    pants: '#155e75',
    shoes: '#18181b',
  },
  {
    x: -90,
    z: 136,
    room: 9,
    name: 'Echo',
    color: '#ec4899',
    hat: 'none',
    noBackpack: true,
    glasses: true,
    pants: '#831843',
    shoes: '#18181b',
  },
];
