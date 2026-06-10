// Visibility and Culling Manager for Scenery

import * as THREE from 'three';
import {
  OUTDOOR_SCENERY_VISIBILITY_DISTANCE,
  ROOM_SCENERY_VISIBILITY_DISTANCE,
} from '../config.js';
import { state } from '../state.js';

export function registerStaticScenery(object3d, options = {}) {
  const dist =
    options.distance ||
    (options.kind === 'room'
      ? ROOM_SCENERY_VISIBILITY_DISTANCE
      : OUTDOOR_SCENERY_VISIBILITY_DISTANCE);
  // Venue root groups often sit at origin with placement baked into child
  // vertices — pass options.center {x, z} so culling measures the real spot.
  const center = options.center
    ? new THREE.Vector3(options.center.x, 0, options.center.z)
    : null;
  state.STATIC_SCENERY.push({
    object3d,
    kind: options.kind || 'outdoor',
    roomId: options.roomId ?? null,
    distance: dist,
    distanceSquared: dist * dist,
    center,
  });
  return object3d;
}

export function disposeSprite(sprite) {
  if (!sprite) return;
  if (sprite.material?.map) sprite.material.map.dispose();
  if (sprite.material) sprite.material.dispose();
}

export function refreshStaticSceneryVisibility() {
  const currentRoom = state.localPlayer.currentRoom;
  state.STATIC_SCENERY.forEach((entry) => {
    if (!entry.object3d) return;
    if (entry.kind === 'room') {
      entry.object3d.visible = currentRoom === entry.roomId;
      return;
    }

    if (!state.camera) return;
    const target = entry.center ?? entry.object3d.position;
    const distanceSq = state.camera.position.distanceToSquared(target);
    entry.object3d.visible = distanceSq <= entry.distanceSquared;
  });
}
