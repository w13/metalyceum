# Metalyceum Copilot Instructions

## Commands

```bash
npm run dev        # Start the local Cloudflare Worker with static assets
npm run typecheck  # Type-check the TypeScript worker code
npm test           # Run the full Vitest suite
npm run test -- src/validation.test.ts
npx vitest run src/realtime.test.ts
npx vitest run src/realtime.test.ts -t "shares movement for players in the same room"
npm run test:e2e   # Playwright smoke test with diagnostics artifacts
npm run test:e2e:trace  # Playwright with full traces for large-change debugging
npm run deploy     # Deploy the worker and static assets
```

There is no dedicated lint script in this repository.

## Recent refactoring (June 2026)

Major DRY refinements were applied. Key structural changes:

- **dev-tools.js** (2476→1634 lines): LLM API (`window.metalyceumDev`) extracted to `ui/dev-api.js`. Shared state (`devState`, `devTeleport`) extracted to `ui/dev-state.js`.
- **config.js** (925→396 lines): Soundtrack library (10 tracks, 531 lines) extracted to `midi/soundtrack-data.js`.
- **plaza.js** (819→600 lines): Animated fountain water (big apple, ripples, spray, bubbles, fish) extracted to `scenery/fountain-water.js`.
- **multiplayer.js** (571→~480 lines): 14-case switch replaced with `MSG_HANDLERS` registry object.
- **interiors.js** (161→46 lines): Inline north/south bench duplication and corner plant replaced with shared factories from `scenery/furniture.js`.
- **Shared furniture**: `scenery/furniture.js` provides `createBench`, `createPlant`, `createCircleTable`, `createChair`, `createBookshelf`, `placeTableWithChairs`.
- **Barrel files**: `physics/index.js`, `engine/index.js`, `ui/index.js` — import via directory path for combined exports.
- **Editor asset rendering**: `createPlacedAssetModel` switched from 11-branch if/else to `ASSET_FACTORIES` registry.
- **Venue loading**: `VENUE_REGISTRY` in config.js drives both eager and lazy venue loading. Add a venue = one config entry + builder module.
- **Rotation constants**: 66 hardcoded `-Math.PI/2` replaced with `FLAT`/`HALF_PI` across 10 files.

## High-level architecture

Metalyceum is one Cloudflare Worker with static frontend assets. `src/index.ts` is a router layer: `/ws` and `/debug` go to one global world Durable Object (`MetalyceumWorld`), `/api/v1/*` goes to a separate admin/auth Durable Object (`AdminDO`), and everything else is served through the `ASSETS` binding.

`src/durable_object.ts` is the real server. The `MetalyceumWorld` Durable Object keeps live session state in memory, persists room events and world assets in Durable Object SQLite storage, and handles all WebSocket message types for join/move/chat, room event updates, and world asset publishing.

`src/admin/do.ts` is a second backend surface for REST-style auth/admin APIs (init/register/login/password reset, account profile/password, admin users/logs/rooms/editor token/broadcast/world state). It stores users/sessions/logs in DO storage and syncs room/broadcast/world actions to `MetalyceumWorld` through internal DO endpoints.

`src/validation.ts` and `src/realtime.ts` are intentionally pure modules with no `cloudflare:workers` imports. Validation, sanitization, and proximity/chat delivery rules live there so they can be covered directly by Vitest.

The client is a browser app served from `public/`. `public/app.js` is the module coordinator, but most client code shares one mutable `state` object from `public/js/state.js`. Real-time sync flows through `public/js/multiplayer.js`, room schedule/video UI through `public/js/room-panel.js`, and the in-world editor through `public/js/editor.js`.

## Key conventions

- Client-side Three.js comes from CDN scripts in `public/index.html` and is used as the global `THREE` object. Do not add npm-based Three.js imports.
- `src/constants.ts` is the source of truth for shared server limits, shared types, and default room seeds. If default room configuration changes, update `ROOMS_CONFIG_VERSION` so persisted room data is re-seeded on deploy.
- Keep `src/validation.ts` and `src/realtime.ts` free of Workers-runtime imports. New logic placed there should stay unit-testable in plain Vitest.
- Static-asset security headers belong in `public/_headers`; Worker response headers belong in `src/index.ts`; the CSP is defined in the `<meta http-equiv="Content-Security-Policy">` tag in `public/index.html`.
- Wrangler routing matters: `wrangler.jsonc` `assets.run_worker_first` controls which paths hit the Worker (`/ws`, `/debug`, `/api/v1/*`). If you add new dynamic/server routes, update both `wrangler.jsonc` and `src/index.ts`.
- The world is intentionally a single global Durable Object, not a sharded/multi-room backend. Changes to session flow or persistence should preserve that assumption unless the architecture is being deliberately redesigned.
- Room data exists on both sides: the Durable Object owns the authoritative room/event state, while the client keeps a local `state.ROOMS` projection that is hydrated from websocket `init` / `rooms_state` messages.
- World asset support is split across server validation/persistence and client rendering/editor code. Adding or changing asset types usually requires coordinated updates in `src/validation.ts`, `src/durable_object.ts`, and `public/js/config.js` / `public/js/editor.js`.
- `src/index.ts` has explicit CORS allowlist handling for `/api/v1/*` (`ALLOWED_ORIGINS`). Update this list when admin UI origins change.

## LLM world-building tools

`window.metalyceumDev` is available in the browser when the debug panel is open (backtick key). Use it — **never do coordinate math manually**.

### Essential calls for writing new scenery

```js
// Terrain height at a point — use this as your baseY
metalyceumDev.terrainAt(130, -80)                   // → number

// Full site analysis before placing anything
metalyceumDev.worldQuery(130, -80)
// → {terrainHeight, roomId, roomName, riverDist, isInRiver, wallCollision, nearestLandmark, ...}

// Terrain profile to understand slope across a new build area
metalyceumDev.sampleTerrain(130, -80, 40, 7)
// → {points: [{x,z,y}], min, max, avg, maxSlope, isFlat}

// Find a clear spot on the map for a new structure of given radius
metalyceumDev.findClearSpace(25)
// → [{x, z, terrainHeight, distFromCentre}, ...]
```

### Auditing clipping and z-fighting

```js
metalyceumDev.audit()                               // runs full audit, returns issues array
metalyceumDev.suggestFix(0)                         // concrete fix for issue[0]: delta / newPos / newY
```

### Generating collision box code

```js
metalyceumDev.colliderBox(130, -80, 60, 60, 'castle')
// → {minX, maxX, minZ, maxZ, assetId} — paste into PLACED_ASSET_COLLIDERS.push(...)

metalyceumDev.wallBox(-85, 140, 46, 34, 10, baseY)
// → {min, max, jsCode} — jsCode is the ready-to-paste new THREE.Box3(...) call
```

### Moving landmarks without a reload

```js
metalyceumDev.setLandmark('castle', {x: 5, y: 0, z: -2, rotY: 0.1})  // live update
metalyceumDev.getLandmark('castle')    // read current offset → paste into source
metalyceumDev.teleportTo('castle')     // warp player there to inspect
metalyceumDev.listLandmarks()          // ['castle','airport','amphitheater','concertVenue','undergroundCity']
```

### Snapshot and measurement

```js
metalyceumDev.snapshot()               // full JSON: landmarks, rooms, walls, placed assets, player
metalyceumDev.measure(x1, z1, x2, z2) // XZ distance, terrain heights, slope %
metalyceumDev.listAssets()             // placed assets grouped by type
```

### Inspecting object positions and orientations

```js
// Scan all state.STATIC_SCENERY for terrain misalignment and unexpected tilt
metalyceumDev.auditStaticScenery(0.4)
// → [{index, kind, worldPos, terrainY, diff, severity, type:'floating'|'buried'|'tilted', message}]
// 3D markers (sphere + gap line / axes helper) appear when "Show Misalign Markers" is toggled on

metalyceumDev.getStaticAuditIssues()   // re-read results without re-scanning

// Full world-transform for all objects within radius units of the player
metalyceumDev.inspectNearby(30)
// → [{source, worldPos, worldRotDeg, scale, terrainY, yAboveTerrain, dist}, ...]

// Alt+click any mesh (while debug panel is open) to log its world transform + terrain delta to console
metalyceumDev.getLastInspected()
// → {geometry, worldPos, worldRotDeg, worldScale, terrainY, yAboveTerrain, parentChain, userData}
metalyceumDev.clearInspected()         // remove result and 3D marker
```

### Proximity and intersection detection

```js
// Pairwise edge-to-edge distances for all objects near a point
metalyceumDev.proximity()              // within 60u of player
metalyceumDev.proximity(130, -80, 80)  // within 80u of world coordinate (130, -80)
// Returns [{a, b, centreDist, edgeDist, status}] sorted by edgeDist ascending
// status values: 'INTERSECTING' (edgeDist < 0), 'touching' (< 0.3u), 'close' (< 2u), 'clear'
// Covers placed assets, landmark groups, and static scenery
// Also logs all INTERSECTING/touching pairs to the console immediately

// Nearest N objects to a point with edge-to-edge distance
metalyceumDev.nearestObjects()         // top 10 nearest to player
metalyceumDev.nearestObjects(130, -80, 15)
// → [{label, id, x, z, r, centreDist, edgeDist}, ...]
```

### Data sources
- `LANDMARK_REGISTRY` in `public/js/config.js` — authoritative landmark keys, centers, radii
- `state.landmarkGroups` (`Map<string, THREE.Group>`) — live group references for all 5 landmarks
- Landmark scenery files (`scenery/castle.js`, etc.) wrap all meshes in a root `THREE.Group` registered in `state.landmarkGroups`; moving the group offsets the whole structure

## MCP servers

For browser-level debugging and UI verification, use a Playwright MCP server.

1. Run the app locally with `npm run dev` (Worker + static assets).
2. Use the Playwright MCP server (configured in `.vscode/mcp.json`) and point it to the local app URL from Wrangler output (commonly `http://127.0.0.1:8787`).
3. For large backend/frontend changes, run `npm run test:e2e` to catch shell-load regressions and attach diagnostics (console/page/request failures); rerun with `npm run test:e2e:trace` when you need deeper telemetry.
