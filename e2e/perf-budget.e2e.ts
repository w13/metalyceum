import { expect, test } from '@playwright/test';

// Live-app render budget. The vitest browser test builds a near-empty scene,
// so this e2e is the real enforcement point (Phase 0 plan, item 0.0b).
// TODO(ratchet): budgets are measured+25% as of 2026-06-10 (re-measured after
// fixing a SyntaxError that made the underground city silently fail to load —
// earlier numbers under-counted geometries/textures). The aspirational budget
// is <420 calls; tighten these as the base-world draw-call reduction task
// lands (plaza ~650 calls are base geometry, not venues).
// Note: geometries/textures are cumulative scene memory, and all lazy venues
// are pre-loaded before probing, so those columns are near-global; only
// calls/triangles meaningfully vary per probe. spawn is sampled before the
// lazy venues load, hence its lower geometry budget.
const BUDGETS = {
  spawn:           { calls: 860,    triangles: 196930, geometries: 620,  textures: 50 },
  castle:          { calls: 90,     triangles: 130460, geometries: 1010, textures: 50 },
  airport:         { calls: 1280,   triangles: 184660, geometries: 1010, textures: 50 },
  undergroundCity: { calls: 490,    triangles: 155280, geometries: 1010, textures: 50 },
  plazaFinal:      { calls: 740,    triangles: 174670, geometries: 1010, textures: 50 },
};

// Descriptor table for the five probe points.
// waitForVenue: the landmarkGroups key that must exist before sampling (lazy venues only).
// teleport: null = no move (spawn), string = named landmark, object = {x,z} coords.
const PROBES = [
  { name: 'spawn',           teleport: null,              waitForVenue: null              },
  { name: 'castle',          teleport: 'castle',          waitForVenue: 'castle'          },
  { name: 'airport',         teleport: 'airport',         waitForVenue: 'airport'         },
  { name: 'undergroundCity', teleport: 'undergroundCity', waitForVenue: 'undergroundCity' },
  { name: 'plazaFinal',      teleport: { x: 0, z: 44 },  waitForVenue: null              },
] as const;

// Disable video/screenshot retention for this long-running test so teardown
// doesn't exceed the test timeout on slow CI machines.
test.use({ video: 'off', screenshot: 'off' });

test('render stats stay within budget at every probe point', async ({ page }) => {
  // World build (up to 120s on slow CI) + pre-trigger all three lazy venues
  // (each can take 60–120s on software-WebGL machines) + five probe measurements.
  test.setTimeout(600_000);

  // ---- Login ----
  await page.goto('/');
  await page.fill('#username-input', 'PerfBot');
  await page.fill('#color-input', '#3b82f6');
  await page.click("button[type='submit']");
  await expect(page.locator('#login-overlay')).not.toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#connection-status')).toHaveClass(/connected/, { timeout: 30_000 });

  // Wait for metalyceumDev to be available
  await page.waitForFunction(() => typeof (window as any).metalyceumDev !== 'undefined', { timeout: 30_000 });

  // Wait for the world build to finish AND at least one frame to render.
  // state.renderer exists before buildMap (so perfStats()!==null fires too early),
  // but info.render.calls stays 0 until the animation loop renders its first frame,
  // which only starts after initEngine() + startAnimationLoop() complete in app.js.
  await page.waitForFunction(
    () => ((window as any).metalyceumDev.perfStats()?.calls ?? 0) > 0,
    { timeout: 120_000 },
  );

  // Pre-expose the state module so waitForFunction predicates can use it
  // synchronously (avoids the async-predicate/Promise-is-truthy pitfall).
  await page.evaluate(() =>
    import('/js/state.js').then((m: any) => { (window as any).__state = m.state; }),
  );
  // Sanity-check: __state must be set before the probe loop.
  await page.waitForFunction(() => typeof (window as any).__state !== 'undefined', { timeout: 5_000 });

  // ---- Helper: read perfStats ----
  const readStats = () =>
    page.evaluate(() => (window as any).metalyceumDev.perfStats());

  // ---- Helper: poll until venue group exists in landmarkGroups ----
  // Uses page.evaluate (async-safe) rather than waitForFunction with an async
  // predicate (which would be truthy on the Promise object itself, not the result).
  const waitForVenueLoad = async (venueName: string) => {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const loaded = await page.evaluate(
        (n) => (window as any).__state?.landmarkGroups?.has(n) === true,
        venueName,
      );
      if (loaded) return;
      await page.waitForTimeout(500);
    }
    throw new Error(`Venue "${venueName}" did not appear in landmarkGroups within 120s`);
  };

  const results: Record<string, { calls: number; triangles: number; geometries: number; textures: number; programs: number }> = {};

  // Short settle after world build: let the first few render frames complete
  // and the visibility system stabilise before the first probe.
  await page.waitForTimeout(1_500);

  // ---- Probe: spawn (must be sampled BEFORE the lazy-venue pre-trigger
  // teleports move the player away — its teleport is null by design).
  results.spawn = await readStats();

  // ---- Pre-trigger all lazy venues in sequence so their builders run in
  // parallel (loadZone is async — each dynamic import fires and doesn't block
  // the others once the poller tick runs). We visit each venue center once to
  // kick the lazy-loader, then wait collectively for all three to appear in
  // landmarkGroups before starting measurements. This avoids a stacked worst-
  // case (120s + 120s + 120s) by overlapping the build work.
  const lazyProbes = PROBES.filter((p) => p.waitForVenue !== null);
  for (const probe of lazyProbes) {
    await page.evaluate(
      (n) => (window as any).metalyceumDev.teleportTo(n),
      probe.teleport as string,
    );
    // Small pause so the lazy-venue tick fires (tick interval = 2s).
    await page.waitForTimeout(2_500);
  }
  // Now wait for all lazy venues collectively.
  for (const probe of lazyProbes) {
    await waitForVenueLoad(probe.waitForVenue as string);
  }

  // ---- Data-driven probe loop (spawn already sampled above) ----
  for (const probe of PROBES.filter((p) => p.teleport !== null)) {
    if (typeof probe.teleport === 'string') {
      await page.evaluate(
        (n) => (window as any).metalyceumDev.teleportTo(n),
        probe.teleport,
      );
    } else if (probe.teleport) {
      await page.evaluate(
        (c) => import('/js/ui/dev-state.js').then((m: any) => m.devTeleport(c.x, c.z)),
        probe.teleport,
      );
    }

    // No per-probe venue wait needed — all lazy venues already confirmed loaded above.

    // settle: 6-frame visibility refresh + render (~100 ms/frame, 1.5s is generous)
    await page.waitForTimeout(1_500);

    results[probe.name] = await readStats();
  }

  // ---- Log table ----
  console.log('\n[perf-budget] Measured render stats:');
  console.log(
    [
      'probe          | calls  | triangles | geometries | textures | programs',
      '---------------|--------|-----------|------------|----------|--------',
      ...Object.entries(results).map(
        ([probe, s]) =>
          `${probe.padEnd(15)}| ${String(s.calls).padEnd(7)}| ${String(s.triangles).padEnd(10)}| ${String(s.geometries).padEnd(11)}| ${String(s.textures).padEnd(9)}| ${s.programs}`,
      ),
    ].join('\n'),
  );

  // ---- Assert against budgets ----
  for (const [probe, budget] of Object.entries(BUDGETS)) {
    const stats = results[probe];
    expect(stats, `perfStats null at probe "${probe}" — dev API not ready`).not.toBeNull();
    expect(stats.calls, `${probe}: calls`).toBeLessThanOrEqual(budget.calls);
    expect(stats.triangles, `${probe}: triangles`).toBeLessThanOrEqual(budget.triangles);
    expect(stats.geometries, `${probe}: geometries`).toBeLessThanOrEqual(budget.geometries);
    expect(stats.textures, `${probe}: textures`).toBeLessThanOrEqual(budget.textures);
  }
});
