# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Metalyceum** — a 3D social event world with room-based YouTube Live and Google Meet sessions. Players navigate a Three.js r184 ESM scene on the client; the server is a Cloudflare Worker routing to two Durable Objects: `MetalyceumWorld` (live game state) and `AdminDO` (user accounts, auth).

## Commands

```bash
npm run dev        # wrangler dev — local development server
npm run deploy     # wrangler deploy — publish to Cloudflare
npm run typecheck  # tsc --noEmit — type-check TypeScript sources in src/
npm run typecheck:test # tsc --noEmit -p test/tsconfig.json — type-check test sources
npm run test       # vitest run — run all tests
npm run test:e2e   # playwright test — run browser/e2e tests
```

No lint/format scripts. Tests live in `src/**/*.test.ts` and `test/client/*.test.ts`.

## Architecture

### Server (`src/`)

**Entry point**
- **`index.ts`** — Worker entry point. Routes `/api/v1/*` to `AdminDO`, `/ws` and `/debug` to `MetalyceumWorld`; all other requests served from static assets (`ASSETS` binding). Applies security headers, CORS, and request IDs to Worker responses.

**Durable Objects**
- **`durable_object.ts`** — `MetalyceumWorld extends DurableObject`. Single global instance (`idFromName("global-world")`). Holds all session state in memory (`sessions: Map<WebSocket, Session>`), persists room events and world assets in SQLite (`ctx.storage.sql`). Handles all WebSocket message types: join, move, chat, room-update, asset CRUD.
- **`admin/do.ts`** — `AdminDO extends DurableObject`. Manages user accounts, sessions, password resets, and audit logs. Handles all `/api/v1/*` HTTP routes for the admin control panel.

**Pure/testable modules**
- **`realtime.ts`** — Pure functions for player relevance (proximity/room filtering) and chat scope resolution. No `cloudflare:workers` imports — tested directly.
- **`validation.ts`** — Pure sanitization/parsing helpers. No `cloudflare:workers` imports — tested directly. This is the only place input validation happens for the game world.
- **`session_source.ts`** — Parses session origin (site vs. API) from request headers.
- **`constants.ts`** — All numeric limits, shared TypeScript types (`Player`, `Session`, `RoomEvent`, `Bindings`), and `DEFAULT_ROOMS` seeds.

**`src/admin/` — admin subdirectory**
- **`admin/schemas.ts`** — Zod-style validation, crypto helpers (PBKDF2, constant-time compare), rate limit constants, and type definitions for `User`, `Session`, `PasswordReset`, `AuditEntry`.
- **`admin/json.ts`** — Re-exports `parseJsonObjectBody` from `http/json.ts` (convenience re-export for admin DO).
- **`admin/pagination.ts`** — Parses `limit`/`cursor` query params for paginated admin API responses.

**`src/http/` — HTTP utility layer**
- **`http/errors.ts`** — `ErrorEnvelope` type and `errorEnvelope()` factory for consistent JSON error responses.
- **`http/json.ts`** — `parseJsonObjectBody()` — reads and type-narrows a request body as a JSON object.
- **`http/request_id.ts`** — Generates/propagates `X-Request-Id` headers.

**`src/internal/` — cross-DO communication contracts**
- **`internal/admin_endpoints.ts`** — `INTERNAL_ADMIN_PATHS` constants for routes that `AdminDO` calls on `MetalyceumWorld` (broadcast, world-state, sync-room, world-assets).
- **`internal/world_response.ts`** — `InternalWorldResponse<T>` type and type guard for responses from `MetalyceumWorld` to `AdminDO`.

### Client (`public/`)

**Entry point**
- **`app.js`** — ES6 module entry point. Only file loaded via `<script type="module">` in `index.html`. Initializes engine, UI, room panel, audio, and visibility/performance optimizations. Sets `window.onYouTubeIframeAPIReady`.

**Shared state**
- **`js/state.js`** — Single shared mutable `state` object imported by all client modules.
- **`js/config.js`** — Client-side configuration constants.

**Module coordinator pattern** — Several top-level files act as coordinators that import from a same-named subdirectory and re-export a unified API. Callers import from the top-level file; the subdirectory files own the actual implementations:

- **`js/engine.js`** — Coordinator: Three.js render loop, scene setup, skybox. Re-exports camera and movement API from `engine/`.
  - **`js/engine/camera.js`** — Camera follow, orbit, exit-camera watch.
  - **`js/engine/movement.js`** — Local player movement loop (`updateLocalPlayer`).
- **`js/building.js`** — Coordinator: constructs full building structures by composing parts from `building/` and helpers from `scenery/utils.js`.
  - **`js/building/doors.js`** — Door frame geometry.
  - **`js/building/interiors.js`** — Classroom asset sets.
  - **`js/building/roof.js`** — Roof geometry.
  - **`js/building/torches.js`** — Wall torch meshes.
- **`js/scenery.js`** — Pure barrel: re-exports everything from all `scenery/` submodules. No logic of its own.
  - **`js/scenery/assets.js`** — Shared geometries, sprites, boulders.
  - **`js/scenery/foliage.js`** — Trees, bushes, flowers.
  - **`js/scenery/interiors.js`** — Room interior sets.
  - **`js/scenery/plaza.js`** — Plazas, fountains, room indicators.
  - **`js/scenery/airport.js`**, **`amphitheater.js`**, **`castle.js`**, **`concert-venue.js`**, **`river.js`**, **`roads.js`**, **`underground-city.js`** — Large outdoor landmarks and routes.
  - **`js/scenery/utils.js`** — Terrain deformation, terrain-aware collider helpers.
  - **`js/scenery/venues.js`** — Amphitheater, concert hall geometry.
  - **`js/scenery/visibility.js`** — Frustum/distance culling, sprite disposal.
  - **`js/scenery/world-details.js`** — Instanced ground-cover details.
- **`js/room-panel.js`** — Coordinator: room panel core logic (modal open/close, panel cache) + re-exports from `room-panel/`.
  - **`js/room-panel/event-board.js`** — Room status board rendering.
  - **`js/room-panel/media.js`** — YouTube iframe API and Google Meet sync.
  - **`js/room-panel/player-list.js`** — In-panel player avatar list.
- **`js/ui.js`** — Coordinator: HUD panels, chat submit, event board selection, general UI handlers + re-exports from `ui/`.
  - **`js/ui/debug-panel.js`** — Performance metrics, error log.
  - **`js/ui/login.js`** — Login form, avatar color picker.
  - **`js/ui/soundtrack-panel.js`** — Music player UI.

**Standalone modules**
- **`js/multiplayer.js`** — WebSocket connection, reconnection logic, message dispatch, network profiles (8–50 Hz position update rate, configurable via `localStorage['metalyceum:netProfile']`).
- **`js/physics.js`** — Terrain height sampling, collision detection (sphere vs AABB), room-id lookup for a position, roof detection.
- **`js/physics-engine.js`** — Cannon-es XZ collision proxy loaded from CDN in production and from the npm package in tests. Owns wall/asset collision resolution only; Y movement stays manual in `engine/movement.js`.
- **`js/audio.js`** — Ambient MIDI soundtrack, audio context management.
- **`js/chat.js`** — Chat log, chat bubble display, scope (global vs. room).
- **`js/dev-tools.js`** — Runtime development tools and scene/object inspection helpers.
- **`js/theater.js`** — In-world screen/theater rendering.
- **`js/characters.js`** — Character/avatar model helpers.
- **`js/textures.js`** — Texture loading and caching.
- **`js/editor.js`** — World asset editor (placement, drag, persist via WebSocket).
- **`js/minimap.js`** — 2D minimap overlay.
- **`js/environment.js`** — Sky, fog, ambient environment setup.
- **`js/lighting.js`** — Scene lighting setup.
- **`js/math.js`** — Shared math utilities.
- **`js/room-animation.js`** — Animated room entrance/exit transitions.
- **`js/modals.js`** — Generic modal dialog helpers.
- **`js/utils.js`** — Shared helpers (e.g., `applyRoomData`).
- **`js/debug-tweaks.js`** — *(deleted; lil-gui panel removed)*

## LLM world-building tools

When building or adjusting world geometry, use the `window.metalyceumDev` API available in the browser dev mode (toggle the debug panel with the backtick key). **Never do coordinate math manually** — use these tools instead.

### Before writing any new geometry

```js
// What's the terrain height at my build site? (replaces writing getTerrainHeight manually)
metalyceumDev.terrainAt(130, -80)               // → 2.847

// Full site check: terrain, room, river proximity, collisions, nearest landmarks
metalyceumDev.worldQuery(130, -80)

// Terrain profile across a new build area (understand the landscape before coding)
metalyceumDev.sampleTerrain(130, -80, 40, 7)    // cx, cz, radius, grid steps

// Find a clear spot for a new structure of given radius
metalyceumDev.findClearSpace(25)                // → [{x, z, terrainHeight, distFromCentre}, ...]
```

### Auditing and fixing clipping/z-fighting

```js
metalyceumDev.audit()                           // → issues array; also updates 2D map overlays
metalyceumDev.getAuditIssues()                  // → same issues array without re-running
metalyceumDev.suggestFix(0)                     // for issue at index 0: returns {action, newPos/delta/newY}
```

`suggestFix` returns concrete values to paste back into source:
- **clipping / z-fighting** → `{assetIdToMove, delta: {x,z}, newPos: {x,z}}`
- **floating / buried** → `{assetId, newY, delta}`
- **river encroachment** → `{assetId, delta, newPos}`

### Generating collision geometry

```js
// PLACED_ASSET_COLLIDERS entry for a box footprint
metalyceumDev.colliderBox(130, -80, 60, 60, 'castle')
// → {minX, maxX, minZ, maxZ, assetId} — paste into state.PLACED_ASSET_COLLIDERS.push(...)

// state.WALLS Box3 entry
metalyceumDev.wallBox(-85, 140, 46, 34, 10, baseY)
// → {min, max, jsCode} — jsCode is a ready-to-paste new THREE.Box3(...) call
```

### Landmark positioning (no reload needed)

```js
// Move a landmark group live — see result immediately
metalyceumDev.setLandmark('castle', {x: 5, y: 0, z: -2, rotY: 0.1})

// Read back the current offset to paste into source
metalyceumDev.getLandmark('castle')             // → {x, y, z, rotY}

// Warp to a landmark to inspect it
metalyceumDev.teleportTo('castle')

// List all landmarks
metalyceumDev.listLandmarks()  // ['castle','airport','amphitheater','concertVenue','undergroundCity']
```

Live landmark adjustment is done via the console only — the lil-gui panel was removed.

### World state snapshot

```js
// Full JSON: landmarks (with live offsets), rooms, walls, placed assets, player position
metalyceumDev.snapshot()

// Road/ramp planning: XZ distance, terrain heights at endpoints, slope %
metalyceumDev.measure(65, 150, -85, 140)

// Placed asset inventory by type
metalyceumDev.listAssets()
```

### Object inspection and positioning

```js
// Scan all state.STATIC_SCENERY for Y misalignment and unexpected tilt
metalyceumDev.auditStaticScenery(0.4)
// → [{index, kind, worldPos, terrainY, diff, severity, type, message}, ...]
// Toggle "Show Misalign Markers" in the lil-gui panel to see 3D markers

// Detailed world-transform for objects within radius of player
metalyceumDev.inspectNearby(30)
// → [{source, worldPos, worldRotDeg, scale, terrainY, yAboveTerrain, dist}, ...]

// Alt+click any mesh (debug panel open) → logs world transform to console
metalyceumDev.getLastInspected()       // → {geometry, worldPos, worldRotDeg, worldScale, yAboveTerrain, parentChain}
metalyceumDev.clearInspected()
```

### Proximity and intersection

```js
// Pairwise edge distances for all objects near a point
metalyceumDev.proximity()              // within 60u of player
metalyceumDev.proximity(130, -80, 80)  // within 80u of (130, -80)
// → [{a, b, centreDist, edgeDist, status}] sorted by edgeDist
// status: 'INTERSECTING' (edgeDist<0), 'touching' (<0.3u), 'close' (<2u), 'clear'

// Top N nearest objects to a point, with edge-to-edge distance
metalyceumDev.nearestObjects()         // top 10 nearest to player
metalyceumDev.nearestObjects(130, -80, 15)
// → [{label, id, x, z, r, centreDist, edgeDist}, ...]
```

### Z-fighting and shimmering

```js
// Scan flat meshes near the player for terrain z-fighting and surface-on-surface overlap
metalyceumDev.auditZFighting()        // → issues[], 200u radius
metalyceumDev.auditZFighting(60)      // tighter scan around current position
metalyceumDev.getZFightIssues()       // return cached results without re-scanning
metalyceumDev.toggleZFightMarkers()   // flip coloured 3D ring markers on/off
```

Each issue includes a `fix` field with the exact material change needed:
- `terrain-zfight` → add `polygonOffset: true, polygonOffsetFactor: -2` to material, or raise mesh Y
- `surface-zfight` → add `polygonOffset` to the upper mesh's material

Severity: `critical` (<0.005u gap) · `high` (<0.02u) · `medium` (<0.06u) · `info` (offset present but gap is essentially zero)

### Consolidated build audit

Run this after adding or modifying geometry in any area. It bundles all checks into one call.

```js
// Audit the area around the player (60u radius)
metalyceumDev.buildAudit()

// Audit a specific area — use this when editing a scenery file
metalyceumDev.buildAudit(130, -80, 80)   // cx, cz, radius

// Returns:
// {
//   site:        worldQuery result for the centre
//   terrain:     { min, max, maxSlope, isFlat }
//   zfighting:   { critical, high, medium, issues[] }
//   placedAssets:{ count, issues[] }
//   scenery:     { count, issues[] }
//   summary:     'CLEAN' | 'N issues'
// }
```

### Key data sources

- **`LANDMARK_REGISTRY`** in `public/js/config.js` — authoritative landmark names, center coords, radii. All landmark-aware code reads from here; never hardcode these values elsewhere.
- **`state.landmarkGroups`** — `Map<string, THREE.Group>` holding each landmark's root group. All 5 landmark scenery files register their group here after building.
- **Scenery files** (`public/js/scenery/castle.js` etc.) use a root `THREE.Group` that is both added to `state.scene` and registered in `state.landmarkGroups`. Moving the group offsets all child meshes.

## Running dev tools during a coding session

When writing or modifying scenery/building code, verify the result in-browser using the Chrome browser automation tools (`mcp__claude-in-chrome__*`). This is the authoritative check — type-checking and tests cannot catch geometry placement errors.

### Workflow

1. **Ensure the dev server is running.** If not: `npm run dev` (use `run_in_background: true`).

2. **Get a browser tab.** Use `mcp__claude-in-chrome__tabs_context_mcp` to find an existing tab, or create one with `mcp__claude-in-chrome__tabs_create_mcp` and navigate to `http://localhost:8787`.

3. **Wait for the world to load.** The map builds asynchronously. Poll with:
   ```js
   // Paste into mcp__claude-in-chrome__javascript_tool
   typeof window.metalyceumDev !== 'undefined' && window.metalyceumDev.terrainAt !== undefined
   // → true once the API is live
   ```

4. **Teleport to the area being worked on** (no need to walk there):
   ```js
   metalyceumDev.teleport(130, -80)          // by coordinates
   metalyceumDev.teleportTo('castle')        // by landmark name
   ```

5. **Run the audit.** Use the centre of the modified area and a radius that covers it:
   ```js
   metalyceumDev.buildAudit(cx, cz, radius)
   ```
   Read results via `mcp__claude-in-chrome__read_console_messages` (filter on `[buildAudit]`).

6. **Fix any issues**, then re-run until the report shows `summary: 'CLEAN'`.

### Which tool for which situation

| Situation | Command |
|-----------|---------|
| After adding a road, carpet, or flat floor mesh | `metalyceumDev.auditZFighting(60)` |
| After moving a landmark | `metalyceumDev.audit()` |
| After adding static scenery groups | `metalyceumDev.auditStaticScenery(0.4)` |
| Before placing new geometry — understand the site | `metalyceumDev.worldQuery(x, z)` |
| Full area verification (before committing) | `metalyceumDev.buildAudit(cx, cz, radius)` |
| Investigating a specific object | Alt+click the mesh in-game → `metalyceumDev.getLastInspected()` |
| Checking terrain slope for a road/ramp | `metalyceumDev.sampleTerrain(cx, cz, r, 7)` |

### What to do with audit results

- **`terrain-zfight`**: add `polygonOffset: true, polygonOffsetFactor: -2` to the mesh's material, OR raise its Y by the `gap` amount shown in the `fix` field.
- **`surface-zfight`**: add `polygonOffset` to the upper mesh's material.
- **`floating` / `buried`**: use `metalyceumDev.suggestFix(n)` to get the exact corrected Y.
- **`clipping`**: use `metalyceumDev.suggestFix(n)` to get the minimum separation delta.

### Important: log in first

Most `metalyceumDev` tools require a joined player session (`state.isJoined = true`). `worldQuery`, `terrainAt`, and `sampleTerrain` work without joining, but `auditZFighting`, `audit`, and `buildAudit` need the scene to be fully built. Log in with any username/avatar color before running audits.

## Conventions and constraints

- **Three.js r184 via CDN import map** — browser code imports `three`, `three/addons/*`, and `lil-gui` through the import map in `public/index.html`. Files that reference Three.js should import it explicitly with `import * as THREE from 'three'`; controls use named imports from `three/addons/...`.
- **npm `three` is test-only legacy support** — `package.json` still carries `three@0.128.x` and `@types/three@0.128.x` for existing test/runtime shims. Do not treat those package versions as the browser runtime version.
- **`src/validation.ts`, `src/realtime.ts`, `src/session_source.ts`, `src/http/*`, `src/admin/pagination.ts`, `src/admin/schemas.ts`, `src/internal/*` must stay free of `cloudflare:workers` imports** — this is what makes them testable with plain Vitest outside the Workers runtime.
- **Coordinator/barrel pattern** — `engine.js`, `building.js`, `scenery.js`, `room-panel.js`, `ui.js` are the public API for their domain. Callers always import from the top-level file, never from the subdirectory directly (except within the same domain).
- **`public/_headers`** — the only way to set headers on static asset responses. The Worker doesn't run for asset requests; adding header logic to `index.ts` won't affect them.
- **Security headers** — `index.ts` applies security headers to Worker responses; CSP is a `<meta>` tag in `index.html`; `public/_headers` covers static assets.
- **`.wrangler/`** — auto-generated, never edit manually.
- **All types centralized** — `src/constants.ts` is the source of truth for numeric limits, game types, and `DEFAULT_ROOMS`. Add new shared constants there.
- **Two DO instances** — `MetalyceumWorld` (game, `idFromName("global-world")`) and `AdminDO` (accounts, `idFromName("admin")`). Neither is sharded.
