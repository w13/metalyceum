# Dev Tools for World Building — Design Spec
Date: 2026-06-01

## Problem

Building out Metalyceum's world has three pain points:
1. **Clipping/z-fighting** between placed assets and static landmark geometry is hard to find visually.
2. **Static geometry positioning** (castle, airport, etc.) requires edit-source → reload → navigate → check.
3. **Navigation** to distant landmarks is slow (manual double-click on 2D map).

## Solution: Option A — Targeted fix-the-pain tools

Three tools, all LLM-callable via `window.metalyceumDev`.

---

## Architecture

### New concept: `state.landmarkGroups`

A `Map<string, THREE.Group>` on the shared state. Each landmark scenery module wraps all its meshes in a root `THREE.Group`, adds the group to `state.scene`, and registers it:

```js
state.landmarkGroups.set('castle', group);
```

This is the single shared reference used by the auditor, lil-gui tweaks, and the global dev API.

### Files changed

| File | Change |
|------|--------|
| `public/js/state.js` | Add `landmarkGroups: new Map()` |
| `public/js/config.js` | Add `LANDMARK_REGISTRY` constant |
| `public/js/scenery/castle.js` | Wrap in group, register |
| `public/js/scenery/airport.js` | Wrap in group, register |
| `public/js/scenery/amphitheater.js` | Wrap in group, register |
| `public/js/scenery/concert-venue.js` | Wrap in group, register |
| `public/js/scenery/underground-city.js` | Wrap in group, register |
| `public/js/dev-tools.js` | Extended auditor, 3D helpers, 2D map teleport shortcuts, `window.metalyceumDev` |
| `public/js/debug-tweaks.js` | Landmarks lil-gui folder |

---

## Tool 1: Extended Auditor

`runWorldAudit()` in `dev-tools.js` extended to:
- Check placed asset footprints vs. each landmark's world-space bounding box (`group.getWorldPosition` + `approxRadius` from `LANDMARK_REGISTRY`)
- Check landmark bounding box vs. river channel (same 5-unit check used for rooms)
- Check landmark vs. room boundary overlap
- Landmark vs. landmark bounding box overlap

All issues surface in the existing auditor UI (2D map rings + 3D `Box3Helper` overlays).

The inline `zones` arrays in `dev-tools.js` are replaced by iterating `LANDMARK_REGISTRY`.

---

## Tool 2: Static Landmark Position/Rotation Tweaks

`debug-tweaks.js` adds a `Landmarks` lil-gui folder. For each entry in `LANDMARK_REGISTRY`:
- X/Y/Z offset sliders (`onChange` → `group.position.set(...)`)
- Y-rotation slider (`onChange` → `group.rotation.y = ...`)
- "Copy" button → `console.log(JSON.stringify({x, y, z, rotY}))` — machine-readable output

No reload required. Values are deltas from the group's origin (all mesh positions remain in world space; moving the group offsets everything).

---

## Tool 3: Teleport Shortcuts + Global Dev API

The 2D map panel gets a "Landmarks" section with one "Warp" button per landmark.

`window.metalyceumDev` is exposed from `dev-tools.js`:

```js
window.metalyceumDev = {
  teleport: (x, z) => devTeleport(x, z),
  teleportTo: (name) => devTeleport(LANDMARK_REGISTRY[name].approxCenter[0], LANDMARK_REGISTRY[name].approxCenter[1]),
  audit: () => { runWorldAudit(); return devState.auditIssues; },
  getAuditIssues: () => devState.auditIssues,
  setLandmark: (name, { x = 0, y = 0, z = 0, rotY = 0 }) => { /* moves group */ },
  getLandmark: (name) => { /* returns {x, y, z, rotY} from group */ },
  listLandmarks: () => Object.keys(LANDMARK_REGISTRY),
  toggleMap: (v) => toggleDevMap(v),
};
```

---

## Data: LANDMARK_REGISTRY

```js
export const LANDMARK_REGISTRY = {
  castle:          { label: 'Castle',           approxCenter: [130, -80],  approxRadius: 40 },
  airport:         { label: 'Airport',          approxCenter: [160, 220],  approxRadius: 50 },
  amphitheater:    { label: 'Amphitheater',     approxCenter: [65, 150],   approxRadius: 22 },
  concertVenue:    { label: 'Concert Venue',    approxCenter: [-85, 140],  approxRadius: 23 },
  undergroundCity: { label: 'Underground City', approxCenter: [120, 80],   approxRadius: 20 },
};
```

River and roads are excluded (linear paths, not groupable landmarks).
