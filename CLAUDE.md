# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Metalyceum** — a 3D social event world with room-based YouTube Live and Google Meet sessions. Players navigate a Three.js scene on the client; the server is a single Cloudflare Worker routing to a Durable Object (`MetalyceumWorld`) that manages all real-time state via WebSockets.

## Commands

```bash
npm run dev        # wrangler dev — local development server
npm run deploy     # wrangler deploy — publish to Cloudflare
npm run typecheck  # tsc --noEmit — type-check TypeScript sources in src/
npm run test       # vitest run — run all tests
```

No lint/format scripts. Tests live in `src/*.test.ts` and run with `vitest run`.

## Architecture

### Server (`src/`)

- **`index.ts`** — Worker entry point. Routes `/ws` and `/debug` to the Durable Object; all other requests served from static assets (`ASSETS` binding).
- **`durable_object.ts`** — `MetalyceumWorld extends DurableObject`. Single global instance (`idFromName("global-world")`). Holds all session state in memory (`sessions: Map<WebSocket, Session>`), persists room events and world assets in SQLite (`ctx.storage.sql`). Handles all WebSocket message types: join, move, chat, room-update, asset CRUD.
- **`realtime.ts`** — Pure functions for player relevance (proximity/room filtering) and chat scope resolution. No `cloudflare:workers` imports — tested directly.
- **`validation.ts`** — Pure sanitization/parsing helpers. No `cloudflare:workers` imports — tested directly. This is the only place input validation happens.
- **`constants.ts`** — All numeric limits, shared TypeScript types (`Player`, `Session`, `RoomEvent`, `Bindings`), and `DEFAULT_ROOMS` seeds.

### Client (`public/`)

- **`app.js`** — ES6 module coordinator. Initializes engine, UI, room panel, audio, and visibility/performance optimizations. Sets `window.onYouTubeIframeAPIReady`.
- **`js/state.js`** — Single shared mutable `state` object imported by all client modules.
- **`js/engine.js`** — Three.js render loop, camera, scene graph.
- **`js/multiplayer.js`** — WebSocket connection, reconnection logic, message dispatch, network profiles (8–50 Hz position update rate, configurable via `localStorage['metalyceum:netProfile']`).
- **`js/room-panel.js`** — Room event board UI, room video setup (YouTube iframe API), player list.
- **`js/scenery.js`** — Avatar creation, world geometry, lobby/room visual layout.
- **`js/physics.js`** — Player movement, collision, bounds enforcement.
- **`js/audio.js`** — Ambient soundtrack, audio context management.
- **`js/chat.js`** — Chat log, chat bubble display, scope (global vs. room).
- **`js/theater.js`** — In-world screen/theater rendering.
- **`js/building.js`** — Building/structure geometry helpers.
- **`js/characters.js`** — Character/avatar model helpers.
- **`js/textures.js`** — Texture loading and caching.
- **`js/editor.js`** — World asset editor (placement, drag, persist via WebSocket).
- **`js/config.js`** — Client-side configuration constants.
- **`js/ui.js`** — HUD, debug panel, soundtrack UI, general UI handlers.
- **`js/utils.js`** — Shared helpers (e.g., `applyRoomData`).

## Conventions and constraints

- **Three.js r128 via CDN** — client code uses `THREE.*` globals loaded by `<script>` tags. Never `import * as THREE` or install Three.js as an npm dep.
- **`src/validation.ts` and `src/realtime.ts` must stay free of `cloudflare:workers` imports** — this is what makes them testable with plain Vitest outside the Workers runtime.
- **`public/_headers`** — the only way to set headers on static asset responses. The Worker doesn't run for asset requests; adding header logic to `index.ts` won't affect them.
- **Security headers** — `index.ts` applies security headers to Worker responses; CSP is a `<meta>` tag in `index.html`; `public/_headers` covers static assets.
- **`.wrangler/`** — auto-generated, never edit manually.
- **All types centralized** — `src/constants.ts` is the source of truth for numeric limits, game types, and `DEFAULT_ROOMS`. Add new shared constants there.
- **Single DO instance** — the world is one global `MetalyceumWorld` Durable Object. There's no sharding.
