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

*   **RuneScape-Style Lighting**: Warm golden-hour atmosphere with a `#5070a0` to `#d4b888` sky gradient, warm sand fog (`#b8a888`, density 0.0028), and smooth indoor/outdoor lighting transitions via interpolated `_indoorMix` (0→1 over ~0.5s). Sun color `#f0c878` at position (38, 22, 12) for long dramatic shadows. Indoor ambient shifts from `#f5d4a0` to `#e8a040` with a warm point light at 0.4 intensity.

*   **Lazy-Loaded Distant Scenery**: Landmarks far from spawn (airport, castle, underground city) are dynamically imported via `import()` only when the player approaches within 95-120 units. A registry-driven system reads from `VENUE_REGISTRY` in `config.js` — adding a new lazy venue is a single config entry. Saves ~30% of startup geometry and 3 CDN fetches.

*   **Collaborative World Editor**: Admin-locked in-world layout editor using Three.js `TransformControls` for placing, moving, scaling, rotating, duplicating, and deleting custom meshes in real-time. 11 asset types in a config-driven palette. Asset rendering uses a factory registry (`ASSET_FACTORIES`) instead of a hardcoded if/else chain. Changes persist via WebSocket to SQLite.

*   **Comprehensive Fade System**: A zone-based opacity transition system handles smooth indoor/outdoor lighting blends, roof/wall fade when entering buildings, mezzanine floor fade during elevator rides (tracking `state.elevatorRideProgress` 0→1), and ground-floor object dimming when viewing from above.

*   **SQLite Persistence**: Durable Object SQLite stores world asset placements (with CRUD via editor), room event metadata, chat history (last 100 messages, automatically pruned), and internal configuration versions.

*   **MIDI Soundtrack Board**: Integrated client-side MIDI synthesizer with 10 ambient soundtracks, play/pause/skip controls, and per-track instrument volume mixing. Uses native Web Audio API oscillators (`sine`, `sawtooth`, `square`, `triangle`). Soundtrack library data stored in `midi/soundtrack-data.js`.

*   **Performance Optimized**: Shadow map 512², pixel ratio capped at 1.5, ACESFilmic tone mapping at exposure 1.3, disabled MSAA, FogExp2 linear fog, Cannon physics throttled to 30fps, NPC distance culling at 100u, torch flicker every 4th frame, draw call budget of 420 (tested in CI via `engine.browser.test.ts`).

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
| **Shadow map** | 512 × 512 (PCFSoft) |
| **Pixel ratio** | capped at 1.5 |
| **Tone mapping** | ACESFilmic, exposure 1.3 |

### Optimization techniques used
- InstancedMesh for trees, boulders, flowers, grass (thousands of objects → single-digit draw calls)
- Geometry merging for contiguous wall slabs and baseboards
- Dynamic CDN import for Three.js (649 KB) and cannon-es (~150 KB) — not on critical path
- Throttled torch flicker (every 4th frame), NPC updates (100u cull), vertex animations (every 2nd frame)
- FogExp2 for distance culling (linear, density 0.0028)
- 512² shadow maps (intentionally modest)
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

## 📚 Further Reading

- **[CLAUDE.md](CLAUDE.md)** — Development guidelines, architecture deep-dive, LLM dev tool documentation
- **[REASONIX.md](REASONIX.md)** — Tech stack constraints, conventions, project context
- **[docs/scenery-physics-lighting-comparison.md](docs/scenery-physics-lighting-comparison.md)** — Full historical comparison of 3D, physics, and lighting changes across 3 major refactors
- **[docs/superpowers/](docs/superpowers/)** — Design specifications for cannon-es integration, dev-tools architecture, and upstairs furnishings
- **[MIGRATE-THREEJS.md](MIGRATE-THREEJS.md)** — Migration notes for Three.js version updates
