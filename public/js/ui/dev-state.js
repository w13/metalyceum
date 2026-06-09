// Developer tools shared state — separate from game state to keep concerns clean.

import { getTerrainHeight } from '../physics.js';
import { teleportPlayer } from '../physics-engine.js';
import { state } from '../state.js';

if (typeof window !== 'undefined') {
  window.__state = state;
}

export const devState = {
  showMap: false,
  showAssetBoxes: false,
  showWallBoxes: false,
  showRiverPath: false,
  showFlatZones: false,
  showLandmarkBoxes: false,

  zoom: 1.0,
  panX: 0,
  panY: 0,

  isDragging: false,
  startX: 0,
  startY: 0,

  hoveredAsset: null,
  hoveredRoom: null,
  hoveredCoords: { x: 0, z: 0 },

  helpersGroup: null,
  helpersDirty: false,
  lastAssetCount: 0,

  auditIssues: [],
  staticAuditIssues: [],
  zfightIssues: [],
  lastInspected: null,
  showStaticAuditMarkers: false,
  showZFightMarkers: false,
};

export function devTeleport(x, z) {
  const y = getTerrainHeight(x, z);
  const dx = x - state.localPlayer.x;
  const dz = z - state.localPlayer.z;

  state.localPlayer.x = x;
  state.localPlayer.y = y;
  state.localPlayer.z = z;

  if (state.localPlayer.mesh) {
    state.localPlayer.mesh.position.set(x, y, z);
  }

  teleportPlayer(x, z);

  if (state.camera) {
    state.camera.position.x += dx;
    state.camera.position.z += dz;
  }

  if (state.controls) {
    state.controls.target.set(x, y + 1.45, z);
  }
}
