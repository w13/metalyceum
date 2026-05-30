// Configuration Constants for Metalyceum

export const ROOM_WIDTH = 20;
export const ROOM_DEPTH = 20;
export const ROOM_HEIGHT = 5.5;
export const MAP_SIZE = 150; // Size of the grassy area
export const ROOM_LABEL_HEIGHT = 5.1;
export const CAMERA_FOLLOW_LERP = 1 - Math.pow(0.00035, 1 / 60);
export const REMOTE_PLAYER_SMOOTHING = 0.001;
export const ROOM_SCENERY_VISIBILITY_DISTANCE = 48;
export const OUTDOOR_SCENERY_VISIBILITY_DISTANCE = 88;

export const COVERED_BOUNDS = {
  minX: -30,
  maxX: 30,
  minZ: -40,
  maxZ: 40
};

export const LOBBY_BOUNDS = {
  minX: -5,
  maxX: 5,
  minZ: -40,
  maxZ: 40
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
    ended: '#f43f5e'
  }
};

export const ROOM_LAYOUTS = {
  0: { themeColor: '#60a5fa', label: 'Conversation room' },
  1: { themeColor: '#8b5cf6', label: 'Workshop room' },
  2: { themeColor: '#f59e0b', label: 'Open studio' },
  3: { themeColor: '#f43f5e', label: 'Broadcast room' },
  4: { themeColor: '#14b8a6', label: 'Lounge room' },
  5: { themeColor: '#22c55e', label: 'Crit room' },
  6: { themeColor: '#38bdf8', label: 'Screening room' },
  7: { themeColor: '#f97316', label: 'Commons room' }
};

export const WORLD_ASSET_CATALOG = {
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
  B: 11
};

export const SOUNDTRACK_LIBRARY = [
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

export const SOUNDTRACK_STATE = {
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
