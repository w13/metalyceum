// physics-engine.js — Cannon-es XZ collision proxy for Metalyceum.
// Cannon owns XZ wall/asset collision resolution. Y is fully manual (terrain-follow,
// jump, gravity in engine/movement.js). This file must never modify state.localPlayer.y.

import { getTerrainHeight } from './physics.js';
import { state } from './state.js';

const CANNON_CDN = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
const PLAYER_RADIUS = 0.4;

let CANNON = null;
let world = null;
let playerBody = null;
let elevatorDoorBody = null; // dynamic Cannon body for the elevator door
let initialized = false;
let initPromise = null;

// ── Public test seam ──────────────────────────────────────────────────────────
// Accepts a pre-loaded Cannon module (e.g. from the cannon-es npm package in tests)
// so tests never make CDN requests. Production code uses initCannon() instead.
export async function _initFromModule(cannonMod) {
  if (initialized) return;
  CANNON = cannonMod;

  world = new CANNON.World();
  world.gravity.set(0, 0, 0); // Y is manual; Cannon gravity would sag body between substeps
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = 10;
  world.defaultContactMaterial.friction = 0;
  world.defaultContactMaterial.restitution = 0;

  buildWallColliders();
  buildAssetColliders();
  createPlayerBody();

  initialized = true;
}

// ── Initialization ─────────────────────────────────────────────────────────────
export async function initCannon() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mod = await import(CANNON_CDN);
      await _initFromModule(mod);
      // [Cannon] Physics engine initialized
    } catch (err) {
      console.warn('[Cannon] Failed to load from CDN, physics disabled:', err);
    }
  })();

  return initPromise;
}

// ── Wall colliders (from state.WALLS Box3 array) ───────────────────────────────
// The elevator door Box3 is tagged with _isElevatorDoor=true and handled
// dynamically via updateElevatorDoorCollider() instead.
function buildWallColliders() {
  state.WALLS.forEach((box3) => {
    // Skip dynamic walls that are updated per-frame (elevator door, etc.)
    if (box3.userData?._isElevatorDoor) return;

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

// ── Placed asset colliders ─────────────────────────────────────────────────────
// hy=10 (half-height) centres at y=0 → collider spans [-10, 10].
// This covers the full terrain amplitude (~3.7 u max) so placed assets on
// hills are never phantom obstacles. The manual checkCollision uses [-20, 20].
function buildAssetColliders() {
  state.PLACED_ASSET_COLLIDERS.forEach((c) => {
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    const hx = (c.maxX - c.minX) / 2;
    const hz = (c.maxZ - c.minZ) / 2;

    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, 10.0, hz)));
    body.position.set(cx, 0, cz);
    body.userData = { type: 'asset' };
    world.addBody(body);
  });
}

// ── Player body ────────────────────────────────────────────────────────────────
function createPlayerBody() {
  playerBody = new CANNON.Body({ mass: 1 });
  playerBody.addShape(new CANNON.Sphere(PLAYER_RADIUS));
  playerBody.fixedRotation = true;
  playerBody.linearDamping = 0; // all drag comes from manual system
  playerBody.allowSleep = false; // direct velocity writes don't wake sleeping bodies
  playerBody.updateMassProperties();

  const startY =
    getTerrainHeight(state.localPlayer.x, state.localPlayer.z) + PLAYER_RADIUS;
  playerBody.position.set(state.localPlayer.x, startY, state.localPlayer.z);
  world.addBody(playerBody);
}

// ── Per-frame step ─────────────────────────────────────────────────────────────
export function stepCannon(dt) {
  if (!initialized || !world) return;
  // Throttle to every 2nd frame — XZ collision at 30fps is imperceptibly
  // different from 60fps for a walking-speed character. Saves ~50% CPU on
  // 120-body constraint solving.
  if ((state.frameCount || 0) % 2 !== 0) return;
  world.step(1 / 60, dt, 3);
}

// ── Sync manual Y into the Cannon body before each step ───────────────────────
// Wall and asset colliders have finite Y extent, so the player sphere must sit
// at the correct height to intersect them. Without this, assets on slopes are phantom.
export function syncBodyY(manualY) {
  if (!initialized || !playerBody) return;
  playerBody.position.y = manualY + PLAYER_RADIUS;
  playerBody.velocity.y = 0;
}

// ── Teleport player body (used by safety-net revert) ──────────────────────────
export function teleportPlayer(x, z) {
  if (!initialized || !playerBody) return;
  playerBody.position.x = x;
  playerBody.position.z = z;
  playerBody.velocity.set(0, 0, 0);
}

// ── Query helpers ──────────────────────────────────────────────────────────────
export function isCannonReady() {
  return initialized;
}

export function getPlayerBodyRef() {
  return playerBody;
}

// ── Dynamic elevator door collider ─────────────────────────────────────────────
// Called every frame from engine.js to keep the Cannon door body in sync with
// the elevator car's Y position and the door open/closed state.
export function updateElevatorDoorCollider(min, max) {
  if (!initialized || !world || !CANNON) return;

  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const cz = (min.z + max.z) / 2;
  const hx = (max.x - min.x) / 2;
  const hy = (max.y - min.y) / 2;
  const hz = (max.z - min.z) / 2;

  if (hx < 0.01 || hy < 0.01 || hz < 0.01) {
    // Door is open or collapsed — remove the body so player walks through
    if (elevatorDoorBody) {
      world.removeBody(elevatorDoorBody);
      elevatorDoorBody = null;
    }
    return;
  }

  if (!elevatorDoorBody) {
    // Create the door body on first use
    elevatorDoorBody = new CANNON.Body({ mass: 0 });
    elevatorDoorBody.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    elevatorDoorBody.position.set(cx, cy, cz);
    world.addBody(elevatorDoorBody);
  } else {
    // Update existing body — swap shape for new half-extents
    elevatorDoorBody.removeShape(elevatorDoorBody.shapes[0]);
    elevatorDoorBody.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    elevatorDoorBody.position.set(cx, cy, cz);
  }
}

// ── Rebuild asset colliders (after editor saves new assets) ───────────────────
export function rebuildAssetColliders() {
  if (!initialized || !world) return;
  const toRemove = world.bodies.filter(
    (b) => b.mass === 0 && b.userData?.type === 'asset',
  );
  toRemove.forEach((b) => world.removeBody(b));
  buildAssetColliders();
}

// ── Full reset (reinitialization / tests) ─────────────────────────────────────
export function resetCannon() {
  if (world) {
    world.bodies.slice().forEach((b) => world.removeBody(b));
  }
  world = null;
  playerBody = null;
  elevatorDoorBody = null;
  initialized = false;
  initPromise = null;
}
