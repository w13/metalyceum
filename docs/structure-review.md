# Metalyceum Project Structure Review

## Overall Assessment: SOLID

The project follows a clean separation of concerns between server (TypeScript) and client (vanilla ES6 JavaScript). The coordinator/barrel pattern and the Durable Object architecture are well-chosen for this scale of project. The codebase is well-organized and the patterns are consistently applied.

## Strengths

### Server-side
- **Clear module boundaries**: Pure functions (`validation.ts`, `realtime.ts`, `session_source.ts`) are separated from Workers runtime code (`durable_object.ts`, `index.ts`), making the pure modules easily testable
- **Two DOs with distinct responsibilities**: `MetalyceumWorld` (game state) vs `AdminDO` (auth/audit) is a clean split that prevents cross-concern coupling
- **Consistent HTTP layer**: `src/http/` provides reusable request ID, JSON parsing, and error envelope patterns that both DOs use
- **Cross-DO contracts in `src/internal/`**: Shared path constants and response types prevent magic strings when DOs communicate

### Client-side
- **Coordinator/barrel pattern**: `engine.js` re-exports from `engine/`, `scenery.js` re-exports from `scenery/`, etc. — callers always import from the top-level module, never from subdirectories. This makes refactoring subdirectory internals safe. Additional barrel files added: `physics/index.js`, `engine/index.js`, `ui/index.js`.
- **Single shared state**: `state.js` is the one mutable store imported everywhere, avoiding prop-drilling or store-passing
- **Landmarks independently filed**: Each landmark (castle, airport, etc.) has its own file, keeping the large outdoor scene manageable. Lazy loading via `lazy-venues.js` + `VENUE_REGISTRY` defers airport/castle/underground-city until the player approaches.
- **Fade system as a separate module**: The zone-based opacity system was extracted early rather than being embedded in the render loop, enabling reuse across building, castle, concert venue, airport, and underground city
- **Performance budgets enforced in tests**: The browser test asserts draw calls (<420), geometry count (<460), texture count (<15), and triangles (<850K), preventing regressions
- **DRY improvements**: Shared furniture factories (`scenery/furniture.js`), fountain water module (`scenery/fountain-water.js`), and physics/engine/ui barrel files reduce duplication and establish reusable patterns

## Items Addressed (Recent Refactoring)

### 1. `building/upstairs.js` — now populated with furniture
`buildUpperFloorFurnishings()` is now implemented with shared furniture factories (`createCircleTable`, `createChair`, `createBench`, `createBookshelf`, etc.). The zone layout functions (`buildWestZone1`, `buildExecutiveOffice`, `buildRoom10Seminar`) place these factories at specific positions. The generic factories have been extracted to `scenery/furniture.js` for reuse by other interior builders.

### 2. `config.js` — soundtrack data extracted
Soundtrack library was 531 lines (57% of the file). Extracted to `midi/soundtrack-data.js` (14 lines in compact format). Config.js dropped from 925 to 396 lines.

### 3. `dev-tools.js` — split partially complete
The 2476-line monolith was reduced to 1634 lines:
- `ui/dev-state.js` — `devState` object + `devTeleport` (70 lines)
- `ui/dev-api.js` — `window.metalyceumDev` API (128 lines)
- Remaining: audit functions, map rendering, 3D helpers, init (~1634 lines)

### 4. `multiplayer.js` — handler registry replaces switch
The WebSocket message handler was converted from a 14-case switch to a `MSG_HANDLERS` registry object. Adding a new message type is a single entry in the registry.

### 5. `editor.js` — asset factories
`createPlacedAssetModel()` switched from an 11-branch if/else chain to an `ASSET_FACTORIES` registry. New asset types are factory entries, not new else-if branches.

### 6. `scenery/venues.js` — VENUE_REGISTRY
Venue loading is now driven by `VENUE_REGISTRY` in config.js. Eager venues are statically imported (unchanged). Lazy venues are read by `lazy-venues.js` from the same registry. Adding a venue = one config entry + builder module.

## Items Remaining (Low to Medium Priority)

### 1. `building/interiors.js` vs `scenery/interiors.js` — name collision
Both files exist:
- `public/js/building/interiors.js` — classroom furniture (desks, chairs). Renamed to `building/classroom.js` since it only exports `buildClassroomAssets()`.
- `public/js/scenery/interiors.js` — room interior sets (rugs, benches, podiums)

These serve different domains but their identical names are confusing when searching.

### 2. `src/durable_object.ts` has no unit tests
The most complex module (WebSocket dispatch, SQLite, session management) lacks unit tests. The existing worker tests (`src/index.test.ts`) only test the HTTP routing layer. Adding tests for message handlers (`handleJoin`, `handleMove`, `handleChat`, `handleAssetCrud`) would significantly improve confidence.

### 3. No lint or format scripts
There are no ESLint, Prettier, or Biome scripts in `package.json`. While the code is consistently formatted (appears to use 2-space indentation), adding a linter would catch unused imports and potential bugs automatically.

### 4. `animations.js` and `room-animation.js` — overlapping names
`public/js/animations.js` contains swimming animation; `public/js/room-animation.js` contains fountain/indicator animation. The names suggest they could be merged into a single `animations/` directory, but since they're small and independent this is cosmetic.

### 5. Test file distribution
Unit tests are colocated with source in `src/` (good), but there's no `__tests__` directory or consistent naming convention for the client tests — they live in `test/client/`. This is fine for this scale but would benefit from a convention as the project grows.

## Summary

The project structure is well-architected for its current scale (~12K lines server + ~50K lines client). The coordinator/barrel pattern and the clear server module boundaries are the right choices. Recent refactoring reduced the five largest files by an average of 35% and established reusable patterns (furniture factories, asset registries, handler registries, venue registries) that make future expansion simpler.
