import * as THREE from 'three';
import { WORLD_CONFIG } from '../config.js';
import { makeFadeMaterial } from '../fade-system.js';
import {
  createBrickTexture,
  createDarkWoodTexture,
  createStoneTexture,
  createWoodTexture,
} from '../textures.js';

export function createMainBuildingMaterials(sharedScenery) {
  const stoneTex = createStoneTexture();
  const brickTex = createBrickTexture();
  const woodTex = createWoodTexture();
  const darkWoodTex = createDarkWoodTexture();

  const wallMat = new THREE.MeshStandardMaterial({
    map: brickTex,
    roughness: 0.85,
  });
  const upperWallMat = makeFadeMaterial(
    new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 }),
  );
  // Shared baseboard material — one instance used by all wall segments
  const sharedBaseboardMat = new THREE.MeshStandardMaterial({
    color: '#2d1e18',
    roughness: 0.9,
  });

  const limestoneMat = sharedScenery.limestoneMat;
  const limestoneShadowMat = new THREE.MeshStandardMaterial({
    color: '#cabfaa',
    roughness: 0.8,
  });
  const bronzeMat = sharedScenery.bronzeMat;
  const slateGlassMat = new THREE.MeshStandardMaterial({
    color: '#162235',
    roughness: 0.18,
    metalness: 0.08,
    transparent: true,
    opacity: 0.96,
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: WORLD_CONFIG.exteriorAccent,
    roughness: 0.65,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const woodFloorMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.35,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const darkWoodFloorMat = new THREE.MeshStandardMaterial({
    map: darkWoodTex,
    roughness: 0.35,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const stoneFloorMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const frameMat = sharedScenery.frameMat;
  const screenMat = sharedScenery.screenMat;

  return {
    stoneTex,
    brickTex,
    woodTex,
    darkWoodTex,
    wallMat,
    upperWallMat,
    sharedBaseboardMat,
    limestoneMat,
    limestoneShadowMat,
    bronzeMat,
    slateGlassMat,
    bannerMat,
    woodFloorMat,
    darkWoodFloorMat,
    stoneFloorMat,
    frameMat,
    screenMat,
  };
}
