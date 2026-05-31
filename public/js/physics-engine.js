// physics-engine.js v3 — cache-bust
// Cannon-es Physics Engine Wrapper for Metalyceum
// Dynamically loaded from CDN (matching the @tonejs/midi pattern in audio.js).
// Provides heightfield terrain collision, wall/asset colliders, and a player body.
// Replaces the manual sphere-vs-AABB collision in physics.js for player movement.
import { state } from './state.js';
import { getTerrainHeight } from './physics.js';

const CANNON_CDN = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
const PLAYER_RADIUS = 0.4;

// ── Module state ────────────────────────────────────────────────────────
let CANNON = null;
let world = null;
let playerBody = null;
let initialized = false;
let initPromise = null;

// Scratch vectors for per-frame sync (zero alloc)

// ── Initialization ──────────────────────────────────────────────────────
export async function initCannon() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      CANNON = await import(CANNON_CDN);
    } catch (err) {
      console.warn('[Cannon] Failed to load from CDN, physics disabled:', err);
      initialized = false;
      return;
    }

    world = new CANNON.World();
    world.gravity.set(0, -25, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    world.solver.iterations = 10;

    buildTerrainHeightfield();
    buildWallColliders();
    buildAssetColliders();
    createPlayerBody();

    initialized = true;
    console.log('[Cannon] Physics engine initialized');
  })();

  return initPromise;
}

// ── Heightfield terrain ─────────────────────────────────────────────────
function buildTerrainHeightfield() {
  const elementSize = 2.5;            // ~2.5u between samples
  const worldSize = 400;              // MAP_SIZE
  const numElements = Math.floor(worldSize / elementSize) + 1; // 161
  const half = (numElements - 1) / 2; // centering offset

  const data = [];
  for (let i = 0; i < numElements; i++) {
    data[i] = [];
    for (let j = 0; j < numElements; j++) {
      const wx = (i - half) * elementSize;
      const wz = (j - half) * elementSize;
      data[i][j] = getTerrainHeight(wx, wz);
    }
  }

  const hfShape = new CANNON.Heightfield(data, { elementSize });
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(hfShape);
  world.addBody(body);
}

// ── Wall colliders (from state.WALLS Box3 array) ────────────────────────
function buildWallColliders() {
  state.WALLS.forEach((box3) => {
    const cx = (box3.min.x + box3.max.x) / 2;
    const cy = (box3.min.y + box3.max.y) / 2;
    const cz = (box3.min.z + box3.max.z) / 2;
    const hx = (box3.max.x - box3.min.x) / 2;
    const hy = (box3.max.y - box3.min.y) / 2;
    const hz = (box3.max.z - box3.min.z) / 2;

    if (hx < 0.01 || hy < 0.01 || hz < 0.01) return;

    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    body.position.set(cx, cy, cz);
    world.addBody(body);
  });
}

// ── Placed asset colliders (from state.PLACED_ASSET_COLLIDERS) ──────────
function buildAssetColliders() {
  state.PLACED_ASSET_COLLIDERS.forEach((c) => {
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    const hx = (c.maxX - c.minX) / 2;
    const hz = (c.maxZ - c.minZ) / 2;
    const hy = 1.0; // fixed height for all placed assets

    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    body.position.set(cx, 0, cz);
    body.userData = { type: 'asset' };
    world.addBody(body);
  });
}

// ── Player body ─────────────────────────────────────────────────────────
function createPlayerBody() {
  playerBody = new CANNON.Body({ mass: 1 });
  const sphereShape = new CANNON.Sphere(PLAYER_RADIUS);
  playerBody.addShape(sphereShape);
  playerBody.fixedRotation = true;
  playerBody.updateMassProperties();

  // Start at the same position as the local player
  const startY = getTerrainHeight(state.localPlayer.x, state.localPlayer.z) + PLAYER_RADIUS;
  playerBody.position.set(state.localPlayer.x, startY, state.localPlayer.z);

  world.addBody(playerBody);
}

// ── Per-frame step ──────────────────────────────────────────────────────
export function stepCannon(dt) {
  if (!initialized || !world) return;
  world.step(1 / 60, dt, 3);
}

// ── Sync player body → state.localPlayer ────────────────────────────────
export function syncPlayerFromCannon() {
  if (!initialized || !playerBody) return;
  // Only sync X and Z from Cannon body.
  // Y is handled by the engine's terrain-following code (getFootAnchoredHeight + lerp)
  // to prevent physics solver glitches from launching the player into space.
  state.localPlayer.x = playerBody.position.x;
  state.localPlayer.z = playerBody.position.z;
}

// ── Apply movement from WASD input ──────────────────────────────────────
export function applyPlayerMovement(moveDirX, moveDirZ, speed, dt) {
  if (!initialized || !playerBody) return;

  // Cancel existing horizontal velocity and set desired
  const targetVx = moveDirX * speed;
  const targetVz = moveDirZ * speed;

  // Smoothly interpolate to avoid instant direction changes
  const lerpFactor = 1 - Math.pow(0.01, dt);
  playerBody.velocity.x += (targetVx - playerBody.velocity.x) * lerpFactor;
  playerBody.velocity.z += (targetVz - playerBody.velocity.z) * lerpFactor;
}

// ── Jump ────────────────────────────────────────────────────────────────
export function playerJump(force) {
  if (!initialized || !playerBody) return;
  // Y is handled by terrain-following code in engine.js, so this is a no-op.
  // The function is kept for API compatibility.
}

// ── Position the player body at a specific world position ────────────────
export function teleportPlayer(x, z) {
  if (!initialized || !playerBody) return;
  // Y is handled by terrain-following, so just teleport XZ
  playerBody.position.x = x;
  playerBody.position.z = z;
  playerBody.velocity.set(0, 0, 0);
}

// ── Query helpers ──────────────────────────────────────────────────────
export function isCannonReady() {
  return initialized;
}

export function getPlayerBodyRef() {
  return playerBody;
}

// ── Rebuild colliders (called after editor saves new assets) ────────────
export function rebuildAssetColliders() {
  if (!initialized || !world) return;

  // Remove existing asset collider bodies (mass=0, marked with userData)
  const toRemove = world.bodies.filter(b => b.mass === 0 && b.userData?.type === 'asset');
  toRemove.forEach(b => world.removeBody(b));

  // Re-add from current state
  buildAssetColliders();
}

// ── Reset the entire physics world (for reinitialization) ───────────────
export function resetCannon() {
  if (world) {
    world.bodies.slice().forEach(b => world.removeBody(b));
  }
  world = null;
  playerBody = null;
  initialized = false;
  initPromise = null;
}
