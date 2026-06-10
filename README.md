# 🌌 Metalyceum

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://metalyceum.app)
[![Three.js](https://img.shields.io/badge/Three.js-r184_ESM-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite_in_Durable_Objects-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Metalyceum** is a real-time, browser-based 3D social event world with room-specific YouTube Live streams and Google Meet collaboration sessions. Players customize their avatars, navigate a Three.js-powered open world spanning a Greek museum-style building with 12 interactive rooms, 5 outdoor landmarks, a meandering river, and forested hills. Chat with proximity-aware or room-scoped focus, ride an animated elevator, fly with a jetpack, and construct your surroundings with the integrated World Editor — all running on a zero-build ESM pipeline deployed to Cloudflare Workers.

The entire backend infrastructure runs on a single Cloudflare Worker backed by two Durable Objects — `MetalyceumWorld` (real-time game state) and `AdminDO` (user accounts, auth, audit logs) — each with a built-in SQLite database for persistence.

---

## 🖼️ Screenshots

| Login Panel | World Overview | Building Entrance |
|:---:|:---:|:---:|
| ![Login panel](screenshots/02-login-panel.png) | ![World overview](screenshots/04-debug-panel.png) | ![Building entrance](screenshots/05-building-front.png) |

| Lobby Interior | Hallway View | Room Screen |
|:---:|:---:|:---:|
| ![Lobby interior](screenshots/06-lobby-interior.png) | ![Hallway view](screenshots/07-hallway-view.png) | ![Room screens](screenshots/08-room-screens.png) |

---

## 🌟 Key Features

*   **Interactive 3D World**: Custom Three.js r184 ESM rendering with a Greek museum-style main building, lobby, hallway with Doric columns, 8 interactive rooms, a second-floor mezzanine gallery, and a working elevator. Outdoor landmarks include an amphitheater, concert venue, castle, airport with runway and control tower, underground city, meandering river with waterfall and bridge, fountain plaza, and forested hills with ponds.

*   **Real-time Multiplayer**: WebSocket-based via Cloudflare Durable Objects (`MetalyceumWorld`). Implements player proximity relevance calculations, location-scoped chat, network profile adjustment (8–50 Hz position updates), and graceful reconnection with a 15-second grace window. Disconnected players remain visible for 15 seconds before cleanup.

*   **12 Virtual Rooms & Event Streams**: North Hall, East Studio, Open Workshop, Broadcast Room, South Lounge, Crit Room, Screening Room, Commons, Outdoor Amphitheater, Concert Venue, Upper Gallery (second floor), and Underground City. Each room supports embedded YouTube Live or Google Meet sessions with a dedicated room-sidebar panel and theater mode. Room media state persists via SQLite.

*   **NPC Characters**: 12 wandering NPCs populate the world — Alex, Riley, and Quinn in indoor rooms; Jay, River, and Parker in the lobby; Ember and Vale at the amphitheater; Lyric and Echo at the concert venue. NPCs walk randomly, display emoji thought-bubbles during idle moments, avoid collision with walls, and are culled beyond 100 units.

*   **Animated Fountain & Environment**: A multi-tiered fountain with vertex-displaced water surfaces, rising bubbles, cascade streams, ripple rings, a glowing water apple, and orbiting fish. The fountain water system is a self-contained module (`fountain-water.js`) with its own animation registration. A meandering river with custom-shader water and waterfall completes the outdoor scene.

*   **Elevator**: A fully functional elevator at the north end of the lobby with swinging mahogany doors, brass trim, marble floor, crown molding, chandelier, and gold pediment. Single state machine drives proximity-based door opening, a ride-side menu panel, smooth ascent/descent with ease-in-out over 1.8s, and second-floor environment fade. Doors are car children — they ride up with the elevator.

*   **Jetpack & Cascade-Fan Wings**: Toggle jetpack flight with `T`. Wings with 4 trapezoidal fan-segments per side cascade open sequentially on takeoff (0.12s stagger per segment) and fold on landing. Metallic sheen matches your avatar's shirt color. Bronze accent trim. Landing triggers a crash sequence with tumbling physics and rolling recovery.

*   **RuneScape-Style Lighting**: Warm golden-hour atmosphere with a `#5070a0` to `#d4b888` sky gradient, deep-night fog (`#030712`, linear near=200 far=600), and smooth indoor/outdoor lighting transitions via interpolated `_indoorMix` (0→1 over ~0.5s). Sun color `#f0c878` at position (38, 22, 12) for long dramatic shadows. Indoor ambient shifts from `#ffffff` to `#e8a040` with a warm point light at 0.4 intensity.

*   **Lazy-Loaded Distant Scenery**: Landmarks far from spawn (airport, castle, underground city) are dynamically imported via `import()` only when the player approaches within 95-120 units. A registry-driven system reads from `VENUE_REGISTRY` in `config.js` — adding a new lazy venue is a single config entry. Saves ~30% of startup geometry and 3 CDN fetches.

*   **Collaborative World Editor**: Admin-locked in-world layout editor using Three.js `TransformControls` for placing, moving, scaling, rotating, duplicating, and deleting custom meshes in real-time. 11 asset types in a config-driven palette. Asset rendering uses a factory registry (`ASSET_FACTORIES`) instead of a hardcoded if/else chain. Changes persist via WebSocket to SQLite.

*   **Comprehensive Fade System**: A zone-based opacity transition system handles smooth indoor/outdoor lighting blends, roof/wall fade when entering buildings, mezzanine floor fade during elevator rides (tracking `state.elevatorRideProgress` 0→1), and ground-floor object dimming when viewing from above.

*   **SQLite Persistence**: Durable Object SQLite stores world asset placements (with CRUD via editor), room event metadata, chat history (last 100 messages, automatically pruned), and internal configuration versions.

*   **MIDI Soundtrack Board**: Integrated client-side MIDI synthesizer with 10 ambient soundtracks, play/pause/skip controls, and per-track instrument volume mixing. Uses native Web Audio API oscillators (`sine`, `sawtooth`, `square`, `triangle`). Soundtrack library data stored in `midi/soundtrack-data.js`.

*   **Performance Optimized**: Shadow map 512² with on-demand updates (`shadowMap.autoUpdate=false`), pixel ratio capped at 1.0, CineonToneMapping at exposure 1.0, disabled MSAA, linear `THREE.Fog` for distance culling, Cannon physics throttled to 30fps, NPC distance culling at 100u, torch flicker every 4th frame, draw call budget of 420 (tested in CI via Playwright e2e at live-app hotspots). Default network profile `efficient` (12 Hz); server batches movement on a ~12 Hz alarm tick.

*   **Dev-Tools Production Guard**: Runtime inspection, audit markers, and LLM API (`window.metalyceumDev`) only activate on `localhost`, `127.0.0.1`, or when `?debug` is in the URL. Zero overhead on production.

---

## 🛠️ Technology Stack

| Component | Technology | Description / Usage |
| :--- | :--- | :--- |
| **Server Runtime** | **Cloudflare Workers** | Scalable serverless edge handler. |
| **Real-time State** | **Durable Objects** | `MetalyceumWorld` (game state, WebSockets) + `AdminDO` (auth, audit). |
| **Database** | **DO SQLite** | Durable storage for assets, chat, rooms, and config (`ctx.storage.sql`). |
| **Client Core** | **Vanilla ES6 JavaScript** | Module-based architecture with coordinator pattern. Zero build step. |
| **3D Engine** | **Three.js (r184)** | ESM import map, scene graph, WebGL renderer, OrbitControls, TransformControls. |
| **Type Check** | **TypeScript** | Static typing for server code and shared contracts (client is plain JS). |
| **Physics Proxy** | **cannon-es** | XZ-only wall and asset collision, dynamically loaded from CDN with manual AABB fallback. |
| **Test Runners** | **Vitest + Playwright** | 111 unit/client tests + browser/e2e tests with Playwright + WebGL perf budget. |

---

## 🏗️ Architecture

### Zero-Build ESM Pipeline

The client uses **native ES modules** with an import map — no bundler, no build step. Three.js and cannon-es are loaded from CDN via the import map, not bundled.

```
git push  →  wrangler deploy  →  Cloudflare CDN serves public/ as static assets
                                        │               
                                        ├── index.html (import map maps 'three' → CDN)
                                        ├── app.js      (ES module entry point)
                                        └── js/*.js     (65+ modules, loaded on demand)
```

All `.js` files in `public/js/` are served directly — no compilation, no sourcemaps, no bundling. The import map in `index.html` resolves `three`, `three/addons/`, and `lil-gui` to CDN URLs.

### Module Organization Pattern

The codebase follows a **coordinator + barrel + sub-module** pattern:

```
Root barrel:  scenery.js  →  re-exports from scenery/*.js
              engine.js   →  render loop + re-exports from engine/*.js  
              ui.js       →  HUD panels + re-exports from ui/*.js
              building.js →  main construction + re-exports from building/*.js
              room-panel.js → sidebar + re-exports from room-panel/*.js

Sub-module:   building/walls.js     →  exports buildGroundWalls()
              building/roof.js      →  exports buildRoof()
              engine/movement.js    →  exports updateLocalPlayer()
              scenery/river.js      →  exports buildRiver()
```

New barrel files exist for future migration:
- `physics/index.js` — consolidates `physics.js` + `physics-engine.js`
- `engine/index.js` — consolidates `engine/camera.js` + `movement.js` + `jetpack.js`
- `ui/index.js` — consolidates all `ui/*.js` sub-modules

### Build Pipeline (Client-Side Construction)

The 3D world is constructed synchronously at page load in a defined order:

```
buildMap()
├── Ground terrain (PlaneGeometry, 120×120 segments)
├── initSceneryAssets() — shared geometries & materials (idempotent)
├── Instanced trees, boulders, flowers, grass
├── buildExteriorPlaza() — fountain, banners, room indicators
├── buildBuilding() — museum structure
│   ├── Ground floor, walls, columns, ceiling
│   ├── Elevator, upper walls, upper floor
│   ├── Facade, roof
│   └── Calls sub-modules from building/*.js
├── buildOutdoorVenues() — roads, amphitheater, concert venue, river (eager)
├── initLazyVenueLoading() — starts polling for airport, castle, cave (lazy)
└── buildWorldDetails() — trees, ponds, wildflowers, grass patches
```

### Venue Registry System

All venues are registered in `VENUE_REGISTRY` in `config.js`. Adding a new venue:

```js
// 1. Add to VENUE_REGISTRY:
{ key: 'myVenue', label: 'My Venue', builder: '../scenery/my-venue.js',
  fn: 'buildMyVenue', lazyDistance: 0, cx: 50, cz: 100 }

// 2. Create scenery/my-venue.js with export function buildMyVenue() {}
// Eager (lazyDistance: 0): statically imported in venues.js
// Lazy (lazyDistance > 0): dynamically imported by lazy-venues.js via VENUE_REGISTRY
```

### Physics Architecture

A **hybrid physics system** using progressive enhancement:

```
Default path:  manual AABB (checkCollision + state.WALLS Box3 array)
               → axis-split collision resolution
               → always available, no dependencies

Upgrade path:  cannon-es (dynamically imported from CDN)
               → XZ-only collision proxy (gravity = 0 in Cannon)
               → continuous collision detection
               → throttled to 30fps
               → falls back to manual path if CDN unavailable
```

Vertical movement (gravity, jumping, swimming, terrain-follow, elevator rides) is entirely manual in `movement.js` — Cannon only handles XZ wall/asset collision.

---

## 📁 Repository Layout

```
├── src/                          # Server / Worker code (TypeScript)
│   ├── index.ts                  # Worker entry — routing, CORS, security headers
│   ├── durable_object.ts         # MetalyceumWorld Durable Object (~1200 lines)
│   ├── validation.ts             # Pure input sanitization (testable outside Workers)
│   ├── realtime.ts               # Proximity relevance & chat scoping
│   ├── session_source.ts         # Request origin classification
│   ├── constants.ts              # Limits, types, default rooms
│   ├── admin/                    # AdminDO + schemas + pagination
│   ├── http/                     # Request ID, JSON parsing, error envelopes
│   └── internal/                 # Cross-DO communication contracts
│
├── public/                       # Client SPA (static assets — zero build)
│   ├── index.html                # HTML shell, CSP, import map
│   ├── styles.css                # Glassmorphic styling, HUD overlays (1957 lines)
│   ├── app.js                    # Application boot coordinator
│   ├── _headers                  # Edge security headers (7 rules)
│   │
│   ├── js/                       # 65+ ES6 modules
│   │   ├── engine.js             # Render loop, camera, fog, shadow, fade zones (~600 lines)
│   │   ├── engine/               # Sub-modules
│   │   │   ├── index.js          # Barrel re-export
│   │   │   ├── camera.js         # Orbit controls, exit watch, auto-align
│   │   │   ├── movement.js       # Local player kinematics, collision, jetpack
│   │   │   └── jetpack.js        # Flight system, particles, wings
│   │   │
│   │   ├── building.js           # Main building coordinator (~530 lines orchestrating 10 sub-modules)
│   │   ├── building/             # Sub-modules
│   │   │   ├── ground-floor.js   # Floor tiles, medallion, screens, indicators
│   │   │   ├── walls.js          # Wall slabs, corridor walls, lower wall merging
│   │   │   ├── upper-floor.js    # Mezzanine floors, columns, glass railings, ceilings
│   │   │   ├── upstairs.js       # Furniture factories + zone builders (createChair, createTable, etc.)
│   │   │   ├── roof.js           # Gabled terracotta roof with pediments
│   │   │   ├── doors.js          # Door frame geometry
│   │   │   ├── torches.js        # Wall torch geometry + lights
│   │   │   ├── classroom.js      # Lecture hall furniture
│   │   │   ├── elevator.js       # Elevator car geometry + door pivots
│   │   │   └── materials.js      # Shared building materials
│   │   │
│   │   ├── scenery.js            # Barrel file — re-exports from scenery/*.js
│   │   ├── scenery/              # All outdoor models and utilities
│   │   │   ├── plaza.js          # Fountain plaza, room indicators, banners
│   │   │   ├── fountain-water.js # Animated water surfaces, fish, bubbles (extracted from plaza.js)
│   │   │   ├── amphitheater.js   # Open-air amphitheater with stage
│   │   │   ├── concert-venue.js  # Concert hall with dome + giant screen
│   │   │   ├── castle.js         # Medieval castle with towers + dungeon (1882 lines)
│   │   │   ├── airport.js        # Runway, control tower, hangar, helipad, jet, helicopter
│   │   │   ├── underground-city.js # Cave entrance + subterranean city
│   │   │   ├── river.js          # Meandering river with shader water + waterfall + bridge
│   │   │   ├── roads.js          # Terrain-following roads + bridge
│   │   │   ├── lazy-venues.js    # Proximity-based dynamic import for distant landmarks
│   │   │   ├── foliage.js        # Bushes, ornamental trees, flower clusters
│   │   │   ├── world-details.js  # Trees, ponds, wildflowers, grass patches
│   │   │   ├── furniture.js      # Shared furniture factories (createBench, createPlant, etc.)
│   │   │   ├── assets.js         # Shared geometries, sprites, boulders
│   │   │   ├── utils.js          # Terrain deformation, floor helper, collider helper
│   │   │   ├── venues.js         # Eager venue coordinator
│   │   │   └── visibility.js     # Frustum/distance culling (48u rooms, 88u outdoor)
│   │   │
│   │   ├── room-panel.js         # Room sidebar coordinator
│   │   ├── room-panel/           # Sub-modules
│   │   │   ├── event-board.js    # Room status board
│   │   │   ├── media.js          # YouTube/Meet iframe sync (~530 lines)
│   │   │   └── player-list.js    # Room player avatars
│   │   │
│   │   ├── ui.js                 # HUD panels coordinator (keyboard, chat, event wiring)
│   │   ├── ui/                   # UI sub-modules
│   │   │   ├── index.js          # Barrel re-export
│   │   │   ├── debug-panel.js    # FPS, position, scene stats
│   │   │   ├── elevator.js       # Elevator state machine + UI (door open, ride, proximity)
│   │   │   ├── dev-state.js      # Developer tools shared state
│   │   │   ├── dev-api.js        # LLM API (window.metalyceumDev with 25 methods)
│   │   │   ├── login.js          # Login form, avatar color picker
│   │   │   └── soundtrack-panel.js # Music player UI
│   │   │
│   │   ├── physics/              # Physics barrel (future: physics.js + physics-engine.js)
│   │   │   └── index.js          # Re-exports both modules
│   │   │
│   │   ├── midi/                 # MIDI soundtrack data
│   │   │   └── soundtrack-data.js # 10 track definitions (extracted from config.js, -529 lines)
│   │   │
│   │   ├── config.js             # Client configuration (396 lines — down from 925)
│   │   ├── state.js              # Shared mutable state (276 lines)
│   │   ├── math.js               # Math utilities (HALF_PI, FLAT, lerp, pointToSegmentDistSq)
│   │   ├── utils.js              # Shared helpers (isWorldPlacementAllowed, venue roads)
│   │   ├── multiplayer.js        # WebSocket connection + message handler registry (14 message types)
│   │   ├── physics.js            # Terrain height, collision, room lookup
│   │   ├── physics-engine.js     # Cannon-es XZ collision proxy
│   │   ├── characters.js         # Player/NPC avatars, animation, NPC spawn + update
│   │   ├── audio.js              # MIDI soundtrack synth (789 lines, well-structured)
│   │   ├── chat.js               # Chat log, bubbles, scope
│   │   ├── room-animation.js     # Fountain, water, indicator animations
│   │   ├── editor.js             # World editor (TransformControls, asset registry)
│   │   ├── dev-tools.js          # Runtime inspection, audit, 3D helpers (~1634 lines)
│   │   ├── textures.js           # 9 procedural canvas textures (grass, wood, stone, brick, etc.)
│   │   ├── fade-system.js        # Zone-based opacity transition system
│   │   ├── lighting.js           # Torch flicker updates
│   │   ├── environment.js        # HDRI environment loader
│   │   ├── theater.js            # Fullscreen media overlay
│   │   └── minimap.js            # 2D overhead minimap
│   │
│   └── midi/                     # MIDI files (10 tracks × 3-8 instrument parts)
│
├── test/                         # Tests
│   ├── client/                   # Client unit/integration tests
│   │   ├── physics.test.ts       # River distance, terrain height
│   │   ├── dev-tools.test.ts     # World audit, terrain queries
│   │   ├── cannon-integration.test.ts
│   │   └── engine.browser.test.ts  # WebGL perf budget (420 draw calls, 850K triangles, 15 textures)
│   └── tsconfig.json
│
├── docs/                         # Documentation
│   ├── scenery-physics-lighting-comparison.md  # Full change history across 3 major refactors
│   ├── superpowers/              # Design docs for major features
│   └── structure-review.md       # Codebase organization analysis
│
├── screenshots/                  # README screenshots
├── wrangler.jsonc                # Cloudflare Workers config
├── tsconfig.json                 # TypeScript config (src/ only)
├── vitest.config.ts              # Vitest config
└── package.json                  # Dependencies + scripts
```

### World Landmarks (5)

| Landmark | Coordinates | Radius | Builder | Load |
|----------|-------------|--------|---------|------|
| 🏰 Castle | (130, -80) | 40 | `scenery/castle.js` (1882 lines) | Lazy at 100u |
| 🛩️ Airport | (160, 220) | 50 | `scenery/airport.js` (612 lines) | Lazy at 120u |
| 🏛️ Amphitheater | (65, 150) | 22 | `scenery/amphitheater.js` | Eager |
| 🎵 Concert Venue | (-85, 140) | 23 | `scenery/concert-venue.js` (586 lines) | Eager |
| 🕳️ Underground City | (120, 80) | 20 | `scenery/underground-city.js` | Lazy at 95u |

### Interactive Rooms (12)

| ID | Name | Floor | Type | Location |
|:--:|------|:-----:|------|----------|
| 0 | North Hall | Ground | Room | West wing |
| 1 | East Studio | Ground | Room | West wing |
| 2 | Open Workshop | Ground | Room | West wing |
| 3 | Broadcast Room | Ground | Room | West wing |
| 4 | South Lounge | Ground | Room | East wing |
| 5 | Crit Room | Ground | Room | East wing |
| 6 | Screening Room | Ground | Room | East wing |
| 7 | Commons | Ground | Room | East wing |
| 8 | Outdoor Amphitheater | Ground | Venue | Northeast |
| 9 | Concert Venue | Ground | Venue | Northwest |
| 10 | Upper Gallery | Second | Room | East wing (mezzanine) |
| 12 | Underground City | Subterranean | Venue | Southeast |

---

## 💾 SQLite Database Schema

Inside `MetalyceumWorld`, Durable Object SQLite stores the following tables:

### `room_events`
```sql
CREATE TABLE IF NOT EXISTS room_events (
  room_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  source_value TEXT NOT NULL,
  start_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
)
```

### `world_assets`
```sql
CREATE TABLE IF NOT EXISTS world_assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  rotation_y REAL NOT NULL,
  scale REAL NOT NULL,
  room_id INTEGER NOT NULL
)
```

### `chat_messages`
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL,
  username TEXT NOT NULL,
  color TEXT NOT NULL,
  message TEXT NOT NULL,
  scope TEXT NOT NULL,
  room_id INTEGER,
  created_at INTEGER NOT NULL
)
```

### `meta`
```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, 
  value TEXT NOT NULL
)
```

All queries use prepared statements (`?` placeholders). Chat history is automatically pruned to the last 100 messages via `DELETE ... WHERE id NOT IN (SELECT id FROM chat_messages ORDER BY id DESC LIMIT 100)`.

---

## 🚀 Running & Developing Locally

### Prerequisites
- **Node.js v18+** (for Wrangler CLI and Vitest)
- **Wrangler CLI** (included via `npm install`)

### 1. Installation
```bash
npm install
npx playwright install chromium   # for e2e tests
```

### 2. Start Local Server
```bash
npm run dev
```
Open [http://localhost:8787](http://localhost:8787) in your browser. Enter a username, pick an avatar color, and click **Join** to explore.

### 3. Run Tests
```bash
npm run test          # 111 unit + client tests (Vitest)
npm run test:e2e      # Playwright browser/e2e tests
```

### 4. Type Check
```bash
npm run typecheck           # Worker TypeScript (src/)
npm run typecheck:test      # Test TypeScript (test/)
```

### 5. Deploy to Cloudflare
```bash
npm run deploy
```

### Development Workflow
```bash
# No build step needed — just edit .js files and refresh the browser
# The import map handles module resolution at runtime

# To add a new venue:
# 1. Create scenery/my-venue.js with export function buildMyVenue() {}
# 2. Add entry to VENUE_REGISTRY in config.js
# 3. Done — no coordinator code changes needed

# To add a new editable asset type:
# 1. Add factory function to ASSET_FACTORIES in editor.js
# 2. Add entry to WORLD_ASSET_CATALOG in config.js
# 3. Done — no if/else chain to modify

# E2E tests: set E2E_BASE_URL to override the default dev-server port (8787)
# when that port is already taken (e.g. E2E_BASE_URL=http://localhost:8788 npm run test:e2e)

# Bot load harness: simulate synthetic players against a running dev server
# Requires MAX_PLAYERS to be set in .dev.vars
# node scripts/bot-harness.mjs --bots 50 --hz 12
```

---

## 🎮 Controls

| Key | Action |
|:---:|--------|
| **W/A/S/D** | Walk forward/left/backward/right |
| **Space** | Jump (ground) / ascend (flight) |
| **Shift** | Sprint (ground) / descend (flight) |
| **T** | Toggle jetpack takeoff |
| **Y** | Toggle jetpack landing / crash |
| **Arrow Keys** | Orbit camera (smooth momentum-based) |
| **⌨ icon** (HUD toolbar) | Toggle controls panel |
| **Backtick (`)** | Toggle debug panel (FPS, position, scene stats) |
| **Click on screen** | Open room media / interact |
| **Walk near elevator** | Opens doors automatically; ride panel appears on right side |
| **Click ▲ on panel** | Ride elevator up (ground floor) / down (2nd floor) |
| **?debug** in URL | Enable dev tools on production |

---

## ⚡ Performance Budget

The `engine.browser.test.ts` test enforces these limits in CI:

| Metric | Budget |
|--------|--------|
| **Draw calls** | < 420 |
| **Triangles** | < 850,000 |
| **Textures** | < 15 |
| **Geometries** | < 460 |
| **Shadow map** | 512 × 512 (PCFShadowMap, on-demand) |
| **Pixel ratio** | capped at 1.0 |
| **Tone mapping** | CineonToneMapping, exposure 1.0 |

### Optimization techniques used
- InstancedMesh for trees, boulders, flowers, grass (thousands of objects → single-digit draw calls)
- Geometry merging for contiguous wall slabs and baseboards
- Dynamic CDN import for Three.js (649 KB) and cannon-es (~150 KB) — not on critical path
- Throttled torch flicker (every 4th frame), NPC updates (100u cull), vertex animations (every 2nd frame)
- Linear `THREE.Fog('#030712', 200, 600)` for distance culling
- 512² shadow maps (intentionally modest); `shadowMap.autoUpdate=false` — renders only on-demand
- Dev-tools gated behind `_isDev` check — zero runtime cost in production

---

## 🧹 Code Quality & Refactoring History

The codebase has undergone systematic refactoring to reduce duplication and improve modularity:

| Refactor | Impact |
|----------|--------|
| `config.js` soundtrack extraction | -529 lines |
| `dev-tools.js` → `dev-api.js` | -842 lines |
| `plaza.js` → `fountain-water.js` | -219 lines |
| `interiors.js` → shared furniture | -115 lines |
| `multiplayer.js` switch → handler registry | -91 lines |
| `dev-tools.js` → `dev-state.js` | -70 lines |
| River polyline dedup (4 copies → 1) | Eliminates drift risk |
| Point-to-segment distance (4 copies → 1) | Eliminates drift risk |
| Wood texture generation (2 copies → 1 helper) | -80% code |
| HUD icon handlers (4 copy-paste → config loop) | -70% code |
| Rotation constants (66 hardcoded → `FLAT`/`HALF_PI`) | Standardized |
| Venue registry (hardcoded → config-driven) | Single-entry venue registration |

---

## 🔒 Configuration

### World Editor Authorization
World modification tools require a valid `WORLD_EDITOR_TOKEN` in the Worker bindings. Set `ADMIN_INIT_TOKEN` to bootstrap the initial admin owner account via `POST /api/v1/auth/init`.

### Static Resource Caching
Custom cache and security headers for static assets are configured in [`public/_headers`](public/_headers) — applied at the edge without invoking the Worker:

```
/js/*           → Cache-Control: no-cache (conditional GET via ETag)
/midi/*         → Cache-Control: public, max-age=604800 (1 week)
/app.js         → Cache-Control: no-cache
/styles.css     → Cache-Control: no-cache
```

### Security Headers
Worker responses include `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: DENY` via [`src/index.ts`](src/index.ts). CSP is delivered via `<meta>` tag in `index.html`.

---

## 🗺️ Future Development Roadmap

The following roadmap was shaped by five architectural questions posed to the project lead, then refined by a detailed performance audit and a committed design document ([`docs/superpowers/plans/2026-06-09-performance-and-roadmap-plan.md`](docs/superpowers/plans/2026-06-09-performance-and-roadmap-plan.md)). The plan below reflects the verified live-app measurements and the senior dev's recommendations.

### Design Principles

| Question | Answer | Guiding Principle |
|----------|--------|-------------------|
| Core gameplay? | **Social world with mini-games** (card games, etc.) | Every feature should create a reason for people to be together — shared activities, not just shared space |
| World shape? | **RuneScape-style expansion** — walkable in all directions, large 2D map | New content loads as you explore; the minimap becomes a navigation tool; fast-travel connects distant zones |
| Scale target? | **Several hundred concurrent users** | Start with the cheap fixes (tick-based flush, rate falloff, impostors) before the expensive one (zone DOs) |
| Asset pipeline? | **Procedural is fine** (LLM-generated code). Hybrid model importer later. | Keep the zero-build pipeline; add a `.glb` loader alongside procedural factories when needed |
| Sustainability? | **In-game currency + player economy** | Authoritative server-side wallet (`CurrencyDO`), shop UI, economy sinks (cosmetics, furniture) |

### Verified baseline (2026-06-09, live app)

| Location | FPS | Draw calls | Triangles | Geometries | Textures |
|---|---|---|---|---|---|
| Spawn (before lazy venues) | 60.3 | **62** | 116K | 129 | 11 |
| At castle (lazy venues loaded) | 60.0 | **825** | 136K | 777 | 37 |
| Back at plaza (far from landmarks) | 57.6 | **824** | 136K | 777 | 37 |
| CI perf test (vitest browser) | — | **32** | 1,050 | 25 | 4 |
| **Budget** | — | **< 420** | **< 850K** | **< 460** | **< 15** |

**Key findings:**
- Lazy-loaded landmarks (castle, airport, underground city) are never registered with the distance-culling system — 97% of the scene's 2,612 meshes bypass visibility checks. Draw calls jump 62 → 825 and stay there everywhere in the world.
- The CI budget test renders a near-empty scene (32 calls vs. 825 live), so the regression shipped invisibly.
- Server `MAX_PLAYERS = 10` — no scaling assumption has ever been tested. The `flushMovementBatch()` call runs on every `move` message and scans all sessions × all sessions, producing ~160M relevance checks/second at 200 players.

### Phase 0 — Instrument, measure, and quick wins (do first)

**Goal:** Know precisely where frame time and DO CPU go; land the cheap structural fixes.

| # | Item | Detail | Exit criterion |
|---|---|---|---|
| **0.0a** | **Cull the lazy-loaded landmarks** | Register each lazy venue's root group with `registerStaticScenery()` at appropriate distance. Fix the baked-vertex/origin-position pattern where it blocks per-mesh culling in eager venues too. | Draw calls at plaza return to ~150 or less with all venues loaded; calls vary by location |
| **0.0b** | **Make the CI perf budget real** | Replace the vitest budget assertion with a Playwright e2e step that joins the live dev server, teleports to hotspots, and asserts `renderer.info` there. | CI fails if live-app draw calls exceed budget at any probe point |
| **0.1** | Frame-time instrumentation | Extend the debug panel with per-section timings via `performance.now()` deltas plus `renderer.info` live readout. Dev-gated, zero production cost. | Panel shows ms per subsystem |
| **0.2** | Bot load harness | Headless Node script opening N WebSocket connections to `/ws`, each sending `move` at configurable Hz. Add `?bots=N` local spawn mode for client-side crowd tests. | Can simulate 200 synthetic players locally |
| **0.3** | Fix per-move flush | `flushMovementBatch()` moves from per-`move`-message to a fixed server tick (12 Hz) driven while sessions exist. | DO CPU per player-update measured before/after |
| **0.4** | Shadow on-demand | `shadowMap.autoUpdate = false`; set `needsUpdate = true` only when sun frustum re-targets, an avatar moves within shadow range, or fade state changes. | Visually identical; shadow pass absent from static frames |
| **0.5** | Lower default send rate | Default network profile changed from `normal` (20 Hz) to `efficient` (12 Hz). Server batches movement in `flushMovementBatch` on a ~12 Hz alarm tick (83 ms interval). **Done.** | No perceptible motion degradation |
| **0.6** | Async world build | Split `buildMap()` into chunks yielded via `requestIdleCallback` behind the loading screen; compile shaders progressively. | Time-to-first-frame measured before/after |
| **0.7** | Reconcile docs with code | Fix README/CLAUDE.md renderer claims (pixel ratio, tone mapping, shadow type, fog) to match `engine.js`. | Docs match code |

**Measurement gate:** After 0.1–0.2, profile with 50/100/200 bots. Phase 1 decisions (especially zone sharding) use these numbers.

### Phase 1 — Scalability foundation

**Goal:** 200+ concurrent users without degrading the experience.

| # | Item | Detail |
|---|---|---|
| **1.1** | Raise `MAX_PLAYERS` progressively | 10 → 50 → 100 → 200, each step validated with the bot harness. |
| **1.2** | Tiered relevance + rate falloff | Extend `arePlayersRelevant` to graded tiers: < 40u full rate, 40–120u reduced rate (every 2nd–4th tick), > 200u culled. Builds on existing dirty-set batching. |
| **1.3** | Remote player impostors | Beyond ~80u render remote players as billboarded sprites (reuse the name-tag sprite pipeline). Full avatar pool capped (~30 nearest); avatar meshes pooled and recycled. |
| **1.4** | Name tag culling | Render name tags only for ~20 nearest players (already distance-gated at 42u; add count cap). |
| **1.5** | Spatial hashing in the DO | Replace the all-pairs scan in `flushMovementBatch` with a coarse grid (cell ≈ relevance distance) — only if bot tests show the tick flush still saturating. |
| **1.6** | Zone DO go/no-go | Only if 200-bot tests still exceed DO CPU limits after 1.1–1.5: shard by region (museum, plaza, each landmark). This requires a design doc and is a multi-week project — do not start here. |

**Exit criterion:** 200 bots connected, walking, chatting; client holds ≥ 30 fps in a 50-avatar crowd on mid-tier hardware; DO wall-clock per tick within Cloudflare limits.

### Phase 2 — In-Game Economy

**Goal:** Establish a server-authoritative currency system. Can run in parallel with Phase 0/1 (no renderer dependencies).

| Item | Detail |
|------|--------|
| **`CurrencyDO`** | New Durable Object following `AdminDO` patterns: SQLite, audit log, internal endpoint contracts in `src/internal/`. All mutations server-side via `credit`/`debit`/`transfer` with idempotency keys. |
| **Wallet UI** | Balance display in the HUD, transaction history panel. |
| **Admin tools** | Grant/revoke currency, set shop prices, view transaction logs — in the existing admin API surface. |
| **Cosmetic shop** | First sink: name color changes, chat badge styles. |
| **Furniture shop** | Purchasable World Editor assets via in-game currency instead of admin tokens. |
| **Dependency** | Phase 2 is server + UI work, independent of the renderer. Can start as soon as Phase 0 lands. |

### Phase 3 — Mini-Games (Card Games)

**Goal:** Add a game framework for turn-based card games. Depends on Phase 2 (chips = currency).

| Item | Detail |
|------|--------|
| **Game-session DOs** | One Durable Object per active game. World/zone DO relays `game_action` messages. |
| **Deck rendering** | Procedural 52-card deck via Canvas2D textures — baked into a single atlas texture to stay within the 15-texture budget. |
| **Poker skeleton** | Texas Hold'em: deal, bet, fold, call, raise, showdown, chip management. Validates the game framework. |
| **Table UI** | 3D table surface in rooms + 2D hand overlay in the existing room panel. |
| **Dependency** | Phase 2 (currency) — chips are needed before card games can function. |

### Phase 4 — World Expansion

**Goal:** New explorable zones beyond 600×600. Depends on Phase 1 (zone/interest decisions — expanding before distance-tiered broadcasting multiplies irrelevant updates).

| Item | Detail |
|------|--------|
| **Second continent** | New landmass at approximately (-500, -500) on its own heightmap + `VENUE_REGISTRY` entries (the lazy-venue system already supports this pattern). |
| **Fast-travel** | Clickable teleport points on an expanded minimap (RuneScape-style lodestone network). |
| **Expanded minimap** | Pan/zoom, named regions, discovery fog-of-war, route lines. |
| **Zone discovery** | First visit triggers a notification and reveals the zone on the map. |

### Phase 5 — Asset Pipeline (Hybrid)

**Goal:** Support imported 3D models alongside procedural generation. Lowest priority — procedural content is currently sufficient.

| Item | Detail |
|------|--------|
| **glTF loader** | `GLTFLoader` path in `createPlacedAssetModel` — when `modelUrl` is set, load `.glb` instead of procedural geometry. |
| **Texture loader** | Image URL fallback for `CanvasTexture` calls. |
| **Asset catalog extension** | `WORLD_ASSET_CATALOG` entries gain optional `modelUrl`/`textureUrl` fields; procedural fallback when absent. |
| **CDN hosting** | Uploaded `.glb`/`.png` files served through the existing `ASSETS` binding. |

### Sequencing

```
Phase 0 (perf measurement + quick wins)  ──► Phase 1 (scale to 200)  ──► Phase 4 (expansion)
        └─────────────► Phase 2 (economy) ──► Phase 3 (card games)
Phase 5 (asset pipeline) — anytime after Phase 0, lowest priority
```

Phases 0/1 and Phase 2 can run as parallel tracks (renderer+DO work vs. new-DO+UI work) with low merge conflict risk.

### Verification per phase

- **Phase 0/1:** Bot harness runs at 50/100/200; CI perf budgets stay green; frame-time panel numbers recorded in `docs/`.
- **Phase 2:** Unit tests for `CurrencyDO` (balance invariants, idempotency, no negative balances) in the pure-module style of `src/admin/schemas.ts`.
- **Phase 3:** Game-logic DOs unit-tested headlessly (deal/bet/showdown state machine).
- **All phases:** `npm run typecheck && npm run test` green; `metalyceumDev.buildAudit()` CLEAN after any scenery change.

### Key deviations from the earlier draft

| Earlier README | Committed plan | Reason |
|---|---|---|
| Zone DO sharding was Phase 1, step 1 | Zone DOs are step 1.6, behind a measured go/no-go gate | The O(N³) flush bug would throttle each zone from the inside; cheaper fixes (tick flush, rate falloff, impostors) may push the single-DO ceiling well past 100 players |
| Economy, mini-games, world expansion sequenced after Phase 1 | Phase 2 (economy) runs in parallel with Phase 0/1; Phase 3 depends on Phase 2; Phase 4 depends on Phase 1 | Economy server+UI work doesn't touch the renderer; card games need currency; world expansion needs distance-tiered broadcasting first |
| Performance budget tested in vitest browser | Moved to Playwright e2e probing the live dev server at five hotspot probe points with measured+25% budgets | Vitest browser scene is near-empty (32 calls vs 825 live) — budgets enforce nothing |
| No mention of bot harness or instrumentation | Phase 0.1–0.2 are the first deliverables | Without measurement, every scaling decision is speculative |

---

## 📚 Further Reading

- **[CLAUDE.md](CLAUDE.md)** — Development guidelines, architecture deep-dive, LLM dev tool documentation
- **[REASONIX.md](REASONIX.md)** — Tech stack constraints, conventions, project context
- **[docs/superpowers/plans/2026-06-09-performance-and-roadmap-plan.md](docs/superpowers/plans/2026-06-09-performance-and-roadmap-plan.md)** — The full committed roadmap plan with all measurements, risks, and exit criteria
- **[docs/scenery-physics-lighting-comparison.md](docs/scenery-physics-lighting-comparison.md)** — Full historical comparison of 3D, physics, and lighting changes across 3 major refactors
- **[docs/superpowers/](docs/superpowers/)** — Design specifications for cannon-es integration, dev-tools architecture, and upstairs furnishings
- **[MIGRATE-THREEJS.md](MIGRATE-THREEJS.md)** — Migration notes for Three.js version updates
