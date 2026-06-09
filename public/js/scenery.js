// Scenery, Procedural 3D Models, and Scene Management Barrel File
// Provides full backward compatibility for other modules importing scenery.js

// 1. Visibility and Culling
export {
  registerStaticScenery,
  refreshStaticSceneryVisibility,
  disposeSprite
} from './scenery/visibility.js';

// 2. Low-level Terrain and Colliders
export {
  deformPlaneToTerrain,
  deformGroundGeometry,
  getTerrainCeiling,
  createGroundedPatch,
  createGroundedRing,
  addSceneryCollider
} from './scenery/utils.js';

// 3. Shared Geometries, Sprites, and Boulders
export {
  initSceneryAssets,
  createPanelLabelSprite,
  createBoulder
} from './scenery/assets.js';

// 4. Individual Foliage & Flowers
export {
  createTrimmedBush,
  createOrnamentalTree,
  createFlowerCluster,
  buildFrontApproachLandscaping
} from './scenery/foliage.js';

// 5. Room Interiors
export {
  buildRoomInteriorSet
} from './scenery/interiors.js';

// 6. Plazas, Fountains, and indicators
export {
  createBannerStand,
  createRoomIndicator,
  buildExteriorPlaza,
  buildFrontFountain
} from './scenery/plaza.js';

// 7. Outdoor Venues (Amphitheater, Concert Venue) & roads
export {
  buildOutdoorVenues,
  buildAmphitheater,
  buildConcertVenue
} from './scenery/venues.js';

// 8. Instanced World Details
export {
  buildWorldDetails
} from './scenery/world-details.js';

// 9. Re-exports for backward compatibility (characters module)
export {
  createPlayerAvatar,
  spawnNpcs,
  updateNpcs
} from './characters.js';

// 8. Lazy-loaded venue loading (dynamic import for far landmarks)
export { initLazyVenueLoading } from './scenery/lazy-venues.js';
