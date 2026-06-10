# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this is

**Metalyceum** — a real-time, browser-based 3D social event world with room-based YouTube Live and Google Meet sessions. Players navigate a Three.js r184 ESM scene on the client; the server runs on Cloudflare Workers with two Durable Objects: `MetalyceumWorld` (game state, WebSockets) and `AdminDO` (auth, audit). Persistence is via DO SQLite.

## Commands

```bash
npm run dev             # wrangler dev — local dev server on localhost:8787
npm run deploy          # wrangler deploy — publish to Cloudflare
npm run typecheck       # tsc --noEmit — type-check TypeScript in src/
npm run typecheck:test  # tsc --noEmit -p test/tsconfig.json — type-check tests
npm run test            # vitest run — 111 unit + client tests
npm run test:e2e        # playwright test — browser/e2e tests
```

No lint or format scripts are configured.

## Recent Refactoring (June 2026)

The codebase underwent a major DRY/refactoring pass. Key outcomes:

### File size reductions
| File | Before | After | Change |
|------|--------|-------|--------|
| `dev-tools.js` | 2476 lines | 1634 lines | −842 (LLM API → `ui/dev-api.js`) |
| `config.js` | 925 lines | 396 lines | −529 (soundtracks → `midi/soundtrack-data.js`) |
| `plaza.js` | 819 lines | 600 lines | −219 (fountain water → `scenery/fountain-water.js`) |
| `multiplayer.js` | 571 lines | ~480 lines | −91 (switch → handler registry) |
| `interiors.js` | 161 lines | 46 lines | −115 (shared furniture factories) |

### New shared modules created
| Module | Location | Contents |
|--------|----------|---------|
| **furniture factories** | `scenery/furniture.js` | `createBench`, `createPlant`, `createCircleTable`, `createChair`, `createBookshelf`, `placeTableWithChairs` |
| **fountain water** | `scenery/fountain-water.js` | Animated water surfaces, big apple column, water blob, pool ripples, spray jets, bubbles, orbiting fish |
| **dev state** | `ui/dev-state.js` | `devState` + `devTeleport` — extracted from dev-tools.js monolith |
| **dev API** | `ui/dev-api.js` | `window.metalyceumDev` — 25 inspection/audit/teleport methods |
| **soundtrack data** | `midi/soundtrack-data.js` | 10 MIDI track definitions (was 531 inline lines in config.js) |
| **physics barrel** | `physics/index.js` | Re-exports from physics.js + physics-engine.js — single import point |
| **engine barrel** | `engine/index.js` | Re-exports from engine/camera.js, movement.js, jetpack.js |
| **UI barrel** | `ui/index.js` | Re-exports from all ui/*.js sub-modules |

### Pattern changes
- **Handler registry**: `multiplayer.js` replaced a 180-line switch with `MSG_HANDLERS` object lookup
- **Asset factories**: `editor.js` replaced an 11-branch if/else with `ASSET_FACTORIES` registry
- **Venue registry**: `config.js` `VENUE_REGISTRY` drives both eager and lazy venue loading (add venue = one config entry)
- **Barrel files**: `physics/`, `engine/`, `ui/` now have `index.js` — import via `'./physics/'` instead of `'./physics.js'` + `'./physics-engine.js'`
- **Constant extraction**: 66 hardcoded `-Math.PI/2` replaced with `FLAT` / `HALF_PI` across 10 files
- **River polyline**: was hardcoded in 4 files, now exported once from `config.js`
- **Wood textures**: 2 nearly-identical functions collapsed into `_createWoodTexture(config)` helper

### Remaining large files
| File | Lines | Notes |
|------|-------|-------|
| `castle.js` | 1882 | Single 1551-line `buildCastle()` with merge-aware batching — high-risk to split |
| `dev-tools.js` | 1634 | Still contains audit + map + init — `dev-audit.js` and `dev-map.js` are future splits |
| `building.js` | 1113 | 60% sub-moduled into `building/*.js`; facade section (~476 lines) remains inline |
| `audio.js` | 789 | Well-structured — not a priority |
| `upstairs.js` | 772 | Furniture factories extracted; remaining is zone layout data |

## Architecture

### Server (`src/`) — TypeScript

**Entry point**
- **`index.ts`** — Worker entry. Routes `/api/v1/*` to `AdminDO`, `/ws` and `/debug` to `MetalyceumWorld`; all other requests served from `ASSETS` binding. Applies security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`), CORS, and request IDs.

**Durable Objects**
- **`durable_object.ts`** — `MetalyceumWorld extends DurableObject`. Single global instance (`idFromName("global-world")`). Holds session state in memory (`sessions: Map<WebSocket, Session>`), persists room events + world assets + chat in SQLite (`ctx.storage.sql`). Handles all WebSocket messages: join, move, chat, room-update, asset CRUD. Routes `/ws` for WebSocket upgrade, `/debug` for world state dump.
- **`admin/do.ts`** — `AdminDO extends DurableObject`. Manages user accounts, sessions, password resets, audit logs. Handles `/api/v1/*` HTTP routes.

**Pure/testable modules** (no `cloudflare:workers` imports — testable outside Workers runtime)
- **`realtime.ts`** — Player proximity relevance (room/lobby filtering) and chat scope resolution.
- **`validation.ts`** — Input sanitization/parsing (text, colors, video URLs, asset definitions, time/duration).
- **`session_source.ts`** — Parses request origin (site browser vs. external vs. script).
- **`constants.ts`** — All numeric limits, shared TypeScript types (`Player`, `Session`, `RoomEvent`, `Bindings`), `DEFAULT_ROOMS` seeds, config versioning.

**`src/admin/`**
- **`schemas.ts`** — Zod-style validation, PBKDF2 crypto helpers, constant-time compare, rate limits, types for `User`, `Session`, `PasswordReset`, `AuditEntry`.
- **`json.ts`** — Re-exports `parseJsonObjectBody` from `http/json.ts`.
- **`pagination.ts`** — Parses `limit`/`cursor` query params for paginated API responses.

**`src/http/`**
- **`errors.ts`** — `ErrorEnvelope` type + factory for consistent JSON error responses.
- **`json.ts`** — Body parser + type-narrower.
- **`request_id.ts`** — X-Request-Id generation/propagation.

**`src/internal/`** — cross-DO communication contracts
- **`admin_endpoints.ts`** — Shared path constants for inter-DO routes (broadcast, world-state, sync-room, world-assets).
- **`world_response.ts`** — `InternalWorldResponse<T>` type and type guard.

### Client (`public/`) — Vanilla ES6 JavaScript

**Entry**
- **`index.html`** — HTML shell, CSP `<meta>`, Three.js/lil-gui ESM import map.
- **`styles.css`** — Glassmorphic HUD styling.
- **`app.js`** — Boot coordinator: initializes engine, UI, room panel, audio, visibility optimizations.

**State & Config**
- **`js/state.js`** — Single shared mutable `state` object imported by all modules.
- **`js/config.js`** — Client config constants (room layouts, building dimensions, movement tuning, landmark registry, NPC spawns, soundtrack library).

**Coordinator/barrel pattern** — Top-level files are the public API; subdirectories hold implementations. Callers always import from the top-level file:

- **`engine.js`** — Three.js render loop, scene setup, fog, shadow, indoor/outdoor lighting blend, fade zone updates, NPC/remote player updates, elevator door sync.
  - `engine/camera.js` — Camera follow, orbit, exit-watch, auto-align.
  - `engine/movement.js` — Local player physics, collision, Cannon sync, jetpack.
  - `engine/jetpack.js` — Flight thruster visuals.

- **`building.js`** — Main building geometry (~825 lines, 8 sections): room floors, lobby, wall system, columns, ceiling/sign, upper facade, elevator, second floor.
  - `building/doors.js` — Door frame geometry.
  - `building/interiors.js` — Classroom asset sets.
  - `building/roof.js` — Gabled terracotta roof with pediments.
  - `building/torches.js` — Wall torch meshes + point lights.
  - `building/upstairs.js` — Placeholder for second-floor furnishings (empty).

- **`scenery.js`** — Barrel re-exporting all `scenery/` submodules.
  - `scenery/plaza.js` — Fountain plaza, room indicators, banners (~820 lines, 5 phases).
  - `scenery/amphitheater.js`, `concert-venue.js`, `castle.js`, `airport.js`, `underground-city.js` — Landmark buildings.
  - `scenery/river.js` — Meandering river with custom-shader water, waterfall, bridge.
  - `scenery/roads.js` — Terrain-following roads with stone arch bridge.
  - `scenery/foliage.js` — Bushes, ornamental trees, flower beds.
  - `scenery/world-details.js` — Instanced tree clusters, ponds, wildflower meadows.
  - `scenery/assets.js` — Shared geometries, sprites, boulder scatter.
  - `scenery/utils.js` — Terrain deformation, floor helper, grounded patch/ring helpers.
  - `scenery/visibility.js` — Distance/frustum culling registration.
  - `scenery/venues.js` — Thin coordinator calling buildAmphitheater + buildConcertVenue.

- **`room-panel.js`** — Room sidebar coordinator.
  - `room-panel/event-board.js`, `media.js`, `player-list.js`.

- **`ui.js`** — HUD panels, chat, event board selection.
  - `ui/debug-panel.js`, `login.js`, `soundtrack-panel.js`, `elevator.js`.

**Standalone modules**
- **`fade-system.js`** — Zone-based opacity transition system for roofs, walls, upper floors, ground-floor items. Used by building.js and all landmark files.
- **`multiplayer.js`** — WebSocket connection, reconnection, message dispatch, net profiles.
- **`physics.js`** — Terrain height sampling, sphere-vs-AABB collision, room ID lookup, roof detection.
- **`physics-engine.js`** — Cannon-es XZ collision proxy (CDN-loaded). Wall/asset colliders built once; elevator door body created/removed dynamically.
- **`characters.js`** — Player/NPC avatars, walk animation, emoji thought bubbles, NPC wander AI.
- **`audio.js`** — MIDI soundtrack synth (10 tracks).
- **`chat.js`** — Chat log, bubbles, scope sync.
- **`room-animation.js`** — Fountain vertex animation, ripple rings, spray, bubbles, fish, indicator pulses.
- **`editor.js`** — World editor with Three.js TransformControls.
- **`dev-tools.js`** — Runtime inspection, scene audit, z-fighting detection, minimap overlays.
- **`theater.js`** — Fullscreen media overlay.
- **`lighting.js`** — Torch flicker updates (throttled to 15fps).
- **`environment.js`** — HDRI environment loader.
- **`minimap.js`** — 2D overhead minimap (10fps).
- **`textures.js`** — Procedural canvas textures.
- **`math.js`** — HALF_PI, FLAT, frame-independent lerp, normalizeAngle.
- **`utils.js`** — Room event status, media type helpers, footprint checks.
- **`modals.js`** — Generic modal dialog helpers.
- **`animations.js`** — Swimming animation.

## Fade System

The `fade-system.js` module handles opacity transitions for scene elements. Each "fade zone" has a `containsPlayer` predicate and one or more layers with `getTargetOpacity` functions. Layers are convergence-gated — once all items reach the target opacity, the layer is skipped until the target changes.

**Building fade layers:**
- `mainRoofLayer` — fades to 0 when inside building (transparent), 1 outdoors
- `mainUpperWallsLayer` — fades to 0 when inside below `MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y` (~3.75)
- `mainUpperFloorLayer` — same as upper walls (second-floor elements)
- `mainGroundFloorLayer` — inverse of upper wall layer (room indicators + screens fade when above threshold)

**Landmark fade layers:** castle, concert venue, airport, underground city all register their own roof layers with similar inside/outside opacity targets. The elevator fade progress (0→1 during ride) is piped into all layer targets to ensure smooth transitions during ascent/descent.

A safety net in `engine.js` also directly lerps `state.ceilingMat` and `state.upperWallMat` every frame regardless of fade zone convergence state, guaranteeing correct opacity for the shared material paths.

## Elevator System

The elevator at Z=-36 in the lobby rises to Y=7.5 (mezzanine). The state machine (IDLE → OPENING → OPEN → WAITING → CLOSING → RIDING → ARRIVAL) with swing doors is in `ui/elevator.js`. Collision is handled by:
1. A dynamic Cannon body created/updated/removed by `physics-engine.js:updateElevatorDoorCollider()` — skips the static `buildWallColliders()` via `userData._isElevatorDoor` tag
2. A `Box3` in `state.WALLS` that gets collapsed to zero when the door opens
3. XZ movement lock via `state._elevatorIsRiding` during ascent/descent

## LLM world-building tools

When building or adjusting world geometry, use the `window.metalyceumDev` API (toggle debug panel with backtick key).

### Site survey
```js
metalyceumDev.terrainAt(130, -80)               // terrain height at point
metalyceumDev.worldQuery(130, -80)              // full site context: terrain, rooms, river, collisions
metalyceumDev.sampleTerrain(130, -80, 40, 7)    // terrain profile across a grid
metalyceumDev.findClearSpace(25)                // find clear spots for new structures
```

### Auditing
```js
metalyceumDev.audit()                           // all placement issues
metalyceumDev.auditZFighting(60)                // z-fighting scan (radius optional)
metalyceumDev.auditStaticScenery(0.4)           // Y misalignment scan
metalyceumDev.suggestFix(0)                     // fix suggestion for issue index 0
metalyceumDev.buildAudit(cx, cz, radius)        // consolidated build audit
```

### Collision generation
```js
metalyceumDev.colliderBox(130, -80, 60, 60, 'castle')  // PLACED_ASSET_COLLIDER entry
metalyceumDev.wallBox(-85, 140, 46, 34, 10, baseY)     // state.WALLS Box3 entry
```

### Landmark positioning
```js
metalyceumDev.setLandmark('castle', {x: 5, y: 0, z: -2, rotY: 0.1})
metalyceumDev.getLandmark('castle')
metalyceumDev.teleportTo('castle')
metalyceumDev.listLandmarks()
```

### Inspection
```js
metalyceumDev.inspectNearby(30)                 // world transforms near player
metalyceumDev.getLastInspected()                // after Alt+click a mesh
metalyceumDev.proximity()                       // pairwise edge distances
metalyceumDev.nearestObjects(130, -80, 15)      // nearest N objects with distances
metalyceumDev.snapshot()                        // full world state JSON
metalyceumDev.measure(65, 150, -85, 140)        // distance, slope, terrain heights
```

### Dev workflow
1. Start dev server: `npm run dev` (run in background)
2. Open browser to `http://localhost:8787`, join with any name
3. Wait for scene to build — poll with `typeof window.metalyceumDev !== 'undefined'`
4. Teleport: `metalyceumDev.teleportTo('castle')`
5. Audit: `metalyceumDev.buildAudit(cx, cz, radius)`
6. Fix issues, re-audit until `summary: 'CLEAN'`

## Conventions and constraints

- **Three.js r184 via CDN import map** — browser code imports `three` and `three/addons/*` through the import map in `index.html`. Every file that references THREE must have `import * as THREE from 'three'` at the top.
- **npm `three` is test-only legacy** — `package.json` carries `three@0.128.x` and `@types/three@0.128.x` for test shims only. The browser runtime version is the import-map version in `index.html`.
- **`src/validation.ts`, `src/realtime.ts`, `src/session_source.ts`, `src/http/*`, `src/admin/pagination.ts`, `src/admin/schemas.ts`, `src/internal/*`** must stay free of `cloudflare:workers` imports — this keeps them testable outside the Workers runtime.
- **Coordinator/barrel pattern** — `engine.js`, `building.js`, `scenery.js`, `room-panel.js`, `ui.js` are the public API for their domain. Callers import from the top-level file, never from subdirectories directly.
- **`public/_headers`** — the only way to set headers on static asset responses. The Worker does not run for asset requests.
- **Security headers** — `index.ts` applies headers to Worker responses; CSP is a `<meta>` tag in `index.html`; `_headers` covers static assets.
- **`.wrangler/`** — auto-generated, never edit manually.
- **All server types centralized** — `src/constants.ts` for numeric limits, game types, and `DEFAULT_ROOMS`. Add new shared constants there.
- **Two DO instances** — `MetalyceumWorld` (`idFromName("global-world")`) and `AdminDO` (`idFromName("admin")`). Neither is sharded.
- **Performance-sensitive render loop** — `engine.js:animate()` is called every frame. Keep DOM writes, array allocations, and heavy loops throttled (use `state.frameCount % N` or `now | 0 % N` patterns).
