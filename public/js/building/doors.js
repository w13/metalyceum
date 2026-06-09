// Door frame geometry for Metalyceum building entrances
import * as THREE from 'three';
import { state } from '../state.js';

export function createDoorFrame(cx, cz, dir, width, yBase = 0) {
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#5c4033',
    roughness: 0.9,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#2d1e18',
    roughness: 0.95,
  });

  const postHeight = 3.0;
  const postWidth = 0.45;
  const postDepth = 0.65;

  const group = new THREE.Group();

  if (dir === 'H') {
    const post1Geo = new THREE.BoxGeometry(postWidth, postHeight, postDepth);
    const post1 = new THREE.Mesh(post1Geo, frameMat);
    post1.position.set(-width / 2, postHeight / 2, 0);
    post1.castShadow = true;
    post1.receiveShadow = true;
    group.add(post1);

    const post2Geo = new THREE.BoxGeometry(postWidth, postHeight, postDepth);
    const post2 = new THREE.Mesh(post2Geo, frameMat);
    post2.position.set(width / 2, postHeight / 2, 0);
    post2.castShadow = true;
    post2.receiveShadow = true;
    group.add(post2);

    const lintelLen = width + postWidth;
    const lintelHeight = 0.45;
    const lintelGeo = new THREE.BoxGeometry(
      lintelLen,
      lintelHeight,
      postDepth + 0.05,
    );
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, postHeight + lintelHeight / 2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);

    const braceGeo = new THREE.BoxGeometry(0.2, 0.8, postDepth - 0.05);
    braceGeo.rotateZ(Math.PI / 4);

    const braceLeft = new THREE.Mesh(braceGeo, trimMat);
    braceLeft.position.set(-width / 2 + 0.4, postHeight - 0.35, 0);
    braceLeft.castShadow = true;
    group.add(braceLeft);

    const braceRight = new THREE.Mesh(braceGeo, trimMat);
    braceRight.position.set(width / 2 - 0.4, postHeight - 0.35, 0);
    braceRight.castShadow = true;
    group.add(braceRight);
  } else {
    const post1Geo = new THREE.BoxGeometry(postDepth, postHeight, postWidth);
    const post1 = new THREE.Mesh(post1Geo, frameMat);
    post1.position.set(0, postHeight / 2, -width / 2);
    post1.castShadow = true;
    post1.receiveShadow = true;
    group.add(post1);

    const post2Geo = new THREE.BoxGeometry(postDepth, postHeight, postWidth);
    const post2 = new THREE.Mesh(post2Geo, frameMat);
    post2.position.set(0, postHeight / 2, width / 2);
    post2.castShadow = true;
    post2.receiveShadow = true;
    group.add(post2);

    const lintelLen = width + postWidth;
    const lintelHeight = 0.45;
    const lintelGeo = new THREE.BoxGeometry(
      postDepth + 0.05,
      lintelHeight,
      lintelLen,
    );
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, postHeight + lintelHeight / 2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);

    const braceGeo = new THREE.BoxGeometry(postDepth - 0.05, 0.8, 0.2);
    braceGeo.rotateX(Math.PI / 4);

    const braceNorth = new THREE.Mesh(braceGeo, trimMat);
    braceNorth.position.set(0, postHeight - 0.35, -width / 2 + 0.4);
    braceNorth.castShadow = true;
    group.add(braceNorth);

    const braceSouth = new THREE.Mesh(braceGeo, trimMat);
    braceSouth.position.set(0, postHeight - 0.35, width / 2 - 0.4);
    braceSouth.castShadow = true;
    group.add(braceSouth);
  }

  group.position.set(cx, yBase, cz);
  state.scene.add(group);
  return group;
}
