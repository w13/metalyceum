# Metalyceum — Performance Recovery & Roadmap Plan

**Date:** 2026-06-09
**Status:** Draft for review
**Scope:** Fix current performance problems, then sequence the five README roadmap phases (scalability, economy, mini-games, world expansion, asset pipeline).

---

## 1. Current state (verified against code, not docs)

The codebase audit on 2026-06-09 found the render loop already heavily optimized (throttled limb animation, convergence-gated lerps, cached shadow frustum, squared-distance culling, interval-driven position sync). The remaining performance problems are **structural**, not micro-level.

### Measured baseline (2026-06-09, live app, headless Chromium on Apple Silicon)

| Location | FPS | Draw calls | Triangles | Geometries | Textures |
|---|---|---|---|---|---|
| Spawn (before lazy venues load) | 60.3 | **62** | 116K | 129 | 11 |
| At castle (lazy venues loaded) | 60.0 | **825** | 136K | 777 | 37 |
| At airport | 59.9 | **824** | 136K | 777 | 37 |
| Back at plaza (landmarks far away) | 57.6 | **824** | 136K | 777 | 37 |
| CI perf test (`engine.browser.test.ts`) | — | 32 | 1,050 | 25 | 4 |

Two conclusions jump out:

1. **The #1 client performance bug: lazy-loaded landmarks are never culled.** Once castle/airport/underground-city load, draw calls jump 62 → ~825 and *stay there at every location in the world*. The scene holds 2,612 meshes but only 86 are registered with `registerStaticScenery()` — the lazy venue builders don't register their meshes/groups with the visibility system, so 97% of meshes bypass distance culling entirely. Draw calls sit at ~2× the 420 budget, textures at ~2.5× the 15 budget, geometries at 1.7× the 460 budget.
2. **The CI perf budget test is vacuous.** In the vitest browser environment the world barely builds (32 calls / 1,050 triangles vs. 825 / 136K in the real app), so the budgets enforce nothing and the regression above shipped invisibly.

(FPS holds at 60 on Apple Silicon; 825 draw calls + 52 shader programs is exactly the profile that collapses on integrated GPUs and mid-tier laptops.)

### Client
- **World construction is synchronous at page load.** `buildMap()` builds terrain, plaza, museum, eager venues, and world details on the main thread before the first frame; `renderer.compile()` then compiles every shader. Lazy venues (castle, airport, underground city) help, but initial load still builds the entire core scene in one blocking pass.
- **Draw-call volume from procedural scenery.** The just-committed `65117b9` (geometry merging + instancing in castle/airport/underground-city) helps, but each landmark still contributes hundreds of individual meshes (the three lazy venues alone add ~760 draw calls), and many meshes sit at `position (0,0,0)` with placement baked into vertices — which defeats any position-based culling applied to them.
- **Shadow map renders every frame** (`shadowMap.autoUpdate = true`) although the scene is almost entirely static. Only the sun frustum follow (already gated to >2u player movement) and avatars need shadow refresh.
- **Avatars are expensive**: ~24 mesh/group nodes per remote player plus a sprite name tag. Fine at 10 players; fatal at 200 (≈5,000 extra scene-graph nodes, no instancing, per-frame lerp + animation each).
- **Docs/config drift**: README claims pixel ratio 1.5 / ACESFilmic / PCFSoft / FogExp2 warm-sand; `engine.js` actually uses pixel ratio 1.0, Cineon, PCFShadowMap, and linear dark-navy fog. Not a perf bug per se, but it means perf decisions are being made against stale documentation.

### Server
- **`MAX_PLAYERS = 10`** (`src/constants.ts:2`). The scale target is several hundred. Nobody has ever observed this system at 50+ players — every scaling decision so far is speculative.
- **`flushMovementBatch()` runs on every `move` message** (`durable_object.ts:1131`), and each flush iterates all sessions × all sessions. At N players sending at 20 Hz this is O(N² × N × Hz) work: 200 players ⇒ ~160M relevance checks/second. **This is the single biggest scalability defect and it is cheap to fix** (flush on a fixed tick instead).
- **Relevance filtering already exists** (`realtime.ts`: same-room, or lobby distance ≤ 18u) — README Phase 1's "distance-gated broadcasting" is largely built. What's missing is tiered outdoor distance (18u is lobby-only) and update-rate falloff with distance.
- **No load-testing capability exists.** There is no way to simulate N synthetic players, so neither the DO ceiling nor the client crowd-rendering ceiling can be measured.

### Performance budgets (nominally CI-enforced, `engine.browser.test.ts` — see conclusion 2 above)
| Metric | Budget |
|---|---|
| Draw calls | < 420 |
| Triangles | < 850,000 |
| Textures | < 15 |
| Geometries | < 460 |

---

## 2. Approaches considered

**A. Measure first, then two parallel tracks (client perf / server scale) — RECOMMENDED.**
Build instrumentation and a bot-based load harness first, fix the verified top offenders, and gate the big architectural bet (zone-sharded DOs) on measured evidence. Rationale: the render loop audit shows past optimization was done well but *blind* above 10 players; the cheapest scaling wins (tick-based flush, rate falloff, impostors) may push the single-DO ceiling well past 100 players, and sharding prematurely would freeze feature work for weeks.

**B. Architecture first (zone DOs now, per README Phase 1).**
Rejected as the opening move: it's the most expensive item, it's speculative without load data, and the O(N³) flush bug would still throttle each zone DO from the inside. Sharding stays in the plan — but behind a measured go/no-go gate.

**C. Features first (economy/mini-games now, perf later).**
Rejected: the stated priority is "major performance problems currently," and every later phase (crowded card tables, shops, second continent) multiplies entity counts — building features on a renderer/server that can't handle crowds compounds the debt.

---

## 3. The plan

### Phase 0 — Instrument, measure, and quick wins (do first)

**Goal:** Know precisely where frame time and DO CPU go; land the cheap structural fixes.

| # | Item | Detail | Exit criterion |
|---|---|---|---|
| 0.0a | **Cull the lazy-loaded landmarks** | Register each lazy venue's root group (castle, airport, underground city) with `registerStaticScenery()` at an appropriate distance, or toggle `group.visible` from `lazy-venues.js` using the same proximity radii that trigger loading. Audit eager venues (concert venue, amphitheater, river) for the same gap. Fix the baked-vertex/origin-position pattern where it blocks per-mesh culling. | Draw calls at plaza return to ~150 or less with all venues loaded; calls vary by location |
| 0.0b | **Make the CI perf budget real** | The vitest browser test renders a near-empty scene (32 calls vs. 825 live). Either make `buildMap()` run fully in the test environment, or replace the budget assertion with a Playwright e2e step that joins the live dev server, teleports to 2–3 hot spots, and asserts `renderer.info` there. | CI fails if live-app draw calls exceed budget at any probe point |
| 0.1 | Frame-time breakdown instrumentation | Extend the debug panel with per-section timings (movement, NPC, remote players, fade, render call) sampled via `performance.now()` deltas, plus `renderer.info` live readout. Dev-gated, zero production cost. | Panel shows ms per subsystem |
| 0.2 | Bot load harness | Headless Node script opening N WebSocket connections to `/ws`, each sending `move` at a configurable Hz along scripted paths. Add `?bots=N` local spawn mode for client-side crowd rendering tests. | Can simulate 200 synthetic players locally |
| 0.3 | Fix per-move flush | `flushMovementBatch()` moves from per-`move`-message to a fixed server tick (start at 12 Hz) driven while sessions exist. `move` handlers only mutate state + mark dirty. | DO CPU per player-update measured before/after; behavior identical at 2 players |
| 0.4 | Shadow on-demand | `shadowMap.autoUpdate = false`; set `needsUpdate = true` when the sun frustum re-targets, an avatar moves within shadow range, or fade state changes. | Visually identical; shadow pass absent from static frames |
| 0.5 | Lower default send rate | Default network profile `normal` (20 Hz) → `efficient` (12 Hz), per README Phase 1. Profiles already exist; one-line default change. | No perceptible motion degradation (interpolation already in place) |
| 0.6 | Async world build | Split `buildMap()` into chunks yielded via `requestIdleCallback`/microtask batches behind the existing loading screen; compile shaders progressively. | Time-to-first-frame measured before/after |
| 0.7 | Reconcile docs with code | Fix README/CLAUDE.md renderer claims (pixel ratio, tone mapping, shadow type, fog) to match `engine.js`. | Docs match code |

**Measurement gate:** After 0.1–0.2, profile with 50/100/200 bots. Decisions in Phase 1 (especially zone sharding) use these numbers.

### Phase 1 — Scalability foundation (README Phase 1, amended)

**Goal:** 200+ concurrent users without degrading the experience.

| # | Item | Notes vs README |
|---|---|---|
| 1.1 | Raise `MAX_PLAYERS` progressively | 10 → 50 → 100 → 200, each step validated with the bot harness. |
| 1.2 | Tiered relevance + rate falloff | Extend `arePlayersRelevant` to graded tiers: <40u full rate, 40–120u reduced rate (every 2nd–4th tick), >200u culled. Builds on the existing dirty-set batching. |
| 1.3 | Remote player impostors | Beyond ~80u render remote players as billboarded sprites (reuse the name-tag sprite pipeline); hard-cull beyond 200u. Full avatar pool capped (~30 nearest); avatar meshes pooled and recycled, not rebuilt per join/leave. |
| 1.4 | Name tag culling | Render name tags only for ~20 nearest players (already distance-gated at 42u; add a count cap). |
| 1.5 | Spatial hashing in the DO | Replace the all-pairs scan in `flushMovementBatch`/`getRelevantPlayersFor` with a coarse grid (cell ≈ relevance distance) once bot tests show the all-pairs tick flush saturating. |
| 1.6 | Zone DO go/no-go | Only if 200-bot tests still exceed DO CPU limits after 1.1–1.5: shard by region (museum, plaza, each landmark) with boundary handoff. This is a multi-week project — design doc required first. |

**Exit criterion:** 200 bots connected, walking, chatting; client holds ≥30 fps in a 50-avatar crowd on mid-tier hardware; DO wall-clock per tick within Cloudflare limits.

### Phase 2 — In-game economy (as README, with notes)

- `CurrencyDO` (new DO, follows `AdminDO` patterns: SQLite, audit log, internal endpoint contracts in `src/internal/`). All mutations server-side via `credit`/`debit`/`transfer` with idempotency keys.
- Wallet HUD + transaction history panel; admin grant/revoke tools in the existing admin API surface.
- First sinks: cosmetics (name color, chat badge), then furniture purchases wired into the existing `world_assets` editor flow.
- **Dependency:** none on Phase 1 — can start in parallel once Phase 0 lands, since it's server-side and UI work, not renderer work.

### Phase 3 — Mini-games (card games)

- Game-session DOs (one per active game), `game_action` messages relayed by the world/zone DO.
- Procedural 52-card deck (Canvas2D textures — watch the < 15 texture budget: bake all 52 faces into one atlas texture).
- Texas Hold'em skeleton first; table = 3D surface + hand UI in the existing room panel.
- **Dependency:** Phase 2 (chips = currency).

### Phase 4 — World expansion

- Second continent on its own heightmap + `VENUE_REGISTRY` entries (the lazy-venue system already supports this pattern).
- Fast-travel via expanded minimap (pan/zoom, named regions, discovery fog).
- **Dependency:** Phase 1 zone/interest decisions — expanding the map before distance-tiered broadcasting just multiplies irrelevant updates.

### Phase 5 — Asset pipeline (hybrid)

- `GLTFLoader` path + optional `modelUrl`/`textureUrl` in `WORLD_ASSET_CATALOG`, falling back to procedural factories; assets served via the existing `ASSETS` binding.
- **Dependency:** none hard; schedule last because procedural content is currently sufficient (per the project lead's answers in the README).

---

## 4. Sequencing summary

```
Phase 0 (perf measurement + quick wins)  ──► Phase 1 (scale to 200)  ──► Phase 4 (expansion)
        └─────────────► Phase 2 (economy) ──► Phase 3 (card games)
Phase 5 (asset pipeline) — anytime after Phase 0, lowest priority
```

Phases 0/1 and 2 can run as parallel tracks (renderer+DO work vs. new-DO+UI work) with low merge conflict risk.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Zone-DO sharding turns out unavoidable and is a large rewrite | Gate it on bot-test evidence; spatial hashing + tick flush + rate falloff buy headroom first. Boundary handoff design doc before any code. |
| Texture budget (<15) collides with card faces, shop icons, imported assets | Atlasing policy from day one; raise budget deliberately, not accidentally. |
| Single shared `state.js` mutable store becomes a bottleneck for parallel feature work | Keep new systems (wallet, games) in their own modules with explicit state slices, per the coordinator/barrel convention. |
| Bot harness behavior diverges from real clients | Bots speak the same `/ws` protocol with realistic rates; validate against 5 real browser tabs before trusting at 200. |

## 6. Verification per phase

- Phase 0/1: bot-harness runs at 50/100/200; `engine.browser.test.ts` budgets stay green; new frame-time panel numbers recorded in `docs/`.
- Phase 2: unit tests for `CurrencyDO` (balance invariants, idempotency, no negative balances) in the pure-module style of `src/admin/schemas.ts`.
- Phase 3: game-logic DOs unit-tested headlessly (deal/bet/showdown state machine).
- All phases: `npm run typecheck && npm run test` green; `metalyceumDev.buildAudit()` CLEAN after any scenery change.
- Pre-existing breakage to clear early: 4 tests in `src/durable_object.test.ts` fail in the Node environment (`RangeError: init["status"] must be in the range of 200 to 599` — the 101 WebSocket upgrade response isn't constructible outside the Workers runtime). Fix the test harness (mock/skip the upgrade path in Node) so "tests green" is meaningful again.
