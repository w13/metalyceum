# Upstairs Furnishings — Design Spec
Date: 2026-06-09

## Overview

Furnish the main building's second floor (mezzanine Y = 7.5) with classroom/seminar and theater aesthetics. Three distinct spaces, each with circle tables, rugs, screens, and decor. No new structural walls are added.

## Second-Floor Layout (existing)

| Space | X range | Z range | Floor mat | Status |
|-------|---------|---------|-----------|--------|
| West wing | −30 → −5 | −40 → +40 | Slate | Empty — grand seminar hall |
| East wing north | +5 → +30 | −40 → −8 | Wood | Empty — executive office |
| East wing south (Room 10) | +5 → +30 | −8 → +23 | Wood | Screen on east wall, otherwise empty |
| Corridor | −5 → +5 | −40 → +40 | Wood | Torches + columns, leave untouched |

Second-floor interior height: 3.3u. Ceiling at Y ≈ 10.8. Screen center Y = `mezzY + f2Height × 0.55 ≈ 9.32`.

## File Structure

**New file: `public/js/building/upstairs.js`**

Exports one entry point:
```js
export function buildUpperFloorFurnishings(pushUpperFloor) { ... }
```

Called from `buildBuilding()` in `building.js`, after all second-floor walls/railings are built, passing the `pushUpperFloor` closure. Mirrors the pattern of `buildClassroomAssets()`.

`building.js` also re-exports `buildUpperFloorFurnishings` for external callers (same pattern as the other building/* submodules).

---

## West Wing — Grand Seminar Hall

One open space (25u × 80u) divided into three zones by rugs and furniture — no walls.

Screens mount on the **west outer wall** at x ≈ −29.5, rotation.y = Math.PI/2 (facing east).

### Zone 1 — The Atelier (north, z: −38 → −14)

**Purpose:** Theater-seminar. The dominant space with the largest screen.

- **Rug:** Dark navy (`#0f2044`), r = 9, at (−17.5, mezzY + 0.01, −26). Emissive ring border (r = 9.2, r_inner = 8.8) in `#1e40af`.
- **Circle table (large):** Radius 2.2, top at mezzY + 1.0, centered at (−17.5, mezzY, −26). Walnut wood (`#5c3317`), dark steel legs.
- **8 chairs** evenly spaced around the table (radius 3.0 from center). Each chair: seat box + low back panel + 4 legs, upholstered near-black (`#0f172a`) with a navy accent stripe.
- **3 bench rows** between the table and the east corridor wall, facing west toward the screen. Rows at x = −9, −11, −13, each bench 5u wide spanning z = −29 to z = −23. Two benches per row (one at z ≈ −27, one at z ≈ −23).
- **Lectern/podium** at (−26.5, mezzY, −26) — box 0.8 × 1.2 × 0.6, angled top face, walnut material. Between the screen and the circle table, facing east (toward the audience).
- **Screen (dominant):** Frame 9 × 5.5, inner screen 8.5 × 5.1. Mounted at x = −29.5, z = −26. Frame material: dark slate (`#0f172a`). Screen mat: emissive `#1e3a5f` (dark blue-grey). No room interaction — decorative only.
- **Accent strip:** Thin emissive bar (`#1e40af`) at floor level along the west wall between z = −38 and z = −14.

### Zone 2 — The Seminar (middle, z: −13 → +13)

**Purpose:** Discussion seminar. Two circle tables, symmetrically arranged.

- **Rug:** Warm burgundy (`#7a1a1a`), r = 7, at (−17.5, mezzY + 0.01, 0).
- **Two circle tables:** Radius 1.6, at z = −6 and z = +6, x = −17.5. Same walnut material.
- **6 chairs each** (radius 2.3 from table center), same chair design with a burgundy accent stripe.
- **2 corner plants:** Cylindrical planter (r = 0.5, h = 0.7) + 3 cone foliage layers, at (−28.5, mezzY, −11) and (−28.5, mezzY, +11).
- **Screen:** Standard 7 × 4 frame, 6.6 × 3.6 inner screen. At x = −29.5, z = 0. Emissive `#3b0a0a`.
- **Accent strip:** `#991b1b` floor strip along west wall.

### Zone 3 — The Roundtable (south, z: +14 → +38)

**Purpose:** Group roundtable / collaborative. Two tables clustered together.

- **Rug:** Forest green (`#14532d`), r = 7, at (−17.5, mezzY + 0.01, 26).
- **Two circle tables:** Radius 1.6, at z = 22 and z = 30, x = −17.5.
- **6 chairs each**, forest green accent stripe.
- **2 corner plants** at (−28.5, mezzY, 14) and (−28.5, mezzY, 38).
- **Screen:** 7 × 4 at x = −29.5, z = 26. Emissive `#052e16`.
- **Accent strip:** `#166534` floor strip along west wall.

---

## East Wing North — Executive Director's Office

Space: x +5 → +30, z −40 → −8. Center: (17.5, mezzY, −24).

**Vibe:** Dark, prestigious. Mahogany, brass, deep green.

- **Rug:** Deep forest green (`#052e16`), r = 8, at (17.5, mezzY + 0.01, −24). Brass-colored emissive border ring.
- **Round conference table:** Radius 2.2 at (13, mezzY, −24). Dark mahogany (`#3a1508`), brass leg ring base.
- **6 executive chairs** (radius 3.0): Taller back panel (h = 0.9), charcoal upholstery (`#1c1917`), brass leg detail.
- **Executive desk:** Box 4.5 × 0.12 × 2.0 (top) + 2 side pedestals, at (23.5, mezzY, −24). Mahogany. One high-back chair behind it (facing west).
- **2 bookshelf units** along north wall (z = −38.5): Each 3u wide × 2.8u tall × 0.4u deep, mahogany frame, with 4 rows of book-spine geometry (thin colored boxes, alternating muted colors).
- **2 corner plants** (large): Planters r = 0.6, at (7, mezzY, −38) and (28, mezzY, −38).
- **Screen (decorative):** Standard 7 × 4, mounted on east wall at x = 29.3, z = −24, rotation.y = −Math.PI/2. Dark emissive, brass frame.
- **Floor accent:** Dark border strip inset 0.5u inside the rug edge.

---

## East Wing South — Room 10 Seminar

Space: Room 10, centered at (17.5, 8). Existing screen at (29.3, 9.32, 8) — do not move it.

- **Rug:** Warm amber (`#78350f`), r = 7, at (17.5, mezzY + 0.01, 7). Amber emissive border.
- **Two circle tables:** Radius 1.6 at z = 2 and z = 14, x = 17.5.
- **6 chairs each**, amber accent stripe.
- **Podium:** At (27, mezzY, 8) — box geometry, facing west, toward screen. Same walnut material.
- **2 corner plants** at (7, mezzY, −5) and (7, mezzY, 21).
- **Emissive accent strip** along east wall matching Room 10 theme color (`#f59e0b`).

---

## Shared Geometry Helpers (defined once, used across zones)

```
createCircleTable(cx, cz, radius, tableMatColor, mezzY) → THREE.Group
createChair(cx, cz, angleRad, accentColor, mezzY) → THREE.Group
createPlant(cx, cz, mezzY) → THREE.Group
createDecorScreen(x, z, rotY, screenY, frameW, frameH, emissiveColor) → THREE.Group
createBookshelf(x, z, mezzY) → THREE.Group
```

All return a `THREE.Group`; the caller pushes each group to `pushUpperFloor`.

---

## Physics / Colliders

For each circle table, add one XZ AABB to `state.PLACED_ASSET_COLLIDERS`:
```js
{ minX: cx - r - 0.4, maxX: cx + r + 0.4, minZ: cz - r - 0.4, maxZ: cz + r + 0.4, assetId: 'upstairs-table' }
```

Executive desk adds one AABB covering its footprint.
Bookshelves add AABBs covering depth × width.
Chairs and plants: no colliders (player can walk between them).

---

## Fade System Integration

All meshes and groups created in `buildUpperFloorFurnishings` are passed to `pushUpperFloor()` so they participate in the existing fade-in/fade-out when the player ascends/descends.

`pushUpperFloor` accepts individual meshes or groups:
```js
const tableGroup = createCircleTable(...);
state.scene.add(tableGroup);
pushUpperFloor(tableGroup);
```

No calls to `registerStaticScenery` — upstairs items use the upper-floor fade system, not the distance-based scenery culling used for ground-floor and outdoor items.

---

## Out of Scope

- No new room IDs for west wing zones (screens are decorative, not interactive)
- No NPC placement in upstairs rooms (can be done later)
- No audio zones for upstairs
- No changes to corridor, elevator, railings, or structural walls
