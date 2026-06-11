// Lazy venue loading — dynamically imports far landmarks when player approaches.
// Reads VENUE_REGISTRY from config.js — add an entry there to register a new lazy venue.

import { VENUE_REGISTRY } from '../config.js';
import { state } from '../state.js';

// Filter to lazy-loaded entries only
const ZONES = VENUE_REGISTRY.filter((v) => v.lazyDistance > 0).map((v) => ({
  key: v.key,
  module: v.builder,
  fn: v.fn,
  cx: v.cx,
  cz: v.cz,
  loadDist: v.lazyDistance,
}));

const loaded = new Set();
let checkIntervalId = null;

async function loadZone(zone) {
  if (loaded.has(zone.key)) return;
  loaded.add(zone.key);

  try {
    const mod = await import(zone.module);
    const builder = mod[zone.fn];
    if (typeof builder === 'function') {
      builder();
      state._shadowDirty = true; // new geometry must get into the shadow map
    }
  } catch (err) {
    console.warn(`[LazyVenue] Failed to load ${zone.key}:`, err);
    loaded.delete(zone.key);
  }
}

function tick() {
  if (!state.localPlayer) return;
  const px = state.localPlayer.x;
  const pz = state.localPlayer.z;

  for (const zone of ZONES) {
    if (loaded.has(zone.key)) continue;
    const dx = px - zone.cx;
    const dz = pz - zone.cz;
    if (dx * dx + dz * dz < zone.loadDist * zone.loadDist) {
      loadZone(zone);
    }
  }

  if (loaded.size === ZONES.length && checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
}

export function initLazyVenueLoading() {
  if (checkIntervalId) return;
  checkIntervalId = setInterval(tick, 2000);
  tick();
}
