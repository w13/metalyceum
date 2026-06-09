# Metalyceum

3D social event world with room-based YouTube Live and Google Meet sessions.

## Stack

- **Language/Framework** — TypeScript on Cloudflare Workers (Durable Objects for real-time state)
- **Client 3D** — Three.js r184 via CDN import map (ES module imports)
- **Testing** — Vitest (`vitest run`)
- **Browser/e2e testing** — Playwright (`npm run test:e2e`)
- **Deployment** — Wrangler (`wrangler deploy`; config in `wrangler.jsonc`)
- **Key deps** — `@cloudflare/workers-types`, `typescript`, `wrangler`, `vitest`, `@playwright/test`, `cannon-es`

## Layout

- `src/` — Worker server code (TypeScript):
  - `index.ts` — Entry point, routing, security headers
  - `durable_object.ts` — `MetalyceumWorld` Durable Object (game state, WebSockets, SQLite)
  - `admin/do.ts` — `AdminDO` Durable Object (accounts, auth, audit)
  - `validation.ts`, `realtime.ts`, `session_source.ts` — Pure/testable modules (no CF imports)
  - `constants.ts` — Limits, types, default room seeds
  - `admin/` — Admin schemas, pagination, JSON helpers
  - `http/` — Request ID, JSON parsing, error envelopes
  - `internal/` — Cross-DO communication contracts
- `public/` — Client SPA (vanilla ES6 JavaScript):
  - `index.html` — HTML shell, CSP, Three.js import map
  - `app.js` — Boot coordinator
  - `js/engine.js` + `engine/` — Render loop, camera, movement, jetpack
  - `js/building.js` + `building/` — Main building geometry
  - `js/scenery.js` + `scenery/` — 14 modules: plaza, landmarks, river, roads, foliage, world details, utils
  - `js/room-panel.js` + `room-panel/` — Room sidebar panels
  - `js/ui.js` + `ui/` — HUD panels, login, elevator, soundtrack, debug
  - `js/fade-system.js` — Zone-based opacity transition system
  - `js/physics.js` — Terrain height, collision, room lookup
  - `js/physics-engine.js` — Cannon-es XZ collision proxy
  - `js/characters.js` — Player/NPC avatars and AI
  - `js/multiplayer.js` — WebSocket client
  - `js/state.js`, `js/config.js` — Shared state and config
  - `js/math.js`, `js/utils.js`, `js/modals.js` — Shared helpers
  - `styles.css` — Glassmorphic styling
  - `_headers` — Edge security headers for static assets
  - `midi/` — MIDI soundtrack files (10 tracks, 8 instrument parts)
- `test/` — Tests: worker unit tests (colocated with `src/`) + client unit/integration tests in `test/client/`
- `screenshots/` — README screenshots
- `docs/` — Architecture comparison docs, superpowers reference
- `wrangler.jsonc` — Cloudflare Workers config, DO bindings, routes (custom domain: `metalyceum.app`)

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | `wrangler dev` (local dev server at localhost:8787) |
| `npm run deploy` | `wrangler deploy` (publish to Cloudflare) |
| `npm run typecheck` | `tsc --noEmit` (server TypeScript) |
| `npm run typecheck:test` | `tsc --noEmit -p test/tsconfig.json` |
| `npm run test` | `vitest run` (111 tests) |
| `npm run test:e2e` | `playwright test` |

No lint or format scripts are configured.

## Conventions

- **Test files** — `*.test.ts` colocated with source in `src/` (e.g. `src/validation.test.ts`) or in `test/client/` for browser-dependent tests
- **Validation module** — `src/validation.ts` contains pure functions only (no `cloudflare:workers` imports), keeping them unit-testable outside the Workers runtime
- **Constants & types** — centralized in `src/constants.ts` for server; `public/js/config.js` for client
- **Client modules** — ES6 module entry (`public/app.js`) imports from `public/js/*.js`; Three.js loaded via import map in `index.html`; every file imports `THREE` explicitly
- **Cannon integration** — `public/js/physics-engine.js` is XZ-only collision proxy. Y movement (terrain-follow, jump, gravity, elevator) stays manual in `engine/movement.js`
- **Coordinator/barrel pattern** — `engine.js`, `building.js`, `scenery.js`, `room-panel.js`, `ui.js` are the public API; subdirectory files are implementation details
- **Security** — CSP delivered via `<meta>` tag in `index.html`; edge headers in `public/_headers` apply to static assets without invoking the Worker

## World

- **12 interactive rooms** across ground floor (8), second-floor mezzanine (Upper Gallery), and outdoor venues (Amphitheater, Concert Venue, Underground City)
- **5 landmarks**: Castle, Airport, Amphitheater, Concert Venue, Underground City — each registered in `LANDMARK_REGISTRY` (config.js) and `state.landmarkGroups`
- **Working elevator** between ground floor (Y=0) and mezzanine (Y=7.5) with animated swing doors, dynamic Cannon collision, and XZ movement lock during ride
- **12 NPCs** with random walk AI, emoji thought bubbles, collision avoidance
- **Animated fountain** with vertex-displaced water, bubble particles, cascade streams, orbiting fish
- **Meandering river** with custom GLSL shader water, waterfall, and stone arch bridge
- **Fade system** for indoor/outdoor transitions — roof, upper walls, second floor, and ground-floor items each have independent opacity targets

## Watch out for

- `.wrangler/` is auto-generated — never edit manually
- `wrangler.jsonc` (not `wrangler.toml`) is the config file
- `public/_headers` is the only way to set headers on static asset responses (the Worker doesn't run for those requests)
- `src/validation.ts`, `src/realtime.ts`, `src/session_source.ts`, `src/http/*`, `src/admin/*`, `src/internal/*` must stay free of `cloudflare:workers` imports
- Three.js r184 is loaded via import map — every file that references THREE.* must have `import * as THREE from 'three'`
- `package.json` has `three@0.128.x` for test shims only — browser runtime is the import-map version in `index.html`
- The render loop (`engine.js:animate()`) runs at vsync. Throttle heavy work with `state.frameCount % N` guards
