# Cannon-es Integration Design

**Date:** 2026-05-31  
**Status:** Approved for implementation  
**Problem:** Players clip through terrain and thin obstacles. The manual axis-split collision in `movement.js` tunnels at speed and the Y terrain-follow lerp lags one frame behind on slope edges.

---

## Decision

Use Cannon-es as a **pure XZ collision proxy**. It resolves wall/asset contacts; the manual system keeps full ownership of Y (terrain-follow, jump, gravity). The hybrid was already architected in `physics-engine.js` and partially wired into `movement.js` — this completes the integration.

---

## Architecture

### What Cannon owns
- XZ position of the player (after collision resolution each frame)
- Wall and placed-asset collider bodies

### What the manual system owns
- Y position (terrain-follow lerp, jump, gravity — unchanged)
- All velocity computation (acceleration, drag, speed-cap, camera-relative direction — unchanged)
- `displayVelocity` population on the fallback path

### What neither owns (removed)
- The heightfield body is **not built**. Y is manual so the heightfield never actually constrains Y; it only risks injecting lateral XZ jitter via slope contact normals. Terrain stays entirely in the manual path.

---

## Cannon Body Setup (`createPlayerBody` in `physics-engine.js`)

```
mass: 1          (DYNAMIC — solver must push it out of walls)
linearDamping: 0 (all drag from manual system, not Cannon)
fixedRotation: true (already set)
```

**Gravity:** `world.gravity.set(0, 0, 0)` — Y is manual; Cannon gravity would sag the body's Y between substeps, tilting contact normals.

**Contact material:** Create a `ContactMaterial` between the player material and the default world material with `friction: 0, restitution: 0`. This makes the body a pure collision proxy — Cannon resolves penetrations but adds no lateral friction or bounce to the control velocity.

**No heightfield body** — `buildTerrainHeightfield()` is not called.

---

## Asset Collider Y Fix (`buildAssetColliders` in `physics-engine.js`)

**Current bug:** `hy = 1.0, position.y = 0` — collider spans Y [-1, 1]. On terrain with height > 0.6 units the player sphere (center at `terrainHeight + 0.4`) clears the collider entirely, making placed assets phantom.

**Fix:** Use `hy = 10.0` (half-height), center body at `y = 0`. Collider then spans Y [-10, 10], which covers the full terrain height range (max amplitude ~3.7 units) in all cases. The manual `checkCollision` already uses Y [-20, 20] for the same reason.

---

## Two Velocity Tracks

| Field | Owner | Used for |
|---|---|---|
| `state.localPlayer.velocity` | Manual system | Acceleration input, drag, speed cap — the control velocity |
| `state.localPlayer.displayVelocity` | Read from Cannon (or copied from velocity on fallback) | Avatar facing angle, walk animation |

`displayVelocity` is a new `THREE.Vector3` added to `state.js`. The second `speedXZ` computation in `updateLocalPlayer` — the one used for heading angle, `isMoving`, and walk animation — switches to read from `displayVelocity`. The first `speedXZ` (used to cap control velocity) remains on `velocity`. This means `isMoving` correctly reflects post-collision actual motion, not the player's intended velocity.

This prevents a wall graze from draining control momentum — the player re-accelerates from their intended velocity, not from the post-collision residual.

---

## Per-Frame Movement Flow (`updateLocalPlayer` in `engine/movement.js`)

### When Cannon is ready

Steps in order, replacing the current XZ integration block:

1. **Compute velocity** — existing accel/drag/speed-cap/camera-relative logic. No changes.
2. **Push control velocity to body:**
   ```
   playerBody.velocity.x = state.localPlayer.velocity.x
   playerBody.velocity.z = state.localPlayer.velocity.z
   ```
3. **Sync Y into body** — call `syncBodyY(state.localPlayer.y)`:
   ```
   playerBody.position.y = state.localPlayer.y + PLAYER_RADIUS
   playerBody.velocity.y = 0
   ```
   This keeps wall/asset colliders geometrically intersectable regardless of terrain height. Since Y is set every frame before stepping, Cannon's Y position stays in sync.
4. **Step:** `stepCannon(dt)` — uses existing `world.step(1/60, dt, 3)`.
   - Tunneling check: max per-substep travel = 9.5 / 60 = **0.158 units**. Thinnest wall AABB ≈ **0.66 units** (0.5 mesh + 0.08 baseboard each face). Margin is 4×, so no tunneling risk at current speeds. If max speed is ever raised above ~39 u/s this needs revisiting.
5. **Read XZ position back:**
   ```
   state.localPlayer.x = playerBody.position.x
   state.localPlayer.z = playerBody.position.z
   ```
6. **Populate `displayVelocity`:**
   ```
   state.localPlayer.displayVelocity.x = playerBody.velocity.x
   state.localPlayer.displayVelocity.z = playerBody.velocity.z
   ```
7. **Safety net (gross-failure only):** Run `checkCollision` with an **expanded sphere radius** (e.g. 0.55 instead of 0.40 — 0.15 margin) against the current position. This only fires if Cannon placed the player significantly inside a collider, not on positions Cannon considers valid. If it fires:
   ```
   state.localPlayer.x = oldPos.x
   state.localPlayer.z = oldPos.z
   state.localPlayer.velocity.x = 0
   state.localPlayer.velocity.z = 0
   teleportPlayer(oldPos.x, oldPos.z)   // sets playerBody.position.x/z, zeroes body velocity
   ```
   `teleportPlayer` already sets `playerBody.position.x/z` and zeroes `playerBody.velocity`, so the body will not be at a stale position on the next frame — no stutter loop.

### When Cannon is not ready (fallback)

Existing axis-split XZ collision path runs unchanged, including the existing safety-net with normal sphere radius. **Add one step after manual move:**
```
state.localPlayer.displayVelocity.x = state.localPlayer.velocity.x
state.localPlayer.displayVelocity.z = state.localPlayer.velocity.z
```
This ensures animation and rotation work correctly during the CDN load window and on CDN failure.

### Y path

Unchanged in both branches. `getTerrainHeight`, `getFootAnchoredHeight`, gravity, grounding, jump — no modifications.

---

## Initialization

In `engine.js` `initEngine()`, after `buildMap()`:
```js
import { initCannon } from './physics-engine.js';
// ...
buildMap();
initCannon(); // async, non-blocking — render loop runs on fallback until ready
```

`initCannon()` is already guarded against double-calls and logs a warning on CDN failure.

In `editor.js`, after a placed-asset save is persisted to the server, call `rebuildAssetColliders()`. This removes old asset bodies and re-adds from the current `state.PLACED_ASSET_COLLIDERS`.

---

## Files Changed

| File | Change |
|---|---|
| `public/js/physics-engine.js` | Remove `buildTerrainHeightfield` call; set `world.gravity = (0,0,0)`; set `linearDamping = 0` + frictionless `ContactMaterial`; add `syncBodyY(y)`; fix `buildAssetColliders` Y range (`hy = 10.0`) |
| `public/js/engine/movement.js` | Replace XZ integration block with Cannon path; add fallback `displayVelocity` copy; switch rotation/animation reads to `displayVelocity`; expand safety-net sphere radius |
| `public/js/engine.js` | Call `initCannon()` after `buildMap()` |
| `public/js/state.js` | Add `displayVelocity: new THREE.Vector3()` to localPlayer |
| `public/js/editor.js` | Call `rebuildAssetColliders()` after asset save |

---

## Test Plan (headless Node — cannon-es is pure math, no WebGL required)

All four tests run in the existing `test/` infrastructure.

### Test 1 — Tunneling regression
**Setup:** Initialize Cannon world with a single wall collider of realistic thickness (0.5 units). Place the player 0.5 units from the near face. Set `playerBody.velocity = {x: 0, z: 200}` (inflated to simulate frame spike). Call `world.step(1/60, 1.0, 10)` (simulates a 1-second frame drop with 10 substeps).  
**Assert:** `playerBody.position.z` is on the near side of the wall (< wall far face). Player must not have passed through.

### Test 2 — Wall sliding, not freezing
**Setup:** Initialize Cannon with a wall running along the Z axis. Spawn player against the wall with `velocity = {x: 5, z: 5}` (diagonal into the wall).  Run 30 frames via the Cannon-path movement loop (push velocity, syncBodyY, step, read back, safety-net with expanded radius).  
**Assert:** `state.localPlayer.z` increases across frames (player slides along the wall's tangent). `state.localPlayer.x` stays ≤ wall near face (player does not pass through). The safety net must not revert on every frame (sticking would produce zero Z progress).

### Test 3 — Y independence
**Setup:** Run both the Cannon path and the fallback path for 60 frames on **flat terrain** (`getTerrainHeight` returns 0 everywhere). Feed identical WASD key sequences to both runs. Do not vary XZ between runs — drive them with the same fixed `state.localPlayer.x/z` sequence (bypassing XZ divergence entirely).  
**Assert:** `state.localPlayer.y` is identical (within float epsilon) in both runs across all 60 frames. Any difference means Cannon is contaminating Y.  
*(Flat terrain eliminates the confound where legitimate XZ divergence produces different terrain heights and therefore different Y — that would be a false failure.)*

### Test 4 — Fallback correctness
**Setup:** Do not call `initCannon()`. Run the manual axis-split path through three sub-cases:
- (a) Head-on wall collision — assert player stops, velocity zeroed.
- (b) Diagonal collision (45°) — assert one axis slides, one zeroes (standard axis-split).
- (c) Corner trap (both axes blocked) — assert player stops cleanly, no jitter.  
**Assert:** `displayVelocity` is populated correctly in all three cases (equals `state.localPlayer.velocity` after each move, since that's what the fallback path copies).

---

## Non-goals

- Remote player physics — they use lerp-based smoothing, no changes.
- Jump feel — Y physics unchanged.
- NPC movement — no changes.
- Any change to `physics.js` (`checkCollision`, `getTerrainHeight`, room helpers).
