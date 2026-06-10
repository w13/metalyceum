# Bot Load Baseline — Phase 1 Measurement Gate

| Field | Value |
|---|---|
| **Date** | 2026-06-10 |
| **Branch** | phase-0-performance |
| **Commit** | d390cdf |
| **Hardware** | Apple M4 (Apple Silicon), macOS Darwin 25.4.0 |
| **Node** | v22.21.1 |
| **Wrangler** | 4.98.0 |

## Methodology

Worst-case always-moving bots at 12 Hz move updates, wandering a 60-unit plaza square (x ∈ [−30, 30], z ∈ [0, 60]). Bots use unique per-run usernames to avoid the 15s disconnect-grace revival bug (Task 14). Connections staggered at 20/s to avoid thundering-herd join spikes. Each rung ran ≥ 90 seconds at full connection before measurements were taken. Between rungs: harness killed, 20s grace period wait before next rung started. Observer browser client (Playwright-driven) joined as "Observer" and teleported into the bot crowd center (0, 30) for all client-side readings. FPS measured via `requestAnimationFrame` counter over a 10s window. Frame-ms breakdown and draw-call counts read from `#debug-frame-timings` / `#debug-renderer-info` live debug panel elements. Remote player counts read from `state.remotePlayers` map. Server state confirmed via `GET /debug` JSON dump.

---

## Results Table

| Metric | 50 bots | 100 bots | 200 bots |
|---|---|---|---|
| **Connected / target** | 50 / 50 | 100 / 100 | 200 / 200 |
| **Rejected** | 0 | 0 | 0 |
| **Client FPS in crowd** | 60 | 60 | 60 |
| **mov ms** | 0.09 | 0.09 | 0.06 |
| **chr ms** | 0.06 | 0.07 | 0.13 |
| **fade ms** | 0.02 | 0.02 | 0.02 |
| **draw ms** | 3.58 | 4.15 | 6.30 |
| **Draw calls** | 593 | 841 | 1,424 |
| **Triangles** | 124k | 129k | 142k |
| **Geometry objects** | 759 | 973 | 1,448 |
| **Textures** | 70 | 90 | 144 |
| **remotePlayers known / visible** | 25 / 25 | 50 / 50 | ~100 / ~100 |
| **state_batches / 5s (steady)** | ~2,000 | ~3,950 | ~7,900 |
| **Server errors (load-related)** | 0 | 0 | 0 |

> **remotePlayers note:** The server applies proximity/relevance filtering — the Observer client sees roughly half the active bots at each rung, all visible (no frustum culling applied to the in-crowd view). At 200 bots two samples showed 111 and 91 known players; fluctuation reflects the server's per-flush relevance window as bots wander in/out of proximity range.

> **state_batches/5s scaling:** 50 bots → ~2,000 (≈ 40/s/bot); 100 bots → ~3,950 (≈ 40/s/bot); 200 bots → ~7,900 (≈ 39.5/s/bot). Near-linear server fan-out confirms the flush loop is not yet bottlenecked.

> **Server /debug at 200 bots (peak):** `sessionCount: 201, playerCount: 201, activeWebSockets: 201, dirtyPlayerCount: 0`. Zero storage init errors.

---

## Server Errors

Two classes of non-load-related errors appeared in the wrangler log across all rungs:

1. **`ws_send_failed` — "Can't call WebSocket send() after close()"** (2 occurrences, username="Observer"): Observer browser client WebSocket closed mid-send during a relevance flush. Cosmetic; the client reconnects automatically.

2. **`request_error` — "Cannot call `acceptWebSocket()` if the WebSocket was already accepted via `accept()`"** (2 occurrences at ts ≈ 1781123552 and 1781123704, username="Observer"): The Observer browser reconnected during the grace window and hit the session-revival double-accept bug (Task 14). Both events affected only the Observer client, not bot sessions. Zero bot rejections, zero capacity errors across all three rungs.

No `429 Too Many Requests`, no capacity-exceeded events, no DO exception traces under any rung.

---

## Interpretation

**The bottleneck is unambiguously the client renderer, not the server.** At 200 bots the server shows zero rejections, linear batch throughput scaling (~40 batches/bot/5s), and `dirtyPlayerCount: 0` (flush loop draining cleanly). The DO is healthy. Client FPS stays locked at 60 throughout all three rungs because the total frame budget at 200 bots (~6.5 ms draw + ~0.2 ms for chr/mov/fade = ~6.7 ms) still fits inside a 16.7 ms frame on an M4 CPU — but the signal is clear: **draw ms is the dominant cost, scaling from 3.6 ms (50 bots) to 6.3 ms (200 bots), while chr ms grows modestly (0.06 → 0.13 ms)**. Draw calls track remotePlayers almost linearly — 1 draw call per avatar skeleton segment × visible player count — reaching 1,424 calls at 200 bots. Geometry object count (759 → 1,448) confirms per-avatar draw-call fan-out is the scaling vector.

This measurement definitively selects **impostor rendering (Phase 1.3)** as the highest-leverage Phase 1 move. Avatar chr/draw is the growth path; spatial hashing (Phase 1.5) would optimize server-side relevance filtering, which is already scaling linearly with zero stall at 200 bots. Once impostors replace per-skeleton draw calls for distant players, draw-call count becomes O(distant-count × 1) instead of O(distant-count × skeleton-segments), which should flatten the draw-ms curve significantly before the FPS wall is reached on production hardware (non-M4 clients, lower GPU throughput).

A secondary observation: the server's proximity filter is delivering roughly 50% of active players to the Observer client at each rung (25/50 visible at 50-bot load, 50/100 at 100-bot load, ~100/200 at 200-bot load). This means the relevance system is already cutting client avatar burden roughly in half — spatial hashing refinement would reduce it further, but the remaining 50% that are visible are still rendered as full skeletal meshes. The impostor threshold should be tuned to kick in at roughly 15–20 units distance to eliminate the bulk of those draw calls.

---

## Known Caveats

- **Local-only, no network latency.** All WebSocket connections are loopback. Production latency (50–200 ms RTT) would increase perceived join time and may affect batching cadence. Throughput numbers are upper bounds.
- **Single DO instance on `workerd` (local).** Production Cloudflare isolates have different CPU time limits (50 ms / 30 s burst), memory caps, and I/O scheduling. The DO flush loop was not CPU-constrained in these tests but may exhibit different behavior under production isolate limits at higher player counts.
- **Worst-case movement load.** Every bot sends a move update every tick (`isMoving: true`) with a new waypoint. Real traffic idles frequently; treat these state_batches/5s numbers as a ceiling, not typical production load.
- **Grace-period revival bug (Task 14) avoided via unique usernames.** Each run uses a 4-character base-36 `RUN_ID` suffix on bot usernames. Without this, back-to-back runs would revive dead sessions still inside the 15s DISCONNECT_GRACE_MS window, which would count toward the player cap and produce misleading rejection counts. The Observer double-accept error above is the only observable manifestation of this bug in these tests (the Observer browser reconnected after a tab focus change).
- **Playwright browser client (Observer) is headless-adjacent.** The Playwright-managed Chrome instance may apply rAF throttling when the tab is not front-most. All FPS measurements were taken immediately after teleporting into the crowd with the tab active.
