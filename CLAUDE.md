# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Metalyceum** — a 3D social event world with room-based YouTube Live and Google Meet sessions. Players navigate a Three.js scene on the client; the server is a Cloudflare Worker routing to two Durable Objects: `MetalyceumWorld` (live game state) and `AdminDO` (user accounts, auth).

## Commands

```bash
npm run dev        # wrangler dev — local development server
npm run deploy     # wrangler deploy — publish to Cloudflare
npm run typecheck  # tsc --noEmit — type-check TypeScript sources in src/
npm run test       # vitest run — run all tests
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
- **`js/physics-engine.js`** — Cannon-es physics wrapper loaded from CDN. **Currently unused** — not imported by any module. Kept for future integration.
- **`js/audio.js`** — Ambient MIDI soundtrack, audio context management.
- **`js/chat.js`** — Chat log, chat bubble display, scope (global vs. room).
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
- **`js/debug-tweaks.js`** — Runtime debug toggles.

## Conventions and constraints

- **Three.js r128 via CDN** — client code uses `THREE.*` globals loaded by `<script>` tags. Never `import * as THREE` or install Three.js as an npm dep.
- **`src/validation.ts`, `src/realtime.ts`, `src/session_source.ts`, `src/http/*`, `src/admin/pagination.ts`, `src/admin/schemas.ts`, `src/internal/*` must stay free of `cloudflare:workers` imports** — this is what makes them testable with plain Vitest outside the Workers runtime.
- **Coordinator/barrel pattern** — `engine.js`, `building.js`, `scenery.js`, `room-panel.js`, `ui.js` are the public API for their domain. Callers always import from the top-level file, never from the subdirectory directly (except within the same domain).
- **`public/_headers`** — the only way to set headers on static asset responses. The Worker doesn't run for asset requests; adding header logic to `index.ts` won't affect them.
- **Security headers** — `index.ts` applies security headers to Worker responses; CSP is a `<meta>` tag in `index.html`; `public/_headers` covers static assets.
- **`.wrangler/`** — auto-generated, never edit manually.
- **All types centralized** — `src/constants.ts` is the source of truth for numeric limits, game types, and `DEFAULT_ROOMS`. Add new shared constants there.
- **Two DO instances** — `MetalyceumWorld` (game, `idFromName("global-world")`) and `AdminDO` (accounts, `idFromName("admin")`). Neither is sharded.
