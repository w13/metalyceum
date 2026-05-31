# 🌌 Metalyceum

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://metalyceum.app)
[![Three.js](https://img.shields.io/badge/Three.js-r128_via_CDN-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite_in_Durable_Objects-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)

**Metalyceum** is a real-time, browser-based 3D social event world featuring room-specific YouTube Live streams and Google Meet collaboration sessions. Players customize their avatars, move freely through the three-dimensional virtual world, chat with proximity-aware or room-scoped focus, and interactively construct their surroundings using an integrated real-time World Editor.

The entire backend infrastructure is powered by a single, high-performance Cloudflare Worker backed by Durable Objects with a built-in SQLite database to handle synchronization, state persistence, and low-latency WebSocket communication.

---

## 🌟 Key Features

*   **Interactive 3D Scene**: Custom rendering with Three.js (r128) containing a physical lobby, distinct virtual rooms, bounds/physics, dynamic camera controls (first/third-person orbit controls), and avatar customization (shirt colors and display names).
*   **Real-time Multiplayer**: Powered by WebSockets via Cloudflare Durable Objects (`MetalyceumWorld`). Implements player proximity relevance calculations, location-scoped chat, and network profile adjustment (8–50 Hz position updates).
*   **Virtual Rooms & Event Streams**:
    *   **8 Synchronized Rooms**: North Hall, East Studio, Open Workshop, Broadcast Room, South Lounge, Crit Room, Screening Room, and Commons.
    *   **Live Stream/Conference Integrations**: Embedded room sidebars featuring YouTube Live watch streams or Google Meet conference URLs.
    *   **Theater Mode**: A distraction-free, maximized widescreen viewport overlay for media consumption and virtual collaboration.
*   **Collaborative World Editor**: An admin-locked in-world layout editor utilizing Three.js `TransformControls` for placing, moving, scaling, rotating, duplicating, and deleting custom geometry meshes in real-time.
*   **SQLite Persistence**: Durable storage for world asset placements, room metadata configuration, and the last 100 chat messages directly in SQLite tables inside the Durable Object.
*   **Graceful Reconnections**: A 15-second grace window resolves transient connection losses without spamming join/leave logs, maintaining the player's session identity seamlessly.
*   **MIDI Soundtrack Board**: Integrated client-side MIDI synth overlay playing background ambient soundscapes with playlist transport control.

---

## 🛠️ Technology Stack

| Component | Technology | Description / Usage |
| :--- | :--- | :--- |
| **Server Runtime** | **Cloudflare Workers** | Scalable serverless edge handlers. |
| **Real-time State** | **Durable Objects** | Single-isolate target mapping WebSockets and managing SQLite instances. |
| **Database** | **DO SQLite** | Durable storage for assets, chat histories, and rooms (`ctx.storage.sql`). |
| **Client Core** | **Vanilla ES6 Javascript** | Client-side game loop, coordinator modules, and WebSocket handlers. |
| **Graphics Engine** | **Three.js (r128)** | Render loop, OrbitControls, and TransformControls loaded via CDN. |
| **Type Check** | **TypeScript** | Static typing across server-side code and shared contracts. |
| **Testing Frame** | **Vitest** | Fast, runner-based unit tests for pure domain helpers. |

---

## 📁 Repository Layout

The project separates server logic (`src/`) from static client-side resources (`public/`):

### 📂 Server-Side Components (`src/`)
*   [src/index.ts](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/src/index.ts): Main Worker entry point. Directly handles routes `/ws`, `/debug`, and proxies admin endpoints, serving static assets for everything else.
*   [src/durable_object.ts](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/src/durable_object.ts): Defines `MetalyceumWorld`. Manages WebSocket attachments, serializes player state on hibernation, boots/seeds database, and handles WebSocket messages.
*   [src/realtime.ts](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/src/realtime.ts): Pure utility math determining proximity relevance, chat scoping, and visibility. Free of Cloudflare context, enabling local unit tests.
*   [src/validation.ts](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/src/validation.ts): Pure validators for asset coordinates, colors, usernames, and chat limits.
*   [src/constants.ts](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/src/constants.ts): Holds game state limits (e.g., `MAX_PLAYERS = 10`, `WORLD_LIMIT = 80`), default room configurations, and types.
*   [src/admin/do.ts](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/src/admin/do.ts): Defines `AdminDO`. Oversees administration metrics, audits, and configuration synchronizations.
*   [src/admin/schemas.ts](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/src/admin/schemas.ts): Zod-based inputs validation schemas for admin actions.

### 📂 Client-Side Components (`public/`)
*   [public/index.html](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/index.html): HTML UI HUD, overlays, login panels, controls, and script loads. Includes strict CSP settings.
*   [public/styles.css](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/styles.css): Complete style sheet containing glassmorphic styling, responsive layout, controls, and visual effects.
*   [public/app.js](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/app.js): Application boot coordinator that manages system hooks, timing, and setup logic.
*   [public/js/engine.js](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/js/engine.js): Manages Three.js WebGL rendering, lighting, camera orbits, and game loops.
*   [public/js/multiplayer.js](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/js/multiplayer.js): Orchestrates WebSocket connections, data frame messaging, and client serialization.
*   [public/js/physics.js](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/js/physics.js): Character physics, coordinate limits, jump gravity, and collider offsets.
*   [public/js/editor.js](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/js/editor.js): UI and manipulation code for placing and altering objects in the 3D grid.
*   [public/js/state.js](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/js/state.js): Shared mutable state accessible by all front-end subcomponents.

---

## 💾 SQLite Database Schema

Inside `MetalyceumWorld`, local storage is backed by Cloudflare SQLite database capabilities. The following tables are managed dynamically:

### `room_events`
Stores metadata and source URLs for the 8 virtual rooms:
```sql
CREATE TABLE IF NOT EXISTS room_events (
  room_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  source_value TEXT NOT NULL,
  start_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0
)
```

### `world_assets`
Stores placement definitions for customized meshes created via the World Editor:
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
Caches global and room messages to reconstruct client log buffers upon joining:
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
Tracks internal key-value configuration values (e.g., database schema and rooms versions):
```sql
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY, 
  value TEXT NOT NULL
)
```

---

## 🚀 Running & Developing Locally

### 1. Installation
Install the necessary dependencies via `npm`:
```bash
npm install
```

### 2. Start Local Environment
Run a simulated Cloudflare Workers & Durable Objects local instance using Wrangler:
```bash
npm run dev
```
Open [http://localhost:8787](http://localhost:8787) in your browser.

### 3. Verify System Tests
Execute unit tests validating validation and coordinates routing behavior:
```bash
npm run test
```

### 4. Deploy to Cloudflare
Deploy the application to the edge. This automatically validates typechecking prior to deploying a minified production bundle:
```bash
npm run deploy
```

---

## 🔒 Configuration & Administration

*   **World Editor Authorization**: World modification tools require a valid `WORLD_EDITOR_TOKEN` to be specified inside the server bindings. Setting the `ADMIN_INIT_TOKEN` environment variable bootstraps authorization controls.
*   **Static Resource Caches**: Custom cache and security headers on static asset responses (avoiding Workers execution costs) are configured via [public/_headers](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/public/_headers).
*   **Additional Project Contexts**:
    *   Refer to [CLAUDE.md](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/CLAUDE.md) for development requirements and guidelines.
    *   Refer to [REASONIX.md](file:///Users/waqqashanafi/Documents/antigravity/zealous-hawking/REASONIX.md) for tech stack constraints and conventions.
