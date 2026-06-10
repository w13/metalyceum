import { expect, test } from '@playwright/test';

// Live-app render budget. The vitest browser test builds a near-empty scene,
// so this e2e is the real enforcement point (Phase 0 plan, item 0.0b).
// TODO(ratchet): budgets are measured+25% as of 2026-06-10. The aspirational
// budget is <420 calls; tighten these as the base-world draw-call reduction
// task lands (plaza ~650 calls are base geometry, not venues).
const BUDGETS = {
  spawn:           { calls: 860,    triangles: 196930, geometries: 620, textures: 50 },
  castle:          { calls: 90,     triangles: 130460, geometries: 660, textures: 50 },
  airport:         { calls: 1280,   triangles: 184510, geometries: 980, textures: 50 },
  undergroundCity: { calls: 490,    triangles: 155240, geometries: 980, textures: 50 },
  plazaFinal:      { calls: 730,    triangles: 161280, geometries: 980, textures: 50 },
};

// Disable video/screenshot retention for this long-running test so teardown
// doesn't exceed the test timeout on slow CI machines.
test.use({ video: 'off', screenshot: 'off' });

test('render stats stay within budget at every probe point', async ({ page }) => {
  // Five probes × 7s settle + login + initial settle needs ample headroom.
  test.setTimeout(180_000);

  // ---- Login ----
  await page.goto('/');
  await page.fill('#username-input', 'PerfBot');
  await page.fill('#color-input', '#3b82f6');
  await page.click("button[type='submit']");
  await expect(page.locator('#login-overlay')).not.toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#connection-status')).toHaveClass(/connected/, { timeout: 30_000 });

  // Wait for metalyceumDev to be available
  await page.waitForFunction(() => typeof (window as any).metalyceumDev !== 'undefined', { timeout: 30_000 });

  // ---- Helper: read perfStats ----
  const readStats = () =>
    page.evaluate(() => (window as any).metalyceumDev.perfStats());

  // ---- Helper: teleport and settle ----
  const teleportAndWait = async (name: string, x?: number, z?: number) => {
    if (x !== undefined && z !== undefined) {
      await page.evaluate(
        ([px, pz]) =>
          import('/js/ui/dev-state.js').then((m: any) => m.devTeleport(px, pz)),
        [x, z] as [number, number],
      );
    } else {
      await page.evaluate(
        (landmarkName) => (window as any).metalyceumDev.teleportTo(landmarkName),
        name,
      );
    }
    // 7s: lazy-venue 2s poller + asset load + visibility refresh (runs every 6 frames ~100ms)
    await page.waitForTimeout(7_000);
  };

  const results: Record<string, { calls: number; triangles: number; geometries: number; textures: number; programs: number }> = {};

  // ---- Probe 1: spawn/plaza ----
  await page.waitForTimeout(7_000); // settle after login
  results.spawn = await readStats();

  // ---- Probe 2: castle ----
  await teleportAndWait('castle');
  results.castle = await readStats();

  // ---- Probe 3: airport ----
  await teleportAndWait('airport');
  results.airport = await readStats();

  // ---- Probe 4: undergroundCity ----
  await teleportAndWait('undergroundCity');
  results.undergroundCity = await readStats();

  // ---- Probe 5: plazaFinal (return to plaza) ----
  await teleportAndWait('plazaFinal', 0, 44);
  results.plazaFinal = await readStats();

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
