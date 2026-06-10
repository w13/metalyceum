# Phase 0 — Performance Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all Phase 0 items from the committed roadmap ([2026-06-09-performance-and-roadmap-plan.md](2026-06-09-performance-and-roadmap-plan.md)): fix venue distance culling, make the CI perf budget real, finish the tick-based movement flush, shadow-on-demand, lower the default send rate, add frame-time instrumentation and a bot load harness, async world build, and reconcile docs — ending with a measured 50/100/200-bot baseline that gates Phase 1.

**Architecture:** Two independent tracks. Client track: the visibility system gains an explicit culling `center` (venue root groups sit at origin with placement baked into vertices, so distance culling currently measures distance to (0,0,0)); the shadow map moves to on-demand rendering; `buildMap()` yields between stages. Server track: `flushMovementBatch()` moves from per-`move`-message to an alarm-driven tick that is only scheduled while players are dirty (preserving DO hibernation); `MAX_PLAYERS` becomes env-overridable so the bot harness can connect 200 sockets locally. Verification: a Playwright e2e perf-budget test probing the live dev server replaces the vacuous vitest budget assertions as the enforcement point.

**Tech Stack:** Three.js r184 (CDN import map), Cloudflare Durable Objects (WebSocket hibernation + alarms), Vitest, Playwright, Node ≥22 (global `WebSocket` for the bot harness).

**Current working-tree state (important):** Drafts for Tasks 3, 4 (airport only), and 6 are already in the uncommitted working tree (`src/durable_object.ts`, `public/js/scenery/airport.js`, `public/js/engine.js`), plus roadmap doc updates (`README.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/structure-review.md`). Tasks below absorb and finish those drafts — do not `git checkout` them away.

**Verified baseline to beat (2026-06-09, live app):** plaza with all venues loaded = **824 draw calls** / 136K triangles / 777 geometries / 37 textures (budgets: 420 / 850K / 460 / 15). DO tests: 5 failing in `src/durable_object.test.ts` (`RangeError: init["status"] must be in the range of 200 to 599` — status-101 upgrade Response not constructible outside the Workers runtime).

---

### Task 1: Commit the in-flight documentation updates

The working tree mixes doc changes (roadmap) with code drafts. Separate them so later tasks commit clean, reviewable diffs.

**Files:**
- Commit: `README.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/structure-review.md`

- [ ] **Step 1: Review the doc diff to confirm it is docs-only**

Run: `git diff README.md CLAUDE.md .github/copilot-instructions.md docs/structure-review.md | grep -E '^\+\+\+|^---' `
Expected: only those four files listed; skim the full diff for anything that looks like code.

- [ ] **Step 2: Commit docs only (leave code drafts in the tree)**

```bash
git add README.md CLAUDE.md .github/copilot-instructions.md docs/structure-review.md
git commit -m "docs: roadmap phases, measured perf baselines, and design principles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Confirm only code drafts remain**

Run: `git status --short`
Expected: only `public/js/engine.js`, `public/js/scenery/airport.js`, `src/durable_object.ts` modified.

---

### Task 2: Fix the DO test harness (status-101 Response)

5 tests in `src/durable_object.test.ts` fail because Node's `Response` rejects `status: 101`; the Workers runtime allows it for WebSocket upgrades. Shim the constructor in the test file so "tests green" means something before we change flush behavior in Task 3.

**Files:**
- Modify: `src/durable_object.test.ts` (top of file, near existing mocks)

- [ ] **Step 1: Reproduce the failures**

Run: `npx vitest run src/durable_object.test.ts 2>&1 | tail -5`
Expected: `Tests  5 failed | 11 passed (16)`

- [ ] **Step 2: Add the Response shim**

Add near the top of `src/durable_object.test.ts`, after imports and before the mocks:

```ts
// Node's undici Response rejects status 101; the Workers runtime allows it
// for WebSocket upgrades (durable_object.ts returns `new Response(null,
// { status: 101, webSocket })`). Shim the constructor so upgrade paths are
// testable outside the Workers runtime.
const NativeResponse = globalThis.Response;

class UpgradeResponse extends NativeResponse {
  private readonly _upgradeStatus: number | null;
  readonly webSocket: unknown;

  constructor(
    body: BodyInit | null,
    init?: ResponseInit & { webSocket?: unknown },
  ) {
    if (init && init.status === 101) {
      super(body, { ...init, status: 200 });
      this._upgradeStatus = 101;
    } else {
      super(body, init);
      this._upgradeStatus = null;
    }
    this.webSocket = init?.webSocket ?? null;
  }

  override get status(): number {
    return this._upgradeStatus ?? super.status;
  }
}

beforeAll(() => {
  globalThis.Response = UpgradeResponse as unknown as typeof Response;
});
afterAll(() => {
  globalThis.Response = NativeResponse;
});
```

Add `beforeAll`/`afterAll` to the existing vitest import if not already imported. If tests assert `response.status === 101` or read `response.webSocket`, this shim satisfies both.

- [ ] **Step 3: Run the suite**

Run: `npx vitest run src/durable_object.test.ts 2>&1 | tail -5`
Expected: `16 passed` (if the `sets a cleanup alarm` test still fails on timing, fix it in Task 3, not here — note it and move on).

- [ ] **Step 4: Typecheck tests and commit**

```bash
npm run typecheck:test
git add src/durable_object.test.ts
git commit -m "test: shim status-101 Response so WebSocket upgrade paths run outside Workers runtime

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Finish the tick-based movement flush (roadmap 0.3)

The working-tree draft moved `flushMovementBatch()` from per-`move`-message to the alarm, but reschedules the alarm every ~83 ms while *any* socket is open — that keeps the DO awake at 12 Hz even when all players are idle, defeating WebSocket hibernation (DOs bill by active time). Refine: schedule the fast tick **only when dirty players exist**; otherwise fall back to the long prune alarm. `move` pulls the alarm in.

**Files:**
- Modify: `src/durable_object.ts` (working-tree draft: fields ~line 116–123, `join` handler ~line 1090, `move`/`room_change` handlers ~lines 1132/1146, `alarm()` ~line 1253)
- Test: `src/durable_object.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `Core Message Handlers` describe block in `src/durable_object.test.ts` (use the existing `createWorld`/upgrade/join helpers and `ws.sent` pattern from `dispatches moves and propagates state batches to nearby players`):

```ts
it('batches moves until the alarm tick flushes them', async () => {
  const world = await createWorld();
  // Connect two players near each other (same pattern as the existing
  // "dispatches moves" test: upgrade both, send join for both).
  const [wsAlice, wsBob] = await connectTwoNearbyPlayers(world); // reuse/extract existing setup

  wsBob.sent.length = 0; // clear init/join traffic

  // Two rapid moves from Alice — must NOT flush per-message
  world.webSocketMessage(
    wsAlice.server,
    JSON.stringify({ type: 'move', x: 1, y: 0, z: 0, ry: 0, isMoving: true }),
  );
  world.webSocketMessage(
    wsAlice.server,
    JSON.stringify({ type: 'move', x: 2, y: 0, z: 0, ry: 0, isMoving: true }),
  );
  expect(wsBob.sent.filter((m) => m.type === 'state_batch')).toHaveLength(0);

  // A near-term alarm must be scheduled (~83ms, far less than STALE_SESSION_MS)
  expect(ctx.getAlarmTimestamp()).toBeLessThan(Date.now() + 1000);

  // Alarm tick flushes exactly one batch carrying the latest position
  await world.alarm();
  const batches = wsBob.sent.filter((m) => m.type === 'state_batch');
  expect(batches).toHaveLength(1);
  expect(batches[0].players[0].x).toBe(2);
});
```

(`connectTwoNearbyPlayers` — extract the two-player setup already inlined in the existing "dispatches moves" test into a helper; adjust names to the file's actual conventions.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/durable_object.test.ts -t "batches moves" 2>&1 | tail -5`
Expected: FAIL — with the current draft, the alarm fires but `getAlarmTimestamp` reflects join-time scheduling, or the existing "dispatches moves" test shows per-message flush. Whichever way it fails, confirm it fails before changing code.

- [ ] **Step 3: Implement scheduled-on-demand flush**

In `src/durable_object.ts`:

Fields (replace the draft's `lastMoveFlushAt`):

```ts
/** True while a movement-flush alarm is pending — avoids re-arming per message. */
private moveFlushScheduled = false;
private static readonly PRUNE_INTERVAL_MS = 15_000;
// Movement flush runs at ~12 Hz to match the default network profile.
// The alarm is only armed while dirty players exist, so idle worlds
// keep hibernating instead of waking 12×/sec.
private static readonly MOVE_FLUSH_INTERVAL_MS = 83;
```

Add the scheduling helper next to `markPlayerDirty` (~line 729):

```ts
private scheduleMoveFlush(): void {
  if (this.moveFlushScheduled) return;
  this.moveFlushScheduled = true;
  void this.ctx.storage.setAlarm(
    Date.now() + MetalyceumWorld.MOVE_FLUSH_INTERVAL_MS,
  );
}
```

`move` handler (~line 1132) and `room_change` handler (~line 1146) — after `this.markPlayerDirty(session.id);` add:

```ts
this.scheduleMoveFlush();
```

`join` handler (~line 1090) — joins broadcast immediately via `this.broadcast`, so the join alarm only needs to start the prune chain; restore:

```ts
// Ensure the prune alarm is scheduled while sessions exist.
void this.ctx.storage.setAlarm(Date.now() + STALE_SESSION_MS);
```

`alarm()` (~line 1253) — replace the draft body:

```ts
async alarm(): Promise<void> {
  this.rebuildSessionsIfNeeded(); // sessions may be empty after hibernation
  const now = Date.now();
  this.moveFlushScheduled = false;

  if (this.dirtyPlayerIds.size > 0) this.flushMovementBatch();

  if (now - this.lastPruneAt >= MetalyceumWorld.PRUNE_INTERVAL_MS) {
    this.lastPruneAt = 0; // bypass the debounce so the scan always runs
    this.pruneStaleSessions(now);
    this.lastPruneAt = now;
  }

  // Reschedule while WebSocket connections remain open. Movement re-arms
  // its own fast alarm via scheduleMoveFlush(); idle worlds get the slow
  // prune alarm only, so the DO can hibernate between ticks.
  if (this.ctx.getWebSockets().length > 0) {
    await this.ctx.storage.setAlarm(now + STALE_SESSION_MS);
  }
}
```

Note: `moveFlushScheduled` is in-memory and resets on hibernation-wake — the next `move` simply re-arms, so no persistence is needed.

- [ ] **Step 4: Run the new test and the full DO suite**

Run: `npx vitest run src/durable_object.test.ts 2>&1 | tail -5`
Expected: all pass (17). If `sets a cleanup alarm when a player joins` asserts a specific timestamp window, update it to expect `now + STALE_SESSION_MS` scheduling.

- [ ] **Step 5: Typecheck, full test run, behavior check, commit**

```bash
npm run typecheck && npm run test
```

Then manual 2-player smoke: `npm run dev` (background), open two browser tabs on `http://localhost:8787`, join both, walk one around — the other tab must show smooth movement (interpolation already covers 12 Hz).

```bash
git add src/durable_object.ts src/durable_object.test.ts
git commit -m "perf(server): move movement flush from per-message to on-demand 12Hz alarm tick

flushMovementBatch ran on every move message and scanned all sessions
x all sessions — O(N² x Hz x N) at scale. Now move handlers only mark
dirty + arm a ~83ms alarm; idle worlds keep only the slow prune alarm
so the DO still hibernates.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Fix venue distance culling with explicit centers (roadmap 0.0a)

All five landmark root groups are `new THREE.Group()` left at origin — placement is baked into child vertices/positions. `refreshStaticSceneryVisibility()` measures camera distance to `object3d.position`, i.e. to **(0,0,0)** for every venue, so culling never tracks the actual landmark location and draw calls stay ~824 everywhere. Fix: let `registerStaticScenery` take an explicit world-space `center`, pass each venue's center (matching `VENUE_REGISTRY` cx/cz), and tune distances so landmarks cull at the plaza.

**Files:**
- Modify: `public/js/scenery/visibility.js`
- Modify: `public/js/scenery/castle.js:2101`, `public/js/scenery/airport.js:717-722` (working-tree draft), `public/js/scenery/underground-city.js:524`, `public/js/scenery/amphitheater.js:292`, `public/js/scenery/concert-venue.js:585`
- Test: `test/client/dev-tools.test.ts` is the closest home for a unit test of the new option (it already imports client modules in the vitest browser env); add the test alongside.

- [ ] **Step 1: Write the failing unit test**

Add to a new describe in `test/client/dev-tools.test.ts` (or a new `test/client/visibility.test.ts` if state setup is simpler standalone):

```ts
import { registerStaticScenery, refreshStaticSceneryVisibility } from '../../public/js/scenery/visibility.js';
import { state } from '../../public/js/state.js';
import * as THREE from 'three';

describe('static scenery culling centers', () => {
  beforeEach(() => {
    state.STATIC_SCENERY.length = 0;
    state.camera = new THREE.PerspectiveCamera();
    state.localPlayer = { currentRoom: -1 } as any;
  });

  it('culls by explicit center, not the group origin', () => {
    const group = new THREE.Group(); // stays at (0,0,0) — placement baked in vertices
    registerStaticScenery(group, {
      kind: 'outdoor',
      distance: 100,
      center: { x: 500, z: 500 },
    });

    state.camera.position.set(0, 2, 0); // far from center, near origin
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(false);

    state.camera.position.set(490, 2, 500); // near center
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/client/ -t "culls by explicit center" 2>&1 | tail -5`
Expected: FAIL — first assertion: `group.visible` is `true` because distance to origin is 0.

- [ ] **Step 3: Implement the `center` option**

Replace `public/js/scenery/visibility.js` lines 1–46 with:

```js
// Visibility and Culling Manager for Scenery

import * as THREE from 'three';
import {
  OUTDOOR_SCENERY_VISIBILITY_DISTANCE,
  ROOM_SCENERY_VISIBILITY_DISTANCE,
} from '../config.js';
import { state } from '../state.js';

export function registerStaticScenery(object3d, options = {}) {
  const dist =
    options.distance ||
    (options.kind === 'room'
      ? ROOM_SCENERY_VISIBILITY_DISTANCE
      : OUTDOOR_SCENERY_VISIBILITY_DISTANCE);
  // Venue root groups often sit at origin with placement baked into child
  // vertices — pass options.center {x, z} so culling measures the real spot.
  const center = options.center
    ? new THREE.Vector3(options.center.x, options.center.y ?? 0, options.center.z)
    : null;
  state.STATIC_SCENERY.push({
    object3d,
    kind: options.kind || 'outdoor',
    roomId: options.roomId ?? null,
    distance: dist,
    distanceSquared: dist * dist,
    center,
  });
  return object3d;
}

export function disposeSprite(sprite) {
  if (!sprite) return;
  if (sprite.material?.map) sprite.material.map.dispose();
  if (sprite.material) sprite.material.dispose();
}

export function refreshStaticSceneryVisibility() {
  const currentRoom = state.localPlayer.currentRoom;
  state.STATIC_SCENERY.forEach((entry) => {
    if (!entry.object3d) return;
    if (entry.kind === 'room') {
      entry.object3d.visible = currentRoom === entry.roomId;
      return;
    }

    if (!state.camera) return;
    const target = entry.center ?? entry.object3d.position;
    const distanceSq = state.camera.position.distanceToSquared(target);
    entry.object3d.visible = distanceSq <= entry.distanceSquared;
  });
}
```

Culling ignores the Y of `center` by design (y defaults to 0, camera Y is small relative to XZ distances).

- [ ] **Step 4: Update the five venue registrations**

Centers come from `VENUE_REGISTRY` (config.js) / README landmark table. Starting distances chosen so each venue culls at the plaza (origin): castle is ~153u from origin, underground city ~144u, concert venue ~163u, amphitheater ~163u, airport ~272u.

`public/js/scenery/castle.js:2101`:
```js
registerStaticScenery(group, { kind: 'outdoor', distance: 140, center: { x: 130, z: -80 } });
```

`public/js/scenery/airport.js` (replace the three working-tree-draft registrations at the end of `buildAirport` with a single group-level one — per-child registrations of `runway`/`troof` had the same origin-distance bug and group-level culling covers them):
```js
registerStaticScenery(g, { kind: 'outdoor', distance: 170, center: { x: 160, z: 220 } });
```

`public/js/scenery/underground-city.js:524`:
```js
registerStaticScenery(group, { kind: 'outdoor', distance: 110, center: { x: 120, z: 80 } });
```

`public/js/scenery/amphitheater.js:292`:
```js
registerStaticScenery(group, { kind: 'outdoor', distance: 150, center: { x: 65, z: 150 } });
```

`public/js/scenery/concert-venue.js:585`:
```js
registerStaticScenery(group, { kind: 'outdoor', distance: 150, center: { x: -85, z: 140 } });
```

- [ ] **Step 5: Run the unit test + full client tests**

Run: `npx vitest run test/client 2>&1 | tail -5`
Expected: PASS including the new culling test.

- [ ] **Step 6: Live verification — draw calls must now vary by location**

Start `npm run dev` in the background, open `http://localhost:8787`, join, then in the browser console (or drive via Playwright MCP):

```js
metalyceumDev.teleportTo('castle');   // wait ~5s for lazy load + airport via proximity
metalyceumDev.teleportTo('airport');  // wait ~5s
// back to plaza:
metalyceumDev.teleportTo('plaza');    // or walk to (0, 0)
// at each stop read:
state.renderer.info.render.calls
```

Expected: plaza ≤ ~200 calls with all venues loaded (down from 824); calls rise near each landmark and drop when leaving. If a landmark visibly pops in/out against the fog line, adjust its `distance` by ±20 and re-check — record final numbers.

- [ ] **Step 7: Run the build audit (required after any scenery change)**

In the browser console:
```js
metalyceumDev.buildAudit(0, 0, 200)
```
Expected: `summary: 'CLEAN'` (culling changes shouldn't move geometry, but verify).

- [ ] **Step 8: Commit**

```bash
git add public/js/scenery/visibility.js public/js/scenery/castle.js public/js/scenery/airport.js public/js/scenery/underground-city.js public/js/scenery/amphitheater.js public/js/scenery/concert-venue.js test/client/
git commit -m "perf(client): cull landmarks by world-space center, not origin group position

Venue root groups sit at (0,0,0) with placement baked into vertices, so
distance culling measured camera-to-origin and never hid anything: draw
calls stayed at ~824 everywhere once lazy venues loaded. Registration now
takes an explicit center matching VENUE_REGISTRY coordinates.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Real CI perf budget via Playwright e2e (roadmap 0.0b)

The vitest browser budget test renders a near-empty scene (32 calls vs 824 live) — it enforces nothing. Add a dev-API `perfStats()` method and a Playwright e2e that joins the live dev server, probes spawn / castle / airport / plaza, and asserts `renderer.info` budgets at each stop.

**Files:**
- Modify: `public/js/ui/dev-api.js` (add `perfStats` method to the `window.metalyceumDev` object)
- Create: `e2e/perf-budget.e2e.ts`
- Modify: `test/client/engine.browser.test.ts` (demote budget assertions to a comment pointing at the e2e)

- [ ] **Step 1: Add `perfStats()` to the dev API**

In `public/js/ui/dev-api.js`, inside the `window.metalyceumDev = { ... }` object literal:

```js
perfStats: () => {
  const info = state.renderer?.info;
  if (!info) return null;
  return {
    calls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length ?? 0,
  };
},
```

(`state` is already imported in dev-api.js; verify with `grep -n "import" public/js/ui/dev-api.js`.)

- [ ] **Step 2: Write the e2e perf probe**

Create `e2e/perf-budget.e2e.ts` (login helper mirrors `e2e/metalyceum.e2e.ts`):

```ts
import { expect, test } from '@playwright/test';

// Live-app render budget. The vitest browser test builds a near-empty scene,
// so this e2e is the real enforcement point (see docs/superpowers/plans/
// 2026-06-09-performance-and-roadmap-plan.md, item 0.0b).
const BUDGET = {
  calls: 420,
  triangles: 850_000,
  geometries: 460,
  textures: 40, // measured 37 live; ratchet down deliberately, see plan
};

// Probe points: name → how to get there. 'plaza' is spawn-adjacent but probed
// LAST so all lazy venues have loaded by then — that's the regression case.
const PROBES = ['castle', 'airport', 'undergroundCity', 'plaza'] as const;

async function loginAndConnect(page) {
  await page.goto('/');
  await page.fill('#username-input', 'PerfBot');
  await page.fill('#color-input', '#3b82f6');
  await page.click("button[type='submit']");
  await expect(page.locator('#login-overlay')).not.toBeVisible();
  await expect(page.locator('#connection-status')).toHaveClass(/connected/);
  await page.waitForFunction(() => typeof (window as any).metalyceumDev !== 'undefined');
}

test('render stats stay within budget at every probe point', async ({ page }) => {
  await loginAndConnect(page);
  const results: Record<string, any> = {};

  for (const probe of PROBES) {
    await page.evaluate((name) => {
      const dev = (window as any).metalyceumDev;
      if (name === 'plaza') dev.teleportTo?.('plaza') ?? dev.setPlayerPosition?.(0, 0, 30);
      else dev.teleportTo(name);
    }, probe);
    // Lazy-venue poller ticks every 2s; give load + shader compile time to settle.
    await page.waitForTimeout(6000);

    const stats = await page.evaluate(() => (window as any).metalyceumDev.perfStats());
    results[probe] = stats;
    expect(stats, `no renderer stats at ${probe}`).not.toBeNull();
    expect(stats.calls, `draw calls at ${probe}`).toBeLessThan(BUDGET.calls);
    expect(stats.triangles, `triangles at ${probe}`).toBeLessThan(BUDGET.triangles);
    expect(stats.geometries, `geometries at ${probe}`).toBeLessThan(BUDGET.geometries);
    expect(stats.textures, `textures at ${probe}`).toBeLessThan(BUDGET.textures);
  }

  console.log('[perf-budget] probe results:', JSON.stringify(results, null, 2));
});
```

Check `metalyceumDev.listLandmarks()` / `teleportTo` accepted names first (`grep -n "teleportTo" public/js/ui/dev-api.js public/js/ui/dev-state.js`) and adjust the probe keys/'plaza' fallback to what actually exists.

- [ ] **Step 3: Run it against the dev server**

Run: `npm run test:e2e -- perf-budget`
Expected: PASS with Task 4 landed; the logged probe results show plaza well under 420 calls. If textures (37) or geometries (777 pre-Task-4) still bust the budget at landmark probes, record the measured values and set the budget to measured + 25%, with a `// TODO ratchet` comment referencing the roadmap — a real, slightly-loose gate beats a fictional tight one.

- [ ] **Step 4: Demote the vitest budget assertions**

In `test/client/engine.browser.test.ts`, above the four `expect(info...)` lines (~133–136), replace the comment with:

```ts
// NOTE: this scene is near-empty in the vitest browser env (~32 calls vs
// ~150-400 live) — these are sanity floors only. The real budget gate is
// e2e/perf-budget.e2e.ts, which probes the live dev server.
```

Keep the assertions (they still catch catastrophic unit-env regressions).

- [ ] **Step 5: Commit**

```bash
npm run typecheck:test
git add public/js/ui/dev-api.js e2e/perf-budget.e2e.ts test/client/engine.browser.test.ts
git commit -m "test(e2e): enforce render budget against the live app at four probe points

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Finish shadow-on-demand (roadmap 0.4)

The working-tree draft sets `shadowMap.autoUpdate = false` and `needsUpdate = true` on sun re-target — but nothing refreshes shadows when characters move, lazy venues load, or the editor places assets, so shadows would freeze. Add a dirty-flag channel through `state` (avoids import cycles: scenery modules can't import from engine.js) plus a throttled character-motion refresh.

**Files:**
- Modify: `public/js/engine.js` (`animate()`, near the `state.renderer.render` call ~line 370)
- Modify: `public/js/scenery/lazy-venues.js` (`loadZone`)
- Modify: `public/js/editor.js` (asset add/move/delete paths)

- [ ] **Step 1: Find the character motion flags**

Run: `grep -n "isMoving\|isWalking" public/js/characters.js public/js/state.js | head -20`
Note the exact flag names on remote players and NPCs (e.g. `npc.isWalking` vs `npc.userData.walking`) and use them in Step 2.

- [ ] **Step 2: Add the on-demand refresh logic in `animate()`**

In `public/js/engine.js`, immediately before `state.renderer.render(state.scene, state.camera);` (~line 370):

```js
// Shadow map renders on demand (autoUpdate=false). Immediate refresh when
// scenery changes (state._shadowDirty — lazy venues, editor, sun re-target);
// throttled ~15Hz refresh while any character is moving so walk shadows track.
if (state._shadowDirty) {
  state.renderer.shadowMap.needsUpdate = true;
  state._shadowDirty = false;
} else if (state.frameCount % 4 === 0) {
  let moving = state.localPlayer?.isMoving === true || state.isFlying === true;
  if (!moving && state.remotePlayers) {
    for (const p of state.remotePlayers.values()) {
      if (p.isMoving) { moving = true; break; }
    }
  }
  if (!moving && state.npcs) {
    for (const npc of state.npcs) {
      if (npc.isWalking) { moving = true; break; }  // adjust to flag found in Step 1
    }
  }
  if (moving) state.renderer.shadowMap.needsUpdate = true;
}
```

(Adjust `state.isFlying` to the actual jetpack flag — `grep -n "isFlying\|jetpackActive" public/js/state.js public/js/engine/jetpack.js`.) The sun-retarget `needsUpdate = true` from the working-tree draft (~line 301) stays as-is.

- [ ] **Step 3: Mark shadows dirty on scenery changes**

`public/js/scenery/lazy-venues.js`, in `loadZone` after `builder();`:

```js
builder();
state._shadowDirty = true; // new geometry must get into the shadow map
```

`public/js/editor.js` — find the asset create/update/delete handlers (`grep -n "ASSET_FACTORIES\|scene.add\|removeFromParent\|scene.remove" public/js/editor.js | head`) and add `state._shadowDirty = true;` after each scene mutation.

- [ ] **Step 4: Visual verification**

With `npm run dev` running: join, stand still 5s (shadows stable), walk (your shadow follows), watch an NPC walk past (its shadow moves), teleport to castle and confirm the castle has shadows after lazy load, ride the elevator (no shadow artifacts). Check `state.renderer.info.render.calls` doesn't change — this saves the shadow *pass*, not draw calls, so verify FPS instead via the debug panel on a static scene.

- [ ] **Step 5: Run tests and commit**

```bash
npm run test
git add public/js/engine.js public/js/scenery/lazy-venues.js public/js/editor.js
git commit -m "perf(client): render shadow map on demand instead of every frame

Immediate refresh on sun re-target and scenery changes (state._shadowDirty),
throttled ~15Hz refresh while characters move; static frames skip the
shadow pass entirely.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Lower the default network profile to `efficient` (roadmap 0.5)

**Files:**
- Modify: `public/js/multiplayer.js:83`

- [ ] **Step 1: Change the default**

In `public/js/multiplayer.js`, the fallback in the `NETWORK_PROFILE` IIFE:

```js
  } catch (e) {}
  return 'efficient';
})();
```

(was `return 'normal';`). The `localStorage['metalyceum:netProfile']` override is unchanged, and the server flush tick (Task 3, 12 Hz) now matches the default send rate.

- [ ] **Step 2: Verify smoothness with two tabs**

Two browser tabs, walk one player around — remote motion must stay smooth (interpolation already in place). Check the sent rate: `localStorage` unset → profile label shows "Efficient" wherever the debug/soundtrack panel surfaces it.

- [ ] **Step 3: Commit**

```bash
git add public/js/multiplayer.js
git commit -m "perf(net): default network profile normal(20Hz) -> efficient(12Hz)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Frame-time instrumentation in the debug panel (roadmap 0.1)

Per-subsystem ms timings so later optimization is evidence-driven. Sampling only runs while the debug panel is open (`state.framePerfEnabled`) — zero cost otherwise.

**Files:**
- Modify: `public/js/engine.js` (`animate()` — wrap the major sections)
- Modify: `public/js/ui/debug-panel.js` (`initDebugPanel`, `updateDebugPanel`)
- Modify: `public/index.html` (debug panel markup — add a timings row; find it via `grep -n "debug-fps-val" public/index.html`)

- [ ] **Step 1: Find where the panel toggles and updates**

Run: `grep -rn "updateDebugPanel\|debug-icon-btn\|aria-hidden" public/js/ui/debug-panel.js public/js/ui.js public/js/engine.js | head -15`
Note: (a) the call site of `updateDebugPanel`, (b) where the panel open/close handler lives — that handler must set `state.framePerfEnabled = true/false`.

- [ ] **Step 2: Add section timers to `animate()`**

In `public/js/engine.js` inside `animate()`, wrap the four dominant sections. Pattern (apply at `updateLocalPlayer` ~line 216, the NPC/remote-player block ~line 160s, `updateFadeZones` ~line 245, and the `state.renderer.render` call ~line 370):

```js
const _perf = state.framePerfEnabled ? (state.framePerf ??= {}) : null;
let _t0 = 0;

if (_perf) _t0 = performance.now();
updateLocalPlayer(dt, _now);
if (_perf) _perf.movement = (_perf.movement ?? 0) * 0.9 + (performance.now() - _t0) * 0.1;
```

…and identically for keys `characters` (NPC + remote player block), `fade` (`updateFadeZones`), `render` (the `renderer.render` call). The `*0.9/+0.1` is an exponential moving average so the panel reads steadily. Declare `_perf`/`_t0` once at the top of `animate()`.

- [ ] **Step 3: Display in the debug panel**

In `public/index.html`, next to the existing FPS row in the debug panel markup, add:

```html
<div class="debug-row">
  <span>Frame ms</span>
  <span id="debug-frame-timings">—</span>
</div>
<div class="debug-row">
  <span>Renderer</span>
  <span id="debug-renderer-info">—</span>
</div>
```

In `public/js/ui/debug-panel.js` — `initDebugPanel()`: cache the two elements like the existing `debugFpsValEl` pattern. In `updateDebugPanel(now)`:

```js
if (state.framePerf && state.debugFrameTimingsEl) {
  const p = state.framePerf;
  state.debugFrameTimingsEl.textContent =
    `mov ${p.movement?.toFixed(2) ?? '—'} · chr ${p.characters?.toFixed(2) ?? '—'} · ` +
    `fade ${p.fade?.toFixed(2) ?? '—'} · gpu ${p.render?.toFixed(2) ?? '—'}`;
}
if (state.renderer && state.debugRendererInfoEl) {
  const i = state.renderer.info;
  state.debugRendererInfoEl.textContent =
    `${i.render.calls} calls · ${(i.render.triangles / 1000).toFixed(0)}k tri · ` +
    `${i.memory.geometries} geo · ${i.memory.textures} tex`;
}
```

In the panel open/close handler found in Step 1: `state.framePerfEnabled = isOpen;`.

- [ ] **Step 4: Verify live**

Open the panel (backtick): timings row shows stable ms values; `gpu` (render call) should dominate; renderer row matches `metalyceumDev.perfStats()`. Close the panel, confirm `state.framePerfEnabled === false` in the console.

- [ ] **Step 5: Run tests and commit**

```bash
npm run test
git add public/js/engine.js public/js/ui/debug-panel.js public/index.html
git commit -m "feat(dev): per-subsystem frame timings + renderer.info readout in debug panel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Bot load harness + env-overridable MAX_PLAYERS (roadmap 0.2)

A headless Node script that opens N WebSocket connections and walks them around — the measurement tool every Phase 1 decision depends on. `MAX_PLAYERS = 10` would reject bot #11, so make the cap overridable via an env binding for local dev only.

**Files:**
- Modify: `src/constants.ts:110` (Bindings type), `src/durable_object.ts:876` (cap check)
- Create: `.dev.vars` (local-only wrangler dev vars — confirm it's gitignored)
- Create: `scripts/bot-harness.mjs`

- [ ] **Step 1: Make the player cap env-overridable**

`src/constants.ts` — add to the `Bindings` type:

```ts
/** Optional override for MAX_PLAYERS (local load testing). Parsed as int. */
MAX_PLAYERS?: string;
```

`src/durable_object.ts:876` — replace the cap check:

```ts
const maxPlayers = Number(this.env.MAX_PLAYERS) > 0
  ? Number(this.env.MAX_PLAYERS)
  : MAX_PLAYERS;
if (this.sessions.size >= maxPlayers) {
```

(`this.env` is available on `DurableObject` subclasses; verify the field name with `grep -n "this.env" src/durable_object.ts`.)

Create `.dev.vars` (wrangler dev only — never deployed):

```
MAX_PLAYERS=250
```

Run: `grep -n "dev.vars" .gitignore || echo ".dev.vars" >> .gitignore`

- [ ] **Step 2: Typecheck + existing tests still pass**

Run: `npm run typecheck && npx vitest run src/durable_object.test.ts 2>&1 | tail -3`
Expected: green (tests don't set `env.MAX_PLAYERS`, so the `MAX_PLAYERS` constant path is exercised).

- [ ] **Step 3: Write the bot harness**

Create `scripts/bot-harness.mjs`:

```js
#!/usr/bin/env node
// Bot load harness — opens N WebSocket players against a Metalyceum server.
//
// Usage:
//   node scripts/bot-harness.mjs --bots 50 --hz 12 --url ws://127.0.0.1:8787/ws
//
// Requires Node >= 22 (global WebSocket). Set MAX_PLAYERS=250 in .dev.vars first.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const BOT_COUNT = Number(args.bots ?? 10);
const SEND_HZ = Number(args.hz ?? 12);
const URL_BASE = args.url ?? 'ws://127.0.0.1:8787/ws';

// Bots wander a 120x120 area around the plaza so relevance filtering is exercised.
const AREA = 60;
const SPEED = 4; // units/sec, matches walking pace

let connected = 0;
let rejected = 0;
let batchesReceived = 0;

function startBot(i) {
  const ws = new WebSocket(`${URL_BASE}?username=bot${i}`);
  const bot = {
    x: (Math.random() - 0.5) * AREA,
    z: (Math.random() - 0.5) * AREA + 30,
    tx: 0,
    tz: 0,
  };
  pickWaypoint(bot);

  ws.addEventListener('open', () => {
    connected++;
    ws.send(JSON.stringify({ type: 'join', x: bot.x, y: 0, z: bot.z, room: -1 }));
    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return clearInterval(interval);
      stepToward(bot, SPEED / SEND_HZ);
      ws.send(JSON.stringify({
        type: 'move',
        x: bot.x, y: 0, z: bot.z,
        ry: Math.atan2(bot.tx - bot.x, bot.tz - bot.z),
        isMoving: true,
      }));
    }, 1000 / SEND_HZ);
  });
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state_batch') batchesReceived++;
    } catch {}
  });
  ws.addEventListener('close', (ev) => {
    connected--;
    if (ev.code === 1013 || ev.reason?.includes('full')) rejected++;
  });
  ws.addEventListener('error', () => {});
}

function pickWaypoint(bot) {
  bot.tx = (Math.random() - 0.5) * AREA;
  bot.tz = (Math.random() - 0.5) * AREA + 30;
}

function stepToward(bot, dist) {
  const dx = bot.tx - bot.x;
  const dz = bot.tz - bot.z;
  const d = Math.hypot(dx, dz);
  if (d < 1) return pickWaypoint(bot);
  bot.x += (dx / d) * dist;
  bot.z += (dz / d) * dist;
}

// Stagger connections (20/sec) to avoid a thundering-herd join.
for (let i = 0; i < BOT_COUNT; i++) setTimeout(() => startBot(i), i * 50);

setInterval(() => {
  console.log(
    `[bots] connected=${connected}/${BOT_COUNT} rejected=${rejected} ` +
    `state_batches/5s=${batchesReceived}`,
  );
  batchesReceived = 0;
}, 5000);
```

Before trusting it, confirm the rejection path: `grep -n "Room full" src/durable_object.ts` shows a 429 HTTP response pre-upgrade — so rejected bots surface as connection errors, not close codes; adjust the `rejected` counting to the `error` listener if needed during Step 4.

- [ ] **Step 4: Validate at small scale, then at 50**

```bash
npm run dev   # background, picks up .dev.vars
node scripts/bot-harness.mjs --bots 5 --hz 12
```

Expected: `connected=5/5`, `state_batches` flowing. Then join from a real browser tab — 5 bots visible walking near the plaza, chat works. Then:

```bash
node scripts/bot-harness.mjs --bots 50 --hz 12
```

Expected: `connected=50/50 rejected=0`. Watch the browser tab FPS with the Task 8 panel open.

- [ ] **Step 5: Commit**

```bash
git add scripts/bot-harness.mjs src/constants.ts src/durable_object.ts .gitignore
git commit -m "feat(dev): bot load harness + env-overridable MAX_PLAYERS for local scale tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Async world build (roadmap 0.6)

`buildMap()` builds the entire core scene in one blocking pass before the first frame. Yield to the event loop between major stages so the loading screen animates and input stays responsive; `onProgress` is already threaded through from `initEngine`.

**Files:**
- Modify: `public/js/building.js` (`buildMap`, line 50 onward)
- Modify: `public/js/engine.js` (time-to-first-frame log, dev-gated)

- [ ] **Step 1: Measure before**

In `public/js/engine.js` `initEngine()`, around the `await buildMap(...)` call (~line 577):

```js
const _buildStart = performance.now();
await buildMap((msg) => {
  // ...existing progress callback body unchanged
});
console.log(`[engine] buildMap took ${(performance.now() - _buildStart).toFixed(0)}ms`);
```

Run the app, record the number printed (do this on the branch before Step 2).

- [ ] **Step 2: Add yield points between build stages**

In `public/js/building.js`, at the top of the module (outside `buildMap`):

```js
// Yield to the event loop between build stages so the loading screen
// animates and shaders can compile progressively instead of one long block.
const nextFrame = () =>
  new Promise((resolve) =>
    'requestAnimationFrame' in globalThis
      ? requestAnimationFrame(resolve)
      : setTimeout(resolve, 0),
  );
```

Inside `buildMap(onProgress)`, find the major stage boundaries (`grep -n "buildExteriorPlaza\|buildBuilding\|buildOutdoorVenues\|buildWorldDetails\|initLazyVenueLoading" public/js/building.js`) and insert before each stage:

```js
onProgress?.('Shaping the terrain…');      // before ground/fence/instancing
await nextFrame();
onProgress?.('Raising the plaza…');        // before buildExteriorPlaza()
await nextFrame();
onProgress?.('Constructing the museum…');  // before buildBuilding()
await nextFrame();
onProgress?.('Building the venues…');      // before buildOutdoorVenues()
await nextFrame();
onProgress?.('Planting the hills…');       // before buildWorldDetails()
await nextFrame();
```

(Match the existing `onProgress` message style — check how the current callback messages read and keep the voice consistent. `buildMap` is already `async`, so no signature change.)

- [ ] **Step 3: Measure after + full regression check**

Reload, record the new `buildMap took` number (total may be unchanged — the win is responsiveness and progressive shader compile; what must NOT happen is a large regression). Confirm the world builds completely: walk the museum, plaza, ride the elevator. Run `metalyceumDev.buildAudit(0, 0, 200)` → `CLEAN`. Run `npm run test 2>&1 | tail -3` → green (the vitest browser test awaits `initEngine`, which awaits `buildMap`, so yields are transparent to it).

- [ ] **Step 4: Commit**

```bash
git add public/js/building.js public/js/engine.js
git commit -m "perf(client): yield between buildMap stages for a responsive loading screen

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Reconcile docs with the code (roadmap 0.7)

README/CLAUDE.md claim ACESFilmic @ 1.3 / pixel ratio 1.5 / PCFSoft / FogExp2 warm-sand; `engine.js` actually uses Cineon @ 1.0 / pixel ratio 1.0 / PCFShadowMap / linear fog. Perf work keeps being reasoned about against fiction — fix the docs (do NOT "fix" the code to match the docs).

**Files:**
- Modify: `README.md` (Key Features lighting + Performance Optimized bullets, Performance Budget table)
- Modify: `CLAUDE.md` (if it repeats renderer claims — `grep -n "ACESFilmic\|1.5\|PCFSoft\|FogExp2" CLAUDE.md README.md`)

- [ ] **Step 1: Extract ground truth from the code**

Run: `grep -n "setPixelRatio\|toneMapping\|shadowMap.type\|Fog\|shadowMap.setSize\|mapSize" public/js/engine.js | head -10`
Record the actual values (known so far: pixel ratio `min(devicePixelRatio, 1.0)`, `CineonToneMapping` exposure 1.0, `PCFShadowMap`, `autoUpdate = false` after Task 6; verify fog type and shadow map size the same way).

- [ ] **Step 2: Update every stale claim**

In both files, replace each stale renderer claim with the measured value, including: tone mapping, exposure, pixel ratio cap, shadow type, shadow update policy ("on-demand" after Task 6), fog type/color/density, and the new default network profile (`efficient`, 12 Hz — Task 7). Also update the Performance Budget section to mention the e2e enforcement point (`e2e/perf-budget.e2e.ts`, Task 5) and the texture budget actually asserted there.

- [ ] **Step 3: Cross-check and commit**

Run the Step 1 grep once more against the *docs* — zero stale hits:
`grep -n "ACESFilmic\|PCFSoft\|FogExp2" README.md CLAUDE.md` → no matches.

```bash
git add README.md CLAUDE.md
git commit -m "docs: reconcile renderer/network claims with engine.js and multiplayer.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Measurement gate — 50/100/200-bot baseline (Phase 0 exit)

Everything Phase 1 decides (MAX_PLAYERS steps, spatial hashing, zone-DO go/no-go) keys off these numbers. This task produces the document, not code.

**Files:**
- Create: `docs/perf/2026-06-XX-bot-baseline.md` (use the actual date)

- [ ] **Step 1: Run the ladder**

For each N in 50, 100, 200:

```bash
npm run dev   # fresh start, background, .dev.vars MAX_PLAYERS=250
node scripts/bot-harness.mjs --bots N --hz 12
```

While running, join from a real browser and record:
- `connected=N/N`? rejection/disconnect count over 5 minutes
- Client FPS standing inside the bot crowd (debug panel, Task 8) and frame-timing breakdown (`chr` vs `gpu` ms)
- `state_batches/5s` received by one bot (proxy for flush volume)
- Server-side signals: `wrangler dev` console for errors/warnings; the `/debug` endpoint's `dirtyPlayerCount`/session stats (`curl -s http://127.0.0.1:8787/debug | head -40`)

- [ ] **Step 2: Write the baseline doc**

`docs/perf/2026-06-XX-bot-baseline.md` — table of N × {connect success, client FPS in crowd, characters-ms, render-ms, batches/5s, server errors}, plus 3–5 sentences of interpretation: where does it degrade first (client avatar rendering vs DO flush)? That answer selects between Phase 1.3 (impostors) and 1.5 (spatial hashing) as the next move.

- [ ] **Step 3: Commit and close Phase 0**

```bash
git add docs/perf/
git commit -m "docs(perf): 50/100/200-bot baseline measurements gating Phase 1

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
npm run typecheck && npm run test && npm run test:e2e
```

Expected: all green. Phase 0 exit criteria met: draw calls vary by location and stay under budget at all four e2e probes; movement flush is tick-based; shadows render on demand; bot baseline documented.

---

## Out of scope (separate plans)

- **Phase 1** (raise MAX_PLAYERS, tiered relevance, impostors, spatial hashing, zone-DO go/no-go) — plan it *after* Task 12's numbers exist; its design depends on them.
- **Phase 2** (CurrencyDO economy) — independent server+UI track; needs its own brainstorm + plan; can start any time after this plan lands.
- **Phases 3–5** (card games, world expansion, asset pipeline) — gated on Phases 2/1 respectively per the roadmap sequencing.

## Task ordering and independence

Strict order: 1 → 2 → 3 (test harness before flush changes). Task 4 → 5 (culling before the e2e budget can pass). Tasks 6, 7, 8, 10 are independent of each other and of 4–5 (any order after Task 1). Task 9 needs Task 3 (don't load-test the per-message flush). Task 11 after 6+7 (docs describe their outcomes). Task 12 last.
