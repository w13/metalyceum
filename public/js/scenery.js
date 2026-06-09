// Scenery, Procedural 3D Models, and Scene Management Barrel File
// Provides full backward compatibility for other modules importing scenery.js

// 9. Re-exports for backward compatibility (characters module)
export {
  createPlayerAvatar,
  spawnNpcs,
  updateNpcs,
} from './characters.js';
// 3. Shared Geometries, Sprites, and Boulders
export {
  createBoulder,
  createPanelLabelSprite,
  initSceneryAssets,
} from './scenery/assets.js';
// 4. Individual Foliage & Flowers
export {
  buildFrontApproachLandscaping,
  createFlowerCluster,
  createOrnamentalTree,
  createTrimmedBush,
} from './scenery/foliage.js';
// 5. Room Interiors
export { buildRoomInteriorSet } from './scenery/interiors.js';
// 8. Lazy-loaded venue loading (dynamic import for far landmarks)
export { initLazyVenueLoading } from './scenery/lazy-venues.js';

// 6. Plazas, Fountains, and indicators
export {
  buildExteriorPlaza,
  buildFrontFountain,
  createBannerStand,
  createRoomIndicator,
} from './scenery/plaza.js';
// 2. Low-level Terrain and Colliders
export {
  addSceneryCollider,
  createGroundedPatch,
  createGroundedRing,
  deformGroundGeometry,
  deformPlaneToTerrain,
  getTerrainCeiling,
} from './scenery/utils.js';
// 7. Outdoor Venues (Amphitheater, Concert Venue) & roads
export {
  buildAmphitheater,
  buildConcertVenue,
  buildOutdoorVenues,
} from './scenery/venues.js';
// 1. Visibility and Culling
export {
  disposeSprite,
  refreshStaticSceneryVisibility,
  registerStaticScenery,
} from './scenery/visibility.js';
// 8. Instanced World Details
export { buildWorldDetails } from './scenery/world-details.js';
