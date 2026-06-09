# Scenery, Physics, and Lighting: Metalyceum Comparison

This document provides a detailed comparison of the **3D scenery, physics engine, and lighting systems** between the current version of Metalyceum and the state of the codebase approximately 10 commits ago (around commit `1f38eb0`).

---

## 1. Physics & Collision Engine

### 2D/XZ Proxy Architecture (Major Refactor)
* **Before (~10 commits ago):** Cannon-es acted as a full 3D physics engine with gravity set to `-25` and a compiled 3D Heightfield terrain collider. This setup was highly prone to solver jitter, collision clipping, and launching the player into space.
* **Now:** Cannon-es has been redesigned strictly as a **2D/XZ collision proxy**. Gravity in Cannon is set to `0`, and the terrain heightfield is completely removed. Wall and asset collision resolution are calculated in 2D (XZ), while vertical movement (gravity, jumping, swimming, elevators, and terrain-snapping) is handled manually in Javascript and synced back to the Cannon body each frame via `syncBodyY(manualY)`.

### Mezzanine Deck & Bridges
* **Before:** No vertical overlap colliders existed.
* **Now:** Added a second-floor mezzanine deck collider inside the lobby at $Y = 7.5$. It is only active when the player is already elevated ($Y > 3.0$), allowing ground-floor players to walk freely underneath. Physical road deck levels were also added for the **Road Bridge** (deck at `0.275`) and the **Stone Arch Bridge** (deck at terrain height $+ 3.6$).

### Friction and Sleeping Adjustments
* **Before:** Player had normal friction on contact materials, leading to "clinging" when rubbing against walls.
* **Now:** Friction and restitution are set to `0` for smooth wall-sliding. Player body `allowSleep` is disabled (`false`) so manual velocity updates always register.

### Placed Asset Colliders
* **Before:** Height colliders for placed assets were fixed to a half-height of `1.0` (span of $[-1, 1]$ relative to origin).
* **Now:** Bounding box half-height is increased to `10.0` (span of $[-10, 10]$) so that placed assets on steep hills correctly block the player.

---

## 2. Player Movement Mechanics

### Jetpack Flight System
* **Before:** No flight mechanics.
* **Now:** Added a flight system triggered by `T` (takeoff) and `Y` (land/crash).
  * Flight mode allows high-speed movement (`22.0` units/sec), with `Space` ascending and `Shift` descending up to a ceiling of `terrainY + 30`.
  * Features custom **procedural cascade-fan wings** (with metallic sheen matching the player's shirt color) that fold/unfold in sequence.
  * Uses a pre-allocated particle pool for thrust flame and smoke trails.
  * Landing triggers a physics-based crash sequence where the player tumbles, spins, and rolls upon hitting the ground before standing back up.

### Water & Swimming Physics
* **Before:** Riverbed was treated as dry land.
* **Now:** Added a river/lake bounding-box check. Walking into water switches the player to a swimming state, rendering a swimming animation and floating the player at chest-depth (`waterY + 0.2`) on the surface instead of letting them walk on the bottom.

### Sprinting
* **Before:** Single speed for walking/running.
* **Now:** Holding `Shift` engages sprint mode, scaling speed by 5x (sprint speed is `47.5`), acceleration by 1.8x, and adjusting the footstep animation rate.

### Terrain Sampling Performance Optimization
* **Now:** Capped height sampling so that when airborne or swimming, only 1 central sample is taken (`precise = false`) instead of 5 samples (center + 4 feet corners), saving significant CPU cycles.

---

## 3. Lighting & Atmosphere

### Daylight/Sunset Atmosphere
* **Before:** Deep night theme with a black sky background (`#030712`), dense dark fog (density `0.0075`), and cool blue ambient lights.
* **Now:** A bright daylight/sunset setting. The sky background is blue-grey (`#6b7a8a`) with warm sand fog (`#b8a888`, density `0.0028`). The sky dome features a gradient from `#5070a0` (top) to `#d4b888` (bottom).

### Render Quality & Performance
* **Before:** Exposure at `1.0`, pixel ratio capped at `2.0`, shadow map resolution `2048x2048` with `PCFSoftShadowMap`.
* **Now:** Exposure is bumped to `1.3`. Pixel ratio capped at `1.5`, shadow map resolution reduced to `1024x1024` with `PCFShadowMap` for performance, but the shadow camera frustum is narrowed (from `+/- 38` to `+/- 24`) to keep shadows sharp.

### Color Palette Settings
* **Ambient:** White `#ffffff` (0.15) $\rightarrow$ Warm peach `#f5d4a0` (0.045).
* **Hemisphere:** Sky blue/dark blue (0.78) $\rightarrow$ Dusk yellow `#dcc878` and brown `#5a4030` (0.12).
* **Sun:** Warm white (0.92, position `24, 48, 12`) $\rightarrow$ Bright golden hour yellow `#f0c878` (3.2, lower position `38, 22, 12` creating long dramatic shadows).
* **Fill:** Cool blue `#8ab4f8` (0.18) $\rightarrow$ Warm orange `#d4a060` (0.10).

### Smooth Indoor/Outdoor Transitions
* **Now:** Added a PointLight inside the lobby (`state.sceneIndoorLight`). Entering/exiting the building dynamically interpolates a `state._indoorMix` value from 0 to 1, smoothly shifting light intensities and colors to simulate human eye adjustment.

### Lighting Optimization
* Sun shadow-camera updates are now throttled (only updating when player moves $>2$ units), and torches are throttled to update every 2nd frame.

---

## 4. 3D Scenery & Geometry Optimization

### Modularization
* **Before:** Monolithic scenery script inside `venues.js`.
* **Now:** Modularized into independent scripts under `scenery/` (`river.js`, `roads.js`, `castle.js`, `airport.js`, etc.).

### New Scenery Elements
* **Meandering River:** Ribbon-based procedural mesh generation, custom procedural foam shader, a waterfall step with splashing particle systems, and two large lakes.
* **Opulent Elevator:** Located at the north end of the lobby, detailed with mahogany, gold, and brass. Moves between floors with animated doors, and dynamically toggles elevator door physics colliders on/off as it opens/closes.
* **Airport, Castle, Amphitheater & Roads:** Features runways, airplanes, castle towers/battlements, amphitheater steps, and roads conforming to the terrain profile.

### Geometry Batching (Performance)
* **Now:** Converted individual meshes into instanced batches to minimize draw calls:
  * 25 River boulders $\rightarrow$ 1 `InstancedMesh`.
  * 50 Daffodils (stems & heads) $\rightarrow$ 2 `InstancedMesh` batches.
  * Stone Arch Bridge (voussoirs, parapets, ramp steps) $\rightarrow$ batched into `InstancedMesh` objects.

---

## 5. Current Session — Refactoring & Lazy Loading

### Code Deduplication (Major Cleanup)
* **River polyline:** The 21-point river path was hardcoded identically in 4 places (`physics.js` × 2, `river.js`, `dev-tools.js`). Now exported once from `config.js` as `RIVER_PTS` and imported everywhere.
* **Point-to-segment distance:** Written 4× with different names (`_ptSegDist`, `_ptSegDist2`, `ptSegDist`, `pointToSegmentDistanceSquared`). Now a single `pointToSegmentDistSq` in `math.js` with all callers migrated.
* **Wood textures:** Two 80%-identical functions (`createWoodTexture`, `createDarkWoodTexture`) collapsed into one shared `_createWoodTexture(config)` helper.
* **HUD icon handlers:** 4 copy-paste click handlers (music, events, debug, controls) replaced with a config array loop.
* **Road segment data:** Amphitheater and concert venue road polylines were duplicated between `utils.js` and `physics.js`. Now exported once from `utils.js`.
* **`scenery/utils.js` function loss:** The last commit (`9619f97`) accidentally dropped 7 critical utility functions (`deformPlaneToTerrain`, `createGroundedPatch`, `addSceneryCollider`, `vec2LengthAngle`, etc.). Recovered from `HEAD~1` and restored.

### Rotation Constants
* **66 hardcoded** `rotation.x = -Math.PI / 2` and `rotation.x = Math.PI / 2` replaced with `FLAT` / `HALF_PI` constants across 10 files.

### Lazy-Loaded Distant Scenery
* **Before:** All 15 scenery modules statically imported and constructed at page load, including airport (272u from spawn), castle (152u), and underground city (144u).
* **Now:** A proximity-based lazy loader (`lazy-venues.js`) polls the player's position every 2 seconds. Airport, castle, and underground city are dynamically imported via `import()` only when the player approaches within 95-120 units. Eager build now serves 12 modules instead of 15.

### Lighting Refinements
* **RuneScape-style warm golden-hour:** Sky changed from dark navy (`#0a1628` → `#101c38`) to warm blue-tan (`#5070a0` → `#d4b888`). Fog from dark (`#030712`, density 0.0075) to warm haze (`#b8a888`, density 0.0028).
* **Smooth indoor/outdoor transitions:** Added `state._indoorMix` (0→1) that smoothly lerps all light intensities and colors over ~0.5 seconds when entering/exiting the building. Sun fades from 3.2 to 0.12, hemisphere shifts to warm bounce light, indoor point light rises to 0.4.

### Jetpack Cascade-Fan Wings
* **New:** 8 wing segments (4 per side) attached to the player's back/shoulder area. Each trapezoidal panel folds/unfolds in sequence with a staggered cascade animation (0.12s delay per segment). Bronze trim accents, color matches player's shirt.

### Elevator Refactor
* **Before:** Two conflicting animation systems (`engine.js` + `elevator.js`), doors slid linearly, no room collision, doors stayed at ground level when car rose.
* **Now:** Single state machine (`idle → opening → open → waiting → closing → riding → arrival → open`). Doors swing on hinge pivots as children of the car. Proper room collision (3 Box3 walls + dynamic door blocker). Ride-side menu shows only the relevant button (▲ up on ground, ▼ down on 2nd floor). Upper floor fade follows ride progress.

### Dev-Tools Production Guard
* **Before:** `initDevTools()` ran unconditionally on `metalyceum.app`, consuming CPU for runtime inspection and audit markers never seen by end users.
* **Now:** Gated behind `_isDev` check — only activates on `localhost`, `127.0.0.1`, or when `?debug` is in the URL.
