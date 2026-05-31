// Individual foliage models, flower beds, and landscaping
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { registerStaticScenery } from './visibility.js';
import { initSceneryAssets } from './assets.js';
import { createGroundedPatch, createGroundedRing, getTerrainCeiling, addSceneryCollider } from './utils.js';

export function createTrimmedBush(x, z, {
  scale = 1,
  bodyColor = '#166534',
  tuftColor = '#14532d',
  registerCollider = false,
  assetId = 'plaza-bush'
} = {}) {
  const bushGroup = new THREE.Group();
  const containerMat = new THREE.MeshStandardMaterial({ color: '#6b4f3b', roughness: 0.78 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.82 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8, flatShading: true });
  const tuftMat = new THREE.MeshStandardMaterial({ color: tuftColor, roughness: 0.82, flatShading: true });

  // Planter pot
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 0.35, 8),
    containerMat
  );
  pot.position.y = 0.17;
  pot.castShadow = true;
  bushGroup.add(pot);

  // Pot rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.04, 5, 10),
    rimMat
  );
  rim.position.y = 0.35;
  rim.rotation.x = Math.PI / 2;
  bushGroup.add(rim);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.56, 7, 7), bodyMat);
  body.position.y = 0.34;
  body.scale.set(1.15, 0.7, 1);
  body.castShadow = true;
  bushGroup.add(body);

  const leftTuft = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 6), tuftMat);
  leftTuft.position.set(-0.28, 0.54, 0.04);
  leftTuft.scale.y = 0.75;
  bushGroup.add(leftTuft);

  const rightTuft = leftTuft.clone();
  rightTuft.position.x = 0.28;
  bushGroup.add(rightTuft);

  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), tuftMat);
  crown.position.set(0, 0.68, -0.1);
  crown.scale.y = 0.72;
  bushGroup.add(crown);

  bushGroup.position.set(x, getTerrainHeight(x, z), z);
  bushGroup.scale.setScalar(scale);
  registerStaticScenery(bushGroup, { kind: 'outdoor', distance: 90 });
  state.scene.add(bushGroup);

  if (registerCollider) {
    const footprint = 0.52 * scale;
    addSceneryCollider(x - footprint, x + footprint, z - footprint, z + footprint, assetId);
  }
}

export function createOrnamentalTree(x, z, {
  scale = 0.9,
  assetId = 'plaza-tree'
} = {}) {
  const treeGroup = new THREE.Group();

  const trunk = new THREE.Mesh(state.sharedScenery.treeTrunkGeo, state.sharedScenery.treeTrunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  treeGroup.add(trunk);

  const lowerFoliage = new THREE.Mesh(state.sharedScenery.treeCone1Geo, state.sharedScenery.treeFoliageMat);
  lowerFoliage.position.y = 4.2;
  lowerFoliage.castShadow = true;
  treeGroup.add(lowerFoliage);

  const upperFoliage = new THREE.Mesh(state.sharedScenery.treeCone2Geo, state.sharedScenery.treeFoliageMat);
  upperFoliage.position.y = 5.65;
  upperFoliage.castShadow = true;
  treeGroup.add(upperFoliage);

  treeGroup.position.set(x, getTerrainHeight(x, z), z);
  treeGroup.scale.setScalar(scale);
  registerStaticScenery(treeGroup, { kind: 'outdoor', distance: 110 });
  state.scene.add(treeGroup);

  const footprint = 1.05 * scale;
  addSceneryCollider(x - footprint, x + footprint, z - footprint, z + footprint, assetId);
}

export function createFlowerCluster(centerX, centerZ, {
  radius = 0.9,
  count = 10
} = {}) {
  const soil = createGroundedPatch(
    new THREE.CircleGeometry(radius * 1.02, 14),
    new THREE.MeshStandardMaterial({ color: '#3f2a1e', roughness: 0.95 }),
    centerX,
    centerZ,
    { yOffset: 0.014 }
  );
  state.scene.add(soil);

  const edging = createGroundedRing(
    radius * 0.92,
    radius * 1.08,
    16,
    new THREE.MeshStandardMaterial({ color: '#7c8a96', roughness: 0.76 }),
    centerX,
    centerZ,
    { yOffset: 0.04 }
  );
  state.scene.add(edging);

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const ring = i % 2 === 0 ? radius * 0.55 : radius * 0.82;
    const bloomX = centerX + Math.cos(angle) * ring;
    const bloomZ = centerZ + Math.sin(angle) * ring;
    const bloomGroundY = getTerrainHeight(bloomX, bloomZ);

    const stem = new THREE.Mesh(state.sharedScenery.flowerStemGeo, state.sharedScenery.flowerStemMat);
    stem.position.set(bloomX, bloomGroundY + 0.24, bloomZ);
    stem.castShadow = true;
    state.scene.add(stem);

    const petal = new THREE.Mesh(
      state.sharedScenery.flowerCenterGeo,
      state.sharedScenery.flowerPetalMats[i % state.sharedScenery.flowerPetalMats.length]
    );
    petal.position.set(bloomX, bloomGroundY + 0.46, bloomZ);
    petal.castShadow = true;
    state.scene.add(petal);
  }
}

export function buildFrontApproachLandscaping() {
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.72 });
  const bedSpecs = [
    { x: -7.4, z: 44.4, width: 3.8, depth: 4.4 },
    { x: 7.4, z: 44.4, width: 3.8, depth: 4.4 },
    { x: -9.1, z: 52.6, width: 4.4, depth: 5.2 },
    { x: 9.1, z: 52.6, width: 4.4, depth: 5.2 }
  ];

  bedSpecs.forEach((bed, index) => {
    const soil = createGroundedPatch(
      new THREE.CircleGeometry(1.45, 18),
      new THREE.MeshStandardMaterial({ color: '#3f2a1e', roughness: 0.96 }),
      bed.x,
      bed.z,
      {
        yOffset: 0.014,
        scaleX: bed.width / 2.9,
        scaleY: bed.depth / 2.9
      }
    );
    state.scene.add(soil);

    const edging = createGroundedRing(
      1.38,
      1.56,
      24,
      stoneMat,
      bed.x,
      bed.z,
      {
        yOffset: 0.05,
        scaleX: bed.width / 3.04,
        scaleY: bed.depth / 3.04
      }
    );
    state.scene.add(edging);

    createTrimmedBush(bed.x, bed.z - 1.15, {
      scale: 1.08,
      assetId: `plaza-bush-${index}-a`
    });
    createTrimmedBush(bed.x - 0.9, bed.z + 0.42, {
      scale: 0.8,
      assetId: `plaza-bush-${index}-b`
    });
    createTrimmedBush(bed.x + 0.9, bed.z + 0.42, {
      scale: 0.8,
      assetId: `plaza-bush-${index}-c`
    });

    createFlowerCluster(bed.x, bed.z + 1.08, { radius: 0.78, count: 8 });
    createFlowerCluster(bed.x + (bed.x < 0 ? 1.05 : -1.05), bed.z + 1.55, { radius: 0.56, count: 6 });
  });

  [
    { x: -4.75, z: 46.7 },
    { x: 4.75, z: 46.7 },
    { x: -4.9, z: 52.15 },
    { x: 4.9, z: 52.15 }
  ].forEach((planter, index) => {
    const planterBaseY = getTerrainCeiling(planter.x, planter.z, 0.95, 0.65);
    const planterBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.42, 1.3),
      stoneMat
    );
    planterBox.position.set(planter.x, planterBaseY + 0.21, planter.z);
    planterBox.castShadow = true;
    planterBox.receiveShadow = true;
    state.scene.add(planterBox);

    createTrimmedBush(planter.x, planter.z, {
      scale: 0.76,
      assetId: `path-planter-${index}`
    });
    createFlowerCluster(planter.x + (planter.x < 0 ? 0.22 : -0.22), planter.z + 0.18, {
      radius: 0.34,
      count: 5
    });
  });

  [
    { x: -13.4, z: 46.8, scale: 0.78, id: 'plaza-tree-west-entry' },
    { x: 13.4, z: 46.8, scale: 0.78, id: 'plaza-tree-east-entry' },
    { x: -14.2, z: 58.2, scale: 0.92, id: 'plaza-tree-west-fountain' },
    { x: 14.2, z: 58.2, scale: 0.92, id: 'plaza-tree-east-fountain' }
  ].forEach((tree) => {
    createOrnamentalTree(tree.x, tree.z, { scale: tree.scale, assetId: tree.id });
  });
}
