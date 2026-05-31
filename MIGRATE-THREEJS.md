# Three.js ESM Migration Plan: r147 → r184

## Why upgrade?

| Benefit | r147 | r184 |
|---------|------|------|
| **WebGPU renderer** | Not available | `THREE.WebGPURenderer` — future-proof 3D |
| **BatchedMesh** | Not available | Native instanced batching (replaces our custom `createBatcher()`) |
| **Compressed textures** | Limited | `KTX2` / `Basis` — 75% less GPU memory |
| **Color management** | Legacy mode default | Proper `ColorManagement` enabled by default |
| **Performance** | — | Faster shadow maps, better draw-call merging |
| **ESM-native ecosystem** | UMD/IIFE (deprecated) | Full ESM — consistent with rest of codebase |
| **Bug fixes + security** | June 2023 | May 2026 — 3 years of patches |

## Current dependency landscape

### Script-tag loaded (global namespace)

| Library | How it's used | File count |
|---------|---------------|-----------|
| `THREE.*` (core) | `THREE.Scene`, `THREE.MeshStandardMaterial`, etc. | ~30 files |
| `THREE.OrbitControls` | `new THREE.OrbitControls(camera, domElement)` | `engine.js` |
| `THREE.TransformControls` | `new THREE.TransformControls(camera, domElement)` | `editor.js` |
| `window.GUI` (lil-gui) | `new GUI({ title })` | `debug-tweaks.js` |

### ESM dynamic imports (already on CDN — no changes needed)

| Library | Imported as |
|---------|------------|
| `@tonejs/midi` | `import('https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/+esm')` |
| `cannon-es` | `import('https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm')` |
| Three.js RGBELoader | `import('https://cdn.jsdelivr.net/npm/three@0.147.0/examples/jsm/loaders/RGBELoader.js')` |

## Migration steps

### Phase 1: Import map (10 minutes)

Replace the 4 `<script>` CDN tags in `public/index.html` with a single `<script type="importmap">`:

**Before:**
```html
<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/TransformControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/dist/lil-gui.umd.min.js"></script>
<script type="module" src="app.js?v=3"></script>
```

**After:**
```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/",
    "lil-gui": "https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/dist/lil-gui.umd.min.js"
  }
}
</script>
<script type="module" src="app.js?v=3"></script>
```

> **Note:** `lil-gui` is kept as UMD via import map (it works). If lil-gui ships a native ESM build in a future version, swap the URL to: `https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/+esm`

### Phase 2: Add imports to every file that uses `THREE.*` (30 min)

Every file that references the global `THREE` namespace needs this at the top:

```js
import * as THREE from 'three';
```

The following 30 files need this change:

```
public/js/audio.js
public/js/building.js
public/js/building/doors.js
public/js/building/interiors.js
public/js/building/roof.js
public/js/building/torches.js
public/js/characters.js
public/js/chat.js
public/js/debug-tweaks.js
public/js/editor.js
public/js/engine.js
public/js/engine/camera.js
public/js/engine/movement.js
public/js/environment.js
public/js/math.js
public/js/minimap.js (if it uses THREE)
public/js/physics.js (if it uses THREE)
public/js/room-panel/media.js
public/js/room-panel/player-list.js
public/js/scenery/assets.js
public/js/scenery/foliage.js
public/js/scenery/interiors.js
public/js/scenery/plaza.js
public/js/scenery/utils.js
public/js/scenery/venues.js
public/js/scenery/world-details.js
public/js/textures.js
public/js/theater.js
public/js/ui/debug-panel.js
```

### Phase 3: Replace global-class usage with named imports

**OrbitControls** — replace in `engine.js`:
```js
// Before: new THREE.OrbitControls(camera, domElement)
// After:
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
new OrbitControls(camera, domElement);
```

**TransformControls** — replace in `editor.js`:
```js
// Before: new THREE.TransformControls(camera, domElement)
// After:
import { TransformControls } from 'three/addons/controls/TransformControls.js';
new TransformControls(camera, domElement);
```

**lil-gui** — replace in `debug-tweaks.js`:
```js
// Before: global `GUI` from script tag → new GUI({...})
// After:
import GUI from 'lil-gui';
new GUI({ title: '...' });
```

### Phase 4: Update dynamic import URLs

In `public/js/environment.js`, update the RGBELoader URL:

```js
// Before:
const RGBE_LOADER_URL = 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/jsm/loaders/RGBELoader.js';

// After:
const RGBE_LOADER_URL = '/three/addons/loaders/RGBELoader.js';
```

This works because the import map resolves `three/addons/` to the CDN URL.

### Phase 5: Fix deprecated API usage (if any)

Search for these r128→r184 removals and replace:

| Old API (r128) | Replaced by (r184) | Check our codebase |
|----------------|-------------------|-------------------|
| `renderer.outputEncoding = THREE.sRGBEncoding` | `renderer.outputColorSpace = THREE.SRGBColorSpace` | Already absent ✓ |
| `THREE.Geometry` (non-BufferGeometry) | `THREE.BufferGeometry` | Already using BufferGeometry ✓ |
| `THREE.Face3` | Manual triangle arrays | Already absent ✓ |
| `geometry.computeVertexNormals()` | Still works (deprecated, use `BufferAttribute` directly) | Used in building.js, assets.js → keep |
| `THREE.PlaneBufferGeometry` (removed r125) | `THREE.PlaneGeometry` | Already using PlaneGeometry ✓ |

> After the ESM import is added at the top of each file, the `THREE.*` references inside the file continue to work exactly as before — you're just importing the module instead of reading a global.

## Rollback plan

1. Revert the import map change in `index.html`
2. Revert the `import * as THREE from 'three'` line in each file
3. Restore the 4 `<script>` CDN tags

The migration can be done incrementally — files without the explicit import will error at load time, making it easy to track which ones are missing.

## Verification

1. `npm run dev` — no console errors on load
2. Walk through all rooms — scene renders correctly
3. Test OrbitControls (click + drag)
4. Open Editor → test TransformControls
5. Open Debug panel → lil-gui works
6. Check the amphitheater and concert venue render
7. Test HDRI environment map loads
8. Test MIDI audio playback
9. Test physics engine (cannon-es)
