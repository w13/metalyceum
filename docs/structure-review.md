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
- **Coordinator/barrel pattern**: `engine.js` re-exports from `engine/`, `scenery.js` re-exports from `scenery/`, etc. — callers always import from the top-level module, never from subdirectories. This makes refactoring subdirectory internals safe.
- **Single shared state**: `state.js` is the one mutable store imported everywhere, avoiding prop-drilling or store-passing
- **Landmarks independently files**: Each landmark (castle, airport, etc.) has its own file, keeping the large outdoor scene manageable
- **Fade system as a separate module**: The zone-based opacity system was extracted early rather than being embedded in the render loop, enabling reuse across building, castle, concert venue, airport, and underground city
- **Performance budgets enforced in tests**: The browser test asserts draw calls, geometry count, texture count, and triangles, preventing regressions

## Items to Address (Low to Medium Priority)

### 1. Empty `building/upstairs.js` — skeleton with no implementation
`public/js/building/upstairs.js` exports `buildUpperFloorFurnishings()`, which is imported and called from `building.js`, but the function body does nothing (only declares two unused local variables). This is a placeholder for future second-floor furniture but introduces a no-op code path. Either populate it or remove the call and mark the file with a clear `@TODO` comment.

### 2. `building/interiors.js` vs `scenery/interiors.js` — name collision
Both files exist:
- `public/js/building/interiors.js` — classroom furniture (desks, chairs)
- `public/js/scenery/interiors.js` — room interior sets (rugs, benches, podiums)

These serve different domains but their identical names are confusing when searching. Consider renaming `building/interiors.js` to `building/classroom.js` since it only exports `buildClassroomAssets()`.

### 3. `scenery/venues.js` — thin coordinator could be merged
`venues.js` is a 22-line file that just calls `buildAmphitheater()` + `buildConcertVenue()` + `buildAirport()` + `buildCaveAndUndergroundCity()` + `buildRiver()` + `buildCastle()` + `buildRoads()`. This coordinator logic could live in `scenery.js` directly, removing the extra file. However, keeping it separate is also fine for the barrel pattern — it's a judgment call.

### 4. `src/durable_object.ts` has no unit tests
The most complex module (WebSocket dispatch, SQLite, session management) lacks unit tests. The existing worker tests (`src/index.test.ts`) only test the HTTP routing layer. Adding tests for message handlers (`handleJoin`, `handleMove`, `handleChat`, `handleAssetCrud`) would significantly improve confidence.

### 5. Root directory has some stale files
- `git_boulder.txt` was 1466 lines and has been moved to `docs/`
- `metalyceum-*.png` stale screenshots cleaned
- `.dev.vars.example` and `.env` remain — `.env` is gitignored so it's local state, but `.dev.vars.example` is a useful template

### 6. No lint or format scripts
There are no ESLint, Prettier, or Biome scripts in `package.json`. While the code is consistently formatted (appears to use 2-space indentation), adding a linter would catch unused imports and potential bugs automatically.

### 7. `animations.js` and `room-animation.js` — overlapping names
`public/js/animations.js` contains swimming animation; `public/js/room-animation.js` contains fountain/indicator animation. The names suggest they could be merged into a single `animations/` directory, but since they're small and independent this is cosmetic.

### 8. Test file distribution
Unit tests are colocated with source in `src/` (good), but there's no `__tests__` directory or consistent naming convention for the client tests — they live in `test/client/`. This is fine for this scale but would benefit from a convention as the project grows.

## Summary

The project structure is well-architected for its current scale (~12K lines server + ~50K lines client). The coordinator/barrel pattern and the clear server module boundaries are the right choices. The items above are minor refinements rather than structural problems — the architecture does not need a reorganization.
