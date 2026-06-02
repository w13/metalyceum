# Three.js ESM Migration: r128 to r184 - COMPLETE

The migration from CDN script tags to ESM import maps is done. See the diff in `public/index.html` for the import map configuration and individual files for `import * as THREE from 'three'` additions.

Current browser runtime: `three@0.184.0` and `lil-gui@0.21.0` are loaded from the import map in `public/index.html`. The npm `three@0.128.x` packages are retained for existing tests/shims and are not the browser runtime source.

## Summary

| Library | Before | After |
|---------|--------|-------|
| Three.js | 0.128.0 (script tag, global THREE.*) | 0.184.0 (import map, ESM) |
| lil-gui | 0.19.2 (script tag, global GUI) | 0.21.0 (import map, ESM) |
| @tonejs/midi | 2.0.28 (dynamic ESM import) | Unchanged (already latest) |
| cannon-es | 0.20.0 (dynamic ESM import) | Unchanged (already latest) |

## Files changed

- `public/index.html` - 4 script tags replaced with import map
- `public/js/environment.js` - RGBELoader URL switched to import-map path
- 28 JS files across `public/js/` - added `import * as THREE from 'three'`
- `public/js/engine.js` - OrbitControls named import
- `public/js/editor.js` - TransformControls named import
- `public/js/debug-tweaks.js` - GUI named import, removed typeof guard
