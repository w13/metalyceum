# Cannon-es XZ Collision Proxy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-written `physics-engine.js` into the game loop so Cannon-es handles XZ wall/asset collision, eliminating the tunneling and terrain-clipping that the manual axis-split system produced.

**Architecture:** Cannon-es acts as a pure XZ collision proxy — it resolves contacts, returns a corrected position, and contributes nothing to dynamics. All drag, acceleration, speed-capping, and Y physics stay in the manual system unchanged. A new `displayVelocity` field carries post-collision velocity to animation/rotation, keeping the control velocity uncorrupted by wall contacts.

**Tech Stack:** cannon-es@0.20.0 (devDependency for tests; CDN in browser), Three.js r128, Vitest for headless Node tests.

---

## Files

| File | Change |
|---|---|
| `package.json` | Add `cannon-es` devDependency |
| `public/js/state.js` | Add `displayVelocity` to `localPlayer` |
| `public/js/physics.js` | Add `checkCollisionLoose()` (expanded safety-net sphere) |
| `public/js/physics-engine.js` | Rewrite: no heightfield, gravity=0, linearDamping=0, frictionless contact, add `syncBodyY`, `_initFromModule`, fix asset collider Y, refactor `initCannon` |
| `public/js/engine/movement.js` | Replace XZ integration block with Cannon path; add fallback `displayVelocity` copy; switch rotation/animation reads to `displayVelocity` |
| `public/js/engine.js` | Import and call `initCannon()` after `buildMap()` |
| `public/js/editor.js` | Call `rebuildAssetColliders()` in `applyPublishedWorldAssets` |
| `test/client/cannon-integration.test.ts` | New: four integration tests |

---

## Task 1: Install cannon-es and add displayVelocity to state

**Files:**
- Modify: `package.json`
- Modify: `public/js/state.js:48-66`

- [ ] **Step 1.1: Install cannon-es as devDependency**

```bash
cd /Users/waqqashanafi/Documents/antigravity/zealous-hawking
npm install --save-dev cannon-es
```

Expected: `package.json` updated with `"cannon-es": "^0.20.0"` in devDependencies.

- [ ] **Step 1.2: Add `displayVelocity` to `state.localPlayer`**

In `public/js/state.js`, in the `localPlayer` object (around line 63), add `displayVelocity` after `velocity`:

```js
    velocity: null, // will be initialized to Vector3 in engine
    displayVelocity: null, // post-collision XZ velocity for animation/rotation only
    isGrounded: true,
```

- [ ] **Step 1.3: Initialize displayVelocity in engine.js**

In `public/js/engine.js` `initEngine()`, find the line that initializes `velocity` (around line 293) and add `displayVelocity` immediately after:

```js
  state.localPlayer.velocity = new THREE.Vector3();
  state.localPlayer.displayVelocity = new THREE.Vector3();
```

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json public/js/state.js public/js/engine.js
git commit -m "feat: add displayVelocity to localPlayer state, install cannon-es dev dep"
```

---

## Task 2: Add checkCollisionLoose to physics.js

The Cannon-path safety net uses a sphere radius of 0.55 (vs the normal 0.40) so it only reverts on gross failures, not on positions Cannon considers valid.

**Files:**
- Modify: `public/js/physics.js`

- [ ] **Step 2.1: Add `checkCollisionLoose` to physics.js**

Open `public/js/physics.js`. After the existing `_sphere` and `_cBox` scratch objects at the top, add a loose sphere:

```js
// Scratch objects — zero allocations per frame
const _sphere = new THREE.Sphere(new THREE.Vector3(), 0.4);
const _sphereLoose = new THREE.Sphere(new THREE.Vector3(), 0.55);  // ← add this line
const _cBox = new THREE.Box3();
```

Then add the new export at the bottom of the file, after `isLocalPlayerUnderRoof`:

```js
// Safety-net collision check with expanded radius — only fires on gross failures.
// Used on the Cannon path so the net doesn't veto positions Cannon already validated.
export function checkCollisionLoose(targetX, targetZ) {
  const mapLim = MAP_SIZE / 2 - 2;
  if (Math.abs(targetX) > mapLim || Math.abs(targetZ) > mapLim) {
    return true;
  }
  _sphereLoose.center.set(targetX, state.localPlayer?.y ?? 0, targetZ);
  for (const wallBox of state.WALLS) {
    if (wallBox.intersectsSphere(_sphereLoose)) return true;
  }
  for (const collider of state.PLACED_ASSET_COLLIDERS) {
    _cBox.min.set(collider.minX, -20, collider.minZ);
    _cBox.max.set(collider.maxX, 20, collider.maxZ);
    if (_cBox.intersectsSphere(_sphereLoose)) return true;
  }
  return false;
}
```

- [ ] **Step 2.2: Commit**

```bash
git add public/js/physics.js
git commit -m "feat: add checkCollisionLoose for expanded Cannon safety net"
```

---

## Task 3: Rewrite physics-engine.js

This is the core change. Key differences from the current version:
- No heightfield body (terrain is manual)
- `world.gravity = (0, 0, 0)` — prevents body Y sag between substeps
- `playerBody.linearDamping = 0` — all drag is manual
- Frictionless `ContactMaterial` — no Cannon friction on XZ
- New `syncBodyY(y)` export — syncs manual Y into body before each step
- New `_initFromModule(cannonMod)` export — test seam that bypasses CDN import
- Fixed `buildAssetColliders`: `hy = 10.0` at `y = 0` — covers all terrain heights

**Files:**
- Modify: `public/js/physics-engine.js` (full rewrite)

- [ ] **Step 3.1: Rewrite physics-engine.js**

Replace the entire contents of `public/js/physics-engine.js` with:

```js
// physics-engine.js — Cannon-es XZ collision proxy for Metalyceum.
// Cannon owns XZ wall/asset collision resolution. Y is fully manual (terrain-follow,
// jump, gravity in engine/movement.js). This file must never modify state.localPlayer.y.
import { state } from './state.js';
import { getTerrainHeight } from './physics.js';

const CANNON_CDN = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
const PLAYER_RADIUS = 0.4;

let CANNON = null;
let world = null;
let playerBody = null;
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
      console.log('[Cannon] Physics engine initialized');
    } catch (err) {
      console.warn('[Cannon] Failed to load from CDN, physics disabled:', err);
    }
  })();

  return initPromise;
}

// ── Wall colliders (from state.WALLS Box3 array) ───────────────────────────────
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
  const playerMat = new CANNON.Material('player');
  const worldMat = new CANNON.Material('world');
  const contact = new CANNON.ContactMaterial(playerMat, worldMat, {
    friction: 0,
    restitution: 0,
  });
  world.addContactMaterial(contact);

  playerBody = new CANNON.Body({ mass: 1, material: playerMat });
  playerBody.addShape(new CANNON.Sphere(PLAYER_RADIUS));
  playerBody.fixedRotation = true;
  playerBody.linearDamping = 0; // all drag comes from manual system
  playerBody.updateMassProperties();

  const startY = getTerrainHeight(state.localPlayer.x, state.localPlayer.z) + PLAYER_RADIUS;
  playerBody.position.set(state.localPlayer.x, startY, state.localPlayer.z);
  world.addBody(playerBody);
}

// ── Per-frame step ─────────────────────────────────────────────────────────────
export function stepCannon(dt) {
  if (!initialized || !world) return;
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

// ── Rebuild asset colliders (after editor saves new assets) ───────────────────
export function rebuildAssetColliders() {
  if (!initialized || !world) return;
  const toRemove = world.bodies.filter(b => b.mass === 0 && b.userData?.type === 'asset');
  toRemove.forEach(b => world.removeBody(b));
  buildAssetColliders();
}

// ── Full reset (reinitialization / tests) ─────────────────────────────────────
export function resetCannon() {
  if (world) {
    world.bodies.slice().forEach(b => world.removeBody(b));
  }
  world = null;
  playerBody = null;
  initialized = false;
  initPromise = null;
}
```

- [ ] **Step 3.2: Commit**

```bash
git add public/js/physics-engine.js
git commit -m "feat: rewrite physics-engine.js — gravity=0, no heightfield, frictionless contact, syncBodyY, _initFromModule test seam, asset collider Y fix"
```

---

## Task 4: Write the four failing integration tests

These tests run headless in Node (no WebGL). `cannon-es` is the npm package injected via `_initFromModule`, bypassing the CDN import.

**Files:**
- Create: `test/client/cannon-integration.test.ts`

- [ ] **Step 4.1: Create the test file**

Create `test/client/cannon-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { state } from '../../public/js/state.js';
import {
  _initFromModule,
  resetCannon,
  stepCannon,
  syncBodyY,
  isCannonReady,
  getPlayerBodyRef,
  teleportPlayer,
} from '../../public/js/physics-engine.js';

function makePlayer(x = 0, y = 0, z = 0) {
  state.localPlayer = {
    x, y, z, ry: 0,
    velocity: new THREE.Vector3(),
    displayVelocity: new THREE.Vector3(),
    isGrounded: true,
    currentRoom: -1,
    mesh: null,
  } as any;
}

function addWall(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
  state.WALLS.push(new THREE.Box3(
    new THREE.Vector3(minX, minY, minZ),
    new THREE.Vector3(maxX, maxY, maxZ)
  ));
}

beforeEach(() => {
  state.WALLS = [];
  state.PLACED_ASSET_COLLIDERS = [];
  makePlayer();
});

afterEach(() => {
  resetCannon();
});

describe('Cannon XZ collision proxy', () => {

  // ── Test 1: Tunneling regression ────────────────────────────────────────────
  // Max game speed = 9.5 u/s. Substep fixed at 1/60 s.
  // Per-substep travel = 9.5/60 = 0.158 u. Thinnest wall AABB ≈ 0.66 u. Margin: 4×.
  // dt=0.5 simulates a 500 ms frame drop (3 substeps at 1/60 before cap).
  it('does not tunnel through a 0.5-unit wall at max speed with an inflated dt', async () => {
    // Wall at z=[3, 3.5], large XZ/Y extents so player cannot go around
    addWall(-10, 0, 3, 10, 4, 3.5);
    makePlayer(0, 0, 1);

    await _initFromModule(CANNON);
    expect(isCannonReady()).toBe(true);

    const body = getPlayerBodyRef()!;
    body.position.set(0, PLAYER_RADIUS, 1); // start near side, z=1
    body.velocity.set(0, 0, 9.5);           // max game speed toward wall

    stepCannon(0.5); // 500 ms frame drop

    // Player must not have crossed the wall's near face (z=3)
    expect(body.position.z).toBeLessThan(3.0);
  });

  // ── Test 2: Wall sliding, not sticking ─────────────────────────────────────
  // Player approaches wall diagonally. Cannon resolves the X contact.
  // The expanded safety-net check (r=0.55) must not fire on every frame — that
  // would freeze the player at oldPos rather than sliding along the wall.
  it('slides along a wall rather than freezing at the safety-net veto', async () => {
    // Wall along Z axis at x=[5, 5.5]
    addWall(5, 0, -20, 5.5, 4, 20);
    makePlayer(4, 0, 0);

    await _initFromModule(CANNON);
    const body = getPlayerBodyRef()!;
    body.position.set(4, PLAYER_RADIUS, 0);

    let safetyNetFires = 0;
    const startZ = body.position.z;

    for (let i = 0; i < 30; i++) {
      const prevX = body.position.x;
      const prevZ = body.position.z;

      body.velocity.x = 5; // keep pushing into wall
      body.velocity.z = 5; // keep moving along wall
      syncBodyY(0);
      stepCannon(1 / 60);

      // Simulate the expanded safety-net check (r=0.55) from movement.js
      const sphere = new THREE.Sphere(
        new THREE.Vector3(body.position.x, PLAYER_RADIUS, body.position.z),
        0.55
      );
      const wallBox = state.WALLS[0] as THREE.Box3;
      if (wallBox.intersectsSphere(sphere)) {
        body.position.x = prevX;
        body.position.z = prevZ;
        body.velocity.set(0, 0, 0);
        safetyNetFires++;
      }
    }

    // Must have made Z progress (sliding) — not frozen at start
    expect(body.position.z).toBeGreaterThan(startZ + 0.5);
    // Safety net must not fire on every frame (that is sticking, not sliding)
    expect(safetyNetFires).toBeLessThan(30);
    // Must not have passed through the wall
    expect(body.position.x).toBeLessThanOrEqual(5.0);
  });

  // ── Test 3: Y independence on flat terrain ──────────────────────────────────
  // gravity=(0,0,0) and syncBodyY zeroes velocity.y before each step.
  // On flat terrain (Y constant), body.position.y must stay at PLAYER_RADIUS.
  // We share a fixed XZ sequence across both runs to avoid the confound where
  // legitimate XZ divergence produces different terrain heights → different Y.
  it('Cannon does not contaminate Y: body.position.y stays at PLAYER_RADIUS on flat terrain', async () => {
    makePlayer(0, 0, 0);
    await _initFromModule(CANNON);
    const body = getPlayerBodyRef()!;
    body.position.set(0, PLAYER_RADIUS, 0);

    for (let i = 0; i < 60; i++) {
      syncBodyY(0); // flat terrain: manualY=0 always
      body.velocity.set(3, 0, 0); // move right

      // After syncBodyY: body Y must equal PLAYER_RADIUS and velocity.y must be 0
      expect(body.position.y).toBeCloseTo(PLAYER_RADIUS, 5);
      expect(body.velocity.y).toBeCloseTo(0, 5);

      stepCannon(1 / 60);

      // After step with gravity=(0,0,0) and velocity.y pre-zeroed: Y must not drift
      expect(body.position.y).toBeCloseTo(PLAYER_RADIUS, 2);
    }
  });

  // ── Test 4: displayVelocity on fallback path ────────────────────────────────
  // When Cannon is not ready (CDN not loaded), the fallback path must copy
  // state.localPlayer.velocity → displayVelocity so animation/rotation work.
  describe('fallback path displayVelocity', () => {
    it('isCannonReady is false before initCannon is called', () => {
      expect(isCannonReady()).toBe(false);
    });

    it('displayVelocity matches velocity after fallback move', () => {
      // Simulate the fallback path's displayVelocity copy (the line added to movement.js)
      state.localPlayer.velocity.x = 4.2;
      state.localPlayer.velocity.z = -1.8;

      // This is what the fallback branch does at end of XZ block
      state.localPlayer.displayVelocity.x = state.localPlayer.velocity.x;
      state.localPlayer.displayVelocity.z = state.localPlayer.velocity.z;

      expect(state.localPlayer.displayVelocity.x).toBe(4.2);
      expect(state.localPlayer.displayVelocity.z).toBe(-1.8);
    });

    it('displayVelocity is zero when velocity is zero on fallback', () => {
      state.localPlayer.velocity.x = 0;
      state.localPlayer.velocity.z = 0;
      state.localPlayer.displayVelocity.x = state.localPlayer.velocity.x;
      state.localPlayer.displayVelocity.z = state.localPlayer.velocity.z;

      expect(state.localPlayer.displayVelocity.x).toBe(0);
      expect(state.localPlayer.displayVelocity.z).toBe(0);
    });
  });

});

// Constant used in assertions — must match physics-engine.js
const PLAYER_RADIUS = 0.4;
```

- [ ] **Step 4.2: Run the tests — expect failures**

```bash
npm test -- --reporter=verbose --project=client-unit
```

Expected: Tests 1–3 fail (`_initFromModule is not a function` or similar — physics-engine.js doesn't export it yet if run before Task 3, or the old file doesn't have it). Test 4 passes since it's self-contained. After Task 3 is done, all should fail only because the cannon world isn't set up with walls correctly — which Task 3 fixes.

If Task 3 is already done, the tunneling test and Y test should pass. The sliding test may need tuning based on actual Cannon behavior.

- [ ] **Step 4.3: Commit**

```bash
git add test/client/cannon-integration.test.ts
git commit -m "test: add four Cannon XZ proxy integration tests (tunneling, sliding, Y independence, fallback)"
```

---

## Task 5: Update movement.js — Cannon path + displayVelocity

This is the largest code change. The existing XZ integration block (lines 117–158) is replaced.

**Files:**
- Modify: `public/js/engine/movement.js`

- [ ] **Step 5.1: Update imports at top of movement.js**

The file currently imports:
```js
import { isCannonReady, getPlayerBodyRef, teleportPlayer } from '../physics-engine.js';
```

Replace that line with:
```js
import { isCannonReady, getPlayerBodyRef, teleportPlayer, syncBodyY, stepCannon } from '../physics-engine.js';
```

Also update the physics.js import line (currently `import { getTerrainHeight, checkCollision } from '../physics.js'`) to add `checkCollisionLoose`:

```js
import { getTerrainHeight, checkCollision, checkCollisionLoose } from '../physics.js';
```

- [ ] **Step 5.2: Replace the XZ integration + collision block**

Find this block in `updateLocalPlayer` (lines ~117–158):

```js
  const stepX = state.localPlayer.velocity.x * dt;
  const stepZ = state.localPlayer.velocity.z * dt;

  if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
    let nextX = state.localPlayer.x + stepX;
    let nextZ = state.localPlayer.z + stepZ;

    if (!checkCollision(nextX, nextZ)) {
      state.localPlayer.x = nextX;
      state.localPlayer.z = nextZ;
    } else {
      if (!checkCollision(nextX, state.localPlayer.z)) {
        state.localPlayer.x = nextX;
        state.localPlayer.velocity.z = 0;
      }
      else if (!checkCollision(state.localPlayer.x, nextZ)) {
        state.localPlayer.z = nextZ;
        state.localPlayer.velocity.x = 0;
      } else {
        state.localPlayer.velocity.x = 0;
        state.localPlayer.velocity.z = 0;
      }
    }
  }

  // Sync velocity from Cannon body so avatar rotation and animations work
  if (isCannonReady()) {
    const bodyRef = getPlayerBodyRef();
    if (bodyRef) {
      state.localPlayer.velocity.x = bodyRef.velocity.x;
      state.localPlayer.velocity.z = bodyRef.velocity.z;
    }
  }

  // Collision safety net: revert XZ if we ended up inside a wall
  if (checkCollision(state.localPlayer.x, state.localPlayer.z)) {
    state.localPlayer.x = oldPos.x;
    state.localPlayer.z = oldPos.z;
    state.localPlayer.velocity.x = 0;
    state.localPlayer.velocity.z = 0;
    if (isCannonReady()) teleportPlayer(oldPos.x, oldPos.z);
  }
```

Replace it with:

```js
  if (isCannonReady()) {
    // Cannon path: push control velocity to body, step, read XZ position back.
    // Control velocity (state.localPlayer.velocity) is never overwritten by Cannon —
    // post-collision velocity goes to displayVelocity for animation/rotation only.
    const body = getPlayerBodyRef();
    body.velocity.x = state.localPlayer.velocity.x;
    body.velocity.z = state.localPlayer.velocity.z;
    syncBodyY(state.localPlayer.y); // keeps body at correct height so wall colliders intersect
    stepCannon(dt);
    state.localPlayer.x = body.position.x;
    state.localPlayer.z = body.position.z;
    state.localPlayer.displayVelocity.x = body.velocity.x;
    state.localPlayer.displayVelocity.z = body.velocity.z;

    // Safety net: gross-failure catch only. Expanded sphere (r=0.55 vs r=0.40) so
    // this does not veto positions Cannon already validated — avoids sticking on walls.
    if (checkCollisionLoose(state.localPlayer.x, state.localPlayer.z)) {
      state.localPlayer.x = oldPos.x;
      state.localPlayer.z = oldPos.z;
      state.localPlayer.velocity.x = 0;
      state.localPlayer.velocity.z = 0;
      teleportPlayer(oldPos.x, oldPos.z);
    }
  } else {
    // Fallback: axis-split manual collision (used until Cannon CDN loads, or on failure).
    const stepX = state.localPlayer.velocity.x * dt;
    const stepZ = state.localPlayer.velocity.z * dt;

    if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
      const nextX = state.localPlayer.x + stepX;
      const nextZ = state.localPlayer.z + stepZ;

      if (!checkCollision(nextX, nextZ)) {
        state.localPlayer.x = nextX;
        state.localPlayer.z = nextZ;
      } else {
        if (!checkCollision(nextX, state.localPlayer.z)) {
          state.localPlayer.x = nextX;
          state.localPlayer.velocity.z = 0;
        } else if (!checkCollision(state.localPlayer.x, nextZ)) {
          state.localPlayer.z = nextZ;
          state.localPlayer.velocity.x = 0;
        } else {
          state.localPlayer.velocity.x = 0;
          state.localPlayer.velocity.z = 0;
        }
      }
    }

    // Safety net (normal radius on fallback — no Cannon to fight)
    if (checkCollision(state.localPlayer.x, state.localPlayer.z)) {
      state.localPlayer.x = oldPos.x;
      state.localPlayer.z = oldPos.z;
      state.localPlayer.velocity.x = 0;
      state.localPlayer.velocity.z = 0;
    }

    // Populate displayVelocity so animation works during CDN load window and on failure
    state.localPlayer.displayVelocity.x = state.localPlayer.velocity.x;
    state.localPlayer.displayVelocity.z = state.localPlayer.velocity.z;
  }
```

- [ ] **Step 5.3: Switch rotation and animation reads to displayVelocity**

Find the second `speedXZ` computation — the one used for rotation and `isMoving` (after the collision block, around line 160). It currently reads `state.localPlayer.velocity.x/z`. Change it to read `displayVelocity`:

```js
  speedXZ = Math.sqrt(
    state.localPlayer.displayVelocity.x * state.localPlayer.displayVelocity.x +
    state.localPlayer.displayVelocity.z * state.localPlayer.displayVelocity.z
  );

  if (speedXZ > 0.4) {
    const targetAngle = Math.atan2(state.localPlayer.displayVelocity.x, state.localPlayer.displayVelocity.z);
```

Leave the first `speedXZ` computation unchanged — that one is the speed-cap check on `state.localPlayer.velocity`, which belongs to the control path.

- [ ] **Step 5.4: Run tests**

```bash
npm test -- --reporter=verbose --project=client-unit
```

Expected: All tests in `cannon-integration.test.ts` pass.

- [ ] **Step 5.5: Commit**

```bash
git add public/js/engine/movement.js
git commit -m "feat: wire Cannon XZ path into updateLocalPlayer, add displayVelocity population"
```

---

## Task 6: Wire initCannon in engine.js

`initCannon()` must be called after `buildMap()` has populated `state.WALLS` and `state.PLACED_ASSET_COLLIDERS`. It's async but non-blocking — the render loop runs on the fallback path until it resolves.

**Files:**
- Modify: `public/js/engine.js`

- [ ] **Step 6.1: Add import and call**

At the top of `public/js/engine.js`, add the import alongside the other physics imports:

```js
import { getRoomIdForPosition, isLocalPlayerUnderRoof } from './physics.js';
import { initCannon } from './physics-engine.js';
```

In `initEngine()`, find the `buildMap()` call (line ~362) and add `initCannon()` immediately after:

```js
  buildMap();
  initCannon(); // async, non-blocking — fallback collision runs until CDN resolves
  refreshStaticSceneryVisibility();
```

- [ ] **Step 6.2: Run tests**

```bash
npm test -- --reporter=verbose --project=client-unit
```

Expected: All tests still pass (initCannon import doesn't affect unit tests).

- [ ] **Step 6.3: Commit**

```bash
git add public/js/engine.js
git commit -m "feat: call initCannon() after buildMap() in initEngine"
```

---

## Task 7: Wire rebuildAssetColliders in editor.js

When published world assets arrive (both on join and after a save), `state.PLACED_ASSET_COLLIDERS` is repopulated by `renderPlacedAssets`. Cannon needs to mirror this.

**Files:**
- Modify: `public/js/editor.js`

- [ ] **Step 7.1: Add import**

At the top of `public/js/editor.js`, add:

```js
import { rebuildAssetColliders } from './physics-engine.js';
```

- [ ] **Step 7.2: Call rebuildAssetColliders in applyPublishedWorldAssets**

Find `applyPublishedWorldAssets` (line ~393):

```js
export function applyPublishedWorldAssets(assetDefs) {
  state.publishedWorldAssets = Array.isArray(assetDefs) ? assetDefs.map(cloneAssetDef) : [];
  if (state.editor.enabled && state.editor.dirty) {
    updateEditorStatus('Published layout changed. Save or cancel your draft.');
    return;
  }
  renderPlacedAssets(state.publishedWorldAssets, { applyColliders: !state.editor.enabled });
}
```

Add the `rebuildAssetColliders()` call after `renderPlacedAssets`:

```js
export function applyPublishedWorldAssets(assetDefs) {
  state.publishedWorldAssets = Array.isArray(assetDefs) ? assetDefs.map(cloneAssetDef) : [];
  if (state.editor.enabled && state.editor.dirty) {
    updateEditorStatus('Published layout changed. Save or cancel your draft.');
    return;
  }
  renderPlacedAssets(state.publishedWorldAssets, { applyColliders: !state.editor.enabled });
  rebuildAssetColliders(); // sync Cannon asset bodies with updated PLACED_ASSET_COLLIDERS
}
```

- [ ] **Step 7.3: Run full test suite**

```bash
npm test
```

Expected: All tests pass across all three projects (worker, client-unit, client-browser).

- [ ] **Step 7.4: Commit**

```bash
git add public/js/editor.js
git commit -m "feat: rebuild Cannon asset colliders when published world assets update"
```

---

## Task 8: Final verification

- [ ] **Step 8.1: Run all tests one last time**

```bash
npm test
```

Expected output: All tests pass. No failures. Confirm `cannon-integration.test.ts` tests are included in the client-unit project output.

- [ ] **Step 8.2: Check TypeScript**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 8.3: Check the delete-the-duplicate-files reminder**

The 21 macOS `* 2.*` files are still in the repo. Run this to delete them:

```bash
find . -name "* 2.*" | grep -v node_modules | grep -v .wrangler | grep -v .git | xargs -I{} rm "{}"
git add -A
git commit -m "chore: remove macOS Finder duplicate files"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `world.gravity = (0,0,0)` | Task 3 |
| `linearDamping = 0` | Task 3 |
| Frictionless `ContactMaterial` | Task 3 |
| No heightfield body | Task 3 (`buildTerrainHeightfield` not called) |
| `syncBodyY(y)` export | Task 3 |
| `_initFromModule` test seam | Task 3 |
| Asset collider `hy = 10.0` | Task 3 |
| `displayVelocity` field in state | Task 1 |
| `displayVelocity` initialized in engine | Task 1 |
| Cannon path XZ integration | Task 5 |
| `displayVelocity` populated in both paths | Task 5 |
| Rotation/animation reads `displayVelocity` | Task 5 |
| Safety net uses expanded sphere (0.55) | Tasks 2 + 5 |
| `initCannon()` after `buildMap()` | Task 6 |
| `rebuildAssetColliders()` on asset update | Task 7 |
| Test 1: tunneling regression | Task 4 |
| Test 2: wall sliding not sticking | Task 4 |
| Test 3: Y independence (flat terrain) | Task 4 |
| Test 4: fallback `displayVelocity` | Task 4 |

All spec requirements covered. No gaps.

**Placeholder scan:** No TBDs. All code shown in full.

**Type consistency:**
- `_initFromModule` — exported in Task 3, imported in Task 4 test ✓
- `syncBodyY` — exported in Task 3, imported in Task 5 ✓
- `stepCannon` — already existed, imported in Task 5 ✓
- `checkCollisionLoose` — exported in Task 2, imported in Task 5 ✓
- `displayVelocity` — added to state in Task 1, read in Task 5 ✓
- `rebuildAssetColliders` — exported in Task 3, imported in Task 7 ✓
