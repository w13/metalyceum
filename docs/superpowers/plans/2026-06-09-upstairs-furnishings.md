# Upstairs Furnishings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Furnish the main building's second floor with three distinct spaces — a grand seminar hall with three zones (west wing), an executive director's office (east wing north), and a classroom-seminar room (east wing south, Room 10).

**Architecture:** All geometry lives in a new `public/js/building/upstairs.js` module, exported as `buildUpperFloorFurnishings(pushUpperFloor)` and called from `buildBuilding()` in `building.js`. Shared material and geometry helpers are defined as closures inside that function. Every mesh/group is registered with `pushUpperFloor()` so it fades correctly with the existing upper-floor visibility system. Circle-table footprints are registered in `state.PLACED_ASSET_COLLIDERS` for physics.

**Tech Stack:** Three.js r184 (ESM import map), existing building fade system (`createBuildingFadeZone`), `addSceneryCollider` from `scenery/utils.js`.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Create** | `public/js/building/upstairs.js` | All second-floor furnishing geometry |
| **Modify** | `public/js/building.js` | Call `buildUpperFloorFurnishings` + re-export it |

---

## Constants (used throughout)

```
MEZZ_Y = 7.5        (MAIN_BUILDING_MEZZANINE_Y)
SCREEN_Y = 9.315    (MEZZ_Y + 3.3 * 0.55)
HALF_PI = Math.PI / 2
FLAT = -Math.PI / 2  (rotation.x for horizontal meshes)
```

Chair inward-facing rotation formula (faces the table center):
```
rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a))
```
where `a` is the angle from the table center to the chair (measured from +X, counter-clockwise).

West-facing objects (benches, exec desk chair): `rotation.y = HALF_PI`
East-facing objects (east-wall screen): `rotation.y = -HALF_PI`
Screen on west wall (faces east, into the room): `rotation.y = HALF_PI`

---

## Task 1: Scaffold `building/upstairs.js` and wire into `building.js`

**Files:**
- Create: `public/js/building/upstairs.js`
- Modify: `public/js/building.js`

- [ ] **Step 1.1 — Create the scaffold file**

```js
// public/js/building/upstairs.js
// Second-floor furnishings: west wing seminar hall, executive office, Room 10 seminar.
import * as THREE from 'three';
import { state } from '../state.js';
import { MAIN_BUILDING_MEZZANINE_Y } from '../config.js';
import { HALF_PI, FLAT } from '../math.js';
import { addSceneryCollider } from '../scenery/utils.js';

export function buildUpperFloorFurnishings(pushUpperFloor) {
  const MEZZ_Y = MAIN_BUILDING_MEZZANINE_Y;           // 7.5
  const SCREEN_Y = MEZZ_Y + 3.3 * 0.55;              // ≈ 9.315
}
```

- [ ] **Step 1.2 — Import and call from `building.js`**

In `building.js`, add the import next to the other building/* imports:
```js
import { buildUpperFloorFurnishings } from './building/upstairs.js';
```

Add the call at the end of `buildBuilding()`, after `buildRoof(...)`:
```js
  buildRoof(batcher, { limestoneMat, bronzeMat, limestoneShadowMat }, { entablatureY, registerRoofMesh: pushRoof });

  buildUpperFloorFurnishings(pushUpperFloor);

  consumeGroundFloorItems();
}
```

Add the re-export at the bottom of `building.js` alongside the other re-exports:
```js
export { buildUpperFloorFurnishings } from './building/upstairs.js';
```

- [ ] **Step 1.3 — Verify no errors**

```bash
npm run typecheck
```
Expected: no errors. The dev server (`npm run dev`) should also start without throwing.

- [ ] **Step 1.4 — Commit**

```bash
git add public/js/building/upstairs.js public/js/building.js
git commit -m "feat: scaffold upstairs furnishings module, wire into building"
```

---

## Task 2: Shared geometry helpers

All helpers are defined as inner functions inside `buildUpperFloorFurnishings` so they close over shared materials. No output yet — these will be called in subsequent tasks.

**Files:**
- Modify: `public/js/building/upstairs.js`

- [ ] **Step 2.1 — Add shared materials and all helper functions**

Replace the body of `buildUpperFloorFurnishings` with:

```js
export function buildUpperFloorFurnishings(pushUpperFloor) {
  const MEZZ_Y = MAIN_BUILDING_MEZZANINE_Y;
  const SCREEN_Y = MEZZ_Y + 3.3 * 0.55;

  // ── Shared materials ───────────────────────────────────────────────────
  const walnutMat    = new THREE.MeshStandardMaterial({ color: '#5c3317', roughness: 0.70 });
  const legMat       = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55, metalness: 0.35 });
  const seatMat      = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.85 });
  const planterMat   = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72 });
  const foliageMat   = new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.80, flatShading: true });
  const screenFrmMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.90 });
  const mahoganyMat  = new THREE.MeshStandardMaterial({ color: '#3a1508', roughness: 0.75 });
  const brassMat     = new THREE.MeshStandardMaterial({ color: '#b8860b', roughness: 0.25, metalness: 0.70 });
  const benchMat     = new THREE.MeshStandardMaterial({ color: '#3f2a1e', roughness: 0.88 });

  // ── createCircleTable ──────────────────────────────────────────────────
  // Returns a THREE.Group. group.position is set to (cx, 0, cz); all children
  // use local offsets so rotation (if any) works correctly.
  // tableMat: material for the top surface (use walnutMat or mahoganyMat).
  function createCircleTable(cx, cz, radius, tableMat) {
    const group = new THREE.Group();

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.12, 28),
      tableMat
    );
    top.position.set(0, MEZZ_Y + 1.0, 0);  // local offset from group origin
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.20, 0.9, 8),
      legMat
    );
    pedestal.position.set(0, MEZZ_Y + 0.45, 0);
    pedestal.castShadow = true;
    group.add(pedestal);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 0.07, 16),
      legMat
    );
    base.position.set(0, MEZZ_Y + 0.035, 0);
    group.add(base);

    group.position.set(cx, 0, cz);
    return group;
  }

  // ── createChair ────────────────────────────────────────────────────────
  // cx, cz: world position of the chair.
  // angleFromCenter: angle (radians, from +X CCW) from the table center to this chair.
  //   The chair's local +Z faces the table center after rotation.
  //   Formula: rotation.y = atan2(-cos A, -sin A)
  //   Proof: local +Z after rotation.y=θ → world (sinθ, 0, cosθ).
  //          Set equal to (-cosA, -sinA) → θ = atan2(-cosA, -sinA). ✓
  // accentColor: hex string for the accent stripe on the chair back.
  // executive: if true, the back panel is taller (0.9u vs 0.55u).
  function createChair(cx, cz, angleFromCenter, accentColor, executive = false) {
    const group = new THREE.Group();
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.70 });
    const backH = executive ? 0.9 : 0.55;

    // All child positions are in LOCAL space (relative to group origin).
    // group.position = (cx, 0, cz); group.rotation.y is applied on top.
    // local +Z = "front of chair" → faces the table center after rotation.
    // local -Z = "back of chair" → faces outward.

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.10, 0.50), seatMat);
    seat.position.set(0, MEZZ_Y + 0.62, 0.10);  // slightly forward (in +Z)
    seat.castShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, backH, 0.08), seatMat);
    back.position.set(0, MEZZ_Y + 0.62 + backH / 2 + 0.03, -0.18);  // rearward in -Z
    back.castShadow = true;
    group.add(back);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.09), accentMat);
    stripe.position.set(0, MEZZ_Y + 0.62 + backH * 0.75, -0.18);
    group.add(stripe);

    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.62, 4);
    [[-0.20, -0.16], [0.20, -0.16], [-0.20, 0.18], [0.20, 0.18]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, MEZZ_Y + 0.31, lz);
      leg.castShadow = true;
      group.add(leg);
    });

    group.rotation.y = Math.atan2(-Math.cos(angleFromCenter), -Math.sin(angleFromCenter));
    group.position.set(cx, 0, cz);
    return group;
  }

  // ── createPlant ────────────────────────────────────────────────────────
  // cx, cz: world base position. large: use bigger planter radius.
  // All children in local space; group.position = (cx, 0, cz).
  function createPlant(cx, cz, large = false) {
    const group = new THREE.Group();
    const planterR = large ? 0.60 : 0.50;

    const planter = new THREE.Mesh(
      new THREE.CylinderGeometry(planterR, planterR * 1.25, 0.70, 8),
      planterMat
    );
    planter.position.set(0, MEZZ_Y + 0.35, 0);
    planter.castShadow = true;
    group.add(planter);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 1.4, 5),
        foliageMat
      );
      leaf.position.set(
        Math.cos(a) * 0.12,
        MEZZ_Y + 1.15,
        Math.sin(a) * 0.12
      );
      leaf.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.25;
      leaf.castShadow = true;
      group.add(leaf);
    }

    group.position.set(cx, 0, cz);  // applied AFTER all children are in local space
    return group;
  }

  // ── createDecorScreen ──────────────────────────────────────────────────
  // Purely decorative (not wired into state.roomScreens).
  // rotY: rotation.y of the group. West-wall screen (faces east): HALF_PI.
  //       East-wall screen (faces west): -HALF_PI.
  // emissiveColor: hex string for the inner screen glow.
  function createDecorScreen(x, z, rotY, frameW, frameH, emissiveColor) {
    const group = new THREE.Group();

    const outerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, frameH, 0.20),
      screenFrmMat
    );
    outerFrame.castShadow = true;
    group.add(outerFrame);

    const innerMat = new THREE.MeshStandardMaterial({
      color: emissiveColor,
      emissive: emissiveColor,
      emissiveIntensity: 0.28,
      roughness: 0.80
    });
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(frameW - 0.4, frameH - 0.4, 0.05),
      innerMat
    );
    inner.position.z = 0.10;
    group.add(inner);

    group.position.set(x, SCREEN_Y, z);
    group.rotation.y = rotY;
    return group;
  }

  // ── createBookshelf ────────────────────────────────────────────────────
  // A mahogany bookshelf unit with 4 rows of book spines.
  // Stands against a wall; depth (0.4u) runs along the Z axis in local space.
  // rotY: rotate to press against a wall (e.g. 0 for a wall along Z, HALF_PI for a wall along X).
  function createBookshelf(cx, cz, rotY) {
    const group = new THREE.Group();
    const shelfW = 3.0, shelfH = 2.8, shelfD = 0.40;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(shelfW, shelfH, shelfD),
      mahoganyMat
    );
    frame.position.set(0, MEZZ_Y + shelfH / 2, 0);
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    const bookColors = ['#7f1d1d', '#1e3a5f', '#14532d', '#4c1d95', '#78350f', '#1e293b', '#713f12'];
    // 4 rows of books; use fixed widths to guarantee they fit without overflow
    const bookWidths = [0.13, 0.16, 0.12, 0.18, 0.14, 0.13, 0.17, 0.12, 0.15, 0.13, 0.17, 0.12, 0.13, 0.16, 0.14];
    for (let row = 0; row < 4; row++) {
      const rowY = MEZZ_Y + 0.50 + row * 0.56;
      let curX = -shelfW / 2 + 0.08;
      let bIdx = 0;
      while (curX + bookWidths[bIdx % bookWidths.length] < shelfW / 2 - 0.08) {
        const bW = bookWidths[bIdx % bookWidths.length];
        const bH = 0.38 + (bIdx % 3) * 0.06;
        const bMat = new THREE.MeshStandardMaterial({
          color: bookColors[(row * 5 + bIdx) % bookColors.length],
          roughness: 0.88
        });
        const book = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, shelfD - 0.12), bMat);
        book.position.set(curX + bW / 2, rowY + bH / 2 - 0.1, 0);
        book.castShadow = true;
        group.add(book);
        curX += bW + 0.01;
        bIdx++;
      }
    }

    group.position.set(cx, 0, cz);
    group.rotation.y = rotY;
    return group;
  }

  // ── createBench ────────────────────────────────────────────────────────
  // A wooden bench with a back panel.
  // length: length of the bench (runs along local X axis).
  // rotY: orientation. West-facing (person looks west): HALF_PI.
  function createBench(cx, cz, length, rotY) {
    const group = new THREE.Group();

    const seat = new THREE.Mesh(new THREE.BoxGeometry(length, 0.10, 0.55), benchMat);
    seat.position.set(0, MEZZ_Y + 0.58, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);

    // Back panel: in local +Z (east side when rotY = HALF_PI → person looks west)
    const back = new THREE.Mesh(new THREE.BoxGeometry(length, 0.55, 0.08), benchMat);
    back.position.set(0, MEZZ_Y + 0.88, 0.25);
    back.castShadow = true;
    group.add(back);

    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.58, 6);
    [[-length / 2 + 0.20, 0], [length / 2 - 0.20, 0]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, MEZZ_Y + 0.29, lz);
      leg.castShadow = true;
      group.add(leg);
    });

    group.position.set(cx, 0, cz);
    group.rotation.y = rotY;
    return group;
  }

  // ── createLectern ─────────────────────────────────────────────────────
  // A small angled podium. rotY: which way the presenter faces.
  function createLectern(cx, cz, rotY) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.80, 1.20, 0.60), walnutMat);
    body.position.set(0, MEZZ_Y + 0.60, 0);
    body.castShadow = true;
    group.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.52), walnutMat);
    top.position.set(0, MEZZ_Y + 1.25, 0);
    top.rotation.x = -0.35; // angled reading surface
    top.castShadow = true;
    group.add(top);

    group.position.set(cx, 0, cz);
    group.rotation.y = rotY;
    return group;
  }

  // ── placeTableWithChairs ──────────────────────────────────────────────
  // Convenience: create a circle table + N chairs, add to scene, push to upper floor.
  // Returns the collider AABB pushed to state.PLACED_ASSET_COLLIDERS.
  function placeTableWithChairs(cx, cz, tableRadius, chairCount, chairRadius, accentColor, tableMat) {
    const tableGroup = createCircleTable(cx, cz, tableRadius, tableMat);
    state.scene.add(tableGroup);
    pushUpperFloor(tableGroup);

    for (let i = 0; i < chairCount; i++) {
      const a = (Math.PI * 2 * i) / chairCount;
      const chX = cx + Math.cos(a) * chairRadius;
      const chZ = cz + Math.sin(a) * chairRadius;
      const chairGroup = createChair(chX, chZ, a, accentColor);
      state.scene.add(chairGroup);
      pushUpperFloor(chairGroup);
    }

    addSceneryCollider(
      cx - tableRadius - 0.4,
      cx + tableRadius + 0.4,
      cz - tableRadius - 0.4,
      cz + tableRadius + 0.4,
      'upstairs-table'
    );
  }

  // ── Zone builders ──────────────────────────────────────────────────────
  // (populated in subsequent tasks)
}
```

- [ ] **Step 2.2 — Verify typecheck passes**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 2.3 — Commit**

```bash
git add public/js/building/upstairs.js
git commit -m "feat: add upstairs geometry helpers (table, chair, plant, screen, bench, bookshelf)"
```

---

## Task 3: West Wing Zone 1 — The Atelier

Large theater-seminar space with dominant screen, big circle table, bench rows, and lectern.
Center of zone: x = −17.5, z = −26. Zone spans z = −38 → −14.

**Files:**
- Modify: `public/js/building/upstairs.js`

- [ ] **Step 3.1 — Add `buildWestZone1` function and call it**

Append this function inside `buildUpperFloorFurnishings`, before the closing `}`, and call it at the end:

```js
  function buildWestZone1() {
    const ZCX = -17.5, ZCZ = -26; // zone center

    // ── Rug ───────────────────────────────────────────────────────────────
    const rugMat = new THREE.MeshStandardMaterial({
      color: '#0f2044',
      emissive: '#0f2044',
      emissiveIntensity: 0.04,
      roughness: 0.82
    });
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.03, 36), rugMat);
    rug.position.set(ZCX, MEZZ_Y + 0.01, ZCZ);
    rug.receiveShadow = true;
    state.scene.add(rug);
    pushUpperFloor(rug);

    const borderMat = new THREE.MeshStandardMaterial({
      color: '#1e40af',
      emissive: '#1e40af',
      emissiveIntensity: 0.22,
      roughness: 0.60
    });
    const border = new THREE.Mesh(
      new THREE.RingGeometry(8.8, 9.2, 40),
      borderMat
    );
    border.rotation.x = FLAT;
    border.position.set(ZCX, MEZZ_Y + 0.015, ZCZ);
    state.scene.add(border);
    pushUpperFloor(border);

    // ── Large circle table + 8 chairs ─────────────────────────────────────
    placeTableWithChairs(ZCX, ZCZ, 2.2, 8, 3.2, '#1e40af', walnutMat);

    // ── Bench rows (3 rows east of table, facing west toward screen) ───────
    // Rows at x = -13, -10, -7; two benches per row at z = -28 and z = -22.
    [-13, -10, -7].forEach((bx) => {
      [-28, -22].forEach((bz) => {
        const bench = createBench(bx, bz, 4.0, HALF_PI);
        state.scene.add(bench);
        pushUpperFloor(bench);
      });
    });

    // ── Lectern (presenter faces east, toward audience) ────────────────────
    const lectern = createLectern(-26.5, ZCZ, -HALF_PI);
    state.scene.add(lectern);
    pushUpperFloor(lectern);
    addSceneryCollider(-27.1, -25.9, ZCZ - 0.4, ZCZ + 0.4, 'upstairs-lectern');

    // ── Dominant decorative screen (9 × 5.5, on west wall) ────────────────
    const screen = createDecorScreen(-29.5, ZCZ, HALF_PI, 9.0, 5.5, '#1e3a5f');
    state.scene.add(screen);
    pushUpperFloor(screen);

    // ── Floor accent strip at foot of west wall ────────────────────────────
    const stripMat = new THREE.MeshStandardMaterial({
      color: '#1e40af',
      emissive: '#1e40af',
      emissiveIntensity: 0.35,
      roughness: 0.60
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 24), stripMat);
    strip.position.set(-29.4, MEZZ_Y + 0.02, ZCZ);
    state.scene.add(strip);
    pushUpperFloor(strip);
  }

  buildWestZone1();
```

- [ ] **Step 3.2 — Run dev server and inspect in-browser**

```bash
npm run dev
```

Navigate to `http://localhost:8787`, log in, use the elevator to reach the second floor, then:

```js
metalyceumDev.teleport(-17.5, -26)
metalyceumDev.buildAudit(-17.5, -26, 20)
```

Expected: zone 1 furniture visible. No `summary: 'CLEAN'` issues for the new geometry.

- [ ] **Step 3.3 — Commit**

```bash
git add public/js/building/upstairs.js
git commit -m "feat: add west wing Zone 1 (The Atelier) — table, chairs, benches, screen"
```

---

## Task 4: West Wing Zones 2 & 3 — The Seminar and The Roundtable

Two structurally identical zones: each has a rug, two circle tables with chairs, two corner plants, a decorative screen, and a floor accent strip.

**Files:**
- Modify: `public/js/building/upstairs.js`

- [ ] **Step 4.1 — Add `buildWestZone2` and `buildWestZone3`, call both**

Append these functions before the closing `}` of `buildUpperFloorFurnishings`:

```js
  function buildWestZone(cfg) {
    // cfg: { cx, cz, rugColor, accentColor, emissiveColor, tableZs, plantZs, screenEmissive }
    const { cx, cz, rugColor, accentColor, emissiveColor, tableZs, plantZs, screenEmissive } = cfg;

    // Rug
    const rugMat = new THREE.MeshStandardMaterial({
      color: rugColor, emissive: rugColor, emissiveIntensity: 0.04, roughness: 0.82
    });
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.03, 32), rugMat);
    rug.position.set(cx, MEZZ_Y + 0.01, cz);
    rug.receiveShadow = true;
    state.scene.add(rug);
    pushUpperFloor(rug);

    const borderMat = new THREE.MeshStandardMaterial({
      color: accentColor, emissive: accentColor, emissiveIntensity: 0.22, roughness: 0.60
    });
    const border = new THREE.Mesh(new THREE.RingGeometry(6.8, 7.2, 36), borderMat);
    border.rotation.x = FLAT;
    border.position.set(cx, MEZZ_Y + 0.015, cz);
    state.scene.add(border);
    pushUpperFloor(border);

    // Two circle tables with 6 chairs each
    tableZs.forEach((tz) => {
      placeTableWithChairs(cx, tz, 1.6, 6, 2.4, accentColor, walnutMat);
    });

    // Two corner plants along the west wall
    plantZs.forEach((pz) => {
      const plant = createPlant(-28.5, pz);
      state.scene.add(plant);
      pushUpperFloor(plant);
    });

    // Standard decorative screen (7 × 4) on west wall
    const screen = createDecorScreen(-29.5, cz, HALF_PI, 7.0, 4.0, screenEmissive);
    state.scene.add(screen);
    pushUpperFloor(screen);

    // Floor accent strip
    const stripMat = new THREE.MeshStandardMaterial({
      color: accentColor, emissive: accentColor, emissiveIntensity: 0.35, roughness: 0.60
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 26), stripMat);
    strip.position.set(-29.4, MEZZ_Y + 0.02, cz);
    state.scene.add(strip);
    pushUpperFloor(strip);
  }

  // Zone 2 — The Seminar (middle, centred at z = 0)
  buildWestZone({
    cx: -17.5, cz: 0,
    rugColor:     '#7a1a1a',
    accentColor:  '#991b1b',
    emissiveColor:'#991b1b',
    tableZs:      [-6, 6],
    plantZs:      [-11, 11],
    screenEmissive:'#3b0a0a'
  });

  // Zone 3 — The Roundtable (south, centred at z = 26)
  buildWestZone({
    cx: -17.5, cz: 26,
    rugColor:     '#14532d',
    accentColor:  '#166534',
    emissiveColor:'#166534',
    tableZs:      [20, 32],
    plantZs:      [14, 38],
    screenEmissive:'#052e16'
  });
```

- [ ] **Step 4.2 — Inspect in-browser**

```js
metalyceumDev.teleport(-17.5, 0)
metalyceumDev.buildAudit(-17.5, 0, 18)
// then:
metalyceumDev.teleport(-17.5, 26)
metalyceumDev.buildAudit(-17.5, 26, 18)
```

Expected: furniture visible in both zones, no critical z-fighting issues.

- [ ] **Step 4.3 — Commit**

```bash
git add public/js/building/upstairs.js
git commit -m "feat: add west wing Zones 2 & 3 (Seminar, Roundtable)"
```

---

## Task 5: East Wing North — Executive Director's Office

Space: x +5 → +30, z −40 → −8. Center: (17.5, MEZZ_Y, −24).

**Files:**
- Modify: `public/js/building/upstairs.js`

- [ ] **Step 5.1 — Add `buildExecutiveOffice` and call it**

```js
  function buildExecutiveOffice() {
    const CX = 17.5, CZ = -24;

    // ── Rug (deep forest green) with brass border ──────────────────────────
    const rugMat = new THREE.MeshStandardMaterial({
      color: '#052e16', emissive: '#052e16', emissiveIntensity: 0.04, roughness: 0.82
    });
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.03, 32), rugMat);
    rug.position.set(CX, MEZZ_Y + 0.01, CZ);
    rug.receiveShadow = true;
    state.scene.add(rug);
    pushUpperFloor(rug);

    const brassBorderMat = new THREE.MeshStandardMaterial({
      color: '#b8860b', emissive: '#b8860b', emissiveIntensity: 0.18, roughness: 0.30, metalness: 0.60
    });
    const border = new THREE.Mesh(new THREE.RingGeometry(7.8, 8.2, 36), brassBorderMat);
    border.rotation.x = FLAT;
    border.position.set(CX, MEZZ_Y + 0.015, CZ);
    state.scene.add(border);
    pushUpperFloor(border);

    // ── Round conference table (mahogany) + 6 executive chairs ────────────
    const confTable = createCircleTable(13, CZ, 2.2, mahoganyMat);
    state.scene.add(confTable);
    pushUpperFloor(confTable);
    addSceneryCollider(13 - 2.6, 13 + 2.6, CZ - 2.6, CZ + 2.6, 'exec-conf-table');

    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const chX = 13 + Math.cos(a) * 3.2;
      const chZ = CZ + Math.sin(a) * 3.2;
      const chair = createChair(chX, chZ, a, '#b8860b', true); // executive=true
      state.scene.add(chair);
      pushUpperFloor(chair);
    }

    // ── Executive desk (mahogany slab + two side pedestals) ───────────────
    const deskTop = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.12, 2.0),
      mahoganyMat
    );
    deskTop.position.set(24, MEZZ_Y + 1.0, CZ);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    state.scene.add(deskTop);
    pushUpperFloor(deskTop);

    [-0.8, 0.8].forEach((zOff) => {
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.80), mahoganyMat);
      pedestal.position.set(24, MEZZ_Y + 0.50, CZ + zOff);
      pedestal.castShadow = true;
      state.scene.add(pedestal);
      pushUpperFloor(pedestal);
    });

    const deskTrim = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.06, 2.04), brassMat);
    deskTrim.position.set(24, MEZZ_Y + 0.94, CZ);
    state.scene.add(deskTrim);
    pushUpperFloor(deskTrim);

    addSceneryCollider(24 - 2.25 - 0.2, 24 + 2.25 + 0.2, CZ - 1.0 - 0.2, CZ + 1.0 + 0.2, 'exec-desk');

    // Executive chair east of desk, facing west.
    // angleFromCenter = 0 (chair is at +X = east of a virtual center):
    //   rotation.y = atan2(-cos 0, -sin 0) = atan2(-1, 0) = -HALF_PI → faces west. ✓
    const execChair = createChair(27.0, CZ, 0, '#b8860b', true);
    state.scene.add(execChair);
    pushUpperFloor(execChair);

    // ── Bookshelf units along north wall (z ≈ −38) ────────────────────────
    // rotY = 0: shelf faces south (depth runs along Z, so back against north wall).
    [10, 22].forEach((bx) => {
      const shelf = createBookshelf(bx, -38, 0);
      state.scene.add(shelf);
      pushUpperFloor(shelf);
      addSceneryCollider(bx - 1.5 - 0.1, bx + 1.5 + 0.1, -38 - 0.2, -38 + 0.2 + 0.4, 'exec-shelf');
    });

    // ── Corner plants (large) ─────────────────────────────────────────────
    [[7, -38], [28, -38]].forEach(([px, pz]) => {
      const plant = createPlant(px, pz, true);
      state.scene.add(plant);
      pushUpperFloor(plant);
    });

    // ── Decorative screen on east wall ────────────────────────────────────
    const screen = createDecorScreen(29.3, CZ, -HALF_PI, 7.0, 4.0, '#14120c');
    state.scene.add(screen);
    pushUpperFloor(screen);
  }

  buildExecutiveOffice();
```

- [ ] **Step 5.2 — Inspect in-browser**

```js
metalyceumDev.teleport(17.5, -24)
metalyceumDev.buildAudit(17.5, -24, 20)
```

Expected: mahogany desk and conference table visible, bookshelves against north wall, brass accents visible on rug border.

- [ ] **Step 5.3 — Commit**

```bash
git add public/js/building/upstairs.js
git commit -m "feat: add east wing north executive director's office"
```

---

## Task 6: East Wing South — Room 10 Seminar

Room 10 center: (17.5, MEZZ_Y, 8). Existing screen at (29.3, SCREEN_Y, 8) — do not touch it.

**Files:**
- Modify: `public/js/building/upstairs.js`

- [ ] **Step 6.1 — Add `buildRoom10Seminar` and call it**

```js
  function buildRoom10Seminar() {
    const CX = 17.5, CZ = 8;

    // ── Rug (warm amber) ───────────────────────────────────────────────────
    const rugMat = new THREE.MeshStandardMaterial({
      color: '#78350f', emissive: '#78350f', emissiveIntensity: 0.04, roughness: 0.82
    });
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.03, 32), rugMat);
    rug.position.set(CX, MEZZ_Y + 0.01, CZ);
    rug.receiveShadow = true;
    state.scene.add(rug);
    pushUpperFloor(rug);

    const borderMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.22, roughness: 0.55
    });
    const border = new THREE.Mesh(new THREE.RingGeometry(6.8, 7.2, 36), borderMat);
    border.rotation.x = FLAT;
    border.position.set(CX, MEZZ_Y + 0.015, CZ);
    state.scene.add(border);
    pushUpperFloor(border);

    // ── Two circle tables + 6 chairs each ─────────────────────────────────
    placeTableWithChairs(CX, 2,  1.6, 6, 2.4, '#f59e0b', walnutMat);
    placeTableWithChairs(CX, 14, 1.6, 6, 2.4, '#f59e0b', walnutMat);

    // ── Podium near screen, presenter faces west ───────────────────────────
    const podium = createLectern(27.0, CZ, -HALF_PI);
    state.scene.add(podium);
    pushUpperFloor(podium);
    addSceneryCollider(26.6, 27.4, CZ - 0.4, CZ + 0.4, 'room10-podium');

    // ── Corner plants ──────────────────────────────────────────────────────
    [[7, -5], [7, 21]].forEach(([px, pz]) => {
      const plant = createPlant(px, pz);
      state.scene.add(plant);
      pushUpperFloor(plant);
    });

    // ── Emissive accent strip along east wall (Room 10 theme: #f59e0b) ─────
    const stripMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.35, roughness: 0.55
    });
    // Strip runs N-S along east wall (x ≈ 29.4), spanning z = -5 to +23 (room height 28u)
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 28), stripMat);
    strip.position.set(29.4, MEZZ_Y + 0.02, CZ);
    state.scene.add(strip);
    pushUpperFloor(strip);
  }

  buildRoom10Seminar();
```

- [ ] **Step 6.2 — Inspect in-browser**

```js
metalyceumDev.teleport(17.5, 8)
metalyceumDev.buildAudit(17.5, 8, 18)
```

Expected: rug, two tables, chairs, podium near existing screen, corner plants visible. Existing Room 10 screen unchanged.

- [ ] **Step 6.3 — Commit**

```bash
git add public/js/building/upstairs.js
git commit -m "feat: add east wing south Room 10 seminar furnishings"
```

---

## Task 7: Full browser verification

Comprehensive audit of all three spaces using the dev tools.

**Files:** none

- [ ] **Step 7.1 — Log in and reach the second floor**

Open `http://localhost:8787`, enter any username/color, log in, and take the elevator to the second floor. Confirm `state.localPlayer.y ≈ 7.5` via the debug panel (backtick key).

- [ ] **Step 7.2 — Audit west wing (all 3 zones)**

```js
// Audit each zone center; check summary field of each result
metalyceumDev.buildAudit(-17.5, -26, 16)   // Zone 1 — The Atelier
metalyceumDev.buildAudit(-17.5, 0, 14)     // Zone 2 — The Seminar
metalyceumDev.buildAudit(-17.5, 26, 14)    // Zone 3 — The Roundtable
```

For each, read `summary`. If any show `terrain-zfight` on the rug:
- Add `polygonOffset: true, polygonOffsetFactor: -1` to the affected rug material in `upstairs.js`.

- [ ] **Step 7.3 — Audit executive office**

```js
metalyceumDev.buildAudit(17.5, -24, 22)
```

Check that bookshelves aren't clipping the north wall. If `suggestFix` returns a delta, adjust the bookshelf Z positions.

- [ ] **Step 7.4 — Audit Room 10**

```js
metalyceumDev.buildAudit(17.5, 8, 18)
```

Confirm existing Room 10 screen is unaffected.

- [ ] **Step 7.5 — Verify fade behaviour**

Walk the elevator down to ground level. Confirm that all upstairs furniture fades out (disappears) when the player is on the ground floor. Walk back up and confirm it fades back in.

- [ ] **Step 7.6 — Final typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7.7 — Final commit**

```bash
git add public/js/building/upstairs.js public/js/building.js
git commit -m "feat: complete upstairs furnishings — west wing hall, exec office, Room 10 seminar"
```
