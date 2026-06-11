import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  registerStaticScenery,
  refreshStaticSceneryVisibility,
} from '../../public/js/scenery/visibility.js';
import { state } from '../../public/js/state.js';

describe('static scenery culling centers', () => {
  beforeEach(() => {
    state.STATIC_SCENERY.length = 0;
    state.camera = new THREE.PerspectiveCamera();
    state.localPlayer = { currentRoom: -1 } as any;
  });

  it('culls by explicit center, not the group origin', () => {
    const group = new THREE.Group(); // stays at (0,0,0) — placement baked in vertices
    registerStaticScenery(group, {
      kind: 'outdoor',
      distance: 100,
      center: { x: 500, z: 500 },
    });

    state.camera.position.set(0, 2, 0); // far from center, near origin
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(false);

    state.camera.position.set(490, 2, 500); // near center
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(true);
  });

  it('falls back to the group position when no center is given', () => {
    const group = new THREE.Group();
    group.position.set(200, 0, 0);
    registerStaticScenery(group, { kind: 'outdoor', distance: 50 });

    state.camera.position.set(0, 2, 0); // 200u away
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(false);

    state.camera.position.set(180, 2, 0); // 20u away
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(true);
  });

  it('toggles room-kind scenery by current room, ignoring distance', () => {
    const group = new THREE.Group();
    registerStaticScenery(group, { kind: 'room', roomId: 3 });

    state.localPlayer.currentRoom = 3;
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(true);

    state.localPlayer.currentRoom = 5;
    refreshStaticSceneryVisibility();
    expect(group.visible).toBe(false);
  });
});
