// public/js/building/upstairs.js
// Second-floor furnishings: west wing seminar hall, executive office, Room 10 seminar.
import * as THREE from 'three';
import { state } from '../state.js';
import { MAIN_BUILDING_MEZZANINE_Y } from '../config.js';
import { HALF_PI, FLAT } from '../math.js';
import { addSceneryCollider } from '../scenery/utils.js';

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
