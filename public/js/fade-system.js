import * as THREE from 'three';
import { state } from './state.js';

function flattenObjects(objects) {
  const flat = [];
  for (const object of objects) {
    if (!object) continue;
    if (Array.isArray(object)) flat.push(...flattenObjects(object));
    else flat.push(object);
  }
  return flat;
}

function usesSharedMaterial(object3d, sharedMaterial) {
  if (!object3d?.material || !sharedMaterial) return false;
  if (Array.isArray(object3d.material)) return object3d.material.includes(sharedMaterial);
  return object3d.material === sharedMaterial;
}

function fadeObject3D(node, target, dt) {
  if (!node || !node.isObject3D) return false;

  let converging = false;
  const materials = node.material
    ? (Array.isArray(node.material) ? node.material : [node.material])
    : [];

  if (materials.length > 0) {
    let visible = false;
    for (const material of materials) {
      if (!material) continue;
      if (material.transparent) {
        const prevOpacity = material.opacity;
        const newOpacity = THREE.MathUtils.lerp(prevOpacity, target, 8 * dt);
        if (Math.abs(newOpacity - prevOpacity) > 0.0005) {
          material.opacity = newOpacity;
          material.needsUpdate = true;
          converging = true;
        }
        visible = visible || material.opacity > 0.02;
      } else {
        visible = visible || target > 0.5;
      }
    }
    node.visible = visible;
  } else {
    node.visible = target > 0.02;
  }

  for (let i = 0; i < node.children.length; i++) {
    converging = fadeObject3D(node.children[i], target, dt) || converging;
  }

  return converging;
}

function fadeLayer(layer, target, dt) {
  let converging = false;
  let sharedVisible = target > 0.02;

  if (layer.sharedMaterial) {
    const prevOpacity = layer.sharedMaterial.opacity;
    const newOpacity = THREE.MathUtils.lerp(prevOpacity, target, 8 * dt);
    if (Math.abs(newOpacity - prevOpacity) > 0.0005) {
      layer.sharedMaterial.opacity = newOpacity;
      layer.sharedMaterial.needsUpdate = true;
      converging = true;
    }
    sharedVisible = layer.sharedMaterial.opacity > 0.02;
  }

  for (let i = 0; i < layer.objects.length; i++) {
    const object3d = layer.objects[i];
    if (!object3d?.isObject3D) continue;
    if (layer.sharedMaterial && usesSharedMaterial(object3d, layer.sharedMaterial)) {
      object3d.visible = sharedVisible;
      continue;
    }
    converging = fadeObject3D(object3d, target, dt) || converging;
  }

  return converging;
}

export function resetFadeZones() {
  state.fadeZones = [];
}

export function createFadeLayer({ id, getTargetOpacity, sharedMaterial = null, objects = [] }) {
  return {
    id,
    getTargetOpacity,
    sharedMaterial,
    objects: flattenObjects(objects),
    _target: NaN,
    _active: false
  };
}

export function registerFadeZone({ id, proximity, containsPlayer, layers = [] }) {
  const zone = { id, proximity, containsPlayer, layers };
  const existingIndex = state.fadeZones.findIndex((entry) => entry.id === id);
  if (existingIndex === -1) state.fadeZones.push(zone);
  else state.fadeZones[existingIndex] = zone;
  return zone;
}

export function addFadeObjects(layer, ...objects) {
  const flat = flattenObjects(objects);
  layer.objects.push(...flat);
  return flat.length === 1 ? flat[0] : flat;
}

export function makeFadeMaterial(material, { clone = false, opacity = 1 } = {}) {
  const fadeMaterial = clone ? material.clone() : material;
  fadeMaterial.transparent = true;
  fadeMaterial.opacity = opacity;
  return fadeMaterial;
}

export function makeObjectFadeable(object3d, { cloneMaterials = true, opacity = 1 } = {}) {
  if (!object3d?.isObject3D) return object3d;
  object3d.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => makeFadeMaterial(material, { clone: cloneMaterials, opacity }));
      return;
    }
    child.material = makeFadeMaterial(child.material, { clone: cloneMaterials, opacity });
  });
  return object3d;
}

export function createBoundsFadePredicate({ minX, maxX, minZ, maxZ, minY = -Infinity, maxY = Infinity }) {
  return (player) => (
    player.x >= minX && player.x <= maxX &&
    player.z >= minZ && player.z <= maxZ &&
    player.y >= minY && player.y <= maxY
  );
}

export function createCircleFadePredicate({ x, z, radius, minY = -Infinity, maxY = Infinity }) {
  const radiusSq = radius * radius;
  return (player) => {
    const dx = player.x - x;
    const dz = player.z - z;
    return dx * dx + dz * dz <= radiusSq && player.y >= minY && player.y <= maxY;
  };
}

export function createInsideOutsideTarget({ getProgress = null, insideOpacity = 0, outsideOpacity = 1 }) {
  return ({ inside }) => {
    const progress = typeof getProgress === 'function' ? getProgress() : 0;
    if (progress > 0) return progress;
    return inside ? insideOpacity : outsideOpacity;
  };
}

export function createPlayerYTarget({ minY = -Infinity, maxY = Infinity, insideOpacity = 1, outsideOpacity = 0, getProgress = null }) {
  return ({ player }) => {
    const progress = typeof getProgress === 'function' ? getProgress() : 0;
    if (progress > 0) return progress;
    return player.y >= minY && player.y < maxY ? insideOpacity : outsideOpacity;
  };
}

export function createInsidePlayerYTarget({
  minY = -Infinity,
  maxY = Infinity,
  insideOpacity = 1,
  belowInsideOpacity = 0,
  outsideOpacity = 1,
  getProgress = null
}) {
  return ({ inside, player }) => {
    const progress = typeof getProgress === 'function' ? getProgress() : 0;
    if (progress > 0) return progress;
    if (!inside) return outsideOpacity;
    return player.y >= minY && player.y < maxY ? insideOpacity : belowInsideOpacity;
  };
}

/**
 * Creates a complete multi-floor fade zone for a building and returns push helpers.
 *
 * Layers created:
 *   roof        — invisible from inside, visible from outside
 *   upper-walls — shared-material wall fade; visible above upperLevelThresholdY
 *   upper-floor — arbitrary objects visible above upperLevelThresholdY
 *   ground-floor— arbitrary objects visible below upperLevelThresholdY
 *
 * @param {object} opts
 * @param {string}   opts.id                    — unique fade-zone id (e.g. 'main-building')
 * @param {object}   opts.proximity             — { x, z, r } — only update when player is within r
 * @param {object}   opts.bounds                — { minX, maxX, minZ, maxZ } passed to createBoundsFadePredicate
 * @param {number}   opts.upperLevelThresholdY  — Y cutoff separating ground floor from upper floor
 * @param {object}  [opts.upperWallMat]         — pre-created fadeable material for shared wall fading
 * @param {Function}[opts.getRideProgress]      — () => 0..1; when > 0 overrides opacity for roof/upper layers
 * @returns {{ pushRoof, pushUpperWall, pushUpperFloor, pushGroundFloor, consumeGroundFloorItems }}
 */
export function createBuildingFadeZone({
  id,
  proximity,
  bounds,
  upperLevelThresholdY,
  upperWallMat = null,
  upperWallsOutsideOpacity = 1,
  upperFloorOutsideOpacity = 0,
  getRideProgress = null
}) {
  const roofLayer = createFadeLayer({
    id: `${id}:roof`,
    getTargetOpacity: createInsideOutsideTarget({ insideOpacity: 0, outsideOpacity: 1, getProgress: getRideProgress })
  });
  const upperWallsLayer = createFadeLayer({
    id: `${id}:upper-walls`,
    sharedMaterial: upperWallMat,
    getTargetOpacity: createInsidePlayerYTarget({
      minY: upperLevelThresholdY,
      insideOpacity: 1, belowInsideOpacity: 0, outsideOpacity: upperWallsOutsideOpacity,
      getProgress: getRideProgress
    })
  });
  const upperFloorLayer = createFadeLayer({
    id: `${id}:upper-floor`,
    getTargetOpacity: createInsidePlayerYTarget({
      minY: upperLevelThresholdY,
      insideOpacity: 1, belowInsideOpacity: 0, outsideOpacity: upperFloorOutsideOpacity,
      getProgress: getRideProgress
    })
  });
  const groundFloorLayer = createFadeLayer({
    id: `${id}:ground-floor`,
    getTargetOpacity: createInsidePlayerYTarget({
      minY: upperLevelThresholdY,
      insideOpacity: 0, belowInsideOpacity: 1, outsideOpacity: 1
    })
  });

  registerFadeZone({
    id,
    proximity,
    containsPlayer: createBoundsFadePredicate(bounds),
    layers: [roofLayer, upperWallsLayer, upperFloorLayer, groundFloorLayer]
  });

  const flatFilter = (objects) => objects.flat().filter(Boolean);

  return {
    pushRoof(...objects) {
      const flat = flatFilter(objects).map(o => makeObjectFadeable(o));
      state.roofMeshes.push(...flat);
      addFadeObjects(roofLayer, ...flat);
      return flat.length === 1 ? flat[0] : flat;
    },
    pushUpperWall(...objects) {
      const flat = flatFilter(objects);
      state.upperWalls.push(...flat);
      addFadeObjects(upperWallsLayer, ...flat);
      return flat.length === 1 ? flat[0] : flat;
    },
    pushUpperFloor(...objects) {
      const flat = flatFilter(objects);
      addFadeObjects(upperFloorLayer, ...flat);
      return flat.length === 1 ? flat[0] : flat;
    },
    pushGroundFloor(...objects) {
      const flat = flatFilter(objects);
      addFadeObjects(groundFloorLayer, ...flat);
      return flat.length === 1 ? flat[0] : flat;
    },
    consumeGroundFloorItems() {
      if (state.groundFloorItems) {
        for (const item of state.groundFloorItems) addFadeObjects(groundFloorLayer, item);
      }
    }
  };
}

export function updateFadeZones(dt) {
  const player = state.localPlayer;

  for (let i = 0; i < state.fadeZones.length; i++) {
    const zone = state.fadeZones[i];
    if (zone.proximity) {
      const dx = player.x - zone.proximity.x;
      const dz = player.z - zone.proximity.z;
      if (dx * dx + dz * dz > zone.proximity.r * zone.proximity.r) continue;
    }

    const inside = zone.containsPlayer ? zone.containsPlayer(player, state) : false;
    for (let j = 0; j < zone.layers.length; j++) {
      const layer = zone.layers[j];
      const nextTarget = THREE.MathUtils.clamp(layer.getTargetOpacity({ inside, player, state, zone }), 0, 1);
      if (nextTarget !== layer._target) {
        layer._target = nextTarget;
        layer._active = true;
      }
      if (layer._active) layer._active = fadeLayer(layer, nextTarget, dt);
    }
  }
}
