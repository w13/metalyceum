// Wall torch geometry and light sources for Metalyceum room interiors
import * as THREE from 'three';
import { initSceneryAssets } from '../scenery/assets.js';
import { registerStaticScenery } from '../scenery/visibility.js';
import { state } from '../state.js';

export function createWallTorch(
  x,
  y,
  z,
  rotationY,
  roomId = null,
  withLight = true,
) {
  initSceneryAssets();
  const torchGroup = new THREE.Group();

  const bracket = new THREE.Mesh(
    state.sharedScenery.torchBracketGeo,
    state.sharedScenery.torchMetalMat,
  );
  bracket.position.set(0, 0, -0.15);
  torchGroup.add(bracket);

  const stick = new THREE.Mesh(
    state.sharedScenery.torchStickGeo,
    state.sharedScenery.torchWoodMat,
  );
  stick.position.set(0, 0.1, -0.05);
  torchGroup.add(stick);

  const flame = new THREE.Mesh(
    state.sharedScenery.torchFlameGeo,
    state.sharedScenery.torchFlameMat,
  );
  flame.position.set(0, 0.55, 0.1);
  torchGroup.add(flame);

  const particle = new THREE.Mesh(
    state.sharedScenery.torchParticleGeo,
    state.sharedScenery.torchParticleMat,
  );
  particle.position.set(0, 0.65, 0.1);
  torchGroup.add(particle);

  let light = null;
  if (withLight) {
    light = new THREE.PointLight('#f97316', 1.1, 11);
    light.position.set(0, 0.7, 0.15);
    light.castShadow = false;
    torchGroup.add(light);
  }

  torchGroup.position.set(x, y, z);
  torchGroup.rotation.y = rotationY;

  if (roomId !== null) {
    registerStaticScenery(torchGroup, { kind: 'room', roomId });
  }
  state.scene.add(torchGroup);
  state.torches.push({
    light,
    flame,
    baseIntensity: light ? light.intensity : 0,
    seed: Math.random() * 100,
    worldPos: new THREE.Vector3(x, y, z),
  });
  return torchGroup;
}
