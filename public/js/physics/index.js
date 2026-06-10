// Physics barrel — consolidates physics.js and physics-engine.js under one namespace.
// New code can import from './physics' instead of './physics.js' + './physics-engine.js'.
// Old imports continue to work (original files remain in place).
export { getTerrainHeight, checkCollision, isLocalPlayerUnderRoof,
         getRoomIdForPosition, getRoomBounds, getWaterSurfaceHeight, isPointWithinBounds,
         getRiverDistance } from '../physics.js';
export { initCannon, teleportPlayer, isCannonReady, getPlayerBodyRef, stepCannon,
         syncBodyY, rebuildAssetColliders, updateElevatorDoorCollider, resetCannon } from '../physics-engine.js';
