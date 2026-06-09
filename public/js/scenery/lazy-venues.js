// Lazy venue loading — dynamically imports far landmarks when player approaches.
// Each zone has a center coordinate and a load distance (should exceed the 88-unit
// visibility threshold so geometry uploads *before* the player can see it).
import { state } from '../state.js';

const ZONES = [
  { name: 'airport',       module: './airport.js',          fn: 'buildAirport',           cx: 160, cz: 220, loadDist: 120 },
  { name: 'castle',        module: './castle.js',           fn: 'buildCastle',            cx: 130, cz: -80, loadDist: 100 },
  { name: 'underground',   module: './underground-city.js', fn: 'buildCaveAndUndergroundCity', cx: 120, cz: 80, loadDist: 95 },
];

const loaded = new Set();
let checkIntervalId = null;

async function loadZone(zone) {
  if (loaded.has(zone.name)) return;
  loaded.add(zone.name);

  try {
    const mod = await import(zone.module);
    const builder = mod[zone.fn];
    if (typeof builder === 'function') {
      builder();
      console.log(`[LazyVenue] Loaded: ${zone.name}`);
    }
  } catch (err) {
    console.warn(`[LazyVenue] Failed to load ${zone.name}:`, err);
    // Allow retry on next proximity check
    loaded.delete(zone.name);
  }
}

function tick() {
  if (!state.localPlayer) return;
  const px = state.localPlayer.x;
  const pz = state.localPlayer.z;

  for (const zone of ZONES) {
    if (loaded.has(zone.name)) continue;
    const dx = px - zone.cx;
    const dz = pz - zone.cz;
    if (dx * dx + dz * dz < zone.loadDist * zone.loadDist) {
      loadZone(zone);
    }
  }

  // Self-destruct once everything is loaded
  if (loaded.size === ZONES.length && checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
}

export function initLazyVenueLoading() {
  if (checkIntervalId) return;
  // Check every 2 seconds — no need for per-frame precision
  checkIntervalId = setInterval(tick, 2000);
  // Also check immediately in case the player is already near a zone
  tick();
}
